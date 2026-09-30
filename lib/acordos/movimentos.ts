import type { CamposAcordo, FuncionarioCalc, Movimento, PapelMovimento } from './tipos'
import { diaSemanaDe } from './tempo'
import { jornadaDiaMin, minutosAposHorario, minutosForaDoHorario, saidaDoDia } from './horario-do-turno'

export interface ResumoCalculo {
  /** Minutos "devidos" por funcionário (movimento de origem). */
  horasTotalMin: number
  /** Acréscimo ou redução por dia de ajuste (0 se não há dias ou no T5). */
  minutosPorDia: number
  /** Jornada do dia da folga do primeiro funcionário (0 se não há dia de folga). */
  jornadaFolgaMin: number
  /** Data de folga do primeiro funcionário do grupo (T3/T4/T5). */
  dataFolga?: string
  /** T2: saída normal do dia do evento (turno do primeiro funcionário); '' nos demais templates. */
  horaNormal: string
  /** T5 com `participantes`: dias de folga e período trabalhado do primeiro funcionário do grupo. */
  folgas?: string[]
  periodo?: { inicio: string; fim: string }
}

export function saldoMin(movs: { minutos: number }[]): number {
  return movs.reduce((acc, m) => acc + m.minutos, 0)
}

/** Data de folga de um funcionário: a dele no revezamento, senão a data comum a todos. */
export function folgaDe(c: CamposAcordo, f: { id: string }): string | undefined {
  if (c.participantes) return folgasDe(c, f)[0]
  return c.folgasPorFuncionario?.[f.id] ?? c.dataFolga
}

/** Todos os dias de folga de um funcionário (ordenados). Só o T5 com `participantes` tem mais de um. */
export function folgasDe(c: CamposAcordo, f: { id: string }): string[] {
  if (c.participantes) return [...(c.participantes[f.id]?.folgas ?? [])].sort()
  const d = folgaDe(c, f)
  return d ? [d] : []
}

/** Todas as datas de folga do acordo (ordenadas, sem repetição). */
export function datasDeFolga(c: CamposAcordo): string[] {
  const todas = [
    ...Object.values(c.folgasPorFuncionario ?? {}),
    ...Object.values(c.participantes ?? {}).flatMap(p => p.folgas),
    c.dataFolga,
  ].filter((d): d is string => !!d)
  return Array.from(new Set(todas)).sort()
}

/** Dias trabalhados no evento (ordenados, sem repetição). */
export function datasDoEvento(c: CamposAcordo): string[] {
  return Array.from(new Set([c.dataEvento, ...(c.datasEvento ?? [])].filter((d): d is string => !!d))).sort()
}

/** Minutos de origem (T1/T5) de um funcionário num dos dias do evento. */
export function origemDoDia(c: CamposAcordo, f: FuncionarioCalc, data: string): number {
  const p = c.participantes?.[f.id]
  if (p) return Math.max(0, minutosForaDoHorario(f.semana[diaSemanaDe(data)], p.inicio, p.fim))
  const min = c.periodoInicio && c.periodoFim
    ? minutosForaDoHorario(f.semana[diaSemanaDe(data)], c.periodoInicio, c.periodoFim)
    : c.minutosOrigem ?? 0 // sem período: a duração digitada já é hora extra
  return Math.max(0, min)
}

export function jornadaDoDia(f: FuncionarioCalc, iso: string): number {
  return jornadaDiaMin(f.semana[diaSemanaDe(iso)])
}

/** Minutos que o funcionário trabalhou fora do horário normal nos dias do evento (T1/T5). */
export function trabalhadoMin(c: CamposAcordo, f: FuncionarioCalc): number {
  return datasDoEvento(c).reduce((acc, d) => acc + origemDoDia(c, f, d), 0)
}

/** T5 com `participantes`: folga em dias inteiros = soma das jornadas dos dias de folga. */
function creditoEmDias(c: CamposAcordo, f: FuncionarioCalc): number {
  return folgasDe(c, f).reduce((acc, d) => acc + jornadaDoDia(f, d), 0)
}

/** Minutos de origem de um funcionário, calculados a partir do turno dele. */
export function totalOrigem(c: CamposAcordo, f: FuncionarioCalc): number {
  let total = 0
  switch (c.template) {
    case 'T1':
      total = trabalhadoMin(c, f)
      break
    case 'T5':
      total = c.participantes ? creditoEmDias(c, f) : trabalhadoMin(c, f)
      break
    case 'T2':
      total = c.dataEvento && c.horaDispensa
        ? minutosAposHorario(f.semana[diaSemanaDe(c.dataEvento)], c.horaDispensa)
        : 0
      break
    case 'T3':
      total = folgaDe(c, f) ? jornadaDoDia(f, folgaDe(c, f)!) : 0
      break
    case 'T4':
      total = c.minutosFolga !== undefined ? c.minutosFolga : folgaDe(c, f) ? jornadaDoDia(f, folgaDe(c, f)!) : 0
      break
  }
  return Math.max(0, total)
}

export function resumoCalculo(c: CamposAcordo, funcs: FuncionarioCalc[]): ResumoCalculo {
  const f = funcs[0]
  if (!f) return { horasTotalMin: 0, minutosPorDia: 0, jornadaFolgaMin: 0, horaNormal: '' }
  const dataFolga = folgaDe(c, f)
  const horasTotalMin = totalOrigem(c, f)
  const n = c.datasAjuste.length
  return {
    horasTotalMin,
    minutosPorDia: c.template === 'T5' || n === 0 ? 0 : Math.floor(horasTotalMin / n),
    dataFolga,
    jornadaFolgaMin: dataFolga ? jornadaDoDia(f, dataFolga) : 0,
    horaNormal: c.template === 'T2' && c.dataEvento ? saidaDoDia(f.semana[diaSemanaDe(c.dataEvento)]) : '',
    ...(c.participantes?.[f.id]
      ? { folgas: folgasDe(c, f), periodo: { inicio: c.participantes[f.id].inicio, fim: c.participantes[f.id].fim } }
      : {}),
  }
}

export function construirMovimentos(c: CamposAcordo, funcs: FuncionarioCalc[]): Movimento[] {
  const out: Movimento[] = []
  const n = c.datasAjuste.length
  for (const f of funcs) {
    const total = totalOrigem(c, f)
    const porDia = n > 0 ? Math.floor(total / n) : 0
    const dataFolga = folgaDe(c, f)
    const mov = (data: string, minutos: number, papel: PapelMovimento) =>
      out.push({ funcionarioId: f.id, data, minutos, papel })
    switch (c.template) {
      case 'T1':
        for (const d of datasDoEvento(c)) mov(d, origemDoDia(c, f, d), 'origem')
        for (const d of c.datasAjuste) mov(d, -porDia, 'quitacao')
        break
      case 'T2':
        if (c.dataEvento) mov(c.dataEvento, -total, 'origem')
        for (const d of c.datasAjuste) mov(d, porDia, 'quitacao')
        break
      case 'T3':
        if (dataFolga) mov(dataFolga, -total, 'origem')
        for (const d of c.datasAjuste) mov(d, porDia, 'quitacao')
        break
      case 'T4':
        for (const d of c.datasAjuste) mov(d, porDia, 'origem')
        if (dataFolga) mov(dataFolga, -total, 'quitacao')
        break
      case 'T5':
        if (c.participantes) {
          // dias inteiros: o direito às folgas nasce no 1º dia do evento e cada folga o quita; o saldo fecha em zero
          const primeiro = datasDoEvento(c)[0]
          if (primeiro) mov(primeiro, total, 'origem')
          for (const d of folgasDe(c, f)) mov(d, -jornadaDoDia(f, d), 'quitacao')
          break
        }
        for (const d of datasDoEvento(c)) mov(d, origemDoDia(c, f, d), 'origem')
        if (dataFolga) mov(dataFolga, -total, 'quitacao')
        break
    }
  }
  return out
}

/**
 * Funcionários com turnos diferentes geram textos diferentes (jornada da folga, saída normal, horas fora do horário).
 * Um único texto não descreve todos, então separamos em grupos (um acordo por grupo), na ordem da primeira aparição.
 */
export function agruparPorJornada(c: CamposAcordo, funcs: FuncionarioCalc[]): FuncionarioCalc[][] {
  const chaveDe = (f: FuncionarioCalc): string | null => {
    switch (c.template) {
      case 'T1':
        return String(totalOrigem(c, f))
      case 'T2':
        if (!c.dataEvento || !c.horaDispensa) return null
        return `${saidaDoDia(f.semana[diaSemanaDe(c.dataEvento)])}|${totalOrigem(c, f)}`
      case 'T3':
      case 'T4':
        return folgaDe(c, f) ? `${jornadaDoDia(f, folgaDe(c, f)!)}|${folgaDe(c, f)}` : null
      case 'T5': {
        if (c.participantes) {
          const p = c.participantes[f.id]
          return `${p?.inicio ?? ''}|${p?.fim ?? ''}|${folgasDe(c, f).join(',')}`
        }
        return folgaDe(c, f) ? `${totalOrigem(c, f)}|${jornadaDoDia(f, folgaDe(c, f)!)}|${folgaDe(c, f)}` : null
      }
    }
  }
  if (funcs.length === 0) return []
  if (chaveDe(funcs[0]) === null) return [funcs]
  const grupos = new Map<string, FuncionarioCalc[]>()
  for (const f of funcs) {
    const chave = chaveDe(f) as string
    grupos.set(chave, [...(grupos.get(chave) ?? []), f])
  }
  return Array.from(grupos.values())
}
