import { listarAcordos, buscarPostosParaAcordo } from './actions'
import { AcordosClient } from '@/components/acordos/acordos-client'

export default async function AcordosPage() {
  const [acordos, postos] = await Promise.all([
    listarAcordos(),
    buscarPostosParaAcordo(),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Acordos de Compensação</h1>
        <p className="text-sm text-gray-400">Termos de compensação de horas — geração e arquivo</p>
      </div>

      <AcordosClient acordos={acordos} postos={postos} />
    </div>
  )
}
