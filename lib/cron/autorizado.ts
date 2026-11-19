import { timingSafeEqual } from 'node:crypto'

/**
 * Valida o cabeçalho `Authorization: Bearer <CRON_SECRET>` das rotas de cron.
 *
 * Falha fechada: se o segredo estiver ausente, vazio ou só com espaços
 * (ex.: deploys Preview, onde CRON_SECRET não existe), NINGUÉM é autorizado.
 * Antes, a comparação `header !== \`Bearer ${process.env.CRON_SECRET}\``
 * aceitava `Bearer undefined` quando a variável não estava definida.
 */
export function cronAutorizado(
  authorization: string | null | undefined,
  secret: string | undefined = process.env.CRON_SECRET,
): boolean {
  if (typeof secret !== 'string' || secret.trim() === '') return false
  if (typeof authorization !== 'string') return false

  const esperado = Buffer.from(`Bearer ${secret}`)
  const recebido = Buffer.from(authorization)
  if (esperado.length !== recebido.length) return false
  return timingSafeEqual(esperado, recebido)
}
