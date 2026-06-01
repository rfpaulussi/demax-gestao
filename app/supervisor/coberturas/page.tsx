import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth/get-user'
import { createClient } from '@/lib/supabase/server'
import { CoberturasSupervisor } from '@/components/supervisor/coberturas-supervisor'
import type { CoberturaSupRow } from '@/components/supervisor/coberturas-supervisor'

export default async function CoberturasSupervisorPage() {
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

  let coberturas: CoberturaSupRow[] = []
  if (postoIds.length > 0) {
    const { data } = await supabase
      .from('coberturas_temporarias')
      .select(`
        id, motivo, data_inicio, data_prev_retorno, urgencia, status,
        funcionarios!funcionario_id ( id, nome, posto_id ),
        posto_destino:postos!posto_destino_id ( id, nome, secretaria ),
        posto_origem:postos!posto_origem_id   ( id, nome, secretaria )
      `)
      .or(
        `posto_destino_id.in.(${postoIds.join(',')}),posto_origem_id.in.(${postoIds.join(',')})`,
      )
      .eq('status', 'ativa')
      .order('data_prev_retorno', { ascending: true, nullsFirst: false })

    coberturas = (data ?? []) as CoberturaSupRow[]
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Coberturas</h1>
        <p className="text-sm text-gray-400">
          Coberturas ativas nos postos sob sua supervisão
        </p>
      </div>
      <CoberturasSupervisor coberturas={coberturas} postos={postos} />
    </div>
  )
}
