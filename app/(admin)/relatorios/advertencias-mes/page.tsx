import { buscarAdvertenciasMes } from './actions'
import { BackButton } from '@/components/ui/back-button'
import { AdvertenciasMesClient } from '@/components/relatorios/advertencias-mes-client'

const MESES = ['','Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

export default async function AdvertenciasMesPage({
  searchParams,
}: {
  searchParams: { mes?: string; ano?: string }
}) {
  const now = new Date()
  const mes = Number(searchParams.mes ?? now.getMonth() + 1)
  const ano = Number(searchParams.ano ?? now.getFullYear())
  const anos = [now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2]

  const { rows, kpis } = await buscarAdvertenciasMes(mes, ano)

  return (
    <div className="space-y-6">
      <BackButton href="/relatorios" label="Voltar aos Relatórios" />
      <div>
        <h1 className="text-lg font-bold text-gray-900">Advertências do Mês</h1>
        <p className="text-sm text-gray-400">Advertências e suspensões registradas — {MESES[mes]} {ano}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-100 border-t-4 border-t-red-500 bg-white p-5 shadow-sm">
          <p className="text-2xl font-black tracking-tight text-gray-900">{kpis.total_advertencias}</p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-gray-400">Total Advertências</p>
        </div>
        <div className="rounded-xl border border-gray-100 border-t-4 border-t-orange-500 bg-white p-5 shadow-sm">
          <p className="text-2xl font-black tracking-tight text-gray-900">{kpis.total_suspensoes}</p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-gray-400">Total Suspensões</p>
        </div>
        <div className="rounded-xl border border-gray-100 border-t-4 border-t-slate-500 bg-white p-5 shadow-sm">
          <p className="text-2xl font-black tracking-tight text-gray-900">{kpis.total_dias_suspensos}</p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-gray-400">Dias Suspensos</p>
        </div>
      </div>

      <AdvertenciasMesClient rows={rows} mes={mes} ano={ano} MESES={MESES} anos={anos} />
    </div>
  )
}
