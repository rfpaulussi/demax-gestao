// Cor da sidebar acompanha a campanha nacional de saúde do mês.
// Fundo sempre escuro (texto claro mantém contraste); só o destaque muda de matiz.

export type TemaCampanha = {
  campanha: string
  bg: string      // fundo da sidebar
  accent: string  // item ativo, ponto da marca, rótulos de grupo
}

const TEMAS: Record<number, TemaCampanha> = {
  1:  { campanha: 'Janeiro Branco',    bg: '#0f1318', accent: '#e2e8f0' },
  2:  { campanha: 'Fevereiro Roxo',    bg: '#130a1c', accent: '#c084fc' },
  3:  { campanha: 'Março Azul-Marinho', bg: '#07101f', accent: '#60a5fa' },
  4:  { campanha: 'Abril Verde',       bg: '#071510', accent: '#22c55e' },
  5:  { campanha: 'Maio Amarelo',      bg: '#171302', accent: '#facc15' },
  6:  { campanha: 'Junho Vermelho',    bg: '#1c0a0a', accent: '#f87171' },
  7:  { campanha: 'Julho Amarelo',     bg: '#181104', accent: '#fbbf24' },
  8:  { campanha: 'Agosto Dourado',    bg: '#171204', accent: '#d4a437' },
  9:  { campanha: 'Setembro Amarelo',  bg: '#101504', accent: '#a3e635' },
  10: { campanha: 'Outubro Rosa',      bg: '#1c0914', accent: '#f472b6' },
  11: { campanha: 'Novembro Azul',     bg: '#06141c', accent: '#38bdf8' },
  12: { campanha: 'Dezembro Vermelho', bg: '#1c0909', accent: '#fb7185' },
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

/** Variáveis CSS consumidas pela sidebar. */
export function varsDoTema(t: TemaCampanha): Record<string, string> {
  const [r, g, b] = rgb(t.accent)
  return {
    '--nav-bg': t.bg,
    '--nav-border': `rgba(${r},${g},${b},0.14)`,
    '--nav-accent': t.accent,
    '--nav-accent-soft': `rgba(${r},${g},${b},0.10)`,
    '--nav-label': `rgba(${r},${g},${b},0.9)`,
  }
}
