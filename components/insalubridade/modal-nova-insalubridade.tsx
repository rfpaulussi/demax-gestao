'use client'

import { useState, useTransition, useEffect, useMemo } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { Search, MapPin, UserCheck, UserX, CalendarDays, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { criarInsalubridade, buscarAgentesPorPosto } from '@/app/(admin)/insalubridade/actions'
import type { FuncOpt } from '@/app/(admin)/insalubridade/actions'

interface Posto { id: string; nome: string; secretaria: string | null }

interface Props {
  open: boolean
  onClose: () => void
  funcionariosOpt: FuncOpt[]
  postos: Posto[]
  mesAtual: number
  anoAtual: number
}

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Normaliza para busca: sem acento, minúsculo. "MARABÁ" casa com "maraba". */
const DIACRITICOS = new RegExp('[\\u0300-\\u036f]', 'g')

function norm(s: string): string {
  return s.normalize('NFD').replace(DIACRITICOS, '').toLowerCase()
}

function fmt(iso: string): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

/** Data final = início + (dias - 1). */
function dataFim(inicio: string, dias: number): string {
  if (!inicio || dias < 1) return ''
  const d = new Date(inicio + 'T12:00:00')
  d.setDate(d.getDate() + dias - 1)
  return d.toISOString().split('T')[0]
}

const STATUS_FUNC: Record<string, { label: string; cls: string }> = {
  ativo:    { label: 'Ativo',    cls: 'bg-green-100 text-green-700 ring-green-200'    },
  ferias:   { label: 'Férias',   cls: 'bg-orange-100 text-orange-700 ring-orange-200' },
  atestado: { label: 'Atestado', cls: 'bg-blue-100 text-blue-700 ring-blue-200'       },
  afastado: { label: 'Afastado', cls: 'bg-purple-100 text-purple-700 ring-purple-200' },
}

const FUNCAO_BADGE_CLS: Array<{ test: (n: string) => boolean; cls: string }> = [
  { test: n => n.includes('AJUDANTE'),                                                                             cls: 'text-blue-600 bg-blue-50'     },
  { test: n => n.includes('HIGIENIZA') || n.includes('AGENTE'),                                                    cls: 'text-purple-600 bg-purple-50' },
  { test: n => n.includes('JARDINEIRO') || n.includes('ROÇADOR') || n.includes('ROCADOR') || n.includes('VERDE'),  cls: 'text-green-600 bg-green-50'   },
  { test: n => n.includes('JOVEM APRENDIZ') || n.includes('APRENDIZ'),                                             cls: 'text-orange-600 bg-orange-50' },
]

function funcaoBadgeCls(nome: string): string {
  const n = nome.toUpperCase()
  return FUNCAO_BADGE_CLS.find(e => e.test(n))?.cls ?? 'text-gray-600 bg-gray-100'
}

const AVATAR_COLORS = ['bg-indigo-500', 'bg-purple-500', 'bg-pink-500', 'bg-rose-500', 'bg-teal-500', 'bg-cyan-500', 'bg-blue-500', 'bg-violet-500']

function hashColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) & 0xffff
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

function initials(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('')
}

function StatusBadge({ status }: { status?: string | null }) {
  const s = STATUS_FUNC[status ?? '']
  if (!s) return null
  return (
    <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset', s.cls)}>
      {s.label}
    </span>
  )
}

// ─── combobox de busca (renderiza inline, sem overlay) ────────────────────────

interface Opcao {
  id: string
  primary: string
  secondary?: string | null
  haystack: string
  extra?: React.ReactNode
}

function Combobox({
  opcoes, placeholder, vazio, accent, onSelect,
}: {
  opcoes: Opcao[]
  placeholder: string
  vazio: string
  accent: 'blue' | 'emerald' | 'amber'
  onSelect: (id: string) => void
}) {
  const [q, setQ] = useState('')
  const [ativo, setAtivo] = useState(0)

  const ring = {
    blue:    'focus-within:border-blue-400 focus-within:ring-blue-100',
    emerald: 'focus-within:border-emerald-400 focus-within:ring-emerald-100',
    amber:   'focus-within:border-amber-400 focus-within:ring-amber-100',
  }[accent]

  const hover = {
    blue:    'hover:bg-blue-50',
    emerald: 'hover:bg-emerald-50',
    amber:   'hover:bg-amber-50',
  }[accent]

  const marcado = {
    blue:    'bg-blue-50',
    emerald: 'bg-emerald-50',
    amber:   'bg-amber-50',
  }[accent]

  const filtradas = useMemo(() => {
    const termos = norm(q).split(/\s+/).filter(Boolean)
    if (termos.length === 0) return opcoes
    return opcoes.filter(o => termos.every(t => o.haystack.includes(t)))
  }, [q, opcoes])

  useEffect(() => { setAtivo(0) }, [q])

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown')      { e.preventDefault(); setAtivo(i => Math.min(i + 1, filtradas.length - 1)) }
    else if (e.key === 'ArrowUp')   { e.preventDefault(); setAtivo(i => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter')     {
      e.preventDefault()
      const alvo = filtradas[ativo]
      if (alvo) onSelect(alvo.id)
    }
  }

  return (
    <div>
      <div className={cn('flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 transition focus-within:ring-4', ring)}>
        <Search className="h-4 w-4 shrink-0 text-gray-400" />
        <input
          type="text"
          value={q}
          onChange={e => setQ(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          className="h-10 w-full bg-transparent text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none"
        />
        {q && (
          <button type="button" onClick={() => setQ('')} className="shrink-0 text-gray-300 hover:text-gray-500">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="mt-1.5 max-h-56 overflow-y-auto rounded-lg border border-gray-100 bg-white">
        {filtradas.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-gray-400">{vazio}</p>
        ) : (
          filtradas.slice(0, 60).map((o, i) => (
            <button
              key={o.id}
              type="button"
              onClick={() => onSelect(o.id)}
              onMouseEnter={() => setAtivo(i)}
              className={cn(
                'flex w-full flex-col items-start gap-0.5 border-b border-gray-50 px-3 py-2 text-left last:border-0',
                hover,
                i === ativo && marcado,
              )}
            >
              <span className="text-sm font-medium text-gray-900">{o.primary}</span>
              {o.secondary && <span className="text-xs text-gray-500">{o.secondary}</span>}
              {o.extra}
            </button>
          ))
        )}
      </div>

      {filtradas.length > 60 && (
        <p className="mt-1 text-[11px] text-gray-400">
          Mostrando 60 de {filtradas.length} — refine a busca.
        </p>
      )}
    </div>
  )
}

// ─── blocos ───────────────────────────────────────────────────────────────────

const ACCENT = {
  blue:    { card: 'border-blue-200 bg-blue-50/50',       bar: 'bg-blue-500',    text: 'text-blue-700',    icon: 'text-blue-500'    },
  emerald: { card: 'border-emerald-200 bg-emerald-50/50', bar: 'bg-emerald-500', text: 'text-emerald-700', icon: 'text-emerald-500' },
  amber:   { card: 'border-amber-200 bg-amber-50/50',     bar: 'bg-amber-500',   text: 'text-amber-700',   icon: 'text-amber-500'   },
  slate:   { card: 'border-gray-200 bg-gray-50/50',       bar: 'bg-gray-400',    text: 'text-gray-600',    icon: 'text-gray-400'    },
}

function Bloco({
  accent, icon: Icon, titulo, subtitulo, obrigatorio, children,
}: {
  accent: keyof typeof ACCENT
  icon: React.ComponentType<{ className?: string }>
  titulo: string
  subtitulo: string
  obrigatorio?: boolean
  children: React.ReactNode
}) {
  const a = ACCENT[accent]
  return (
    <section className={cn('overflow-hidden rounded-xl border', a.card)}>
      <div className={cn('h-1', a.bar)} />
      <div className="p-3.5">
        <div className="mb-2.5 flex items-start gap-2">
          <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', a.icon)} />
          <div className="min-w-0">
            <h3 className={cn('text-xs font-bold uppercase tracking-widest', a.text)}>
              {titulo}{obrigatorio && <span className="ml-1 text-red-500">*</span>}
            </h3>
            <p className="mt-0.5 text-xs leading-snug text-gray-500">{subtitulo}</p>
          </div>
        </div>
        {children}
      </div>
    </section>
  )
}

function CardSelecionado({
  nome, linhas, badge, onTrocar,
}: {
  nome: string
  linhas?: React.ReactNode
  badge?: React.ReactNode
  onTrocar: () => void
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2.5">
      <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white', hashColor(nome))}>
        {initials(nome)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-gray-900">{nome}</p>
        {badge}
        {linhas}
      </div>
      <button type="button" onClick={onTrocar} className="shrink-0 text-xs font-medium text-slate-500 hover:text-slate-800 hover:underline">
        Trocar
      </button>
    </div>
  )
}

// ─── componente ───────────────────────────────────────────────────────────────

export function ModalNovaInsalubridade({ open, onClose, funcionariosOpt, postos, mesAtual, anoAtual }: Props) {
  const [posto,      setPosto]      = useState<Posto | null>(null)
  const [substituto, setSubstituto] = useState<FuncOpt | null>(null)
  const [ausentes,   setAusentes]   = useState<FuncOpt[]>([])
  const [ausente,    setAusente]    = useState<FuncOpt | null>(null)
  const [ausenteLivre, setAusenteLivre] = useState('')
  const [carregandoAusentes, setCarregandoAusentes] = useState(false)

  const mesStr = String(mesAtual).padStart(2, '0')
  const [dataInicio, setDataInicio] = useState(`${anoAtual}-${mesStr}-01`)
  // Mantido como string para permitir o campo vazio enquanto o usuário digita.
  const [diasRaw,    setDiasRaw]    = useState('1')
  const [observacao, setObservacao] = useState('')

  const dias = Math.max(1, Number(diasRaw) || 1)

  const [erroSubmit, setErroSubmit] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Opções de posto — a lista já chega sem os postos "AFASTADOS".
  const opcoesPosto: Opcao[] = useMemo(
    () => postos
      .slice()
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
      .map(p => ({
        id: p.id,
        primary: p.nome,
        secondary: p.secretaria,
        haystack: norm(`${p.nome} ${p.secretaria ?? ''}`),
      })),
    [postos],
  )

  const opcoesSubstituto: Opcao[] = useMemo(
    () => funcionariosOpt.map(f => ({
      id: f.id,
      primary: f.nome,
      secondary: f.postos ? `${f.postos.nome}${f.postos.secretaria ? ` · ${f.postos.secretaria}` : ''}` : null,
      haystack: norm(`${f.nome} ${f.funcoes?.nome ?? ''} ${f.postos?.nome ?? ''}`),
      extra: (
        <span className="mt-1 flex flex-wrap items-center gap-1.5">
          {f.funcoes?.nome && (
            <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-semibold', funcaoBadgeCls(f.funcoes.nome))}>
              {f.funcoes.nome}
            </span>
          )}
          {f.status !== 'ativo' && <StatusBadge status={f.status} />}
        </span>
      ),
    })),
    [funcionariosOpt],
  )

  const opcoesAusente: Opcao[] = useMemo(
    () => ausentes.map(f => ({
      id: f.id,
      primary: f.nome,
      secondary: f.funcoes?.nome ?? null,
      haystack: norm(f.nome),
      extra: <span className="mt-1 inline-flex"><StatusBadge status={f.status} /></span>,
    })),
    [ausentes],
  )

  async function selecionarPosto(id: string) {
    const p = postos.find(x => x.id === id)
    if (!p) return
    setPosto(p)
    setAusente(null)
    setAusenteLivre('')
    setCarregandoAusentes(true)
    try {
      setAusentes(await buscarAgentesPorPosto(id))
    } finally {
      setCarregandoAusentes(false)
    }
  }

  function limparPosto() {
    setPosto(null)
    setAusentes([])
    setAusente(null)
    setAusenteLivre('')
  }

  function handleClose() {
    limparPosto()
    setSubstituto(null)
    setDataInicio(`${anoAtual}-${mesStr}-01`)
    setDiasRaw('1')
    setObservacao('')
    setErroSubmit(null)
    onClose()
  }

  const mesmaPessoa = Boolean(substituto && ausente && substituto.id === ausente.id)
  const fim         = dataFim(dataInicio, dias)
  const mesDaData   = dataInicio ? Number(dataInicio.split('-')[1]) : null
  const anoDaData   = dataInicio ? Number(dataInicio.split('-')[0]) : null
  const foraDoMes   = Boolean(dataInicio && (mesDaData !== mesAtual || anoDaData !== anoAtual))

  const podeSalvar = Boolean(posto && substituto && dataInicio && dias >= 1 && !mesmaPessoa && !isPending)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!podeSalvar || !posto || !substituto) return

    const fd = new FormData()
    fd.set('funcionario_id', substituto.id)
    fd.set('posto_id', posto.id)
    fd.set('data_cobertura', dataInicio)
    fd.set('periodo_dias', String(dias))
    fd.set('observacao', observacao)
    if (ausente) {
      fd.set('agente_ausente_id', ausente.id)
      fd.set('agente_ausente_nome', ausente.nome)
    } else if (ausenteLivre.trim()) {
      fd.set('agente_ausente_nome', ausenteLivre.trim())
    }

    setErroSubmit(null)
    startTransition(async () => {
      const res = await criarInsalubridade(fd)
      if (res?.error) setErroSubmit(res.error)
      else handleClose()
    })
  }

  return (
    <Dialog.Root open={open} onOpenChange={isOpen => { if (!isOpen) handleClose() }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/50" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 flex max-h-[92vh] w-[calc(100%-1.5rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl bg-white shadow-2xl">

          {/* Cabeçalho */}
          <div className="flex items-start justify-between border-b border-gray-100 px-5 py-3.5">
            <div>
              <Dialog.Title className="text-base font-bold text-gray-900">Nova Declaração</Dialog.Title>
              <p className="text-xs text-gray-400">Lançamento manual de cobertura insalubre</p>
            </div>
            <button type="button" onClick={handleClose} className="-mr-1 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
              <X className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">

              {/* 1 — POSTO */}
              <Bloco
                accent="blue"
                icon={MapPin}
                titulo="Posto"
                subtitulo="Local onde a cobertura insalubre aconteceu"
                obrigatorio
              >
                {posto ? (
                  <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-gray-900">{posto.nome}</p>
                      {posto.secretaria && <p className="text-xs text-gray-500">{posto.secretaria}</p>}
                    </div>
                    <button type="button" onClick={limparPosto} className="ml-3 shrink-0 text-xs font-medium text-slate-500 hover:text-slate-800 hover:underline">
                      Trocar
                    </button>
                  </div>
                ) : (
                  <Combobox
                    opcoes={opcoesPosto}
                    placeholder="Buscar posto por nome ou secretaria..."
                    vazio="Nenhum posto encontrado."
                    accent="blue"
                    onSelect={selecionarPosto}
                  />
                )}
              </Bloco>

              {/* 2 — QUEM COBRIU */}
              <Bloco
                accent="emerald"
                icon={UserCheck}
                titulo="Quem cobriu"
                subtitulo="Funcionário que foi ao posto e vai receber os 40% de insalubridade"
                obrigatorio
              >
                {substituto ? (
                  <CardSelecionado
                    nome={substituto.nome}
                    onTrocar={() => setSubstituto(null)}
                    badge={
                      <span className="mt-1 flex flex-wrap items-center gap-1.5">
                        {substituto.funcoes?.nome && (
                          <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-semibold', funcaoBadgeCls(substituto.funcoes.nome))}>
                            {substituto.funcoes.nome}
                          </span>
                        )}
                        {substituto.status !== 'ativo' && <StatusBadge status={substituto.status} />}
                      </span>
                    }
                    linhas={
                      substituto.postos && (
                        <p className="mt-1 text-xs text-gray-500">
                          Posto de origem: <span className="font-medium text-gray-700">{substituto.postos.nome}</span>
                          {substituto.postos.secretaria ? ` · ${substituto.postos.secretaria}` : ''}
                        </p>
                      )
                    }
                  />
                ) : (
                  <Combobox
                    opcoes={opcoesSubstituto}
                    placeholder="Buscar por nome, função ou posto..."
                    vazio="Nenhum funcionário encontrado."
                    accent="emerald"
                    onSelect={id => setSubstituto(funcionariosOpt.find(f => f.id === id) ?? null)}
                  />
                )}
              </Bloco>

              {/* 3 — QUEM FALTOU */}
              <Bloco
                accent="amber"
                icon={UserX}
                titulo="Quem faltou"
                subtitulo="Agente ausente do posto que foi coberto — opcional"
              >
                {!posto ? (
                  <p className="rounded-lg border border-dashed border-gray-200 px-3 py-4 text-center text-xs text-gray-400">
                    Selecione o posto primeiro.
                  </p>
                ) : carregandoAusentes ? (
                  <p className="rounded-lg border border-dashed border-gray-200 px-3 py-4 text-center text-xs text-gray-400">
                    Carregando agentes do posto...
                  </p>
                ) : ausente ? (
                  <CardSelecionado
                    nome={ausente.nome}
                    onTrocar={() => setAusente(null)}
                    badge={<span className="mt-1 inline-flex"><StatusBadge status={ausente.status} /></span>}
                    linhas={ausente.funcoes?.nome ? <p className="mt-1 text-xs text-gray-500">{ausente.funcoes.nome}</p> : null}
                  />
                ) : ausentes.length > 0 ? (
                  <>
                    <Combobox
                      opcoes={opcoesAusente}
                      placeholder="Buscar agente do posto..."
                      vazio="Nenhum agente encontrado."
                      accent="amber"
                      onSelect={id => setAusente(ausentes.find(f => f.id === id) ?? null)}
                    />
                    <p className="mt-1.5 text-[11px] leading-snug text-gray-400">
                      A lista inclui quem está de férias, atestado ou afastado — o status aparece ao lado do nome.
                    </p>
                  </>
                ) : (
                  <input
                    type="text"
                    value={ausenteLivre}
                    onChange={e => setAusenteLivre(e.target.value)}
                    placeholder="Nenhum agente vinculado a este posto — digite o nome"
                    className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-800 placeholder:text-gray-400 focus:border-amber-400 focus:outline-none focus:ring-4 focus:ring-amber-100"
                  />
                )}

                {mesmaPessoa && (
                  <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                    Quem cobriu e quem faltou não podem ser a mesma pessoa. Verifique se os campos não foram invertidos.
                  </p>
                )}
              </Bloco>

              {/* 4 — PERÍODO */}
              <Bloco
                accent="slate"
                icon={CalendarDays}
                titulo="Período"
                subtitulo="Quando a cobertura começou e por quantos dias"
                obrigatorio
              >
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-widest text-gray-400">
                      Dia em que iniciou a cobertura
                    </label>
                    <input
                      type="date"
                      value={dataInicio}
                      onChange={e => setDataInicio(e.target.value)}
                      required
                      className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-800 focus:border-slate-400 focus:outline-none focus:ring-4 focus:ring-slate-100"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-widest text-gray-400">
                      Período (dias)
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={diasRaw}
                      onChange={e => setDiasRaw(e.target.value)}
                      onBlur={() => setDiasRaw(String(dias))}
                      required
                      className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-800 focus:border-slate-400 focus:outline-none focus:ring-4 focus:ring-slate-100"
                    />
                  </div>
                </div>

                {dataInicio && (
                  <span className="mt-2 inline-flex rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700">
                    {fmt(dataInicio)} a {fmt(fim)} · {dias} dia{dias !== 1 ? 's' : ''}
                  </span>
                )}

                {foraDoMes && (
                  <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    Esta data está fora do mês em exibição. O lançamento será salvo em{' '}
                    <span className="font-semibold">{String(mesDaData).padStart(2, '0')}/{anoDaData}</span> e não aparecerá na lista atual.
                  </p>
                )}

                <div className="mt-3">
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-widest text-gray-400">
                    Observação
                  </label>
                  <textarea
                    value={observacao}
                    onChange={e => setObservacao(e.target.value)}
                    rows={2}
                    placeholder="Observações opcionais..."
                    className="w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:border-slate-400 focus:outline-none focus:ring-4 focus:ring-slate-100"
                  />
                </div>
              </Bloco>

              {/* Resumo de conferência */}
              {posto && substituto && (
                <div className="rounded-xl border border-slate-200 bg-slate-900 px-4 py-3">
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">Confira antes de registrar</p>
                  <p className="text-sm leading-relaxed text-white">
                    <span className="font-bold text-emerald-300">{substituto.nome}</span>
                    {' cobriu '}
                    {ausente || ausenteLivre.trim() ? (
                      <span className="font-bold text-amber-300">{ausente?.nome ?? ausenteLivre.trim()}</span>
                    ) : (
                      <span className="italic text-slate-400">alguém não informado</span>
                    )}
                    {' no '}
                    <span className="font-bold text-blue-300">{posto.nome}</span>
                    {' — '}
                    {fmt(dataInicio)} a {fmt(fim)} ({dias} dia{dias !== 1 ? 's' : ''}).
                  </p>
                </div>
              )}

              {erroSubmit && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {erroSubmit}
                </p>
              )}
            </div>

            {/* Rodapé */}
            <div className="flex shrink-0 justify-end gap-3 border-t border-gray-100 bg-white px-5 py-3">
              <button
                type="button"
                onClick={handleClose}
                className="flex h-9 items-center rounded-lg border border-gray-200 px-4 text-sm font-medium text-gray-500 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={!podeSalvar}
                className="flex h-9 items-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
              >
                {isPending ? 'Salvando...' : 'Registrar'}
              </button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
