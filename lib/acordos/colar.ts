import type { ParticipanteEvento } from './tipos'

export interface FuncionarioNome { id: string; nome: string }

export interface ResultadoColagem {
  participantes: Record<string, ParticipanteEvento>
  /** Linhas com problema (funcionário não encontrado, sem horário ou sem data de folga), já com o motivo. */
  problemas: string[]
}

const p2 = (n: number) => String(n).padStart(2, '0')
const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '')
const normaliza = (t: string) => semAcento(t).toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()

// '08h', '12:30h', '8h30', '13:30'
const HORA = String.raw`(\d{1,2})(?:[:h](\d{2}))?h?`
const RE_HORARIO = new RegExp(String.raw`${HORA}\s*(?:às|as|a|-|–|—)\s*${HORA}`, 'i')
const RE_DATA = /(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/g

const hhmm = (h: string, m?: string) => `${p2(Number(h))}:${m ?? '00'}`

/** Ano da folga quando a planilha só traz dia/mês: o primeiro ano em que a data fica depois do evento. */
function isoDaFolga(dia: number, mes: number, ano: number | undefined, evento: string): string | null {
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null
  const montar = (y: number) => `${y}-${p2(mes)}-${p2(dia)}`
  const valida = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number)
    const dt = new Date(Date.UTC(y, m - 1, d))
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
  }
  let iso: string
  if (ano !== undefined) iso = montar(ano < 100 ? 2000 + ano : ano)
  else {
    const y = Number(evento.slice(0, 4))
    iso = montar(y)
    if (iso <= evento) iso = montar(y + 1)
  }
  return valida(iso) ? iso : null
}

function acharFuncionario(linha: string, funcionarios: FuncionarioNome[]): { f?: FuncionarioNome; ambiguo?: boolean } {
  const normFs = funcionarios.map(f => ({ f, n: normaliza(f.nome) }))
  // 1) uma célula (colunas separadas por TAB) que seja o nome, inteiro ou cortado
  for (const cel of linha.split('\t')) {
    const c = normaliza(cel)
    if (c.length < 5) continue
    const exato = normFs.filter(x => x.n === c)
    if (exato.length === 1) return { f: exato[0].f }
    const prefixo = normFs.filter(x => x.n.startsWith(c) || c.startsWith(x.n))
    if (prefixo.length === 1) return { f: prefixo[0].f }
    if (prefixo.length > 1) return { ambiguo: true }
  }
  // 2) sem colunas: o maior nome de funcionário que aparece dentro da linha
  const l = ` ${normaliza(linha)} `
  const dentro = normFs.filter(x => l.includes(` ${x.n} `)).sort((a, b) => b.n.length - a.n.length)
  return dentro.length ? { f: dentro[0].f } : {}
}

/**
 * Lê linhas coladas da planilha (horário, funcionário e dias de folga, em qualquer ordem de colunas)
 * e devolve o período e as folgas de cada funcionário encontrado. Não altera quem não aparece no texto.
 */
export function interpretarPlanilha(texto: string, funcionarios: FuncionarioNome[], dataEvento: string): ResultadoColagem {
  const participantes: Record<string, ParticipanteEvento> = {}
  const problemas: string[] = []
  for (const linhaBruta of texto.split(/\r?\n/)) {
    const linha = linhaBruta.trim()
    if (!linha) continue
    const rotulo = linha.replace(/\s+/g, ' ').slice(0, 60)
    const h = RE_HORARIO.exec(linha)
    const sem = h ? linha.replace(h[0], ' ') : linha
    const { f, ambiguo } = acharFuncionario(sem, funcionarios)
    if (!f) { problemas.push(`${rotulo}: ${ambiguo ? 'nome bate com mais de um funcionário' : 'funcionário não encontrado neste posto'}.`); continue }
    if (!h) { problemas.push(`${f.nome}: horário não encontrado na linha.`); continue }
    const folgas: string[] = []
    let ruim = false
    for (const m of Array.from(sem.matchAll(RE_DATA))) {
      const iso = isoDaFolga(Number(m[1]), Number(m[2]), m[3] ? Number(m[3]) : undefined, dataEvento)
      if (iso) folgas.push(iso)
      else ruim = true
    }
    if (ruim || folgas.length === 0) { problemas.push(`${f.nome}: data de folga inválida ou ausente.`); continue }
    participantes[f.id] = {
      inicio: hhmm(h[1], h[2]),
      fim: hhmm(h[3], h[4]),
      folgas: Array.from(new Set(folgas)).sort(),
    }
  }
  return { participantes, problemas }
}
