import { getOcorrenciasData, getPostosSimples, getSupervisoresSimples } from './actions'
import { OcorrenciasClient } from '@/components/ocorrencias/ocorrencias-client'

export default async function OcorrenciasPage() {
  const [ocorrencias, postos, supervisores] = await Promise.all([
    getOcorrenciasData(),
    getPostosSimples(),
    getSupervisoresSimples(),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Ocorrências</h1>
        <p className="text-sm text-gray-400">Registro e acompanhamento de ocorrências nos postos</p>
      </div>

      <OcorrenciasClient
        ocorrencias={ocorrencias}
        postos={postos}
        supervisores={supervisores}
      />
    </div>
  )
}
