import { buscarDesligamentos } from './actions'
import { BackButton } from '@/components/ui/back-button'
import { DesligamentosClient } from '@/components/relatorios/desligamentos-client'

const MESES = ['','Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

export default async function DesligamentosPage({
  searchParams,
}: {
  searchParams: { mes?: string; ano?: string }
}) {
  const now = new Date()
  const mes = Number(searchParams.mes ?? now.getMonth() + 1)
  const ano = Number(searchParams.ano ?? now.getFullYear())
  const anos = [now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2]

  const { rows, kpis } = await buscarDesligamentos(mes, ano)

  return (
    <div className="space-y-6">
      <BackButton href="/relatorios" label="Voltar aos Relatórios" />
      <div>
        <h1 className="text-lg font-bold text-gray-900">Desligamentos</h1>
        <p className="text-sm text-gray-400">Funcionários desligados — {MESES[mes]} {ano}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-xl border border-gray-100 border-t-4 border-t-slate-500 bg-white p-5 shadow-sm">
          <p className="text-2xl font-black tracking-tight text-gray-900">{kpis.total}</p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-gray-400">Total</p>
        </div>
        <div className="rounded-xl border border-gray-100 border-t-4 border-t-blue-500 bg-white p-5 shadow-sm">
          <p className="text-2xl font-black tracking-tight text-gray-900">{kpis.voluntaria}</p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-gray-400">Voluntária</p>
        </div>
        <div className="rounded-xl border border-gray-100 border-t-4 border-t-red-500 bg-white p-5 shadow-sm">
          <p className="text-2xl font-black tracking-tight text-gray-900">{kpis.demissao}</p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-gray-400">Demissão</p>
        </div>
        <div className="rounded-xl border border-gray-100 border-t-4 border-t-amber-500 bg-white p-5 shadow-sm">
          <p className="text-2xl font-black tracking-tight text-gray-900">{kpis.reprova_experiencia}</p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-gray-400">Reprova Exp.</p>
        </div>
        <div className="rounded-xl border border-gray-100 border-t-4 border-t-purple-500 bg-white p-5 shadow-sm">
          <p className="text-2xl font-black tracking-tight text-gray-900">{kpis.judicial}</p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-gray-400">Judicial</p>
        </div>
        <div className="rounded-xl border border-gray-100 border-t-4 border-t-gray-400 bg-white p-5 shadow-sm">
          <p className="text-2xl font-black tracking-tight text-gray-900">{kpis.outros}</p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-gray-400">Outros</p>
        </div>
      </div>

      <DesligamentosClient rows={rows} mes={mes} ano={ano} MESES={MESES} anos={anos} />
    </div>
  )
}
