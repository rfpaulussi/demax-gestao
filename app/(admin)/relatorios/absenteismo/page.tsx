import { buscarAbsenteismo } from './actions'
import { AbsenteismoClient } from '@/components/relatorios/absenteismo-client'

const MESES = ['','Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

export default async function AbsenteismoPage({
  searchParams,
}: {
  searchParams: { mes?: string; ano?: string }
}) {
  const now = new Date()
  const mes = Number(searchParams.mes ?? now.getMonth() + 1)
  const ano = Number(searchParams.ano ?? now.getFullYear())
  const anos = [now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2]

  const { rows, kpis } = await buscarAbsenteismo(mes, ano)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Absenteísmo</h1>
        <p className="text-sm text-gray-400">Faltas, atestados e férias — {MESES[mes]} {ano}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-gray-100 border-t-4 border-t-amber-500 bg-white p-5 shadow-sm">
          <p className="text-3xl font-black tracking-tight text-gray-900">{kpis.total_ausencias}</p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-gray-400">Total Ausências</p>
        </div>
        <div className="rounded-xl border border-gray-100 border-t-4 border-t-red-500 bg-white p-5 shadow-sm">
          <p className="text-3xl font-black tracking-tight text-gray-900">{kpis.total_dias}</p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-gray-400">Dias Perdidos</p>
        </div>
        <div className="rounded-xl border border-gray-100 border-t-4 border-t-orange-500 bg-white p-5 shadow-sm">
          <p className="text-3xl font-black tracking-tight text-gray-900">{kpis.pct_absenteismo}%</p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-gray-400">% Absenteísmo</p>
          <p className="text-xs text-gray-300">{kpis.total_funcionarios} func · {kpis.dias_uteis} d.úteis</p>
        </div>
        <div className="rounded-xl border border-gray-100 border-t-4 border-t-slate-500 bg-white p-5 shadow-sm">
          <p className="text-3xl font-black tracking-tight text-gray-900">{kpis.total_funcionarios}</p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-gray-400">Funcionários</p>
        </div>
      </div>

      <AbsenteismoClient rows={rows} mes={mes} ano={ano} MESES={MESES} anos={anos} />
    </div>
  )
}
