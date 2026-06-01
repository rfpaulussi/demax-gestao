import { createClient } from '@/lib/supabase/server'
import { MedicaoTable } from '@/components/medicao/medicao-table'
import type { MedicaoRow } from '@/components/medicao/medicao-table'

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
    <div className={`rounded-xl border border-gray-100 border-t-4 bg-white p-5 shadow-sm ${topColor}`}>
      <p className="text-4xl font-black tracking-tight text-gray-900">{value}</p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-gray-400">{label}</p>
    </div>
  )
}

function toSituacao(diff: number): MedicaoRow['situacao'] {
  if (diff === 0) return 'completo'
  return diff < 0 ? 'deficit' : 'excesso'
}

export default async function MedicaoPage() {
  const supabase = createClient()

  const now = new Date()
  const mesReferencia = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split('T')[0]

  const { data: logs } = await supabase
    .from('logs_alocacoes_mensais')
    .select(`
      posto_id, efetivo_previsto, efetivo_real,
      postos!posto_id ( id, nome, secretaria )
    `)
    .eq('mes_referencia', mesReferencia)

  let rows: MedicaoRow[]
  let temSnapshot: boolean

  if (logs && logs.length > 0) {
    temSnapshot = true
    rows = logs.map(l => {
      const posto = l.postos as { id: string; nome: string; secretaria: string | null } | null
      const prev = l.efetivo_previsto ?? 0
      const real = l.efetivo_real ?? 0
      const diff = real - prev
      return {
        posto_id:         l.posto_id,
        posto_nome:       posto?.nome ?? '—',
        secretaria:       posto?.secretaria ?? null,
        efetivo_previsto: prev,
        efetivo_real:     real,
        diferenca:        diff,
        situacao:         toSituacao(diff),
      }
    })
  } else {
    temSnapshot = false
    const [{ data: postos }, { data: funcionarios }] = await Promise.all([
      supabase
        .from('postos')
        .select('id, nome, secretaria, efetivo_previsto')
        .eq('ativo', true),
      supabase
        .from('funcionarios')
        .select('posto_id')
        .eq('status', 'ativo'),
    ])

    const byPosto = new Map<string, number>()
    for (const f of funcionarios ?? []) {
      if (!f.posto_id) continue
      byPosto.set(f.posto_id, (byPosto.get(f.posto_id) ?? 0) + 1)
    }

    rows = (postos ?? []).map(p => {
      const prev = p.efetivo_previsto ?? 0
      const real = byPosto.get(p.id) ?? 0
      const diff = real - prev
      return {
        posto_id:         p.id,
        posto_nome:       p.nome,
        secretaria:       p.secretaria ?? null,
        efetivo_previsto: prev,
        efetivo_real:     real,
        diferenca:        diff,
        situacao:         toSituacao(diff),
      }
    })
  }

  rows.sort((a, b) => a.posto_nome.localeCompare(b.posto_nome, 'pt-BR'))

  const total    = rows.length
  const completo = rows.filter(r => r.situacao === 'completo').length
  const deficit  = rows.filter(r => r.situacao === 'deficit').length
  const excesso  = rows.filter(r => r.situacao === 'excesso').length

  const secretarias = Array.from(
    new Set(rows.map(r => r.secretaria).filter((s): s is string => Boolean(s))),
  ).sort()

  const mesLabel = new Date(`${mesReferencia}T12:00:00`).toLocaleDateString('pt-BR', {
    month: 'long',
    year:  'numeric',
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Medição Mensal</h1>
        <p className="text-sm text-gray-400">
          {temSnapshot
            ? `Snapshot salvo — ${mesLabel}`
            : `Dados em tempo real — nenhum snapshot para ${mesLabel}`}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <CounterCard label="Total de Postos" value={total}    topColor="border-t-gray-400"   />
        <CounterCard label="Completos"        value={completo} topColor="border-t-green-500"  />
        <CounterCard label="Em Déficit"       value={deficit}  topColor="border-t-red-500"    />
        <CounterCard label="Em Excesso"       value={excesso}  topColor="border-t-indigo-500" />
      </div>

      <MedicaoTable rows={rows} secretarias={secretarias} />
    </div>
  )
}
