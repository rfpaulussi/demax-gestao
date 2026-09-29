'use client'

import { exportToExcel } from '@/lib/export-excel'
import type { Achado } from '@/app/(admin)/revisor-operacional/actions'

const SEV_LABEL = { alta: 'Alta', media: 'Média', baixa: 'Baixa' } as const

export function ExportarAchados({ achados }: { achados: Achado[] }) {
  function exportar() {
    exportToExcel(
      achados,
      [
        { label: 'Severidade', value: a => SEV_LABEL[a.severidade] },
        { label: 'Tipo', value: a => a.tipo },
        { label: 'Funcionário', value: a => a.funcionario_nome },
        { label: 'Posto', value: a => a.posto_nome },
        { label: 'Secretaria', value: a => a.secretaria },
        { label: 'Status atual', value: a => a.status_atual },
        { label: 'Data ref.', value: a => (a.data_ref ? a.data_ref.split('-').reverse().join('/') : '') },
        { label: 'Título', value: a => a.titulo },
        { label: 'Descrição', value: a => a.descricao },
        { label: 'Detalhe', value: a => a.detalhe },
        { label: 'ID registro', value: a => a.registro_id, asText: true },
      ],
      `revisor-operacional-${new Date().toISOString().slice(0, 10)}.xlsx`,
    )
  }

  return (
    <button
      type="button"
      onClick={exportar}
      className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-slate-900 hover:bg-amber-400"
    >
      Exportar Excel
    </button>
  )
}
