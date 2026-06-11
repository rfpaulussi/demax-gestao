import { buscarFaltasMes } from './actions'
import { FaltasMesClient } from '@/components/relatorios/faltas-mes-client'

const MESES = ['','Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

export default async function FaltasMesPage({
  searchParams,
}: {
  searchParams: { mes?: string; ano?: string }
}) {
  const now = new Date()
  const mes = Number(searchParams.mes ?? now.getMonth() + 1)
  const ano = Number(searchParams.ano ?? now.getFullYear())
  const anos = [now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2]

  const { rows, kpis } = await buscarFaltasMes(mes, ano)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Faltas do Mês</h1>
        <p className="text-sm text-gray-400">Faltas registradas — {MESES[mes]} {ano}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-gray-100 border-t-4 border-t-orange-500 bg-white p-5 shadow-sm">
          <p className="text-3xl font-black tracking-tight text-gray-900">{kpis.total_faltas}</p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-gray-400">Total Faltas</p>
        </div>
        <div className="rounded-xl border border-gray-100 border-t-4 border-t-red-500 bg-white p-5 shadow-sm">
          <p className="text-3xl font-black tracking-tight text-gray-900">{kpis.total_dias}</p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-gray-400">Total Dias</p>
        </div>
        <div className="rounded-xl border border-gray-100 border-t-4 border-t-green-500 bg-white p-5 shadow-sm">
          <p className="text-3xl font-black tracking-tight text-gray-900">{kpis.com_documento}</p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-gray-400">Com Documento</p>
        </div>
        <div className="rounded-xl border border-gray-100 border-t-4 border-t-slate-500 bg-white p-5 shadow-sm">
          <p className="text-3xl font-black tracking-tight text-gray-900">{kpis.sem_documento}</p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-gray-400">Sem Documento</p>
        </div>
      </div>

      <FaltasMesClient rows={rows} mes={mes} ano={ano} MESES={MESES} anos={anos} />
    </div>
  )
}
