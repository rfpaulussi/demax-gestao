'use client'

import { useState } from 'react'
import type { ParticipanteEvento } from '@/lib/acordos/tipos'
import type { MapaFeriados } from '@/lib/acordos/validar'
import { interpretarPlanilha } from '@/lib/acordos/colar'
import { HoraSelect } from './hora-select'
import { INPUT_CLS, INPUT_ERRO_CLS } from './passo'

interface Props {
  funcionarios: { id: string; nome: string }[]
  participantes: Record<string, ParticipanteEvento>
  onChange: (p: Record<string, ParticipanteEvento>) => void
  /** Data do evento: a planilha colada só traz dia/mês, o ano sai daqui. */
  dataEvento: string
  feriados: MapaFeriados
  erro?: string
}

const VAZIO: ParticipanteEvento = { inicio: '', fim: '', folgas: [''] }

const MODELO = [
  { horario: '08h às 12:30h', funcionario: 'Amanda Gonçalves', folga: '23/12' },
  { horario: '13:30h às 18h', funcionario: 'Irani Matilde da Costa', folga: '29/12' },
  { horario: '08h às 18h', funcionario: 'Marília Rosana do Patrocínio', folga: '28/12 e 29/12' },
]

/** Planilha de referência com as 3 colunas que a colagem entende (texto puro, para o Excel não converter "23/12" em data). */
async function baixarModelo() {
  const { exportToExcel } = await import('@/lib/export-excel')
  exportToExcel(MODELO, [
    { label: 'Horário', value: r => r.horario, asText: true },
    { label: 'Funcionário', value: r => r.funcionario, asText: true },
    { label: 'Folga', value: r => r.folga, asText: true },
  ], 'modelo-acordo-folga-dias-inteiros.xlsx')
}

/** T5 em dias inteiros: período trabalhado e dias de folga de cada funcionário (1 ou mais), com colagem da planilha. */
export function ParticipantesEvento({ funcionarios, participantes, onChange, dataEvento, feriados, erro }: Props) {
  const [texto, setTexto] = useState('')
  const [problemas, setProblemas] = useState<string[]>([])
  const [aplicadas, setAplicadas] = useState<number | null>(null)

  if (funcionarios.length === 0) {
    return <p className="text-xs text-gray-500">Selecione os funcionários no passo 2 para definir período e folgas de cada um.</p>
  }

  const de = (id: string) => participantes[id] ?? VAZIO
  const mudar = (id: string, p: Partial<ParticipanteEvento>) => onChange({ ...participantes, [id]: { ...de(id), ...p } })

  function aplicarColagem() {
    if (!dataEvento) { setProblemas(['Informe primeiro a data do evento (o ano das folgas sai dela).']); setAplicadas(null); return }
    const r = interpretarPlanilha(texto, funcionarios, dataEvento)
    onChange({ ...participantes, ...r.participantes })
    setProblemas(r.problemas)
    setAplicadas(Object.keys(r.participantes).length)
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5 rounded-lg border border-dashed border-gray-300 bg-white p-3">
        <label htmlFor="colar-planilha" className="text-xs font-semibold text-slate-500">Colar da planilha (horário, funcionário e folgas)</label>
        <textarea
          id="colar-planilha"
          rows={3}
          value={texto}
          onChange={e => setTexto(e.target.value)}
          placeholder={'08h às 12:30h\tAmanda Gonçalves\t23/12\n08h às 18h\tMarília Rosana do Patrocínio\t28/12 e 29/12'}
          className={`${INPUT_CLS} font-mono text-xs`}
        />
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={aplicarColagem} disabled={!texto.trim()} className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-40">
            Aplicar
          </button>
          <button type="button" onClick={baixarModelo} className="text-xs font-medium text-slate-600 underline hover:text-slate-900">
            Baixar modelo (Excel)
          </button>
          {aplicadas !== null && <span className="text-xs text-slate-600">{aplicadas} funcionário(s) preenchido(s)</span>}
        </div>
        {problemas.length > 0 && (
          <ul className="list-disc space-y-0.5 pl-5 text-xs font-medium text-amber-700">
            {problemas.map((p, i) => <li key={i}>{p}</li>)}
          </ul>
        )}
      </div>

      <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
        {funcionarios.map(fn => {
          const p = de(fn.id)
          const faltaPeriodo = !!erro && (!p.inicio || !p.fim)
          const faltaFolga = !!erro && p.folgas.filter(Boolean).length === 0
          return (
            <li key={fn.id} className="space-y-1.5 px-3 py-2">
              <p className="truncate text-sm font-medium text-slate-800">{fn.nome}</p>
              <div className="flex flex-wrap items-center gap-2">
                <HoraSelect aria-label={`Início de ${fn.nome}`} value={p.inicio} onChange={v => mudar(fn.id, { inicio: v })} className={`w-28 ${faltaPeriodo ? INPUT_ERRO_CLS : INPUT_CLS}`} />
                <span className="text-xs text-slate-400">às</span>
                <HoraSelect aria-label={`Fim de ${fn.nome}`} value={p.fim} onChange={v => mudar(fn.id, { fim: v })} className={`w-28 ${faltaPeriodo ? INPUT_ERRO_CLS : INPUT_CLS}`} />
                <span className="mx-1 text-xs text-slate-400">folga:</span>
                {p.folgas.map((d, i) => (
                  <span key={i} className="inline-flex items-center gap-1">
                    <input
                      type="date"
                      aria-label={`Folga ${i + 1} de ${fn.nome}`}
                      value={d}
                      onChange={e => mudar(fn.id, { folgas: p.folgas.map((x, j) => (j === i ? e.target.value : x)) })}
                      className={`w-36 ${faltaFolga ? INPUT_ERRO_CLS : INPUT_CLS}`}
                    />
                    {p.folgas.length > 1 && (
                      <button type="button" aria-label="Remover folga" onClick={() => mudar(fn.id, { folgas: p.folgas.filter((_, j) => j !== i) })} className="text-xs text-slate-400 hover:text-slate-700">×</button>
                    )}
                  </span>
                ))}
                <button type="button" onClick={() => mudar(fn.id, { folgas: [...p.folgas, ''] })} className="text-xs font-medium text-slate-600 underline hover:text-slate-900">+ dia</button>
              </div>
              {p.folgas.some(d => d && feriados.get(d)) && (
                <p className="text-[11px] font-medium text-amber-700">
                  {p.folgas.filter(d => d && feriados.get(d)).map(d => feriados.get(d)!.nome).join(', ')}
                </p>
              )}
            </li>
          )
        })}
      </ul>
      {erro && <p className="text-xs font-medium text-red-600">{erro}</p>}
    </div>
  )
}
