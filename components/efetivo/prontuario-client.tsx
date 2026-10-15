'use client'

import { useState } from 'react'
import {
  FileText, UserCheck, UserX, UserMinus, MapPin, Briefcase,
  Umbrella, XCircle, AlertTriangle, Ban, Shield, ArrowRightLeft,
  RotateCcw, Loader2, Clock,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ProntuarioFuncionario, ProntuarioEvento, PeriodoFerias } from '@/app/(admin)/efetivo/[id]/historico/page'
import { TIPOS_DESLIGAMENTO, MOTIVOS_POR_TIPO } from '@/components/efetivo/modal-desligar'

const TIPO_DESLIG_MAP = Object.fromEntries(TIPOS_DESLIGAMENTO.map(t => [t.value, t.label]))
const TODOS_MOTIVOS_DESLIG = Object.fromEntries(
  Object.values(MOTIVOS_POR_TIPO).flat().map(m => [m.value, m.label])
)

// ─── Event config ─────────────────────────────────────────────────────────────

type EventConfig = {
  label: string
  icon: React.ElementType
  dot: string
  text: string
  ring: string
}

const EVENT_CONFIG: Record<string, EventConfig> = {
  admissao:            { label: 'Admissão',          icon: UserCheck,       dot: 'bg-green-500',   text: 'text-green-700',   ring: 'ring-green-100'  },
  desligamento:        { label: 'Desligamento',       icon: UserX,           dot: 'bg-red-500',     text: 'text-red-700',     ring: 'ring-red-100'    },
  mudanca_posto:       { label: 'Mudança de Posto',   icon: MapPin,          dot: 'bg-blue-500',    text: 'text-blue-700',    ring: 'ring-blue-100'   },
  mudanca_funcao:      { label: 'Mudança de Função',  icon: Briefcase,       dot: 'bg-purple-500',  text: 'text-purple-700',  ring: 'ring-purple-100' },
  ferias:              { label: 'Férias',             icon: Umbrella,        dot: 'bg-orange-400',  text: 'text-orange-700',  ring: 'ring-orange-100' },
  atestado:            { label: 'Atestado',           icon: FileText,        dot: 'bg-amber-400',   text: 'text-amber-700',   ring: 'ring-amber-100'  },
  falta:               { label: 'Falta',              icon: XCircle,         dot: 'bg-rose-400',    text: 'text-rose-700',    ring: 'ring-rose-100'   },
  advertencia:         { label: 'Advertência',        icon: AlertTriangle,   dot: 'bg-red-500',     text: 'text-red-700',     ring: 'ring-red-100'    },
  suspensao:           { label: 'Suspensão',          icon: Ban,             dot: 'bg-red-800',     text: 'text-red-900',     ring: 'ring-red-200'    },
  cobertura_insalubre: { label: 'Cob. Insalubre',     icon: Shield,          dot: 'bg-indigo-500',  text: 'text-indigo-700',  ring: 'ring-indigo-100' },
  transferencia:         { label: 'Transferência',       icon: ArrowRightLeft, dot: 'bg-cyan-500',    text: 'text-cyan-700',    ring: 'ring-cyan-100'   },
  reativacao:            { label: 'Reativação',          icon: RotateCcw,      dot: 'bg-green-400',   text: 'text-green-600',   ring: 'ring-green-100'  },
  afastamento:           { label: 'Afastamento',         icon: UserMinus,      dot: 'bg-amber-500',   text: 'text-amber-700',   ring: 'ring-amber-100'  },
  retorno_afastamento:   { label: 'Retorno Afastamento', icon: UserCheck,      dot: 'bg-green-500',   text: 'text-green-700',   ring: 'ring-green-100'  },
  mudanca_horario:       { label: 'Mudança de Horário',  icon: Clock,          dot: 'bg-cyan-500',    text: 'text-cyan-700',    ring: 'ring-cyan-100'   },
}

const DEFAULT_CONFIG: EventConfig = {
  label: 'Evento',
  icon: FileText,
  dot: 'bg-gray-400',
  text: 'text-gray-600',
  ring: 'ring-gray-100',
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  ativo:             { label: 'Ativo',             className: 'bg-green-50  text-green-700  ring-green-200'  },
  afastado:          { label: 'Afastado',          className: 'bg-orange-50 text-orange-700 ring-orange-200' },
  ferias:            { label: 'Férias',            className: 'bg-amber-50  text-amber-700  ring-amber-200'  },
  desligado:         { label: 'Desligado',         className: 'bg-gray-100  text-gray-500   ring-gray-200'   },
  rescisao_indireta: { label: 'Rescisão Indireta', className: 'bg-purple-50 text-purple-700  ring-purple-200' },
}

// ─── Histórico por Mês ────────────────────────────────────────────────────────

export interface MesEntry {
  ym: string          // 'YYYY-MM'
  posto: string
  secretaria: string
  funcao: string
  status: string
  supervisor: string
  eventosNoMes: string[]  // event tipo values that occurred this month
}

const MONTH_NAMES = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

function fmtMesAno(ym: string): string {
  const [y, m] = ym.split('-')
  return `${MONTH_NAMES[Number(m)]}/${y}`
}

type Dados = Record<string, unknown>

function nomePosto(d: Dados): string {
  const v = d.posto_nome ?? d.posto
  return v ? String(v).replace(/""/g, '"') : ''
}
function nomeSecretaria(d: Dados): string {
  const v = d.secretaria_nome ?? d.secretaria
  return v ? String(v) : ''
}
function nomeFuncao(d: Dados): string {
  const v = d.funcao_nome ?? d.funcao ?? d.cargo
  return v ? String(v) : ''
}
// A planilha antiga usava "AFASTADO - <supervisor>" como se fosse um posto
function ehPostoFicticio(nome: string): boolean {
  return /^AFASTADO\b/i.test(nome.trim())
}

function mesCruzaPeriodo(ym: string, inicio: string, fim: string): boolean {
  return inicio <= `${ym}-31` && fim >= `${ym}-01`
}

function buildHistoricoMes(
  eventos: ProntuarioEvento[],
  funcionario: ProntuarioFuncionario,
  ferias: PeriodoFerias[],
): MesEntry[] {
  const sorted = [...eventos].sort((a, b) => a.data.localeCompare(b.data))
  const now = new Date()
  const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const admissaoYM    = funcionario.data_admissao?.substring(0, 7)
  const primeiroEvYM  = sorted[0]?.data.substring(0, 7)
  const firstYM = [admissaoYM, primeiroEvYM].filter(Boolean).sort()[0] ?? currentYM

  // Generate all months from first event to today
  const months: string[] = []
  let cur = firstYM
  while (cur <= currentYM) {
    months.push(cur)
    const [y, m] = cur.split('-').map(Number)
    cur = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`
  }

  // Estado inicial: o que a PRIMEIRA mudança registrada diz sobre "antes".
  // A importação de planilha tem o posto/cargo da admissão inconsistente com as mudanças
  // seguintes; o "valor anterior" da primeira mudança é o dado mais confiável.
  const state = {
    posto:       '',
    secretaria:  '',
    funcao:      '',
    supervisor:  '',
    statusBase:  '' as '' | 'ativo' | 'afastado' | 'desligado',
  }
  const primeiraMudPosto = sorted.find(e => {
    const n = e.tipo === 'mudanca_posto' && e.dados_anteriores ? nomePosto(e.dados_anteriores) : ''
    return n !== '' && !ehPostoFicticio(n)
  })
  if (primeiraMudPosto?.dados_anteriores) {
    state.posto      = nomePosto(primeiraMudPosto.dados_anteriores)
    state.secretaria = nomeSecretaria(primeiraMudPosto.dados_anteriores)
  }
  const primeiraMudFuncao = sorted.find(e =>
    e.tipo === 'mudanca_funcao' && e.dados_anteriores && nomeFuncao(e.dados_anteriores) !== '')
  if (primeiraMudFuncao?.dados_anteriores) {
    state.funcao = nomeFuncao(primeiraMudFuncao.dados_anteriores)
  }

  // Last event YM is used to override the tail with current employee data
  const lastEventYM = sorted.length > 0 ? sorted[sorted.length - 1].data.substring(0, 7) : ''

  const result: MesEntry[] = []
  let ei = 0

  for (const ym of months) {
    const eventsThisMonth: string[] = []

    // Advance through all events that fall in or before this month
    while (ei < sorted.length && sorted[ei].data.substring(0, 7) <= ym) {
      const e = sorted[ei]
      if (e.data.substring(0, 7) === ym) eventsThisMonth.push(e.tipo)

      const d = (e.dados_novos ?? {}) as Dados
      switch (e.tipo) {
        case 'admissao': {
          const p = nomePosto(d)
          if (p && !state.posto) {
            state.posto      = p
            state.secretaria = nomeSecretaria(d)
          }
          const fn = nomeFuncao(d)
          if (fn && !state.funcao) state.funcao = fn
          if (d.supervisor) state.supervisor = String(d.supervisor)
          state.statusBase = String(d.status ?? 'ativo').toLowerCase() === 'ativo' ? 'ativo' : state.statusBase
          break
        }
        case 'mudanca_posto': {
          const p = nomePosto(d)
          if (!p) break
          if (ehPostoFicticio(p)) {
            // posto fictício de afastado: mantém o último posto real
            state.statusBase = 'afastado'
            break
          }
          state.posto      = p
          state.secretaria = nomeSecretaria(d)
          if (d.supervisor) state.supervisor = String(d.supervisor)
          // movimentação registrada pelo sistema (posto_id) não informa supervisor:
          // o valor antigo deixou de valer e não há como saber o novo
          else if (d.posto_id) state.supervisor = ''
          break
        }
        case 'mudanca_funcao': {
          // correção desfeita logo depois (A→B→A): resultado líquido é nulo
          if (e.correcao) break
          const fn = nomeFuncao(d)
          if (fn) state.funcao = fn
          break
        }
        case 'transferencia':
          if (d.supervisor) state.supervisor = String(d.supervisor)
          if (d.status) {
            const st = String(d.status).toLowerCase()
            if (st === 'ativo' || st === 'afastado' || st === 'desligado') state.statusBase = st
          }
          break
        case 'desligamento':
          state.statusBase = 'desligado'
          break
        case 'reativacao':
        case 'retorno_afastamento':
          state.statusBase = 'ativo'
          break
        case 'afastamento':
          state.statusBase = 'afastado'
          break
        // 'ferias' não altera o estado: o status do mês vem dos períodos reais (abaixo)
      }
      ei++
    }

    const isAfterLastEvent = lastEventYM ? ym > lastEventYM : false
    const isCurrent = ym === currentYM

    // Status base do mês: evento (afastado/desligado) ou ativo desde a admissão
    let status: string = state.statusBase
    if (!status && admissaoYM && ym >= admissaoYM) status = 'ativo'
    if (isAfterLastEvent && isCurrent && funcionario.status) status = funcionario.status

    // Férias: pelo período real, nunca "herdado" de um evento antigo
    if (status === 'ativo' || status === '') {
      if (ferias.some(p => mesCruzaPeriodo(ym, p.inicio, p.fim))) status = 'ferias'
    }

    result.push({
      ym,
      // Após o último evento o cadastro atual é a fonte. Antes disso, só o que os eventos dizem.
      posto:        isAfterLastEvent ? (funcionario.posto      ?? state.posto)      : state.posto,
      secretaria:   isAfterLastEvent ? (funcionario.secretaria ?? state.secretaria) : state.secretaria,
      funcao:       isAfterLastEvent ? (funcionario.funcao     ?? state.funcao)     : state.funcao,
      status,
      supervisor:   state.supervisor,
      eventosNoMes: eventsThisMonth,
    })
  }

  return result.reverse() // most recent first
}

// Ordem de relevância para os selos do mês (mais grave primeiro)
const SEVERIDADE = [
  'desligamento', 'suspensao', 'advertencia', 'afastamento', 'retorno_afastamento', 'falta',
  'atestado', 'ferias', 'mudanca_posto', 'transferencia', 'mudanca_funcao', 'mudanca_horario',
  'cobertura_insalubre', 'reativacao', 'admissao',
]
function severidade(tipo: string): number {
  const i = SEVERIDADE.indexOf(tipo)
  return i === -1 ? SEVERIDADE.length : i
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = iso.split('T')[0]
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

// Campos internos (ids) que nunca devem aparecer: o nome resolvido é exibido no lugar.
const CAMPOS_OCULTOS = new Set(['posto_id', 'funcao_id', 'turno_id', 'secretaria_nome'])
const ROTULOS: Record<string, string> = {
  posto_nome:  'Posto',
  posto:       'Posto',
  funcao_nome: 'Função',
  funcao:      'Função',
  cargo:       'Função',
  horario:     'Horário',
}

export function dadosList(dados: Record<string, unknown> | null): [string, string][] {
  if (!dados) return []
  const temPostoNome  = dados.posto_nome  != null && dados.posto_nome  !== ''
  const temFuncaoNome = dados.funcao_nome != null && dados.funcao_nome !== ''
  return Object.entries(dados)
    .filter(([k, v]) => {
      if (v == null || v === '') return false
      if (CAMPOS_OCULTOS.has(k)) return false
      if (k === 'posto' && temPostoNome) return false
      if ((k === 'funcao' || k === 'cargo') && temFuncaoNome) return false
      return true
    })
    .map(([k, v]) => {
      const label = ROTULOS[k] ?? k
      const val   = (k === 'posto' || k === 'posto_nome') ? String(v).replace(/""/g, '"') : String(v)
      return [label, val] as [string, string]
    })
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  funcionario: ProntuarioFuncionario
  eventos: ProntuarioEvento[]
  ferias: PeriodoFerias[]
}

export function ProntuarioClient({ funcionario, eventos: eventosBrutos, ferias }: Props) {
  const [filtro,     setFiltro]     = useState<string | null>(null)
  const [loadingPdf, setLoadingPdf] = useState(false)
  const [aba,        setAba]        = useState<'timeline' | 'historico-mes'>('timeline')

  // Falta lançada automaticamente por suspensão é o mesmo incidente da suspensão: não é exibida
  // nem contada como falta (a suspensão já informa o dia aplicado).
  const eventos = eventosBrutos.filter(e => e.origem !== 'suspensao')

  const mesEntries = buildHistoricoMes(eventos, funcionario, ferias)

  const contagem = eventos.reduce<Record<string, number>>((acc, e) => {
    acc[e.tipo] = (acc[e.tipo] ?? 0) + 1
    return acc
  }, {})

  const tiposPresentes = Array.from(new Set(eventos.map(e => e.tipo)))
    .sort((a, b) => (contagem[b] ?? 0) - (contagem[a] ?? 0))

  const eventosFiltrados = filtro ? eventos.filter(e => e.tipo === filtro) : eventos

  const statusBadge = funcionario.status ? STATUS_BADGE[funcionario.status] : null

  async function handlePDF() {
    setLoadingPdf(true)
    try {
      const { pdf }              = await import('@react-pdf/renderer')
      const { ProntuarioPDFDoc } = await import('./prontuario-pdf-doc')
      const blob = await pdf(
        <ProntuarioPDFDoc funcionario={funcionario} eventos={eventos} mesEntries={mesEntries} />
      ).toBlob()
      const url = URL.createObjectURL(blob)
      const a   = document.createElement('a')
      a.href    = url
      const slug = funcionario.nome.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
      a.download = `prontuario-${slug}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setLoadingPdf(false)
    }
  }

  return (
    <>
      {/* PDF export */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handlePDF}
          disabled={loadingPdf || eventos.length === 0}
          className="flex h-9 items-center gap-1.5 rounded-lg bg-amber-500 px-3 text-sm font-medium text-slate-900 hover:bg-amber-400 disabled:opacity-40"
        >
          {loadingPdf
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <FileText className="h-4 w-4" />}
          {loadingPdf ? 'Gerando…' : 'Exportar PDF'}
        </button>
      </div>

      {/* Funcionário header */}
      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-gray-900">{funcionario.nome}</h2>
              {statusBadge && (
                <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset', statusBadge.className)}>
                  {statusBadge.label}
                </span>
              )}
              {funcionario.status === 'desligado' && funcionario.data_desligamento && (
                <span className="text-xs text-gray-400">
                  Desligado em {fmt(funcionario.data_desligamento)}
                  {funcionario.tipo_desligamento && (
                    <> — {TIPO_DESLIG_MAP[funcionario.tipo_desligamento] ?? funcionario.tipo_desligamento}</>
                  )}
                  {funcionario.motivo_desligamento && (
                    <> · {TODOS_MOTIVOS_DESLIG[funcionario.motivo_desligamento] ?? funcionario.motivo_desligamento}</>
                  )}
                </span>
              )}
            </div>
          </div>
          <span className="text-sm text-gray-400">{eventos.length} evento{eventos.length !== 1 ? 's' : ''}</span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-3 text-sm sm:grid-cols-4">
          {[
            { label: 'Função',     value: funcionario.funcao     },
            { label: 'Posto',      value: funcionario.posto      },
            { label: 'Secretaria', value: funcionario.secretaria },
            { label: 'Admissão',   value: fmt(funcionario.data_admissao) },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">{label}</p>
              <p className="text-gray-900">{value ?? '—'}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 rounded-xl bg-gray-100 p-1 w-fit">
        <button
          onClick={() => setAba('timeline')}
          className={cn(
            'rounded-lg px-4 py-2 text-sm font-medium transition-colors',
            aba === 'timeline'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700',
          )}
        >
          Linha do Tempo
        </button>
        <button
          onClick={() => setAba('historico-mes')}
          className={cn(
            'rounded-lg px-4 py-2 text-sm font-medium transition-colors',
            aba === 'historico-mes'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700',
          )}
        >
          Histórico por Mês
        </button>
      </div>

      {/* ── Linha do Tempo ── */}
      {aba === 'timeline' && (
        <>
          {/* Type filter pills */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFiltro(null)}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-semibold transition-colors',
                filtro === null
                  ? 'bg-slate-900 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
              )}
            >
              Todos ({eventos.length})
            </button>
            {tiposPresentes.map(tipo => {
              const cfg = EVENT_CONFIG[tipo] ?? DEFAULT_CONFIG
              return (
                <button
                  key={tipo}
                  onClick={() => setFiltro(filtro === tipo ? null : tipo)}
                  className={cn(
                    'rounded-full px-3 py-1 text-xs font-semibold transition-colors',
                    filtro === tipo
                      ? cn(cfg.dot, 'text-white')
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                  )}
                >
                  {cfg.label} ({contagem[tipo]})
                </button>
              )
            })}
          </div>

          {/* Timeline */}
          {eventosFiltrados.length === 0 ? (
            <div className="rounded-xl border border-gray-100 bg-white py-12 text-center shadow-sm">
              <p className="text-sm text-gray-400">Nenhum evento encontrado.</p>
            </div>
          ) : (
            <div className="relative">
              <div className="absolute left-[17px] top-0 bottom-4 w-0.5 bg-gray-200" />
              <div className="space-y-4">
                {eventosFiltrados.map(evento => {
                  const cfg     = EVENT_CONFIG[evento.tipo] ?? DEFAULT_CONFIG
                  const Icon    = cfg.icon
                  const antList = dadosList(evento.dados_anteriores)
                  const novList = dadosList(evento.dados_novos)

                  return (
                    <div key={evento.id} className="relative flex gap-4">
                      <div className={cn(
                        'relative z-10 mt-1 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ring-2 ring-white',
                        cfg.dot,
                      )}>
                        <Icon className="h-4 w-4 text-white" />
                      </div>

                      <div className={cn('flex-1 rounded-xl border border-gray-100 bg-white p-4 shadow-sm', evento.correcao && 'opacity-60')}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className={cn('text-xs font-bold uppercase tracking-wide', cfg.text)}>
                            {cfg.label}{evento.correcao ? ' (ajuste)' : ''}
                          </span>
                          <span className="text-xs font-medium text-gray-400">{fmt(evento.dataDisplay ?? evento.data)}</span>
                        </div>

                        {evento.descricao && (
                          <p className="mt-1.5 text-sm text-gray-700">{evento.descricao}</p>
                        )}

                        {(antList.length > 0 || novList.length > 0) && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {Array.from(new Set([...antList.map(([k]) => k), ...novList.map(([k]) => k)])).map(k => {
                              const antValor = antList.find(([ak]) => ak === k)?.[1]
                              const novValor = novList.find(([nk]) => nk === k)?.[1]
                              return (
                                <span key={k} className="inline-flex items-center gap-1 rounded-md bg-gray-50 px-2 py-0.5 text-xs text-gray-500">
                                  <span className="font-medium text-gray-400">{k}:</span>
                                  {antValor && novValor ? (
                                    <>
                                      <span className="line-through text-gray-400">{antValor}</span>
                                      <span className="text-gray-700">→ {novValor}</span>
                                    </>
                                  ) : antValor ? (
                                    <span className="line-through text-gray-400">{antValor}</span>
                                  ) : (
                                    <span>{novValor}</span>
                                  )}
                                </span>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Histórico por Mês ── */}
      {aba === 'historico-mes' && (
        mesEntries.length === 0 ? (
          <div className="rounded-xl border border-gray-100 bg-white py-12 text-center shadow-sm">
            <p className="text-sm text-gray-400">Nenhum evento registrado.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm" style={{ minWidth: 700 }}>
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    {['Mês/Ano', 'Posto', 'Secretaria', 'Função', 'Status', 'Supervisor', 'Evento no Mês'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-gray-400 whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {mesEntries.map(entry => {
                    const sb = STATUS_BADGE[entry.status]
                    const qtdPorTipo = entry.eventosNoMes.reduce<Record<string, number>>((acc, t) => {
                      acc[t] = (acc[t] ?? 0) + 1
                      return acc
                    }, {})
                    const uniqueEventos = Object.keys(qtdPorTipo).sort((a, b) => severidade(a) - severidade(b))
                    return (
                      <tr key={entry.ym} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                          {fmtMesAno(entry.ym)}
                        </td>
                        <td className="max-w-[180px] truncate px-4 py-3 text-gray-700">
                          {entry.posto || '—'}
                        </td>
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                          {entry.secretaria || '—'}
                        </td>
                        <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                          {entry.funcao || '—'}
                        </td>
                        <td className="px-4 py-3">
                          {sb ? (
                            <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset', sb.className)}>
                              {sb.label}
                            </span>
                          ) : (
                            <span className="text-gray-400">{entry.status || '—'}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                          {entry.supervisor || '—'}
                        </td>
                        <td className="px-4 py-3">
                          {uniqueEventos.length === 0 ? (
                            <span className="text-gray-300">—</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {uniqueEventos.slice(0, 3).map(tipo => {
                                const cfg = EVENT_CONFIG[tipo] ?? DEFAULT_CONFIG
                                return (
                                  <span
                                    key={tipo}
                                    className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-semibold text-white', cfg.dot)}
                                  >
                                    {cfg.label}{qtdPorTipo[tipo] > 1 ? ` ×${qtdPorTipo[tipo]}` : ''}
                                  </span>
                                )
                              })}
                              {uniqueEventos.length > 3 && (
                                <span className="text-xs text-gray-400">+{uniqueEventos.length - 3}</span>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}
    </>
  )
}
