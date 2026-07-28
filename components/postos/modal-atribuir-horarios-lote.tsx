'use client'

import { useState, useEffect, useCallback } from 'react'
import { X } from 'lucide-react'
import {
  listarFuncionariosParaAtribuicaoLote,
  listarTurnosDoPosto,
  atribuirTurnoEmLote,
  type FuncionarioLoteRow,
} from '@/app/(admin)/efetivo/horario/actions'
import { formatarResumoTurno } from '@/lib/turnos/escala'

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
    if (open) { carregar(); setResultado(null); setSelecionados(new Set()) }
  }, [open, carregar])

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h2 className="text-base font-bold text-gray-900">Atribuir Horários em Lote</h2>
            <p className="text-xs text-gray-400">{postoNome}</p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-500">Turno</label>
              <select value={turnoId} onChange={e => setTurnoId(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400">
                <option value="">Selecione…</option>
                {turnos.map(t => (
                  <option key={t.id} value={t.id}>{t.nome} — {formatarResumoTurno(t)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-500">Data de Início</label>
              <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400" />
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
                    className="flex cursor-pointer items-center justify-between gap-3 border-b border-gray-50 px-3 py-2 last:border-b-0 hover:bg-gray-50">
                    <span className="flex items-center gap-2">
                      <input type="checkbox" checked={selecionados.has(f.id)} onChange={() => toggle(f.id)}
                        className="h-4 w-4 rounded border-gray-300 accent-slate-900" />
                      <span className="text-sm text-gray-800">{f.nome}</span>
                    </span>
                    {f.turno_atual_nome ? (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                        {f.turno_atual_nome} — desde {fmtData(f.turno_atual_desde!)}
                      </span>
                    ) : (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
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
