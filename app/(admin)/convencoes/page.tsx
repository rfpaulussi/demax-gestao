import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, FileText, CheckCircle2, Clock, AlertCircle } from 'lucide-react'
import { getUser } from '@/lib/auth/get-user'
import { listarConvencoes } from './actions'
import { cn } from '@/lib/utils'

const STATUS_CFG = {
  rascunho:  { label: 'Rascunho',  cls: 'bg-slate-100 text-slate-600 ring-slate-200',  icon: Clock         },
  publicada: { label: 'Publicada', cls: 'bg-blue-50 text-blue-700 ring-blue-200',      icon: AlertCircle   },
  aplicada:  { label: 'Aplicada',  cls: 'bg-green-50 text-green-700 ring-green-200',   icon: CheckCircle2  },
}

function fmt(iso: string | null) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('T')[0].split('-')
  return `${d}/${m}/${y}`
}

function fmtMes(iso: string) {
  const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
  const [y, m] = iso.split('-')
  return `${meses[parseInt(m) - 1]}/${y}`
}

export default async function ConvencoesPage() {
  const auth = await getUser()
  if (!auth) redirect('/login')
  if (!['admin', 'coordenador'].includes(auth.perfil.role ?? '')) redirect('/dashboard')

  const convencoes = await listarConvencoes() as unknown as Array<{
    id: string
    descricao: string
    data_vigencia_inicio: string
    data_vigencia_fim: string
    percentual_reajuste: number | null
    status: 'rascunho' | 'publicada' | 'aplicada'
    created_at: string | null
    aplicada_em: string | null
    perfis: { nome: string | null } | null
  }>

  const counts = {
    rascunho:  convencoes.filter(c => c.status === 'rascunho').length,
    publicada: convencoes.filter(c => c.status === 'publicada').length,
    aplicada:  convencoes.filter(c => c.status === 'aplicada').length,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Convenções Coletivas</h1>
          <p className="mt-1 text-sm text-gray-500">Gestão de dissídios e reajustes salariais</p>
        </div>
        <Link
          href="/convencoes/nova"
          className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700"
        >
          <Plus className="h-4 w-4" />
          Nova Convenção
        </Link>
      </div>

      {/* Resumo de status */}
      <div className="grid grid-cols-3 gap-4">
        {([ 'rascunho', 'publicada', 'aplicada' ] as const).map(s => {
          const cfg = STATUS_CFG[s]
          const Icon = cfg.icon
          return (
            <div key={s} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <Icon className={cn('h-5 w-5', s === 'rascunho' ? 'text-slate-400' : s === 'publicada' ? 'text-blue-500' : 'text-green-500')} />
                <div>
                  <p className="text-2xl font-bold text-gray-900">{counts[s]}</p>
                  <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">{cfg.label}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Lista */}
      {convencoes.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-gray-200 py-16 text-center">
          <FileText className="h-10 w-10 text-gray-300" />
          <div>
            <p className="font-medium text-gray-500">Nenhuma convenção cadastrada</p>
            <p className="mt-0.5 text-sm text-gray-400">Crie a primeira convenção coletiva para registrar reajustes salariais.</p>
          </div>
          <Link href="/convencoes/nova" className="mt-2 flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">
            <Plus className="h-4 w-4" /> Nova Convenção
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {convencoes.map(c => {
            const cfg = STATUS_CFG[c.status]
            const Icon = cfg.icon
            return (
              <Link
                key={c.id}
                href={`/convencoes/${c.id}`}
                className="block rounded-xl border border-gray-100 bg-white shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex flex-wrap items-center gap-4 p-5">
                  {/* Status icon */}
                  <div className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
                    c.status === 'rascunho' ? 'bg-slate-100' : c.status === 'publicada' ? 'bg-blue-50' : 'bg-green-50',
                  )}>
                    <Icon className={cn('h-5 w-5', c.status === 'rascunho' ? 'text-slate-400' : c.status === 'publicada' ? 'text-blue-500' : 'text-green-500')} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-gray-900 truncate">{c.descricao}</p>
                      <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset', cfg.cls)}>
                        {cfg.label}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm text-gray-500">
                      Vigência: {fmtMes(c.data_vigencia_inicio)} – {fmtMes(c.data_vigencia_fim)}
                      {c.percentual_reajuste != null && (
                        <span className="ml-3 font-semibold text-green-600">+{c.percentual_reajuste}%</span>
                      )}
                    </p>
                  </div>

                  {/* Datas */}
                  <div className="text-right text-xs text-gray-400 shrink-0">
                    {c.status === 'aplicada' && c.aplicada_em ? (
                      <>
                        <p className="font-medium text-green-600">Aplicada em</p>
                        <p>{fmt(c.aplicada_em)}</p>
                      </>
                    ) : (
                      <>
                        <p>Criada em</p>
                        <p>{fmt(c.created_at)}</p>
                      </>
                    )}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
