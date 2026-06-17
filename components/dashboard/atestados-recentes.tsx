import { FileX } from 'lucide-react'
import type { AtestadoRecente } from '@/app/(admin)/dashboard/actions'

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return '?'
  if (partes.length === 1) return partes[0][0].toUpperCase()
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
}

interface AtestadosRecentesProps {
  atestados: AtestadoRecente[]
}

function formatDia(iso: string): string {
  const str = iso.includes('T') ? iso.split('T')[0] : iso
  const [, m, d] = str.split('-')
  return `${d}/${m}`
}

export function AtestadosRecentes({ atestados }: AtestadosRecentesProps) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-gray-400">
        Atestados Recentes — 7 Dias
      </p>

      {atestados.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-6 text-gray-300">
          <FileX className="h-8 w-8" />
          <p className="text-sm text-gray-400">Nenhum atestado nos últimos 7 dias.</p>
        </div>
      ) : (
        <ul className="divide-y divide-gray-50">
          {atestados.map(a => {
            const meta = [a.supervisorNome, a.secretaria].filter(Boolean).join(' · ')
            return (
              <li key={a.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-medium text-indigo-700">
                    {iniciais(a.funcionarioNome)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900">{a.funcionarioNome}</p>
                    {meta && <p className="truncate text-xs text-gray-400">{meta}</p>}
                  </div>
                </div>
                <div className="ml-3 flex shrink-0 flex-col items-end gap-0.5">
                  <span className="text-xs font-semibold text-gray-700">
                    {a.duracao} dia{a.duracao > 1 ? 's' : ''}
                  </span>
                  <span className="text-xs text-gray-400">
                    {formatDia(a.dataInicio)} → {formatDia(a.dataFim)}
                  </span>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
