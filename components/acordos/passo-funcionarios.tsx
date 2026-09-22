'use client'

import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import type { AcordoPostoItem, FuncionarioParaAcordo } from '@/app/(admin)/acordos/actions'
import { INPUT_CLS, LABEL_CLS } from './passo'

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  ativo:    { label: 'Ativo',    cls: 'bg-green-100 text-green-700' },
  ferias:   { label: 'Férias',   cls: 'bg-orange-100 text-orange-700' },
  afastado: { label: 'Afastado', cls: 'bg-red-100 text-red-700' },
  atestado: { label: 'Atestado', cls: 'bg-amber-100 text-amber-700' },
  faltante: { label: 'Faltante', cls: 'bg-yellow-100 text-yellow-700' },
}

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const entra = (f: FuncionarioParaAcordo) => f.elegivel && (f.status === 'ativo' || f.status === 'ferias')

interface Props {
  postos: AcordoPostoItem[]
  tipo: 'individual' | 'coletivo'
  postosSel: string[]
  onTogglePosto: (id: string) => void
  funcs: FuncionarioParaAcordo[]
  selectedIds: Set<string>
  onToggleFunc: (id: string) => void
  onSetSelecionados: (ids: Set<string>) => void
  loading: boolean
  /** Mensagem vermelha (pendência visível). */
  erro?: string | null
}

export function PassoFuncionarios({
  postos, tipo, postosSel, onTogglePosto, funcs, selectedIds, onToggleFunc, onSetSelecionados, loading, erro,
}: Props) {
  const [busca, setBusca] = useState('')

  const { incluidos, naoIncluidos } = useMemo(() => {
    const q = semAcento(busca.trim())
    const visiveis = q ? funcs.filter(f => semAcento(f.nome).includes(q)) : funcs
    return { incluidos: visiveis.filter(entra), naoIncluidos: visiveis.filter(f => !entra(f)) }
  }, [funcs, busca])

  const totalElegiveis = funcs.filter(f => f.elegivel).length
  const totalNaoIncluidos = funcs.filter(f => !entra(f)).length

  function marcarTodos() {
    const next = new Set(selectedIds)
    for (const f of incluidos) next.add(f.id)
    onSetSelecionados(next)
  }

  const linha = (x: FuncionarioParaAcordo) => {
    const badge = STATUS_BADGE[x.status]
    return (
      <label key={x.id} className={`flex items-center gap-3 px-3 py-2 ${x.elegivel ? 'cursor-pointer hover:bg-slate-50' : 'bg-gray-50 opacity-70'}`}>
        <input
          type="checkbox"
          checked={selectedIds.has(x.id)}
          disabled={!x.elegivel}
          onChange={() => onToggleFunc(x.id)}
          className="shrink-0 accent-slate-900"
        />
        <span className="min-w-0 flex-1 text-sm text-gray-800">
          {x.nome}
          {!x.elegivel && <span className="block text-xs text-red-600">{x.motivo_inelegivel ?? 'Escala não elegível a acordo de compensação'}</span>}
          {x.elegivel && !entra(x) && <span className="block text-xs text-gray-500">Fora por padrão (status {x.status}). Marque para incluir mesmo assim.</span>}
          {x.elegivel && x.sem_turno && <span className="block text-xs text-amber-700">Sem horário cadastrado. Usando o padrão 5x2 de 44h.</span>}
        </span>
        {x.funcao && <span className="hidden shrink-0 text-xs text-gray-400 sm:inline">{x.funcao}</span>}
        {badge && <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-xs font-medium ${badge.cls}`}>{badge.label}</span>}
      </label>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <p className={`${LABEL_CLS} mb-1.5`}>Em qual posto? {tipo === 'coletivo' && <span className="normal-case tracking-normal text-slate-400">(pode marcar vários)</span>}</p>
        <div className="max-h-40 divide-y divide-gray-50 overflow-y-auto rounded-xl border border-gray-200">
          {postos.filter(p => !p.nome.startsWith('AFASTADO')).map(p => (
            <label key={p.id} className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-slate-50">
              <input
                type={tipo === 'individual' ? 'radio' : 'checkbox'}
                checked={postosSel.includes(p.id)}
                onChange={() => onTogglePosto(p.id)}
                className="shrink-0 accent-slate-900"
              />
              <span className="text-sm text-gray-800">{p.nome}</span>
              {p.secretaria && <span className="ml-auto shrink-0 text-xs text-gray-400">{p.secretaria}</span>}
            </label>
          ))}
        </div>
      </div>

      <div>
        <p className={`${LABEL_CLS} mb-1.5`}>Quem participa?</p>
        {postosSel.length === 0 && <p className="text-sm text-gray-400">Escolha um posto acima para listar os funcionários.</p>}
        {loading && <p className="text-sm text-gray-400">Carregando…</p>}
        {funcs.length > 0 && (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[10rem] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por nome" className={`${INPUT_CLS} pl-9`} aria-label="Buscar funcionário por nome" />
              </div>
              <button type="button" onClick={marcarTodos} className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                Marcar todos
              </button>
              <button type="button" onClick={() => onSetSelecionados(new Set())} className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                Limpar
              </button>
              <span className="text-xs font-semibold text-slate-500">{selectedIds.size} de {totalElegiveis}</span>
            </div>

            <div className="max-h-56 divide-y divide-gray-50 overflow-y-auto rounded-xl border border-gray-200">
              {incluidos.length > 0
                ? incluidos.map(linha)
                : <p className="px-3 py-3 text-sm text-gray-400">{busca ? 'Nenhum funcionário encontrado.' : 'Nenhum funcionário elegível ativo neste posto.'}</p>}
            </div>

            {totalNaoIncluidos > 0 && (
              <details className="rounded-xl border border-gray-200">
                <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-slate-600">Não incluídos ({totalNaoIncluidos})</summary>
                <div className="divide-y divide-gray-50 border-t border-gray-100">{naoIncluidos.map(linha)}</div>
              </details>
            )}
          </div>
        )}
        {erro && <p className="mt-1.5 text-xs font-medium text-red-600">{erro}</p>}
      </div>
    </div>
  )
}
