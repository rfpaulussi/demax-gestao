import Link from 'next/link'
import { AlertCircle, Clock, Info, CheckCircle2 } from 'lucide-react'
import type { AlertasDashboard } from '@/app/(admin)/dashboard/actions'

interface Props {
  alertas: AlertasDashboard
}

export function AlertasCriticos({ alertas }: Props) {
  const { postosDeficit, funcSemPosto, feriasLimiteVencendo, catAlertas } = alertas

  const temAlertas =
    postosDeficit.length > 0 || funcSemPosto > 0 || feriasLimiteVencendo > 0 || catAlertas.length > 0

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-gray-400">
        Alertas Críticos
      </p>

      {!temAlertas ? (
        <div className="flex items-center gap-2.5 rounded-lg border border-green-100 bg-green-50 px-4 py-3">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
          <p className="text-sm font-medium text-green-700">Nenhum alerta crítico.</p>
        </div>
      ) : (
        <div className="space-y-2">

          {/* Postos em déficit */}
          {postosDeficit.slice(0, 5).map(p => (
            <div
              key={p.id}
              className="flex items-start gap-3 rounded-lg border-l-[3px] border-red-500 bg-red-50 px-3 py-2.5"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-red-800">Posto em déficit</p>
                <p className="truncate text-xs text-red-700">
                  {p.nome} — falta{p.gap === 1 ? '' : 'm'} {p.gap} pessoa{p.gap > 1 ? 's' : ''}
                </p>
              </div>
            </div>
          ))}

          {postosDeficit.length > 5 && (
            <Link href="/efetivo" className="block text-right text-xs font-semibold text-red-600 hover:text-red-800">
              +{postosDeficit.length - 5} postos → ver todos
            </Link>
          )}

          {/* Funcionários sem posto */}
          {funcSemPosto > 0 && (
            <div className="flex items-start gap-3 rounded-lg border-l-[3px] border-amber-500 bg-amber-50 px-3 py-2.5">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <div>
                <p className="text-xs font-semibold text-amber-800">Sem posto alocado</p>
                <p className="text-xs text-amber-700">
                  {funcSemPosto} funcionário{funcSemPosto > 1 ? 's' : ''} ativo{funcSemPosto > 1 ? 's' : ''} sem posto
                </p>
              </div>
            </div>
          )}

          {/* Limite de gozo férias */}
          {feriasLimiteVencendo > 0 && (
            <Link href="/ferias">
              <div className="flex items-start gap-3 rounded-lg border-l-[3px] border-blue-500 bg-blue-50 px-3 py-2.5 hover:bg-blue-100 transition-colors">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
                <div>
                  <p className="text-xs font-semibold text-blue-800">Limite de gozo vencendo</p>
                  <p className="text-xs text-blue-700">
                    {feriasLimiteVencendo} funcionário{feriasLimiteVencendo > 1 ? 's' : ''} nos próximos 30 dias
                  </p>
                </div>
              </div>
            </Link>
          )}

          {/* CAT — Acidente de Trabalho */}
          {catAlertas.map(c => (
            <Link href="/atestados" key={c.id}>
              <div className={`flex items-start gap-3 rounded-lg border-l-[3px] px-3 py-2.5 hover:opacity-90 transition-opacity ${
                c.emAtraso
                  ? 'border-red-500 bg-red-50'
                  : 'border-orange-500 bg-orange-50'
              }`}>
                <Clock className={`mt-0.5 h-4 w-4 shrink-0 ${c.emAtraso ? 'text-red-500' : 'text-orange-500'}`} />
                <div className="min-w-0">
                  <p className={`text-xs font-semibold ${c.emAtraso ? 'text-red-800' : 'text-orange-800'}`}>
                    CAT {c.emAtraso ? 'em atraso' : 'pendente'}
                  </p>
                  <p className={`truncate text-xs ${c.emAtraso ? 'text-red-700' : 'text-orange-700'}`}>
                    {c.funcionarioNome} — prazo {c.emAtraso ? 'era' : 'até'} {c.prazoLimite}
                  </p>
                </div>
              </div>
            </Link>
          ))}

        </div>
      )}
    </div>
  )
}
