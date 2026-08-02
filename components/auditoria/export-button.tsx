'use client'

import { useState } from 'react'
import { exportToExcel } from '@/lib/export-excel'
import { buscarAuditoriaParaExportar } from '@/app/(admin)/auditoria/actions'
import type { MovimentacaoAuditoria } from './tabela-auditoria'
import type { AuditoriaFiltros } from '@/lib/auditoria/query'

export function ExportAuditoriaButton({ filtros }: { filtros: AuditoriaFiltros }) {
  const [carregando, setCarregando] = useState(false)

  async function exportar() {
    setCarregando(true)
    try {
      const rows = await buscarAuditoriaParaExportar(filtros)
      exportToExcel<MovimentacaoAuditoria>(
        rows,
        [
          { label: 'Data/Hora',       value: r => r.createdAtFmt },
          { label: 'Executado por',   value: r => r.executor },
          { label: 'Solicitado por',  value: r => r.solicitante ?? '—' },
          { label: 'Tipo',            value: r => r.badgeLabel },
          { label: 'Funcionário',     value: r => r.funcionarioNome },
          { label: 'Campo',           value: r => r.campoLabel },
          { label: 'Antes',           value: r => r.antes },
          { label: 'Depois',          value: r => r.depois },
          { label: 'Motivo Solicitação', value: r => r.motivoSolicitacao ?? '' },
          { label: 'Motivo Rejeição',    value: r => r.motivoRejeicao ?? '' },
          { label: 'Observação Admin',   value: r => r.observacaoAdmin ?? '' },
        ],
        `auditoria_${new Date().toISOString().slice(0, 10)}.xlsx`,
      )
    } finally {
      setCarregando(false)
    }
  }

  return (
    <button
      type="button"
      onClick={exportar}
      disabled={carregando}
      className="flex h-9 w-full items-center justify-center rounded-lg bg-amber-500 px-4 text-sm font-medium text-slate-900 hover:bg-amber-400 disabled:opacity-50 sm:w-auto"
    >
      {carregando ? 'Exportando...' : 'Exportar Excel'}
    </button>
  )
}
