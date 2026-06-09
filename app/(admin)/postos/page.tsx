import { getPostosData } from './actions'
import { PostosClient } from '@/components/postos/postos-client'

function CounterCard({
  label,
  value,
  topColor,
}: {
  label: string
  value: number
  topColor: string
}) {
  return (
    <div className={`rounded-xl border border-gray-100 border-t-4 bg-white p-5 shadow-sm ${topColor}`}>
      <p className="text-4xl font-black tracking-tight text-gray-900">{value}</p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-gray-400">{label}</p>
    </div>
  )
}

export default async function PostosPage() {
  const postos = await getPostosData()

  const total         = postos.length
  const ok            = postos.filter(p => p.efetivo_atual === p.efetivo_previsto && p.efetivo_atual > 0).length
  const deficit       = postos.filter(p => p.efetivo_atual < p.efetivo_previsto && p.efetivo_atual > 0).length
  const vagos         = postos.filter(p => p.efetivo_atual === 0).length
  const excesso       = postos.filter(p => p.efetivo_atual > p.efetivo_previsto).length
  const semSupervisor = postos.filter(p => !p.supervisor_nome).length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Controle de Postos</h1>
        <p className="text-sm text-gray-400">Visão geral do efetivo por posto de trabalho</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        <CounterCard label="Total"          value={total}         topColor="border-t-gray-400"   />
        <CounterCard label="Ok"             value={ok}            topColor="border-t-green-500"  />
        <CounterCard label="Déficit"        value={deficit}       topColor="border-t-red-500"    />
        <CounterCard label="Vagos"          value={vagos}         topColor="border-t-gray-400"   />
        <CounterCard label="Excesso"        value={excesso}       topColor="border-t-indigo-500" />
        <CounterCard label="Sem Supervisor" value={semSupervisor} topColor="border-t-amber-500"  />
      </div>

      <PostosClient postos={postos} />
    </div>
  )
}
