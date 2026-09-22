'use server'

import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/assert-role'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import { anonimizarPedido } from '@/lib/acordos/ia/anonimizar'
import { chamarFerramenta, ErroIA, extrairPedido, iaConfigurada } from '@/lib/acordos/ia/cliente'
import { FERRAMENTA_LEGADO, lerLegado, possivelmenteInvertido, PROMPT_LEGADO, type ClassificacaoLegado } from '@/lib/acordos/ia/legado'
import { aplicarExtracao, AVISO_PAGAMENTO, mencionaPagamento, type ContextoIA, type ResultadoIA } from '@/lib/acordos/ia/normalizar'
import { lerExtracao, type PedidoExtraido } from '@/lib/acordos/ia/schema'
import { simularPedido } from '@/lib/acordos/ia/aplicar'
import type { Achado, FuncionarioCalc } from '@/lib/acordos/tipos'
import { carregarCalendario } from '@/lib/calendario/mogi'
import { calendarioParaMapa } from '@/lib/calendario/mapa'
import { buscarFuncionariosPorPostos } from './actions'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any

const MAX_CARACTERES = 2000
const JANELA_MS = 10 * 60 * 1000
const MAX_PEDIDOS_NA_JANELA = 30
const historico = new Map<string, number[]>()

/** Limite simples por usuário (melhor esforço: cada instância do servidor tem a sua memória). */
function dentroDoLimite(userId: string, max = MAX_PEDIDOS_NA_JANELA): boolean {
  const agora = Date.now()
  const recentes = (historico.get(userId) ?? []).filter(t => agora - t < JANELA_MS)
  if (recentes.length >= max) {
    historico.set(userId, recentes)
    return false
  }
  historico.set(userId, [...recentes, agora])
  return true
}

/** Preço por milhão de tokens do Haiku 4.5 (US$ 1 entrada / US$ 5 saída), só para o laboratório mostrar a ordem de grandeza. */
const custoUsd = (entrada: number, saida: number) => (entrada * 1 + saida * 5) / 1_000_000

export interface UsoIA {
  modelo: string
  tokensEntrada: number
  tokensSaida: number
  custoUsd: number
}

/** O pedido aplicado aos turnos reais do posto: dias escolhidos e o que a validação (CLT, divisão…) achou. */
export interface SimulacaoResumo {
  funcionarios: number
  grupos: number
  horasTotalMin: number
  minutosPorDia: number
  datasAjuste: string[]
  achados: Achado[]
}

export interface RespostaInterpretacao {
  resultado: ResultadoIA
  /** Texto que foi de fato enviado à IA (sem CPF, contatos nem nomes de funcionários). */
  textoEnviado: string
  /** Campos crus devolvidos pela IA, antes de validar. */
  extracao: PedidoExtraido
  uso: UsoIA
  /** null quando faltou situação ou posto para simular. */
  simulacao: SimulacaoResumo | null
}

async function interpretar(texto: string, userId: string): Promise<{ ok: true; dados: RespostaInterpretacao } | { ok: false; erro: string }> {
  const limpo = texto.trim()
  if (limpo.length < 8) return { ok: false, erro: 'Descreva o pedido com um pouco mais de detalhe.' }
  if (limpo.length > MAX_CARACTERES) return { ok: false, erro: `O pedido passa de ${MAX_CARACTERES} caracteres. Resuma.` }
  if (!iaConfigurada()) return { ok: false, erro: 'A IA não está configurada neste ambiente (falta ANTHROPIC_API_KEY).' }
  if (!dentroDoLimite(userId)) return { ok: false, erro: 'Muitos pedidos em pouco tempo. Aguarde alguns minutos.' }

  const supabase = createClient() as AnyClient
  let postos: ContextoIA['postos']
  let pessoas: ContextoIA['pessoas']
  try {
    const { data, error } = await supabase.from('postos').select('id, nome').eq('ativo', true).order('nome')
    if (error) throw new Error(error.message)
    postos = (data ?? []) as ContextoIA['postos']
    pessoas = await fetchAllRows<ContextoIA['pessoas'][number]>((from, to) =>
      supabase.from('funcionarios').select('id, nome, posto_id').not('status', 'eq', 'desligado').order('id').range(from, to),
    )
  } catch {
    return { ok: false, erro: 'Não foi possível carregar postos e funcionários. Tente novamente.' }
  }

  let anonimo: ReturnType<typeof anonimizarPedido>
  try {
    anonimo = anonimizarPedido(limpo, pessoas)
  } catch {
    return { ok: false, erro: 'Não foi possível preparar o pedido. Tente reescrever sem caracteres especiais.' }
  }
  const fuso = 'America/Sao_Paulo'
  const agora = new Date()
  const hoje = agora.toLocaleDateString('sv-SE', { timeZone: fuso })
  const diaSemana = agora.toLocaleDateString('pt-BR', { weekday: 'long', timeZone: fuso })

  try {
    const r = await extrairPedido(anonimo.texto, hoje, diaSemana)
    const extracao = lerExtracao(r.entrada)
    if (!extracao) return { ok: false, erro: 'A IA devolveu uma resposta que não consegui ler. Tente reescrever o pedido.' }
    const resultado = aplicarExtracao(extracao, { postos, pessoas, mapa: anonimo.mapa, hoje })
    if (mencionaPagamento(limpo)) resultado.avisos.unshift(AVISO_PAGAMENTO)

    // valida contra os turnos reais do posto (mesmas regras do modal); falha aqui não derruba a interpretação
    let simulacao: SimulacaoResumo | null = null
    if (resultado.template && resultado.postoId) {
      try {
        const doPosto = await buscarFuncionariosPorPostos([resultado.postoId])
        const escolhidos = resultado.funcionarioIds.length
          ? doPosto.filter(f => resultado.funcionarioIds.includes(f.id))
          : doPosto.filter(f => f.elegivel && (f.status === 'ativo' || f.status === 'ferias'))
        const calc: FuncionarioCalc[] = escolhidos.map(f => ({
          id: f.id, nome: f.nome, status: f.status, regime: f.regime, semana: f.semana, semTurno: f.sem_turno,
        }))
        const ano = Number(hoje.slice(0, 4))
        const feriados = calendarioParaMapa(await carregarCalendario([ano, ano + 1]))
        const sim = simularPedido(resultado, calc, feriados, hoje)
        if (sim) {
          simulacao = {
            funcionarios: sim.funcionarios,
            grupos: sim.grupos,
            horasTotalMin: sim.horasTotalMin,
            minutosPorDia: sim.minutosPorDia,
            datasAjuste: sim.form.datasAjuste,
            achados: sim.achados,
          }
        }
      } catch {
        simulacao = null
      }
    }
    return {
      ok: true,
      dados: {
        resultado,
        textoEnviado: anonimo.texto,
        extracao,
        uso: {
          modelo: r.modelo,
          tokensEntrada: r.tokensEntrada,
          tokensSaida: r.tokensSaida,
          custoUsd: custoUsd(r.tokensEntrada, r.tokensSaida),
        },
        simulacao,
      },
    }
  } catch (e) {
    return { ok: false, erro: e instanceof ErroIA ? e.message : 'Não foi possível interpretar o pedido.' }
  }
}

/** Laboratório (dry-run): admin/coordenador. Não grava nada; devolve também o texto enviado e o uso de tokens. */
export async function interpretarPedidoLab(texto: string): Promise<{ ok: true; dados: RespostaInterpretacao } | { ok: false; erro: string }> {
  const guard = await requireRole(['admin', 'coordenador'])
  if (!guard.success) return { ok: false, erro: guard.error }
  return interpretar(texto, guard.auth.user.id)
}

/** Botão "Descrever o pedido" do modal: quem pode criar acordo pode usar. Não grava nada. */
export async function interpretarPedidoAcordo(texto: string): Promise<{ ok: true; dados: RespostaInterpretacao } | { ok: false; erro: string }> {
  const guard = await requireRole(['admin', 'coordenador', 'supervisor'])
  if (!guard.success) return { ok: false, erro: guard.error }
  return interpretar(texto, guard.auth.user.id)
}

export async function iaDisponivel(): Promise<boolean> {
  return iaConfigurada()
}

// ── Acordos antigos: classificação só de leitura (nada é gravado) ───────────────

export interface AcordoLegadoItem {
  id: string
  titulo: string
  data_documento: string
  funcionarios: number
}

/** Acordos ainda sem `template_id` (emitidos antes do novo fluxo). Admin/coordenador. */
export async function listarAcordosLegados(): Promise<{ ok: true; itens: AcordoLegadoItem[]; total: number } | { ok: false; erro: string }> {
  const guard = await requireRole(['admin', 'coordenador'])
  if (!guard.success) return { ok: false, erro: guard.error }
  const { data, error, count } = await (createClient() as AnyClient)
    .from('acordos_compensacao')
    .select('id, titulo, data_documento, funcionarios', { count: 'exact' })
    .is('template_id', null)
    .order('data_documento', { ascending: false })
    .limit(60)
  if (error) return { ok: false, erro: 'Não foi possível listar os acordos antigos.' }
  const itens = ((data ?? []) as { id: string; titulo: string; data_documento: string; funcionarios: unknown }[]).map(r => ({
    id: r.id,
    titulo: r.titulo,
    data_documento: r.data_documento,
    funcionarios: Array.isArray(r.funcionarios) ? r.funcionarios.length : 0,
  }))
  return { ok: true, itens, total: count ?? itens.length }
}

export interface ResultadoLegado {
  classificacao: ClassificacaoLegado
  /** Texto disse que trabalharam a mais e mandou repor: pode estar com a direção trocada (revisar). */
  invertido: boolean
  uso: UsoIA
}

/** Lê o texto de UM acordo antigo e o classifica. Não grava nada. Admin/coordenador. */
export async function classificarAcordoAntigo(id: string): Promise<{ ok: true; dados: ResultadoLegado } | { ok: false; erro: string }> {
  const guard = await requireRole(['admin', 'coordenador'])
  if (!guard.success) return { ok: false, erro: guard.error }
  if (!iaConfigurada()) return { ok: false, erro: 'A IA não está configurada neste ambiente (falta ANTHROPIC_API_KEY).' }
  if (!dentroDoLimite(guard.auth.user.id, 200)) return { ok: false, erro: 'Muitos pedidos em pouco tempo. Aguarde alguns minutos.' }

  const { data, error } = await (createClient() as AnyClient)
    .from('acordos_compensacao')
    .select('titulo, descricao_acordo, funcionarios')
    .eq('id', id)
    .maybeSingle()
  if (error || !data) return { ok: false, erro: 'Acordo não encontrado.' }

  const pessoas = (Array.isArray(data.funcionarios) ? data.funcionarios : [])
    .filter((f: { id?: unknown; nome?: unknown }) => typeof f?.id === 'string' && typeof f?.nome === 'string')
    .map((f: { id: string; nome: string }) => ({ id: f.id, nome: f.nome }))
  let texto: string
  try {
    texto = anonimizarPedido(`Título: ${data.titulo ?? ''}
Texto: ${data.descricao_acordo ?? ''}`, pessoas).texto.slice(0, 4000)
  } catch {
    return { ok: false, erro: 'Não foi possível preparar o texto do acordo.' }
  }

  try {
    const r = await chamarFerramenta(PROMPT_LEGADO, FERRAMENTA_LEGADO, texto)
    const classificacao = lerLegado(r.entrada)
    if (!classificacao) return { ok: false, erro: 'A IA devolveu uma resposta que não consegui ler.' }
    return {
      ok: true,
      dados: {
        classificacao,
        invertido: possivelmenteInvertido(classificacao),
        uso: { modelo: r.modelo, tokensEntrada: r.tokensEntrada, tokensSaida: r.tokensSaida, custoUsd: custoUsd(r.tokensEntrada, r.tokensSaida) },
      },
    }
  } catch (e) {
    return { ok: false, erro: e instanceof ErroIA ? e.message : 'Não foi possível classificar o acordo.' }
  }
}
