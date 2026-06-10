'use client'

import { cn } from '@/lib/utils'
import type { FechamentoFuncionario } from '@/app/(admin)/fechamento/actions'

const sel = 'h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400'

function fmt(iso: string | null): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

interface Props {
  dados: FechamentoFuncionario[]
  mes: number
  ano: number
  secretariaAtiva: string
  secretarias: string[]
  MESES: string[]
  anos: number[]
}

export function FechamentoClient({ dados, mes, ano, secretariaAtiva, secretarias, MESES, anos }: Props) {
  return (
    <>
      {/* Filters */}
      <form method="get" className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="text-xs font-semibold uppercase tracking-widest text-gray-400">Mês</label>
          <select name="mes" defaultValue={mes} className={sel}>
            {MESES.slice(1).map((m, i) => (
              <option key={i + 1} value={i + 1}>{m}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold uppercase tracking-widest text-gray-400">Ano</label>
          <select name="ano" defaultValue={ano} className={sel}>
            {anos.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold uppercase tracking-widest text-gray-400">Secretaria</label>
          <select name="secretaria" defaultValue={secretariaAtiva} className={sel}>
            <option value="">Todas</option>
            {secretarias.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <button type="submit" className="flex h-9 items-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-700">
          Filtrar
        </button>
        <a href="/fechamento" className="flex h-9 items-center rounded-lg border border-gray-200 px-4 text-sm font-medium text-gray-500 hover:bg-gray-50">
          Limpar
        </a>
      </form>

      <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
        {dados.length} funcionário{dados.length !== 1 ? 's' : ''}
      </p>

      {dados.length === 0 ? (
        <div className="rounded-xl border border-gray-100 bg-white py-12 text-center shadow-sm">
          <p className="text-sm text-gray-400">Nenhum funcionário encontrado para o período.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {[
                    'Funcionário', 'Função', 'Posto', 'Secretaria',
                    'Período no mês', 'D. Úteis',
                    'Férias', 'Faltas', 'Atestados', 'Suspensão',
                    'Trabalhados', 'Insalubridade', 'Advertência',
                  ].map(h => (
                    <th key={h} className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-widest text-gray-400 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {dados.map(f => (
                  <tr
                    key={f.funcionario_id}
                    className={cn(
                      'transition-colors hover:bg-gray-50/80',
                      f.tem_suspensao && 'bg-red-50/40 hover:bg-red-50/60',
                    )}
                  >
                    <td className={cn(
                      'px-3 py-2.5 font-medium text-gray-900 whitespace-nowrap',
                      f.data_desligamento && 'text-gray-400',
                    )}>
                      {f.funcionario_nome}
                      {f.data_desligamento && (
                        <span className="ml-1.5 inline-block rounded bg-gray-100 px-1 py-0.5 text-[10px] font-medium text-gray-500">
                          desligado {fmt(f.data_desligamento)}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{f.funcao ?? '—'}</td>
                    <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{f.posto_nome ?? '—'}</td>
                    <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{f.secretaria ?? '—'}</td>
                    <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap text-xs">
                      {fmt(f.periodo_inicio)} – {fmt(f.periodo_fim)}
                      <span className="ml-1 text-gray-400">({f.dias_calendario}d)</span>
                    </td>
                    <td className="px-3 py-2.5 text-center font-mono text-gray-700">{f.dias_uteis}</td>
                    <td className="px-3 py-2.5 text-center">
                      {f.ferias_dias > 0
                        ? <span className="font-mono text-orange-600">{f.ferias_dias}</span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {f.faltas_dias > 0
                        ? <span className="font-mono text-red-600">{f.faltas_dias}</span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {f.atestados_dias > 0
                        ? <span className="font-mono text-amber-600">{f.atestados_dias}</span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {f.dias_suspensao > 0
                        ? <span className="font-mono text-red-700 font-semibold">{f.dias_suspensao}</span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="inline-flex items-center justify-center rounded-full bg-blue-50 px-2.5 py-0.5 font-mono text-sm font-bold text-blue-700">
                        {f.dias_trabalhados}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {f.insalubridade_dias > 0
                        ? <span className="font-mono text-purple-600">{f.insalubridade_dias}</span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {f.tem_suspensao
                        ? <span className="inline-block rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">Suspensão</span>
                        : f.tem_advertencia
                          ? <span className="inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">Sim</span>
                          : <span className="text-gray-300">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  )
}
