import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth/get-user'
import { listarTermos } from '@/lib/termos/listar-termos'
import { MovimentacoesClient } from '@/components/movimentacoes/movimentacoes-client'

export const dynamic = 'force-dynamic'

export default async function MovimentacoesPage() {
  const auth = await getUser()
  if (!auth) redirect('/login')
  const role = auth.perfil.role
  const termos = await listarTermos(90)
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-black tracking-tight text-slate-900">Movimentações</h1>
        <p className="text-xs uppercase tracking-widest text-slate-500">
          Controle de protocolo dos termos no RH
        </p>
      </div>
      <MovimentacoesClient
        termos={termos}
        podeProtocolar={role === 'admin' || role === 'coordenador' || role === 'supervisor'}
        podeDesfazer={role === 'admin' || role === 'coordenador'}
        mostrarSupervisor={role !== 'supervisor'}
      />
    </div>
  )
}
