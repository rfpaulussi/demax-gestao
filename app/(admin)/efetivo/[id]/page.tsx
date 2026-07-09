import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/auth/get-user'
import { cn } from '@/lib/utils'
import { calcularStatusExperiencia } from '@/lib/experiencia'
import { BannerExperiencia } from '@/components/efetivo/banner-experiencia'
import { PerfilTabs } from '@/components/efetivo/perfil-tabs'
import type { MovimentacaoItem, AdvertenciaItem, SolicitacaoItem } from '@/components/efetivo/perfil-tabs'
import type { HorarioVigenteShape, HistoricoHorarioShape } from '@/components/efetivo/tab-horario'
import type { FuncionarioParaPDF } from '@/components/efetivo/movimentacao-pdf'

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmt(iso: string) {
  const [y, m, d] = iso.split('T')[0].split('-')
  return `${d}/${m}/${y}`
}

function maskCPF(cpf: string | null): string {
  if (!cpf) return '—'
  return '***.***.***-**'
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  ativo:     { label: 'Ativo',     className: 'bg-green-50 text-green-700 ring-green-200'    },
  afastado:  { label: 'Afastado',  className: 'bg-orange-50 text-orange-700 ring-orange-200' },
  ferias:    { label: 'Férias',    className: 'bg-amber-50 text-amber-700 ring-amber-200'    },
  desligado: { label: 'Desligado', className: 'bg-gray-100 text-gray-500 ring-gray-200'      },
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default async function PerfilFuncionarioPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = createClient()
  const { id } = params

  const { data: func } = await supabase
    .from('funcionarios')
    .select(`
      id, nome, cpf, status, data_admissao, data_desligamento,
      periodo_experiencia, fase_experiencia, data_fim_fase1, data_fim_fase2,
      funcoes!funcao_id ( nome ),
      postos!posto_id ( id, nome, secretaria )
    `)
    .eq('id', id)
    .single()

  if (!func) notFound()

  const postoId = (func as unknown as { postos?: { id: string } }).postos?.id ?? null

  const auth = await getUser()

  const [
    { data: movRaw },
    { data: advRaw },
    { data: solRaw },
    supervisorResult,
    { data: horarioVigenteRaw },
    { data: historicoRaw },
    { data: escalaRaw },
  ] = await Promise.all([
    supabase
      .from('movimentacoes')
      .select(`
        id, tipo, campo_alterado, valor_antes, valor_depois, created_at, solicitacao_id,
        perfis!executado_por(nome),
        solicitacoes!solicitacao_id(dados_antes, dados_depois, motivo, perfis!supervisor_id(nome))
      `)
      .eq('funcionario_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('advertencias')
      .select('id, tipo, descricao, data_ocorrencia, status')
      .eq('funcionario_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('solicitacoes')
      .select('id, tipo, status, motivo, created_at, observacao_admin, perfis!supervisor_id(nome)')
      .eq('funcionario_id', id)
      .order('created_at', { ascending: false }),
    postoId
      ? supabase
          .from('config_supervisores_postos')
          .select('perfis!supervisor_id(nome, email)')
          .eq('posto_id', postoId)
          .eq('ativo', true)
          .limit(1)
          .single()
      : Promise.resolve({ data: null }),
    // horário vigente
    supabase
      .from('horarios_funcionarios')
      .select(`
        id, data_inicio, data_fim,
        turnos_postos!turno_id(
          id, posto_id, nome,
          hora_entrada, hora_saida_seg_qui, hora_saida_sex,
          hora_inicio_almoco, hora_fim_almoco, ativo
        )
      `)
      .eq('funcionario_id', id)
      .is('data_fim', null)
      .maybeSingle(),
    // histórico de horários (excl. vigente)
    supabase
      .from('horarios_funcionarios')
      .select(`
        id, data_inicio, data_fim,
        turnos_postos!turno_id(
          nome, hora_entrada, hora_saida_seg_qui, hora_saida_sex,
          hora_inicio_almoco, hora_fim_almoco
        )
      `)
      .eq('funcionario_id', id)
      .not('data_fim', 'is', null)
      .order('data_inicio', { ascending: false }),
    // regime do posto
    postoId
      ? supabase.from('config_escalas_postos').select('regime').eq('posto_id', postoId).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  // Resolve nomes de postos e funções a partir dos UUIDs nas movimentações
  function isUUID(v: unknown): v is string {
    return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
  }
  type MovRawItem = { tipo: string; campo_alterado: string | null; valor_antes: string | null; valor_depois: string | null }
  const movList = (movRaw ?? []) as unknown as MovRawItem[]

  const postoIdSet  = new Set<string>()
  const funcaoIdSet = new Set<string>()
  for (const m of movList) {
    if (m.tipo === 'transferencia' && m.campo_alterado === 'posto_id') {
      if (isUUID(m.valor_antes))  postoIdSet.add(m.valor_antes)
      if (isUUID(m.valor_depois)) postoIdSet.add(m.valor_depois)
    }
    if (m.tipo === 'mudanca_funcao') {
      if (isUUID(m.valor_antes))  funcaoIdSet.add(m.valor_antes)
      if (isUUID(m.valor_depois)) funcaoIdSet.add(m.valor_depois)
    }
  }

  const postoNomeMap:  Record<string, string> = {}
  const funcaoNomeMap: Record<string, string> = {}

  await Promise.all([
    postoIdSet.size > 0
      ? supabase.from('postos').select('id, nome').in('id', Array.from(postoIdSet))
          .then(({ data }) => {
            for (const p of (data ?? []) as { id: string; nome: string }[]) postoNomeMap[p.id] = p.nome
          })
      : Promise.resolve(),
    funcaoIdSet.size > 0
      ? supabase.from('funcoes').select('id, nome').in('id', Array.from(funcaoIdSet))
          .then(({ data }) => {
            for (const f of (data ?? []) as { id: string; nome: string }[]) funcaoNomeMap[f.id] = f.nome
          })
      : Promise.resolve(),
  ])

  const movimentacoes = (movRaw ?? []) as unknown as MovimentacaoItem[]
  const advertencias  = (advRaw ?? []) as unknown as AdvertenciaItem[]
  const solicitacoes  = (solRaw ?? []) as unknown as SolicitacaoItem[]

  const supervisorNome =
    (supervisorResult.data as unknown as { perfis?: { nome: string | null } } | null)
      ?.perfis?.nome ?? null

  const horarioVigente   = horarioVigenteRaw as unknown as HorarioVigenteShape
  const historicoHorario = (historicoRaw ?? []) as unknown as HistoricoHorarioShape
  const regimePosto      = (escalaRaw as unknown as { regime?: string } | null)?.regime ?? null
  const role             = auth?.perfil.role ?? null

  const f = func as unknown as {
    nome: string
    cpf: string | null
    status: string | null
    data_admissao: string | null
    data_desligamento: string | null
    periodo_experiencia: '30+30' | '45+45' | null
    fase_experiencia: '1' | '2' | 'concluido' | null
    data_fim_fase1: string | null
    data_fim_fase2: string | null
    funcoes: { nome: string } | null
    postos: { nome: string; secretaria: string | null } | null
  }

  const statusBadge = f.status ? STATUS_BADGE[f.status] : null
  const exp = calcularStatusExperiencia(f.data_admissao, f.periodo_experiencia)

  return (
    <div className="space-y-6">

      {/* Back */}
      <Link
        href="/efetivo"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 transition-colors hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar ao Efetivo
      </Link>

      {/* Header */}
      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{f.nome}</h1>
              {statusBadge && (
                <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset', statusBadge.className)}>
                  {statusBadge.label}
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-gray-500">CPF: {maskCPF(f.cpf)}</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-2 text-sm lg:grid-cols-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Função</p>
            <p className="text-gray-900">{f.funcoes?.nome ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Posto</p>
            <p className="text-gray-900">{f.postos?.nome ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Secretaria</p>
            <p className="text-gray-900">{f.postos?.secretaria ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Supervisor</p>
            <p className="text-gray-900">{supervisorNome ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Admissão</p>
            <p className="text-gray-900">{f.data_admissao ? fmt(f.data_admissao) : '—'}</p>
          </div>
          {f.data_desligamento && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Desligamento</p>
              <p className="text-red-600 font-medium">{fmt(f.data_desligamento)}</p>
            </div>
          )}
        </div>
      </div>

      {/* Experiência banner */}
      {exp.emExperiencia && f.periodo_experiencia && (
        <BannerExperiencia
          exp={exp}
          periodo={f.periodo_experiencia}
        />
      )}

      {/* Tabs */}
      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <PerfilTabs
          movimentacoes={movimentacoes}
          advertencias={advertencias}
          solicitacoes={solicitacoes}
          postoNomeMap={postoNomeMap}
          funcaoNomeMap={funcaoNomeMap}
          horarioVigente={horarioVigente}
          historicoHorario={historicoHorario}
          regimePosto={regimePosto}
          postoId={postoId}
          role={role}
          funcionario={{
            id:            id,
            nome:          f.nome,
            cpf:           f.cpf,
            funcao:        f.funcoes?.nome ?? null,
            posto:         f.postos?.nome ?? null,
            secretaria:    f.postos?.secretaria ?? null,
            data_admissao: f.data_admissao,
            supervisor:    supervisorNome,
          } satisfies FuncionarioParaPDF}
        />
      </div>

    </div>
  )
}
