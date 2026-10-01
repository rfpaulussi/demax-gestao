import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx-js-style'
import { planilhaParaTexto } from './planilha-arquivo'
import { interpretarPlanilha } from './colar'

function arquivo(linhas: unknown[][], extra: Record<string, unknown> = {}): File {
  const ws = XLSX.utils.aoa_to_sheet(linhas)
  Object.assign(ws, extra)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Dados')
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx', cellDates: true }) as ArrayBuffer
  return new File([buf], 'x.xlsx')
}

const fs = [{ id: '1', nome: 'Amanda Gonçalves' }, { id: '2', nome: 'Marília Rosana do Patrocínio' }]

describe('planilhaParaTexto', () => {
  it('lê texto (como o modelo baixado), some o cabeçalho e alimenta a colagem', async () => {
    const f = arquivo([
      ['Funcionário', 'Início', 'Fim', 'Folga 1', 'Folga 2'],
      ['Amanda Gonçalves', '8', '12:30', '23/12/2026', ''],
      ['Marília Rosana do Patrocínio', '8:15', '18', '28/12/2026', '29/12/2026'],
    ])
    const r = interpretarPlanilha(await planilhaParaTexto(f), fs)
    expect(r.problemas).toEqual([])
    expect(r.participantes['1']).toEqual({ inicio: '08:00', fim: '12:30', folgas: ['2026-12-23'] })
    expect(r.participantes['2']).toEqual({ inicio: '08:15', fim: '18:00', folgas: ['2026-12-28', '2026-12-29'] })
  })

  it('lê células numéricas de hora e de data como o Excel guarda', async () => {
    const f = arquivo([
      ['Funcionário', 'Início', 'Fim', 'Folga 1'],
      ['Amanda Gonçalves', 8, 0.5208333333333334, (Date.UTC(2026, 11, 23) - Date.UTC(1899, 11, 30)) / 86400000],
    ])
    const txt = await planilhaParaTexto(f)
    const r = interpretarPlanilha(txt, fs)
    expect(r.problemas, txt).toEqual([])
    expect(r.participantes['1'].inicio).toBe('08:00')
    expect(r.participantes['1'].fim).toBe('12:30')
    expect(r.participantes['1'].folgas).toEqual(['2026-12-23'])
  })
})
