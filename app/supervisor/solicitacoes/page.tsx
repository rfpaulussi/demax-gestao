import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth/get-user'
import { buscarSolicitacoes } from '@/app/(admin)/aprovacoes/actions'
import { SolicitacoesSupervisor } from '@/components/supervisor/solicitacoes-supervisor'

export default async function SolicitacoesPage() {
  const auth = await getUser()
  if (!auth) redirect('/login')

  const solicitacoes = await buscarSolicitacoes({ supervisor_id: auth.user.id })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Minhas Solicitações</h1>
        <p className="text-sm text-gray-400">
          Acompanhe o status das solicitações enviadas para aprovação
        </p>
      </div>
      <SolicitacoesSupervisor solicitacoes={solicitacoes} />
    </div>
  )
}
