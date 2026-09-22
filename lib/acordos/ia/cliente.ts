import Anthropic from '@anthropic-ai/sdk'
import { PROMPT_SISTEMA } from './prompt'
import { FERRAMENTA_PREENCHER } from './schema'

/** Modelo barato de extração; pode ser trocado por variável de ambiente sem mexer no código. */
export const MODELO_PADRAO = 'claude-haiku-4-5'

export class ErroIA extends Error {
  constructor(public codigo: 'NAO_CONFIGURADA' | 'FALHA' | 'RESPOSTA_INVALIDA', mensagem: string) {
    super(mensagem)
  }
}

export interface RespostaModelo {
  /** O que a ferramenta devolveu (ainda não confiável: passe por `lerExtracao`). */
  entrada: unknown
  modelo: string
  tokensEntrada: number
  tokensSaida: number
}

export function iaConfigurada(): boolean {
  return !!process.env.ANTHROPIC_API_KEY
}

/** Uma chamada só, sem histórico, forçando a ferramenta dada. O texto já deve estar anonimizado. */
export async function chamarFerramenta(sistema: string, ferramenta: Anthropic.Tool, mensagem: string): Promise<RespostaModelo> {
  const chave = process.env.ANTHROPIC_API_KEY
  if (!chave) throw new ErroIA('NAO_CONFIGURADA', 'A IA não está configurada neste ambiente (falta ANTHROPIC_API_KEY).')
  const modelo = process.env.ANTHROPIC_MODEL_ACORDOS || MODELO_PADRAO
  const client = new Anthropic({ apiKey: chave, timeout: 25_000, maxRetries: 1 })
  try {
    const resp = await client.messages.create({
      model: modelo,
      max_tokens: 1024,
      temperature: 0,
      system: sistema,
      tools: [ferramenta],
      tool_choice: { type: 'tool', name: ferramenta.name },
      messages: [{ role: 'user', content: mensagem }],
    })
    const bloco = resp.content.find(b => b.type === 'tool_use')
    if (!bloco || bloco.type !== 'tool_use') throw new ErroIA('RESPOSTA_INVALIDA', 'A IA não devolveu os campos esperados.')
    return {
      entrada: bloco.input,
      modelo,
      tokensEntrada: resp.usage.input_tokens,
      tokensSaida: resp.usage.output_tokens,
    }
  } catch (e) {
    if (e instanceof ErroIA) throw e
    if (e instanceof Anthropic.RateLimitError) throw new ErroIA('FALHA', 'Muitos pedidos à IA agora. Tente de novo em instantes.')
    if (e instanceof Anthropic.AuthenticationError) throw new ErroIA('FALHA', 'A chave da IA foi recusada. Confira ANTHROPIC_API_KEY.')
    if (e instanceof Anthropic.APIError) throw new ErroIA('FALHA', `A IA respondeu com erro (${e.status}).`)
    throw new ErroIA('FALHA', 'Não foi possível falar com a IA. Tente novamente.')
  }
}

/** Pedido em texto livre (já anonimizado) + data de hoje -> campos do acordo. */
export function extrairPedido(pedidoAnonimo: string, hoje: string, diaSemana: string): Promise<RespostaModelo> {
  return chamarFerramenta(PROMPT_SISTEMA, FERRAMENTA_PREENCHER, `Hoje é ${hoje} (${diaSemana}).\n\nPedido:\n${pedidoAnonimo}`)
}
