import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth/get-user'
import { listarFuncoes } from './actions'
import { FuncoesClient } from './funcoes-client'

export default async function FuncoesPage() {
  const auth = await getUser()
  if (!auth) redirect('/login')
  if (!['admin', 'coordenador'].includes(auth.perfil.role ?? '')) redirect('/dashboard')

  const funcoes = await listarFuncoes()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Funções e Salários</h1>
        <p className="mt-1 text-sm text-gray-500">
          Salário base, insalubridade e periculosidade por função. Benefícios gerenciados separadamente em custos.
        </p>
      </div>

      <FuncoesClient funcoes={funcoes} />
    </div>
  )
}
