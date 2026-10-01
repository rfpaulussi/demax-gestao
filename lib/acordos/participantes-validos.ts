import type { CamposAcordo } from './tipos'

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

/** `participantes` (T5 em dias inteiros) vem do navegador: só T5, formato certo e ao menos uma folga por pessoa. */
export function participantesValidos(c: CamposAcordo): boolean {
  const p = c.participantes
  if (p === undefined) return true
  if (c.template !== 'T5' || typeof p !== 'object' || p === null || Array.isArray(p)) return false
  return Object.values(p).every(x =>
    !!x && typeof x.inicio === 'string' && typeof x.fim === 'string' && HHMM.test(x.inicio) && HHMM.test(x.fim)
    && Array.isArray(x.folgas) && x.folgas.length >= 1 && x.folgas.length <= 10,
  )
}
