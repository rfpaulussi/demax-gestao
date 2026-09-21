'use server'

import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/assert-role'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import { anonimizarPedido } from '@/lib/acordos/ia/anonimizar'
import { ErroIA, extrairPedido, iaConfigurada } from '@/lib/acordos/ia/cliente'
import { aplicarExtracao, type ContextoIA, type ResultadoIA } from '@/lib/acordos/ia/normalizar'
import { lerExtracao, type PedidoExtraido } from '@/lib/acordos/ia/schema'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any

const MAX_CARACTERES = 2000
const JANELA_MS = 10 * 60 * 1000
const MAX_PEDIDOS_NA_JANELA = 30
const historico = new Map<string, number[]>()

/** Limite simples por usuário (melhor esforço: cada instância do servidor tem a sua memória). */
function dentroDoLimite(userId: string): boolean {
  const agora = Date.now()
  const recentes = (historico.get(userId) ?? []).filter(t => agora - t < JANELA_MS)
  if (recentes.length >= MAX_PEDIDOS_NA_JANELA) {
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

export interface RespostaInterpretacao {
  resultado: ResultadoIA
  /** Texto que foi de fato enviado à IA (sem CPF, contatos nem nomes de funcionários). */
  textoEnviado: string
  /** Campos crus devolvidos pela IA, antes de validar. */
  extracao: PedidoExtraido
  uso: UsoIA
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

  const anonimo = anonimizarPedido(limpo, pessoas)
  const fuso = 'America/Sao_Paulo'
  const agora = new Date()
  const hoje = agora.toLocaleDateString('sv-SE', { timeZone: fuso })
  const diaSemana = agora.toLocaleDateString('pt-BR', { weekday: 'long', timeZone: fuso })

  try {
    const r = await extrairPedido(anonimo.texto, hoje, diaSemana)
    const extracao = lerExtracao(r.entrada)
    if (!extracao) return { ok: false, erro: 'A IA devolveu uma resposta que não consegui ler. Tente reescrever o pedido.' }
    const resultado = aplicarExtracao(extracao, { postos, pessoas, mapa: anonimo.mapa, hoje })
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
      },
    }
  } catch (e) {
    return { ok: false, erro: e instanceof ErroIA ? e.message : 'Não foi possível interpretar o pedido.' }
  }
}

/** Laboratório (dry-run): só admin. Não grava nada; devolve também o texto enviado e o uso de tokens. */
export async function interpretarPedidoLab(texto: string): Promise<{ ok: true; dados: RespostaInterpretacao } | { ok: false; erro: string }> {
  const guard = await requireRole(['admin'])
  if (!guard.success) return { ok: false, erro: guard.error }
  return interpretar(texto, guard.auth.user.id)
}

export async function iaDisponivel(): Promise<boolean> {
  return iaConfigurada()
}
