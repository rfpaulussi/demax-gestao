'use client'

import { useMemo, useRef, useState, type ChangeEvent } from 'react'
import type { ParticipanteEvento } from '@/lib/acordos/tipos'
import type { MapaFeriados } from '@/lib/acordos/validar'
import { interpretarPlanilha } from '@/lib/acordos/colar'
import { HoraInput } from './hora-input'
import { planilhaParaTexto } from '@/lib/acordos/planilha-arquivo'
import { INPUT_CLS, INPUT_ERRO_CLS } from './passo'

interface Props {
  funcionarios: { id: string; nome: string }[]
  participantes: Record<string, ParticipanteEvento>
  onChange: (p: Record<string, ParticipanteEvento>) => void
  feriados: MapaFeriados
  erro?: string
}

const VAZIO: ParticipanteEvento = { inicio: '', fim: '', folgas: [''] }

/** Períodos sempre oferecidos (além dos que já foram preenchidos na lista). */
const PERIODOS_PADRAO: [string, string][] = [['07:00', '12:00'], ['13:00', '17:00'], ['08:00', '13:00'], ['13:00', '18:00']]

const brData = (iso: string) => (iso ? iso.split('-').reverse().join('/') : '')
const horaPlanilha = (hhmm: string) => (hhmm ? hhmm.replace(/^0/, '') : '')

/** Planilha com os funcionários do acordo já listados (e o que já foi preenchido); só falta completar horário e folgas. Texto puro, para o Excel não converter as datas. */
async function baixarModelo(funcionarios: { id: string; nome: string }[], participantes: Record<string, ParticipanteEvento>) {
  const { exportToExcel } = await import('@/lib/export-excel')
  const linhas = funcionarios.map(f => {
    const p = participantes[f.id]
    return {
      funcionario: f.nome,
      inicio: horaPlanilha(p?.inicio ?? ''),
      fim: horaPlanilha(p?.fim ?? ''),
      folga1: brData(p?.folgas[0] ?? ''),
      folga2: brData(p?.folgas[1] ?? ''),
    }
  })
  exportToExcel(linhas, [
    { label: 'Funcionário', value: r => r.funcionario, asText: true },
    { label: 'Início', value: r => r.inicio, asText: true },
    { label: 'Fim', value: r => r.fim, asText: true },
    { label: 'Folga 1', value: r => r.folga1, asText: true },
    { label: 'Folga 2', value: r => r.folga2, asText: true },
  ], 'acordo-folga-dias-inteiros.xlsx')
}

/** '07:00' → '7', '08:30' → '8:30', '13:00' → '13' (rótulo curto do botão). */
const horaCurta = (hhmm: string) => hhmm.replace(/^0/, '').replace(/:00$/, '')

const chipCls = (ativo: boolean) =>
  `rounded-full border px-2 py-0.5 text-[11px] font-semibold transition ${
    ativo ? 'border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-500' : 'border-gray-200 bg-white text-slate-600 hover:border-gray-300 hover:bg-slate-50'
  }`

/** Manhã (termina até 13h), tarde (começa a partir das 12h) ou dia todo: cor e nome para achar a linha de relance. */
function tipoDoPeriodo(p: ParticipanteEvento): { nome: string; borda: string; etiqueta: string } | null {
  if (!p.inicio || !p.fim) return null
  if (p.fim <= '13:00') return { nome: 'Manhã', borda: 'border-l-amber-400', etiqueta: 'bg-amber-100 text-amber-800' }
  if (p.inicio >= '12:00') return { nome: 'Tarde', borda: 'border-l-indigo-400', etiqueta: 'bg-indigo-100 text-indigo-800' }
  return { nome: 'Dia todo', borda: 'border-l-green-500', etiqueta: 'bg-green-100 text-green-800' }
}

const rotuloCls = 'rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest'

/** T5 em dias inteiros: período trabalhado e dias de folga de cada funcionário (1 ou mais), com colagem da planilha. */
export function ParticipantesEvento({ funcionarios, participantes, onChange, feriados, erro }: Props) {
  const [texto, setTexto] = useState('')
  const [problemas, setProblemas] = useState<string[]>([])
  const [aplicadas, setAplicadas] = useState<number | null>(null)
  const arquivoRef = useRef<HTMLInputElement>(null)

  // atalhos de período: os já usados na lista (1 clique repete), completados com os comuns
  const periodos = useMemo(() => {
    const usados = new Map<string, [string, string]>()
    for (const f of funcionarios) {
      const p = participantes[f.id]
      if (p?.inicio && p?.fim) usados.set(`${p.inicio}|${p.fim}`, [p.inicio, p.fim])
    }
    for (const d of PERIODOS_PADRAO) usados.set(`${d[0]}|${d[1]}`, d)
    return Array.from(usados.values()).sort((a, b) => (a[0] + a[1]).localeCompare(b[0] + b[1]))
  }, [funcionarios, participantes])

  if (funcionarios.length === 0) {
    return <p className="text-xs text-gray-500">Selecione os funcionários no passo 2 para definir período e folgas de cada um.</p>
  }

  const de = (id: string) => participantes[id] ?? VAZIO
  const mudar = (id: string, p: Partial<ParticipanteEvento>) => onChange({ ...participantes, [id]: { ...de(id), ...p } })

  function aplicarColagem(t: string = texto) {
    const r = interpretarPlanilha(t, funcionarios)
    onChange({ ...participantes, ...r.participantes })
    setProblemas(r.problemas)
    setAplicadas(Object.keys(r.participantes).length)
  }

  async function enviarArquivo(e: ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0]
    e.target.value = '' // permite enviar o mesmo arquivo de novo
    if (!arquivo) return
    try {
      const t = await planilhaParaTexto(arquivo)
      setTexto(t)
      aplicarColagem(t)
    } catch {
      setProblemas(['Não foi possível ler o arquivo. Envie um .xlsx ou .xls, ou cole as linhas no campo.'])
      setAplicadas(null)
    }
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5 rounded-lg border border-dashed border-gray-300 bg-white p-3">
        <label htmlFor="colar-planilha" className="text-xs font-semibold text-slate-500">Colar da planilha</label>
        <p className="text-[11px] text-gray-400">
          Colunas: Funcionário, Início, Fim, Folga 1, Folga 2. Horário do jeito que for (8, 8:15, 9, 12:30, 1800) e data com ano (23/12/2026).
        </p>
        <textarea
          id="colar-planilha"
          rows={3}
          value={texto}
          onChange={e => setTexto(e.target.value)}
          placeholder={'Amanda Gonçalves\t8:00\t12:30\t23/12/2026\nMarília Rosana do Patrocínio\t8:00\t18:00\t28/12/2026\t29/12/2026'}
          className={`${INPUT_CLS} font-mono text-xs`}
        />
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => aplicarColagem()} disabled={!texto.trim()} className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-40">
            Aplicar
          </button>
          <input ref={arquivoRef} type="file" accept=".xlsx,.xls" onChange={enviarArquivo} className="hidden" aria-label="Enviar planilha Excel" />
          <button type="button" onClick={() => arquivoRef.current?.click()} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
            Enviar planilha (.xlsx)
          </button>
          <button type="button" onClick={() => baixarModelo(funcionarios, participantes)} className="text-xs font-medium text-slate-600 underline hover:text-slate-900">
            Baixar planilha com os funcionários (Excel)
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
          const tipo = tipoDoPeriodo(p)
          return (
            <li key={fn.id} className={`space-y-1.5 border-l-4 px-3 py-2 ${tipo?.borda ?? 'border-l-gray-200'}`}>
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <p className="flex min-w-0 items-center gap-2 text-sm font-medium text-slate-800">
                  <span className="truncate">{fn.nome}</span>
                  {tipo && <span className={`shrink-0 ${rotuloCls} ${tipo.etiqueta}`}>{tipo.nome}</span>}
                </p>
                <div className="flex flex-wrap gap-1" role="group" aria-label={`Período de ${fn.nome}`}>
                  {periodos.map(([i, f]) => (
                    <button key={`${i}|${f}`} type="button" onClick={() => mudar(fn.id, { inicio: i, fim: f })} className={chipCls(p.inicio === i && p.fim === f)}>
                      {horaCurta(i)}–{horaCurta(f)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`${rotuloCls} bg-blue-100 text-blue-800`}>Início</span>
                <HoraInput aria-label={`Início de ${fn.nome}`} value={p.inicio} onChange={v => mudar(fn.id, { inicio: v })} className={`!w-20 ${faltaPeriodo ? INPUT_ERRO_CLS : INPUT_CLS}`} />
                <span className={`${rotuloCls} bg-orange-100 text-orange-800`}>Fim</span>
                <HoraInput aria-label={`Fim de ${fn.nome}`} value={p.fim} onChange={v => mudar(fn.id, { fim: v })} className={`!w-20 ${faltaPeriodo ? INPUT_ERRO_CLS : INPUT_CLS}`} />
                <span className={`ml-1 ${rotuloCls} bg-emerald-100 text-emerald-800`}>Folga</span>
                {p.folgas.map((d, i) => (
                  <span key={i} className="inline-flex items-center gap-1">
                    <input
                      type="date"
                      aria-label={`Folga ${i + 1} de ${fn.nome}`}
                      value={d}
                      onChange={e => mudar(fn.id, { folgas: p.folgas.map((x, j) => (j === i ? e.target.value : x)) })}
                      className={`!w-36 ${faltaFolga ? INPUT_ERRO_CLS : INPUT_CLS}`}
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
