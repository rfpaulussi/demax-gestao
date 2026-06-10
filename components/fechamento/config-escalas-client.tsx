'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { ArrowLeft, Check, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { saveEscala } from '@/app/(admin)/fechamento/config-escalas/actions'
import type { PostoEscala } from '@/app/(admin)/fechamento/config-escalas/page'

const REGIMES = ['5x2', '5x1', '12x36'] as const
type Regime = typeof REGIMES[number]

const badgeClass: Record<Regime, string> = {
  '5x2':   'bg-blue-100   text-blue-700   border-blue-200',
  '5x1':   'bg-green-100  text-green-700  border-green-200',
  '12x36': 'bg-orange-100 text-orange-700 border-orange-200',
}

const sel = 'h-7 rounded-md border px-2 text-xs font-semibold focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400 cursor-pointer'
const secSel = 'h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400'

interface Props {
  postos: PostoEscala[]
  secretarias: string[]
}

export function ConfigEscalasClient({ postos, secretarias }: Props) {
  const [regimes, setRegimes]     = useState<Record<string, string>>(
    () => Object.fromEntries(postos.map(p => [p.id, p.regime]))
  )
  const [saved,   setSaved]       = useState<Record<string, boolean>>({})
  const [errors,  setErrors]      = useState<Record<string, string>>({})
  const [filtro,  setFiltro]      = useState('')
  const [, startTransition] = useTransition()
  const [saving,  setSaving]      = useState<Record<string, boolean>>({})

  const lista = filtro
    ? postos.filter(p => p.secretaria === filtro)
    : postos

  function handleChange(posto_id: string, regime: string) {
    setRegimes(prev => ({ ...prev, [posto_id]: regime }))
    setSaved(prev  => ({ ...prev, [posto_id]: false }))
    setErrors(prev => ({ ...prev, [posto_id]: '' }))
    setSaving(prev => ({ ...prev, [posto_id]: true }))

    startTransition(async () => {
      const res = await saveEscala(posto_id, regime)
      setSaving(prev => ({ ...prev, [posto_id]: false }))
      if (res.ok) {
        setSaved(prev => ({ ...prev, [posto_id]: true }))
        setTimeout(() => setSaved(prev => ({ ...prev, [posto_id]: false })), 2000)
      } else {
        setErrors(prev => ({ ...prev, [posto_id]: res.error ?? 'Erro ao salvar' }))
      }
    })
  }

  return (
    <>
      {/* Header */}
      <div className="flex flex-wrap items-center gap-4">
        <Link
          href="/fechamento"
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar ao Fechamento
        </Link>

        <div className="ml-auto flex items-center gap-2">
          <label className="text-xs font-semibold uppercase tracking-widest text-gray-400">Secretaria</label>
          <select value={filtro} onChange={e => setFiltro(e.target.value)} className={secSel}>
            <option value="">Todas</option>
            {secretarias.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* Contagem */}
      <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
        {lista.length} posto{lista.length !== 1 ? 's' : ''}
      </p>

      {/* Tabela */}
      <div className="w-full overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="min-w-[120px] px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-gray-400">Secretaria</th>
                <th className="min-w-[200px] px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-gray-400">Posto</th>
                <th className="min-w-[140px] px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-gray-400">Regime</th>
                <th className="w-8 px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {lista.map(posto => {
                const regime = (regimes[posto.id] ?? '5x2') as Regime
                const isSaving = saving[posto.id]
                const isSaved  = saved[posto.id]
                const err      = errors[posto.id]

                return (
                  <tr key={posto.id} className="transition-colors hover:bg-gray-50/80">
                    <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap text-xs">
                      {posto.secretaria ?? '—'}
                    </td>
                    <td className="px-4 py-2.5 font-medium text-gray-900 whitespace-nowrap">
                      {posto.nome}
                    </td>
                    <td className="px-4 py-2.5">
                      <select
                        value={regime}
                        onChange={e => handleChange(posto.id, e.target.value)}
                        disabled={isSaving}
                        className={cn(sel, badgeClass[regime], 'disabled:opacity-60')}
                      >
                        {REGIMES.map(r => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                      {err && (
                        <p className="mt-0.5 text-[10px] text-red-600">{err}</p>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" />}
                      {isSaved  && <Check   className="h-3.5 w-3.5 text-green-500" />}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
