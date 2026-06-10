import { cn } from '@/lib/utils'
import { buscarFaltas, buscarFuncionariosParaFalta } from './actions'
import { FaltasClient } from '@/components/faltas/faltas-client'

function KpiCard({ label, value, borderColor }: { label: string; value: number; borderColor: string }) {
  return (
    <div className={cn('rounded-xl border border-gray-100 border-t-4 bg-white p-5 shadow-sm', borderColor)}>
      <p className="text-3xl font-black tracking-tight text-gray-900">{value}</p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-gray-400">{label}</p>
    </div>
  )
}

const MESES = ['','Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

export default async function FaltasPage({
  searchParams,
}: {
  searchParams: { mes?: string; ano?: string; tipo?: string }
}) {
  const now = new Date()
  const mes = Number(searchParams.mes ?? now.getMonth() + 1)
  const ano = Number(searchParams.ano ?? now.getFullYear())

  const [todasFaltas, funcionariosOpt] = await Promise.all([
    buscarFaltas(mes, ano),
    buscarFuncionariosParaFalta(),
  ])

  const kpiTotal       = todasFaltas.length
  const kpiSemAtestado = todasFaltas.filter(f => f.tipo === 'sem_atestado').length
  const kpiComAtestado = todasFaltas.filter(f => f.tipo === 'com_atestado').length
  const kpiSuspensao   = todasFaltas.filter(f => f.tipo === 'suspensao').length

  const faltas = searchParams.tipo
    ? todasFaltas.filter(f => f.tipo === searchParams.tipo)
    : todasFaltas

  const anos = [now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Faltas</h1>
        <p className="text-sm text-gray-400">Registro de ausências — {MESES[mes]} {ano}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard label="Total no Mês"  value={kpiTotal}       borderColor="border-t-slate-500"  />
        <KpiCard label="Sem Atestado"  value={kpiSemAtestado} borderColor="border-t-red-500"    />
        <KpiCard label="Com Atestado"  value={kpiComAtestado} borderColor="border-t-amber-500"  />
        <KpiCard label="Suspensões"    value={kpiSuspensao}   borderColor="border-t-purple-500" />
      </div>

      <FaltasClient
        faltas={faltas}
        funcionariosOpt={funcionariosOpt}
        mes={mes}
        ano={ano}
        tipoAtivo={searchParams.tipo ?? ''}
        MESES={MESES}
        anos={anos}
      />
    </div>
  )
}
