export interface PessoaRef { id: string; nome: string }

export interface PedidoAnonimo {
  /** Texto que pode ir à API: sem CPF, e-mail, telefone nem nomes de funcionários. */
  texto: string
  /** 'FUNC_1' -> id do funcionário. Fica no servidor. */
  mapa: Record<string, string>
}

/** Minúsculas e sem acento, com o MESMO comprimento do original (índices continuam valendo). */
function dobrar(s: string): string {
  return s
    .split('')
    .map(ch => {
      const base = ch.normalize('NFD')[0] ?? ch
      return base.toLowerCase()
    })
    .join('')
}

const PALAVRAS_LIGACAO = new Set(['de', 'da', 'do', 'das', 'dos', 'e'])
/** Variantes só têm letras, dígitos e espaço (nada a escapar no regex). */
const seguro = (s: string) => s.replace(/[^a-z0-9 ]/g, '')

/** Variantes de como o nome aparece num pedido: completo, 1º+último, 1º+2º e (se único) só o 1º. */
function variantes(pessoa: PessoaRef, contagemPrimeiro: Map<string, number>): string[] {
  const tokens = dobrar(pessoa.nome).split(/\s+/).filter(t => t && !PALAVRAS_LIGACAO.has(t))
  if (tokens.length === 0) return []
  const out = new Set<string>([tokens.join(' '), dobrar(pessoa.nome).split(' ').filter(Boolean).join(' ')])
  if (tokens.length >= 2) {
    out.add(`${tokens[0]} ${tokens[tokens.length - 1]}`)
    out.add(`${tokens[0]} ${tokens[1]}`)
  }
  if (tokens[0].length >= 4 && contagemPrimeiro.get(tokens[0]) === 1) out.add(tokens[0])
  return Array.from(out)
}

/**
 * Tira do pedido tudo que é dado pessoal antes de enviar à IA: CPF, e-mail, telefone e nomes de funcionários
 * (trocados por FUNC_1, FUNC_2…). O servidor guarda o mapa para voltar do código ao funcionário.
 */
export function anonimizarPedido(texto: string, pessoas: PessoaRef[]): PedidoAnonimo {
  let t = texto
    .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, '[DADO REMOVIDO]')
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '[DADO REMOVIDO]')
    .replace(/\(?\b\d{2}\)?\s?9?\d{4}[-\s]?\d{4}\b/g, '[DADO REMOVIDO]')

  const contagemPrimeiro = new Map<string, number>()
  for (const p of pessoas) {
    const primeiro = dobrar(p.nome).split(/\s+/).find(x => x && !PALAVRAS_LIGACAO.has(x))
    if (primeiro) contagemPrimeiro.set(primeiro, (contagemPrimeiro.get(primeiro) ?? 0) + 1)
  }

  // variante -> pessoa (uma variante que serve a duas pessoas é ambígua e fica de fora)
  const dono = new Map<string, PessoaRef | null>()
  for (const p of pessoas) {
    for (const v of variantes(p, contagemPrimeiro)) {
      const atual = dono.get(v)
      // já ambígua (null) continua ambígua; de outra pessoa passa a ser ambígua
      dono.set(v, dono.has(v) && (atual === null || atual!.id !== p.id) ? null : p)
    }
  }
  const ordenadas = Array.from(dono.entries())
    .filter((e): e is [string, PessoaRef] => e[1] !== null)
    .sort((a, b) => b[0].length - a[0].length)

  const dobrado = dobrar(t)
  const trechos: { ini: number; fim: number; pessoa: PessoaRef }[] = []
  for (const [variante, pessoa] of ordenadas) {
    const miolo = seguro(variante).split(' ').join('[ ]+')
    const re = new RegExp(`(?<![a-z0-9])${miolo}(?![a-z0-9])`, 'g')
    for (const m of Array.from(dobrado.matchAll(re))) {
      const ini = m.index ?? 0
      const fim = ini + m[0].length
      if (!trechos.some(x => ini < x.fim && fim > x.ini)) trechos.push({ ini, fim, pessoa })
    }
  }
  trechos.sort((a, b) => a.ini - b.ini)

  const mapa: Record<string, string> = {}
  const codigoDe = new Map<string, string>()
  let saida = ''
  let cursor = 0
  for (const tr of trechos) {
    let codigo = codigoDe.get(tr.pessoa.id)
    if (!codigo) {
      codigo = `FUNC_${codigoDe.size + 1}`
      codigoDe.set(tr.pessoa.id, codigo)
      mapa[codigo] = tr.pessoa.id
    }
    saida += t.slice(cursor, tr.ini) + codigo
    cursor = tr.fim
  }
  t = saida + t.slice(cursor)
  return { texto: t, mapa }
}
