import * as XLSX from 'xlsx-js-style'

export type ExcelColumn<T> = {
  label: string
  value: (row: T) => string | number | null | undefined
}

export function exportToExcel<T>(
  data: T[],
  columns: ExcelColumn<T>[],
  filename: string,
): void {
  const header = columns.map(c => c.label)
  const rows = data.map(row => columns.map(col => col.value(row) ?? ''))
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows])
  XLSX.utils.book_append_sheet(wb, ws, 'Dados')
  XLSX.writeFile(wb, filename)
}
