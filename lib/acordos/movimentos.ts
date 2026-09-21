import type { CamposAcordo, FuncionarioCalc, Movimento, PapelMovimento } from './tipos'
import { diaSemanaDe, hhmmParaMin } from './tempo'
import { jornadaDiaMin } from './horario-do-turno'

export interface ResumoCalculo {
  /** Minutos "devidos" por funcionário (movimento de origem). */
  horasTotalMin: number
  /** Acréscimo ou redução por dia de ajuste (0 se não há dias ou no T5). */
  minutosPorDia: number
  /** Jornada do dia da folga do primeiro funcionário (0 se não há dia de folga). */
  jornadaFolgaMin: number
}

export function saldoMin(movs: { minutos: number }[]): number {
  return movs.reduce((acc, m) => acc + m.minutos, 0)
}

export function jornadaDoDia(f: FuncionarioCalc, iso: string): number {
  return jornadaDiaMin(f.semana[diaSemanaDe(iso)])
}

function totalOrigem(c: CamposAcordo, f: FuncionarioCalc): number {
  let total = 0
  switch (c.template) {
    case 'T1':
    case 'T5':
      total = c.minutosOrigem ?? 0
      break
    case 'T2':
      total = c.horaNormal && c.horaDispensa ? hhmmParaMin(c.horaNormal) - hhmmParaMin(c.horaDispensa) : 0
      break
    case 'T3':
    case 'T4':
      total = c.dataFolga ? jornadaDoDia(f, c.dataFolga) : 0
      break
  }
  return Math.max(0, total)
}

export function resumoCalculo(c: CamposAcordo, funcs: FuncionarioCalc[]): ResumoCalculo {
  const f = funcs[0]
  if (!f) return { horasTotalMin: 0, minutosPorDia: 0, jornadaFolgaMin: 0 }
  const horasTotalMin = totalOrigem(c, f)
  const n = c.datasAjuste.length
  return {
    horasTotalMin,
    minutosPorDia: c.template === 'T5' || n === 0 ? 0 : Math.floor(horasTotalMin / n),
    jornadaFolgaMin: c.dataFolga ? jornadaDoDia(f, c.dataFolga) : 0,
  }
}

export function construirMovimentos(c: CamposAcordo, funcs: FuncionarioCalc[]): Movimento[] {
  const out: Movimento[] = []
  const n = c.datasAjuste.length
  for (const f of funcs) {
    const total = totalOrigem(c, f)
    const porDia = n > 0 ? Math.floor(total / n) : 0
    const mov = (data: string, minutos: number, papel: PapelMovimento) =>
      out.push({ funcionarioId: f.id, data, minutos, papel })
    switch (c.template) {
      case 'T1':
        if (c.dataEvento) mov(c.dataEvento, total, 'origem')
        for (const d of c.datasAjuste) mov(d, -porDia, 'quitacao')
        break
      case 'T2':
        if (c.dataEvento) mov(c.dataEvento, -total, 'origem')
        for (const d of c.datasAjuste) mov(d, porDia, 'quitacao')
        break
      case 'T3':
        if (c.dataFolga) mov(c.dataFolga, -total, 'origem')
        for (const d of c.datasAjuste) mov(d, porDia, 'quitacao')
        break
      case 'T4':
        for (const d of c.datasAjuste) mov(d, porDia, 'origem')
        if (c.dataFolga) mov(c.dataFolga, -total, 'quitacao')
        break
      case 'T5':
        if (c.dataEvento) mov(c.dataEvento, total, 'origem')
        if (c.dataFolga) mov(c.dataFolga, -total, 'quitacao')
        break
    }
  }
  return out
}

/**
 * Nos templates com dia de folga (T3/T4/T5) a jornada daquele dia muda de pessoa para pessoa.
 * Um único texto não descreve jornadas diferentes, então separamos em grupos (um acordo por grupo).
 */
export function agruparPorJornada(c: CamposAcordo, funcs: FuncionarioCalc[]): FuncionarioCalc[][] {
  const usaFolga = c.template === 'T3' || c.template === 'T4' || c.template === 'T5'
  if (!usaFolga || !c.dataFolga) return funcs.length ? [funcs] : []
  const grupos = new Map<number, FuncionarioCalc[]>()
  for (const f of funcs) {
    const chave = jornadaDoDia(f, c.dataFolga)
    grupos.set(chave, [...(grupos.get(chave) ?? []), f])
  }
  return Array.from(grupos.values())
}
