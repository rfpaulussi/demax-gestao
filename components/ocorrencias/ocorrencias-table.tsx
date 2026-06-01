'use client'

import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { encerrarOcorrencia } from '@/app/(admin)/ocorrencias/actions'

export type OcorrenciaRow = {
  id: string
  descricao: string | null
  gravidade: 'baixa' | 'media' | 'alta' | null
  status: 'aberta' | 'em_analise' | 'encerrada' | null
  created_at: string | null
  postos: { id: string; nome: string; secretaria: string | null } | null
  perfis: { id: string; nome: string | null } | null
}

const GRAVIDADE: Record<'baixa' | 'media' | 'alta', { badge: string; label: string }> = {
  baixa: { badge: 'bg-green-50 text-green-700 ring-green-200',   label: 'Baixa' },
  media: { badge: 'bg-yellow-50 text-yellow-700 ring-yellow-200', label: 'Média' },
  alta:  { badge: 'bg-red-50 text-red-700 ring-red-200',          label: 'Alta'  },
}

const STATUS: Record<'aberta' | 'em_analise' | 'encerrada', { badge: string; label: string }> = {
  aberta:     { badge: 'bg-red-50 text-red-700 ring-red-200',         label: 'Aberta'     },
  em_analise: { badge: 'bg-yellow-50 text-yellow-700 ring-yellow-200', label: 'Em Análise' },
  encerrada:  { badge: 'bg-gray-100 text-gray-500 ring-gray-200',      label: 'Encerrada'  },
}

function GravidadeBadge({ gravidade }: { gravidade: OcorrenciaRow['gravidade'] }) {
  if (!gravidade) return <span className="text-gray-400">—</span>
  const cfg = GRAVIDADE[gravidade]
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${cfg.badge}`}>
      {cfg.label}
    </span>
  )
}

function StatusBadge({ status }: { status: OcorrenciaRow['status'] }) {
  if (!status) return <span className="text-gray-400">—</span>
  const cfg = STATUS[status]
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${cfg.badge}`}>
      {cfg.label}
    </span>
  )
}

function EncerrarButton({ ocorrenciaId }: { ocorrenciaId: string }) {
  const [isPending, startTransition] = useTransition()

  function handleEncerrar() {
    const fd = new FormData()
    fd.set('ocorrencia_id', ocorrenciaId)
    startTransition(() => encerrarOcorrencia(fd))
  }

  return (
    <Button variant="outline" size="sm" disabled={isPending} onClick={handleEncerrar}>
      {isPending ? 'Encerrando…' : 'Encerrar'}
    </Button>
  )
}

export function OcorrenciasTable({ ocorrencias }: { ocorrencias: OcorrenciaRow[] }) {
  if (ocorrencias.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-gray-100 bg-white py-16 shadow-sm">
        <p className="text-sm text-gray-400">Nenhuma ocorrência encontrada.</p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-widest text-gray-400">Posto</th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-widest text-gray-400">Secretaria</th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-widest text-gray-400">Supervisor</th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-widest text-gray-400">Descrição</th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-widest text-gray-400">Gravidade</th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-widest text-gray-400">Status</th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-widest text-gray-400">Data</th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-widest text-gray-400">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {ocorrencias.map(o => (
              <tr key={o.id} className="transition-colors hover:bg-gray-50">
                <td className="px-5 py-3 font-medium text-gray-900">{o.postos?.nome ?? '—'}</td>
                <td className="px-5 py-3 text-gray-500">{o.postos?.secretaria ?? '—'}</td>
                <td className="px-5 py-3 text-gray-500">{o.perfis?.nome ?? '—'}</td>
                <td className="px-5 py-3 text-gray-500">
                  <span className="block max-w-xs truncate" title={o.descricao ?? undefined}>
                    {o.descricao ?? '—'}
                  </span>
                </td>
                <td className="px-5 py-3"><GravidadeBadge gravidade={o.gravidade} /></td>
                <td className="px-5 py-3"><StatusBadge status={o.status} /></td>
                <td className="px-5 py-3 text-gray-500">
                  {o.created_at ? new Date(o.created_at).toLocaleDateString('pt-BR') : '—'}
                </td>
                <td className="px-5 py-3">
                  {(o.status === 'aberta' || o.status === 'em_analise') && (
                    <EncerrarButton ocorrenciaId={o.id} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
