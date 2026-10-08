'use client'

import { useState } from 'react'
import { FileDown } from 'lucide-react'
import { rotuloSemana } from '@/lib/agenda/datas'
import { carregarMapa } from '@/app/(admin)/agenda/geo-actions'
import type { BlocoView } from '@/app/(admin)/agenda/actions'

export function BotaoPdfSemana({
  supervisorId,
  supervisorNome,
  semanaInicio,
  publicada,
  blocos,
}: {
  supervisorId: string
  supervisorNome: string
  semanaInicio: string
  publicada: boolean
  blocos: BlocoView[]
}) {
  const [gerando, setGerando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function gerar() {
    setErro(null)
    setGerando(true)
    try {
      const r = await carregarMapa(semanaInicio, supervisorId)
      if (!r.ok) return setErro(r.erro)
      const { downloadAgendaSemanalPDF } = await import('./agenda-semanal-pdf')
      const rotulo = { manha: 'manha', tarde: 'tarde', noite: 'noite' } as const
      await downloadAgendaSemanalPDF({
        supervisorNome,
        semanaInicio,
        semanaLabel: rotuloSemana(semanaInicio),
        publicada,
        stats: r.dados.stats,
        visitas: r.dados.visitas,
        replanejamentos: blocos
          .filter(b => b.replanejado && b.motivo_replanejamento)
          .map(b => ({ data: b.data, periodo: rotulo[b.periodo], motivo: b.motivo_replanejamento as string })),
      })
    } catch {
      setErro('Não foi possível gerar o PDF.')
    } finally {
      setGerando(false)
    }
  }

  return (
    <span className="ml-auto flex items-center gap-2">
      {erro && <span className="text-xs font-medium text-red-600">{erro}</span>}
      <button
        type="button" onClick={gerar} disabled={gerando}
        className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-amber-400 disabled:opacity-50"
      >
        <FileDown className="h-4 w-4" /> {gerando ? 'Gerando…' : 'PDF da semana'}
      </button>
    </span>
  )
}
