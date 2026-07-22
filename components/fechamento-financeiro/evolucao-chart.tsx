'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
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

function fmtPctDelta(v: number) {
  const sign = v > 0 ? '+' : ''
  return `${sign}${v.toFixed(1)}%`
}

interface Props {
  resumos: ResumoFechamento[]
  mesAtual: number
  anoAtual: number
}

export function EvolucaoChart({ resumos, mesAtual, anoAtual }: Props) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)

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
  const H       = 120
  const TOP_PAD = 22
  const BAR_W   = 38
  const GAP     = 10
  const LEFT    = 52
  const totalW  = LEFT + resumos.length * (BAR_W + GAP) + 16
  const totalH  = TOP_PAD + H + 48

  const idxSelecionado = resumos.findIndex(r => r.mes === mesAtual && r.ano === anoAtual)
  const idxDestaque = hoverIdx ?? (idxSelecionado >= 0 ? idxSelecionado : null)
  const destaque = idxDestaque != null ? resumos[idxDestaque] : null
  const destaqueAnterior = idxDestaque != null && idxDestaque > 0 ? resumos[idxDestaque - 1] : null
  const deltaDestaque = destaque && destaqueAnterior && destaqueAnterior.custo_total > 0
    ? ((destaque.custo_total - destaqueAnterior.custo_total) / destaqueAnterior.custo_total) * 100
    : null

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-gray-400">
        Evolução do Custo Total — {resumos.length} {resumos.length === 1 ? 'mês salvo' : 'meses salvos'}
      </p>
      <div className="overflow-x-auto">
        <svg width={totalW} height={totalH} className="block">
          {/* Y-axis gridlines */}
          {[0, 0.25, 0.5, 0.75, 1].map(frac => {
            const y = TOP_PAD + H - Math.round(frac * H)
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
            const y    = TOP_PAD + H - barH
            const isAtual  = r.mes === mesAtual && r.ano === anoAtual
            const isHover  = hoverIdx === i
            const destacada = isAtual || isHover

            const salarioBarH = maxCusto > 0 ? Math.round((r.salario_total / maxCusto) * H) : 0
            const salarioY    = TOP_PAD + H - salarioBarH

            const anterior = i > 0 ? resumos[i - 1] : null
            const delta = anterior && anterior.custo_total > 0
              ? ((r.custo_total - anterior.custo_total) / anterior.custo_total) * 100
              : null

            return (
              <g
                key={`${r.mes}-${r.ano}`}
                onMouseEnter={() => setHoverIdx(i)}
                onMouseLeave={() => setHoverIdx(null)}
                style={{ cursor: 'pointer' }}
              >
                {/* área de hit invisível — cobre a coluna inteira, não só a barra */}
                <rect x={x} y={TOP_PAD} width={BAR_W} height={H} fill="transparent" />

                <rect
                  x={x} y={y} width={BAR_W} height={barH} rx={3}
                  fill={destacada ? '#4f46e5' : '#c7d2fe'}
                />
                {/* marcador do salário total dentro da barra — mostra o "gap" de encargos */}
                {r.salario_total > 0 && salarioBarH < barH && (
                  <line
                    x1={x} x2={x + BAR_W} y1={salarioY} y2={salarioY}
                    stroke={destacada ? '#ffffff' : '#eef2ff'} strokeWidth={1.5}
                  />
                )}

                {/* variação % vs mês anterior */}
                {delta != null && (
                  <text
                    x={x + BAR_W / 2} y={y - 13} textAnchor="middle" fontSize={7}
                    fill={delta > 0 ? '#ef4444' : delta < 0 ? '#16a34a' : '#94a3b8'}
                    fontWeight={destacada ? 700 : 400}
                  >
                    {fmtPctDelta(delta)}
                  </text>
                )}
                {/* valor acima da barra */}
                <text x={x + BAR_W / 2} y={y - 4} textAnchor="middle" fontSize={8} fill={destacada ? '#4f46e5' : '#94a3b8'} fontWeight={destacada ? 700 : 400}>
                  {fmtK(r.custo_total)}
                </text>
                {/* rótulo mês */}
                <text x={x + BAR_W / 2} y={TOP_PAD + H + 14} textAnchor="middle" fontSize={9} fill={destacada ? '#1e293b' : '#64748b'} fontWeight={destacada ? 700 : 400}>
                  {MESES_ABREV[r.mes]}
                </text>
                <text x={x + BAR_W / 2} y={TOP_PAD + H + 26} textAnchor="middle" fontSize={8} fill="#94a3b8">
                  {r.ano}
                </text>
                {/* total ativos */}
                <text x={x + BAR_W / 2} y={TOP_PAD + H + 40} textAnchor="middle" fontSize={7} fill="#cbd5e1">
                  {r.total_ativos}f
                </text>
              </g>
            )
          })}

          {/* Axes */}
          <line x1={LEFT - 4} y1={TOP_PAD}   x2={LEFT - 4}   y2={TOP_PAD + H} stroke="#e2e8f0" strokeWidth={1} />
          <line x1={LEFT - 4} y1={TOP_PAD + H} x2={totalW - 8} y2={TOP_PAD + H} stroke="#e2e8f0" strokeWidth={1} />
        </svg>
      </div>

      {/* Legenda das cores/marcadores */}
      <div className="mt-2 flex flex-wrap items-center gap-4 border-t border-gray-50 pt-2 text-[10px] text-gray-400">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-3 rounded-sm bg-indigo-600" /> Custo total (com encargos)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-3 bg-indigo-200" /> Linha = salário total (sem encargos)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="text-red-500">▲</span> aumento vs. mês anterior
          <span className="text-green-600">▼</span> queda
        </span>
      </div>

      {/* Painel de detalhe — mês em destaque (hover) ou selecionado */}
      {destaque && (
        <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700">
              {MESES_ABREV[destaque.mes]}/{destaque.ano}
              {destaque.mes === mesAtual && destaque.ano === anoAtual && (
                <span className="ml-1.5 font-normal text-indigo-500">(selecionado)</span>
              )}
            </span>
            {deltaDestaque != null && (
              <span className={cn(
                'text-[10px] font-semibold',
                deltaDestaque > 0 ? 'text-red-500' : deltaDestaque < 0 ? 'text-green-600' : 'text-gray-400',
              )}>
                {fmtPctDelta(deltaDestaque)} vs. mês anterior
              </span>
            )}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            <div>
              <p className="text-gray-400">Custo Total</p>
              <p className="font-semibold text-indigo-700">{fmtBRL(destaque.custo_total)}</p>
            </div>
            <div>
              <p className="text-gray-400">Salário Total</p>
              <p className="font-semibold text-slate-700">{fmtBRL(destaque.salario_total)}</p>
            </div>
            <div>
              <p className="text-gray-400">Ativos / Afastados</p>
              <p className="font-semibold text-slate-700">{destaque.total_ativos} / {destaque.total_afastados}</p>
            </div>
            <div>
              <p className="text-gray-400">Em Férias</p>
              <p className="font-semibold text-slate-700">{destaque.total_em_ferias} ({destaque.total_dias_ferias}d)</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
