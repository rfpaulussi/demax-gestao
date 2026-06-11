import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BackButton } from '@/components/ui/back-button'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso + 'T00:00:00')
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR')
}

function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr)
  d.setMonth(d.getMonth() + months)
  return d.toISOString().split('T')[0]
}

function diasParaVencer(limiteGozo: string | null): number | null {
  if (!limiteGozo) return null
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const limite = new Date(limiteGozo + 'T00:00:00')
  return isNaN(limite.getTime())
    ? null
    : Math.ceil((limite.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

type AlertLevel = 'vencido' | 'critico' | 'atencao' | 'ok' | 'neutro'

function getAlertLevel(status: string, limiteGozo: string | null): AlertLevel {
  if (['concluido', 'cancelado', 'em_curso'].includes(status)) return 'neutro'
  const dias = diasParaVencer(limiteGozo)
  if (dias === null) return 'neutro'
  if (dias < 0)   return 'vencido'
  if (dias <= 30) return 'critico'
  if (dias <= 60) return 'atencao'
  return 'ok'
}

// ─── Badge configs ────────────────────────────────────────────────────────────

const STATUS_FERIAS: Record<string, { label: string; cls: string }> = {
  disponivel: { label: 'Disponível', cls: 'bg-slate-100  text-slate-600  ring-slate-200'  },
  agendado:   { label: 'Agendado',   cls: 'bg-blue-100   text-blue-700   ring-blue-200'   },
  aprovado:   { label: 'Aprovado',   cls: 'bg-indigo-100 text-indigo-700 ring-indigo-200' },
  em_curso:   { label: 'Em Curso',   cls: 'bg-green-100  text-green-700  ring-green-200'  },
  concluido:  { label: 'Concluído',  cls: 'bg-gray-100   text-gray-600   ring-gray-200'   },
  cancelado:  { label: 'Cancelado',  cls: 'bg-red-100    text-red-600    ring-red-200'    },
}

const STATUS_FUNC: Record<string, { label: string; cls: string }> = {
  ativo:     { label: 'Ativo',     cls: 'bg-green-50  text-green-700  ring-green-200'  },
  afastado:  { label: 'Afastado',  cls: 'bg-orange-50 text-orange-700 ring-orange-200' },
  ferias:    { label: 'Férias',    cls: 'bg-amber-50  text-amber-700  ring-amber-200'  },
  desligado: { label: 'Desligado', cls: 'bg-gray-100  text-gray-500   ring-gray-200'   },
}

// ─── Alert configs ────────────────────────────────────────────────────────────

type AlertConfig = {
  bg: string; border: string; text: string
  badgeCls: string; icon: string; message: string
}

function buildAlertConfig(level: AlertLevel, dias: number | null): AlertConfig | null {
  const d = dias ?? 0
  switch (level) {
    case 'vencido': return {
      bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700',
      badgeCls: 'bg-red-600 text-white',
      icon: '🔴',
      message: `Vencido há ${Math.abs(d)} dia${Math.abs(d) !== 1 ? 's' : ''}`,
    }
    case 'critico': return {
      bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700',
      badgeCls: 'bg-orange-500 text-white',
      icon: '⚠️',
      message: `${d} dia${d !== 1 ? 's' : ''} restantes`,
    }
    case 'atencao': return {
      bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700',
      badgeCls: 'bg-amber-100 text-amber-800 ring-1 ring-amber-300',
      icon: '⏰',
      message: `${d} dia${d !== 1 ? 's' : ''} restantes`,
    }
    case 'ok': return {
      bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700',
      badgeCls: 'bg-green-100 text-green-800',
      icon: '✓',
      message: `${d} dia${d !== 1 ? 's' : ''} restantes`,
    }
    default: return null
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function FeriasDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = createClient()

  const { data: raw } = await supabase
    .from('ferias')
    .select(`
      id,
      funcionario_id,
      numero_periodo,
      periodo_inicio,
      periodo_fim,
      limite_gozo,
      dias_direito,
      data_inicio,
      data_fim,
      dias_utilizados,
      status,
      observacao,
      funcionarios (
        id,
        nome,
        registro,
        status,
        data_admissao,
        postos!posto_id ( id, nome, secretaria )
      )
    `)
    .eq('id', params.id)
    .single()

  if (!raw) notFound()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = raw as any
  const func  = r.funcionarios
  const posto = func?.postos

  // Supervisor — 2-step, same as buscarFeriasLista
  let supervisorNome = '—'
  if (posto?.id) {
    const { data: cspRows } = await supabase
      .from('config_supervisores_postos')
      .select('perfis!config_supervisores_postos_supervisor_id_fkey(nome)')
      .eq('posto_id', posto.id)
      .eq('ativo', true)
      .limit(1)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nome = (cspRows?.[0] as any)?.perfis?.nome
    if (nome) supervisorNome = nome
  }

  // Derive limite_gozo if missing (periodo_fim + 10 months)
  const limiteGozo: string | null = r.limite_gozo ?? (r.periodo_fim ? addMonths(r.periodo_fim, 10) : null)

  const alertLevel   = getAlertLevel(r.status, limiteGozo)
  const diasRestantes = diasParaVencer(limiteGozo)
  const alertCfg     = buildAlertConfig(alertLevel, diasRestantes)

  const statusF    = STATUS_FERIAS[r.status]
  const statusFunc = func?.status ? STATUS_FUNC[func.status] : null

  const fields: { label: string; value: string }[] = [
    { label: 'Posto',           value: posto?.nome        ?? '—' },
    { label: 'Secretaria',      value: posto?.secretaria  ?? '—' },
    { label: 'Supervisor',      value: supervisorNome             },
    { label: 'Período Nº',      value: r.numero_periodo != null ? `${r.numero_periodo}º` : '—' },
    { label: 'Início do Período', value: fmt(r.periodo_inicio)   },
    { label: 'Fim do Período',  value: fmt(r.periodo_fim)        },
    { label: 'Limite de Gozo',  value: fmt(limiteGozo)           },
    { label: 'Dias de Direito', value: r.dias_direito != null ? String(r.dias_direito) : '—' },
    { label: 'Início das Férias', value: fmt(r.data_inicio)      },
    { label: 'Fim das Férias',  value: fmt(r.data_fim)           },
    { label: 'Dias Utilizados', value: r.dias_utilizados != null ? String(r.dias_utilizados) : '—' },
  ]

  return (
    <div className="space-y-6">
      <BackButton href="/ferias" label="Voltar às Férias" />

      <div>
        <h1 className="text-lg font-bold text-gray-900">Detalhe de Férias</h1>
        <p className="text-sm text-gray-400">Registro completo do período</p>
      </div>

      {/* Employee header */}
      <div className="rounded-xl border border-gray-100 border-t-4 border-t-orange-500 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold text-gray-900">{func?.nome ?? '—'}</h2>
              {statusFunc && (
                <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${statusFunc.cls}`}>
                  {statusFunc.label}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-sm text-gray-400">{func?.registro ?? '—'}</p>
          </div>
          {statusF && (
            <span className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ring-1 ring-inset ${statusF.cls}`}>
              {statusF.label}
            </span>
          )}
        </div>

        <div className="mt-4 border-t border-gray-50 pt-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Admissão</p>
          <p className="mt-0.5 text-sm text-gray-700">{fmt(func?.data_admissao)}</p>
        </div>
      </div>

      {/* Limit alert */}
      {alertCfg && (
        <div className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border ${alertCfg.border} ${alertCfg.bg} px-5 py-4`}>
          <div>
            <p className={`text-sm font-semibold ${alertCfg.text}`}>
              {alertCfg.icon} Limite de Gozo: {fmt(limiteGozo)}
            </p>
            <p className={`mt-0.5 text-xs ${alertCfg.text} opacity-75`}>
              {alertLevel === 'vencido'
                ? 'Prazo de gozo vencido — agendar imediatamente.'
                : 'Atenção ao prazo de gozo deste período.'}
            </p>
          </div>
          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${alertCfg.badgeCls}`}>
            {alertCfg.message}
          </span>
        </div>
      )}

      {/* Detail fields */}
      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
        <div className="border-b border-gray-50 px-6 py-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Detalhes do Período</p>
        </div>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-5 px-6 py-5 sm:grid-cols-3">
          {fields.map(({ label, value }) => (
            <div key={label}>
              <dt className="text-xs font-semibold uppercase tracking-widest text-gray-400">{label}</dt>
              <dd className="mt-1 text-sm text-gray-900">{value}</dd>
            </div>
          ))}
        </dl>

        {r.observacao && (
          <div className="border-t border-gray-50 px-6 py-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Observação</p>
            <p className="mt-1 text-sm text-gray-700">{r.observacao}</p>
          </div>
        )}
      </div>
    </div>
  )
}
