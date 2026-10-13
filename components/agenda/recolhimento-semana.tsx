'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarCheck, Trash2 } from 'lucide-react'
import { marcarRecolhimentoSemana, removerRecolhimentoSemana } from '@/app/(admin)/agenda/actions'
import { ehDiaDaJanela } from '@/lib/agenda/recolhimento'
import { diaMes } from '@/lib/agenda/datas'
import type { FeriadoDia, Periodo } from '@/lib/agenda/tema'
import type { BlocoView, TipoFoco } from '@/app/(admin)/agenda/actions'

type Escolha = Periodo | 'dia'

const OPCOES: { id: Escolha; rotulo: string }[] = [
  { id: 'manha', rotulo: 'Manhã' },
  { id: 'tarde', rotulo: 'Tarde' },
  { id: 'dia', rotulo: 'Dia inteiro' },
]

/** Marca/remove o recolhimento de cartão num intervalo de datas desta semana, por período. */
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

  // Sugestão: os dias da janela 15–21 que caem nesta semana. O supervisor ajusta o intervalo.
  const janelaSemana = dias.filter(ehDiaDaJanela)
  const [de, setDe] = useState(janelaSemana[0] ?? dias[0] ?? '')
  const [ate, setAte] = useState(janelaSemana[janelaSemana.length - 1] ?? dias[dias.length - 1] ?? '')
  const [escolha, setEscolha] = useState<Escolha>('dia')
  const [motivo, setMotivo] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  if (!podeEditar) return null

  const idsRecolhimento = new Set(tipos.filter(t => t.dia_inteiro).map(t => t.id))
  const periodosEscolhidos: Periodo[] = escolha === 'dia' ? ['manha', 'tarde'] : [escolha]
  const marcadoEm = (data: string, periodos: Periodo[]) =>
    blocos.some(b => b.data === data && idsRecolhimento.has(b.tipo_foco_id) && periodos.includes(b.periodo))
  const temRecolhimentoNaSemana = blocos.some(b => idsRecolhimento.has(b.tipo_foco_id))

  const intervaloValido = !!de && !!ate && de <= ate
  const alvo = dias.filter(d => d >= de && d <= ate && !(feriados[d] && feriados[d].tipo !== 'facultativo'))
  const pendentes = alvo.filter(d => !marcadoEm(d, periodosEscolhidos))
  const precisaMotivo = publicada && motivo.trim().length < 5

  function marcar() {
    setErro(null)
    setAviso(null)
    start(async () => {
      const r = await marcarRecolhimentoSemana({
        semanaInicio, supervisorId, motivo,
        dataInicio: de, dataFim: ate, periodos: periodosEscolhidos,
      })
      if (!r.ok) return setErro(r.erro)
      const partes: string[] = []
      if (r.marcados.length > 0) partes.push(`Marcado em ${r.marcados.length} dia(s): ${r.marcados.map(diaMes).join(', ')}.`)
      else partes.push('Nenhum dia novo para marcar.')
      if (r.ja.length > 0) partes.push(`Já marcados: ${r.ja.map(diaMes).join(', ')}.`)
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
    <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/60 p-3">
      <p className="text-xs font-bold uppercase tracking-widest text-amber-900">🕒 Recolhimento de cartão de ponto</p>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-[11px] font-semibold text-amber-900">
          De
          <input
            type="date" value={de} min={dias[0]} max={dias[dias.length - 1]}
            onChange={e => setDe(e.target.value)}
            className="rounded-lg border border-amber-200 bg-white px-2 py-1.5 text-xs text-slate-800 outline-none focus:border-amber-400"
          />
        </label>
        <label className="flex flex-col gap-1 text-[11px] font-semibold text-amber-900">
          Até
          <input
            type="date" value={ate} min={dias[0]} max={dias[dias.length - 1]}
            onChange={e => setAte(e.target.value)}
            className="rounded-lg border border-amber-200 bg-white px-2 py-1.5 text-xs text-slate-800 outline-none focus:border-amber-400"
          />
        </label>
        <div className="flex flex-col gap-1 text-[11px] font-semibold text-amber-900">
          Período
          <div className="flex gap-1 rounded-lg bg-white p-1 ring-1 ring-amber-200">
            {OPCOES.map(o => (
              <button
                key={o.id}
                type="button"
                onClick={() => setEscolha(o.id)}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                  escolha === o.id ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {o.rotulo}
              </button>
            ))}
          </div>
        </div>
        <button
          type="button"
          disabled={pending || !intervaloValido || pendentes.length === 0 || precisaMotivo}
          onClick={marcar}
          className="ml-auto flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-2 text-xs font-semibold text-slate-900 transition hover:bg-amber-400 disabled:opacity-40"
        >
          <CalendarCheck className="h-3.5 w-3.5" />
          {pending ? 'Marcando…' : `Marcar (${pendentes.length} dia(s))`}
        </button>
        {temRecolhimentoNaSemana && (
          <button
            type="button"
            disabled={pending || precisaMotivo}
            onClick={remover}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-40"
          >
            <Trash2 className="h-3.5 w-3.5" /> Remover desta semana
          </button>
        )}
      </div>

      <p className="text-[11px] text-amber-900/80">
        {!intervaloValido
          ? 'Escolha um intervalo válido dentro desta semana.'
          : pendentes.length > 0
            ? `Vai marcar: ${pendentes.map(diaMes).join(', ')}. Dias já marcados e feriados são pulados.`
            : 'Nenhum dia pendente neste intervalo para o período escolhido.'}
      </p>

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
