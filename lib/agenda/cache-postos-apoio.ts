// Lista de postos guardada no aparelho do supervisor de apoio, para escolher o posto mesmo sem sinal.
// Só é usada no cliente.

import { distanciaM } from '@/lib/agenda/geo'
import type { PostoApoio } from '@/app/(admin)/agenda/geo-actions'

const CHAVE = 'demax-postos-apoio-v1'
const IDADE_MAX_MS = 24 * 3_600_000 // com sinal, atualiza a lista a cada 24 h
export const RAIO_BUSCA_APOIO_M = 2000

type Guardado = { em: number; postos: PostoApoio[] }

export function lerPostosGuardados(): Guardado | null {
  try {
    const bruto = localStorage.getItem(CHAVE)
    return bruto ? (JSON.parse(bruto) as Guardado) : null
  } catch {
    return null
  }
}

export function guardarPostos(postos: PostoApoio[]): void {
  try {
    localStorage.setItem(CHAVE, JSON.stringify({ em: Date.now(), postos } satisfies Guardado))
  } catch {
    // sem armazenamento: a lista só vale enquanto houver sinal
  }
}

export function listaVencida(g: Guardado | null): boolean {
  return !g || Date.now() - g.em > IDADE_MAX_MS
}

export type PostoPerto = PostoApoio & { distancia: number }

/** Até 8 postos num raio de 2 km do GPS, do mais perto para o mais longe. */
export function postosPerto(postos: PostoApoio[], lat: number, lng: number): PostoPerto[] {
  return postos
    .filter(p => p.latitude != null && p.longitude != null)
    .map(p => ({ ...p, distancia: distanciaM(lat, lng, p.latitude as number, p.longitude as number) }))
    .filter(p => p.distancia <= RAIO_BUSCA_APOIO_M)
    .sort((a, b) => a.distancia - b.distancia)
    .slice(0, 8)
}

export function buscarPorNome(postos: PostoApoio[], termo: string): PostoApoio[] {
  const q = termo.trim().toLowerCase()
  if (q.length < 2) return []
  return postos.filter(p => p.nome.toLowerCase().includes(q) || (p.secretaria ?? '').toLowerCase().includes(q)).slice(0, 12)
}
