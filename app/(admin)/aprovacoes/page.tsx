import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth/get-user'
import { buscarSolicitacoes } from './actions'
import { AprovacoesList } from '@/components/aprovacoes/aprovacoes-list'
import type { TipoSolicitacao } from '@/types'

// ─── KpiCard ──────────────────────────────────────────────────────────────────

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
      <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-slate-500">{label}</p>
    </div>
  )
}

// ─── Labels de tipo ───────────────────────────────────────────────────────────

const TIPO_LABELS: Record<TipoSolicitacao, string> = {
  desligamento:      'Desligamento',
  transferencia:     'Transferência',
  mudanca_funcao:    'Mudança de Função',
  promocao:          'Promoção',
  mudanca_supervisor:'Mudança de Supervisor',
  alteracao_salario: 'Alteração Salarial',
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AprovacoesPage() {
  const auth = await getUser()
  if (!auth || auth.perfil.role !== 'admin') redirect('/dashboard')

  const todas = await buscarSolicitacoes({})

  const pendentes  = todas.filter(s => s.status === 'pendente')
  const aprovadas  = todas.filter(s => s.status === 'aprovada')
  const rejeitadas = todas.filter(s => s.status === 'rejeitada')

  // Contagem por tipo entre as pendentes
  const porTipo = pendentes.reduce<Partial<Record<TipoSolicitacao, number>>>((acc, s) => {
    acc[s.tipo] = (acc[s.tipo] ?? 0) + 1
    return acc
  }, {})

  const tiposAtivos = (Object.entries(porTipo) as [TipoSolicitacao, number][])
    .sort((a, b) => b[1] - a[1])

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-lg font-bold text-gray-900">Aprovações</h1>
        <p className="text-sm text-slate-400">
          {pendentes.length === 0
            ? 'Nenhuma solicitação pendente'
            : `${pendentes.length} solicitaç${pendentes.length === 1 ? 'ão' : 'ões'} aguardando aprovação`}
        </p>
      </div>

      {/* KPIs principais */}
      <div className="grid grid-cols-3 gap-4">
        <KpiCard label="Pendentes"  value={pendentes.length}  topColor="border-t-amber-400"  />
        <KpiCard label="Aprovadas"  value={aprovadas.length}  topColor="border-t-green-500"  />
        <KpiCard label="Rejeitadas" value={rejeitadas.length} topColor="border-t-red-500"    />
      </div>

      {/* Breakdown por tipo (só exibe se houver pendentes) */}
      {tiposAtivos.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tiposAtivos.map(([tipo, count]) => (
            <span
              key={tipo}
              className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-600 shadow-sm"
            >
              {TIPO_LABELS[tipo]}
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-700">
                {count}
              </span>
            </span>
          ))}
        </div>
      )}

      {/* Lista filtrável */}
      <AprovacoesList solicitacoes={pendentes} />
    </div>
  )
}
