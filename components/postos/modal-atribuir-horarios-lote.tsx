'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { ChevronDown, X } from 'lucide-react'
import {
  listarFuncionariosParaAtribuicaoLote,
  listarTurnosDoPosto,
  atribuirTurnoEmLote,
  type FuncionarioLoteRow,
} from '@/app/(admin)/efetivo/horario/actions'
import { formatarResumoTurno, resolverTipoEscala, ESCALA_LABEL, ESCALA_BADGE_CLASS, ESCALA_BORDER_CLASS } from '@/lib/turnos/escala'
import { cn } from '@/lib/utils'

type TurnoOpcao = {
  id: string
  nome: string
  hora_entrada: string
  hora_saida_seg_qui: string
  hora_saida_sex: string | null
  hora_inicio_almoco: string | null
  hora_fim_almoco: string | null
  tipo_escala: string
}

interface Props {
  postoId: string
  postoNome: string
  open: boolean
  onClose: () => void
}

function hoje(): string {
  return new Date().toISOString().slice(0, 10)
}

function fmtData(iso: string) {
  const [y, m, d] = iso.split('T')[0].split('-')
  return `${d}/${m}/${y}`
}

export function ModalAtribuirHorariosLote({ postoId, postoNome, open, onClose }: Props) {
  const [funcionarios, setFuncionarios] = useState<FuncionarioLoteRow[]>([])
  const [turnos, setTurnos]             = useState<TurnoOpcao[]>([])
  const [loading, setLoading]           = useState(false)
  const [turnoId, setTurnoId]           = useState('')
  const [dataInicio, setDataInicio]     = useState(hoje())
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())
  const [saving, setSaving]             = useState(false)
  const [resultado, setResultado] = useState<{ sucesso: string[]; falhas: { funcionarioId: string; erro: string }[] } | null>(null)
  const [turnoDropdownAberto, setTurnoDropdownAberto] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const [f, t] = await Promise.all([
        listarFuncionariosParaAtribuicaoLote(postoId),
        listarTurnosDoPosto(postoId),
      ])
      setFuncionarios(f)
      setTurnos(t as TurnoOpcao[])
    } finally {
      setLoading(false)
    }
  }, [postoId])

  useEffect(() => {
    if (open) { carregar(); setResultado(null); setSelecionados(new Set()); setTurnoId(''); setTurnoDropdownAberto(false) }
  }, [open, carregar])

  useEffect(() => {
    function onClickFora(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setTurnoDropdownAberto(false)
    }
    document.addEventListener('mousedown', onClickFora)
    return () => document.removeEventListener('mousedown', onClickFora)
  }, [])

  function toggle(id: string) {
    setSelecionados(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selecionarSemHorario() {
    setSelecionados(new Set(funcionarios.filter(f => !f.turno_atual_nome).map(f => f.id)))
  }

  async function handleAplicar() {
    if (!turnoId || selecionados.size === 0 || !dataInicio) return
    setSaving(true)
    const res = await atribuirTurnoEmLote(Array.from(selecionados), turnoId, dataInicio)
    setSaving(false)
    setResultado(res)
    carregar()
  }

  function nomeFuncionario(id: string) {
    return funcionarios.find(f => f.id === id)?.nome ?? id
  }

  if (!open) return null

  const turnoSelecionado = turnos.find(t => t.id === turnoId)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-visible rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Atribuir Horários em Lote</h2>
            <p className="text-sm text-gray-500">{postoNome}</p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto px-6 py-4">
          <div className="grid grid-cols-2 gap-3">
            <div ref={dropdownRef} className="relative">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-500">Turno</label>
              <button type="button" onClick={() => setTurnoDropdownAberto(p => !p)}
                className="flex w-full items-center justify-between rounded-lg border border-gray-200 px-3 py-2.5 text-left text-sm focus:outline-none focus:ring-1 focus:ring-gray-400">
                {turnoSelecionado ? (
                  <span className="flex items-center gap-2 truncate">
                    <span className="font-extrabold text-gray-900">{turnoSelecionado.nome}</span>
                    <span className={cn(
                      'shrink-0 inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-bold ring-1 ring-inset',
                      ESCALA_BADGE_CLASS[resolverTipoEscala(turnoSelecionado.tipo_escala)],
                    )}>
                      {ESCALA_LABEL[resolverTipoEscala(turnoSelecionado.tipo_escala)]}
                    </span>
                  </span>
                ) : (
                  <span className="text-gray-400">Selecione…</span>
                )}
                <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />
              </button>

              {turnoDropdownAberto && (
                <div className="absolute z-10 mt-1 max-h-72 w-full min-w-[22rem] overflow-y-auto rounded-lg border border-gray-200 bg-white p-1.5 shadow-lg">
                  {turnos.length === 0 ? (
                    <p className="px-3 py-2 text-sm text-gray-400">Nenhum turno cadastrado</p>
                  ) : (
                    turnos.map(t => {
                      const tipoTurno = resolverTipoEscala(t.tipo_escala)
                      return (
                        <button key={t.id} type="button"
                          onClick={() => { setTurnoId(t.id); setTurnoDropdownAberto(false) }}
                          className={cn(
                            'flex w-full flex-col items-start gap-0.5 rounded-md border-l-4 px-3 py-2 text-left hover:bg-gray-50',
                            ESCALA_BORDER_CLASS[tipoTurno],
                          )}>
                          <span className="flex items-center gap-2">
                            <span className="text-sm font-extrabold text-gray-900">{t.nome}</span>
                            <span className={cn(
                              'inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-bold ring-1 ring-inset',
                              ESCALA_BADGE_CLASS[tipoTurno],
                            )}>
                              {ESCALA_LABEL[tipoTurno]}
                            </span>
                          </span>
                          <span className="text-xs font-medium text-gray-500">{formatarResumoTurno(t)}</span>
                        </button>
                      )
                    })
                  )}
                </div>
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-500">Data de Início</label>
              <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-gray-400" />
            </div>
          </div>

          {turnos.length === 0 && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
              Nenhum turno cadastrado para este posto. Acesse <strong>Postos → Turnos</strong> para criar.
            </p>
          )}

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">
                Funcionários ({funcionarios.length})
              </p>
              <button type="button" onClick={selecionarSemHorario}
                className="text-xs font-medium text-slate-700 underline hover:text-slate-900">
                Selecionar todos sem horário
              </button>
            </div>

            {loading ? (
              <p className="text-sm text-gray-400">Carregando…</p>
            ) : funcionarios.length === 0 ? (
              <p className="text-sm text-gray-400">
                Nenhum funcionário elegível neste posto (jovens aprendizes são atribuídos individualmente no perfil).
              </p>
            ) : (
              <div className="max-h-72 space-y-1 overflow-y-auto rounded-lg border border-gray-100">
                {funcionarios.map(f => (
                  <label key={f.id}
                    className="flex cursor-pointer items-center justify-between gap-3 border-b border-gray-50 px-3 py-2.5 last:border-b-0 hover:bg-gray-50">
                    <span className="flex items-center gap-2.5">
                      <input type="checkbox" checked={selecionados.has(f.id)} onChange={() => toggle(f.id)}
                        className="h-4 w-4 rounded border-gray-300 accent-slate-900" />
                      <span className="text-sm font-semibold text-gray-800">{f.nome}</span>
                    </span>
                    {f.turno_atual_nome ? (
                      <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600">
                        {f.turno_atual_nome} — desde {fmtData(f.turno_atual_desde!)}
                      </span>
                    ) : (
                      <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-700">
                        Sem horário
                      </span>
                    )}
                  </label>
                ))}
              </div>
            )}
          </div>

          {resultado && (
            <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 text-sm">
              <p className="font-semibold text-gray-700">
                {resultado.sucesso.length} aplicado(s), {resultado.falhas.length} falharam
              </p>
              {resultado.falhas.length > 0 && (
                <ul className="mt-1.5 space-y-0.5 text-xs text-red-600">
                  {resultado.falhas.map(f => (
                    <li key={f.funcionarioId}>{nomeFuncionario(f.funcionarioId)}: {f.erro}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-100 px-6 py-3">
          <button type="button" onClick={onClose}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
            Fechar
          </button>
          <button type="button" onClick={handleAplicar}
            disabled={saving || !turnoId || selecionados.size === 0 || !dataInicio}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50">
            {saving ? 'Aplicando…' : `Aplicar a ${selecionados.size} selecionado(s)`}
          </button>
        </div>
      </div>
    </div>
  )
}
