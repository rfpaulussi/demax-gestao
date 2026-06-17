import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'
import { calcularStatusExperiencia } from '@/lib/experiencia'
import { BannerExperiencia } from '@/components/efetivo/banner-experiencia'
import { PerfilTabs } from '@/components/efetivo/perfil-tabs'
import type { MovimentacaoItem, AdvertenciaItem, SolicitacaoItem } from '@/components/efetivo/perfil-tabs'
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
      id, nome, cpf, status, data_admissao,
      periodo_experiencia, fase_experiencia, data_fim_fase1, data_fim_fase2,
      funcoes!funcao_id ( nome ),
      postos!posto_id ( id, nome, secretaria )
    `)
    .eq('id', id)
    .single()

  if (!func) notFound()

  const postoId = (func as unknown as { postos?: { id: string } }).postos?.id ?? null

  const [
    { data: movRaw },
    { data: advRaw },
    { data: solRaw },
    supervisorResult,
  ] = await Promise.all([
    supabase
      .from('movimentacoes')
      .select('id, tipo, campo_alterado, valor_antes, valor_depois, created_at, solicitacao_id, perfis!executado_por(nome)')
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
  ])

  const movimentacoes = (movRaw ?? []) as unknown as MovimentacaoItem[]
  const advertencias  = (advRaw ?? []) as unknown as AdvertenciaItem[]
  const solicitacoes  = (solRaw ?? []) as unknown as SolicitacaoItem[]

  const supervisorNome =
    (supervisorResult.data as unknown as { perfis?: { nome: string | null } } | null)
      ?.perfis?.nome ?? null

  const f = func as unknown as {
    nome: string
    cpf: string | null
    status: string | null
    data_admissao: string | null
    periodo_experiencia: '30+30' | '45+45' | null
    fase_experiencia: '1' | '2' | 'concluido' | null
    data_fim_fase1: string | null
    data_fim_fase2: string | null
    funcoes: { nome: string } | null
    postos: { nome: string; secretaria: string | null } | null
  }

  const statusBadge = f.status ? STATUS_BADGE[f.status] : null
  const exp = calcularStatusExperiencia(f.periodo_experiencia, f.fase_experiencia, f.data_fim_fase1, f.data_fim_fase2)

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
        </div>
      </div>

      {/* Experiência banner */}
      {exp.emExperiencia && f.periodo_experiencia && (
        <BannerExperiencia
          funcionarioId={id}
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
          funcionario={{
            id:            id,
            nome:          f.nome,
            cpf:           f.cpf,
            funcao:        f.funcoes?.nome ?? null,
            posto:         f.postos?.nome ?? null,
            secretaria:    f.postos?.secretaria ?? null,
            data_admissao: f.data_admissao,
          } satisfies FuncionarioParaPDF}
        />
      </div>

    </div>
  )
}
