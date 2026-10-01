import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth/get-user'
import { createClient } from '@/lib/supabase/server'
import { buscarSolicitacoes } from './actions'
import { calcularImpactoPosto } from '@/app/(admin)/efetivo/impacto'
import type { ImpactoResult } from '@/app/(admin)/efetivo/impacto'
import { AprovacoesList } from '@/components/aprovacoes/aprovacoes-list'
import { AprovacoesFiltros } from '@/components/aprovacoes/aprovacoes-filtros'
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
  mudanca_horario:     'Mudança de Horário',
  lancamento_atestado: 'Lançamento de Atestado',
  correcao_atestado:   'Correção de Atestado',
}

// ─── Filtros (URL) ────────────────────────────────────────────────────────────

type SearchParams = Record<string, string | string[] | undefined>

function param(sp: SearchParams, k: string): string {
  const v = sp[k]
  return (Array.isArray(v) ? v[0] : v) ?? ''
}

const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const diaBRT = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })

function resolverPeriodo(periodo: string, de: string, ate: string): { de: string; ate: string } {
  const hoje = new Date()
  const fim = diaBRT(hoje)
  if (periodo === 'hoje') return { de: fim, ate: fim }
  if (periodo === '7d')   return { de: diaBRT(new Date(hoje.getTime() - 6 * 86_400_000)), ate: fim }
  if (periodo === '30d')  return { de: diaBRT(new Date(hoje.getTime() - 29 * 86_400_000)), ate: fim }
  if (periodo === 'mes')  return { de: fim.slice(0, 8) + '01', ate: fim }
  if (periodo === 'custom') return { de, ate }
  return { de: '', ate: '' }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AprovacoesPage({ searchParams }: { searchParams: SearchParams }) {
  const auth = await getUser()
  if (!auth) redirect('/dashboard')

  const isSupervisor = auth.perfil.role === 'supervisor'
  const canApprove   = auth.perfil.role === 'admin'

  // Supervisor vê só as próprias solicitações (todos os status)
  // Admin/coordenador vê todas
  const filtros = isSupervisor ? { supervisor_id: auth.user.id } : {}
  const todas = await buscarSolicitacoes(filtros)

  // Só precisa pro admin corrigir a função de uma admissão pendente antes de aprovar.
  const funcoes = canApprove
    ? (await createClient().from('funcoes').select('id, nome').order('nome')).data ?? []
    : []

  // Filtros só para admin/coordenador (supervisor vê a própria lista inteira)
  const fStatus     = isSupervisor ? '' : param(searchParams, 'status') || 'pendente'
  const fSupervisor = param(searchParams, 'supervisor')
  const fSecretaria = param(searchParams, 'secretaria')
  const fPosto      = param(searchParams, 'posto')
  const fTipo       = param(searchParams, 'tipo')
  const fBusca      = semAcento(param(searchParams, 'q').trim())
  const { de, ate } = resolverPeriodo(param(searchParams, 'periodo'), param(searchParams, 'de'), param(searchParams, 'ate'))

  const base = isSupervisor ? todas : todas.filter(s => {
    if (fSupervisor && s.supervisor_id !== fSupervisor) return false
    if (fTipo && s.tipo !== fTipo) return false
    const posto = s.funcionarios?.postos
    if (fSecretaria && posto?.secretaria !== fSecretaria) return false
    if (fPosto && posto?.id !== fPosto) return false
    if (fBusca && !semAcento(s.funcionarios?.nome ?? '').includes(fBusca)) return false
    if (de || ate) {
      const dia = s.created_at ? diaBRT(new Date(s.created_at)) : ''
      if (!dia || (de && dia < de) || (ate && dia > ate)) return false
    }
    return true
  })

  const pendentes  = base.filter(s => s.status === 'pendente')
  const aprovadas  = base.filter(s => s.status === 'aprovada')
  const rejeitadas = base.filter(s => s.status === 'rejeitada')

  const visiveis = isSupervisor || fStatus === 'todas' ? base
    : base.filter(s => s.status === fStatus)

  // Opções dos filtros (a partir de todas as solicitações)
  const supMap = new Map<string, string>()
  const postoMap = new Map<string, string>()
  const secSet = new Set<string>()
  for (const s of todas) {
    if (s.supervisor_id) supMap.set(s.supervisor_id, s.perfis?.nome ?? s.perfis?.email ?? 'Supervisor')
    const posto = s.funcionarios?.postos
    if (posto) { postoMap.set(posto.id, posto.nome); if (posto.secretaria) secSet.add(posto.secretaria) }
  }
  const byNome = (a: { nome: string }, b: { nome: string }) => a.nome.localeCompare(b.nome, 'pt-BR')
  const opcoes = {
    supervisores: Array.from(supMap, ([id, nome]) => ({ id, nome })).sort(byNome),
    secretarias: Array.from(secSet).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    postos: Array.from(postoMap, ([id, nome]) => ({ id, nome })).sort(byNome),
    tipos: (Object.keys(TIPO_LABELS) as TipoSolicitacao[]).map(value => ({ value, label: TIPO_LABELS[value] })),
  }

  // Pré-calcula impacto para os tipos que afetam efetivo de posto
  const TIPOS_COM_IMPACTO: TipoSolicitacao[] = ['transferencia', 'mudanca_funcao', 'desligamento', 'retorno_afastamento']
  const impactos: Record<string, ImpactoResult> = {}
  await Promise.all(
    visiveis
      .filter(s => s.status === 'pendente' && TIPOS_COM_IMPACTO.includes(s.tipo) && s.funcionario_id)
      .map(async s => {
        const fid = s.funcionario_id!
        const params =
          s.tipo === 'transferencia'
            ? {
                funcionario_id:   fid,
                posto_destino_id: s.dados_depois?.posto_destino_id as string | undefined,
                nova_funcao_nome: s.dados_depois?.nova_funcao_nome as string | undefined,
              }
          : s.tipo === 'mudanca_funcao'
            ? {
                funcionario_id:  fid,
                nova_funcao_nome: s.dados_depois?.funcao_destino_nome as string | undefined,
              }
          : s.tipo === 'retorno_afastamento'
            ? {
                funcionario_id:   fid,
                posto_destino_id: (s.dados_depois?.posto_retorno_id as string | undefined) ?? (s.dados_antes?.posto_id as string | undefined),
                apenas_entrada:   true,
              }
          : { funcionario_id: fid } // desligamento
        const r = await calcularImpactoPosto(params)
        if (r) impactos[s.id] = r
      })
  )

  // Contagem por tipo entre as pendentes
  const porTipo = visiveis.filter(s => s.status === 'pendente').reduce<Partial<Record<TipoSolicitacao, number>>>((acc, s) => {
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
            : `${pendentes.length} solicitaç${pendentes.length === 1 ? 'ão' : 'ões'} aguardando aprovação${base.length !== todas.length ? ' (com filtros)' : ''}`}
        </p>
      </div>

      {/* KPIs principais */}
      <div className="grid grid-cols-3 gap-3">
        <KpiCard label="Pendentes"  value={pendentes.length}  topColor="border-t-amber-400"  />
        <KpiCard label="Aprovadas"  value={aprovadas.length}  topColor="border-t-green-500"  />
        <KpiCard label="Rejeitadas" value={rejeitadas.length} topColor="border-t-red-500"    />
      </div>

      {!isSupervisor && <AprovacoesFiltros opcoes={opcoes} />}

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
        solicitacoes={visiveis}
        canApprove={canApprove}
        impactos={impactos}
        funcoes={funcoes}
        exportar={!isSupervisor}
      />
    </div>
  )
}
