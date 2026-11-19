// components/absenteismo/grafico-composicao.tsx
'use client'

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import type { ClasseTaxa } from '@/lib/absenteismo/classificar'
import type { FatiaComposicao } from '@/lib/absenteismo/composicao'
import { fmtInt, fmtPct } from '@/lib/absenteismo/formatar'

const COR: Record<ClasseTaxa, string> = {
  falta_injustificada: '#dc2626',
  falta_justificada: '#f59e0b',
  atestado: '#3b82f6',
  outras: '#94a3b8',
}

export function GraficoComposicao({ fatias, total }: { fatias: FatiaComposicao[]; total: number }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-gray-500">Composição das ausências</p>
      {total === 0 ? (
        <p className="py-10 text-center text-sm text-gray-400">Nenhuma jornada perdida no período.</p>
      ) : (
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <div className="relative h-40 w-40 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={fatias} dataKey="jornadas" nameKey="rotulo" innerRadius={50} outerRadius={72} paddingAngle={2} stroke="none">
                  {fatias.map(f => (
                    <Cell key={f.classe} fill={COR[f.classe]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v, nome) => [`${fmtInt(Number(v))} jornadas`, String(nome)]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-black text-gray-900">{fmtInt(total)}</span>
              <span className="text-[10px] uppercase tracking-widest text-gray-400">jornadas</span>
            </div>
          </div>
          <ul className="w-full space-y-2 text-sm">
            {fatias.map(f => (
              <li key={f.classe} className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-gray-600">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COR[f.classe] }} aria-hidden />
                  {f.rotulo}
                </span>
                <span className="whitespace-nowrap text-gray-900">
                  <strong>{fmtPct(f.pct_jornadas, 1)}</strong>{' '}
                  <span className="text-xs text-gray-400">({fmtInt(f.jornadas)} · {fmtInt(f.episodios)} ep.)</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
