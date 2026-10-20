'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import {
  carregarSugestaoAdmissao, descartarRascunho, enviarAdmissaoAssistida, obterRascunho, salvarRascunho,
  type SugestaoAdmissao,
} from '@/app/(admin)/postos/admissao-actions'
import { listarTurnosDoPosto, listarTurnosJovemAprendiz } from '@/app/(admin)/efetivo/horario/actions'
import { dossieVazio, type DossieAdmissao, type PacoteAdmissao } from '@/lib/admissao/tipos'
import { ETAPAS_ADMISSAO, errosDaEtapa, errosDoDossie } from '@/lib/admissao/validar'
import { cn } from '@/lib/utils'
import { baixarPacoteAdmissaoPDF, type DocumentoAdmissao } from './pdf/pacote-admissao-pdf'
import {
  EtapaCondicoes, EtapaDocumentos, EtapaPessoais, EtapaRevisao, EtapaVaga, EtapaVt,
  type Definir, type FuncaoOpt, type PostoOpt, type TurnoOpcao,
} from './etapas'

interface Props {
  open: boolean
  onClose: () => void
  onSuccess?: () => void
  postos: PostoOpt[]
  funcoes: FuncaoOpt[]
}

const hojeLocal = () => new Date().toLocaleDateString('sv-SE')
const moedaTexto = (v: number | null | undefined) => (v === null || v === undefined ? '' : v.toFixed(2).replace('.', ','))

function temConteudo(d: Partial<DossieAdmissao> | null): boolean {
  return !!d && !!(d.nome || d.cpf || d.posto_id || d.funcao_id)
}

export function AssistenteAdmissao({ open, onClose, onSuccess, postos, funcoes }: Props) {
  const [d, setD] = useState<DossieAdmissao>(() => dossieVazio(hojeLocal()))
  const [etapa, setEtapa] = useState(1)
  const [erros, setErros] = useState<string[]>([])
  const [enviando, iniciarEnvio] = useTransition()
  const [pacote, setPacote] = useState<PacoteAdmissao | null>(null)
  const [erroPdf, setErroPdf] = useState<string | null>(null)
  const [gerandoPdf, setGerandoPdf] = useState(false)

  const [rascunhoPendente, setRascunhoPendente] = useState<{ dados: Partial<DossieAdmissao>; atualizadoEm: string | null } | null>(null)
  const [rascunhoResolvido, setRascunhoResolvido] = useState(false)
  const [salvoEm, setSalvoEm] = useState<string | null>(null)
  const modificado = useRef(false)

  const [sugestao, setSugestao] = useState<SugestaoAdmissao | null>(null)
  const postoAplicado = useRef('')
  const funcaoAplicada = useRef('')

  const [turnoOpcoes, setTurnoOpcoes] = useState<TurnoOpcao[]>([])
  const [carregandoTurnos, setCarregandoTurnos] = useState(false)

  const definir: Definir = useCallback((campo, valor) => {
    modificado.current = true
    setD(atual => ({ ...atual, [campo]: valor }))
  }, [])

  const funcaoSel = funcoes.find(f => f.id === d.funcao_id) ?? null
  const jovemAprendiz = funcaoSel?.nome?.toUpperCase().includes('APRENDIZ') ?? false

  const postosFiltrados = useMemo(() => {
    if (!funcaoSel) return postos
    switch (funcaoSel.postoFiltro) {
      case 'apenas_sms': return postos.filter(p => p.secretaria === 'SMS')
      case 'todos':      return postos
      case 'sem_sms':    return postos.filter(p => p.secretaria !== 'SMS')
    }
  }, [postos, funcaoSel])

  // ── Rascunho: ao abrir, vê se há um salvo e pergunta antes de usar ──
  useEffect(() => {
    if (!open) return
    let cancelado = false
    obterRascunho()
      .then(r => {
        if (cancelado) return
        if (r.success && temConteudo(r.dados)) setRascunhoPendente({ dados: r.dados as Partial<DossieAdmissao>, atualizadoEm: r.atualizadoEm })
        else setRascunhoResolvido(true)
      })
      .catch(() => { if (!cancelado) setRascunhoResolvido(true) })
    return () => { cancelado = true }
  }, [open])

  function retomarRascunho() {
    if (!rascunhoPendente) return
    const dados = { ...dossieVazio(hojeLocal()), ...rascunhoPendente.dados }
    // Já vieram com o que o supervisor ajustou: as sugestões não devem sobrescrever.
    postoAplicado.current = dados.posto_id
    funcaoAplicada.current = dados.funcao_id
    setD(dados)
    setRascunhoPendente(null)
    setRascunhoResolvido(true)
  }

  async function descartarRascunhoSalvo() {
    setRascunhoPendente(null)
    setRascunhoResolvido(true)
    await descartarRascunho()
  }

  // Salva sozinho, sem validar (rascunho pode estar incompleto).
  useEffect(() => {
    if (!open || !rascunhoResolvido || pacote || !modificado.current) return
    const t = setTimeout(async () => {
      const r = await salvarRascunho(d)
      if (r.success) setSalvoEm(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }))
    }, 1500)
    return () => clearTimeout(t)
  }, [d, open, rascunhoResolvido, pacote])

  // ── Sugestões do sistema (salário, CBO, VA/VR, centro de custo…) ──
  useEffect(() => {
    if (!d.posto_id && !d.funcao_id) { setSugestao(null); return }
    let cancelado = false
    carregarSugestaoAdmissao(d.posto_id, d.funcao_id).catch(() => null).then(r => {
      if (cancelado || !r || !r.success) return
      setSugestao(r.sugestao)
      setD(atual => {
        const novo = { ...atual }
        if (atual.posto_id && atual.posto_id !== postoAplicado.current) {
          postoAplicado.current = atual.posto_id
          novo.contrato = r.sugestao.contrato
          novo.centro_custo = r.sugestao.centro_custo
        }
        if (atual.funcao_id && atual.funcao_id !== funcaoAplicada.current && r.sugestao.funcao) {
          funcaoAplicada.current = atual.funcao_id
          novo.cbo = r.sugestao.funcao.cbo
          novo.sindicato = r.sugestao.funcao.sindicato
          novo.va = moedaTexto(r.sugestao.funcao.va)
          novo.vr = moedaTexto(r.sugestao.funcao.vr)
        }
        return novo
      })
    })
    return () => { cancelado = true }
  }, [d.posto_id, d.funcao_id])

  // ── Regras da função ──
  useEffect(() => {
    if (jovemAprendiz && d.periodo_experiencia !== 'nenhum') definir('periodo_experiencia', 'nenhum')
  }, [jovemAprendiz, d.periodo_experiencia, definir])

  useEffect(() => {
    if (!d.posto_id || postosFiltrados.some(p => p.id === d.posto_id)) return
    definir('posto_id', '')
  }, [postosFiltrados, d.posto_id, definir])

  // ── Turnos do posto (ou os globais de jovem aprendiz) ──
  useEffect(() => {
    if (!open) return
    if (!jovemAprendiz && !d.posto_id) { setTurnoOpcoes([]); return }
    let cancelado = false
    setCarregandoTurnos(true)
    const busca = jovemAprendiz ? listarTurnosJovemAprendiz() : listarTurnosDoPosto(d.posto_id)
    busca
      .then(lista => { if (!cancelado) setTurnoOpcoes(lista as unknown as TurnoOpcao[]) })
      // Se a busca falhar, segue sem turno (o horário fica para atribuição manual) em vez de travar a tela.
      .catch(() => { if (!cancelado) setTurnoOpcoes([]) })
      .finally(() => { if (!cancelado) setCarregandoTurnos(false) })
    return () => { cancelado = true }
  }, [open, d.posto_id, jovemAprendiz])

  // Turno escolhido que não existe mais na lista (troca de posto/função) é descartado.
  useEffect(() => {
    if (carregandoTurnos || !d.turno_id) return
    if (!turnoOpcoes.some(t => t.id === d.turno_id)) {
      definir('turno_id', '')
      definir('dia_curso', null)
    }
  }, [turnoOpcoes, carregandoTurnos, d.turno_id, definir])

  const opcoesValidacao = { turnoObrigatorio: turnoOpcoes.length > 0, jovemAprendiz }
  const postoNome = postos.find(p => p.id === d.posto_id)?.nome ?? ''
  const turnoNome = turnoOpcoes.find(t => t.id === d.turno_id)?.nome ?? null

  function reiniciar() {
    setD(dossieVazio(hojeLocal()))
    setEtapa(1)
    setErros([])
    setPacote(null)
    setErroPdf(null)
    setRascunhoPendente(null)
    setRascunhoResolvido(false)
    setSalvoEm(null)
    setSugestao(null)
    setTurnoOpcoes([])
    modificado.current = false
    postoAplicado.current = ''
    funcaoAplicada.current = ''
  }

  async function fechar() {
    if (enviando) return
    // Guarda o que já foi digitado para a próxima vez (o envio já apagou o rascunho).
    if (!pacote && modificado.current && rascunhoResolvido) await salvarRascunho(d)
    reiniciar()
    onClose()
  }

  function avancar() {
    const e = errosDaEtapa(etapa, d, opcoesValidacao)
    setErros(e)
    if (e.length === 0) setEtapa(etapa + 1)
  }

  function enviar() {
    const todos = errosDoDossie(d, opcoesValidacao)
    if (todos.length > 0) {
      // Leva o supervisor para a primeira etapa com problema.
      const primeira = [1, 2, 3, 4, 5, 6].find(n => errosDaEtapa(n, d, opcoesValidacao).length > 0) ?? 1
      setEtapa(primeira)
      setErros(errosDaEtapa(primeira, d, opcoesValidacao))
      return
    }
    setErros([])
    iniciarEnvio(async () => {
      const r = await enviarAdmissaoAssistida(d)
      if (!r.success) { setErros([r.error]); return }
      setPacote(r.pacote)
      onSuccess?.()
      await baixar(r.pacote)
    })
  }

  async function baixar(p: PacoteAdmissao, documentos?: DocumentoAdmissao[]) {
    setErroPdf(null)
    setGerandoPdf(true)
    try {
      await baixarPacoteAdmissaoPDF(p, documentos)
    } catch {
      setErroPdf('Não foi possível gerar o PDF. Tente novamente.')
    } finally {
      setGerandoPdf(false)
    }
  }

  const botaoPrimario = 'rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50'
  const botaoSecundario = 'rounded px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50'

  return (
    <Dialog.Root open={open} onOpenChange={aberto => { if (!aberto) void fechar() }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/50" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 flex max-h-[94vh] w-[calc(100vw-1rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 flex-col rounded-lg bg-white shadow-xl">
          <div className="border-b border-gray-100 px-5 pb-3 pt-5">
            <Dialog.Title className="text-lg font-semibold">Solicitar Admissão</Dialog.Title>
            {!pacote && (
              <>
                <p className="mt-0.5 text-sm text-gray-400">
                  Preenche o Cadastro, o Vale Transporte e a Lista da Integração e envia a solicitação para aprovação.
                </p>
                <ol className="mt-3 flex items-center gap-1.5" aria-label="Etapas">
                  {ETAPAS_ADMISSAO.map((nome, i) => {
                    const n = i + 1
                    return (
                      <li key={nome} className="flex items-center gap-1.5">
                        <button type="button" disabled={n > etapa} onClick={() => { setErros([]); setEtapa(n) }}
                          title={nome} aria-current={n === etapa ? 'step' : undefined}
                          className={cn(
                            'flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold',
                            n === etapa ? 'bg-slate-900 text-white' : n < etapa ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-400',
                          )}>
                          {n < etapa ? '✓' : n}
                        </button>
                        {n < ETAPAS_ADMISSAO.length && <span className="h-px w-3 bg-gray-200 sm:w-6" />}
                      </li>
                    )
                  })}
                </ol>
                <p className="mt-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
                  Etapa {etapa} de {ETAPAS_ADMISSAO.length} · {ETAPAS_ADMISSAO[etapa - 1]}
                </p>
              </>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4">
            {pacote ? (
              <div className="py-4 text-center">
                <p className="text-3xl text-green-600">✓</p>
                <p className="mt-2 text-sm font-medium text-gray-700">Solicitação enviada para aprovação.</p>
                <p className="mt-1 text-sm text-gray-500">O PDF com os 3 documentos foi baixado. Imprima, colha as assinaturas e entregue ao RH.</p>
                {erroPdf && <p className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{erroPdf}</p>}
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  <button type="button" disabled={gerandoPdf} onClick={() => baixar(pacote)} className="rounded bg-amber-500 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-amber-400 disabled:opacity-50">
                    {gerandoPdf ? 'Gerando…' : 'Baixar os 3 documentos'}
                  </button>
                  {([['cadastro', 'Só o Cadastro'], ['vt', 'Só o VT'], ['integracao', 'Só a Integração']] as [DocumentoAdmissao, string][]).map(([doc, texto]) => (
                    <button key={doc} type="button" disabled={gerandoPdf} onClick={() => baixar(pacote, [doc])} className={botaoSecundario + ' border border-gray-200'}>{texto}</button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {rascunhoPendente && (
                  <div className="mb-4 rounded border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                    <p className="font-medium">
                      Você tem um rascunho salvo{rascunhoPendente.dados.nome ? ` (${rascunhoPendente.dados.nome})` : ''}
                      {rascunhoPendente.atualizadoEm ? ` em ${new Date(rascunhoPendente.atualizadoEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}` : ''}.
                    </p>
                    <div className="mt-2 flex gap-2">
                      <button type="button" onClick={retomarRascunho} className={botaoPrimario}>Continuar de onde parei</button>
                      <button type="button" onClick={descartarRascunhoSalvo} className={botaoSecundario}>Começar do zero</button>
                    </div>
                  </div>
                )}

                {etapa === 1 && <EtapaPessoais d={d} definir={definir} />}
                {etapa === 2 && (
                  <EtapaVaga d={d} definir={definir} postos={postos} funcoes={funcoes} postosFiltrados={postosFiltrados}
                    jovemAprendiz={jovemAprendiz} turnoOpcoes={turnoOpcoes} carregandoTurnos={carregandoTurnos} />
                )}
                {etapa === 3 && <EtapaCondicoes d={d} definir={definir} sugestao={sugestao} />}
                {etapa === 4 && <EtapaVt d={d} definir={definir} />}
                {etapa === 5 && <EtapaDocumentos d={d} definir={definir} />}
                {etapa === 6 && (
                  <EtapaRevisao d={d} definir={definir} postoNome={postoNome} funcaoNome={funcaoSel?.nome ?? ''} turnoNome={turnoNome} />
                )}

                {erros.length > 0 && (
                  <ul className="mt-4 space-y-0.5 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600" role="alert">
                    {erros.map(e => <li key={e}>• {e}</li>)}
                  </ul>
                )}
              </>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-gray-100 px-5 py-3">
            {pacote ? (
              <>
                <span />
                <button type="button" onClick={fechar} className={botaoPrimario}>Fechar</button>
              </>
            ) : (
              <>
                <span className="text-xs text-gray-400">{salvoEm ? `Rascunho salvo às ${salvoEm}` : ''}</span>
                <div className="flex gap-2">
                  {etapa > 1
                    ? <button type="button" onClick={() => { setErros([]); setEtapa(etapa - 1) }} disabled={enviando} className={botaoSecundario}>Voltar</button>
                    : <button type="button" onClick={fechar} disabled={enviando} className={botaoSecundario}>Cancelar</button>}
                  {etapa < ETAPAS_ADMISSAO.length
                    ? <button type="button" onClick={avancar} className={botaoPrimario}>Avançar</button>
                    : <button type="button" onClick={enviar} disabled={enviando} className="rounded bg-amber-500 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-amber-400 disabled:opacity-50">
                        {enviando ? 'Enviando…' : 'Enviar e imprimir'}
                      </button>}
                </div>
              </>
            )}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
