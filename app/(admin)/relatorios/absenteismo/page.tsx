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

  const { absRows, feriasRows, kpisAbs, kpisFerias } = await buscarAbsenteismo(mes, ano)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Absenteísmo</h1>
        <p className="text-sm text-gray-400">Ausências não programadas e férias — {MESES[mes]} {ano}</p>
      </div>

      {/* KPIs Absenteísmo */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-400">Absenteísmo (não programado)</p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-gray-100 border-t-4 border-t-amber-500 bg-white p-5 shadow-sm">
            <p className="text-3xl font-black tracking-tight text-gray-900">{kpisAbs.total_ocorrencias}</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-gray-400">Ocorrências</p>
          </div>
          <div className="rounded-xl border border-gray-100 border-t-4 border-t-red-500 bg-white p-5 shadow-sm">
            <p className="text-3xl font-black tracking-tight text-gray-900">{kpisAbs.total_dias}</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-gray-400">Dias Perdidos</p>
          </div>
          <div className="rounded-xl border border-gray-100 border-t-4 border-t-orange-500 bg-white p-5 shadow-sm">
            <p className="text-3xl font-black tracking-tight text-gray-900">{kpisAbs.pct_absenteismo}%</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-gray-400">Taxa Absenteísmo</p>
            <p className="text-xs text-gray-300">{kpisAbs.total_funcionarios} func · {kpisAbs.dias_uteis} d.úteis</p>
          </div>
          <div className="rounded-xl border border-gray-100 border-t-4 border-t-slate-400 bg-white p-5 shadow-sm">
            <p className="text-3xl font-black tracking-tight text-gray-900">{kpisAbs.total_funcionarios}</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-gray-400">Funcionários Ativos</p>
          </div>
        </div>
      </div>

      {/* KPIs Férias */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-400">Ausências Programadas</p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-gray-100 border-t-4 border-t-blue-500 bg-white p-5 shadow-sm">
            <p className="text-3xl font-black tracking-tight text-gray-900">{kpisFerias.total_funcionarios}</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-gray-400">Funcionários em Férias</p>
          </div>
          <div className="rounded-xl border border-gray-100 border-t-4 border-t-green-500 bg-white p-5 shadow-sm">
            <p className="text-3xl font-black tracking-tight text-gray-900">{kpisFerias.total_dias}</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-gray-400">Dias de Férias no Mês</p>
          </div>
        </div>
      </div>

      <AbsenteismoClient
        absRows={absRows}
        feriasRows={feriasRows}
        mes={mes}
        ano={ano}
        MESES={MESES}
        anos={anos}
      />
    </div>
  )
}
