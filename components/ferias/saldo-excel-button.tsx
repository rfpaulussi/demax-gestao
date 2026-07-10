'use client'

import { FileSpreadsheet } from 'lucide-react'
import { exportToExcel } from '@/lib/export-excel'
import type { SaldoFeriasItem } from '@/app/(admin)/ferias/actions'

function formatDate(str: string | null): string {
  if (!str) return '—'
  const d = new Date(str + 'T00:00:00')
  return d.toLocaleDateString('pt-BR')
}

export function SaldoExcelButton({ dados }: { dados: SaldoFeriasItem[] }) {
  return (
    <button
      onClick={() =>
        exportToExcel(
          dados,
          [
            { label: 'Registro',          value: r => r.funcionario_registro,                      asText: true },
            { label: 'Funcionário',        value: r => r.funcionario_nome },
            { label: 'Posto',              value: r => r.posto_nome },
            { label: 'Secretaria',         value: r => r.secretaria },
            { label: 'Supervisor',         value: r => r.supervisor_nome },
            { label: 'Períodos pendentes', value: r => r.periodos_pendentes },
            { label: 'Dias pendentes',     value: r => r.total_dias },
            { label: 'Limite + próximo',   value: r => formatDate(r.limite_mais_proximo),          asText: true },
            { label: 'Vencido?',           value: r => r.tem_vencido ? 'Sim' : 'Não' },
          ],
          `saldo-ferias-${new Date().toISOString().split('T')[0]}.xlsx`
        )
      }
      className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-white border border-green-500 text-green-700 rounded-lg hover:bg-green-50 transition"
    >
      <FileSpreadsheet className="h-4 w-4" />
      Excel
    </button>
  )
}
