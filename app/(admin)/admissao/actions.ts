'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getUser } from '@/lib/auth/get-user'
import { listarTurnosDoPosto, listarTurnosJovemAprendiz } from '@/app/(admin)/efetivo/horario/actions'
import { filtroPostoDaFuncao, funcaoAdmissivel, postoAceitaFuncao } from '@/lib/admissao/funcoes-posto'
import { normalizarDossie } from '@/lib/admissao/normalizar'
import { errosDoDossie } from '@/lib/admissao/validar'
import type { ContextoAdmissao, DossieAdmissao, PacoteAdmissao } from '@/lib/admissao/tipos'
import type { TurnoHorarios } from '@/lib/turnos/escala'
import type { Json } from '@/types/database'

type Resultado<T> = ({ success: true } & T) | { success: false; error: string }

type TurnoComNome = TurnoHorarios & { id: string; nome: string }

async function exigirSupervisor() {
  const auth = await getUser()
  if (!auth) return { ok: false, erro: 'Não autenticado' } as const
  if (auth.perfil.role !== 'supervisor') return { ok: false, erro: 'Apenas supervisores preparam admissões por aqui' } as const
  return { ok: true, auth } as const
}

/** O posto precisa estar entre os do supervisor (mesma regra da página de Postos). */
async function supervisorAtendePosto(userId: string, postoId: string): Promise<boolean> {
  const { data } = await createClient()
    .from('config_supervisores_postos')
    .select('posto_id')
    .eq('supervisor_id', userId)
    .eq('posto_id', postoId)
    .eq('ativo', true)
    .limit(1)
  return (data ?? []).length > 0
}

const JOVEM_APRENDIZ = (nome: string | null | undefined) => (nome ?? '').toUpperCase().includes('APRENDIZ')

async function turnosDisponiveis(postoId: string, jovemAprendiz: boolean): Promise<TurnoComNome[]> {
  const lista = jovemAprendiz ? await listarTurnosJovemAprendiz() : await listarTurnosDoPosto(postoId)
  return lista as unknown as TurnoComNome[]
}

/** Falso enquanto a migração 20261025 não foi aplicada (a página mostra um aviso em vez de quebrar). */
export async function admissaoDisponivel(): Promise<boolean> {
  const admin = createAdminClient()
  const [rascunhos, funcoes, postos] = await Promise.all([
    admin.from('admissao_rascunhos').select('supervisor_id').limit(1),
    admin.from('funcoes').select('cbo').limit(1),
    admin.from('postos').select('centro_custo').limit(1),
  ])
  return !rascunhos.error && !funcoes.error && !postos.error
}

// ─── Sugestões do sistema ─────────────────────────────────────────────────────

export interface SugestaoAdmissao {
  contrato: string
  centro_custo: string
  funcao: {
    nome: string
    salario_base: number | null
    insalubridade_perc: number | null
    insalubridade_valor: number | null
    periculosidade_perc: number | null
    periculosidade_valor: number | null
    cbo: string
    sindicato: string
    va: number | null
    vr: number | null
  } | null
  jovemAprendiz: boolean
}

/**
 * Valores que o sistema já sabe: salário, insalubridade, periculosidade, VA e VR da função; CBO, sindicato,
 * centro de custo e contrato. Usa o admin client porque funcoes/custos_funcoes/contratos são só admin/coord no RLS.
 */
export async function carregarSugestaoAdmissao(postoId: string, funcaoId: string): Promise<Resultado<{ sugestao: SugestaoAdmissao }>> {
  const g = await exigirSupervisor()
  if (!g.ok) return { success: false, error: g.erro }
  if (postoId && !(await supervisorAtendePosto(g.auth.user.id, postoId))) {
    return { success: false, error: 'Posto fora da sua carteira' }
  }

  const admin = createAdminClient()

  let contrato = ''
  let centro_custo = ''
  if (postoId) {
    const { data: posto } = await admin
      .from('postos')
      .select('secretaria, centro_custo, contratos(numero)')
      .eq('id', postoId)
      .single()
    const p = posto as unknown as { secretaria: string | null; centro_custo: string | null; contratos: { numero: string | null } | null } | null
    contrato = p?.contratos?.numero ?? p?.secretaria ?? ''
    centro_custo = p?.centro_custo ?? ''
  }

  let funcao: SugestaoAdmissao['funcao'] = null
  if (funcaoId) {
    const { data: f } = await admin
      .from('funcoes')
      .select('nome, salario_base, insalubridade_perc, insalubridade_valor, periculosidade_perc, periculosidade_valor, cbo, sindicato, custos_funcoes(va, vr)')
      .eq('id', funcaoId)
      .single()
    if (f) {
      const c = Array.isArray(f.custos_funcoes) ? f.custos_funcoes[0] : f.custos_funcoes
      funcao = {
        nome: f.nome,
        salario_base: f.salario_base,
        insalubridade_perc: f.insalubridade_perc,
        insalubridade_valor: f.insalubridade_valor,
        periculosidade_perc: f.periculosidade_perc,
        periculosidade_valor: f.periculosidade_valor,
        cbo: f.cbo ?? '',
        sindicato: f.sindicato ?? '',
        va: c?.va ?? null,
        vr: c?.vr ?? null,
      }
    }
  }

  return { success: true, sugestao: { contrato, centro_custo, funcao, jovemAprendiz: JOVEM_APRENDIZ(funcao?.nome) } }
}

/** ViaCEP é consultado pelo servidor porque a CSP do app não libera chamadas do navegador para fora. Só o CEP sai daqui. */
export async function consultarCep(cep: string): Promise<Resultado<{ endereco: { logradouro: string; bairro: string; cidade: string; uf: string } }>> {
  const g = await exigirSupervisor()
  if (!g.ok) return { success: false, error: g.erro }
  const digitos = cep.replace(/\D/g, '')
  if (digitos.length !== 8) return { success: false, error: 'CEP inválido' }
  try {
    const resp = await fetch(`https://viacep.com.br/ws/${digitos}/json/`, { signal: AbortSignal.timeout(5000), cache: 'no-store' })
    if (!resp.ok) return { success: false, error: 'Não foi possível consultar o CEP' }
    const j = (await resp.json()) as { erro?: boolean; logradouro?: string; bairro?: string; localidade?: string; uf?: string }
    if (j.erro) return { success: false, error: 'CEP não encontrado' }
    return { success: true, endereco: { logradouro: j.logradouro ?? '', bairro: j.bairro ?? '', cidade: j.localidade ?? '', uf: j.uf ?? '' } }
  } catch {
    return { success: false, error: 'Não foi possível consultar o CEP' }
  }
}

// ─── Substituído ──────────────────────────────────────────────────────────────

export interface Substituivel {
  id: string
  nome: string
  posto_nome: string | null
  mesmo_posto: boolean
  data_desligamento: string | null
  tipo_desligamento: string | null
  motivo_desligamento: string | null
}

/**
 * Desligados que o supervisor pode indicar como substituídos. Sem busca: últimos 60 dias; com busca (3+ letras): últimos 12 meses.
 * Devolve só nome, posto e dados do desligamento — nunca CPF, salário ou qualquer outro dado do funcionário —
 * porque o supervisor também vê desligados de postos que não são dele (admin client).
 */
export async function buscarSubstituiveis(postoId: string, termo: string): Promise<Resultado<{ itens: Substituivel[] }>> {
  const g = await exigirSupervisor()
  if (!g.ok) return { success: false, error: g.erro }

  const t = termo.trim().slice(0, 60)
  const dias = t.length >= 3 ? 365 : 60
  const desde = new Date(Date.now() - dias * 86_400_000).toISOString().slice(0, 10)

  let q = createAdminClient()
    .from('funcionarios')
    .select('id, nome, posto_id, data_desligamento, tipo_desligamento, motivo_desligamento, postos(nome)')
    .eq('status', 'desligado')
    .gte('data_desligamento', desde)
    .order('data_desligamento', { ascending: false })
    .limit(80)
  if (t.length >= 3) q = q.ilike('nome', `%${t.replace(/[%_\\]/g, ch => `\\${ch}`)}%`)

  const { data, error } = await q
  if (error) return { success: false, error: error.message }

  const itens = (data ?? []).map((row): Substituivel => {
    const f = row as unknown as {
      id: string; nome: string; posto_id: string | null; data_desligamento: string | null
      tipo_desligamento: string | null; motivo_desligamento: string | null; postos: { nome: string } | null
    }
    return {
      id: f.id,
      nome: f.nome,
      posto_nome: f.postos?.nome ?? null,
      mesmo_posto: !!postoId && f.posto_id === postoId,
      data_desligamento: f.data_desligamento,
      tipo_desligamento: f.tipo_desligamento,
      motivo_desligamento: f.motivo_desligamento,
    }
  })
  // Mesmo posto primeiro; dentro de cada grupo mantém a ordem (mais recente primeiro).
  itens.sort((a, b) => Number(b.mesmo_posto) - Number(a.mesmo_posto))
  return { success: true, itens: itens.slice(0, 15) }
}

// ─── Rascunho ─────────────────────────────────────────────────────────────────

const LIMITE_RASCUNHO = 30_000

export async function obterRascunho(): Promise<Resultado<{ dados: Partial<DossieAdmissao> | null; atualizadoEm: string | null }>> {
  const g = await exigirSupervisor()
  if (!g.ok) return { success: false, error: g.erro }
  const { data } = await createClient()
    .from('admissao_rascunhos')
    .select('dados, updated_at')
    .eq('supervisor_id', g.auth.user.id)
    .maybeSingle()
  if (!data) return { success: true, dados: null, atualizadoEm: null }
  return { success: true, dados: data.dados as unknown as Partial<DossieAdmissao>, atualizadoEm: data.updated_at }
}

export async function salvarRascunho(dados: unknown): Promise<Resultado<object>> {
  const g = await exigirSupervisor()
  if (!g.ok) return { success: false, error: g.erro }
  // Mesma sanitização do envio, para o rascunho nunca guardar lixo; sem validar (rascunho pode estar incompleto).
  const limpo = normalizarDossie(dados)
  if (JSON.stringify(limpo).length > LIMITE_RASCUNHO) return { success: false, error: 'Rascunho grande demais' }
  const { error } = await createClient()
    .from('admissao_rascunhos')
    .upsert({ supervisor_id: g.auth.user.id, dados: limpo as unknown as Json, updated_at: new Date().toISOString() })
  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function descartarRascunho(): Promise<Resultado<object>> {
  const g = await exigirSupervisor()
  if (!g.ok) return { success: false, error: g.erro }
  const { error } = await createClient().from('admissao_rascunhos').delete().eq('supervisor_id', g.auth.user.id)
  if (error) return { success: false, error: error.message }
  return { success: true }
}

// ─── Envio ────────────────────────────────────────────────────────────────────

/**
 * Valida tudo de novo no servidor (o navegador não é confiável), monta o contexto dos PDFs a partir do banco
 * e cria a solicitação de admissão. Os campos antigos de `dados_depois` continuam presentes, então a aprovação
 * e a lista de Aprovações funcionam como antes; o dossiê vai junto em `dossie` + `contexto`.
 */
export async function enviarAdmissaoAssistida(bruto: unknown): Promise<Resultado<{ solicitacaoId: string; pacote: PacoteAdmissao }>> {
  const g = await exigirSupervisor()
  if (!g.ok) return { success: false, error: g.erro }
  const { auth } = g

  const dossie = normalizarDossie(bruto)

  if (!dossie.posto_id || !(await supervisorAtendePosto(auth.user.id, dossie.posto_id))) {
    return { success: false, error: 'Posto fora da sua carteira' }
  }

  const admin = createAdminClient()
  const [{ data: funcao }, { data: posto }] = await Promise.all([
    admin.from('funcoes').select('nome, salario_base, insalubridade_perc, insalubridade_valor, periculosidade_perc, periculosidade_valor').eq('id', dossie.funcao_id).maybeSingle(),
    admin.from('postos').select('nome, secretaria').eq('id', dossie.posto_id).maybeSingle(),
  ])
  if (!funcao) return { success: false, error: 'Função não encontrada' }
  if (!posto) return { success: false, error: 'Posto não encontrado' }
  if (!funcaoAdmissivel(funcao.nome) || !postoAceitaFuncao(filtroPostoDaFuncao(funcao.nome), posto.secretaria)) {
    return { success: false, error: 'Esta função não pode ser admitida neste posto' }
  }

  const jovemAprendiz = JOVEM_APRENDIZ(funcao.nome)
  if (jovemAprendiz) dossie.periodo_experiencia = 'nenhum'

  const turnos = await turnosDisponiveis(dossie.posto_id, jovemAprendiz)
  if (dossie.turno_id && !turnos.some(t => t.id === dossie.turno_id)) {
    return { success: false, error: 'Turno inválido para este posto' }
  }
  const turno = turnos.find(t => t.id === dossie.turno_id) ?? null

  const erros = errosDoDossie(dossie, { turnoObrigatorio: turnos.length > 0, jovemAprendiz })
  if (erros.length > 0) return { success: false, error: erros[0] }

  const { data: jaPendente } = await admin
    .from('solicitacoes')
    .select('id')
    .eq('status', 'pendente')
    .eq('tipo', 'admissao' as unknown as 'desligamento')
    .filter('dados_depois->dossie->>cpf', 'eq', dossie.cpf)
    .limit(1)
  if ((jaPendente ?? []).length > 0) {
    return { success: false, error: 'Já existe uma solicitação de admissão pendente para este CPF' }
  }

  const contexto: ContextoAdmissao = {
    funcao_nome: funcao.nome,
    posto_nome: posto.nome,
    secretaria: posto.secretaria,
    salario_base: funcao.salario_base,
    insalubridade_perc: funcao.insalubridade_perc,
    insalubridade_valor: funcao.insalubridade_valor,
    periculosidade_perc: funcao.periculosidade_perc,
    periculosidade_valor: funcao.periculosidade_valor,
    turno,
    palestrante: auth.perfil.nome ?? '',
  }
  const pacote: PacoteAdmissao = { dossie, contexto }

  const { data: criada, error } = await createClient()
    .from('solicitacoes')
    .insert({
      tipo: 'admissao' as unknown as 'desligamento',
      status: 'pendente',
      supervisor_id: auth.user.id,
      funcionario_id: null as unknown as string,
      dados_antes: null,
      dados_depois: {
        nome: dossie.nome,
        funcao_id: dossie.funcao_id,
        funcao_nome: funcao.nome,
        posto_id: dossie.posto_id,
        posto_nome: posto.nome,
        secretaria: posto.secretaria,
        data_admissao: dossie.data_admissao,
        periodo_experiencia: dossie.periodo_experiencia,
        turno_destino_id: dossie.turno_id || null,
        dia_curso_destino: dossie.turno_id && jovemAprendiz ? dossie.dia_curso : null,
        dossie,
        contexto,
      } as unknown as Json,
    })
    .select('id')
    .single()
  if (error || !criada) return { success: false, error: error?.message ?? 'Erro ao criar a solicitação' }

  await createClient().from('admissao_rascunhos').delete().eq('supervisor_id', auth.user.id)

  revalidatePath('/aprovacoes')
  revalidatePath('/postos')
  return { success: true, solicitacaoId: criada.id, pacote }
}
