import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth/get-user'
import { createClient } from '@/lib/supabase/server'
import { getPostosData } from './actions'
import { PostosClient } from '@/components/postos/postos-client'

export default async function PostosPage() {
  const auth = await getUser()
  if (!auth) redirect('/login')

  const supabase = createClient()

  const [postos, { data: funcoesRaw }, { data: spRaw }] = await Promise.all([
    getPostosData(),
    supabase.from('funcoes').select('id, nome').order('nome'),
    auth.perfil.role === 'supervisor'
      ? supabase
          .from('config_supervisores_postos')
          .select('posto_id, postos!posto_id ( id, nome, secretaria )')
          .eq('supervisor_id', auth.user.id)
          .eq('ativo', true)
      : Promise.resolve({ data: null }),
  ])

  const funcoes = (funcoesRaw ?? [])
    .filter(f => {
      const n = f.nome.trim().normalize('NFC').toUpperCase()
      return !n.startsWith('SUPERVISOR')
    })
    .map(f => {
      const n = f.nome.trim().normalize('NFC').toUpperCase()
      return {
        id: f.id,
        nome: f.nome,
        allowSMS: (n.startsWith('AGENTE') && n.endsWith(' A')) || n.startsWith('ENCARREGADO'),
      }
    })
  const supervisorPostos = (spRaw ?? []).map((c: unknown) => {
    const row = c as { posto_id: string; postos: { id: string; nome: string; secretaria: string | null } }
    const p = row.postos
    return { id: p.id, nome: p.nome, secretaria: p.secretaria }
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Controle de Postos</h1>
        <p className="text-sm text-gray-400">Visão geral do efetivo por posto de trabalho</p>
      </div>

      <PostosClient
        postos={postos}
        role={auth.perfil.role ?? undefined}
        funcoes={funcoes}
        supervisorPostos={supervisorPostos}
      />
    </div>
  )
}
