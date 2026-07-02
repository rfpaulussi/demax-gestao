import Link from 'next/link'
import { AlertCircle, Clock, Info, CheckCircle2, TrendingUp } from 'lucide-react'
import type { AlertasDashboard } from '@/app/(admin)/dashboard/actions'

interface Props {
  alertas: AlertasDashboard
}

export function AlertasCriticos({ alertas }: Props) {
  const { postosDeficit, postosExcedentes, funcSemPosto, feriasLimiteVencendo, catAlertas } = alertas

  const temAlertas =
    postosDeficit.length > 0 || funcSemPosto > 0 || feriasLimiteVencendo > 0 || catAlertas.length > 0

  return (
    <div className="flex h-full flex-col rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
      <p className="mb-3 shrink-0 text-xs font-semibold uppercase tracking-widest text-gray-400">
        Situação dos Postos
      </p>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto">

        {/* ── Déficit ──────────────────────────────────────────────────────── */}
        {postosDeficit.length > 0 && (
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-red-400">
              Déficit — {postosDeficit.length} posto{postosDeficit.length > 1 ? 's' : ''}
            </p>
            <div className="space-y-1.5">
              {postosDeficit.map(p => (
                <div
                  key={p.id}
                  className="flex items-start gap-3 rounded-lg border-l-[3px] border-red-500 bg-red-50 px-3 py-2"
                >
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-red-800">{p.nome}</p>
                    <p className="text-[10px] text-red-600">
                      {p.secretaria && <span className="mr-1 font-medium">{p.secretaria}</span>}
                      falta{p.gap === 1 ? '' : 'm'} {p.gap} pessoa{p.gap > 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Excesso ──────────────────────────────────────────────────────── */}
        {postosExcedentes.length > 0 && (
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-blue-400">
              Excesso — {postosExcedentes.length} posto{postosExcedentes.length > 1 ? 's' : ''}
            </p>
            <div className="space-y-1.5">
              {postosExcedentes.map(p => (
                <div
                  key={p.id}
                  className="flex items-start gap-3 rounded-lg border-l-[3px] border-blue-400 bg-blue-50 px-3 py-2"
                >
                  <TrendingUp className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-500" />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-blue-800">{p.nome}</p>
                    <p className="text-[10px] text-blue-600">
                      {p.secretaria && <span className="mr-1 font-medium">{p.secretaria}</span>}
                      +{p.excesso} acima do previsto
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Sem posto ────────────────────────────────────────────────────── */}
        {funcSemPosto > 0 && (
          <div className="flex items-start gap-3 rounded-lg border-l-[3px] border-amber-500 bg-amber-50 px-3 py-2">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
            <div>
              <p className="text-xs font-semibold text-amber-800">Sem posto alocado</p>
              <p className="text-[10px] text-amber-700">
                {funcSemPosto} funcionário{funcSemPosto > 1 ? 's' : ''} ativo{funcSemPosto > 1 ? 's' : ''} sem posto
              </p>
            </div>
          </div>
        )}

        {/* ── Limite férias ─────────────────────────────────────────────────── */}
        {feriasLimiteVencendo > 0 && (
          <Link href="/ferias">
            <div className="flex items-start gap-3 rounded-lg border-l-[3px] border-indigo-500 bg-indigo-50 px-3 py-2 transition-colors hover:bg-indigo-100">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-500" />
              <div>
                <p className="text-xs font-semibold text-indigo-800">Limite de gozo vencendo</p>
                <p className="text-[10px] text-indigo-700">
                  {feriasLimiteVencendo} funcionário{feriasLimiteVencendo > 1 ? 's' : ''} nos próximos 30 dias
                </p>
              </div>
            </div>
          </Link>
        )}

        {/* ── CAT ──────────────────────────────────────────────────────────── */}
        {catAlertas.map(c => (
          <Link href="/atestados" key={c.id}>
            <div className={`flex items-start gap-3 rounded-lg border-l-[3px] px-3 py-2 transition-opacity hover:opacity-90 ${
              c.emAtraso ? 'border-red-500 bg-red-50' : 'border-orange-500 bg-orange-50'
            }`}>
              <Clock className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${c.emAtraso ? 'text-red-500' : 'text-orange-500'}`} />
              <div className="min-w-0">
                <p className={`text-xs font-semibold ${c.emAtraso ? 'text-red-800' : 'text-orange-800'}`}>
                  CAT {c.emAtraso ? 'em atraso' : 'pendente'}
                </p>
                <p className={`truncate text-[10px] ${c.emAtraso ? 'text-red-700' : 'text-orange-700'}`}>
                  {c.funcionarioNome} — prazo {c.emAtraso ? 'era' : 'até'} {c.prazoLimite}
                </p>
              </div>
            </div>
          </Link>
        ))}

        {/* ── Tudo OK ──────────────────────────────────────────────────────── */}
        {!temAlertas && postosExcedentes.length === 0 && (
          <div className="flex items-center gap-2.5 rounded-lg border border-green-100 bg-green-50 px-4 py-3">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
            <p className="text-sm font-medium text-green-700">Nenhum alerta crítico.</p>
          </div>
        )}

        <Link href="/postos" className="shrink-0 text-right text-[10px] font-semibold text-gray-400 hover:text-gray-600">
          Ver todos os postos →
        </Link>

      </div>
    </div>
  )
}
