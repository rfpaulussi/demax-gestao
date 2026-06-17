'use client'

import { useTransition } from 'react'
import { cn } from '@/lib/utils'
import { renovarFaseExperiencia, encerrarExperiencia } from '@/app/(admin)/efetivo/actions'
import type { StatusExperiencia } from '@/lib/experiencia'

interface Props {
  funcionarioId: string
  exp: StatusExperiencia
  periodo: '30+30' | '45+45'
}

function fmt(iso: string): string {
  const [y, m, d] = iso.split('T')[0].split('-')
  return `${d}/${m}/${y}`
}

export function BannerExperiencia({ funcionarioId, exp, periodo }: Props) {
  const [pending, start] = useTransition()

  async function handleRenovar() {
    start(async () => { await renovarFaseExperiencia(funcionarioId) })
  }
  async function handleEncerrar() {
    start(async () => { await encerrarExperiencia(funcionarioId) })
  }

  const atencao = exp.atencao || (exp.diasRestantes !== null && exp.diasRestantes < 0)
  const vencido = exp.diasRestantes !== null && exp.diasRestantes < 0

  return (
    <div className={cn(
      'rounded-xl border px-5 py-4 shadow-sm',
      atencao
        ? 'border-red-200 bg-red-50'
        : 'border-purple-200 bg-purple-50',
    )}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className={cn('text-sm font-semibold', atencao ? 'text-red-800' : 'text-purple-800')}>
            Em Período de Experiência — Fase {exp.fase} ({periodo})
          </p>
          <p className={cn('mt-0.5 text-xs', atencao ? 'text-red-600' : 'text-purple-600')}>
            {exp.venceEm
              ? vencido
                ? `Expirou em ${fmt(exp.venceEm)} (${Math.abs(exp.diasRestantes!)} dias atrás)`
                : `Fase ${exp.fase} encerra em ${fmt(exp.venceEm)} · ${exp.diasRestantes} dias restantes`
              : `Fase ${exp.fase} — data de encerramento não definida`}
          </p>
        </div>
        <div className="flex gap-2">
          {exp.fase === '1' && (
            <button
              type="button"
              onClick={handleRenovar}
              disabled={pending}
              className="flex h-8 items-center rounded-lg bg-purple-700 px-3 text-xs font-semibold text-white hover:bg-purple-800 disabled:opacity-50"
            >
              {pending ? '...' : 'Renovar para Fase 2'}
            </button>
          )}
          <button
            type="button"
            onClick={handleEncerrar}
            disabled={pending}
            className="flex h-8 items-center rounded-lg border border-gray-300 bg-white px-3 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {pending ? '...' : 'Encerrar Experiência'}
          </button>
        </div>
      </div>
    </div>
  )
}
