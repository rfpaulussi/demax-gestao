'use client'

import { useState, useEffect, useCallback } from 'react'
import { Clock, Plus, Pencil, X } from 'lucide-react'
import {
  listarTurnosPosto,
  criarTurno,
  editarTurno,
  desativarTurno,
  obterRegimePosto,
  type TurnoData,
} from '@/app/(admin)/postos/turnos/actions'
import { saveEscala } from '@/app/(admin)/fechamento/config-escalas/actions'
import {
  TIPOS_ESCALA,
  type TipoEscala,
  calcularHorariosDerivados,
  resolverTipoEscala,
  ESCALA_LABEL,
  ESCALA_BADGE_CLASS,
  ESCALA_BORDER_CLASS,
  formatarResumoTurno,
} from '@/lib/turnos/escala'
import { cn } from '@/lib/utils'
import type { TurnoPosto } from '@/types'

interface Props {
  postoId: string
  postoNome: string
  open: boolean
  onClose: () => void
  role?: string
}

export function ModalTurnosPosto({ postoId, postoNome, open, onClose, role }: Props) {
  const [turnos, setTurnos]         = useState<TurnoPosto[]>([])
  const [regime, setRegime]         = useState<TipoEscala | null | undefined>(undefined) // undefined = carregando
  const [loading, setLoading]       = useState(false)
  const [form, setForm]             = useState<'novo' | TurnoPosto | null>(null)
  const [saving, setSaving]         = useState(false)
  const [erro, setErro]             = useState<string | null>(null)

  const [salvandoRegime, setSalvandoRegime] = useState(false)
  const [erroRegime, setErroRegime]         = useState<string | null>(null)

  // form fields
  const [nome, setNome]                 = useState('')
  const [horaEntrada, setHoraEntrada]   = useState('07:00')

  const canWrite = role === 'admin' || role === 'coordenador'

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const [turnosData, regimeData] = await Promise.all([
        listarTurnosPosto(postoId),
        obterRegimePosto(postoId),
      ])
      setTurnos(turnosData)
      setRegime(regimeData)
    } finally {
      setLoading(false)
    }
  }, [postoId])

  useEffect(() => {
    if (open) carregar()
  }, [open, carregar])

  function abrirNovo() {
    if (!regime) return
    setForm('novo')
    setNome('')
    setHoraEntrada('07:00')
    setErro(null)
  }

  function abrirEditar(t: TurnoPosto) {
    setForm(t)
    setNome(t.nome)
    setHoraEntrada(t.hora_entrada.slice(0, 5))
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
    const dados: TurnoData = { nome: nome.trim(), hora_entrada: horaEntrada }
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

  async function handleDefinirRegime(tipo: TipoEscala) {
    setSalvandoRegime(true)
    setErroRegime(null)
    const res = await saveEscala(postoId, tipo)
    setSalvandoRegime(false)
    if (!res.ok) { setErroRegime(res.error ?? 'Erro ao salvar regime'); return }
    setRegime(tipo)
  }

  if (!open) return null

  const tipoEscalaForm: TipoEscala | null =
    form === 'novo' ? (regime ?? null) : form ? resolverTipoEscala(form.tipo_escala) : null

  const derivados = tipoEscalaForm ? calcularHorariosDerivados(horaEntrada, tipoEscalaForm) : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
        {/* header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h2 className="text-base font-bold text-gray-900">Turnos de trabalho</h2>
            <div className="mt-0.5 flex items-center gap-2">
              <p className="text-xs text-gray-400">{postoNome}</p>
              {regime && (
                <span className={cn(
                  'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ring-inset',
                  ESCALA_BADGE_CLASS[regime],
                )}>
                  {ESCALA_LABEL[regime]}
                </span>
              )}
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          {/* aviso: posto sem regime configurado */}
          {regime === null && (
            <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-sm text-amber-800">
                Este posto ainda não tem um regime de trabalho definido. Selecione um regime para poder cadastrar turnos.
              </p>
              <div className="flex flex-wrap gap-2">
                {TIPOS_ESCALA.map(tipo => (
                  <button
                    key={tipo}
                    type="button"
                    disabled={salvandoRegime}
                    onClick={() => handleDefinirRegime(tipo)}
                    className={cn(
                      'rounded-lg px-3 py-1.5 text-xs font-semibold ring-1 ring-inset transition-opacity hover:opacity-80 disabled:opacity-50',
                      ESCALA_BADGE_CLASS[tipo],
                    )}
                  >
                    {ESCALA_LABEL[tipo]}
                  </button>
                ))}
              </div>
              {erroRegime && <p className="text-xs text-red-600">{erroRegime}</p>}
            </div>
          )}

          {regime && (
            <p className="text-xs text-gray-400">
              Regime definido em{' '}
              <a href="/fechamento/config-escalas" className="underline hover:text-gray-600">
                Config Escalas
              </a>.
            </p>
          )}

          {/* lista de turnos */}
          {loading ? (
            <p className="text-sm text-gray-400">Carregando...</p>
          ) : turnos.length === 0 ? (
            <p className="text-sm text-gray-400">Nenhum turno cadastrado para este posto.</p>
          ) : (
            <div className="space-y-2">
              {turnos.map(t => {
                const tipoTurno = resolverTipoEscala(t.tipo_escala)
                return (
                  <div key={t.id} className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <Clock className="h-4 w-4 text-gray-400" />
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-gray-900">{t.nome}</p>
                          <span className={cn(
                            'inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-bold ring-1 ring-inset',
                            ESCALA_BADGE_CLASS[tipoTurno],
                          )}>
                            {ESCALA_LABEL[tipoTurno]}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500">{formatarResumoTurno(t)}</p>
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
                )
              })}
            </div>
          )}

          {/* form de novo/editar turno */}
          {form !== null && canWrite && tipoEscalaForm && derivados && (
            <div className={cn('space-y-3 rounded-lg border border-l-4 bg-white p-4', ESCALA_BORDER_CLASS[tipoEscalaForm])}>
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-700">
                  {form === 'novo' ? 'Novo turno' : 'Editar turno'}
                </p>
                <span className={cn(
                  'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ring-inset',
                  ESCALA_BADGE_CLASS[tipoEscalaForm],
                )}>
                  {ESCALA_LABEL[tipoEscalaForm]}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-500">Nome</label>
                  <input value={nome} onChange={e => setNome(e.target.value)}
                    placeholder="Ex: Turno 7h"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-500">Horário de entrada</label>
                  <input
                    type="time"
                    value={horaEntrada}
                    onChange={e => setHoraEntrada(e.target.value)}
                    min={tipoEscalaForm === '5x1' ? '05:00' : undefined}
                    max={tipoEscalaForm === '5x1' ? '16:00' : undefined}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400" />
                </div>
              </div>

              {/* preview calculado */}
              <div className="space-y-0.5 rounded-lg bg-slate-50 px-3 py-2 text-xs text-gray-500">
                <p className="mb-1 font-medium text-gray-700">Horários calculados automaticamente:</p>
                {derivados.hora_inicio_almoco && derivados.hora_fim_almoco && (
                  <p>Almoço: {derivados.hora_inicio_almoco} às {derivados.hora_fim_almoco}</p>
                )}
                {derivados.hora_saida_sex !== null ? (
                  <>
                    <p>Saída Seg–Qui: {derivados.hora_saida_seg_qui}</p>
                    <p>Saída Sex: {derivados.hora_saida_sex}</p>
                  </>
                ) : (
                  <p>Saída: {derivados.hora_saida_seg_qui}</p>
                )}
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
          {canWrite && form === null && regime && (
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
