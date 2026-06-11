import { buscarCoberturasInsalubresRelatorio } from './actions'
import { BackButton } from '@/components/ui/back-button'
import { CoberturasInsalubresClient } from '@/components/relatorios/coberturas-insalubres-client'

const MESES = ['','Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

export default async function CoberturasInsalubresPage({
  searchParams,
}: {
  searchParams: { mes?: string; ano?: string }
}) {
  const now = new Date()
  const mes = Number(searchParams.mes ?? now.getMonth() + 1)
  const ano = Number(searchParams.ano ?? now.getFullYear())
  const anos = [now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2]

  const dados = await buscarCoberturasInsalubresRelatorio(mes, ano)

  const totalDias = dados.reduce((s, r) => s + r.dias, 0)
  const supervisores = new Set(dados.map(r => r.supervisor)).size

  return (
    <div className="space-y-6">
      <BackButton href="/relatorios" label="Voltar aos Relatórios" />
      <div>
        <h1 className="text-lg font-bold text-gray-900">Coberturas Insalubres</h1>
        <p className="text-sm text-gray-400">Registros de cobertura de insalubridade — {MESES[mes]} {ano}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-100 border-t-4 border-t-purple-500 bg-white p-5 shadow-sm">
          <p className="text-3xl font-black tracking-tight text-gray-900">{dados.length}</p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-gray-400">Registros</p>
        </div>
        <div className="rounded-xl border border-gray-100 border-t-4 border-t-blue-500 bg-white p-5 shadow-sm">
          <p className="text-3xl font-black tracking-tight text-gray-900">{totalDias}</p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-gray-400">Total Dias</p>
        </div>
        <div className="rounded-xl border border-gray-100 border-t-4 border-t-slate-500 bg-white p-5 shadow-sm">
          <p className="text-3xl font-black tracking-tight text-gray-900">{supervisores}</p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-gray-400">Supervisores</p>
        </div>
      </div>

      <CoberturasInsalubresClient dados={dados} mes={mes} ano={ano} MESES={MESES} anos={anos} />
    </div>
  )
}
