import * as XLSX from 'xlsx-js-style'

const HEADER_BG = '0F172A'
const HEADER_FG = 'FFFFFF'

export type CellStyleResult = {
  fill?: string  // hex sem #, ex: 'F0FDF4'
  color?: string // hex sem #, ex: '15803D'
}

export type ExcelColumn<T> = {
  label: string
  value: (row: T) => string | number | null | undefined
  cellStyle?: (row: T) => CellStyleResult | undefined
  asText?: boolean
}

function maxWidth(values: (string | number | null | undefined)[], label: string): number {
  let max = label.length
  for (const v of values) {
    const len = v == null ? 1 : String(v).length
    if (len > max) max = len
  }
  return Math.min(max + 2, 50)
}

export function exportToExcel<T>(
  data: T[],
  columns: ExcelColumn<T>[],
  filename: string,
): void {
  const wb = XLSX.utils.book_new()
  const ws: XLSX.WorkSheet = {}
  const nRows = data.length
  const nCols = columns.length

  // Header
  const headerStyle = {
    font: { bold: true, color: { rgb: HEADER_FG }, sz: 10 },
    fill: { patternType: 'solid', fgColor: { rgb: HEADER_BG } },
    alignment: { vertical: 'center' },
  }
  columns.forEach((col, ci) => {
    ws[XLSX.utils.encode_cell({ r: 0, c: ci })] = { v: col.label, t: 's', s: headerStyle }
  })

  // Data rows
  data.forEach((row, ri) => {
    columns.forEach((col, ci) => {
      const raw = col.value(row)
      const v = raw ?? ''
      const style = col.cellStyle?.(row)

      const s: Record<string, unknown> = {}
      if (style?.fill) s.fill = { patternType: 'solid', fgColor: { rgb: style.fill } }
      if (style?.color) s.font = { color: { rgb: style.color } }
      const hasStyle = Object.keys(s).length > 0

      ws[XLSX.utils.encode_cell({ r: ri + 1, c: ci })] = col.asText
        ? { v: String(v), t: 's', ...(hasStyle ? { s } : {}) }
        : { v, t: typeof v === 'number' ? 'n' : 's', ...(hasStyle ? { s } : {}) }
    })
  })

  ws['!ref'] = XLSX.utils.encode_range({ r: 0, c: 0 }, { r: nRows, c: nCols - 1 })
  ws['!cols'] = columns.map((col) => ({ wch: maxWidth(data.map(row => col.value(row)), col.label) }))
  ws['!autofilter'] = { ref: XLSX.utils.encode_range({ r: 0, c: 0 }, { r: 0, c: nCols - 1 }) }
  ws['!freeze'] = { xSplit: 0, ySplit: 1 }

  XLSX.utils.book_append_sheet(wb, ws, 'Dados')
  XLSX.writeFile(wb, filename)
}
