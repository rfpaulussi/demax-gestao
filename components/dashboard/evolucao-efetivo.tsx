'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import type { EvolucaoEfetivoResult } from '@/app/(admin)/dashboard/actions'

interface EvolucaoEfetivoProps {
  dados: EvolucaoEfetivoResult
}

const MINIMO_CONTRATUAL = 850

function formatPrimeiroCadastro(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export function EvolucaoEfetivo({ dados }: EvolucaoEfetivoProps) {
  const { meses, apenasUmMes, totalAtual, primeiroCadastro } = dados
  const deficit = Math.max(0, MINIMO_CONTRATUAL - totalAtual)

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-gray-400">
        Evolução do Efetivo
      </p>

      {apenasUmMes ? (
        <div className="space-y-3">
          <p className="text-sm text-gray-500">
            Histórico sendo construído
            {primeiroCadastro
              ? ` — dados disponíveis a partir de ${formatPrimeiroCadastro(primeiroCadastro)}`
              : ''}
            .
          </p>
          <ResponsiveContainer width="100%" height={100}>
            <BarChart data={[{ label: 'Atual', total: totalAtual }]} barSize={40}>
              <XAxis dataKey="label" fontSize={10} />
              <YAxis fontSize={10} width={35} />
              <Tooltip formatter={(v) => [v, 'Ativos']} />
              <Bar dataKey="total" radius={[4, 4, 0, 0]} fill="#1d4ed8" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={meses} barSize={28}>
            <XAxis dataKey="label" fontSize={10} />
            <YAxis fontSize={10} width={35} />
            <Tooltip formatter={(v) => [v, 'Ativos']} />
            <ReferenceLine
              y={MINIMO_CONTRATUAL}
              stroke="#ef4444"
              strokeDasharray="3 3"
              label={{
                value: 'mín. contratual',
                position: 'insideTopRight',
                fontSize: 10,
                fill: '#ef4444',
              }}
            />
            <Bar dataKey="total" radius={[4, 4, 0, 0]}>
              {meses.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={index === meses.length - 1 ? '#1d4ed8' : '#3b82f6'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}

      <p className="mt-3 text-xs text-gray-400">
        Mínimo contratual: {MINIMO_CONTRATUAL} · Atual:{' '}
        <span className={totalAtual < MINIMO_CONTRATUAL ? 'font-semibold text-gray-700' : 'font-semibold text-gray-700'}>
          {totalAtual}
        </span>
        {' · '}
        Déficit:{' '}
        <span className={deficit > 0 ? 'font-semibold text-red-600' : 'text-gray-400'}>
          {deficit > 0 ? `−${deficit}` : '0'}
        </span>
      </p>
    </div>
  )
}
