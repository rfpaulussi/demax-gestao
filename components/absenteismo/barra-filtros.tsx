// components/absenteismo/barra-filtros.tsx
import Link from 'next/link'
import { MESES_PT } from '@/lib/absenteismo/constantes'
import type { ParametrosTela } from '@/lib/absenteismo/parametros'
import type { OpcoesFiltro } from '@/lib/absenteismo/visao'

const sel =
  'h-9 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400'
const lbl = 'text-xs font-semibold uppercase tracking-widest text-gray-500'

interface Props {
  params: ParametrosTela
  opcoes: OpcoesFiltro
  anos: number[]
}

export function BarraFiltros({ params, opcoes, anos }: Props) {
  return (
    <form method="get" className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <div className="space-y-1">
          <label htmlFor="f-mes" className={lbl}>Mês</label>
          <select id="f-mes" name="mes" defaultValue={params.mes} className={sel}>
            {MESES_PT.slice(1).map((m, i) => (
              <option key={m} value={i + 1}>{m}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="f-ano" className={lbl}>Ano</label>
          <select id="f-ano" name="ano" defaultValue={params.ano} className={sel}>
            {anos.map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="f-sec" className={lbl}>Secretaria</label>
          <select id="f-sec" name="secretaria" defaultValue={params.filtros.secretaria ?? ''} className={sel}>
            <option value="">Todas</option>
            {opcoes.secretarias.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="f-posto" className={lbl}>Posto</label>
          <select id="f-posto" name="posto" defaultValue={params.filtros.posto_id ?? ''} className={sel}>
            <option value="">Todos</option>
            {opcoes.postos.map(p => (
              <option key={p.id} value={p.id}>{p.nome}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="f-sup" className={lbl}>Supervisor</label>
          <select id="f-sup" name="supervisor" defaultValue={params.filtros.supervisor_id ?? ''} className={sel}>
            <option value="">Todos</option>
            {opcoes.supervisores.map(s => (
              <option key={s.id} value={s.id}>{s.nome}</option>
            ))}
          </select>
        </div>
        <div className="flex items-end gap-2">
          <button
            type="submit"
            className="flex h-9 flex-1 items-center justify-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-700"
          >
            Filtrar
          </button>
          <Link
            href="/relatorios/absenteismo"
            className="flex h-9 items-center rounded-lg border border-gray-200 px-3 text-sm font-medium text-gray-500 hover:bg-gray-50"
          >
            Limpar
          </Link>
        </div>
      </div>
    </form>
  )
}
