'use client'

import { useEffect, useState, useTransition } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import {
  previaAnalise,
  analisarOcorrencia,
  rascunharDevolutivaRetorno,
  previaRetorno,
  decidirAnalise,
  listarAnalises,
  type AnaliseHistorico,
} from '@/app/(admin)/ocorrencias/ia-actions'
import type { AnaliseOcorrencia } from '@/lib/ocorrencias/ia/schema'

const CATEGORIA_LABEL: Record<string, string> = {
  saude: 'Saúde', conduta: 'Conduta', desempenho: 'Desempenho',
  seguranca: 'Segurança', relacionamento: 'Relacionamento', outro: 'Outro',
}
const URGENCIA_COR: Record<string, string> = {
  baixa: 'bg-gray-100 text-gray-600', media: 'bg-amber-100 text-amber-700', alta: 'bg-red-100 text-red-700',
}
const DECISAO_LABEL: Record<string, string> = { pendente: 'Pendente', aprovada: 'Aprovada', reprovada: 'Reprovada' }

const textareaClass =
  'w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400'

export function ModalAnaliseIA({
  ocorrenciaId,
  modo,
  onClose,
  onEncaminharRH,
  onAprovada,
}: {
  ocorrenciaId: string
  modo: 'analise' | 'retorno'
  onClose: () => void
  onEncaminharRH: (consideracoes: string) => void
  onAprovada: () => void
}) {
  const [carregando, setCarregando] = useState(modo === 'analise')
  const [mensagem, setMensagem]     = useState('')
  const [iaOk, setIaOk]             = useState(true)
  const [historico, setHistorico]   = useState<AnaliseHistorico[]>([])
  const [respostaRH, setRespostaRH] = useState('')
  const [analiseId, setAnaliseId]   = useState<string | null>(null)
  const [analise, setAnalise]       = useState<AnaliseOcorrencia | null>(null)
  const [devolutiva, setDevolutiva] = useState('')
  const [consideracoes, setConsideracoes] = useState('')
  const [pontos, setPontos]         = useState<string[]>([])
  const [reprovando, setReprovando] = useState(false)
  const [motivo, setMotivo]         = useState('')
  const [erro, setErro]             = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    let ativo = true
    ;(async () => {
      const h = await listarAnalises(ocorrenciaId)
      if (ativo) setHistorico(h)
      if (modo === 'analise') {
        const p = await previaAnalise(ocorrenciaId)
        if (!ativo) return
        if (p.success) { setMensagem(p.mensagem); setIaOk(p.iaConfigurada) }
        else setErro(p.error)
        setCarregando(false)
      }
    })()
    return () => { ativo = false }
  }, [ocorrenciaId, modo])

  function handleAnalisar() {
    setErro(null)
    startTransition(async () => {
      const r = await analisarOcorrencia(ocorrenciaId)
      if (!r.success) { setErro(r.error); return }
      setAnaliseId(r.analiseId)
      setAnalise(r.analise)
      setDevolutiva(r.analise.devolutiva_supervisor)
      setConsideracoes(r.analise.email_rh)
    })
  }

  // Retorno do RH: primeiro mostra o texto exato que iria à IA; só envia depois do "Enviar para a IA".
  function handlePreviaRetorno() {
    setErro(null)
    startTransition(async () => {
      const r = await previaRetorno(ocorrenciaId, respostaRH)
      if (!r.success) { setErro(r.error); return }
      setMensagem(r.mensagem)
      setIaOk(r.iaConfigurada)
    })
  }

  function handleRascunharRetorno() {
    setErro(null)
    startTransition(async () => {
      const r = await rascunharDevolutivaRetorno(ocorrenciaId, respostaRH)
      if (!r.success) { setErro(r.error); return }
      setAnaliseId(r.analiseId)
      setDevolutiva(r.devolutiva)
      setPontos(r.pontos)
    })
  }

  function handleAprovarDevolutiva() {
    if (!analiseId) return
    setErro(null)
    startTransition(async () => {
      const r = await decidirAnalise(analiseId, { decisao: 'aprovada', devolutivaEditada: devolutiva })
      if (!r.success) { setErro(r.error); return }
      onAprovada()
      onClose()
    })
  }

  function handleEncaminhar() {
    if (!analiseId) return
    setErro(null)
    startTransition(async () => {
      const r = await decidirAnalise(analiseId, { decisao: 'aprovada' })
      if (!r.success) { setErro(r.error); return }
      onEncaminharRH(consideracoes)
      onClose()
    })
  }

  function handleReprovar() {
    if (!analiseId) return
    setErro(null)
    startTransition(async () => {
      const r = await decidirAnalise(analiseId, { decisao: 'reprovada', motivo })
      if (!r.success) { setErro(r.error); return }
      onClose()
    })
  }

  const temResultado = modo === 'analise' ? !!analise : !!analiseId

  return (
    <Dialog.Root open onOpenChange={(aberto) => { if (!aberto) onClose() }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[60] bg-black/50" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-[61] max-h-[90vh] w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
          <Dialog.Title className="mb-1 text-sm font-bold uppercase tracking-widest text-gray-900">
            {modo === 'analise' ? 'Analisar com IA' : 'Devolutiva a partir do retorno do RH'}
          </Dialog.Title>
          <p className="mb-4 rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600">
            Sugestão da IA. A decisão é sua: nada é enviado ao supervisor nem ao RH sem a sua aprovação.
          </p>

          {erro && <p className="mb-3 text-xs text-red-500">{erro}</p>}

          {/* ── passo 1: prévia (análise) ou colar a resposta do RH (retorno) ── */}
          {!temResultado && modo === 'analise' && (
            carregando ? (
              <p className="py-8 text-center text-sm text-gray-400">Preparando a prévia…</p>
            ) : (
              <div className="space-y-3">
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  <strong>Confira o que vai para a IA.</strong> Nome, RE, posto, CPF, salário, PCD e CID não são enviados,
                  e nomes de funcionários e supervisores viram códigos (FUNC_1…). Atenção: nomes de terceiros escritos no
                  relato (&quot;a diretora Fulana&quot;, &quot;a filha&quot;) não são detectados. Se houver, edite a ocorrência antes.
                </p>
                <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700">
                  {mensagem}
                </pre>
                {!iaOk && <p className="text-xs text-red-500">A IA não está configurada neste ambiente.</p>}
                {historico.length > 0 && (
                  <p className="text-xs text-gray-400">
                    {historico.length} análise(s) anterior(es): {historico.map(h => `${DECISAO_LABEL[h.decisao]}`).join(', ')}.
                  </p>
                )}
                <div className="flex justify-end gap-3">
                  <button onClick={onClose} className="h-9 rounded-lg border border-gray-200 px-4 text-xs font-semibold uppercase tracking-widest text-gray-500 hover:bg-gray-50">
                    Cancelar
                  </button>
                  <button
                    disabled={isPending || !iaOk || !mensagem}
                    onClick={handleAnalisar}
                    className="h-9 rounded-lg bg-slate-900 px-4 text-xs font-semibold uppercase tracking-widest text-white hover:bg-slate-700 disabled:opacity-50"
                  >
                    {isPending ? 'Analisando…' : 'Enviar para análise'}
                  </button>
                </div>
              </div>
            )
          )}

          {!temResultado && modo === 'retorno' && (
            <div className="space-y-3">
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Cole a resposta que o RH enviou. Nomes de funcionários e supervisores viram códigos antes de ir à IA;
                nomes de terceiros escritos no texto não são detectados.
              </p>
              <textarea
                value={respostaRH}
                onChange={e => { setRespostaRH(e.target.value); setMensagem('') }}
                rows={6}
                placeholder="Resposta do RH…"
                className={textareaClass}
              />
              {mensagem && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
                    Texto exato que vai para a IA (confira antes de enviar)
                  </p>
                  <pre className="max-h-56 overflow-y-auto whitespace-pre-wrap rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700">
                    {mensagem}
                  </pre>
                  {!iaOk && <p className="text-xs text-red-500">A IA não está configurada neste ambiente.</p>}
                </div>
              )}
              <div className="flex justify-end gap-3">
                <button onClick={onClose} className="h-9 rounded-lg border border-gray-200 px-4 text-xs font-semibold uppercase tracking-widest text-gray-500 hover:bg-gray-50">
                  Cancelar
                </button>
                {!mensagem ? (
                  <button
                    disabled={isPending || !respostaRH.trim()}
                    onClick={handlePreviaRetorno}
                    className="h-9 rounded-lg bg-slate-900 px-4 text-xs font-semibold uppercase tracking-widest text-white hover:bg-slate-700 disabled:opacity-50"
                  >
                    {isPending ? 'Preparando…' : 'Ver prévia'}
                  </button>
                ) : (
                  <button
                    disabled={isPending || !iaOk}
                    onClick={handleRascunharRetorno}
                    className="h-9 rounded-lg bg-slate-900 px-4 text-xs font-semibold uppercase tracking-widest text-white hover:bg-slate-700 disabled:opacity-50"
                  >
                    {isPending ? 'Rascunhando…' : 'Enviar para a IA e rascunhar'}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── passo 2: resultado ── */}
          {temResultado && (
            <div className="space-y-4">
              {analise && (
                <>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-700">
                      {CATEGORIA_LABEL[analise.categoria] ?? analise.categoria}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${URGENCIA_COR[analise.urgencia] ?? ''}`}>
                      Urgência {analise.urgencia}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${analise.encaminhar_rh ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'}`}>
                      {analise.encaminhar_rh ? 'Sugere encaminhar ao RH' : 'Não precisa ir ao RH'}
                    </span>
                  </div>

                  {analise.alertas.length > 0 && (
                    <ul className="space-y-1 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                      {analise.alertas.map((a, i) => <li key={i}>⚠ {a}</li>)}
                    </ul>
                  )}

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Resumo</p>
                    <p className="mt-1 text-sm text-gray-700">{analise.resumo}</p>
                  </div>

                  {analise.resolucao_sugerida.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Resolução sugerida</p>
                      <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm text-gray-700">
                        {analise.resolucao_sugerida.map((p, i) => <li key={i}>{p}</li>)}
                      </ol>
                    </div>
                  )}

                  {analise.encaminhar_rh && analise.motivo_rh && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Por que encaminhar ao RH</p>
                      <p className="mt-1 text-sm text-gray-700">{analise.motivo_rh}</p>
                    </div>
                  )}
                </>
              )}

              {pontos.length > 0 && (
                <ul className="space-y-1 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  {pontos.map((p, i) => <li key={i}>• {p}</li>)}
                </ul>
              )}

              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-widest text-gray-400">
                  Devolutiva ao supervisor (edite antes de aprovar)
                </label>
                <textarea value={devolutiva} onChange={e => setDevolutiva(e.target.value)} rows={5} className={textareaClass} />
              </div>

              {analise?.encaminhar_rh && (
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-widest text-gray-400">
                    Considerações para o e-mail ao RH (entram no rascunho do e-mail)
                  </label>
                  <textarea value={consideracoes} onChange={e => setConsideracoes(e.target.value)} rows={4} className={textareaClass} />
                </div>
              )}

              {reprovando ? (
                <div className="space-y-2">
                  <input
                    value={motivo}
                    onChange={e => setMotivo(e.target.value)}
                    placeholder="Motivo da reprovação (opcional)"
                    className="h-9 w-full rounded-lg border border-gray-200 px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400"
                  />
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setReprovando(false)} className="h-9 rounded-lg border border-gray-200 px-4 text-xs font-semibold uppercase tracking-widest text-gray-500 hover:bg-gray-50">
                      Voltar
                    </button>
                    <button disabled={isPending} onClick={handleReprovar} className="h-9 rounded-lg bg-red-600 px-4 text-xs font-semibold uppercase tracking-widest text-white hover:bg-red-700 disabled:opacity-50">
                      {isPending ? 'Salvando…' : 'Confirmar reprovação'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap justify-end gap-2">
                  <button disabled={isPending} onClick={() => setReprovando(true)} className="h-9 rounded-lg border border-red-200 px-4 text-xs font-semibold uppercase tracking-widest text-red-600 hover:bg-red-50 disabled:opacity-50">
                    Reprovar
                  </button>
                  {analise?.encaminhar_rh && (
                    <button disabled={isPending} onClick={handleEncaminhar} className="h-9 rounded-lg bg-indigo-600 px-4 text-xs font-semibold uppercase tracking-widest text-white hover:bg-indigo-700 disabled:opacity-50">
                      Encaminhar ao RH
                    </button>
                  )}
                  <button
                    disabled={isPending || !devolutiva.trim()}
                    onClick={handleAprovarDevolutiva}
                    className="h-9 rounded-lg bg-slate-900 px-4 text-xs font-semibold uppercase tracking-widest text-white hover:bg-slate-700 disabled:opacity-50"
                  >
                    {isPending ? 'Enviando…' : 'Aprovar devolutiva'}
                  </button>
                </div>
              )}
            </div>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
