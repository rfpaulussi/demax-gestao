import { cn } from '@/lib/utils'
import { calcularFechamento } from './actions'
import { FechamentoClient } from '@/components/fechamento/fechamento-client'

function KpiCard({ label, value, sub, borderColor }: { label: string; value: number | string; sub?: string; borderColor: string }) {
  return (
    <div className={cn('rounded-xl border border-gray-100 border-t-4 bg-white p-5 shadow-sm', borderColor)}>
      <p className="text-2xl font-black tracking-tight text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
      <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-gray-400">{label}</p>
    </div>
  )
}

const MESES = ['','Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

export default async function FechamentoPage({
  searchParams,
}: {
  searchParams: { mes?: string; ano?: string; secretaria?: string }
}) {
  const now = new Date()
  const mes = Number(searchParams.mes ?? now.getMonth() + 1)
  const ano = Number(searchParams.ano ?? now.getFullYear())

  const todos = await calcularFechamento(mes, ano)

  const dados = searchParams.secretaria
    ? todos.filter(f => f.secretaria === searchParams.secretaria)
    : todos

  const secretarias = Array.from(
    new Set(todos.map(f => f.secretaria).filter((s): s is string => Boolean(s)))
  ).sort()

  const kpiTotal         = dados.length
  const kpiDeducoes      = dados.filter(f => f.ferias_dias > 0 || f.faltas_dias > 0 || f.atestados_dias > 0 || f.afastamento_dias > 0 || f.dias_suspensao > 0).length
  const kpiSuspensao     = dados.filter(f => f.tem_suspensao).length
  const kpiInsalubridade = dados.filter(f => f.insalubridade_dias > 0).length

  const anos = [now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Fechamento</h1>
        <p className="text-sm text-gray-400">Apuração de dias trabalhados — {MESES[mes]} {ano}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Funcionários"      value={kpiTotal}         borderColor="border-t-slate-500"  />
        <KpiCard label="Com Deduções"      value={kpiDeducoes}      borderColor="border-t-amber-500"  />
        <KpiCard label="Com Suspensão"     value={kpiSuspensao}     borderColor="border-t-red-500"    />
        <KpiCard label="Com Insalubridade" value={kpiInsalubridade} borderColor="border-t-purple-500" />
      </div>

      <FechamentoClient
        dados={dados}
        mes={mes}
        ano={ano}
        secretariaAtiva={searchParams.secretaria ?? ''}
        secretarias={secretarias}
        MESES={MESES}
        anos={anos}
      />
    </div>
  )
}
