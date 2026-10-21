'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Download, FileText, Receipt, Send, Users } from 'lucide-react'
import {
  carregarSugestaoAdmissao, descartarRascunho, enviarAdmissaoAssistida, listarLinhasTransporte, obterRascunho,
  salvarRascunho, type LinhaConhecida, type SugestaoAdmissao,
} from '@/app/(admin)/admissao/actions'
import { listarTurnosDoPosto, listarTurnosJovemAprendiz } from '@/app/(admin)/efetivo/horario/actions'
import { dossieVazio, type DossieAdmissao, type PacoteAdmissao } from '@/lib/admissao/tipos'
import { errosDaEtapa, errosDoDossie } from '@/lib/admissao/validar'
import { cn } from '@/lib/utils'
import { baixarPacoteAdmissaoPDF, type DocumentoAdmissao } from './pdf/pacote-admissao-pdf'
import {
  EtapaCondicoes, EtapaDocumentos, EtapaPessoais, EtapaRevisao, EtapaVaga, EtapaVt, INFO_ETAPAS,
  type Definir, type FuncaoOpt, type PostoOpt, type TurnoOpcao,
} from './etapas'

interface Props {
  postos: PostoOpt[]
  funcoes: FuncaoOpt[]
}

const hojeLocal = () => new Date().toLocaleDateString('sv-SE')
const moedaTexto = (v: number | null | undefined) => (v === null || v === undefined ? '' : v.toFixed(2).replace('.', ','))

function temConteudo(d: Partial<DossieAdmissao> | null): boolean {
  return !!d && !!(d.nome || d.cpf || d.posto_id || d.funcao_id)
}

/** Assistente de admissão (página /admissao). Diferente do botão "Nova Admissão" de Postos, que só avisa a gestão. */
export function AssistenteAdmissao({ postos, funcoes }: Props) {
  // Muda a cada "nova admissão"/limpeza, para o efeito do rascunho rodar de novo.
  const [ciclo, setCiclo] = useState(0)
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
  const [linhasConhecidas, setLinhasConhecidas] = useState<LinhaConhecida[]>([])

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
    let cancelado = false
    obterRascunho()
      .then(r => {
        if (cancelado) return
        if (r.success && temConteudo(r.dados)) setRascunhoPendente({ dados: r.dados as Partial<DossieAdmissao>, atualizadoEm: r.atualizadoEm })
        else setRascunhoResolvido(true)
      })
      .catch(() => { if (!cancelado) setRascunhoResolvido(true) })
    return () => { cancelado = true }
  }, [ciclo])

  // Linhas de transporte já usadas em outras admissões (autocompletar do VT).
  useEffect(() => {
    let cancelado = false
    listarLinhasTransporte().then(l => { if (!cancelado) setLinhasConhecidas(l) }).catch(() => undefined)
    return () => { cancelado = true }
  }, [ciclo])

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
    if (!rascunhoResolvido || pacote || !modificado.current) return
    const t = setTimeout(async () => {
      const r = await salvarRascunho(d)
      if (r.success) setSalvoEm(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }))
    }, 1500)
    return () => clearTimeout(t)
  }, [d, rascunhoResolvido, pacote])

  // ── Sugestões do sistema (salário, CBO, setor, VA/VR, centro de custo…) ──
  useEffect(() => {
    if (!d.posto_id && !d.funcao_id) { setSugestao(null); return }
    let cancelado = false
    carregarSugestaoAdmissao(d.posto_id, d.funcao_id).catch(() => null).then(r => {
      if (cancelado || !r || !r.success) return
      setSugestao(r.sugestao)
      setD(atual => {
        const novo = { ...atual }
        // O centro de custo é do supervisor: vem junto com o primeiro posto escolhido.
        if (atual.posto_id && atual.posto_id !== postoAplicado.current) {
          postoAplicado.current = atual.posto_id
          novo.contrato = r.sugestao.contrato
          novo.centro_custo = r.sugestao.centro_custo
        }
        if (atual.funcao_id && atual.funcao_id !== funcaoAplicada.current && r.sugestao.funcao) {
          funcaoAplicada.current = atual.funcao_id
          novo.cbo = r.sugestao.funcao.cbo
          novo.setor = r.sugestao.funcao.setor
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
  }, [d.posto_id, jovemAprendiz])

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
    setCiclo(c => c + 1)
  }

  async function limpar() {
    if (enviando) return
    if (modificado.current && !window.confirm('Descartar o que já foi preenchido?')) return
    await descartarRascunho()
    reiniciar()
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

  const info = INFO_ETAPAS[etapa - 1]
  const Icone = info.icone
  const botaoSecundario = 'inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50'
  const botaoPrimario = 'inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-700 disabled:opacity-50'

  return (
    <div className={cn('mx-auto w-full max-w-4xl overflow-hidden rounded-2xl border-t-4 bg-white shadow-md ring-1 ring-slate-200', pacote ? 'border-emerald-500' : info.borda)}>
      {pacote ? (
        <div className="px-5 py-10 text-center sm:px-10">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
            <CheckCircle2 className="h-9 w-9 text-emerald-600" aria-hidden="true" />
          </div>
          <h2 className="mt-4 text-xl font-bold text-slate-900">Solicitação enviada!</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
            Foi para aprovação da gestão. O PDF com os 3 documentos já foi baixado: imprima, colha as assinaturas e entregue ao RH.
          </p>
          {erroPdf && <p className="mx-auto mt-4 max-w-md rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{erroPdf}</p>}

          <div className="mx-auto mt-6 grid max-w-2xl grid-cols-1 gap-3 sm:grid-cols-3">
            {([
              ['cadastro', 'Cadastro', 'de Funcionários', FileText, 'bg-blue-50 text-blue-700 ring-blue-200'],
              ['vt', 'Vale Transporte', 'Solicitação', Receipt, 'bg-emerald-50 text-emerald-700 ring-emerald-200'],
              ['integracao', 'Integração', 'Lista de Presença', Users, 'bg-orange-50 text-orange-700 ring-orange-200'],
            ] as [DocumentoAdmissao, string, string, typeof FileText, string][]).map(([doc, titulo, sub, Ic, cor]) => (
              <button key={doc} type="button" disabled={gerandoPdf} onClick={() => baixar(pacote, [doc])}
                className={cn('flex flex-col items-center gap-1 rounded-xl p-4 ring-1 ring-inset transition-transform hover:-translate-y-0.5 disabled:opacity-50', cor)}>
                <Ic className="h-6 w-6" aria-hidden="true" />
                <span className="text-sm font-semibold">{titulo}</span>
                <span className="text-xs opacity-80">{sub}</span>
                <span className="mt-1 inline-flex items-center gap-1 text-xs font-medium"><Download className="h-3 w-3" aria-hidden="true" /> baixar só este</span>
              </button>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button type="button" disabled={gerandoPdf} onClick={() => baixar(pacote)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-semibold text-slate-900 shadow-sm hover:bg-amber-400 disabled:opacity-50">
              <Download className="h-4 w-4" aria-hidden="true" /> {gerandoPdf ? 'Gerando…' : 'Baixar os 3 documentos'}
            </button>
            <button type="button" onClick={reiniciar} className={botaoPrimario}>Nova admissão</button>
          </div>
        </div>
      ) : (
        <>
          {/* Cabeçalho: stepper com ícones e rótulos */}
          <div className="border-b border-slate-100 bg-gradient-to-b from-slate-50 to-white px-5 pb-4 pt-5 sm:px-8">
            <ol className="flex items-start" aria-label="Etapas">
              {INFO_ETAPAS.map((e, i) => {
                const n = i + 1
                const feito = n < etapa
                const atual = n === etapa
                const Ic = e.icone
                return (
                  <li key={e.titulo} className="flex flex-1 flex-col items-center last:flex-none sm:last:flex-1">
                    <div className="flex w-full items-center">
                      <span className={cn('h-0.5 flex-1', i === 0 ? 'opacity-0' : feito || atual ? INFO_ETAPAS[i - 1].barra : 'bg-slate-200')} />
                      <button type="button" disabled={n > etapa} onClick={() => { setErros([]); setEtapa(n) }}
                        title={e.titulo} aria-current={atual ? 'step' : undefined}
                        className={cn(
                          'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-all',
                          atual ? cn(e.tile, 'ring-4', e.anel) : feito ? cn(e.barra, 'text-white') : 'bg-slate-100 text-slate-400',
                        )}>
                        {feito ? <Check className="h-4 w-4" aria-hidden="true" /> : <Ic className="h-4 w-4" aria-hidden="true" />}
                      </button>
                      <span className={cn('h-0.5 flex-1', i === INFO_ETAPAS.length - 1 ? 'opacity-0' : feito ? e.barra : 'bg-slate-200')} />
                    </div>
                    <span className={cn('mt-1.5 hidden text-center text-[11px] font-medium sm:block', atual ? 'text-slate-900' : 'text-slate-400')}>{e.titulo}</span>
                  </li>
                )
              })}
            </ol>
          </div>

          <div className="px-5 py-6 sm:px-8">
            {/* Título da etapa */}
            <div className="mb-6 flex items-center gap-3">
              <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', info.tile)}>
                <Icone className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Etapa {etapa} de {INFO_ETAPAS.length}</p>
                <h2 className="text-lg font-bold leading-tight text-slate-900">{info.titulo}</h2>
                <p className="text-sm text-slate-500">{info.descricao}</p>
              </div>
            </div>

            {rascunhoPendente && (
              <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
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
            {etapa === 4 && <EtapaVt d={d} definir={definir} linhasConhecidas={linhasConhecidas} />}
            {etapa === 5 && <EtapaDocumentos d={d} definir={definir} />}
            {etapa === 6 && (
              <EtapaRevisao d={d} postoNome={postoNome} funcaoNome={funcaoSel?.nome ?? ''} turnoNome={turnoNome} />
            )}

            {erros.length > 0 && (
              <ul className="mt-5 space-y-0.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
                {erros.map(e => <li key={e}>• {e}</li>)}
              </ul>
            )}
          </div>

          <div className="sticky bottom-0 flex items-center justify-between gap-2 border-t border-slate-100 bg-white/95 px-5 py-3 backdrop-blur sm:px-8">
            <span className="text-xs text-slate-400">{salvoEm ? `Rascunho salvo às ${salvoEm}` : ''}</span>
            <div className="flex gap-2">
              {etapa > 1
                ? <button type="button" onClick={() => { setErros([]); setEtapa(etapa - 1) }} disabled={enviando} className={botaoSecundario}><ArrowLeft className="h-4 w-4" aria-hidden="true" /> Voltar</button>
                : <button type="button" onClick={limpar} disabled={enviando} className={botaoSecundario}>Limpar</button>}
              {etapa < INFO_ETAPAS.length
                ? <button type="button" onClick={avancar} className={botaoPrimario}>Avançar <ArrowRight className="h-4 w-4" aria-hidden="true" /></button>
                : <button type="button" onClick={enviar} disabled={enviando}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-semibold text-slate-900 shadow-sm hover:bg-amber-400 disabled:opacity-50">
                    <Send className="h-4 w-4" aria-hidden="true" /> {enviando ? 'Enviando…' : 'Enviar e imprimir'}
                  </button>}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
