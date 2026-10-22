import type Anthropic from '@anthropic-ai/sdk'
import { chamarFerramenta, ErroIA } from '@/lib/acordos/ia/cliente'
import { FERRAMENTA_ATESTADO, lerExtracaoAtestado } from './schema'
import { promptSistema } from './prompt'
import type { LeituraAtestado } from './tipos'

export type TipoArquivoAtestado = 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf'

export interface ResultadoLeitura {
  leitura: LeituraAtestado
  tokensEntrada: number
  tokensSaida: number
}

/**
 * Manda a foto (ou PDF) para a IA e devolve os campos lidos. O arquivo fica só em memória.
 * 45 s sem retry: o tempo total tem que caber nos 60 s de maxDuration da rota.
 */
export async function lerAtestado(base64: string, tipo: TipoArquivoAtestado, hoje: string): Promise<ResultadoLeitura> {
  const arquivo: Anthropic.ContentBlockParam =
    tipo === 'application/pdf'
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }
      : { type: 'image', source: { type: 'base64', media_type: tipo, data: base64 } }

  const r = await chamarFerramenta(
    promptSistema(hoje),
    FERRAMENTA_ATESTADO,
    [arquivo, { type: 'text', text: 'Leia este atestado.' }],
    { maxTokens: 800, timeoutMs: 45_000, maxRetries: 0 },
  )
  const leitura = lerExtracaoAtestado(r.entrada)
  if (!leitura) throw new ErroIA('RESPOSTA_INVALIDA', 'A IA não devolveu os campos esperados.')
  return { leitura, tokensEntrada: r.tokensEntrada, tokensSaida: r.tokensSaida }
}
