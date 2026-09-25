'use server'

import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/auth/assert-role'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import { chamarFerramenta, ErroIA, iaConfigurada } from '@/lib/acordos/ia/cliente'
import { validarTexto } from '@/lib/ocorrencias/devolutiva'
import { anonimizarOcorrencia, restaurarNomes, type PessoaRef } from '@/lib/ocorrencias/ia/anonimizar'
import { montarContexto, montarContextoRetorno } from '@/lib/ocorrencias/ia/contexto'
import { PROMPT_ANALISE, PROMPT_RETORNO } from '@/lib/ocorrencias/ia/prompt'
import {
  FERRAMENTA_ANALISE,
  FERRAMENTA_RETORNO,
  lerAnalise,
  lerRetorno,
  type AnaliseOcorrencia,
} from '@/lib/ocorrencias/ia/schema'
import { comentarOcorrencia } from './actions'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any

const MODELO_PADRAO_OCORRENCIAS = 'claude-sonnet-5'
const opcoesIA = () => ({
  modelo: process.env.ANTHROPIC_MODEL_OCORRENCIAS || MODELO_PADRAO_OCORRENCIAS,
  maxTokens: 2000,
  temperatura: null as number | null,
  timeoutMs: 60_000,
})

// Limite simples por usuário (melhor esforço: cada instância do servidor tem a sua memória).
const JANELA_MS = 10 * 60 * 1000
const MAX_CHAMADAS_NA_JANELA = 20
const historicoChamadas = new Map<string, number[]>()
function dentroDoLimite(userId: string): boolean {
  const agora = Date.now()
  const recentes = (historicoChamadas.get(userId) ?? []).filter(t => agora - t < JANELA_MS)
  if (recentes.length >= MAX_CHAMADAS_NA_JANELA) {
    historicoChamadas.set(userId, recentes)
    return false
  }
  historicoChamadas.set(userId, [...recentes, agora])
  return true
}

const ROTULO_GRAVIDADE: Record<string, string> = { baixa: 'Baixa', media: 'Média', alta: 'Alta', critica: 'Crítica' }

function diasInclusivos(inicio: string, fim: string | null): number {
  if (!fim) return 1
  const d1 = new Date(inicio.split('T')[0] + 'T00:00:00')
  const d2 = new Date(fim.split('T')[0] + 'T00:00:00')
  return Math.max(1, Math.round((d2.getTime() - d1.getTime()) / 86400000) + 1)
}

type BaseOcorrencia = {
  id: string
  status: string
  descricao: string
  dataOcorrencia: string | null
  gravidade: string | null
  funcao: string | null
  historico: { advertencias: number; diasAtestado12m: number; faltas: number }
}

// Colunas listadas uma a uma: nunca cpf, salário, PCD, CID, motivo de atestado.
async function carregarBase(ocorrenciaId: string): Promise<BaseOcorrencia | null> {
  const admin = createAdminClient() as AnyClient
  const { data: o } = await admin
    .from('ocorrencias')
    .select('id, tipo, status, descricao, data_ocorrencia, gravidade, funcionario_id')
    .eq('id', ocorrenciaId)
    .single()
  if (!o || o.tipo !== 'ocorrencia' || !o.funcionario_id) return null

  const [{ data: f }, { data: adv }, { data: ats }, { data: fts }] = await Promise.all([
    admin.from('funcionarios').select('funcoes!funcionarios_funcao_id_fkey(nome)').eq('id', o.funcionario_id).single(),
    admin.from('advertencias').select('id').eq('funcionario_id', o.funcionario_id),
    admin.from('atestados').select('data_inicio, data_fim').eq('funcionario_id', o.funcionario_id),
    admin.from('faltas').select('id').eq('funcionario_id', o.funcionario_id),
  ])

  const funcao = Array.isArray(f?.funcoes) ? f.funcoes[0] : f?.funcoes
  const umAnoAtras = new Date()
  umAnoAtras.setFullYear(umAnoAtras.getFullYear() - 1)
  const corte = umAnoAtras.toISOString().split('T')[0]
  const diasAtestado12m = ((ats ?? []) as { data_inicio: string; data_fim: string | null }[])
    .filter(a => a.data_inicio >= corte)
    .reduce((soma, a) => soma + diasInclusivos(a.data_inicio, a.data_fim), 0)

  return {
    id: o.id,
    status: o.status ?? 'aberta',
    descricao: o.descricao ?? '',
    dataOcorrencia: o.data_ocorrencia ?? null,
    gravidade: o.gravidade ? (ROTULO_GRAVIDADE[o.gravidade] ?? o.gravidade) : null,
    funcao: funcao?.nome ?? null,
    historico: {
      advertencias: (adv ?? []).length,
      diasAtestado12m,
      faltas: (fts ?? []).length,
    },
  }
}

// Nomes a mascarar: todos os funcionários e todos os perfis (supervisores, coordenação).
async function carregarPessoas(): Promise<PessoaRef[]> {
  const admin = createAdminClient() as AnyClient
  const funcionarios = await fetchAllRows<{ id: string; nome: string }>((from, to) =>
    admin.from('funcionarios').select('id, nome').range(from, to),
  )
  const { data: perfis } = await admin.from('perfis').select('id, nome')
  const doPerfil = ((perfis ?? []) as { id: string; nome: string | null }[]).map(p => ({
    id: `perfil:${p.id}`,
    nome: p.nome ?? '',
  }))
  return [...funcionarios, ...doPerfil].filter(p => p.nome.trim().length > 0)
}

function mensagemErroIA(e: unknown): string {
  if (e instanceof ErroIA) return e.message
  return 'Não foi possível falar com a IA. Tente novamente.'
}

// ─── prévia (nada é enviado à API) ────────────────────────────────────────────

export type PreviaAnalise =
  | { success: true; mensagem: string; iaConfigurada: boolean }
  | { success: false; error: string }

export async function previaAnalise(ocorrenciaId: string): Promise<PreviaAnalise> {
  const guard = await requireRole(['admin', 'coordenador'])
  if (!guard.success) return { success: false, error: guard.error }

  const base = await carregarBase(ocorrenciaId)
  if (!base) return { success: false, error: 'Ocorrência não encontrada' }
  if (base.status === 'encerrada' || base.status === 'resolvido') {
    return { success: false, error: 'Esta ocorrência já foi encerrada' }
  }

  const anon = anonimizarOcorrencia(base.descricao, await carregarPessoas())
  const mensagem = montarContexto({
    funcao: base.funcao,
    dataOcorrencia: base.dataOcorrencia,
    gravidade: base.gravidade,
    textoAnonimo: anon.texto,
    historico: base.historico,
  })
  return { success: true, mensagem, iaConfigurada: iaConfigurada() }
}

// ─── análise ──────────────────────────────────────────────────────────────────

export type ResultadoAnalise =
  | { success: true; analiseId: string; analise: AnaliseOcorrencia; modelo: string; tokensEntrada: number; tokensSaida: number }
  | { success: false; error: string }

function restaurarAnalise(a: AnaliseOcorrencia, nomes: Record<string, string>): AnaliseOcorrencia {
  const r = (t: string) => restaurarNomes(t, nomes)
  return {
    ...a,
    resumo: r(a.resumo),
    resolucao_sugerida: a.resolucao_sugerida.map(r),
    motivo_rh: a.motivo_rh ? r(a.motivo_rh) : null,
    devolutiva_supervisor: r(a.devolutiva_supervisor),
    email_rh: r(a.email_rh),
    alertas: a.alertas.map(r),
  }
}

export async function analisarOcorrencia(ocorrenciaId: string): Promise<ResultadoAnalise> {
  const guard = await requireRole(['admin', 'coordenador'])
  if (!guard.success) return { success: false, error: guard.error }
  const { auth } = guard

  if (!iaConfigurada()) return { success: false, error: 'A IA não está configurada neste ambiente (falta ANTHROPIC_API_KEY).' }
  if (!dentroDoLimite(auth.user.id)) {
    return { success: false, error: 'Muitas análises em pouco tempo. Aguarde alguns minutos.' }
  }

  const base = await carregarBase(ocorrenciaId)
  if (!base) return { success: false, error: 'Ocorrência não encontrada' }
  if (base.status === 'encerrada' || base.status === 'resolvido') {
    return { success: false, error: 'Esta ocorrência já foi encerrada' }
  }

  // A prévia é refeita aqui no servidor: nunca se confia no que o navegador diz que enviou.
  const anon = anonimizarOcorrencia(base.descricao, await carregarPessoas())
  const mensagem = montarContexto({
    funcao: base.funcao,
    dataOcorrencia: base.dataOcorrencia,
    gravidade: base.gravidade,
    textoAnonimo: anon.texto,
    historico: base.historico,
  })

  try {
    const resp = await chamarFerramenta(PROMPT_ANALISE, FERRAMENTA_ANALISE, mensagem, opcoesIA())
    const analise = lerAnalise(resp.entrada)
    if (!analise) return { success: false, error: 'A IA devolveu uma resposta fora do formato. Tente de novo.' }

    const { data: linha, error } = await (createAdminClient() as AnyClient)
      .from('ocorrencia_analises_ia')
      .insert({
        ocorrencia_id: ocorrenciaId,
        tipo: 'analise',
        solicitada_por: auth.user.id,
        modelo: resp.modelo,
        tokens_entrada: resp.tokensEntrada,
        tokens_saida: resp.tokensSaida,
        texto_enviado: mensagem,
        mapa: anon.nomes,
        resultado: analise,
      })
      .select('id')
      .single()
    if (error || !linha) return { success: false, error: 'A análise foi feita, mas não foi possível registrá-la. Tente de novo.' }

    return {
      success: true,
      analiseId: linha.id,
      analise: restaurarAnalise(analise, anon.nomes),
      modelo: resp.modelo,
      tokensEntrada: resp.tokensEntrada,
      tokensSaida: resp.tokensSaida,
    }
  } catch (e) {
    return { success: false, error: mensagemErroIA(e) }
  }
}

// ─── devolutiva a partir da resposta do RH ────────────────────────────────────

export type ResultadoRetorno =
  | { success: true; analiseId: string; devolutiva: string; pontos: string[] }
  | { success: false; error: string }

export async function rascunharDevolutivaRetorno(ocorrenciaId: string, respostaRH: string): Promise<ResultadoRetorno> {
  const guard = await requireRole(['admin', 'coordenador'])
  if (!guard.success) return { success: false, error: guard.error }
  const { auth } = guard

  const validado = validarTexto(respostaRH)
  if (!validado.ok) return { success: false, error: validado.error }

  if (!iaConfigurada()) return { success: false, error: 'A IA não está configurada neste ambiente (falta ANTHROPIC_API_KEY).' }
  if (!dentroDoLimite(auth.user.id)) {
    return { success: false, error: 'Muitas análises em pouco tempo. Aguarde alguns minutos.' }
  }

  const base = await carregarBase(ocorrenciaId)
  if (!base) return { success: false, error: 'Ocorrência não encontrada' }

  // Relato e resposta do RH são anonimizados JUNTOS, numa só chamada: assim a mesma pessoa recebe
  // o mesmo código (FUNC_n) nos dois textos e a restauração dos nomes é uma só.
  const SEPARADOR = '\n<<<SEPARADOR_RESPOSTA_RH>>>\n'
  const junto = anonimizarOcorrencia(`${base.descricao}${SEPARADOR}${validado.texto}`, await carregarPessoas())
  const [textoAnonimo, respostaAnonima] = junto.texto.split(SEPARADOR)
  if (respostaAnonima === undefined) return { success: false, error: 'Não foi possível preparar o texto para a IA.' }

  const contexto = montarContexto({
    funcao: base.funcao,
    dataOcorrencia: base.dataOcorrencia,
    gravidade: base.gravidade,
    textoAnonimo,
    historico: base.historico,
  })
  const mensagem = montarContextoRetorno({ contexto, respostaRhAnonima: respostaAnonima })

  try {
    const resp = await chamarFerramenta(PROMPT_RETORNO, FERRAMENTA_RETORNO, mensagem, opcoesIA())
    const retorno = lerRetorno(resp.entrada)
    if (!retorno) return { success: false, error: 'A IA devolveu uma resposta fora do formato. Tente de novo.' }

    const nomes = junto.nomes
    const restaurar = (t: string) => restaurarNomes(t, nomes)

    const { data: linha, error } = await (createAdminClient() as AnyClient)
      .from('ocorrencia_analises_ia')
      .insert({
        ocorrencia_id: ocorrenciaId,
        tipo: 'devolutiva_retorno',
        solicitada_por: auth.user.id,
        modelo: resp.modelo,
        tokens_entrada: resp.tokensEntrada,
        tokens_saida: resp.tokensSaida,
        texto_enviado: mensagem,
        mapa: nomes,
        resultado: retorno,
      })
      .select('id')
      .single()
    if (error || !linha) return { success: false, error: 'O rascunho foi feito, mas não foi possível registrá-lo. Tente de novo.' }

    return {
      success: true,
      analiseId: linha.id,
      devolutiva: restaurar(retorno.devolutiva_supervisor),
      pontos: retorno.pontos_de_atencao.map(restaurar),
    }
  } catch (e) {
    return { success: false, error: mensagemErroIA(e) }
  }
}

// ─── decisão do coordenador ───────────────────────────────────────────────────

export type ResultadoDecisao = { success: true } | { success: false; error: string }

export async function decidirAnalise(
  analiseId: string,
  dados: { decisao: 'aprovada' | 'reprovada'; devolutivaEditada?: string; motivo?: string },
): Promise<ResultadoDecisao> {
  const guard = await requireRole(['admin', 'coordenador'])
  if (!guard.success) return { success: false, error: guard.error }
  const { auth } = guard

  const admin = createAdminClient() as AnyClient
  const { data: analise } = await admin
    .from('ocorrencia_analises_ia')
    .select('id, ocorrencia_id, decisao')
    .eq('id', analiseId)
    .single()
  if (!analise) return { success: false, error: 'Análise não encontrada' }
  if (analise.decisao !== 'pendente') return { success: false, error: 'Esta análise já foi decidida' }

  // Aprovar com devolutiva: posta na conversa, em nome do coordenador, o texto que ELE editou.
  if (dados.decisao === 'aprovada' && dados.devolutivaEditada?.trim()) {
    const postada = await comentarOcorrencia(analise.ocorrencia_id, dados.devolutivaEditada)
    if (!postada.success) return { success: false, error: postada.error }
  }

  const { data: atualizadas, error } = await admin
    .from('ocorrencia_analises_ia')
    .update({
      decisao: dados.decisao,
      decidida_por: auth.user.id,
      decidida_em: new Date().toISOString(),
      motivo: dados.decisao === 'reprovada' ? (dados.motivo?.trim() || null) : null,
    })
    .eq('id', analiseId)
    .eq('decisao', 'pendente')
    .select('id')
  if (error) return { success: false, error: error.message }
  if (!atualizadas || atualizadas.length === 0) return { success: false, error: 'Esta análise já foi decidida' }

  revalidatePath('/ocorrencias')
  return { success: true }
}

// ─── histórico ────────────────────────────────────────────────────────────────

export type AnaliseHistorico = {
  id: string
  created_at: string
  tipo: 'analise' | 'devolutiva_retorno'
  decisao: 'pendente' | 'aprovada' | 'reprovada'
  categoria: string | null
}

export async function listarAnalises(ocorrenciaId: string): Promise<AnaliseHistorico[]> {
  const guard = await requireRole(['admin', 'coordenador'])
  if (!guard.success) return []

  const { data } = await (createAdminClient() as AnyClient)
    .from('ocorrencia_analises_ia')
    .select('id, created_at, tipo, decisao, resultado')
    .eq('ocorrencia_id', ocorrenciaId)
    .order('created_at', { ascending: false })
    .limit(10)

  return ((data ?? []) as { id: string; created_at: string; tipo: AnaliseHistorico['tipo']; decisao: AnaliseHistorico['decisao']; resultado: { categoria?: string } | null }[]).map(a => ({
    id: a.id,
    created_at: a.created_at,
    tipo: a.tipo,
    decisao: a.decisao,
    categoria: a.resultado?.categoria ?? null,
  }))
}
