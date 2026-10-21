'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getUser } from '@/lib/auth/get-user'
import { listarTurnosDoPosto, listarTurnosJovemAprendiz } from '@/app/(admin)/efetivo/horario/actions'
import { filtroPostoDaFuncao, funcaoAdmissivel, postoAceitaFuncao } from '@/lib/admissao/funcoes-posto'
import { buscarEnderecoPorCep, type EnderecoCep } from '@/lib/admissao/cep'
import { SINDICATO_PADRAO } from '@/lib/admissao/constantes'
import { normalizarDossie } from '@/lib/admissao/normalizar'
import { numeroBR } from '@/lib/admissao/vt'
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
  const sondas = await Promise.all([
    admin.from('admissao_rascunhos').select('supervisor_id').limit(1),
    admin.from('funcoes').select('cbo, setor, sindicato').limit(1),
    admin.from('perfis').select('centro_custo').limit(1),
    admin.from('linhas_transporte').select('chave').limit(1),
  ])
  return sondas.every(s => !s.error)
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
    setor: string
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
  if (postoId) {
    const { data: posto } = await admin
      .from('postos')
      .select('secretaria, contratos(numero)')
      .eq('id', postoId)
      .single()
    const p = posto as unknown as { secretaria: string | null; contratos: { numero: string | null } | null } | null
    contrato = p?.contratos?.numero ?? p?.secretaria ?? ''
  }

  // O centro de custo é do supervisor (70601–70607), não do posto.
  const { data: perfil } = await admin.from('perfis').select('centro_custo').eq('id', g.auth.user.id).maybeSingle()
  const centro_custo = perfil?.centro_custo ?? ''

  let funcao: SugestaoAdmissao['funcao'] = null
  if (funcaoId) {
    const { data: f } = await admin
      .from('funcoes')
      .select('nome, salario_base, insalubridade_perc, insalubridade_valor, periculosidade_perc, periculosidade_valor, cbo, setor, sindicato, custos_funcoes(va, vr)')
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
        setor: f.setor ?? '',
        sindicato: f.sindicato || SINDICATO_PADRAO,
        va: c?.va ?? null,
        vr: c?.vr ?? null,
      }
    }
  }

  return { success: true, sugestao: { contrato, centro_custo, funcao, jovemAprendiz: JOVEM_APRENDIZ(funcao?.nome) } }
}

/**
 * O CEP é consultado pelo servidor porque a CSP do app não libera chamadas do navegador para fora.
 * Só o CEP sai daqui. Usa ViaCEP e, se ele falhar, BrasilAPI (ver lib/admissao/cep.ts).
 */
export async function consultarCep(cep: string): Promise<Resultado<{ endereco: EnderecoCep }>> {
  const g = await exigirSupervisor()
  if (!g.ok) return { success: false, error: g.erro }
  const r = await buscarEnderecoPorCep(cep)
  if (r.ok) return { success: true, endereco: r.endereco }
  if (r.motivo === 'invalido') return { success: false, error: 'CEP inválido' }
  if (r.motivo === 'nao_encontrado') return { success: false, error: 'CEP não encontrado — confira os números ou digite o endereço' }
  return { success: false, error: 'Não foi possível consultar o CEP agora — digite o endereço' }
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

async function postosDoSupervisor(userId: string): Promise<string[]> {
  const { data } = await createClient()
    .from('config_supervisores_postos')
    .select('posto_id')
    .eq('supervisor_id', userId)
    .eq('ativo', true)
  return (data ?? []).map(r => r.posto_id as string)
}

/**
 * Desligados que o supervisor pode indicar como substituídos — só de postos dele (o do funcionário a admitir primeiro).
 * Quem ficou sem posto no cadastro entra pelo posto de origem (ou pelo supervisor da admissão) guardado no histórico
 * (ver `origemDosDesligados`).
 * Sem filtro: últimos 60 dias. `mes` (AAAA-MM) mostra só quem saiu naquele mês. Com busca por nome (3+ letras) a lista
 * ignora o mês e olha os últimos 6 meses (limite da reposição). Admin client com filtro explícito de postos: o RLS do supervisor não enxerga desligados.
 */
export async function buscarSubstituiveis(postoId: string, termo: string, mes?: string): Promise<Resultado<{ itens: Substituivel[] }>> {
  const g = await exigirSupervisor()
  if (!g.ok) return { success: false, error: g.erro }

  const meusPostos = await postosDoSupervisor(g.auth.user.id)
  if (meusPostos.length === 0) return { success: true, itens: [] }

  const t = termo.trim().slice(0, 60)
  const hoje = new Date()
  let desde: string
  let ate: string | null = null
  if (t.length >= 3) {
    desde = new Date(hoje.getTime() - 183 * 86_400_000).toISOString().slice(0, 10)
  } else if (mes && /^\d{4}-\d{2}$/.test(mes)) {
    const [ano, m] = mes.split('-').map(Number)
    desde = `${mes}-01`
    ate = new Date(Date.UTC(ano, m, 0)).toISOString().slice(0, 10) // último dia do mês
  } else {
    desde = new Date(hoje.getTime() - 60 * 86_400_000).toISOString().slice(0, 10)
  }

  let q = createAdminClient()
    .from('funcionarios')
    .select('id, nome, posto_id, data_desligamento, tipo_desligamento, motivo_desligamento, postos(nome)')
    .eq('status', 'desligado')
    .in('posto_id', meusPostos)
    .gte('data_desligamento', desde)
    .order('data_desligamento', { ascending: false })
    .limit(120)
  if (ate) q = q.lte('data_desligamento', ate)
  if (t.length >= 3) q = q.ilike('nome', `%${t.replace(/[%_\\]/g, ch => `\\${ch}`)}%`)

  // Desligados antigos ficaram com o posto vazio no cadastro; o posto em que estavam fica no histórico.
  let qSem = createAdminClient()
    .from('funcionarios')
    .select('id, nome, data_desligamento, tipo_desligamento, motivo_desligamento')
    .eq('status', 'desligado')
    .is('posto_id', null)
    .gte('data_desligamento', desde)
    .order('data_desligamento', { ascending: false })
    .limit(300)
  if (ate) qSem = qSem.lte('data_desligamento', ate)
  if (t.length >= 3) qSem = qSem.ilike('nome', `%${t.replace(/[%_\\]/g, ch => `\\${ch}`)}%`)

  const [{ data, error }, { data: semPosto }] = await Promise.all([q, qSem])
  if (error) return { success: false, error: error.message }

  const origem = await origemDosDesligados((semPosto ?? []).map(f => f.id))
  const meuNome = (g.auth.perfil.nome ?? '').trim().toUpperCase()
  const antigos = (semPosto ?? []).filter(f => {
    const p = origem.postos.get(f.id)
    if (p) return meusPostos.includes(p)
    // Sem posto no histórico: vale o supervisor que fez a admissão (registro antigo, anterior ao sistema).
    return !!meuNome && origem.supervisores.get(f.id)?.trim().toUpperCase() === meuNome
  })
  const nomesPostos = new Map<string, string>()
  const idsPostos = Array.from(new Set(antigos.map(f => origem.postos.get(f.id)).filter((p): p is string => !!p)))
  if (idsPostos.length > 0) {
    const { data: ps } = await createAdminClient().from('postos').select('id, nome').in('id', idsPostos)
    for (const p of ps ?? []) nomesPostos.set(p.id, p.nome)
  }

  const itensAntigos = antigos.map((f): Substituivel => {
    const posto = origem.postos.get(f.id) ?? null
    return {
      id: f.id,
      nome: f.nome,
      posto_nome: posto ? nomesPostos.get(posto) ?? null : null,
      mesmo_posto: !!postoId && posto === postoId,
      data_desligamento: f.data_desligamento,
      tipo_desligamento: f.tipo_desligamento,
      motivo_desligamento: f.motivo_desligamento,
    }
  })

  const itensComPosto = (data ?? []).map((row): Substituivel => {
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
  // Mesmo posto primeiro; dentro de cada grupo, mais recente primeiro.
  const itens = [...itensComPosto, ...itensAntigos]
  itens.sort((a, b) =>
    Number(b.mesmo_posto) - Number(a.mesmo_posto)
    || (b.data_desligamento ?? '').localeCompare(a.data_desligamento ?? ''))
  return { success: true, itens: itens.slice(0, 40) }
}

/**
 * De onde veio cada desligado que ficou sem posto no cadastro.
 * `postos`: último `mudanca_posto` do histórico que zerou o posto; na falta dele, o posto da solicitação de desligamento.
 * `supervisores`: para quem não tem posto em nenhum dos dois, o supervisor registrado no histórico de admissão.
 */
async function origemDosDesligados(funcionarioIds: string[]): Promise<{ postos: Map<string, string>; supervisores: Map<string, string> }> {
  const mapa = new Map<string, string>()
  const supervisores = new Map<string, string>()
  if (funcionarioIds.length === 0) return { postos: mapa, supervisores }
  const admin = createAdminClient()
  const postoDe = (j: unknown): string | null => {
    const v = (j as { posto_id?: string | null } | null)?.posto_id
    return typeof v === 'string' ? v : null
  }

  const { data: hist } = await admin
    .from('historico_funcionarios')
    .select('funcionario_id, dados_anteriores, dados_novos')
    .in('funcionario_id', funcionarioIds)
    .eq('tipo', 'mudanca_posto')
    .order('created_at', { ascending: false })
    .limit(1000)
  for (const h of hist ?? []) {
    const anterior = postoDe(h.dados_anteriores)
    if (!mapa.has(h.funcionario_id) && anterior && postoDe(h.dados_novos) === null) mapa.set(h.funcionario_id, anterior)
  }

  const faltam = funcionarioIds.filter(id => !mapa.has(id))
  if (faltam.length > 0) {
    const { data: sols } = await admin
      .from('solicitacoes')
      .select('funcionario_id, dados_antes')
      .in('funcionario_id', faltam)
      .eq('tipo', 'desligamento')
      .order('created_at', { ascending: false })
      .limit(1000)
    for (const s of sols ?? []) {
      const anterior = postoDe(s.dados_antes)
      if (s.funcionario_id && !mapa.has(s.funcionario_id) && anterior) mapa.set(s.funcionario_id, anterior)
    }
  }

  const semOrigem = funcionarioIds.filter(id => !mapa.has(id))
  if (semOrigem.length > 0) {
    const { data: adm } = await admin
      .from('historico_funcionarios')
      .select('funcionario_id, dados_novos')
      .in('funcionario_id', semOrigem)
      .eq('tipo', 'admissao')
      .order('created_at', { ascending: false })
      .limit(1000)
    for (const a of adm ?? []) {
      const sup = (a.dados_novos as { supervisor?: unknown } | null)?.supervisor
      if (typeof sup === 'string' && sup && !supervisores.has(a.funcionario_id)) supervisores.set(a.funcionario_id, sup)
    }
  }
  return { postos: mapa, supervisores }
}

// ─── Linhas de transporte ─────────────────────────────────────────────────────

export interface LinhaConhecida { linha: string; tipo: string | null; empresa: string | null; valor: number | null }

/** Linhas já informadas em admissões anteriores, mais usadas primeiro — alimentam o autocompletar do VT. */
export async function listarLinhasTransporte(): Promise<LinhaConhecida[]> {
  const g = await exigirSupervisor()
  if (!g.ok) return []
  const { data } = await createClient()
    .from('linhas_transporte')
    .select('linha, tipo, empresa, valor')
    .order('usos', { ascending: false })
    .limit(400)
  return (data ?? []) as LinhaConhecida[]
}

/** Guarda as linhas da admissão no catálogo (cria ou soma um uso). Falha aqui não impede a solicitação. */
async function registrarLinhasTransporte(d: DossieAdmissao): Promise<void> {
  if (!d.vt_utiliza) return
  const admin = createAdminClient()
  for (const l of d.vt_linhas) {
    const linha = l.linha.trim()
    if (!linha) continue
    const chave = linha.toLowerCase().replace(/\s+/g, ' ')
    const { data: existente } = await admin.from('linhas_transporte').select('id, usos').eq('chave', chave).maybeSingle()
    const dados = { linha, tipo: l.tipo || null, empresa: l.empresa.trim() || null, valor: numeroBR(l.valor), updated_at: new Date().toISOString() }
    if (existente) await admin.from('linhas_transporte').update({ ...dados, usos: existente.usos + 1 }).eq('id', existente.id)
    else await admin.from('linhas_transporte').insert({ chave, ...dados })
  }
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
  await registrarLinhasTransporte(dossie).catch(() => undefined)

  revalidatePath('/aprovacoes')
  revalidatePath('/postos')
  return { success: true, solicitacaoId: criada.id, pacote }
}
