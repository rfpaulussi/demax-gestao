import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth/get-user'
import { createClient } from '@/lib/supabase/server'
import { UsuariosTable } from '@/components/usuarios/usuarios-table'
import type { Perfil } from '@/types'

function CounterCard({
  label,
  value,
  topColor,
}: {
  label: string
  value: number
  topColor: string
}) {
  return (
    <div className={`rounded-xl border border-gray-100 border-t-4 bg-white p-3 shadow-sm ${topColor}`}>
      <p className="text-2xl font-black tracking-tight text-gray-900">{value}</p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-gray-400">{label}</p>
    </div>
  )
}

export default async function UsuariosPage() {
  const auth = await getUser()
  if (!auth || auth.perfil.role !== 'admin') redirect('/dashboard')

  const supabase = createClient()

  const { data: perfis } = await supabase
    .from('perfis')
    .select('*')
    .order('created_at', { ascending: true })

  const todos   = (perfis ?? []) as Perfil[]
  const ativos  = todos.filter(p => p.ativo).length
  const inativos = todos.filter(p => !p.ativo).length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Usuários</h1>
        <p className="text-sm text-gray-400">Gestão de acessos ao sistema</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <CounterCard label="Total"    value={todos.length} topColor="border-t-gray-400"   />
        <CounterCard label="Ativos"   value={ativos}       topColor="border-t-green-500"  />
        <CounterCard label="Inativos" value={inativos}     topColor="border-t-red-500"    />
      </div>

      <UsuariosTable perfis={todos} currentUserId={auth.user.id} />
    </div>
  )
}
