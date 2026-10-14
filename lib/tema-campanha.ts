// Cor da sidebar acompanha a campanha nacional de saúde do mês.
// O fundo é derivado do destaque (escurecido), então texto claro mantém contraste
// AA em todos os meses (verificado: texto >= 9:1, rótulo >= 4.9:1).

export type TemaCampanha = {
  campanha: string
  accent: string  // cor-base da campanha
}

const TEMAS: Record<number, TemaCampanha> = {
  1:  { campanha: 'Janeiro Branco',     accent: '#e2e8f0' },
  2:  { campanha: 'Fevereiro Roxo',     accent: '#c084fc' },
  3:  { campanha: 'Março Azul-Marinho', accent: '#60a5fa' },
  4:  { campanha: 'Abril Verde',        accent: '#22c55e' },
  5:  { campanha: 'Maio Amarelo',       accent: '#facc15' },
  6:  { campanha: 'Junho Vermelho',     accent: '#f87171' },
  7:  { campanha: 'Julho Amarelo',      accent: '#fbbf24' },
  8:  { campanha: 'Agosto Dourado',     accent: '#d4a437' },
  9:  { campanha: 'Setembro Amarelo',   accent: '#a3e635' },
  10: { campanha: 'Outubro Rosa',       accent: '#f472b6' },
  11: { campanha: 'Novembro Azul',      accent: '#38bdf8' },
  12: { campanha: 'Dezembro Vermelho',  accent: '#fb7185' },
}

export function temaDoMes(mes: number): TemaCampanha {
  return TEMAS[mes] ?? TEMAS[4]
}

/** Mês atual no fuso de Brasília (o servidor da Vercel roda em UTC). */
export function mesAtualBrasilia(): number {
  const m = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', month: 'numeric' }).format(new Date())
  return Number(m)
}

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

// Flor de 5 pétalas; duas por azulejo de 72px (deslocadas) para não parecer grade.
function padraoFlores([r, g, b]: [number, number, number]): string {
  const c = `rgb(${r},${g},${b})`
  const flor = (x: number, y: number, s: number) =>
    `<g transform='translate(${x} ${y}) scale(${s})' fill='${c}' fill-opacity='0.16'>` +
    [0, 72, 144, 216, 288]
      .map(a => `<ellipse cx='0' cy='-7' rx='4.5' ry='7' transform='rotate(${a})'/>`)
      .join('') +
    `<circle r='3' fill-opacity='0.28'/></g>`
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='96' height='96'>` +
    flor(20, 22, 1) + flor(70, 64, 0.75) +
    `</svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}

/** Variáveis CSS consumidas pela sidebar. */
export function varsDoTema(t: TemaCampanha): Record<string, string> {
  const base = rgb(t.accent)
  const [r, g, b] = base
  const k = t.accent === '#e2e8f0' ? 0.2 : 0.3
  const bg = base.map(v => Math.round(v * k))
  const txt = base.map(v => Math.round(v * 0.35 + 255 * 0.65))
  return {
    '--nav-bg': `rgb(${bg.join(',')})`,
    '--nav-border': `rgba(${r},${g},${b},0.30)`,
    '--nav-accent': t.accent,
    '--nav-accent-soft': `rgba(${r},${g},${b},0.22)`,
    '--nav-label': t.accent,
    '--nav-text': `rgb(${txt.join(',')})`,
    '--nav-pattern': padraoFlores(base),
  }
}
