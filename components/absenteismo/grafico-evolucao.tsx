// components/absenteismo/grafico-evolucao.tsx
'use client'

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { DADOS_DESDE } from '@/lib/absenteismo/constantes'
import { fmtDataBR, fmtPct, rotuloMes } from '@/lib/absenteismo/formatar'
import type { PontoSerie } from '@/lib/absenteismo/series'

export function GraficoEvolucao({ serie }: { serie: PontoSerie[] }) {
  const pontos = serie
    .filter(p => p.taxa !== null)
    .map(p => ({
      rotulo: rotuloMes(p.mes) + (p.parcial ? '*' : ''),
      taxa: Math.round((p.taxa as number) * 100) / 100,
    }))

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-gray-500">
        Evolução da taxa de absenteísmo
      </p>
      {pontos.length === 0 ? (
        <p className="py-10 text-center text-sm text-gray-400">Sem dados no período.</p>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={pontos} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="rotulo" fontSize={11} tickLine={false} />
            <YAxis fontSize={11} width={44} tickLine={false} tickFormatter={v => fmtPct(Number(v), 1)} domain={[0, 'auto']} />
            <Tooltip formatter={v => [fmtPct(Number(v)), 'Taxa']} />
            <Line type="monotone" dataKey="taxa" stroke="#ea580c" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      )}
      <p className="mt-3 text-xs text-gray-400">
        Histórico disponível a partir de {fmtDataBR(DADOS_DESDE)}. * mês parcial (começa em {fmtDataBR(DADOS_DESDE)} ou
        ainda está em andamento).
      </p>
    </div>
  )
}
