import { getPostosData } from './actions'
import { PostosClient } from '@/components/postos/postos-client'

export default async function PostosPage() {
  const postos = await getPostosData()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Controle de Postos</h1>
        <p className="text-sm text-gray-400">Visão geral do efetivo por posto de trabalho</p>
      </div>

      <PostosClient postos={postos} />
    </div>
  )
}
