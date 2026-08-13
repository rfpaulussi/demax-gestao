'use client'

import type { LinhaResumo } from '@/lib/conferencia-rh/tipos'

function Celula({ rh, sistema }: { rh: number; sistema: number }) {
  const bate = rh === sistema
  return (
    <td className={`px-2 py-1.5 text-center text-xs tabular-nums ${bate ? 'text-gray-600' : 'bg-amber-50 font-semibold text-amber-700'}`}>
      {rh} / {sistema}
    </td>
  )
}

export function ResumoAgregado({
  linhas,
  totalGeral,
  supervisores,
}: {
  linhas: LinhaResumo[]
  totalGeral: LinhaResumo
  supervisores: string[]
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white shadow-sm">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-slate-900 text-white">
            <th scope="col" rowSpan={2} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-widest align-bottom">Função</th>
            {supervisores.map(s => (
              <th key={s} scope="col" className="px-2 py-2 text-center text-xs font-semibold uppercase tracking-widest">{s}</th>
            ))}
            <th scope="col" className="px-2 py-2 text-center text-xs font-semibold uppercase tracking-widest">Afast.</th>
            <th scope="col" className="px-2 py-2 text-center text-xs font-semibold uppercase tracking-widest">Total</th>
          </tr>
          <tr className="bg-slate-800 text-white/70">
            <th scope="col" colSpan={supervisores.length + 2} className="px-3 py-1 text-center text-[10px] font-normal">RH / Sistema</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map(linha => (
            <tr key={linha.funcao} className="border-b border-gray-100">
              <td className="px-3 py-1.5 text-xs font-medium text-gray-700">{linha.funcao}</td>
              {supervisores.map(s => (
                <Celula key={s} rh={linha.porSupervisor[s]?.rh ?? 0} sistema={linha.porSupervisor[s]?.sistema ?? 0} />
              ))}
              <Celula rh={linha.afastados.rh} sistema={linha.afastados.sistema} />
              <Celula rh={linha.total.rh} sistema={linha.total.sistema} />
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-gray-200 bg-gray-50 font-bold">
            <td className="px-3 py-1.5 text-xs text-gray-900">TOTAL</td>
            {supervisores.map(s => (
              <Celula key={s} rh={totalGeral.porSupervisor[s]?.rh ?? 0} sistema={totalGeral.porSupervisor[s]?.sistema ?? 0} />
            ))}
            <Celula rh={totalGeral.afastados.rh} sistema={totalGeral.afastados.sistema} />
            <Celula rh={totalGeral.total.rh} sistema={totalGeral.total.sistema} />
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
