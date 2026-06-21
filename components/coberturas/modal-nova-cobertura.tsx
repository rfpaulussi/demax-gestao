'use client'

import { useState, useEffect, useRef } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { createClient } from '@/lib/supabase/client'
import { registrarCobertura } from '@/app/(admin)/coberturas/actions'
import { cn } from '@/lib/utils'

interface Funcionario {
  id: string
  nome: string
  posto_atual_nome?: string | null
  posto_atual_secretaria?: string | null
}

interface FuncionarioAusente {
  id: string
  nome: string
  funcao: string | null
}

interface Supervisor {
  id: string
  nome: string | null
}

interface Posto {
  id: string
  nome: string
  secretaria: string | null
}

type CidOpt = { codigo: string; descricao: string }

interface Props {
  open: boolean
  onClose: () => void
  supervisores?: Supervisor[]
  cids?: CidOpt[]
  onSuccess?: (msg: string) => void
}

// ─── helpers ──────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  'bg-indigo-500', 'bg-purple-500', 'bg-pink-500',
  'bg-rose-500', 'bg-teal-500', 'bg-cyan-500', 'bg-blue-500', 'bg-violet-500',
]

function hashColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) & 0xffff
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

function initials(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('')
}

function endOfMonth(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0]
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

const MESES = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

function nextMonthLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  const next = new Date(d.getFullYear(), d.getMonth() + 1, 1)
  return `${MESES[next.getMonth() + 1]}/${next.getFullYear()}`
}

const TIPO_MOTIVO_INFO: Record<string, { label: string; className: string }> = {
  atestado_medico:     { label: 'Atestado médico',     className: 'bg-blue-50 text-blue-700 ring-blue-200'      },
  falta_justificada:   { label: 'Falta justificada',   className: 'bg-amber-50 text-amber-700 ring-amber-200'   },
  falta_injustificada: { label: 'Falta injustificada', className: 'bg-amber-50 text-amber-700 ring-amber-200'   },
  ferias:              { label: 'Férias',               className: 'bg-orange-50 text-orange-700 ring-orange-200' },
  licenca:             { label: 'Licença',              className: 'bg-purple-50 text-purple-700 ring-purple-200' },
  folga:               { label: 'Folga',                className: 'bg-gray-100 text-gray-600 ring-gray-200'     },
  outros:              { label: 'Outros',               className: 'bg-gray-100 text-gray-600 ring-gray-200'     },
}

const fieldLabel = 'mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-500'
const inputCls   = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-300'

// ─── component ────────────────────────────────────────────────────────────────

export function ModalNovaCobertura({ open, onClose, supervisores = [], cids = [], onSuccess }: Props) {
  // substituto
  const [busca, setBusca]                     = useState('')
  const [resultadosBusca, setResultadosBusca] = useState<Funcionario[]>([])
  const [substituto, setSubstituto]           = useState<Funcionario | null>(null)

  // destino
  const [supervisorId, setSupervisorId]             = useState('')
  const [supervisorCounts, setSupervisorCounts]     = useState<Record<string, number>>({})
  const [postos, setPostos]                         = useState<Posto[]>([])
  const [postoId, setPostoId]                       = useState('')
  const [postoSearch, setPostoSearch]               = useState('')
  const [postoDropdownOpen, setPostoDropdownOpen]   = useState(false)
  const [postoSelecionado, setPostoSelecionado]     = useState<Posto | null>(null)
  const [secretaria, setSecretaria]                 = useState('')
  const [tipoMotivo, setTipoMotivo]                 = useState('')
  const [motivo, setMotivo]                         = useState('')

  // período cobertura
  const [apenasUmDia, setApenasUmDia] = useState(false)
  const [dataInicio, setDataInicio]   = useState('')
  const [dataFim, setDataFim]         = useState('')

  // ausente
  const [tipoCobertura, setTipoCobertura]               = useState<'reforco' | 'substituicao'>('reforco')
  const [funcionariosAusentes, setFuncionariosAusentes] = useState<FuncionarioAusente[]>([])
  const [funcionarioAusenteId, setFuncionarioAusenteId] = useState('')
  const [dataInicioAusencia, setDataInicioAusencia]     = useState('')
  const [dataFimAusencia, setDataFimAusencia]           = useState('')

  // falta inline
  const [lancarFalta, setLancarFalta] = useState(true)

  // atestado inline
  const [registrarAtestado, setRegistrarAtestado]   = useState(true)
  const [atestadoDataInicio, setAtestadoDataInicio] = useState('')
  const [atestadoDataFim, setAtestadoDataFim]       = useState('')
  const [atestadoMotivo, setAtestadoMotivo]         = useState('')
  const [cidBusca, setCidBusca]                     = useState('')
  const [cidCodigo, setCidCodigo]                   = useState('')
  const [cidAberto, setCidAberto]                   = useState(false)

  // form
  const [pending, setPending] = useState(false)
  const [erro, setErro]       = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Computed flags
  const isFaltaMotivo    = tipoMotivo === 'falta_justificada' || tipoMotivo === 'falta_injustificada'
  const isAtestadoMotivo = tipoMotivo === 'atestado_medico'
  const temAusente       = tipoCobertura === 'substituicao' && Boolean(funcionarioAusenteId)
  const showFaltaBanner    = isFaltaMotivo && temAusente
  const showAtestadoBanner = isAtestadoMotivo && temAusente

  const ausenteNomeAtual = temAusente
    ? (funcionariosAusentes.find(f => f.id === funcionarioAusenteId)?.nome ?? 'funcionário')
    : 'funcionário'

  const cidsFiltrados = cids.filter(c =>
    !cidBusca ||
    c.codigo.toLowerCase().includes(cidBusca.toLowerCase()) ||
    c.descricao.toLowerCase().includes(cidBusca.toLowerCase()),
  )

  // Sync atestado dates with ausência dates when they change
  useEffect(() => { setAtestadoDataInicio(dataInicioAusencia) }, [dataInicioAusencia])
  useEffect(() => { setAtestadoDataFim(dataFimAusencia) }, [dataFimAusencia])

  // Contagem de postos por supervisor
  useEffect(() => {
    if (!open) return
    const supabase = createClient()
    supabase
      .from('config_supervisores_postos')
      .select('supervisor_id')
      .then(({ data }) => {
        const counts: Record<string, number> = {}
        for (const r of data ?? []) counts[r.supervisor_id] = (counts[r.supervisor_id] ?? 0) + 1
        setSupervisorCounts(counts)
      })
  }, [open])

  // Postos do supervisor selecionado
  useEffect(() => {
    if (!supervisorId) {
      setPostos([]); setPostoId(''); setPostoSearch(''); setPostoSelecionado(null); setSecretaria('')
      return
    }
    const supabase = createClient()
    supabase
      .from('config_supervisores_postos')
      .select('posto_id, postos(id, nome, secretaria)')
      .eq('supervisor_id', supervisorId)
      .then(({ data }) => {
        type RawRow = { postos: { id: string; nome: string; secretaria: string | null } | null }
        const lista: Posto[] = ((data ?? []) as unknown as RawRow[])
          .filter(r => r.postos != null)
          .map(r => ({ id: r.postos!.id, nome: r.postos!.nome, secretaria: r.postos!.secretaria }))
        setPostos(lista)
        setPostoId(''); setPostoSearch(''); setPostoSelecionado(null); setSecretaria('')
      })
  }, [supervisorId])

  // Funcionários do posto destino
  useEffect(() => {
    if (!postoId) { setSecretaria(''); setFuncionariosAusentes([]); return }
    const posto = postos.find(p => p.id === postoId)
    setSecretaria(posto?.secretaria ?? '')
    import('@/app/(admin)/coberturas/actions').then(({ buscarFuncionariosAtivosNoPostoSemAfastamento }) => {
      buscarFuncionariosAtivosNoPostoSemAfastamento(postoId).then(setFuncionariosAusentes)
    })
  }, [postoId, postos])

  // Busca de substituto com debounce
  useEffect(() => {
    if (!open) return
    if (busca.trim().length < 2) { setResultadosBusca([]); return }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('funcionarios')
        .select('id, nome, postos:posto_id(nome, secretaria)')
        .eq('status', 'ativo')
        .ilike('nome', `%${busca.trim()}%`)
        .limit(8)
      type Raw = { id: string; nome: string; postos: { nome: string; secretaria: string | null } | null }
      setResultadosBusca(((data ?? []) as unknown as Raw[]).map(f => ({
        id: f.id,
        nome: f.nome,
        posto_atual_nome: f.postos?.nome ?? null,
        posto_atual_secretaria: f.postos?.secretaria ?? null,
      })))
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [busca, open])

  // Fecha dropdown de posto ao clicar fora
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (!(e.target as HTMLElement).closest('[data-posto-combobox]')) setPostoDropdownOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleClose() {
    setBusca(''); setResultadosBusca([]); setSubstituto(null)
    setSupervisorId(''); setPostos([]); setPostoId(''); setSecretaria('')
    setPostoSearch(''); setPostoDropdownOpen(false); setPostoSelecionado(null)
    setTipoMotivo(''); setMotivo(''); setApenasUmDia(false); setDataInicio(''); setDataFim('')
    setTipoCobertura('reforco'); setFuncionariosAusentes([])
    setFuncionarioAusenteId(''); setDataInicioAusencia(''); setDataFimAusencia('')
    setLancarFalta(true); setRegistrarAtestado(true)
    setAtestadoDataInicio(''); setAtestadoDataFim(''); setAtestadoMotivo('')
    setCidBusca(''); setCidCodigo(''); setCidAberto(false)
    setErro(null)
    onClose()
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!substituto || !postoId) return
    setErro(null)

    const savedDataInicio = dataInicio

    const fd = new FormData()
    fd.set('substituto_id', substituto.id)
    fd.set('supervisor_id', supervisorId)
    fd.set('posto_destino_id', postoId)
    fd.set('tipo_motivo', tipoMotivo)
    fd.set('motivo', motivo)
    fd.set('data_inicio', dataInicio)
    fd.set('data_fim', apenasUmDia ? dataInicio : dataFim)
    fd.set('tipo_cobertura', tipoCobertura)
    fd.set('lancar_falta', lancarFalta ? 'true' : 'false')
    fd.set('registrar_atestado', registrarAtestado ? 'true' : 'false')
    fd.set('atestado_motivo', atestadoMotivo)
    fd.set('atestado_data_inicio', atestadoDataInicio)
    fd.set('atestado_data_fim', atestadoDataFim)
    fd.set('atestado_cid_codigo', cidCodigo)
    if (tipoCobertura === 'substituicao') {
      fd.set('funcionario_ausente_id', funcionarioAusenteId)
      fd.set('data_inicio_ausencia', dataInicioAusencia)
      fd.set('data_fim_ausencia', dataFimAusencia)
      fd.set('funcionario_ausente_nome', ausenteNomeAtual)
    }

    setPending(true)
    try {
      const result = await registrarCobertura(fd)
      if (!result.success) { setErro(result.error); return }
      let msg = '✓ Cobertura salva.'
      if (result.faltaMsg)    msg += ' ' + result.faltaMsg
      if (result.atestadoMsg) msg += ' ' + result.atestadoMsg
      if (result.ultrapassaMes && savedDataInicio) {
        msg += ` Lembre-se de registrar a continuação em ${nextMonthLabel(savedDataInicio)}.`
      }
      onSuccess?.(msg)
      handleClose()
    } finally {
      setPending(false)
    }
  }

  // Computed
  const diasCobertura = (() => {
    if (!dataInicio) return null
    if (apenasUmDia) return 1
    if (!dataFim) return null
    const diff = Math.round(
      (new Date(dataFim + 'T12:00:00').getTime() - new Date(dataInicio + 'T12:00:00').getTime()) / 86400000
    ) + 1
    return diff > 0 ? diff : null
  })()

  const fimMes        = dataInicio ? endOfMonth(dataInicio) : null
  const ultrapassaMes = !apenasUmDia && dataFim && fimMes && dataFim > fimMes
  const supervisorAtual = supervisores.find(s => s.id === supervisorId)
  const tipoMotivoBadge = tipoMotivo ? TIPO_MOTIVO_INFO[tipoMotivo] : null
  const needsCid = showAtestadoBanner && registrarAtestado && !cidCodigo

  return (
    <Dialog.Root open={open} onOpenChange={isOpen => { if (!isOpen) handleClose() }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 bg-black/50 z-40" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 w-full max-w-3xl -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white shadow-2xl max-h-[92vh] overflow-y-auto">

          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
            <Dialog.Title className="text-sm font-bold uppercase tracking-widest text-gray-900">
              Nova Cobertura
            </Dialog.Title>
            <button type="button" onClick={handleClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            <div className="grid grid-cols-2 gap-6">

              {/* ── COLUNA ESQUERDA: SUBSTITUTO ── */}
              <div className="space-y-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Substituto</p>

                {!substituto ? (
                  <div>
                    <label className={fieldLabel}>Buscar Funcionário</label>
                    <input
                      type="text"
                      value={busca}
                      onChange={e => setBusca(e.target.value)}
                      placeholder="Digite o nome..."
                      className={inputCls}
                    />
                    {resultadosBusca.length > 0 && (
                      <ul className="mt-1 max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                        {resultadosBusca.map(f => (
                          <li key={f.id}>
                            <button
                              type="button"
                              onClick={() => { setSubstituto(f); setBusca(''); setResultadosBusca([]) }}
                              className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-slate-50"
                            >
                              <div className={`h-8 w-8 flex-shrink-0 rounded-full ${hashColor(f.nome)} flex items-center justify-center text-white text-xs font-bold`}>
                                {initials(f.nome)}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">{f.nome}</p>
                                {f.posto_atual_nome && (
                                  <p className="text-xs text-gray-400 truncate">
                                    {f.posto_atual_nome}{f.posto_atual_secretaria ? ` — ${f.posto_atual_secretaria}` : ''}
                                  </p>
                                )}
                              </div>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : (
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 flex items-start gap-3">
                    <div className={`h-12 w-12 flex-shrink-0 rounded-full ${hashColor(substituto.nome)} flex items-center justify-center text-white text-sm font-bold shadow`}>
                      {initials(substituto.nome)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900">{substituto.nome}</p>
                      {substituto.posto_atual_nome && (
                        <p className="mt-0.5 text-xs text-gray-500">
                          Posto atual:{' '}
                          <span className="font-medium text-gray-700">{substituto.posto_atual_nome}</span>
                          {substituto.posto_atual_secretaria ? ` — ${substituto.posto_atual_secretaria}` : ''}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setSubstituto(null)}
                      className="flex-shrink-0 text-xs text-indigo-600 hover:underline"
                    >
                      Trocar
                    </button>
                  </div>
                )}

                {/* Badge tipo motivo */}
                {tipoMotivoBadge && (
                  <div>
                    <span className={cn(
                      'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset',
                      tipoMotivoBadge.className,
                    )}>
                      {tipoMotivoBadge.label}
                    </span>
                  </div>
                )}
              </div>

              {/* ── COLUNA DIREITA: DESTINO ── */}
              <div className="space-y-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Destino</p>

                {/* Supervisor */}
                <div>
                  <label className={fieldLabel}>Supervisor Destino</label>
                  <select value={supervisorId} onChange={e => setSupervisorId(e.target.value)} required className={inputCls}>
                    <option value="">Selecione...</option>
                    {supervisores.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.nome}{supervisorCounts[s.id] ? ` (${supervisorCounts[s.id]} postos)` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Posto */}
                <div>
                  <label className={fieldLabel}>Posto Destino</label>
                  <div className="relative" data-posto-combobox>
                    <input
                      type="text"
                      placeholder={!supervisorId ? 'Selecione um supervisor primeiro...' : 'Buscar posto...'}
                      value={postoSearch}
                      disabled={!supervisorId}
                      onChange={e => { setPostoSearch(e.target.value); setPostoDropdownOpen(true); setPostoSelecionado(null); setPostoId('') }}
                      onFocus={() => { if (supervisorId) setPostoDropdownOpen(true) }}
                      className={`${inputCls} disabled:bg-gray-50 disabled:text-gray-400`}
                      autoComplete="off"
                    />
                    {postoDropdownOpen && supervisorId && postoSearch.length > 0 && (
                      <div className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                        {postos
                          .filter(p => { const q = postoSearch.toLowerCase(); return p.nome.toLowerCase().includes(q) || (p.secretaria ?? '').toLowerCase().includes(q) })
                          .slice(0, 30)
                          .map(p => (
                            <button key={p.id} type="button"
                              onClick={() => { setPostoSelecionado(p); setPostoSearch(p.nome); setPostoId(p.id); setPostoDropdownOpen(false) }}
                              className="flex w-full flex-col px-3 py-2 text-left hover:bg-slate-50"
                            >
                              <span className="text-sm font-medium">{p.nome}</span>
                              {p.secretaria && <span className="text-xs text-gray-400">{p.secretaria}</span>}
                            </button>
                          ))}
                        {postos.filter(p => { const q = postoSearch.toLowerCase(); return p.nome.toLowerCase().includes(q) || (p.secretaria ?? '').toLowerCase().includes(q) }).length === 0 && (
                          <p className="px-3 py-2 text-sm text-gray-400">Nenhum posto encontrado.</p>
                        )}
                      </div>
                    )}
                  </div>
                  {postoSelecionado && supervisorAtual && (
                    <p className="mt-1 text-xs text-gray-400">
                      Filtrado por supervisor:{' '}
                      <span className="font-medium text-slate-600">{supervisorAtual.nome}</span>
                      {supervisorCounts[supervisorId] ? ` · ${supervisorCounts[supervisorId]} postos disponíveis` : ''}
                    </p>
                  )}
                </div>

                {/* Secretaria */}
                <div>
                  <label className={fieldLabel}>Secretaria Destino</label>
                  <input type="text" readOnly value={secretaria || '—'}
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500" />
                </div>

                {/* Tipo do Motivo */}
                <div className="space-y-2">
                  <div>
                    <label className={fieldLabel}>Tipo do Motivo</label>
                    <select required value={tipoMotivo} onChange={e => setTipoMotivo(e.target.value)} className={inputCls}>
                      <option value="">Selecione...</option>
                      <option value="atestado_medico">Atestado médico</option>
                      <option value="falta_justificada">Falta justificada</option>
                      <option value="falta_injustificada">Falta injustificada</option>
                      <option value="folga">Folga</option>
                      <option value="outros">Outros</option>
                    </select>
                  </div>

                  {/* Banner falta interativo */}
                  {showFaltaBanner ? (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-800 space-y-2">
                      <p className="font-semibold">
                        ⚠️ Deseja registrar a falta de <span className="font-bold">{ausenteNomeAtual}</span> automaticamente?
                      </p>
                      <label className="flex cursor-pointer items-center gap-2">
                        <input type="checkbox" checked={lancarFalta} onChange={e => setLancarFalta(e.target.checked)}
                          className="h-3.5 w-3.5 rounded border-amber-300 text-amber-600" />
                        <span>Lançar falta ao salvar</span>
                      </label>
                      {lancarFalta && dataInicio && (
                        <p className="text-amber-700">
                          Período:{' '}
                          <span className="font-semibold">
                            {fmtDate(dataInicio)} a {fmtDate(apenasUmDia ? dataInicio : dataFim || dataInicio)}
                          </span>
                          {diasCobertura !== null && (
                            <span className="ml-1">({diasCobertura} dia{diasCobertura !== 1 ? 's' : ''})</span>
                          )}
                        </p>
                      )}
                    </div>
                  ) : isFaltaMotivo && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                      💡 Selecione o funcionário ausente abaixo para lançar a falta automaticamente.
                    </div>
                  )}

                  {/* Banner atestado interativo */}
                  {showAtestadoBanner ? (
                    <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-3 text-xs text-blue-800 space-y-2">
                      <p className="font-semibold">
                        💡 Deseja registrar o atestado de <span className="font-bold">{ausenteNomeAtual}</span> automaticamente?
                      </p>
                      <label className="flex cursor-pointer items-center gap-2">
                        <input type="checkbox" checked={registrarAtestado} onChange={e => setRegistrarAtestado(e.target.checked)}
                          className="h-3.5 w-3.5 rounded border-blue-300 text-blue-600" />
                        <span>Registrar atestado ao salvar</span>
                      </label>
                      {registrarAtestado && (
                        <div className="space-y-2 border-t border-blue-200 pt-2">
                          {/* Datas editáveis — pré-preenchidas com datas de ausência */}
                          <div className="flex gap-2">
                            <div className="flex-1">
                              <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-widest text-blue-600">
                                Data Início <span className="normal-case font-normal text-blue-400">do atestado</span>
                              </p>
                              <input type="date" value={atestadoDataInicio} onChange={e => setAtestadoDataInicio(e.target.value)}
                                className="w-full rounded border border-blue-200 bg-white px-2 py-1 text-xs text-blue-800 focus:outline-none focus:ring-1 focus:ring-blue-400" />
                            </div>
                            <div className="flex-1">
                              <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-widest text-blue-600">
                                Data Fim <span className="normal-case font-normal text-blue-400">do atestado</span>
                              </p>
                              <input type="date" value={atestadoDataFim} onChange={e => setAtestadoDataFim(e.target.value)}
                                className="w-full rounded border border-blue-200 bg-white px-2 py-1 text-xs text-blue-800 focus:outline-none focus:ring-1 focus:ring-blue-400" />
                            </div>
                          </div>

                          {/* CID obrigatório */}
                          <div>
                            <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-widest text-blue-600">
                              CID <span className="text-red-500">*</span>
                            </p>
                            <div className="relative">
                              <input
                                type="text"
                                value={cidBusca}
                                onChange={e => { setCidBusca(e.target.value); setCidCodigo(''); setCidAberto(true) }}
                                onFocus={() => setCidAberto(true)}
                                onBlur={() => setTimeout(() => setCidAberto(false), 150)}
                                placeholder="Buscar por código ou descrição..."
                                autoComplete="off"
                                className="w-full rounded border border-blue-200 bg-white px-2 py-1 pr-6 text-xs text-blue-800 focus:outline-none focus:ring-1 focus:ring-blue-400 placeholder:text-blue-300"
                              />
                              {cidCodigo && (
                                <button type="button"
                                  onClick={() => { setCidCodigo(''); setCidBusca('') }}
                                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-sm leading-none text-blue-400 hover:text-blue-600"
                                >×</button>
                              )}
                              {cidAberto && cidsFiltrados.length > 0 && (
                                <div className="absolute z-50 mt-0.5 max-h-40 w-full overflow-y-auto rounded border border-blue-200 bg-white shadow-lg">
                                  {cidsFiltrados.slice(0, 30).map(c => (
                                    <button key={c.codigo} type="button"
                                      onMouseDown={() => { setCidCodigo(c.codigo); setCidBusca(`${c.codigo} — ${c.descricao}`); setCidAberto(false) }}
                                      className="flex w-full items-baseline gap-2 px-2 py-1.5 text-left text-xs hover:bg-blue-50"
                                    >
                                      <span className="shrink-0 font-mono font-semibold text-blue-700">{c.codigo}</span>
                                      <span className="truncate text-gray-600">{c.descricao}</span>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                            {!cidCodigo && (
                              <p className="mt-0.5 text-[10px] text-red-500">Campo obrigatório para registrar atestado.</p>
                            )}
                          </div>

                          {/* Motivo opcional */}
                          <div>
                            <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-widest text-blue-600">
                              Motivo <span className="normal-case font-normal text-blue-400">(opcional)</span>
                            </p>
                            <textarea value={atestadoMotivo} onChange={e => setAtestadoMotivo(e.target.value)} rows={2}
                              placeholder="Observações do atestado..."
                              className="w-full rounded border border-blue-200 bg-white px-2 py-1 text-xs text-blue-800 focus:outline-none focus:ring-1 focus:ring-blue-300 placeholder:text-blue-300" />
                          </div>
                        </div>
                      )}
                    </div>
                  ) : isAtestadoMotivo && (
                    <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
                      💡 Selecione o funcionário ausente abaixo para registrar o atestado automaticamente.
                    </div>
                  )}
                </div>

                {/* Descrição / Observação */}
                <div>
                  <label className={fieldLabel}>Descrição / Observação <span className="normal-case font-normal text-gray-400">(opcional)</span></label>
                  <textarea value={motivo} onChange={e => setMotivo(e.target.value)} rows={2}
                    placeholder="Detalhes adicionais, CID, número de dias..."
                    className={inputCls} />
                </div>

                {/* Apenas um dia */}
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="apenas-um-dia" checked={apenasUmDia} onChange={e => setApenasUmDia(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600" />
                  <label htmlFor="apenas-um-dia" className="text-sm text-gray-600">Apenas um dia</label>
                </div>

                {/* Datas da cobertura */}
                <div className="space-y-2">
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className={fieldLabel}>Data Início</label>
                      <p className="mb-1 text-[10px] text-gray-400 -mt-0.5">Período da cobertura</p>
                      <input type="date" required value={dataInicio} onChange={e => setDataInicio(e.target.value)} className={inputCls} />
                    </div>
                    {!apenasUmDia && (
                      <div className="flex-1">
                        <label className={fieldLabel}>Data Fim</label>
                        <p className="mb-1 text-[10px] text-gray-400 -mt-0.5">Período da cobertura</p>
                        <input type="date" required value={dataFim} onChange={e => setDataFim(e.target.value)} className={inputCls} />
                      </div>
                    )}
                  </div>
                  {diasCobertura !== null && (
                    <span className="inline-flex rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700">
                      {diasCobertura} dia{diasCobertura !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                {/* Banner cross-month */}
                {ultrapassaMes && (
                  <div className="rounded-lg border border-amber-400 bg-amber-100 px-3 py-2 text-xs text-amber-800">
                    ⚠️ Esta cobertura ultrapassa o fim do mês. Lembre-se de registrar a continuação em{' '}
                    <span className="font-semibold">{nextMonthLabel(dataInicio)}</span>.
                  </div>
                )}
              </div>
            </div>

            {/* ── SEÇÃO: FUNCIONÁRIO AUSENTE ── */}
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-amber-700">
                Funcionário Ausente
              </p>
              <div className="flex gap-6">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="radio" name="tipo_cobertura" value="reforco"
                    checked={tipoCobertura === 'reforco'} onChange={() => setTipoCobertura('reforco')} className="h-4 w-4" />
                  Reforço de posto
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="radio" name="tipo_cobertura" value="substituicao"
                    checked={tipoCobertura === 'substituicao'} onChange={() => setTipoCobertura('substituicao')} className="h-4 w-4" />
                  Substituindo funcionário ausente
                </label>
              </div>

              {tipoCobertura === 'substituicao' && (
                <div className="space-y-3">
                  <div>
                    <label className={fieldLabel}>Funcionário Ausente</label>
                    <select value={funcionarioAusenteId} onChange={e => setFuncionarioAusenteId(e.target.value)}
                      required disabled={!postoId}
                      className={`${inputCls} disabled:bg-gray-100 disabled:text-gray-400`}>
                      <option value="">{postoId ? 'Selecione...' : 'Selecione o posto primeiro'}</option>
                      {funcionariosAusentes.map(f => (
                        <option key={f.id} value={f.id}>{f.nome}{f.funcao ? ` (${f.funcao})` : ''}</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={fieldLabel}>Início Ausência</label>
                      <input type="date" required value={dataInicioAusencia} onChange={e => setDataInicioAusencia(e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className={fieldLabel}>Fim Ausência</label>
                      <input type="date" value={dataFimAusencia} onChange={e => setDataFimAusencia(e.target.value)} className={inputCls} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Erro */}
            {erro && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {erro}
              </div>
            )}

            {/* ── AÇÕES ── */}
            <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
              <button type="button" onClick={handleClose}
                className="h-9 rounded-lg border border-gray-200 px-4 text-xs font-semibold uppercase tracking-widest text-gray-500 hover:bg-gray-50">
                Cancelar
              </button>
              <button
                type="submit"
                disabled={pending || !substituto || !postoId || !tipoMotivo || needsCid}
                title={needsCid ? 'Selecione o CID para registrar o atestado' : undefined}
                className="flex h-9 items-center gap-2 rounded-lg bg-slate-900 px-4 text-xs font-semibold uppercase tracking-widest text-white hover:bg-slate-700 disabled:opacity-50"
              >
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                {pending ? 'Salvando...' : 'Salvar cobertura'}
              </button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
