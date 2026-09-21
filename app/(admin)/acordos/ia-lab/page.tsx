import { notFound } from 'next/navigation'
import { getUser } from '@/lib/auth/get-user'
import { iaConfigurada } from '@/lib/acordos/ia/cliente'
import { buscarPostosParaAcordo } from '../actions'
import { IaLab } from '@/components/acordos/ia-lab'

export const dynamic = 'force-dynamic'

export default async function IaLabPage() {
  const auth = await getUser()
  if (!auth || auth.perfil.role !== 'admin') notFound()
  const postos = await buscarPostosParaAcordo()
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Laboratório da IA — Acordos</h1>
        <p className="text-sm text-gray-400">
          Teste como a IA interpreta pedidos em texto livre. Dry-run: nada é gravado e nenhum acordo é criado.
        </p>
      </div>
      <IaLab configurada={iaConfigurada()} postos={postos.map(p => ({ id: p.id, nome: p.nome }))} />
    </div>
  )
}
