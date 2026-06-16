import { buscarDesligados } from './actions'
import { DesligamentosGestaoClient } from '@/components/desligamentos/desligamentos-gestao-client'

export default async function DesligamentosPage({
  searchParams,
}: {
  searchParams: { inicio?: string; fim?: string }
}) {
  const hoje = new Date().toISOString().slice(0, 10)
  const anoPassado = `${new Date().getFullYear() - 1}-${String(new Date().getMonth() + 1).padStart(2,'0')}-01`

  const dataInicio = searchParams.inicio ?? anoPassado
  const dataFim    = searchParams.fim    ?? hoje

  const { rows, kpis } = await buscarDesligados(dataInicio, dataFim)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Desligamentos</h1>
        <p className="text-sm text-gray-400">Gestão de saídas e histórico acumulado</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: 'Total',        value: kpis.total,               color: 'border-t-slate-500'  },
          { label: 'Voluntária',   value: kpis.voluntaria,          color: 'border-t-blue-500'   },
          { label: 'Demissão',     value: kpis.demissao,            color: 'border-t-red-500'    },
          { label: 'Reprova Exp.', value: kpis.reprova_experiencia, color: 'border-t-amber-500'  },
          { label: 'Judicial',     value: kpis.judicial,            color: 'border-t-purple-500' },
          { label: 'Outros',       value: kpis.outros,              color: 'border-t-gray-400'   },
        ].map(k => (
          <div key={k.label} className={`rounded-xl border border-gray-100 border-t-4 ${k.color} bg-white p-5 shadow-sm`}>
            <p className="text-3xl font-black tracking-tight text-gray-900">{k.value}</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-gray-400">{k.label}</p>
          </div>
        ))}
      </div>

      <DesligamentosGestaoClient rows={rows} dataInicio={dataInicio} dataFim={dataFim} />
    </div>
  )
}
