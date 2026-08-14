'use client'

import { useEffect, useState, useTransition } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import type { DossieFuncionario, SupervisorSimples, TimelineTipo } from '@/app/(admin)/ocorrencias/actions'
import { getDossieFuncionario, updateStatusOcorrencia } from '@/app/(admin)/ocorrencias/actions'
import { ModalNovaOcorrencia } from './modal-nova-ocorrencia'
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
  onClose,
}: {
  funcionarioId: string
  supervisores: SupervisorSimples[]
  canWrite: boolean
  onClose: () => void
}) {
  const [dossie, setDossie]         = useState<DossieFuncionario | null>(null)
  const [loading, setLoading]       = useState(true)
  const [filtroTipo, setFiltroTipo] = useState<TimelineTipo | ''>('')
  const [novaOpen, setNovaOpen]     = useState(false)
  const [isPending, startTransition] = useTransition()

  async function carregar() {
    setLoading(true)
    const data = await getDossieFuncionario(funcionarioId)
    setDossie(data)
    setLoading(false)
  }

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [funcionarioId])

  function handleStatusUpdate(idComPrefixo: string, novoStatus: 'em_analise' | 'encerrada') {
    const id = idComPrefixo.replace('ocorrencia-', '')
    const fd = new FormData()
    fd.set('id', id)
    fd.set('status', novoStatus)
    startTransition(async () => {
      const result = await updateStatusOcorrencia(fd)
      if (result.success) carregar()
      else alert(result.error)
    })
  }

  const timelineFiltrada = dossie
    ? (filtroTipo ? dossie.timeline.filter(t => t.tipo === filtroTipo) : dossie.timeline)
    : []

  return (
    <Dialog.Root open onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/50" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-full max-w-3xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
          {loading || !dossie ? (
            <p className="py-12 text-center text-sm text-gray-400">Carregando dossiê…</p>
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
                    onClick={() => downloadDossiePDF(dossie)}
                    className="h-8 rounded-lg bg-amber-500 px-3 text-xs font-semibold uppercase tracking-widest text-slate-900 hover:bg-amber-400"
                  >
                    Baixar PDF
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
                  timelineFiltrada.map(item => (
                    <div key={item.id} className="flex items-start justify-between gap-3 rounded-lg border border-gray-100 px-4 py-3">
                      <div className="flex items-start gap-3">
                        <span className={`mt-0.5 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${TIPO_COLOR[item.tipo]}`}>
                          {TIPO_LABEL[item.tipo]}
                        </span>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{item.titulo}</p>
                          <p className="text-xs text-gray-500">{item.detalhe}</p>
                        </div>
                      </div>
                      <div className="flex flex-shrink-0 flex-col items-end gap-1.5">
                        <span className="text-xs text-gray-400">
                          {item.data ? new Date(item.data + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}
                        </span>
                        {item.tipo === 'ocorrencia' && item.gravidade && (
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${GRAVIDADE_CHIP[item.gravidade] ?? ''}`}>
                            {item.gravidade}
                          </span>
                        )}
                        {item.tipo === 'ocorrencia' && item.status && (
                          <span className="text-xs font-medium text-gray-500">{STATUS_LABEL[item.status] ?? item.status}</span>
                        )}
                        {canWrite && item.tipo === 'ocorrencia' && item.status === 'aberta' && (
                          <button
                            disabled={isPending}
                            onClick={() => handleStatusUpdate(item.id, 'em_analise')}
                            className="rounded-lg bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700 hover:bg-amber-200 disabled:opacity-50"
                          >
                            Em Análise
                          </button>
                        )}
                        {canWrite && item.tipo === 'ocorrencia' && item.status === 'em_analise' && (
                          <button
                            disabled={isPending}
                            onClick={() => handleStatusUpdate(item.id, 'encerrada')}
                            className="rounded-lg bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700 hover:bg-green-200 disabled:opacity-50"
                          >
                            Encerrar
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

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
