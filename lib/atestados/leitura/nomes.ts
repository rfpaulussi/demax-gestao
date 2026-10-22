const LIGACOES = new Set(['DE', 'DA', 'DO', 'DAS', 'DOS', 'E'])

/** Sem acento, maiúsculas, só letras e espaço simples. */
export function normalizarNome(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Partes do nome sem as ligações (DE, DA, DO...). */
export function partesDoNome(s: string): string[] {
  return normalizarNome(s).split(' ').filter(p => p !== '' && !LIGACOES.has(p))
}

/** Distância de Levenshtein. */
export function distanciaEdicao(a: string, b: string): number {
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length
  let anterior = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const atual = [i]
    for (let j = 1; j <= b.length; j++) {
      atual[j] = Math.min(
        anterior[j] + 1,
        atual[j - 1] + 1,
        anterior[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
    }
    anterior = atual
  }
  return anterior[b.length]
}

function similaridadeParte(a: string, b: string): number {
  return 1 - distanciaEdicao(a, b) / Math.max(a.length, b.length)
}

/**
 * 0 a 1. Cada parte do nome mais curto procura a parte mais parecida do outro (vale com ≥ 0,8, ou seja,
 * tolera 1 letra trocada em parte de 5+ letras). Nota = 2 × soma / (partes de A + partes de B).
 */
export function similaridadeNomes(a: string, b: string): number {
  const pa = partesDoNome(a)
  const pb = partesDoNome(b)
  if (pa.length === 0 || pb.length === 0) return 0
  const [curta, longa] = pa.length <= pb.length ? [pa, pb] : [pb, pa]
  const usadas = new Set<number>()
  let soma = 0
  for (const parte of curta) {
    let melhor = 0
    let indice = -1
    longa.forEach((outra, i) => {
      if (usadas.has(i)) return
      const s = similaridadeParte(parte, outra)
      if (s > melhor) { melhor = s; indice = i }
    })
    if (indice >= 0 && melhor >= 0.8) { usadas.add(indice); soma += melhor }
  }
  return (2 * soma) / (pa.length + pb.length)
}
