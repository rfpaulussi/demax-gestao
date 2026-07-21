'use client'

import { useState, useCallback } from 'react'
import { Clock, CalendarDays, ChevronDown, ChevronUp, X, Plus, AlertCircle, Trash2, GraduationCap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { listarTurnosDoPosto, listarTurnosJovemAprendiz, alterarTurno, deletarHorarioFuncionario } from '@/app/(admin)/efetivo/horario/actions'
import { resolverTipoEscala, ESCALA_LABEL, ESCALA_BADGE_CLASS, formatarResumoTurno, duracaoAlmocoMin, FUNCAO_JOVEM_APRENDIZ } from '@/lib/turnos/escala'

// ─── tipos de entrada ─────────────────────────────────────────────────────────

export type HorarioVigenteShape = {
  id: string
  data_inicio: string
  data_fim: string | null
  dia_curso: number | null
  turno: {
    id: string
    posto_id: string | null
    nome: string
    tipo_escala: string
    hora_entrada: string
    hora_saida_seg_qui: string
    hora_saida_sex: string | null
    hora_inicio_almoco: string | null
    hora_fim_almoco: string | null
    ativo: boolean
  }
} | null

export type HistoricoHorarioShape = {
  id: string
  data_inicio: string
  data_fim: string | null
  turno: {
    nome: string
    tipo_escala: string
    hora_entrada: string
    hora_saida_seg_qui: string
    hora_saida_sex: string | null
    hora_inicio_almoco: string | null
    hora_fim_almoco: string | null
  }
}[]

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

const DIAS_CURSO_OPCOES = [
  { valor: 1, label: 'Segunda' },
  { valor: 2, label: 'Terça' },
  { valor: 3, label: 'Quarta' },
  { valor: 4, label: 'Quinta' },
  { valor: 5, label: 'Sexta' },
]

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmtH(h: string | null) { return h ? h.slice(0, 5) : '—' }

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
  'jovem_aprendiz': {
    badge: 'Jovem Aprendiz',
    badgeClass: 'bg-teal-50 text-teal-700 ring-teal-200',
    diasLabel: 'Segunda a Sexta',
    diasAtivos: [false, true, true, true, true, true, false],
    dotClass: 'bg-teal-500',
  },
}

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

// ─── modal alterar turno ───────────────────────────────────────────────────────

function ModalAlterarTurno({
  open,
  onClose,
  postoId,
  funcionarioId,
  isJovemAprendiz,
  dataInicioVigente,
  onSucesso,
}: {
  open: boolean
  onClose: () => void
  postoId: string
  funcionarioId: string
  isJovemAprendiz: boolean
  dataInicioVigente?: string
  onSucesso: () => void
}) {
  const [turnos, setTurnos]         = useState<TurnoOpcao[]>([])
  const [loading, setLoading]       = useState(false)
  const [turnoId, setTurnoId]       = useState('')
  const [dataInicio, setDataInicio] = useState('')
  const [diaCurso, setDiaCurso]     = useState<number | ''>('')
  const [saving, setSaving]         = useState(false)
  const [erro, setErro]             = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const data = isJovemAprendiz
        ? await listarTurnosJovemAprendiz()
        : await listarTurnosDoPosto(postoId)
      setTurnos(data as TurnoOpcao[])
    } finally {
      setLoading(false)
    }
  }, [postoId, isJovemAprendiz])

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
  const precisaDiaCurso = turnoSelecionado ? resolverTipoEscala(turnoSelecionado.tipo_escala) === 'jovem_aprendiz' : false

  const dataInicioInvalida = !!dataInicio && !!dataInicioVigente && dataInicio <= dataInicioVigente

  async function handleSalvar() {
    if (!turnoId)          { setErro('Selecione um turno'); return }
    if (!dataInicio)       { setErro('Informe a data de início'); return }
    if (dataInicioInvalida) { setErro('A data de início deve ser posterior à do turno vigente'); return }
    if (precisaDiaCurso && !diaCurso) { setErro('Selecione o dia de curso'); return }
    setSaving(true)
    setErro(null)
    const res = await alterarTurno(funcionarioId, turnoId, dataInicio, precisaDiaCurso ? Number(diaCurso) : undefined)
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
                {isJovemAprendiz
                  ? 'Nenhum turno de jovem aprendiz cadastrado.'
                  : <>Nenhum turno cadastrado para este posto. Acesse <strong>Postos → Turnos</strong> para criar.</>}
              </p>
            </div>
          ) : (
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-gray-500">
                Turno
              </label>
              <div className="space-y-2">
                {turnos.map(t => {
                  const tipoTurno = resolverTipoEscala(t.tipo_escala)
                  return (
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
                      <div className="flex items-center gap-2">
                        <p className={cn('text-sm font-semibold', turnoId === t.id ? 'text-blue-800' : 'text-gray-800')}>
                          {t.nome}
                        </p>
                        <span className={cn(
                          'inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-bold ring-1 ring-inset',
                          ESCALA_BADGE_CLASS[tipoTurno],
                        )}>
                          {ESCALA_LABEL[tipoTurno]}
                        </span>
                      </div>
                      <p className={cn('text-xs mt-0.5', turnoId === t.id ? 'text-blue-600' : 'text-gray-500')}>
                        {formatarResumoTurno(t)}
                      </p>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {precisaDiaCurso && (
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-gray-500">
                Dia de curso
              </label>
              <select
                value={diaCurso}
                onChange={e => setDiaCurso(e.target.value ? Number(e.target.value) : '')}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
              >
                <option value="">Selecione…</option>
                {DIAS_CURSO_OPCOES.map(d => (
                  <option key={d.valor} value={d.valor}>{d.label}</option>
                ))}
              </select>
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
              className={cn(
                'w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1',
                dataInicioInvalida
                  ? 'border-amber-400 focus:ring-amber-400'
                  : 'border-gray-200 focus:ring-blue-400',
              )}
            />
            {dataInicioInvalida && dataInicioVigente && (() => {
              const [y, m, d] = dataInicioVigente.split('-')
              return (
                <p className="mt-1.5 flex items-center gap-1 text-xs text-amber-700">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  Deve ser posterior a {d}/{m}/{y} (início do turno vigente)
                </p>
              )
            })()}
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
          <button type="button" onClick={handleSalvar} disabled={saving}
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
  funcaoNome = null,
}: {
  horarioVigente: HorarioVigenteShape
  historicoHorario: HistoricoHorarioShape
  regimePosto: string | null
  postoId: string | null
  funcionarioId: string
  role: string | null
  funcaoNome?: string | null
}) {
  const [modalAberto, setModalAberto]         = useState(false)
  const [historicoAberto, setHistoricoAberto] = useState(false)
  const [confirmDelete, setConfirmDelete]     = useState<string | null>(null)
  const [deleting, setDeleting]               = useState(false)
  const [deleteErro, setDeleteErro]           = useState<string | null>(null)

  const canWrite = role === 'admin' || role === 'coordenador'

  async function handleDeletar(id: string) {
    setDeleting(true)
    setDeleteErro(null)
    const res = await deletarHorarioFuncionario(id)
    setDeleting(false)
    if (!res.success) {
      setDeleteErro(res.error ?? 'Erro ao excluir')
      setConfirmDelete(null)
      return
    }
    setConfirmDelete(null)
  }
  const isJovemAprendiz = funcaoNome === FUNCAO_JOVEM_APRENDIZ
  const regime    = isJovemAprendiz ? 'jovem_aprendiz' : (regimePosto ?? '5x2')
  const regimeCfg = REGIME_CONFIG[regime] ?? REGIME_CONFIG['5x2']
  const diaCursoAtual = horarioVigente?.dia_curso ?? null

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
            {(() => {
              const turnoAtual = horarioVigente.turno
              const temAlmoco = turnoAtual.hora_inicio_almoco !== null && turnoAtual.hora_fim_almoco !== null
              const temSaidaSex = turnoAtual.hora_saida_sex !== null
              const almocoMin = duracaoAlmocoMin(turnoAtual.hora_inicio_almoco, turnoAtual.hora_fim_almoco)
              const cols = temSaidaSex ? 'sm:grid-cols-4' : temAlmoco ? 'sm:grid-cols-3' : 'sm:grid-cols-2'
              return (
                <div className={cn('grid grid-cols-2 gap-2 px-5 pb-3', cols)}>
                  <div className="rounded-lg bg-green-50 px-3 py-2.5 ring-1 ring-green-200">
                    <p className="text-xs font-semibold uppercase tracking-widest text-green-600">Entrada</p>
                    <p className="mt-0.5 text-xl font-bold text-green-800">{fmtH(turnoAtual.hora_entrada)}</p>
                  </div>
                  {temAlmoco && (
                    <div className="rounded-lg bg-amber-50 px-3 py-2.5 ring-1 ring-amber-200">
                      <p className="text-xs font-semibold uppercase tracking-widest text-amber-600">Almoço</p>
                      <p className="mt-0.5 text-sm font-bold text-amber-800">
                        {fmtH(turnoAtual.hora_inicio_almoco)} – {fmtH(turnoAtual.hora_fim_almoco)}
                      </p>
                      {almocoMin !== null && <p className="text-xs text-amber-500">{almocoMin} min</p>}
                    </div>
                  )}
                  <div className="rounded-lg bg-blue-50 px-3 py-2.5 ring-1 ring-blue-200">
                    <p className="text-xs font-semibold uppercase tracking-widest text-blue-600">
                      {temSaidaSex ? 'Saída Seg–Qui' : 'Saída'}
                    </p>
                    <p className="mt-0.5 text-xl font-bold text-blue-800">{fmtH(turnoAtual.hora_saida_seg_qui)}</p>
                  </div>
                  {temSaidaSex && (
                    <div className="rounded-lg bg-indigo-50 px-3 py-2.5 ring-1 ring-indigo-200">
                      <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">Saída Sex</p>
                      <p className="mt-0.5 text-xl font-bold text-indigo-800">{fmtH(turnoAtual.hora_saida_sex)}</p>
                    </div>
                  )}
                </div>
              )
            })()}

            {/* dias da semana */}
            <div className="border-t border-blue-100 px-5 py-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-blue-400">
                Dias de trabalho · {regimeCfg.diasLabel}
              </p>
              <div className="flex gap-2">
                {DIAS_SEMANA.map((dia, i) => {
                  const ehCurso = isJovemAprendiz && diaCursoAtual === i
                  const ativo = ehCurso ? false : regimeCfg.diasAtivos[i]
                  return (
                    <div key={dia} className="flex flex-col items-center gap-1">
                      <div className={cn(
                        'h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors',
                        ehCurso
                          ? 'bg-teal-500 text-white'
                          : ativo
                            ? cn(regimeCfg.dotClass, 'text-white')
                            : 'bg-gray-100 text-gray-400',
                      )}>
                        {ehCurso ? <GraduationCap className="h-3.5 w-3.5" /> : dia.slice(0, 1)}
                      </div>
                      <span className={cn('text-xs', (ativo || ehCurso) ? 'text-gray-600 font-medium' : 'text-gray-300')}>
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
              {deleteErro && (
                <p className="flex items-center gap-1.5 px-5 py-2 text-xs text-red-600">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  {deleteErro}
                </p>
              )}
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

                  {confirmDelete === h.id ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-red-600 font-medium">Excluir este registro?</span>
                      <button
                        type="button"
                        disabled={deleting}
                        onClick={() => handleDeletar(h.id)}
                        className="rounded-md bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        {deleting ? '…' : 'Sim'}
                      </button>
                      <button
                        type="button"
                        disabled={deleting}
                        onClick={() => setConfirmDelete(null)}
                        className="rounded-md border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Não
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-4">
                      <p className="text-xs text-gray-400">
                        {formatarResumoTurno(h.turno)}
                      </p>
                      {canWrite && (
                        <button
                          type="button"
                          onClick={() => { setConfirmDelete(h.id); setDeleteErro(null) }}
                          title="Excluir registro"
                          className="rounded-md p-1 text-gray-300 hover:bg-red-50 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  )}
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
          isJovemAprendiz={isJovemAprendiz}
          dataInicioVigente={horarioVigente?.data_inicio}
          onSucesso={() => {
            // revalidatePath no server action vai atualizar os dados via RSC
          }}
        />
      )}
    </div>
  )
}
