import { buscarDashFaltas, buscarFaltas, buscarFuncionariosParaFalta } from './actions'
import { FaltasClient } from '@/components/faltas/faltas-client'

const MESES = ['','Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

export default async function FaltasPage({
  searchParams,
}: {
  searchParams: { mes?: string; ano?: string; tipo?: string; periodo?: string }
}) {
  const now = new Date()
  const mes = Number(searchParams.mes ?? now.getMonth() + 1)
  const ano = Number(searchParams.ano ?? now.getFullYear())
  const periodo = Number(searchParams.periodo ?? 1)

  const ultimoDia = new Date(ano, mes, 0).getDate()
  const dataFim = `${ano}-${String(mes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`
  const startDate = new Date(ano, mes - periodo, 1)
  const dataInicio = startDate.toISOString().split('T')[0]

  const [dash, faltas, funcionariosOpt] = await Promise.all([
    buscarDashFaltas(mes, ano),
    buscarFaltas(dataInicio, dataFim, searchParams.tipo),
    buscarFuncionariosParaFalta(),
  ])

  const anos = [now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2]

  const periodoLabel = periodo === 1
    ? `${MESES[mes]} ${ano}`
    : `${MESES[startDate.getMonth() + 1]} – ${MESES[mes]} ${ano}`

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Faltas &amp; Atestados</h1>
          <p className="text-sm text-gray-400">Absenteísmo — {periodoLabel}</p>
        </div>
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          Registre todas as faltas independentemente da duração. O status do funcionário é alterado para <strong>Faltante</strong> automaticamente a partir de <strong>3 dias</strong> de falta consecutivos.
        </p>
      </div>
      <FaltasClient
        dash={dash}
        faltas={faltas}
        funcionariosOpt={funcionariosOpt}
        mes={mes}
        ano={ano}
        tipoAtivo={searchParams.tipo ?? ''}
        anos={anos}
        periodo={periodo}
      />
    </div>
  )
}
