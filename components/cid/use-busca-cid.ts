'use client'

import { useEffect, useState } from 'react'
import { buscarCids, type CidOpt } from '@/app/(admin)/cids/actions'

/**
 * Busca CIDs no servidor enquanto o usuário digita (com atraso de 250 ms).
 * `ativo` = false (dropdown fechado ou CID já escolhido) não dispara consulta.
 */
export function useBuscaCid(termo: string, ativo: boolean): CidOpt[] {
  const [resultados, setResultados] = useState<CidOpt[]>([])

  useEffect(() => {
    if (!ativo || termo.trim().length < 2) { setResultados([]); return }
    let cancelado = false
    const timer = setTimeout(() => {
      buscarCids(termo)
        .then(r => { if (!cancelado) setResultados(r) })
        .catch(() => { if (!cancelado) setResultados([]) })
    }, 250)
    return () => { cancelado = true; clearTimeout(timer) }
  }, [termo, ativo])

  return resultados
}
