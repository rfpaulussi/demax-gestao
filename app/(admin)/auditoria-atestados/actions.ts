'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import { getUser } from '@/lib/auth/get-user'
import { isAdminOrCoord, type Role } from '@/types'
import { extrairRegistroDeMatricula } from '@/lib/auditoria-atestados/parse'
import { compararAuditoria, type FuncionarioLookup } from '@/lib/auditoria-atestados/comparar'
import type { LinhaSesmt, AtestadoSistema, ResultadoAuditoria } from '@/lib/auditoria-atestados/tipos'
import type { Json } from '@/types/database'
import { cidFormatoValido } from '@/lib/auditoria-atestados/cid-formato'

type FuncionarioRaw = { id: string; registro: string | null; nome: string; posto_id: string | null }
type AtestadoRaw = {
  id: string
  funcionario_id: string
  data_inicio: string
  data_fim: string
  cid_codigo: string | null
  origem_ocupacional: string | null
}
type CidRaw = { codigo: string; descricao: string }

export async function auditarSesmt(linhasSesmt: LinhaSesmt[]): Promise<ResultadoAuditoria | { erro: string }> {
  const auth = await getUser()
  if (!auth) return { erro: 'Não autenticado' }
  if (!isAdminOrCoord(auth.perfil.role as Role)) return { erro: 'Sem permissão' }

  if (linhasSesmt.length === 0) return { erro: 'Nenhuma linha para auditar' }

  const supabase = createClient()

  const registrosNoArquivo = new Set<string>()
  const linhasComRegistro: Array<{ linha: LinhaSesmt; registro: string | null }> = linhasSesmt.map(linha => {
    const registro = extrairRegistroDeMatricula(linha.matriculaRaw)
    if (registro) registrosNoArquivo.add(registro)
    return { linha, registro }
  })

  const [{ data: funcRaw, error: errFunc }, { data: cidRaw, error: errCid }] = await Promise.all([
    supabase.from('funcionarios').select('id, registro, nome, posto_id').not('registro', 'is', null),
    supabase.from('cid_referencia').select('codigo, descricao'),
  ])

  if (errFunc) return { erro: `Erro ao buscar funcionários: ${errFunc.message}` }
  if (errCid) return { erro: `Erro ao buscar CIDs: ${errCid.message}` }

  const funcionarios = (funcRaw ?? []) as FuncionarioRaw[]
  const cids = (cidRaw ?? []) as CidRaw[]

  const funcionariosPorRegistro = new Map<string, FuncionarioLookup>()
  for (const f of funcionarios) {
    if (f.registro) funcionariosPorRegistro.set(f.registro, { id: f.id, postoId: f.posto_id })
  }

  const funcionarioIdsRelevantes = funcionarios
    .filter(f => f.registro && registrosNoArquivo.has(f.registro))
    .map(f => f.id)

  const cidMap = new Map(cids.map(c => [c.codigo, c.descricao] as [string, string]))

  let atestadosRaw: AtestadoRaw[] = []
  if (funcionarioIdsRelevantes.length > 0) {
    atestadosRaw = await fetchAllRows((from, to) =>
      supabase
        .from('atestados')
        .select('id, funcionario_id, data_inicio, data_fim, cid_codigo, origem_ocupacional')
        .in('funcionario_id', funcionarioIdsRelevantes)
        .range(from, to) as unknown as PromiseLike<{ data: AtestadoRaw[] | null; error: { message: string } | null }>,
    )
  }

  const atestadosPorRegistro = new Map<string, AtestadoSistema[]>()
  for (const a of atestadosRaw) {
    const func = funcionarios.find(f => f.id === a.funcionario_id)
    if (!func?.registro) continue
    const sistema: AtestadoSistema = {
      id: a.id,
      funcionarioId: a.funcionario_id,
      funcionarioNome: func.nome,
      registro: func.registro,
      dataInicio: a.data_inicio,
      dataFim: a.data_fim,
      cidCodigo: a.cid_codigo,
      cidDescricao: a.cid_codigo ? (cidMap.get(a.cid_codigo) ?? null) : null,
      origemOcupacional: a.origem_ocupacional,
    }
    const lista = atestadosPorRegistro.get(func.registro) ?? []
    lista.push(sistema)
    atestadosPorRegistro.set(func.registro, lista)
  }

  const resultado = compararAuditoria(linhasComRegistro, funcionariosPorRegistro, atestadosPorRegistro)
  return { ...resultado, cids }
}

// ─── Solicitações (nada grava em `atestados` aqui — só o admin, na tela de Aprovações) ────────

type ResultadoSolicitacao = { success: true } | { success: false; error: string }

const ISO = /^\d{4}-\d{2}-\d{2}$/

/** true = CID válido que ainda não existe em cid_referencia (será cadastrado na aprovação). */
async function cidPrecisaCadastro(supabase: ReturnType<typeof createClient>, cid: string | null): Promise<boolean | 'invalido'> {
  if (!cid) return false
  if (!cidFormatoValido(cid)) return 'invalido'
  const { data } = await supabase.from('cid_referencia').select('codigo').eq('codigo', cid).maybeSingle()
  return !data
}

async function assertAdminOuCoord(): Promise<{ userId: string } | { erro: string }> {
  const auth = await getUser()
  if (!auth) return { erro: 'Não autenticado' }
  if (!isAdminOrCoord(auth.perfil.role as Role)) return { erro: 'Sem permissão' }
  return { userId: auth.user.id }
}

export async function solicitarLancamentoAtestado(input: {
  funcionarioId: string
  dataInicio: string
  dataFim: string
  motivo: string
  cidCodigo: string | null
  semCid: boolean
  origemOcupacional: 'acidente_trabalho' | 'doenca_ocupacional' | null
}): Promise<ResultadoSolicitacao> {
  const g = await assertAdminOuCoord()
  if ('erro' in g) return { success: false, error: g.erro }
  if (!ISO.test(input.dataInicio) || !ISO.test(input.dataFim)) return { success: false, error: 'Datas inválidas' }
  if (input.dataFim < input.dataInicio) return { success: false, error: 'Data fim não pode ser anterior à data início.' }

  const supabase = createClient()
  const { data: func } = await supabase.from('funcionarios').select('id, posto_id').eq('id', input.funcionarioId).single()
  if (!func) return { success: false, error: 'Funcionário não encontrado' }
  if (!func.posto_id) return { success: false, error: 'Funcionário sem posto vinculado — lance manualmente pela tela Efetivo.' }

  const cidLancar = input.semCid ? null : input.cidCodigo || null
  const cidNovoLancar = await cidPrecisaCadastro(supabase, cidLancar)
  if (cidNovoLancar === 'invalido') return { success: false, error: `CID "${cidLancar}" inválido (formato esperado: A00 ou A00.0).` }

  const { data: pendentes } = await supabase
    .from('solicitacoes')
    .select('id, dados_depois')
    .eq('funcionario_id', input.funcionarioId)
    .eq('status', 'pendente')
    .eq('tipo', 'lancamento_atestado' as unknown as 'desligamento')
  const jaPedido = (pendentes ?? []).some(p => (p.dados_depois as { data_inicio?: string } | null)?.data_inicio === input.dataInicio)
  if (jaPedido) return { success: false, error: 'Já existe uma solicitação pendente de lançamento para esta data — veja em Aprovações.' }

  const { error } = await supabase.from('solicitacoes').insert({
    tipo: 'lancamento_atestado' as unknown as 'desligamento',
    status: 'pendente',
    funcionario_id: input.funcionarioId,
    supervisor_id: g.userId,
    dados_antes: {},
    dados_depois: {
      data_inicio: input.dataInicio,
      data_fim: input.dataFim,
      motivo: input.motivo || null,
      cid_codigo: cidLancar,
      cid_novo: cidNovoLancar === true,
      sem_cid: input.semCid,
      origem_ocupacional: input.origemOcupacional,
      posto_id: func.posto_id,
      fonte: 'auditoria_sesmt',
    },
  })
  if (error) return { success: false, error: error.message }

  revalidatePath('/aprovacoes')
  return { success: true }
}

export type CamposCorrecao = {
  dataInicio?: string
  dataFim?: string
  cidCodigo?: string | null
  origemOcupacional?: 'acidente_trabalho' | 'doenca_ocupacional' | null
}

export async function solicitarCorrecaoAtestado(atestadoId: string, campos: CamposCorrecao): Promise<ResultadoSolicitacao> {
  const g = await assertAdminOuCoord()
  if ('erro' in g) return { success: false, error: g.erro }
  if ((campos.dataInicio && !ISO.test(campos.dataInicio)) || (campos.dataFim && !ISO.test(campos.dataFim))) {
    return { success: false, error: 'Datas inválidas' }
  }

  const supabase = createClient()
  const { data: at } = await supabase
    .from('atestados')
    .select('id, funcionario_id, data_inicio, data_fim, cid_codigo, origem_ocupacional')
    .eq('id', atestadoId)
    .single()
  if (!at) return { success: false, error: 'Atestado não encontrado' }

  // dados_antes vem do banco (nunca do client); dados_depois só carrega o que de fato muda.
  const antes: Record<string, unknown> = {}
  const depois: Record<string, unknown> = { atestado_id: at.id, fonte: 'auditoria_sesmt' }
  if (campos.dataInicio !== undefined && campos.dataInicio !== at.data_inicio) { antes.data_inicio = at.data_inicio; depois.data_inicio = campos.dataInicio }
  if (campos.dataFim !== undefined && campos.dataFim !== at.data_fim) { antes.data_fim = at.data_fim; depois.data_fim = campos.dataFim }
  if (campos.cidCodigo !== undefined && (campos.cidCodigo || null) !== at.cid_codigo) { antes.cid_codigo = at.cid_codigo; depois.cid_codigo = campos.cidCodigo || null }
  if (campos.origemOcupacional !== undefined && (campos.origemOcupacional || null) !== at.origem_ocupacional) { antes.origem_ocupacional = at.origem_ocupacional; depois.origem_ocupacional = campos.origemOcupacional || null }
  if (Object.keys(antes).length === 0) return { success: false, error: 'Nenhuma diferença a corrigir' }

  if ('cid_codigo' in depois) {
    const novo = await cidPrecisaCadastro(supabase, depois.cid_codigo as string | null)
    if (novo === 'invalido') return { success: false, error: `CID "${depois.cid_codigo}" inválido (formato esperado: A00 ou A00.0).` }
    if (novo) depois.cid_novo = true
  }

  const fim = (depois.data_fim as string | undefined) ?? at.data_fim
  const ini = (depois.data_inicio as string | undefined) ?? at.data_inicio
  if (fim < ini) return { success: false, error: 'Data fim não pode ser anterior à data início.' }

  const { data: pendentes } = await supabase
    .from('solicitacoes')
    .select('id, dados_depois')
    .eq('funcionario_id', at.funcionario_id)
    .eq('status', 'pendente')
    .eq('tipo', 'correcao_atestado' as unknown as 'desligamento')
  if ((pendentes ?? []).some(p => (p.dados_depois as { atestado_id?: string } | null)?.atestado_id === at.id)) {
    return { success: false, error: 'Já existe uma correção pendente para este atestado — veja em Aprovações.' }
  }

  const { error } = await supabase.from('solicitacoes').insert({
    tipo: 'correcao_atestado' as unknown as 'desligamento',
    status: 'pendente',
    funcionario_id: at.funcionario_id,
    supervisor_id: g.userId,
    dados_antes: antes as unknown as Json,
    dados_depois: depois as unknown as Json,
  })
  if (error) return { success: false, error: error.message }

  revalidatePath('/aprovacoes')
  return { success: true }
}
