'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, FileText, UserCheck, UserX, MapPin, Briefcase,
  Umbrella, XCircle, AlertTriangle, Ban, Shield, ArrowRightLeft,
  RotateCcw, Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ProntuarioFuncionario, ProntuarioEvento } from '@/app/(admin)/efetivo/[id]/historico/page'

// ─── Event config ─────────────────────────────────────────────────────────────

type EventConfig = {
  label: string
  icon: React.ElementType
  dot: string   // bg color for dot
  text: string  // text color for label
  ring: string  // ring/border color
}

const EVENT_CONFIG: Record<string, EventConfig> = {
  admissao:            { label: 'Admissão',          icon: UserCheck,       dot: 'bg-green-500',   text: 'text-green-700',   ring: 'ring-green-100'  },
  desligamento:        { label: 'Desligamento',       icon: UserX,           dot: 'bg-red-500',     text: 'text-red-700',     ring: 'ring-red-100'    },
  mudanca_posto:       { label: 'Mudança de Posto',   icon: MapPin,          dot: 'bg-blue-500',    text: 'text-blue-700',    ring: 'ring-blue-100'   },
  mudanca_funcao:      { label: 'Mudança de Função',  icon: Briefcase,       dot: 'bg-purple-500',  text: 'text-purple-700',  ring: 'ring-purple-100' },
  ferias:              { label: 'Férias',             icon: Umbrella,        dot: 'bg-orange-400',  text: 'text-orange-700',  ring: 'ring-orange-100' },
  atestado:            { label: 'Atestado',           icon: FileText,        dot: 'bg-amber-400',   text: 'text-amber-700',   ring: 'ring-amber-100'  },
  falta:               { label: 'Falta',              icon: XCircle,         dot: 'bg-rose-400',    text: 'text-rose-700',    ring: 'ring-rose-100'   },
  advertencia:         { label: 'Advertência',        icon: AlertTriangle,   dot: 'bg-red-500',     text: 'text-red-700',     ring: 'ring-red-100'    },
  suspensao:           { label: 'Suspensão',          icon: Ban,             dot: 'bg-red-800',     text: 'text-red-900',     ring: 'ring-red-200'    },
  cobertura_insalubre: { label: 'Cobertura Insalubre',icon: Shield,          dot: 'bg-indigo-500',  text: 'text-indigo-700',  ring: 'ring-indigo-100' },
  transferencia:       { label: 'Transferência',      icon: ArrowRightLeft,  dot: 'bg-cyan-500',    text: 'text-cyan-700',    ring: 'ring-cyan-100'   },
  reativacao:          { label: 'Reativação',         icon: RotateCcw,       dot: 'bg-green-400',   text: 'text-green-600',   ring: 'ring-green-100'  },
}

const DEFAULT_CONFIG: EventConfig = {
  label: 'Evento',
  icon: FileText,
  dot: 'bg-gray-400',
  text: 'text-gray-600',
  ring: 'ring-gray-100',
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  ativo:     { label: 'Ativo',     className: 'bg-green-50  text-green-700  ring-green-200'  },
  afastado:  { label: 'Afastado',  className: 'bg-orange-50 text-orange-700 ring-orange-200' },
  ferias:    { label: 'Férias',    className: 'bg-amber-50  text-amber-700  ring-amber-200'  },
  desligado: { label: 'Desligado', className: 'bg-gray-100  text-gray-500   ring-gray-200'   },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = iso.split('T')[0]
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

function dadosList(dados: Record<string, unknown> | null): [string, string][] {
  if (!dados) return []
  return Object.entries(dados)
    .filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => [k, String(v)])
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  funcionario: ProntuarioFuncionario
  eventos: ProntuarioEvento[]
}

export function ProntuarioClient({ funcionario, eventos }: Props) {
  const [filtro,     setFiltro]     = useState<string | null>(null)
  const [loadingPdf, setLoadingPdf] = useState(false)

  const contagem = eventos.reduce<Record<string, number>>((acc, e) => {
    acc[e.tipo] = (acc[e.tipo] ?? 0) + 1
    return acc
  }, {})

  const tiposPresentes = Array.from(new Set(eventos.map(e => e.tipo)))
    .sort((a, b) => (contagem[b] ?? 0) - (contagem[a] ?? 0))

  const eventosFiltrados = filtro ? eventos.filter(e => e.tipo === filtro) : eventos

  const statusBadge = funcionario.status ? STATUS_BADGE[funcionario.status] : null

  async function handlePDF() {
    setLoadingPdf(true)
    try {
      const { pdf }               = await import('@react-pdf/renderer')
      const { ProntuarioPDFDoc }  = await import('./prontuario-pdf-doc')
      const blob = await pdf(
        <ProntuarioPDFDoc funcionario={funcionario} eventos={eventos} />
      ).toBlob()
      const url = URL.createObjectURL(blob)
      const a   = document.createElement('a')
      a.href    = url
      const slug = funcionario.nome.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
      a.download = `prontuario-${slug}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setLoadingPdf(false)
    }
  }

  return (
    <>
      {/* Top nav */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/efetivo/${funcionario.id}`}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar ao Efetivo
        </Link>

        <button
          type="button"
          onClick={handlePDF}
          disabled={loadingPdf || eventos.length === 0}
          className="flex h-9 items-center gap-1.5 rounded-lg bg-amber-500 px-3 text-sm font-medium text-slate-900 hover:bg-amber-400 disabled:opacity-40"
        >
          {loadingPdf
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <FileText className="h-4 w-4" />}
          {loadingPdf ? 'Gerando…' : 'Exportar PDF'}
        </button>
      </div>

      {/* Funcionário header */}
      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-gray-900">{funcionario.nome}</h2>
              {statusBadge && (
                <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset', statusBadge.className)}>
                  {statusBadge.label}
                </span>
              )}
            </div>
          </div>
          <span className="text-sm text-gray-400">{eventos.length} evento{eventos.length !== 1 ? 's' : ''}</span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-3 text-sm sm:grid-cols-4">
          {[
            { label: 'Função',    value: funcionario.funcao    },
            { label: 'Posto',     value: funcionario.posto     },
            { label: 'Secretaria',value: funcionario.secretaria},
            { label: 'Admissão',  value: fmt(funcionario.data_admissao) },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">{label}</p>
              <p className="text-gray-900">{value ?? '—'}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Type filter pills */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFiltro(null)}
          className={cn(
            'rounded-full px-3 py-1 text-xs font-semibold transition-colors',
            filtro === null
              ? 'bg-slate-900 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
          )}
        >
          Todos ({eventos.length})
        </button>
        {tiposPresentes.map(tipo => {
          const cfg = EVENT_CONFIG[tipo] ?? DEFAULT_CONFIG
          return (
            <button
              key={tipo}
              onClick={() => setFiltro(filtro === tipo ? null : tipo)}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-semibold transition-colors',
                filtro === tipo
                  ? cn(cfg.dot, 'text-white')
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
              )}
            >
              {cfg.label} ({contagem[tipo]})
            </button>
          )
        })}
      </div>

      {/* Timeline */}
      {eventosFiltrados.length === 0 ? (
        <div className="rounded-xl border border-gray-100 bg-white py-12 text-center shadow-sm">
          <p className="text-sm text-gray-400">Nenhum evento encontrado.</p>
        </div>
      ) : (
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-[17px] top-0 bottom-4 w-0.5 bg-gray-200" />

          <div className="space-y-4">
            {eventosFiltrados.map(evento => {
              const cfg   = EVENT_CONFIG[evento.tipo] ?? DEFAULT_CONFIG
              const Icon  = cfg.icon
              const antList = dadosList(evento.dados_anteriores)
              const novList = dadosList(evento.dados_novos)

              return (
                <div key={evento.id} className="relative flex gap-4">
                  {/* Dot */}
                  <div className={cn(
                    'relative z-10 mt-1 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ring-2 ring-white',
                    cfg.dot,
                  )}>
                    <Icon className="h-4 w-4 text-white" />
                  </div>

                  {/* Card */}
                  <div className="flex-1 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className={cn('text-xs font-bold uppercase tracking-wide', cfg.text)}>
                        {cfg.label}
                      </span>
                      <span className="text-xs font-medium text-gray-400">{fmt(evento.data)}</span>
                    </div>

                    {evento.descricao && (
                      <p className="mt-1.5 text-sm text-gray-700">{evento.descricao}</p>
                    )}

                    {/* Mudança: antes → depois */}
                    {antList.length > 0 && novList.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-3">
                        {antList.map(([k, v]) => {
                          const novValor = novList.find(([nk]) => nk === k)?.[1]
                          return (
                            <span key={k} className="inline-flex items-center gap-1 rounded-md bg-gray-50 px-2 py-0.5 text-xs text-gray-500">
                              <span className="font-medium text-gray-400">{k}:</span>
                              <span className="line-through text-gray-400">{v}</span>
                              {novValor && <span className="text-gray-700">→ {novValor}</span>}
                            </span>
                          )
                        })}
                      </div>
                    )}

                    {/* Dados novos apenas (sem antes) */}
                    {antList.length === 0 && novList.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {novList.map(([k, v]) => (
                          <span key={k} className="inline-flex items-center gap-1 rounded-md bg-gray-50 px-2 py-0.5 text-xs text-gray-500">
                            <span className="font-medium text-gray-400">{k}:</span>
                            <span>{v}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </>
  )
}
