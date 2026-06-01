import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth/get-user'
import { createClient } from '@/lib/supabase/server'
import { OcorrenciasSupervisor } from '@/components/supervisor/ocorrencias-supervisor'
import type { OcorrenciaSupRow } from '@/components/supervisor/ocorrencias-supervisor'

export default async function OcorrenciasSupervisorPage() {
  const auth = await getUser()
  if (!auth) redirect('/login')

  const supabase = createClient()

  const { data: configs } = await supabase
    .from('config_supervisores_postos')
    .select('posto_id, postos!posto_id ( id, nome )')
    .eq('supervisor_id', auth.user.id)
    .eq('ativo', true)

  const postoIds = (configs ?? []).map(c => c.posto_id)
  const postos   = (configs ?? []).map(c => {
    const p = c.postos as unknown as { id: string; nome: string }
    return { id: p.id, nome: p.nome }
  })

  let abertas:    OcorrenciaSupRow[] = []
  let encerradas: OcorrenciaSupRow[] = []

  if (postoIds.length > 0) {
    const { data } = await supabase
      .from('ocorrencias')
      .select(`
        id, descricao, gravidade, status, data_ocorrencia, created_at,
        postos!posto_id ( id, nome )
      `)
      .in('posto_id', postoIds)
      .order('data_ocorrencia', { ascending: false })

    const all = (data ?? []) as OcorrenciaSupRow[]
    abertas    = all.filter(o => o.status === 'aberta' || o.status === 'em_analise')
    encerradas = all.filter(o => o.status === 'encerrada')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Ocorrências</h1>
        <p className="text-sm text-gray-400">Registro de ocorrências nos postos sob sua supervisão</p>
      </div>
      <OcorrenciasSupervisor
        postos={postos}
        abertas={abertas}
        encerradas={encerradas}
      />
    </div>
  )
}
