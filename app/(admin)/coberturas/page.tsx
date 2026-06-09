import { createClient } from '@/lib/supabase/server'
import { CoberturasList } from '@/components/coberturas/coberturas-list'
import type { CoberturaRow } from '@/components/coberturas/coberturas-list'

// ─── KPI card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  topColor,
}: {
  label: string
  value: number
  topColor: string
}) {
  return (
    <div className={`rounded-xl border border-gray-100 border-t-4 bg-white p-5 shadow-sm ${topColor}`}>
      <p className="text-4xl font-black tracking-tight text-gray-900">{value}</p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-gray-400">{label}</p>
    </div>
  )
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function calcUrgKey(dataPrevRetorno: string | null): 'red' | 'orange' | 'purple' | 'gray' {
  if (!dataPrevRetorno) return 'gray'
  const hoje = new Date()
  const hojeDate = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())
  const [y, m, d] = dataPrevRetorno.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  const diff = Math.ceil((dt.getTime() - hojeDate.getTime()) / 86_400_000)
  if (diff <= 1) return 'red'
  if (diff <= 3) return 'orange'
  return 'purple'
}

// ─── page ─────────────────────────────────────────────────────────────────────

const COB_SELECT = `
  id, motivo, data_inicio, data_prev_retorno, data_retorno_real, urgencia, status,
  funcionarios!funcionario_id ( id, nome, posto_id ),
  posto_destino:postos!posto_destino_id ( id, nome, secretaria ),
  posto_origem:postos!posto_origem_id  ( id, nome, secretaria )
`

export default async function CoberturasPage() {
  const supabase = createClient()

  const [{ data: ativasRaw }, { data: encerradasRaw }] = await Promise.all([
    supabase
      .from('coberturas_temporarias')
      .select(COB_SELECT)
      .eq('status', 'ativa')
      .order('data_prev_retorno', { ascending: true, nullsFirst: false }),
    supabase
      .from('coberturas_temporarias')
      .select(COB_SELECT)
      .eq('status', 'encerrada')
      .order('data_retorno_real', { ascending: false })
      .limit(50),
  ])

  const coberturas = (ativasRaw ?? []) as unknown as CoberturaRow[]
  const historico  = (encerradasRaw ?? []) as unknown as CoberturaRow[]

  const urgente = coberturas.filter(c => calcUrgKey(c.data_prev_retorno) === 'red').length
  const atencao = coberturas.filter(c => calcUrgKey(c.data_prev_retorno) === 'orange').length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Coberturas Temporárias</h1>
        <p className="text-sm text-gray-400">Coberturas ativas no momento</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Ativas"       value={coberturas.length} topColor="border-t-indigo-500" />
        <KpiCard label="Urgente"      value={urgente}           topColor="border-t-red-500"    />
        <KpiCard label="Atenção"      value={atencao}           topColor="border-t-orange-500" />
        <KpiCard label="Encerradas"   value={historico.length}  topColor="border-t-gray-400"   />
      </div>

      <CoberturasList coberturas={coberturas} historico={historico} />
    </div>
  )
}
