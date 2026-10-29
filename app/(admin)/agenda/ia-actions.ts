'use server'

import Anthropic from '@anthropic-ai/sdk'
import { getUser } from '@/lib/auth/get-user'

const MODELO = process.env.ANTHROPIC_MODEL_AGENDA || 'claude-haiku-4-5'
const MAX_ENTRADA = 600

const SISTEMA = `Você ajuda supervisores de campo de uma empresa de limpeza urbana e áreas verdes a registrar, no sistema, o que fizeram numa visita.
Reescreva a observação em português do Brasil, de forma clara, objetiva e profissional, em no máximo 3 frases curtas.
Corrija ortografia e pontuação e tire repetições e vícios de fala (né, tipo, então, aí).
NÃO invente fatos, nomes, números, horários ou providências que não estejam no texto. Mantenha todos os fatos que o supervisor disse.
Se o texto já estiver bom, devolva praticamente igual.
Responda somente com o texto reescrito, sem aspas e sem comentários.`

/** Esconde sequências que parecem CPF/telefone antes de mandar o texto para a IA. */
function mascarar(texto: string): string {
  return texto
    .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, '[número]')
    .replace(/\(?\b\d{2}\)?\s?9?\d{4}-?\d{4}\b/g, '[telefone]')
}

export type ResultadoMelhoria = { ok: true; texto: string } | { ok: false; erro: string }

/** Deixa a observação do supervisor mais clara (sem inventar nada). Só para supervisores e gestão. */
export async function melhorarObservacao(texto: string): Promise<ResultadoMelhoria> {
  const auth = await getUser()
  if (!auth || auth.perfil.ativo === false) return { ok: false, erro: 'Não autenticado' }
  const papel = auth.perfil.role
  if (papel !== 'supervisor' && papel !== 'admin' && papel !== 'coordenador') return { ok: false, erro: 'Sem permissão' }

  const limpo = texto.trim().slice(0, MAX_ENTRADA)
  if (limpo.length < 8) return { ok: false, erro: 'Escreva ou dite um pouco mais antes de pedir para melhorar.' }

  const chave = process.env.ANTHROPIC_API_KEY
  if (!chave) return { ok: false, erro: 'A IA não está configurada neste ambiente.' }

  try {
    const client = new Anthropic({ apiKey: chave, timeout: 15_000, maxRetries: 1 })
    const resp = await client.messages.create({
      model: MODELO,
      max_tokens: 400,
      system: SISTEMA,
      messages: [{ role: 'user', content: mascarar(limpo) }],
    })
    const bloco = resp.content.find(b => b.type === 'text')
    const saida = bloco && bloco.type === 'text' ? bloco.text.trim() : ''
    if (!saida) return { ok: false, erro: 'A IA não devolveu um texto. Tente de novo.' }
    return { ok: true, texto: saida.slice(0, 500) }
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return { ok: false, erro: 'Muitos pedidos agora. Tente de novo em instantes.' }
    return { ok: false, erro: 'Não foi possível melhorar o texto agora. O que você escreveu continua aí.' }
  }
}
