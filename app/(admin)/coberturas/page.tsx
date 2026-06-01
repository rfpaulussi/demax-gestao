import { createClient } from '@/lib/supabase/server'
import { CoberturasList } from '@/components/coberturas/coberturas-list'
import type { CoberturaRow } from '@/components/coberturas/coberturas-list'

export default async function CoberturasPage() {
  const supabase = createClient()

  const { data: raw } = await supabase
    .from('coberturas_temporarias')
    .select(`
      id, motivo, data_inicio, data_prev_retorno, urgencia, status,
      funcionarios!funcionario_id ( id, nome, posto_id ),
      posto_destino:postos!posto_destino_id ( id, nome, secretaria ),
      posto_origem:postos!posto_origem_id  ( id, nome, secretaria )
    `)
    .eq('status', 'ativa')
    .order('data_prev_retorno', { ascending: true, nullsFirst: false })

  const coberturas = (raw ?? []) as unknown as CoberturaRow[]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Coberturas Temporárias</h1>
        <p className="text-sm text-gray-400">Coberturas ativas no momento</p>
      </div>

      <CoberturasList coberturas={coberturas} />
    </div>
  )
}
