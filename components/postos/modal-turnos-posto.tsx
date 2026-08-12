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
  TIPOS_ESCALA_POSTO,
  type TipoEscalaPosto,
  calcularHorariosDerivados,
  resolverTipoEscala,
  resolverTipoEscalaPosto,
  ESCALA_LABEL,
  ESCALA_BADGE_CLASS,
  ESCALA_BORDER_CLASS,
  formatarResumoTurno,
} from '@/lib/turnos/escala'
import { cn } from '@/lib/utils'
import type { TurnoPosto } from '@/types'
import { CATALOGO_POR_REGIME, type TurnoCatalogoItem } from '@/lib/turnos/catalogo-padrao'

interface Props {
  postoId: string
  postoNome: string
  open: boolean
  onClose: () => void
  role?: string
}

export function ModalTurnosPosto({ postoId, postoNome, open, onClose, role }: Props) {
  const [turnos, setTurnos]         = useState<TurnoPosto[]>([])
  const [regime, setRegime]         = useState<TipoEscalaPosto | null | undefined>(undefined) // undefined = carregando
  const [loading, setLoading]       = useState(false)
  const [form, setForm]             = useState<'novo' | TurnoPosto | null>(null)
  const [saving, setSaving]         = useState(false)
  const [erro, setErro]             = useState<string | null>(null)

  const [salvandoRegime, setSalvandoRegime] = useState(false)
  const [erroRegime, setErroRegime]         = useState<string | null>(null)

  // form fields
  const [nome, setNome]                 = useState('')
  const [horaEntrada, setHoraEntrada]   = useState('07:00')
  const [horaInicioAlmoco, setHoraInicioAlmoco] = useState('')
  const [horaFimAlmoco, setHoraFimAlmoco]       = useState('')
  const [horaSaidaSegQui, setHoraSaidaSegQui]   = useState('')
  const [horaSaidaSex, setHoraSaidaSex]         = useState('')
  const [tipoEscalaSelecionado, setTipoEscalaSelecionado] = useState<TipoEscalaPosto | null>(null)
  // cada grupo customizado manualmente para de ser sobrescrito quando a hora de entrada muda
  const [almocoTocado, setAlmocoTocado]         = useState(false)
  const [saidaTocado, setSaidaTocado]           = useState(false)
  const [personalizando, setPersonalizando]     = useState(false)
  const [catalogoAberto, setCatalogoAberto]     = useState(true)
  const [grupoCatalogo, setGrupoCatalogo]       = useState<string | null>(null) // null = todos os grupos

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
    setForm('novo')
    setNome('')
    setHoraEntrada('07:00')
    setTipoEscalaSelecionado(regime ?? null)
    setAlmocoTocado(false)
    setSaidaTocado(false)
    setPersonalizando(false)
    setCatalogoAberto(true)
    setGrupoCatalogo(null)
    setErro(null)
  }

  /** Rótulo do grupo de duração de um item do catálogo — nome sem o sufixo " (letra)". Ex: "Turno 6h 30m (a)" -> "Turno 6h 30m". */
  function grupoDoItem(nome: string): string {
    return nome.replace(/\s*\([a-z]\)\s*$/i, '')
  }

  function abrirEditar(t: TurnoPosto) {
    setForm(t)
    setNome(t.nome)
    setHoraEntrada(t.hora_entrada.slice(0, 5))
    setHoraInicioAlmoco(t.hora_inicio_almoco?.slice(0, 5) ?? '')
    setHoraFimAlmoco(t.hora_fim_almoco?.slice(0, 5) ?? '')
    setHoraSaidaSegQui(t.hora_saida_seg_qui.slice(0, 5))
    setHoraSaidaSex(t.hora_saida_sex?.slice(0, 5) ?? '')
    setTipoEscalaSelecionado(resolverTipoEscalaPosto(t.tipo_escala))
    // valores já gravados são tratados como customizados: mudar a entrada não os sobrescreve sozinho
    setAlmocoTocado(true)
    setSaidaTocado(true)
    setPersonalizando(false)
    setErro(null)
  }

  function fecharForm() {
    setForm(null)
    setErro(null)
  }

  function restaurarHorariosPadrao() {
    setAlmocoTocado(false)
    setSaidaTocado(false)
  }

  function aplicarItemCatalogo(item: TurnoCatalogoItem) {
    setNome(item.nome)
    setHoraEntrada(item.hora_entrada)
    setHoraInicioAlmoco(item.hora_inicio_almoco ?? '')
    setHoraFimAlmoco(item.hora_fim_almoco ?? '')
    setHoraSaidaSegQui(item.hora_saida_seg_qui)
    setHoraSaidaSex(item.hora_saida_sex ?? '')
    setAlmocoTocado(true)
    setSaidaTocado(true)
    setCatalogoAberto(false)
  }

  function handleMudarRegimeForm(tipo: TipoEscalaPosto) {
    setTipoEscalaSelecionado(tipo)
    setAlmocoTocado(false)
    setSaidaTocado(false)
    setCatalogoAberto(true)
    setGrupoCatalogo(null)
  }

  async function handleSalvar() {
    if (!nome.trim()) { setErro('Informe o nome do turno'); return }
    if (!tipoEscalaForm) { setErro('Selecione o regime de trabalho deste turno.'); return }
    setSaving(true)
    setErro(null)
    const temAlmoco = tipoEscalaForm !== '12x36'
    const temSaidaSex = tipoEscalaForm === '5x2'
    const dados: TurnoData = {
      nome: nome.trim(),
      hora_entrada: horaEntrada,
      hora_inicio_almoco: temAlmoco ? horaInicioAlmoco : null,
      hora_fim_almoco: temAlmoco ? horaFimAlmoco : null,
      hora_saida_seg_qui: horaSaidaSegQui,
      hora_saida_sex: temSaidaSex ? horaSaidaSex : null,
      tipo_escala: tipoEscalaForm,
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

  async function handleDefinirRegime(tipo: TipoEscalaPosto) {
    setSalvandoRegime(true)
    setErroRegime(null)
    const res = await saveEscala(postoId, tipo)
    setSalvandoRegime(false)
    if (!res.ok) { setErroRegime(res.error ?? 'Erro ao salvar regime'); return }
    setRegime(tipo)
  }

  const tipoEscalaForm: TipoEscalaPosto | null = form !== null ? tipoEscalaSelecionado : null

  useEffect(() => {
    if (!tipoEscalaForm) return
    const d = calcularHorariosDerivados(horaEntrada, tipoEscalaForm)
    if (!almocoTocado) {
      setHoraInicioAlmoco(d.hora_inicio_almoco ?? '')
      setHoraFimAlmoco(d.hora_fim_almoco ?? '')
    }
    if (!saidaTocado) {
      setHoraSaidaSegQui(d.hora_saida_seg_qui)
      setHoraSaidaSex(d.hora_saida_sex ?? '')
    }
  }, [horaEntrada, tipoEscalaForm, almocoTocado, saidaTocado])

  if (!open) return null

  const temAlmoco = tipoEscalaForm !== null && tipoEscalaForm !== '12x36'
  const temSaidaSex = tipoEscalaForm === '5x2'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-xl bg-white shadow-xl">
        {/* header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Turnos de trabalho</h2>
            <div className="mt-1 flex items-center gap-2">
              <p className="text-sm text-gray-500">{postoNome}</p>
              {regime && (
                <span className={cn(
                  'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset',
                  ESCALA_BADGE_CLASS[regime],
                )}>
                  {ESCALA_LABEL[regime]}
                </span>
              )}
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto px-6 py-4">
          {/* aviso: posto sem regime padrão configurado */}
          {regime === null && (
            <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-sm text-amber-800">
                Este posto ainda não tem um regime padrão definido. Isso não impede cadastrar turnos — o regime é
                escolhido em cada turno — mas definir um padrão aqui pré-preenche o formulário e serve de sugestão.
              </p>
              <div className="flex flex-wrap gap-2">
                {TIPOS_ESCALA_POSTO.map(tipo => (
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
              Regime padrão sugerido (editável por turno): definido em{' '}
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
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {turnos.map(t => {
                const tipoTurno = resolverTipoEscala(t.tipo_escala)
                return (
                  <div key={t.id} className={cn(
                    'flex items-start justify-between gap-2 rounded-lg border-l-4 bg-gray-50 px-4 py-3',
                    ESCALA_BORDER_CLASS[tipoTurno],
                  )}>
                    <div className="flex items-start gap-2.5">
                      <Clock className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                      <div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="text-sm font-extrabold text-gray-900">{t.nome}</p>
                          <span className={cn(
                            'inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-bold ring-1 ring-inset',
                            ESCALA_BADGE_CLASS[tipoTurno],
                          )}>
                            {ESCALA_LABEL[tipoTurno]}
                          </span>
                        </div>
                        <p className="mt-0.5 text-sm font-medium text-gray-600">{formatarResumoTurno(t)}</p>
                      </div>
                    </div>
                    {canWrite && (
                      <div className="flex shrink-0 items-center gap-2">
                        <button type="button" onClick={() => abrirEditar(t)}
                          className="text-gray-400 hover:text-gray-700" title="Editar">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button type="button" onClick={() => handleDesativar(t)} disabled={saving}
                          className="text-gray-400 hover:text-red-600 disabled:opacity-40" title="Desativar">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* form de novo/editar turno */}
          {form !== null && canWrite && (
            <div className={cn('space-y-4 rounded-lg border border-l-4 bg-white p-5 shadow-sm', tipoEscalaForm ? ESCALA_BORDER_CLASS[tipoEscalaForm] : 'border-l-gray-300')}>
              <div className="flex items-center justify-between">
                <p className="text-base font-bold text-gray-800">
                  {form === 'novo' ? 'Novo turno' : 'Editar turno'}
                </p>
                {tipoEscalaForm && (
                  <span className={cn(
                    'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset',
                    ESCALA_BADGE_CLASS[tipoEscalaForm],
                  )}>
                    {ESCALA_LABEL[tipoEscalaForm]}
                  </span>
                )}
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-500">Regime</label>
                <select
                  value={tipoEscalaForm ?? ''}
                  onChange={e => handleMudarRegimeForm(e.target.value as TipoEscalaPosto)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-gray-400"
                >
                  <option value="" disabled>Selecione…</option>
                  {TIPOS_ESCALA_POSTO.map(tipo => (
                    <option key={tipo} value={tipo}>{ESCALA_LABEL[tipo]}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-500">Nome</label>
                  <input value={nome} onChange={e => setNome(e.target.value)}
                    placeholder="Ex: Turno 7h"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-gray-400" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-500">Horário de entrada</label>
                  <input
                    type="time"
                    value={horaEntrada}
                    onChange={e => setHoraEntrada(e.target.value)}
                    min={tipoEscalaForm === '5x1' ? '05:00' : undefined}
                    max={tipoEscalaForm === '5x1' ? '16:00' : undefined}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-gray-400" />
                </div>
              </div>

              {form === 'novo' && tipoEscalaForm && CATALOGO_POR_REGIME[tipoEscalaForm] && (
                <div className="rounded-lg border border-gray-200 bg-slate-50 p-3">
                  <button type="button" onClick={() => setCatalogoAberto(p => !p)}
                    className="flex w-full items-center justify-between text-xs font-bold uppercase tracking-widest text-gray-600">
                    Usar turno padrão
                    <span className="text-gray-400">{catalogoAberto ? '▲' : '▼'}</span>
                  </button>
                  {catalogoAberto && (() => {
                    const catalogo = CATALOGO_POR_REGIME[tipoEscalaForm]!
                    const grupos = Array.from(new Set(catalogo.map(item => grupoDoItem(item.nome))))
                    const itensFiltrados = grupoCatalogo ? catalogo.filter(item => grupoDoItem(item.nome) === grupoCatalogo) : catalogo
                    return (
                      <>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <button type="button" onClick={() => setGrupoCatalogo(null)}
                            className={cn(
                              'rounded-full border px-2.5 py-1 text-[11px] font-bold',
                              grupoCatalogo === null ? 'border-slate-900 bg-slate-900 text-white' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300',
                            )}>
                            Todos
                          </button>
                          {grupos.map(g => (
                            <button key={g} type="button" onClick={() => setGrupoCatalogo(g)}
                              className={cn(
                                'rounded-full border px-2.5 py-1 text-[11px] font-bold',
                                grupoCatalogo === g ? 'border-slate-900 bg-slate-900 text-white' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300',
                              )}>
                              {g.replace('Turno ', '')}
                            </button>
                          ))}
                        </div>
                        <div className="mt-2 grid max-h-56 grid-cols-1 gap-1.5 overflow-y-auto sm:grid-cols-2">
                          {itensFiltrados.map(item => (
                            <button key={item.nome} type="button" onClick={() => aplicarItemCatalogo(item)}
                              className="flex flex-col items-start rounded-md border border-gray-200 bg-white px-2.5 py-2 text-left hover:border-slate-400 hover:bg-slate-50">
                              <span className="text-xs font-extrabold text-gray-900">{item.nome}</span>
                              <span className="text-[11px] font-medium text-gray-500">
                                <span className="font-bold text-gray-800">{item.hora_entrada}</span>
                                {item.hora_inicio_almoco && item.hora_fim_almoco && (
                                  <span className="text-blue-600"> · almoço {item.hora_inicio_almoco}–{item.hora_fim_almoco}</span>
                                )}
                                {' · saída '}
                                <span className="font-bold text-gray-800">
                                  {item.hora_saida_sex && item.hora_saida_sex !== item.hora_saida_seg_qui
                                    ? `${item.hora_saida_seg_qui} (sex ${item.hora_saida_sex})`
                                    : item.hora_saida_seg_qui}
                                </span>
                              </span>
                            </button>
                          ))}
                        </div>
                      </>
                    )
                  })()}
                </div>
              )}

              {/* almoço/saída: resumo calculado por padrão; "Personalizar" libera edição livre por campo */}
              {!personalizando ? (
                <div className="space-y-1 rounded-lg bg-slate-50 px-4 py-3 text-sm text-gray-700">
                  <div className="mb-1.5 flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Horários</p>
                    <button type="button" onClick={() => setPersonalizando(true)}
                      className="text-xs font-semibold text-slate-700 underline hover:text-slate-900">
                      Personalizar horários
                    </button>
                  </div>
                  {temAlmoco && <p><span className="font-semibold">Almoço:</span> {horaInicioAlmoco} às {horaFimAlmoco}</p>}
                  {temSaidaSex ? (
                    <>
                      <p><span className="font-semibold">Saída Seg–Qui:</span> {horaSaidaSegQui}</p>
                      <p><span className="font-semibold">Saída Sex:</span> {horaSaidaSex}</p>
                    </>
                  ) : (
                    <p><span className="font-semibold">Saída:</span> {horaSaidaSegQui}</p>
                  )}
                </div>
              ) : (
                <div className="space-y-3 rounded-lg bg-slate-50 px-3 py-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-gray-700">Almoço e saída</p>
                    <button type="button" onClick={restaurarHorariosPadrao}
                      className="text-xs font-medium text-gray-500 underline hover:text-gray-700">
                      Restaurar padrão
                    </button>
                  </div>

                  {temAlmoco && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-500">Início almoço</label>
                        <input type="time" value={horaInicioAlmoco}
                          onChange={e => { setAlmocoTocado(true); setHoraInicioAlmoco(e.target.value) }}
                          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400" />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-500">Fim almoço</label>
                        <input type="time" value={horaFimAlmoco}
                          onChange={e => { setAlmocoTocado(true); setHoraFimAlmoco(e.target.value) }}
                          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400" />
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-500">
                        {temSaidaSex ? 'Saída Seg–Qui' : 'Saída'}
                      </label>
                      <input type="time" value={horaSaidaSegQui}
                        onChange={e => { setSaidaTocado(true); setHoraSaidaSegQui(e.target.value) }}
                        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400" />
                    </div>
                    {temSaidaSex && (
                      <div>
                        <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-500">Saída Sex</label>
                        <input type="time" value={horaSaidaSex}
                          onChange={e => { setSaidaTocado(true); setHoraSaidaSex(e.target.value) }}
                          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400" />
                      </div>
                    )}
                  </div>
                </div>
              )}

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
