// Chamadas ao servidor com tempo limite: sem sinal, a chamada pode ficar pendurada sem erro.

export const TEMPO_LIMITE_MS = 15_000

/** Espera a resposta por no máximo `ms`. Estourou = sem sinal (ou servidor sem resposta). */
export function comTempoLimite<T>(p: Promise<T>, ms: number = TEMPO_LIMITE_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('TEMPO_LIMITE')), ms)
    p.then(
      v => { clearTimeout(timer); resolve(v) },
      e => { clearTimeout(timer); reject(e) },
    )
  })
}

/** true quando o aparelho já sabe que está sem conexão. */
export function semConexao(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}
