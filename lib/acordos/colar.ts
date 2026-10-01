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

// Horário num texto só: '08h às 12:30h', '13:30 - 18'
const HORA = String.raw`(\d{1,2})(?:[:h](\d{2}))?h?`
const RE_HORARIO = new RegExp(String.raw`${HORA}\s*(?:às|as|a|-|–|—)\s*${HORA}`, 'i')
// Célula só com horário (colunas Início/Fim): '8', '8:30', '8h30', '0830', '1230'
const RE_CELULA_HORA = /^(\d{1,2})(?:[:h.](\d{2}))?h?$|^(\d{1,2})(\d{2})$/i
const RE_DATA = /(\d{1,2})\/(\d{1,2})\/(\d{4}|\d{2})/g
const RE_DATA_SEM_ANO = /\d{1,2}\/\d{1,2}(?!\/?\d)/

function hhmm(h: number, m: number): string | null {
  return h >= 0 && h <= 23 && m >= 0 && m <= 59 ? `${p2(h)}:${p2(m)}` : null
}

/** '8' → 08:00; '8:15'/'8h15'/'0815'/'815' → 08:15; inválido → null. */
export function parseHora(cel: string): string | null {
  const m = RE_CELULA_HORA.exec(cel.trim())
  if (!m) return null
  return m[3] !== undefined ? hhmm(Number(m[3]), Number(m[4])) : hhmm(Number(m[1]), Number(m[2] ?? 0))
}

function isoDaFolga(dia: number, mes: number, ano: number): string | null {
  const y = ano < 100 ? 2000 + ano : ano
  const dt = new Date(Date.UTC(y, mes - 1, dia))
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mes - 1 || dt.getUTCDate() !== dia) return null
  return `${y}-${p2(mes)}-${p2(dia)}`
}

function acharFuncionario(linha: string, funcionarios: FuncionarioNome[]): { f?: FuncionarioNome; ambiguo?: boolean; celula?: number } {
  const normFs = funcionarios.map(f => ({ f, n: normaliza(f.nome) }))
  // 1) uma célula (colunas separadas por TAB) que seja o nome, inteiro ou cortado
  const celulas = linha.split('\t')
  for (let i = 0; i < celulas.length; i++) {
    const c = normaliza(celulas[i])
    if (c.length < 5) continue
    const exato = normFs.filter(x => x.n === c)
    if (exato.length === 1) return { f: exato[0].f, celula: i }
    const prefixo = normFs.filter(x => x.n.startsWith(c) || c.startsWith(x.n))
    if (prefixo.length === 1) return { f: prefixo[0].f, celula: i }
    if (prefixo.length > 1) return { ambiguo: true }
  }
  // 2) sem colunas: o maior nome de funcionário que aparece dentro da linha
  const l = ` ${normaliza(linha)} `
  const dentro = normFs.filter(x => l.includes(` ${x.n} `)).sort((a, b) => b.n.length - a.n.length)
  return dentro.length ? { f: dentro[0].f } : {}
}

/** Horário da linha: "08h às 12:30h" numa célula, ou duas células só com números (início e fim). */
function acharPeriodo(linha: string, celulaDoNome?: number): { inicio: string; fim: string; resto: string } | null {
  const h = RE_HORARIO.exec(linha)
  if (h) {
    const inicio = hhmm(Number(h[1]), Number(h[2] ?? 0))
    const fim = hhmm(Number(h[3]), Number(h[4] ?? 0))
    return inicio && fim ? { inicio, fim, resto: linha.replace(h[0], ' ') } : null
  }
  const celulas = linha.split('\t')
  const horas: { i: number; v: string }[] = []
  celulas.forEach((cel, i) => {
    if (i === celulaDoNome) return
    const v = parseHora(cel)
    if (v) horas.push({ i, v })
  })
  if (horas.length < 2) return null
  const usadas = new Set([horas[0].i, horas[1].i])
  return { inicio: horas[0].v, fim: horas[1].v, resto: celulas.filter((_, i) => !usadas.has(i)).join('\t') }
}

/**
 * Lê linhas coladas da planilha e devolve o período e as folgas de cada funcionário encontrado.
 * Colunas em qualquer ordem: funcionário, início, fim (só números: 8, 12:30, 1230) e uma ou mais datas de folga
 * com ano (23/12/2026). Também aceita o horário num texto só ("08h às 12:30h"). Não altera quem não aparece no texto.
 */
export function interpretarPlanilha(texto: string, funcionarios: FuncionarioNome[]): ResultadoColagem {
  const participantes: Record<string, ParticipanteEvento> = {}
  const problemas: string[] = []
  for (const linhaBruta of texto.split(/\r?\n/)) {
    const linha = linhaBruta.replace(/\s+$/, '')
    if (!linha.trim()) continue
    const rotulo = linha.replace(/\s+/g, ' ').trim().slice(0, 60)
    const { f, ambiguo, celula } = acharFuncionario(linha, funcionarios)
    if (!f) { problemas.push(`${rotulo}: ${ambiguo ? 'nome bate com mais de um funcionário' : 'funcionário não encontrado neste posto'}.`); continue }
    const per = acharPeriodo(linha, celula)
    if (!per) { problemas.push(`${f.nome}: horário de início e fim não encontrado na linha.`); continue }
    const folgas: string[] = []
    let ruim = false
    for (const m of Array.from(per.resto.matchAll(RE_DATA))) {
      const iso = isoDaFolga(Number(m[1]), Number(m[2]), Number(m[3]))
      if (iso) folgas.push(iso)
      else ruim = true
    }
    if (RE_DATA_SEM_ANO.test(per.resto.replace(RE_DATA, ' '))) {
      problemas.push(`${f.nome}: informe a data da folga com o ano (ex.: 23/12/2026).`)
      continue
    }
    if (ruim || folgas.length === 0) { problemas.push(`${f.nome}: data de folga inválida ou ausente.`); continue }
    participantes[f.id] = { inicio: per.inicio, fim: per.fim, folgas: Array.from(new Set(folgas)).sort() }
  }
  return { participantes, problemas }
}
