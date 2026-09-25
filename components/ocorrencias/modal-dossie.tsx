'use client'

import { useEffect, useState, useTransition } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import type { DossieFuncionario, SupervisorSimples, TimelineTipo } from '@/app/(admin)/ocorrencias/actions'
import { getDossieFuncionario, updateStatusOcorrencia, registrarRetornoRH } from '@/app/(admin)/ocorrencias/actions'
import { ModalEncaminharRH } from './modal-encaminhar-rh'
import { ModalAnaliseIA } from './modal-analise-ia'
import { diasComRH } from '@/lib/ocorrencias/encaminhar-rh'
import { ModalNovaOcorrencia } from './modal-nova-ocorrencia'
import { ConversaOcorrencia } from './conversa-ocorrencia'
import { downloadDossiePDF } from './dossie-pdf'

function maskCPF(cpf: string | null): string {
  if (!cpf) return '—'
  return '***.***.***-**'
}

const TIPO_LABEL: Record<TimelineTipo, string> = {
  advertencia: 'Advertência',
  atestado:    'Atestado',
  falta:       'Falta',
  ocorrencia:  'Ocorrência',
}

const TIPO_COLOR: Record<TimelineTipo, string> = {
  advertencia: 'bg-orange-100 text-orange-700',
  atestado:    'bg-blue-100 text-blue-700',
  falta:       'bg-red-100 text-red-700',
  ocorrencia:  'bg-purple-100 text-purple-700',
}

const GRAVIDADE_CHIP: Record<string, string> = {
  baixa:   'bg-gray-100 text-gray-600',
  media:   'bg-amber-100 text-amber-700',
  alta:    'bg-orange-100 text-orange-700',
  critica: 'bg-red-100 text-red-700 font-bold',
}

const STATUS_LABEL: Record<string, string> = {
  aberta: 'Aberta', em_analise: 'Em Análise', encerrada: 'Encerrada', resolvido: 'Resolvido',
}

function CounterCard({ label, value, topColor }: { label: string; value: number | string; topColor: string }) {
  return (
    <div className={`rounded-xl border border-gray-100 border-t-4 bg-white p-3 shadow-sm ${topColor}`}>
      <p className="text-2xl font-black tracking-tight text-gray-900">{value}</p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-gray-400">{label}</p>
    </div>
  )
}

export function ModalDossie({
  funcionarioId,
  supervisores,
  canWrite,
  ehGestao,
  onClose,
}: {
  funcionarioId: string
  supervisores: SupervisorSimples[]
  canWrite: boolean
  ehGestao: boolean
  onClose: () => void
}) {
  const [dossie, setDossie]         = useState<DossieFuncionario | null>(null)
  const [loading, setLoading]       = useState(true)
  const [filtroTipo, setFiltroTipo] = useState<TimelineTipo | ''>('')
  const [novaOpen, setNovaOpen]     = useState(false)
  const [loadingPdf, setLoadingPdf] = useState(false)
  const [conversasAbertas, setConversasAbertas] = useState<Set<string>>(new Set())
  const [encerrandoId, setEncerrandoId]         = useState<string | null>(null)
  const [parecer, setParecer]                   = useState('')
  const [encaminharId, setEncaminharId] = useState<string | null>(null)
  const [retornoId, setRetornoId]       = useState<string | null>(null)
  const [analiseIA, setAnaliseIA]       = useState<{ id: string; modo: 'analise' | 'retorno' } | null>(null)
  const [consideracoesIA, setConsideracoesIA] = useState('')
  const [retornoTexto, setRetornoTexto] = useState('')
  const [isPending, startTransition] = useTransition()

  // silencioso = atualiza os dados sem trocar a tela por "Carregando" (usado ao enviar mensagem)
  async function carregar(silencioso = false) {
    if (!silencioso) setLoading(true)
    const data = await getDossieFuncionario(funcionarioId)
    setDossie(data)
    setLoading(false)
  }

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [funcionarioId])

  function handleRetornoRH(idComPrefixo: string) {
    const id = idComPrefixo.replace('ocorrencia-', '')
    startTransition(async () => {
      const result = await registrarRetornoRH(id, retornoTexto)
      if (result.success) {
        setRetornoId(null)
        setRetornoTexto('')
        carregar()
      } else {
        alert(result.error)
      }
    })
  }

  function toggleConversa(id: string) {
    setConversasAbertas(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleStatusUpdate(idComPrefixo: string, novoStatus: 'em_analise' | 'encerrada', parecerTexto?: string) {
    const id = idComPrefixo.replace('ocorrencia-', '')
    const fd = new FormData()
    fd.set('id', id)
    fd.set('status', novoStatus)
    if (parecerTexto) fd.set('parecer', parecerTexto)
    startTransition(async () => {
      const result = await updateStatusOcorrencia(fd)
      if (result.success) {
        setEncerrandoId(null)
        setParecer('')
        carregar()
      } else {
        alert(result.error)
      }
    })
  }

  async function handleBaixarPdf() {
    if (!dossie) return
    setLoadingPdf(true)
    try {
      await downloadDossiePDF(dossie)
    } finally {
      setLoadingPdf(false)
    }
  }

  const timelineFiltrada = dossie
    ? (filtroTipo ? dossie.timeline.filter(t => t.tipo === filtroTipo) : dossie.timeline)
    : []

  return (
    <Dialog.Root open onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/50" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-full max-w-3xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
          {loading ? (
            <p className="py-12 text-center text-sm text-gray-400">Carregando dossiê…</p>
          ) : !dossie ? (
            <div className="py-12 text-center">
              <p className="text-sm text-gray-500">Dossiê indisponível para este funcionário.</p>
              <button
                onClick={onClose}
                className="mt-4 h-8 rounded-lg border border-gray-200 px-4 text-xs font-semibold uppercase tracking-widest text-gray-500 hover:bg-gray-50"
              >
                Fechar
              </button>
            </div>
          ) : (
            <>
              <div className="mb-5 flex items-start justify-between">
                <div>
                  <Dialog.Title className="text-lg font-bold text-gray-900">{dossie.funcionario.nome}</Dialog.Title>
                  <p className="text-sm text-gray-400">
                    {dossie.funcionario.posto_nome} — {dossie.funcionario.secretaria || '—'}
                    {dossie.funcionario.registro && ` · RE ${dossie.funcionario.registro}`}
                    {' · CPF '}{maskCPF(dossie.funcionario.cpf)}
                  </p>
                </div>
                <button onClick={onClose} className="text-lg leading-none text-gray-400 hover:text-gray-600">✕</button>
              </div>

              <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <CounterCard label="Advertências"    value={dossie.kpis.advertencias}       topColor="border-t-orange-500" />
                <CounterCard label="Dias Atestado (12m)" value={dossie.kpis.diasAtestado12m} topColor="border-t-blue-500"   />
                <CounterCard label="Faltas"           value={dossie.kpis.faltas}             topColor="border-t-red-500"    />
                <CounterCard label="Ocorrências Abertas" value={dossie.kpis.ocorrenciasAbertas} topColor="border-t-purple-500" />
              </div>

              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setFiltroTipo('')}
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${filtroTipo === '' ? 'bg-slate-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                  >
                    Todos
                  </button>
                  {(Object.keys(TIPO_LABEL) as TimelineTipo[]).map(tipo => (
                    <button
                      key={tipo}
                      onClick={() => setFiltroTipo(tipo)}
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${filtroTipo === tipo ? 'bg-slate-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                    >
                      {TIPO_LABEL[tipo]}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button
                    disabled={loadingPdf}
                    onClick={handleBaixarPdf}
                    className="h-8 rounded-lg bg-amber-500 px-3 text-xs font-semibold uppercase tracking-widest text-slate-900 hover:bg-amber-400 disabled:opacity-50"
                  >
                    {loadingPdf ? 'Gerando…' : 'Baixar PDF'}
                  </button>
                  {canWrite && (
                    <button
                      onClick={() => setNovaOpen(true)}
                      className="h-8 rounded-lg bg-slate-900 px-3 text-xs font-semibold uppercase tracking-widest text-white hover:bg-slate-700"
                    >
                      Nova Ocorrência
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                {timelineFiltrada.length === 0 ? (
                  <p className="py-8 text-center text-sm text-gray-400">Nenhum registro encontrado.</p>
                ) : (
                  timelineFiltrada.map(item => {
                    const ehOcorrencia   = item.tipo === 'ocorrencia'
                    const conversaAberta = conversasAbertas.has(item.id)
                    return (
                      <div key={item.id} className="rounded-lg border border-gray-100">
                        <div className="flex items-start justify-between gap-3 px-4 py-3">
                          <div className="flex items-start gap-3">
                            <span className={`mt-0.5 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${TIPO_COLOR[item.tipo]}`}>
                              {TIPO_LABEL[item.tipo]}
                            </span>
                            <div>
                              <p className="text-sm font-medium text-gray-900">{item.titulo}</p>
                              <p className="text-xs text-gray-500">{item.detalhe}</p>
                              {ehOcorrencia && item.supervisor_nome && (
                                <p className="mt-0.5 text-xs font-semibold uppercase tracking-widest text-gray-400">
                                  Registrado por {item.supervisor_nome}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-shrink-0 flex-col items-end gap-1.5">
                            <span className="text-xs text-gray-400">
                              {item.data ? new Date(item.data + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}
                            </span>
                            {ehOcorrencia && item.gravidade && (
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${GRAVIDADE_CHIP[item.gravidade] ?? ''}`}>
                                {item.gravidade}
                              </span>
                            )}
                            {ehOcorrencia && item.status && (
                              <span className="text-xs font-medium text-gray-500">{STATUS_LABEL[item.status] ?? item.status}</span>
                            )}
                            {canWrite && ehOcorrencia && item.status === 'aberta' && (
                              <button
                                disabled={isPending}
                                onClick={() => handleStatusUpdate(item.id, 'em_analise')}
                                className="rounded-lg bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700 hover:bg-amber-200 disabled:opacity-50"
                              >
                                Em Análise
                              </button>
                            )}
                            {canWrite && ehOcorrencia && item.status === 'em_analise' && (
                              <button
                                disabled={isPending}
                                onClick={() => { setEncerrandoId(item.id); setParecer('') }}
                                className="rounded-lg bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700 hover:bg-green-200 disabled:opacity-50"
                              >
                                Encerrar
                              </button>
                            )}
                            {ehGestao && ehOcorrencia && (item.status === 'aberta' || item.status === 'em_analise') && (
                              item.com_rh_desde ? (
                                <>
                                  <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                                    Com o RH há {diasComRH(item.com_rh_desde)} {diasComRH(item.com_rh_desde) === 1 ? 'dia' : 'dias'}
                                  </span>
                                  <button
                                    disabled={isPending}
                                    onClick={() => { setRetornoId(item.id); setRetornoTexto('') }}
                                    className="rounded-lg bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
                                  >
                                    Registrar retorno do RH
                                  </button>
                                </>
                              ) : (
                                <button
                                  disabled={isPending}
                                  onClick={() => setEncaminharId(item.id)}
                                  className="rounded-lg bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
                                >
                                  Encaminhar ao RH
                                </button>
                              )
                            )}
                            {ehGestao && ehOcorrencia && (item.status === 'aberta' || item.status === 'em_analise') && (
                              <>
                                <button
                                  disabled={isPending}
                                  onClick={() => setAnaliseIA({ id: item.id, modo: 'analise' })}
                                  className="rounded-lg bg-purple-50 px-2 py-0.5 text-xs font-semibold text-purple-700 hover:bg-purple-100 disabled:opacity-50"
                                >
                                  Analisar com IA
                                </button>
                                {item.com_rh_desde && (
                                  <button
                                    disabled={isPending}
                                    onClick={() => setAnaliseIA({ id: item.id, modo: 'retorno' })}
                                    className="rounded-lg bg-purple-50 px-2 py-0.5 text-xs font-semibold text-purple-700 hover:bg-purple-100 disabled:opacity-50"
                                  >
                                    Rascunhar devolutiva do retorno
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </div>

                        {canWrite && ehOcorrencia && (
                          <div className="border-t border-gray-50 px-4 py-2">
                            <button
                              type="button"
                              onClick={() => toggleConversa(item.id)}
                              className="text-xs font-semibold text-purple-700 hover:text-purple-900"
                            >
                              {conversaAberta ? 'Ocultar conversa' : `Conversa (${item.comentarios ?? 0})`}
                            </button>
                          </div>
                        )}

                        {ehGestao && retornoId === item.id && (
                          <div className="space-y-2 border-t border-gray-50 bg-indigo-50/50 px-4 py-3">
                            <label className="text-xs font-semibold uppercase tracking-widest text-gray-500">
                              Retorno do RH (nota interna, o supervisor não vê)
                            </label>
                            <textarea
                              value={retornoTexto}
                              onChange={e => setRetornoTexto(e.target.value)}
                              rows={4}
                              placeholder="Cole ou resuma a resposta que o RH enviou…"
                              className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400"
                            />
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => { setRetornoId(null); setRetornoTexto('') }}
                                className="h-8 rounded-lg border border-gray-200 px-3 text-xs font-semibold uppercase tracking-widest text-gray-500 hover:bg-gray-50"
                              >
                                Cancelar
                              </button>
                              <button
                                type="button"
                                disabled={isPending || !retornoTexto.trim()}
                                onClick={() => handleRetornoRH(item.id)}
                                className="h-8 rounded-lg bg-indigo-600 px-3 text-xs font-semibold uppercase tracking-widest text-white hover:bg-indigo-700 disabled:opacity-50"
                              >
                                {isPending ? 'Salvando…' : 'Registrar retorno'}
                              </button>
                            </div>
                          </div>
                        )}

                        {encerrandoId === item.id && (
                          <div className="space-y-2 border-t border-gray-50 bg-green-50/50 px-4 py-3">
                            <label className="text-xs font-semibold uppercase tracking-widest text-gray-500">
                              Parecer (obrigatório)
                            </label>
                            <textarea
                              value={parecer}
                              onChange={e => setParecer(e.target.value)}
                              rows={3}
                              placeholder="Descreva a conclusão e o encaminhamento dado…"
                              className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400"
                            />
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => { setEncerrandoId(null); setParecer('') }}
                                className="h-8 rounded-lg border border-gray-200 px-3 text-xs font-semibold uppercase tracking-widest text-gray-500 hover:bg-gray-50"
                              >
                                Cancelar
                              </button>
                              <button
                                type="button"
                                disabled={isPending || !parecer.trim()}
                                onClick={() => handleStatusUpdate(item.id, 'encerrada', parecer)}
                                className="h-8 rounded-lg bg-green-600 px-3 text-xs font-semibold uppercase tracking-widest text-white hover:bg-green-700 disabled:opacity-50"
                              >
                                {isPending ? 'Salvando…' : 'Confirmar encerramento'}
                              </button>
                            </div>
                          </div>
                        )}

                        {canWrite && ehOcorrencia && conversaAberta && (
                          <div className="border-t border-gray-50 px-4 py-3">
                            <ConversaOcorrencia
                              ocorrenciaId={item.id.replace('ocorrencia-', '')}
                              onEnviado={() => carregar(true)}
                            />
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>

              {ehGestao && encaminharId && (
                <ModalEncaminharRH
                  ocorrenciaId={encaminharId.replace('ocorrencia-', '')}
                  consideracoes={consideracoesIA}
                  onClose={() => { setEncaminharId(null); setConsideracoesIA('') }}
                  onEnviado={() => carregar()}
                />
              )}

              {ehGestao && analiseIA && (
                <ModalAnaliseIA
                  ocorrenciaId={analiseIA.id.replace('ocorrencia-', '')}
                  modo={analiseIA.modo}
                  onClose={() => setAnaliseIA(null)}
                  onAprovada={() => carregar(true)}
                  onEncaminharRH={(consideracoes) => {
                    setConsideracoesIA(consideracoes)
                    setEncaminharId(analiseIA.id)
                  }}
                />
              )}

              {canWrite && (
                <ModalNovaOcorrencia
                  open={novaOpen}
                  onClose={() => setNovaOpen(false)}
                  funcionarioId={dossie.funcionario.id}
                  funcionarioNome={dossie.funcionario.nome}
                  supervisores={supervisores}
                  onCreated={carregar}
                />
              )}
            </>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
