'use client'

import { useState, useTransition } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  registrarOcorrencia,
  encerrarOcorrenciaSupervisor,
} from '@/app/supervisor/ocorrencias/actions'

export type OcorrenciaSupRow = {
  id: string
  descricao: string | null
  gravidade: 'baixa' | 'media' | 'alta' | null
  status: 'aberta' | 'em_analise' | 'encerrada' | null
  data_ocorrencia: string | null
  created_at: string
  postos: { id: string; nome: string } | null
}

const GRAVIDADE_BADGE: Record<'baixa' | 'media' | 'alta', { label: string; className: string }> = {
  baixa: { label: 'Baixa', className: 'bg-green-50 text-green-700 ring-green-200'    },
  media: { label: 'Média', className: 'bg-yellow-50 text-yellow-700 ring-yellow-200' },
  alta:  { label: 'Alta',  className: 'bg-red-50 text-red-700 ring-red-200'          },
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  aberta:     { label: 'Aberta',     className: 'bg-red-50 text-red-700 ring-red-200'          },
  em_analise: { label: 'Em Análise', className: 'bg-yellow-50 text-yellow-700 ring-yellow-200' },
  encerrada:  { label: 'Encerrada',  className: 'bg-green-50 text-green-700 ring-green-200'    },
}

const labelClass = 'text-xs font-semibold uppercase tracking-widest text-gray-400'
const inputClass =
  'flex h-9 w-full rounded-lg border border-gray-200 bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400'

function fmt(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-BR')
}

function EncerrarButton({ ocorrencia }: { ocorrencia: OcorrenciaSupRow }) {
  const [pending, startTransition] = useTransition()

  function handleClick() {
    const fd = new FormData()
    fd.set('ocorrencia_id', ocorrencia.id)
    startTransition(async () => { await encerrarOcorrenciaSupervisor(fd) })
  }

  return (
    <Button size="sm" variant="outline" onClick={handleClick} disabled={pending}>
      {pending ? 'Encerrando...' : 'Encerrar'}
    </Button>
  )
}

function OcorrenciaCard({ ocorrencia, showActions = false }: {
  ocorrencia: OcorrenciaSupRow
  showActions?: boolean
}) {
  const grav   = ocorrencia.gravidade ?? 'baixa'
  const stat   = ocorrencia.status ?? 'aberta'
  const gBadge = GRAVIDADE_BADGE[grav]
  const sBadge = STATUS_BADGE[stat] ?? STATUS_BADGE['aberta']

  return (
    <div className="flex items-start justify-between gap-4 px-5 py-4">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold text-gray-500">
            {ocorrencia.postos?.nome ?? '—'}
          </span>
          <span className="text-gray-300">·</span>
          <span className="text-xs text-gray-400">{fmt(ocorrencia.data_ocorrencia)}</span>
        </div>
        <p className="text-sm text-gray-800">{ocorrencia.descricao ?? '—'}</p>
        <div className="flex gap-1.5">
          <span
            className={cn(
              'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset',
              gBadge.className,
            )}
          >
            {gBadge.label}
          </span>
          <span
            className={cn(
              'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset',
              sBadge.className,
            )}
          >
            {sBadge.label}
          </span>
        </div>
      </div>
      {showActions && (ocorrencia.status === 'aberta' || ocorrencia.status === 'em_analise') && (
        <EncerrarButton ocorrencia={ocorrencia} />
      )}
    </div>
  )
}

function NovaOcorrenciaForm({ postos }: { postos: { id: string; nome: string }[] }) {
  const [pending, startTransition] = useTransition()
  const [key, setKey]               = useState(0)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      await registrarOcorrencia(fd)
      setKey(k => k + 1)
    })
  }

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      <p className={cn(labelClass, 'mb-4')}>Nova Ocorrência</p>
      <form key={key} onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className={labelClass}>Posto</label>
            <select name="posto_id" required className={inputClass}>
              <option value="">Selecione...</option>
              {postos.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className={labelClass}>Gravidade</label>
            <select name="gravidade" required className={inputClass}>
              <option value="">Selecione...</option>
              <option value="baixa">Baixa</option>
              <option value="media">Média</option>
              <option value="alta">Alta</option>
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className={labelClass}>Data</label>
          <input
            type="date"
            name="data_ocorrencia"
            required
            defaultValue={new Date().toISOString().split('T')[0]}
            className={inputClass}
          />
        </div>

        <div className="space-y-1.5">
          <label className={labelClass}>Descrição</label>
          <textarea
            name="descricao"
            required
            rows={3}
            placeholder="Descreva a ocorrência..."
            className="flex w-full resize-none rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400"
          />
        </div>

        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? 'Registrando...' : 'Registrar Ocorrência'}
          </Button>
        </div>
      </form>
    </div>
  )
}

export function OcorrenciasSupervisor({
  postos,
  abertas,
  encerradas,
}: {
  postos: { id: string; nome: string }[]
  abertas: OcorrenciaSupRow[]
  encerradas: OcorrenciaSupRow[]
}) {
  const [historicoOpen, setHistoricoOpen] = useState(false)

  return (
    <div className="space-y-6">
      <NovaOcorrenciaForm postos={postos} />

      {/* Abertas */}
      <div>
        <p className={cn(labelClass, 'mb-3')}>
          Abertas / Em Análise ({abertas.length})
        </p>
        <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
          {abertas.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-gray-400">
              Nenhuma ocorrência aberta.
            </p>
          ) : (
            <div className="divide-y divide-gray-50">
              {abertas.map(o => (
                <OcorrenciaCard key={o.id} ocorrencia={o} showActions />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Histórico encerradas */}
      {encerradas.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setHistoricoOpen(v => !v)}
            className="flex w-full items-center justify-between rounded-xl border border-gray-100 bg-white px-5 py-3 shadow-sm"
          >
            <p className={labelClass}>Histórico encerradas ({encerradas.length})</p>
            <ChevronDown
              className={cn(
                'h-4 w-4 text-gray-400 transition-transform',
                historicoOpen && 'rotate-180',
              )}
            />
          </button>

          {historicoOpen && (
            <div className="mt-1 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
              <div className="divide-y divide-gray-50">
                {encerradas.map(o => (
                  <OcorrenciaCard key={o.id} ocorrencia={o} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
