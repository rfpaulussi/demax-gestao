'use client'

import { useState, useCallback } from 'react'
import { Clock, CalendarDays, ChevronDown, ChevronUp, X, Plus, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { listarTurnosDoPosto, alterarTurno } from '@/app/(admin)/efetivo/horario/actions'

// ─── tipos de entrada ─────────────────────────────────────────────────────────

export type HorarioVigenteShape = {
  id: string
  data_inicio: string
  data_fim: string | null
  turno: {
    id: string
    posto_id: string
    nome: string
    hora_entrada: string
    hora_saida_seg_qui: string
    hora_saida_sex: string
    hora_inicio_almoco: string
    hora_fim_almoco: string
    ativo: boolean
  }
} | null

export type HistoricoHorarioShape = {
  id: string
  data_inicio: string
  data_fim: string | null
  turno: {
    nome: string
    hora_entrada: string
    hora_saida_seg_qui: string
    hora_saida_sex: string
    hora_inicio_almoco: string
    hora_fim_almoco: string
  }
}[]

type TurnoOpcao = {
  id: string
  nome: string
  hora_entrada: string
  hora_saida_seg_qui: string
  hora_saida_sex: string
  hora_inicio_almoco: string
  hora_fim_almoco: string
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmtH(h: string) { return h.slice(0, 5) }

function fmtData(iso: string) {
  const [y, m, d] = iso.split('T')[0].split('-')
  return `${d}/${m}/${y}`
}

function fmtMes(iso: string) {
  const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
  const [y, m] = iso.split('-')
  return `${meses[parseInt(m) - 1]} ${y}`
}

function calcDuracao(inicio: string, fim: string | null): string {
  const from = new Date(inicio + 'T12:00:00')
  const to   = fim ? new Date(fim + 'T12:00:00') : new Date()
  const meses = Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24 * 30))
  if (meses < 1) return '< 1 mês'
  if (meses < 12) return `${meses} mês${meses > 1 ? 'es' : ''}`
  const anos = Math.floor(meses / 12)
  const resto = meses % 12
  return resto === 0 ? `${anos} ano${anos > 1 ? 's' : ''}` : `${anos}a ${resto}m`
}

const REGIME_CONFIG: Record<string, {
  badge: string
  badgeClass: string
  diasLabel: string
  diasAtivos: boolean[] // Dom=0 Seg=1 ... Sab=6
  dotClass: string
}> = {
  '5x2': {
    badge: '5×2 · 44h/sem',
    badgeClass: 'bg-blue-50 text-blue-700 ring-blue-200',
    diasLabel: 'Segunda a Sexta',
    diasAtivos: [false, true, true, true, true, true, false],
    dotClass: 'bg-blue-500',
  },
  '5x1': {
    badge: '5×1 · 44h/sem',
    badgeClass: 'bg-purple-50 text-purple-700 ring-purple-200',
    diasLabel: 'Segunda a Sábado',
    diasAtivos: [false, true, true, true, true, true, true],
    dotClass: 'bg-purple-500',
  },
  '12x36': {
    badge: '12×36',
    badgeClass: 'bg-orange-50 text-orange-700 ring-orange-200',
    diasLabel: 'Escala rodízio',
    diasAtivos: [true, true, true, true, true, true, true],
    dotClass: 'bg-orange-500',
  },
}

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

// ─── modal alterar turno ───────────────────────────────────────────────────────

function ModalAlterarTurno({
  open,
  onClose,
  postoId,
  funcionarioId,
  onSucesso,
}: {
  open: boolean
  onClose: () => void
  postoId: string
  funcionarioId: string
  onSucesso: () => void
}) {
  const [turnos, setTurnos]         = useState<TurnoOpcao[]>([])
  const [loading, setLoading]       = useState(false)
  const [turnoId, setTurnoId]       = useState('')
  const [dataInicio, setDataInicio] = useState('')
  const [saving, setSaving]         = useState(false)
  const [erro, setErro]             = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const data = await listarTurnosDoPosto(postoId)
      setTurnos(data as TurnoOpcao[])
    } finally {
      setLoading(false)
    }
  }, [postoId])

  // Carregar ao abrir
  const [carregou, setCarregou] = useState(false)
  if (open && !carregou) {
    setCarregou(true)
    carregar()
  }
  if (!open) {
    if (carregou) setCarregou(false)
    return null
  }

  const turnoSelecionado = turnos.find(t => t.id === turnoId)

  async function handleSalvar() {
    if (!turnoId)     { setErro('Selecione um turno'); return }
    if (!dataInicio)  { setErro('Informe a data de início'); return }
    setSaving(true)
    setErro(null)
    const res = await alterarTurno(funcionarioId, turnoId, dataInicio)
    setSaving(false)
    if (!res.success) { setErro(res.error ?? 'Erro ao salvar'); return }
    onSucesso()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        {/* header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h2 className="text-base font-bold text-gray-900">Alterar Turno de Trabalho</h2>
            <p className="text-xs text-gray-400">Selecione o novo turno e a data de início</p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-4">
          {loading ? (
            <p className="text-sm text-gray-400">Carregando turnos...</p>
          ) : turnos.length === 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-sm text-amber-700">
                Nenhum turno cadastrado para este posto. Acesse <strong>Postos → Turnos</strong> para criar.
              </p>
            </div>
          ) : (
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-gray-500">
                Turno
              </label>
              <div className="space-y-2">
                {turnos.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTurnoId(t.id)}
                    className={cn(
                      'w-full rounded-lg border px-4 py-3 text-left transition-colors',
                      turnoId === t.id
                        ? 'border-blue-400 bg-blue-50 ring-1 ring-blue-400'
                        : 'border-gray-200 bg-gray-50 hover:border-gray-300 hover:bg-white',
                    )}
                  >
                    <p className={cn('text-sm font-semibold', turnoId === t.id ? 'text-blue-800' : 'text-gray-800')}>
                      {t.nome}
                    </p>
                    <p className={cn('text-xs mt-0.5', turnoId === t.id ? 'text-blue-600' : 'text-gray-500')}>
                      Entrada {fmtH(t.hora_entrada)} · Almoço {fmtH(t.hora_inicio_almoco)}–{fmtH(t.hora_fim_almoco)} · Saída Seg–Qui {fmtH(t.hora_saida_seg_qui)} · Sex {fmtH(t.hora_saida_sex)}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-gray-500">
              Data de Início
            </label>
            <input
              type="date"
              value={dataInicio}
              onChange={e => setDataInicio(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>

          {turnoSelecionado && dataInicio && (
            <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-xs text-green-700">
              <p className="font-semibold mb-0.5">Resumo da alteração</p>
              <p>A partir de <strong>{fmtData(dataInicio)}</strong>, o funcionário passará para o <strong>{turnoSelecionado.nome}</strong>.</p>
              <p className="mt-0.5 text-green-600">O horário anterior será encerrado automaticamente no dia anterior.</p>
            </div>
          )}

          {erro && (
            <p className="flex items-center gap-1.5 text-xs text-red-600">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {erro}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-100 px-6 py-3">
          <button type="button" onClick={onClose}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
            Cancelar
          </button>
          <button type="button" onClick={handleSalvar} disabled={saving || turnos.length === 0}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50">
            {saving ? 'Salvando…' : 'Salvar Alteração'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── componente principal ─────────────────────────────────────────────────────

export function TabHorario({
  horarioVigente,
  historicoHorario,
  regimePosto,
  postoId,
  funcionarioId,
  role,
}: {
  horarioVigente: HorarioVigenteShape
  historicoHorario: HistoricoHorarioShape
  regimePosto: string | null
  postoId: string | null
  funcionarioId: string
  role: string | null
}) {
  const [modalAberto, setModalAberto]       = useState(false)
  const [historicoAberto, setHistoricoAberto] = useState(false)

  const canWrite = role === 'admin' || role === 'coordenador'
  const regime   = regimePosto ?? '5x2'
  const regimeCfg = REGIME_CONFIG[regime] ?? REGIME_CONFIG['5x2']

  return (
    <div className="space-y-5">

      {/* ── Horário vigente ─────────────────────────────────────────────── */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
            Horário Vigente
          </p>
          {canWrite && postoId && (
            <button
              type="button"
              onClick={() => setModalAberto(true)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              {horarioVigente ? (
                <><CalendarDays className="h-3.5 w-3.5" /> Alterar Turno</>
              ) : (
                <><Plus className="h-3.5 w-3.5" /> Atribuir Turno</>
              )}
            </button>
          )}
        </div>

        {horarioVigente ? (
          <div className="overflow-hidden rounded-xl border-l-4 border-blue-500 bg-gradient-to-br from-blue-50 via-white to-indigo-50 shadow-sm ring-1 ring-blue-100">
            {/* cabeçalho */}
            <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-4 pb-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                  <Clock className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-lg font-bold text-blue-900">{horarioVigente.turno.nome}</p>
                  <p className="text-xs text-blue-500">Desde {fmtData(horarioVigente.data_inicio)}</p>
                </div>
              </div>
              <span className={cn(
                'inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ring-1 ring-inset',
                regimeCfg.badgeClass,
              )}>
                {regimeCfg.badge}
              </span>
            </div>

            {/* grade de horários */}
            <div className="grid grid-cols-2 gap-2 px-5 pb-3 sm:grid-cols-4">
              <div className="rounded-lg bg-green-50 px-3 py-2.5 ring-1 ring-green-200">
                <p className="text-xs font-semibold uppercase tracking-widest text-green-600">Entrada</p>
                <p className="mt-0.5 text-xl font-bold text-green-800">{fmtH(horarioVigente.turno.hora_entrada)}</p>
              </div>
              <div className="rounded-lg bg-amber-50 px-3 py-2.5 ring-1 ring-amber-200">
                <p className="text-xs font-semibold uppercase tracking-widest text-amber-600">Almoço</p>
                <p className="mt-0.5 text-sm font-bold text-amber-800">
                  {fmtH(horarioVigente.turno.hora_inicio_almoco)} – {fmtH(horarioVigente.turno.hora_fim_almoco)}
                </p>
                <p className="text-xs text-amber-500">72 min</p>
              </div>
              <div className="rounded-lg bg-blue-50 px-3 py-2.5 ring-1 ring-blue-200">
                <p className="text-xs font-semibold uppercase tracking-widest text-blue-600">Saída Seg–Qui</p>
                <p className="mt-0.5 text-xl font-bold text-blue-800">{fmtH(horarioVigente.turno.hora_saida_seg_qui)}</p>
              </div>
              <div className="rounded-lg bg-indigo-50 px-3 py-2.5 ring-1 ring-indigo-200">
                <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">Saída Sex</p>
                <p className="mt-0.5 text-xl font-bold text-indigo-800">{fmtH(horarioVigente.turno.hora_saida_sex)}</p>
              </div>
            </div>

            {/* dias da semana */}
            <div className="border-t border-blue-100 px-5 py-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-blue-400">
                Dias de trabalho · {regimeCfg.diasLabel}
              </p>
              <div className="flex gap-2">
                {DIAS_SEMANA.map((dia, i) => {
                  const ativo = regimeCfg.diasAtivos[i]
                  return (
                    <div key={dia} className="flex flex-col items-center gap-1">
                      <div className={cn(
                        'h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors',
                        ativo
                          ? cn(regimeCfg.dotClass, 'text-white')
                          : 'bg-gray-100 text-gray-400',
                      )}>
                        {dia.slice(0, 1)}
                      </div>
                      <span className={cn('text-xs', ativo ? 'text-gray-600 font-medium' : 'text-gray-300')}>
                        {dia}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-gray-200 py-10 text-center">
            <Clock className="h-8 w-8 text-gray-300" />
            <div>
              <p className="text-sm font-medium text-gray-500">Nenhum horário cadastrado</p>
              <p className="mt-0.5 text-xs text-gray-400">Este funcionário ainda não tem um turno atribuído.</p>
            </div>
            {canWrite && postoId && (
              <button
                type="button"
                onClick={() => setModalAberto(true)}
                className="mt-1 flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
              >
                <Plus className="h-4 w-4" />
                Atribuir Turno
              </button>
            )}
            {!postoId && (
              <p className="text-xs text-gray-400 italic">Funcionário sem posto vinculado.</p>
            )}
          </div>
        )}
      </div>

      {/* ── Histórico ───────────────────────────────────────────────────── */}
      {historicoHorario.length > 0 && (
        <div className="rounded-xl border border-gray-100 bg-white shadow-sm">
          <button
            type="button"
            onClick={() => setHistoricoAberto(p => !p)}
            className="flex w-full items-center justify-between px-5 py-3.5"
          >
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-gray-400" />
              <span className="text-xs font-semibold uppercase tracking-widest text-gray-500">
                Histórico de Horários
              </span>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                {historicoHorario.length}
              </span>
            </div>
            {historicoAberto
              ? <ChevronUp className="h-4 w-4 text-gray-400" />
              : <ChevronDown className="h-4 w-4 text-gray-400" />
            }
          </button>

          {historicoAberto && (
            <div className="divide-y divide-gray-50 border-t border-gray-100">
              {historicoHorario.map((h) => (
                <div key={h.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-700">{h.turno.nome}</p>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                        {calcDuracao(h.data_inicio, h.data_fim)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-gray-400">
                      {fmtMes(h.data_inicio)} – {h.data_fim ? fmtMes(h.data_fim) : 'presente'}
                    </p>
                  </div>
                  <p className="text-xs text-gray-400">
                    Entrada {fmtH(h.turno.hora_entrada)} · Saída Seg–Qui {fmtH(h.turno.hora_saida_seg_qui)} · Sex {fmtH(h.turno.hora_saida_sex)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Modal ────────────────────────────────────────────────────────── */}
      {postoId && (
        <ModalAlterarTurno
          open={modalAberto}
          onClose={() => setModalAberto(false)}
          postoId={postoId}
          funcionarioId={funcionarioId}
          onSucesso={() => {
            // revalidatePath no server action vai atualizar os dados via RSC
          }}
        />
      )}
    </div>
  )
}
