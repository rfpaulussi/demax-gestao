'use client'

import { FileSpreadsheet } from 'lucide-react'
import { exportToExcel } from '@/lib/export-excel'
import type { Inconsistencia } from '@/app/(admin)/ferias/actions'

const TIPO_LABEL: Record<string, string> = {
  MULTIPLOS_EM_CURSO: 'Múltiplos em Curso',
  PA_DUPLICADO:       'PA Duplicado',
  PA_CURTO:           'PA muito curto',
  PA_INVERTIDO:       'PA Invertido',
}

export function InconsistenciasExcelButton({ dados }: { dados: Inconsistencia[] }) {
  return (
    <button
      onClick={() =>
        exportToExcel(
          dados,
          [
            { label: 'Registro',    value: r => r.funcionario_registro,          asText: true },
            { label: 'Funcionário', value: r => r.funcionario_nome },
            { label: 'Posto',       value: r => r.posto_nome },
            { label: 'Secretaria',  value: r => r.secretaria },
            { label: 'Tipo',        value: r => TIPO_LABEL[r.tipo] ?? r.tipo },
            { label: 'Descrição',   value: r => r.descricao },
            { label: 'Períodos',    value: r => r.numero_periodos.join(', '),     asText: true },
          ],
          `inconsistencias-ferias-${new Date().toISOString().split('T')[0]}.xlsx`
        )
      }
      className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-white border border-green-500 text-green-700 rounded-lg hover:bg-green-50 transition"
    >
      <FileSpreadsheet className="h-4 w-4" />
      Excel
    </button>
  )
}
