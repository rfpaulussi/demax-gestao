const SITUACOES: Record<string, { label: string; className: string }> = {
  ativo:             { label: 'Ativo',             className: 'bg-green-100 text-green-700' },
  ferias:            { label: 'Em férias',         className: 'bg-sky-100 text-sky-700' },
  afastado:          { label: 'Afastado',          className: 'bg-red-100 text-red-700' },
  atestado:          { label: 'Atestado',          className: 'bg-amber-100 text-amber-700' },
  faltante:          { label: 'Faltante',          className: 'bg-orange-100 text-orange-700' },
  rescisao_indireta: { label: 'Rescisão indireta', className: 'bg-purple-100 text-purple-700' },
  desligado:         { label: 'Desligado',         className: 'bg-slate-200 text-slate-600' },
  inativo:           { label: 'Inativo',           className: 'bg-slate-100 text-slate-500' },
}

export const SITUACAO_OPCOES = Object.entries(SITUACOES).map(([value, v]) => ({ value, label: v.label }))

export function situacaoLabel(status: string | null): string {
  return status ? SITUACOES[status]?.label ?? status : '—'
}

export function SituacaoBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-slate-400">—</span>
  const s = SITUACOES[status] ?? { label: status, className: 'bg-slate-100 text-slate-600' }
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${s.className}`}>
      {s.label}
    </span>
  )
}
