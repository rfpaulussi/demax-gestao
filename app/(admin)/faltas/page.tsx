import { buscarDashFaltas, buscarFaltas, buscarFuncionariosParaFalta } from './actions'
import { FaltasClient } from '@/components/faltas/faltas-client'

const MESES = ['','Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

export default async function FaltasPage({
  searchParams,
}: {
  searchParams: { mes?: string; ano?: string; tipo?: string }
}) {
  const now = new Date()
  const mes = Number(searchParams.mes ?? now.getMonth() + 1)
  const ano = Number(searchParams.ano ?? now.getFullYear())

  const [dash, faltas, funcionariosOpt] = await Promise.all([
    buscarDashFaltas(mes, ano),
    buscarFaltas(mes, ano, searchParams.tipo),
    buscarFuncionariosParaFalta(),
  ])

  const anos = [now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Faltas &amp; Atestados</h1>
        <p className="text-sm text-gray-400">Absenteísmo — {MESES[mes]} {ano}</p>
      </div>
      <FaltasClient
        dash={dash}
        faltas={faltas}
        funcionariosOpt={funcionariosOpt}
        mes={mes}
        ano={ano}
        tipoAtivo={searchParams.tipo ?? ''}
        anos={anos}
      />
    </div>
  )
}
