const p2 = (n: number) => String(n).padStart(2, '0')

/**
 * Valor cru de uma célula do Excel → texto que a colagem entende.
 * Número ≥ 20000 = data (nº de série); entre 0 e 1 = hora (fração do dia); outros números ficam como estão (8, 1800).
 */
function celulaParaTexto(v: unknown): string {
  if (typeof v === 'number') {
    if (v >= 20000) {
      const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(v) * 86400000)
      return `${p2(d.getUTCDate())}/${p2(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`
    }
    if (v > 0 && v < 1) {
      const min = Math.round(v * 1440)
      return `${Math.floor(min / 60)}:${p2(min % 60)}`
    }
    return String(v)
  }
  return String(v ?? '').trim()
}

/** Lê a 1ª aba de um .xlsx/.xls e devolve o texto em linhas separadas por TAB (o mesmo formato da colagem). Só no navegador. */
export async function planilhaParaTexto(arquivo: File): Promise<string> {
  const mod = await import('xlsx-js-style')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const XLSX: any = (mod as any).default ?? mod
  const wb = XLSX.read(await arquivo.arrayBuffer(), { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  if (!ws) return ''
  // raw: true → valores como o Excel guarda, sem depender do formato/idioma da célula
  const linhas = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, blankrows: false }) as unknown[][]
  const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
  return linhas
    .map(l => l.map(celulaParaTexto))
    .filter(l => l.some(Boolean) && !l.some(c => semAcento(c) === 'funcionario')) // some o cabeçalho
    .map(l => l.join('\t'))
    .join('\n')
}
