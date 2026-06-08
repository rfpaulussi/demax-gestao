import Link from 'next/link'
import { CheckCircle2 } from 'lucide-react'
import type { AlertasDashboard } from '@/app/(admin)/dashboard/actions'

interface AlertasCriticosProps {
  alertas: AlertasDashboard
}

export function AlertasCriticos({ alertas }: AlertasCriticosProps) {
  const { postosDeficit, funcSemPosto, feriasLimiteVencendo } = alertas

  const temAlertas =
    postosDeficit.length > 0 || funcSemPosto > 0 || feriasLimiteVencendo > 0

  if (!temAlertas) {
    return (
      <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-gray-400">
          Alertas Críticos
        </p>
        <div className="flex items-center gap-2.5 rounded-lg border border-green-100 bg-green-50 px-4 py-3">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
          <p className="text-sm font-medium text-green-700">Nenhum alerta crítico.</p>
        </div>
      </div>
    )
  }

  const visiblePostos = postosDeficit.slice(0, 5)
  const hasMore = postosDeficit.length > 5

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-gray-400">
        Alertas Críticos
      </p>

      <div className="space-y-3">
        {/* Bloco vermelho — postos em déficit */}
        <div className="rounded-lg border-l-4 border-red-400 bg-red-50/30 px-4 py-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-red-600">
            Postos em Déficit
          </p>
          {postosDeficit.length === 0 ? (
            <p className="text-sm text-gray-500">✓ Nenhum posto em déficit</p>
          ) : (
            <>
              <ul className="space-y-1">
                {visiblePostos.map(p => (
                  <li key={p.id} className="text-sm text-gray-700">
                    • {p.nome} — falta{p.gap === 1 ? '' : 'm'} {p.gap} pessoa{p.gap > 1 ? 's' : ''}
                  </li>
                ))}
              </ul>
              {hasMore && (
                <Link
                  href="/efetivo"
                  className="mt-2 inline-block text-xs font-semibold text-red-600 hover:text-red-800"
                >
                  ver todos →
                </Link>
              )}
            </>
          )}
        </div>

        {/* Bloco âmbar — funcionários sem posto */}
        {funcSemPosto > 0 && (
          <div className="rounded-lg border-l-4 border-amber-400 bg-amber-50/30 px-4 py-3">
            <p className="text-sm text-amber-700">
              {funcSemPosto} funcionário{funcSemPosto > 1 ? 's' : ''}{' '}
              ativo{funcSemPosto > 1 ? 's' : ''} sem posto alocado
            </p>
            <Link
              href="/efetivo"
              className="mt-1 inline-block text-xs font-semibold text-amber-600 hover:text-amber-800"
            >
              ver no efetivo →
            </Link>
          </div>
        )}

        {/* Bloco azul — férias com limite de gozo vencendo */}
        {feriasLimiteVencendo > 0 && (
          <div className="rounded-lg border-l-4 border-blue-400 bg-blue-50/30 px-4 py-3">
            <p className="text-sm text-blue-700">
              {feriasLimiteVencendo} funcionário{feriasLimiteVencendo > 1 ? 's' : ''} com limite de
              gozo nos próximos 30 dias
            </p>
            <Link
              href="/ferias"
              className="mt-1 inline-block text-xs font-semibold text-blue-600 hover:text-blue-800"
            >
              ver nas férias →
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
