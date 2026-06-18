'use client'

import { useState, useMemo } from 'react'
import { FileSpreadsheet } from 'lucide-react'
import { exportToExcel } from '@/lib/export-excel'

export interface MudancaFuncaoAdminRow {
  id: string
  created_at: string
  nome: string
  registro: string | null
  posto: string
  secretaria: string
  funcao_anterior: string
  funcao_nova: string
  supervisor: string
  motivo: string | null
}

const MESES_LABEL = ['','Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

function fmtDt(iso: string): string {
  const [datePart, timePart] = iso.split('T')
  const [y, m, d] = datePart.split('-')
  const hm = timePart ? timePart.slice(0, 5) : ''
  return `${d}/${m}/${y}${hm ? ' ' + hm : ''}`
}

const sel = 'h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400'

interface Props {
  dados: MudancaFuncaoAdminRow[]
  mes: number
  ano: number
  anos: number[]
}

export function MudancasFuncaoAdminClient({ dados, mes, ano, anos }: Props) {
  const [supervisorFiltro, setSupervisorFiltro] = useState('')
  const [busca, setBusca]                       = useState('')

  const supervisores = useMemo(
    () => Array.from(new Set(dados.map(r => r.supervisor).filter(Boolean))).sort(),
    [dados],
  )

  const dadosFiltrados = useMemo(
    () => dados.filter(r =>
      (!supervisorFiltro || r.supervisor === supervisorFiltro) &&
      (!busca || r.nome.toLowerCase().includes(busca.toLowerCase())),
    ),
    [dados, supervisorFiltro, busca],
  )

  const totalMudancas    = dadosFiltrados.length
  const totalFuncionarios = new Set(dadosFiltrados.map(r => r.nome)).size

  function handleExport() {
    const pad2 = (n: number) => String(n).padStart(2, '0')
    exportToExcel(
      dadosFiltrados,
      [
        { label: 'Data',             value: r => fmtDt(r.created_at)  },
        { label: 'Registro',         value: r => r.registro ?? '—',   asText: true },
        { label: 'Nome',             value: r => r.nome               },
        { label: 'Função Anterior',  value: r => r.funcao_anterior    },
        { label: 'Nova Função',      value: r => r.funcao_nova        },
        { label: 'Posto',            value: r => r.posto              },
        { label: 'Secretaria',       value: r => r.secretaria         },
        { label: 'Supervisor',       value: r => r.supervisor         },
        { label: 'Motivo',           value: r => r.motivo ?? '—'      },
      ],
      `mudancas-funcao-${pad2(mes)}-${ano}.xlsx`,
    )
  }

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-gray-100 border-t-4 border-t-indigo-500 bg-white p-5 shadow-sm">
          <p className="text-4xl font-bold tracking-tight text-gray-900">{totalMudancas}</p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-gray-400">Mudanças no Período</p>
        </div>
        <div className="rounded-xl border border-gray-100 border-t-4 border-t-slate-500 bg-white p-5 shadow-sm">
          <p className="text-4xl font-bold tracking-tight text-gray-900">{totalFuncionarios}</p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-gray-400">Funcionários Afetados</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-3">
        {/* Mês / Ano — via URL (form GET) */}
        <form method="get" className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-widest text-gray-400">Mês</label>
            <select name="mes" defaultValue={mes} className={sel}>
              {MESES_LABEL.slice(1).map((m, i) => (
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
          <button
            type="submit"
            className="flex h-9 items-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-700"
          >
            Filtrar
          </button>
          <a
            href="/mudancas-funcao"
            className="flex h-9 items-center rounded-lg border border-gray-200 px-4 text-sm font-medium text-gray-500 hover:bg-gray-50"
          >
            Limpar
          </a>
        </form>

        {/* Supervisor — client-side */}
        <div className="space-y-1">
          <label className="text-xs font-semibold uppercase tracking-widest text-gray-400">Supervisor</label>
          <select
            value={supervisorFiltro}
            onChange={e => setSupervisorFiltro(e.target.value)}
            className={sel}
          >
            <option value="">Todos</option>
            {supervisores.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* Busca por nome — client-side */}
        <div className="space-y-1">
          <label className="text-xs font-semibold uppercase tracking-widest text-gray-400">Buscar funcionário</label>
          <input
            type="text"
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Nome..."
            className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400"
          />
        </div>

        {/* Export */}
        <div className="ml-auto">
          <button
            type="button"
            onClick={handleExport}
            disabled={dadosFiltrados.length === 0}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-green-600 px-4 text-sm font-medium text-white hover:bg-green-500 disabled:opacity-40"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Exportar Excel
          </button>
        </div>
      </div>

      <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
        {dadosFiltrados.length} registro{dadosFiltrados.length !== 1 ? 's' : ''}
        {(supervisorFiltro || busca) ? ` (filtrado de ${dados.length})` : ''}
      </p>

      {/* Tabela */}
      {dadosFiltrados.length === 0 ? (
        <div className="rounded-xl border border-gray-100 bg-white py-12 text-center shadow-sm">
          <p className="text-sm text-gray-400">Nenhuma mudança de função encontrada para o período.</p>
        </div>
      ) : (
        <div className="w-full overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-sm" style={{ minWidth: '1000px' }}>
              <thead>
                <tr className="border-b border-gray-100 bg-slate-50">
                  {['Data', 'Registro', 'Nome', 'Função Anterior', 'Nova Função', 'Posto', 'Secretaria', 'Supervisor', 'Motivo'].map(h => (
                    <th key={h} className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-widest text-gray-400">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {dadosFiltrados.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50/80">
                    <td className="whitespace-nowrap px-3 py-2.5 text-gray-500">{fmtDt(r.created_at)}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs text-gray-400">{r.registro ?? '—'}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 font-medium text-gray-900">{r.nome}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-gray-500">{r.funcao_anterior}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 font-medium text-indigo-600">{r.funcao_nova}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-gray-600">{r.posto}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-gray-500">{r.secretaria}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-gray-500">{r.supervisor}</td>
                    <td className="max-w-xs truncate px-3 py-2.5 text-gray-400">{r.motivo ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
