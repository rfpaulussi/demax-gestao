'use client'

import { useState, useEffect, useCallback } from 'react'
import { Clock, Plus, Pencil, X } from 'lucide-react'
import {
  listarTurnosPosto,
  criarTurno,
  editarTurno,
  desativarTurno,
  type TurnoData,
} from '@/app/(admin)/postos/turnos/actions'
import type { TurnoPosto } from '@/types'

// ─── helpers ──────────────────────────────────────────────────────────────────

function minutosParaHora(min: number): string {
  const h = Math.floor(min / 60) % 24
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function horaParaMinutos(hora: string): number {
  const [h, m] = hora.split(':').map(Number)
  return h * 60 + m
}

// Padrão 5x2 44h: entrada às 07h, almoço 12h-13h12, saída 17h (seg-qui), 16h (sex)
const BASE_ENTRADA_MIN = 7 * 60        // 07:00
const BASE_ALMOCO_INICIO_MIN = 12 * 60 // 12:00
const BASE_ALMOCO_FIM_MIN = 13 * 60 + 12 // 13:12
const BASE_SAIDA_SEGQUI_MIN = 17 * 60  // 17:00
const BASE_SAIDA_SEX_MIN = 16 * 60     // 16:00

function calcularHorariosDerivados(horaEntrada: string) {
  const entradaMin = horaParaMinutos(horaEntrada)
  const delta = entradaMin - BASE_ENTRADA_MIN
  return {
    hora_inicio_almoco:  minutosParaHora(BASE_ALMOCO_INICIO_MIN + delta),
    hora_fim_almoco:     minutosParaHora(BASE_ALMOCO_FIM_MIN + delta),
    hora_saida_seg_qui:  minutosParaHora(BASE_SAIDA_SEGQUI_MIN + delta),
    hora_saida_sex:      minutosParaHora(BASE_SAIDA_SEX_MIN + delta),
  }
}

function fmt(h: string) {
  // recebe "HH:MM:SS" do banco, retorna "HH:MM"
  return h.slice(0, 5)
}

// ─── component ────────────────────────────────────────────────────────────────

interface Props {
  postoId: string
  postoNome: string
  open: boolean
  onClose: () => void
  role?: string
}

export function ModalTurnosPosto({ postoId, postoNome, open, onClose, role }: Props) {
  const [turnos, setTurnos]         = useState<TurnoPosto[]>([])
  const [loading, setLoading]       = useState(false)
  const [form, setForm]             = useState<'novo' | TurnoPosto | null>(null)
  const [saving, setSaving]         = useState(false)
  const [erro, setErro]             = useState<string | null>(null)

  // form fields
  const [nome, setNome]                 = useState('')
  const [horaEntrada, setHoraEntrada]   = useState('07:00')

  const canWrite = role === 'admin' || role === 'coordenador'

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      setTurnos(await listarTurnosPosto(postoId))
    } finally {
      setLoading(false)
    }
  }, [postoId])

  useEffect(() => {
    if (open) carregar()
  }, [open, carregar])

  function abrirNovo() {
    setForm('novo')
    setNome('')
    setHoraEntrada('07:00')
    setErro(null)
  }

  function abrirEditar(t: TurnoPosto) {
    setForm(t)
    setNome(t.nome)
    setHoraEntrada(fmt(t.hora_entrada))
    setErro(null)
  }

  function fecharForm() {
    setForm(null)
    setErro(null)
  }

  async function handleSalvar() {
    if (!nome.trim()) { setErro('Informe o nome do turno'); return }
    setSaving(true)
    setErro(null)
    const derivados = calcularHorariosDerivados(horaEntrada)
    const dados: TurnoData = {
      nome: nome.trim(),
      hora_entrada: horaEntrada,
      ...derivados,
    }
    const res = form === 'novo'
      ? await criarTurno(postoId, dados)
      : await editarTurno((form as TurnoPosto).id, dados)
    setSaving(false)
    if (!res.success) { setErro(res.error ?? 'Erro ao salvar'); return }
    fecharForm()
    carregar()
  }

  async function handleDesativar(t: TurnoPosto) {
    if (!confirm(`Desativar turno "${t.nome}"?`)) return
    setSaving(true)
    await desativarTurno(t.id)
    setSaving(false)
    carregar()
  }

  if (!open) return null

  const derivados = calcularHorariosDerivados(horaEntrada)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
        {/* header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h2 className="text-base font-bold text-gray-900">Turnos de trabalho</h2>
            <p className="text-xs text-gray-400">{postoNome}</p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          {/* lista de turnos */}
          {loading ? (
            <p className="text-sm text-gray-400">Carregando...</p>
          ) : turnos.length === 0 ? (
            <p className="text-sm text-gray-400">Nenhum turno cadastrado para este posto.</p>
          ) : (
            <div className="space-y-2">
              {turnos.map(t => (
                <div key={t.id} className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-4 py-2.5">
                  <div className="flex items-center gap-3">
                    <Clock className="h-4 w-4 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{t.nome}</p>
                      <p className="text-xs text-gray-500">
                        Seg–Qui: {fmt(t.hora_entrada)}–{fmt(t.hora_saida_seg_qui)}{' '}
                        (almoço {fmt(t.hora_inicio_almoco)}–{fmt(t.hora_fim_almoco)})
                        {'  '}Sex: até {fmt(t.hora_saida_sex)}
                      </p>
                    </div>
                  </div>
                  {canWrite && (
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => abrirEditar(t)}
                        className="text-gray-400 hover:text-gray-700" title="Editar">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" onClick={() => handleDesativar(t)} disabled={saving}
                        className="text-gray-400 hover:text-red-600 disabled:opacity-40" title="Desativar">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* form de novo/editar turno */}
          {form !== null && canWrite && (
            <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
              <p className="text-sm font-semibold text-gray-700">
                {form === 'novo' ? 'Novo turno' : 'Editar turno'}
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-500">Nome</label>
                  <input value={nome} onChange={e => setNome(e.target.value)}
                    placeholder="Ex: Turno 7h"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-500">Horário de entrada</label>
                  <input type="time" value={horaEntrada} onChange={e => setHoraEntrada(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400" />
                </div>
              </div>

              {/* preview calculado */}
              <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-gray-500 space-y-0.5">
                <p className="font-medium text-gray-700 mb-1">Horários calculados automaticamente (44h/semana):</p>
                <p>Almoço: {derivados.hora_inicio_almoco} às {derivados.hora_fim_almoco}</p>
                <p>Saída Seg–Qui: {derivados.hora_saida_seg_qui}</p>
                <p>Saída Sex: {derivados.hora_saida_sex}</p>
              </div>

              {erro && <p className="text-xs text-red-600">{erro}</p>}

              <div className="flex justify-end gap-2">
                <button type="button" onClick={fecharForm}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50">
                  Cancelar
                </button>
                <button type="button" onClick={handleSalvar} disabled={saving}
                  className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50">
                  {saving ? 'Salvando…' : 'Salvar'}
                </button>
              </div>
            </div>
          )}

          {/* botão novo turno */}
          {canWrite && form === null && (
            <button type="button" onClick={abrirNovo}
              className="flex items-center gap-1.5 text-sm font-medium text-slate-700 hover:text-slate-900">
              <Plus className="h-4 w-4" />
              Novo turno
            </button>
          )}
        </div>

        <div className="border-t border-gray-100 px-6 py-3 flex justify-end">
          <button type="button" onClick={onClose}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}
