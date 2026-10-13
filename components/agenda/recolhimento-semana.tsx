'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarCheck, Trash2 } from 'lucide-react'
import { marcarRecolhimentoSemana, removerRecolhimentoSemana } from '@/app/(admin)/agenda/actions'
import { ehDiaDaJanela } from '@/lib/agenda/recolhimento'
import { diaMes } from '@/lib/agenda/datas'
import type { FeriadoDia } from '@/lib/agenda/tema'
import type { BlocoView, TipoFoco } from '@/app/(admin)/agenda/actions'

/** Marca/remove o recolhimento de cartão (dia inteiro) de todos os dias da janela desta semana. */
export function RecolhimentoSemana({
  semanaInicio,
  supervisorId,
  dias,
  blocos,
  tipos,
  feriados,
  publicada,
  podeEditar,
}: {
  semanaInicio: string
  supervisorId: string
  dias: string[]
  blocos: BlocoView[]
  tipos: TipoFoco[]
  feriados: Record<string, FeriadoDia>
  publicada: boolean
  podeEditar: boolean
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [motivo, setMotivo] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  const idsDiaInteiro = new Set(tipos.filter(t => t.dia_inteiro).map(t => t.id))
  const marcadosNaSemana = new Set(blocos.filter(b => idsDiaInteiro.has(b.tipo_foco_id)).map(b => b.data))
  const diasJanela = dias.filter(d => ehDiaDaJanela(d) && !(feriados[d] && feriados[d].tipo !== 'facultativo'))
  const pendentes = diasJanela.filter(d => !marcadosNaSemana.has(d))

  if (!podeEditar || (diasJanela.length === 0 && marcadosNaSemana.size === 0)) return null

  const precisaMotivo = publicada && motivo.trim().length < 5

  function marcar() {
    setErro(null)
    setAviso(null)
    start(async () => {
      const r = await marcarRecolhimentoSemana({ semanaInicio, supervisorId, motivo })
      if (!r.ok) return setErro(r.erro)
      const txt = r.marcados.map(diaMes).join(', ')
      const partes: string[] = []
      if (r.marcados.length > 0) partes.push(`Recolhimento marcado em ${r.marcados.length} dia(s): ${txt}.`)
      else partes.push('Nenhum dia novo para marcar nesta semana.')
      if (r.semVaga.length > 0) partes.push(`Sem posição livre em: ${r.semVaga.map(diaMes).join(', ')}.`)
      setAviso(partes.join(' '))
      setMotivo('')
      router.refresh()
    })
  }

  function remover() {
    setErro(null)
    setAviso(null)
    start(async () => {
      const r = await removerRecolhimentoSemana({ semanaInicio, supervisorId, motivo })
      if (!r.ok) return setErro(r.erro)
      setAviso('Recolhimento removido desta semana.')
      setMotivo('')
      router.refresh()
    })
  }

  return (
    <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50/60 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="mr-auto text-xs font-semibold text-amber-900">
          🕒 Recolhimento de cartão: {diasJanela.length > 0 ? `${diasJanela.length} dia(s) desta semana na janela 15–21` : 'sem dias na janela'}
        </p>
        {diasJanela.length > 0 && (
          <button
            type="button"
            disabled={pending || pendentes.length === 0 || precisaMotivo}
            onClick={marcar}
            className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-slate-900 transition hover:bg-amber-400 disabled:opacity-40"
          >
            <CalendarCheck className="h-3.5 w-3.5" />
            {pending ? 'Marcando…' : pendentes.length === 0 ? 'Já marcado nesta semana' : `Marcar recolhimento (${pendentes.length} dia(s))`}
          </button>
        )}
        {marcadosNaSemana.size > 0 && (
          <button
            type="button"
            disabled={pending || precisaMotivo}
            onClick={remover}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-40"
          >
            <Trash2 className="h-3.5 w-3.5" /> Remover recolhimento da semana
          </button>
        )}
      </div>

      {publicada && (
        <textarea
          value={motivo}
          onChange={e => setMotivo(e.target.value)}
          rows={2}
          placeholder="Agenda publicada: motivo do replanejamento (obrigatório)"
          className="w-full resize-none rounded-lg border border-amber-200 bg-white p-2 text-xs outline-none focus:border-amber-400"
        />
      )}
      {erro && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{erro}</p>}
      {aviso && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">{aviso}</p>}
    </div>
  )
}
