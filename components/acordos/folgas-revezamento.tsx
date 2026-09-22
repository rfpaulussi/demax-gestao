'use client'

import type { MapaFeriados } from '@/lib/acordos/validar'
import { INPUT_CLS, INPUT_ERRO_CLS } from './passo'

export interface FuncionarioFolga { id: string; nome: string }

interface ModoProps {
  revezamento: boolean
  onModo: (revezamento: boolean) => void
}

interface Props {
  funcionarios: FuncionarioFolga[]
  folgas: Record<string, string>
  onFolga: (id: string, data: string) => void
  /** Preenche a mesma data para todos (atalho). */
  onTodos: (data: string) => void
  feriados: MapaFeriados
  /** Erro geral do campo (vermelho). */
  erro?: string
}

const modoCls = (ativo: boolean) =>
  `flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition ${ativo ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`

/** Escolha entre "todos folgam no mesmo dia" e "revezamento" (uma data de folga por funcionário). */
export function SeletorModoFolga({ revezamento, onModo }: ModoProps) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-bold uppercase tracking-widest text-slate-500">Quem folga em cada dia?</p>
      <div role="tablist" className="flex gap-1 rounded-lg border border-gray-200 bg-white p-1">
        <button type="button" role="tab" aria-selected={!revezamento} onClick={() => onModo(false)} className={modoCls(!revezamento)}>
          Todos no mesmo dia
        </button>
        <button type="button" role="tab" aria-selected={revezamento} onClick={() => onModo(true)} className={modoCls(revezamento)}>
          Revezamento (cada um na sua data)
        </button>
      </div>
      <p className="mt-1 text-xs text-gray-400">
        {revezamento
          ? 'Cada funcionário folga em uma data diferente e o posto continua coberto pelos demais.'
          : 'Todos folgam na mesma data; o posto fica sem esses funcionários nesse dia.'}
      </p>
    </div>
  )
}

/** Uma data de folga por funcionário selecionado. */
export function FolgasRevezamento({ funcionarios, folgas, onFolga, onTodos, feriados, erro }: Props) {
  if (funcionarios.length === 0) {
    return <p className="text-xs text-gray-500">Selecione os funcionários no passo 2 para definir a folga de cada um.</p>
  }
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="folga-todos" className="text-xs font-semibold text-slate-500">Mesma data para todos:</label>
        <input id="folga-todos" type="date" onChange={e => e.target.value && onTodos(e.target.value)} className={`max-w-[10rem] ${INPUT_CLS}`} />
      </div>
      <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
        {funcionarios.map(fn => {
          const data = folgas[fn.id] ?? ''
          const fer = data ? feriados.get(data) : undefined
          return (
            <li key={fn.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
              <span className="min-w-0 flex-1 truncate text-sm text-slate-800">{fn.nome}</span>
              <input
                type="date"
                aria-label={`Data da folga de ${fn.nome}`}
                value={data}
                onChange={e => onFolga(fn.id, e.target.value)}
                className={`w-40 ${erro && !data ? INPUT_ERRO_CLS : INPUT_CLS}`}
              />
              {fer && <span className="w-full text-[11px] font-medium text-amber-700">{fer.nome}</span>}
            </li>
          )
        })}
      </ul>
      {erro && <p className="text-xs font-medium text-red-600">{erro}</p>}
    </div>
  )
}
