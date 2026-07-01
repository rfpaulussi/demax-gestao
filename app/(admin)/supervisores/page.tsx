import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth/get-user'
import { createClient } from '@/lib/supabase/server'
import { SupervisoresClient } from '@/components/supervisores/supervisores-client'
import type { SupervisorComPostos, PostoOpcao } from '@/components/supervisores/supervisores-client'

export default async function SupervisoresPage() {
  const auth = await getUser()
  if (!auth || auth.perfil.role !== 'admin') redirect('/dashboard')

  const supabase = createClient()

  const [{ data: perfisRaw }, { data: vinculosRaw }, { data: postosRaw }] = await Promise.all([
    // Supervisores
    supabase
      .from('perfis')
      .select('id, nome, email, ativo')
      .eq('role', 'supervisor')
      .order('nome'),

    // Vínculos ativos supervisor → posto
    supabase
      .from('config_supervisores_postos')
      .select('supervisor_id, postos!posto_id(id, nome, secretaria)')
      .eq('ativo', true),

    // Todos os postos
    supabase
      .from('postos')
      .select('id, nome, secretaria')
      .order('nome'),
  ])

  type PerfisRow = { id: string; nome: string | null; email: string | null; ativo: boolean | null }
  type VinculoRow = { supervisor_id: string; postos: { id: string; nome: string; secretaria: string | null } | null }

  const perfis = (perfisRaw ?? []) as PerfisRow[]
  const vinculos = (vinculosRaw ?? []) as unknown as VinculoRow[]
  const todosPostos = (postosRaw ?? []) as PostoOpcao[]

  // Agrupa postos por supervisor
  const postosPorSupervisor: Record<string, { id: string; nome: string; secretaria: string | null }[]> = {}
  for (const v of vinculos) {
    if (!v.postos) continue
    if (!postosPorSupervisor[v.supervisor_id]) postosPorSupervisor[v.supervisor_id] = []
    postosPorSupervisor[v.supervisor_id].push(v.postos)
  }

  const supervisores: SupervisorComPostos[] = perfis.map(p => ({
    id:     p.id,
    nome:   p.nome,
    email:  p.email,
    ativo:  p.ativo,
    postos: postosPorSupervisor[p.id] ?? [],
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Gestão de Supervisores</h1>
        <p className="mt-1 text-sm text-gray-500">
          Vincule postos a supervisores, redistribua responsabilidades ou transfira postos entre supervisores.
        </p>
      </div>

      <SupervisoresClient supervisores={supervisores} todosPostos={todosPostos} />
    </div>
  )
}
