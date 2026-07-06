import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth/get-user'
import { buscarSolicitacoes } from './actions'
import { calcularImpactoPosto } from '@/app/(admin)/efetivo/impacto'
import type { ImpactoResult } from '@/app/(admin)/efetivo/impacto'
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
    <div className={`rounded-xl border border-gray-100 border-t-4 bg-white p-3 shadow-sm ${topColor}`}>
      <p className="text-2xl font-black tracking-tight text-gray-900">{value}</p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-slate-500">{label}</p>
    </div>
  )
}

// ─── Labels de tipo ───────────────────────────────────────────────────────────

const TIPO_LABELS: Record<TipoSolicitacao, string> = {
  desligamento:        'Desligamento',
  transferencia:       'Transferência',
  mudanca_funcao:      'Mudança de Função',
  promocao:            'Promoção',
  mudanca_supervisor:  'Mudança de Supervisor',
  alteracao_salario:   'Alteração Salarial',
  afastamento:         'Afastamento',
  retorno_afastamento: 'Retorno de Afastamento',
  rescisao_indireta:   'Rescisão Indireta',
  admissao:            'Admissão',
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AprovacoesPage() {
  const auth = await getUser()
  if (!auth) redirect('/dashboard')

  const isSupervisor = auth.perfil.role === 'supervisor'
  const canApprove   = auth.perfil.role === 'admin'

  // Supervisor vê só as próprias solicitações (todos os status)
  // Admin/coordenador vê todas
  const filtros = isSupervisor ? { supervisor_id: auth.user.id } : {}
  const todas = await buscarSolicitacoes(filtros)

  const pendentes  = todas.filter(s => s.status === 'pendente')
  const aprovadas  = todas.filter(s => s.status === 'aprovada')
  const rejeitadas = todas.filter(s => s.status === 'rejeitada')

  // Pré-calcula impacto para transferências e mudanças de função pendentes
  const impactos: Record<string, ImpactoResult> = {}
  await Promise.all(
    pendentes
      .filter(s => (s.tipo === 'transferencia' || s.tipo === 'mudanca_funcao') && s.funcionario_id)
      .map(async s => {
        const fid = s.funcionario_id!
        const params = s.tipo === 'transferencia'
          ? {
              funcionario_id:   fid,
              posto_destino_id: s.dados_depois?.posto_destino_id as string | undefined,
              nova_funcao_nome: s.dados_depois?.nova_funcao_nome as string | undefined,
            }
          : {
              funcionario_id:  fid,
              nova_funcao_nome: s.dados_depois?.funcao_destino_nome as string | undefined,
            }
        const r = await calcularImpactoPosto(params)
        if (r) impactos[s.id] = r
      })
  )

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
        <h1 className="text-lg font-bold text-gray-900">
          {isSupervisor ? 'Minhas Solicitações' : 'Aprovações'}
        </h1>
        <p className="text-sm text-slate-400">
          {isSupervisor
            ? `${todas.length} solicitaç${todas.length === 1 ? 'ão' : 'ões'} enviada${todas.length === 1 ? '' : 's'}`
            : pendentes.length === 0
              ? 'Nenhuma solicitação pendente'
              : `${pendentes.length} solicitaç${pendentes.length === 1 ? 'ão' : 'ões'} aguardando aprovação`}
        </p>
      </div>

      {/* KPIs principais */}
      <div className="grid grid-cols-3 gap-3">
        <KpiCard label="Pendentes"  value={pendentes.length}  topColor="border-t-amber-400"  />
        <KpiCard label="Aprovadas"  value={aprovadas.length}  topColor="border-t-green-500"  />
        <KpiCard label="Rejeitadas" value={rejeitadas.length} topColor="border-t-red-500"    />
      </div>

      {/* Breakdown por tipo (só exibe se houver pendentes e for admin) */}
      {!isSupervisor && tiposAtivos.length > 0 && (
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

      {/* Lista — supervisor vê todas, admin vê só pendentes com ação */}
      <AprovacoesList
        solicitacoes={isSupervisor ? todas : pendentes}
        canApprove={canApprove}
        impactos={impactos}
      />
    </div>
  )
}
