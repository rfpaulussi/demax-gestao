import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth/get-user'
import { createClient } from '@/lib/supabase/server'
import { buscarSolicitacoes } from '@/app/(admin)/aprovacoes/actions'
import { SolicitacoesSupervisor } from '@/components/supervisor/solicitacoes-supervisor'

export default async function SolicitacoesPage() {
  const auth = await getUser()
  if (!auth) redirect('/login')

  const supabase = createClient()

  const [solicitacoes, { data: configRaw }, { data: funcoesRaw }] = await Promise.all([
    buscarSolicitacoes({ supervisor_id: auth.user.id }),
    supabase
      .from('config_supervisores_postos')
      .select('postos!posto_id ( id, nome, secretaria )')
      .eq('supervisor_id', auth.user.id)
      .eq('ativo', true),
    supabase.from('funcoes').select('id, nome').order('nome'),
  ])

  type PostoRaw = { id: string; nome: string; secretaria: string | null }
  const postos = (configRaw ?? [])
    .map(c => (c.postos as unknown as PostoRaw | null))
    .filter((p): p is PostoRaw => p !== null)

  const funcoes = (funcoesRaw ?? [])
    .filter(f => !f.nome.toUpperCase().startsWith('SUPERVISOR'))
    .map(f => ({
      id: f.id,
      nome: f.nome,
      allowSMS: f.nome === 'AGENTE DE HIGIENIZAÇÃO A' || f.nome.toUpperCase().startsWith('ENCARREGADO'),
    }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Minhas Solicitações</h1>
        <p className="text-sm text-gray-400">
          Acompanhe o status das solicitações enviadas para aprovação
        </p>
      </div>
      <SolicitacoesSupervisor
        solicitacoes={solicitacoes}
        postos={postos}
        funcoes={funcoes}
      />
    </div>
  )
}
