'use client'

import type { ResumoFechamento } from '@/app/(admin)/fechamento-financeiro/actions'

const MESES_ABREV = ['','Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

function fmtK(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k`
  return v.toFixed(0)
}

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

interface Props {
  resumos: ResumoFechamento[]
  mesAtual: number
  anoAtual: number
}

export function EvolucaoChart({ resumos, mesAtual, anoAtual }: Props) {
  if (resumos.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-medium text-gray-400">Sem histórico salvo</p>
        <p className="mt-1 text-xs text-gray-300">
          Após calcular, clique em <strong>Salvar Fechamento</strong> para iniciar o gráfico de evolução.
        </p>
      </div>
    )
  }

  const maxCusto = Math.max(...resumos.map(r => r.custo_total))
  const H = 120
  const BAR_W = 38
  const GAP = 10
  const LEFT = 52
  const totalW = LEFT + resumos.length * (BAR_W + GAP) + 16

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-gray-400">
        Evolução do Custo Total — {resumos.length} {resumos.length === 1 ? 'mês salvo' : 'meses salvos'}
      </p>
      <div className="overflow-x-auto">
        <svg width={totalW} height={H + 48} className="block">
          {/* Y-axis gridlines */}
          {[0, 0.25, 0.5, 0.75, 1].map(frac => {
            const y = H - Math.round(frac * H)
            return (
              <g key={frac}>
                <line x1={LEFT - 4} y1={y} x2={totalW - 8} y2={y} stroke="#f1f5f9" strokeWidth={1} />
                <text x={LEFT - 6} y={y + 3} textAnchor="end" fontSize={8} fill="#94a3b8">
                  {fmtK(maxCusto * frac)}
                </text>
              </g>
            )
          })}

          {/* Bars */}
          {resumos.map((r, i) => {
            const x    = LEFT + i * (BAR_W + GAP)
            const barH = maxCusto > 0 ? Math.max(2, Math.round((r.custo_total / maxCusto) * H)) : 2
            const y    = H - barH
            const isAtual = r.mes === mesAtual && r.ano === anoAtual

            return (
              <g key={`${r.mes}-${r.ano}`}>
                <rect
                  x={x} y={y} width={BAR_W} height={barH} rx={3}
                  fill={isAtual ? '#4f46e5' : '#c7d2fe'}
                />
                {/* valor acima da barra */}
                <text x={x + BAR_W / 2} y={y - 4} textAnchor="middle" fontSize={8} fill={isAtual ? '#4f46e5' : '#94a3b8'} fontWeight={isAtual ? 700 : 400}>
                  {fmtK(r.custo_total)}
                </text>
                {/* rótulo mês */}
                <text x={x + BAR_W / 2} y={H + 14} textAnchor="middle" fontSize={9} fill={isAtual ? '#1e293b' : '#64748b'} fontWeight={isAtual ? 700 : 400}>
                  {MESES_ABREV[r.mes]}
                </text>
                <text x={x + BAR_W / 2} y={H + 26} textAnchor="middle" fontSize={8} fill="#94a3b8">
                  {r.ano}
                </text>
                {/* total ativos */}
                <text x={x + BAR_W / 2} y={H + 40} textAnchor="middle" fontSize={7} fill="#cbd5e1">
                  {r.total_ativos}f
                </text>
              </g>
            )
          })}

          {/* Axes */}
          <line x1={LEFT - 4} y1={0}   x2={LEFT - 4}  y2={H} stroke="#e2e8f0" strokeWidth={1} />
          <line x1={LEFT - 4} y1={H}   x2={totalW - 8} y2={H} stroke="#e2e8f0" strokeWidth={1} />
        </svg>
      </div>

      {/* Mini legenda do mês atual */}
      {resumos.find(r => r.mes === mesAtual && r.ano === anoAtual) && (
        <div className="mt-3 flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-indigo-600" />
          <span className="text-[10px] text-gray-400">Mês selecionado</span>
          <span className="ml-auto text-[10px] font-semibold text-indigo-600">
            {fmtBRL(resumos.find(r => r.mes === mesAtual && r.ano === anoAtual)!.custo_total)}
          </span>
        </div>
      )}
    </div>
  )
}
