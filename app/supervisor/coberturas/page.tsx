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

  let coberturas: CoberturaSupRow[] = []
  if (postoIds.length > 0) {
    const { data } = await supabase
      .from('coberturas_temporarias')
      .select(`
        id, data_inicio, data_prev_retorno, urgencia, status,
        funcionarios!funcionario_id ( nome ),
        posto_destino:postos!posto_destino_id ( nome ),
        posto_origem:postos!posto_origem_id ( nome )
      `)
      .or(
        `posto_destino_id.in.(${postoIds.join(',')}),posto_origem_id.in.(${postoIds.join(',')})`,
      )
      .eq('status', 'ativa')
      .order('data_prev_retorno', { ascending: true, nullsFirst: false })

    coberturas = (data ?? []).map(d => {
      const r = d as unknown as {
        id: string
        data_inicio: string | null
        data_prev_retorno: string | null
        urgencia: string | null
        status: string | null
        funcionarios: { nome: string } | null
        posto_destino: { nome: string } | null
        posto_origem: { nome: string } | null
      }
      return {
        id: r.id,
        funcionario_nome: r.funcionarios?.nome ?? '—',
        posto_destino_nome: r.posto_destino?.nome ?? '—',
        posto_origem_nome: r.posto_origem?.nome ?? null,
        data_inicio: r.data_inicio ?? '',
        data_prev_retorno: r.data_prev_retorno,
        urgencia: r.urgencia ?? 'baixa',
        status: r.status ?? 'ativa',
      }
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Coberturas</h1>
        <p className="text-sm text-gray-400">
          Coberturas ativas nos postos sob sua supervisão
        </p>
      </div>
      <CoberturasSupervisor coberturas={coberturas} postoIds={postoIds} />
    </div>
  )
}
