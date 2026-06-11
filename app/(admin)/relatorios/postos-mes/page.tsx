import { buscarEfetivoMes } from './actions'
import { PostosMesClient } from '@/components/relatorios/postos-mes-client'

const MESES = ['','Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

export default async function PostosMesPage({
  searchParams,
}: {
  searchParams: { mes?: string; ano?: string }
}) {
  const now = new Date()
  const mes = Number(searchParams.mes ?? now.getMonth() + 1)
  const ano = Number(searchParams.ano ?? now.getFullYear())
  const anos = [now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2]

  const dados = await buscarEfetivoMes(mes, ano)

  const totalFuncionarios = dados.length
  const totalPostos = new Set(dados.map(r => r.posto_id)).size
  const totalSupervisores = new Set(dados.map(r => r.supervisor)).size

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Efetivo por Posto / Mês</h1>
        <p className="text-sm text-gray-400">Snapshot do efetivo nos postos — {MESES[mes]} {ano}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-100 border-t-4 border-t-blue-500 bg-white p-5 shadow-sm">
          <p className="text-3xl font-black tracking-tight text-gray-900">{totalFuncionarios}</p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-gray-400">Funcionários</p>
        </div>
        <div className="rounded-xl border border-gray-100 border-t-4 border-t-green-500 bg-white p-5 shadow-sm">
          <p className="text-3xl font-black tracking-tight text-gray-900">{totalPostos}</p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-gray-400">Postos</p>
        </div>
        <div className="rounded-xl border border-gray-100 border-t-4 border-t-slate-500 bg-white p-5 shadow-sm">
          <p className="text-3xl font-black tracking-tight text-gray-900">{totalSupervisores}</p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-gray-400">Supervisores</p>
        </div>
      </div>

      <PostosMesClient dados={dados} mes={mes} ano={ano} MESES={MESES} anos={anos} />
    </div>
  )
}
