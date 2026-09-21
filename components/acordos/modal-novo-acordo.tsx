'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { buscarFuncionariosPorPostos, criarAcordo } from '@/app/(admin)/acordos/actions'
import type { AcordoPostoItem, FuncionarioParaAcordo } from '@/app/(admin)/acordos/actions'
import { calendarioParaMapa, type CalendarioLinha } from '@/lib/calendario/mapa'
import { DIAS_SEMANA, type Achado, type FuncionarioCalc, type TemplateId } from '@/lib/acordos/tipos'
import { agruparPorJornada, resumoCalculo } from '@/lib/acordos/movimentos'
import { gerarObjeto } from '@/lib/acordos/templates'
import { camposFaltando, temErro, validarAcordo } from '@/lib/acordos/validar'
import { assinaturaSemana, juntarRotulos, saidaDoDia } from '@/lib/acordos/horario-do-turno'
import { sugerirDiasAjuste } from '@/lib/acordos/dias'
import { fmtHoraCurta, hhmmParaMin } from '@/lib/acordos/tempo'
import { NOMES_EVENTO_SUGERIDOS } from '@/lib/acordos/motivos'
import {
  agruparAchados, combinarNomesEvento, dataMaximaPrazo, fmtDuracao, montarChecklist, precisaPrazo, proximasDatasCalendario,
  textoConta, tituloSugerido, verboCompensacao,
  type ItemChecklistId,
} from '@/lib/acordos/resumo'
import { CamposTemplate, FORM_VAZIO, montarCampos, type CampoChave, type FormState } from './campos-template'
import { INPUT_CLS, INPUT_ERRO_CLS, LABEL_CLS, Passo } from './passo'
import { SituacaoCards } from './situacao-cards'
import { PassoFuncionarios } from './passo-funcionarios'
import { PrazoLimite } from './prazo-limite'
import { ResumoAcordo, type ItemResumo, type StatusResumo, type TextoGrupo, type TurnoResumo } from './resumo-acordo'

/** Campo do formulário -> chave "tocada" (para só mostrar erro depois de interagir). */
const CHAVE_DO_FORM: Partial<Record<keyof FormState, string>> = {
  dataEvento: 'dataEvento', nomeEvento: 'nomeEvento', periodoInicio: 'horas', periodoFim: 'horas', duracao: 'horas',
  horaDispensa: 'horaDispensa', motivo: 'motivo', dataFolga: 'dataFolga', folgas: 'dataFolga', datasAjuste: 'dias', prazoLimite: 'prazo',
}

/** Chaves tocadas que "acendem" cada item do checklist. */
const CHAVES_DO_ITEM: Record<ItemChecklistId, string[]> = {
  titulo: ['titulo'],
  situacao: ['situacao'],
  funcionarios: ['posto', 'funcionarios'],
  datas: ['dataEvento', 'nomeEvento', 'horas', 'horaDispensa', 'dataFolga', 'dias'],
  motivo: ['motivo'],
  prazo: ['prazo'],
}

const ANCORA: Record<ItemChecklistId, string> = {
  titulo: 'passo-topo',
  situacao: 'passo-situacao',
  funcionarios: 'passo-funcionarios',
  datas: 'passo-dados',
  motivo: 'passo-motivo',
  prazo: 'passo-prazo',
}

const CODIGOS_PRAZO = ['PRAZO_OBRIGATORIO', 'PRAZO_LONGO', 'PRAZO_ANTES']
/** Códigos que aparecem junto ao campo (ou no checklist) e não precisam repetir no bloco de erros. */
const CODIGOS_DIAS = ['ORDEM_DATAS', 'DIVISAO', 'DATAS_REPETIDAS', 'LIMITE_ACRESCIMO']
const CODIGOS_HORAS = ['PERIODO_INCOMPLETO', 'PERIODO_INVALIDO']
const CODIGOS_DO_CHECKLIST = ['CAMPO_OBRIGATORIO', 'SEM_FUNCIONARIOS', ...CODIGOS_PRAZO]

interface Props {
  postos: AcordoPostoItem[]
  calendario: CalendarioLinha[]
  /** Nomes de evento de acordos recentes (atalhos). */
  nomesRecentes: string[]
  onClose: () => void
}

export function ModalNovoAcordo({ postos, calendario, nomesRecentes, onClose }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const [titulo, setTitulo] = useState('')
  const [tituloManual, setTituloManual] = useState(false)
  const [tipo, setTipo] = useState<'individual' | 'coletivo'>('individual')
  const [postosSel, setPostosSel] = useState<string[]>([])
  const [dataDoc, setDataDoc] = useState(new Date().toLocaleDateString('sv-SE'))
  const [template, setTemplate] = useState<TemplateId>('T3')
  const [situacaoEscolhida, setSituacaoEscolhida] = useState(false)
  const [f, setF] = useState<FormState>(FORM_VAZIO)
  const [funcs, setFuncs] = useState<FuncionarioParaAcordo[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [loadingFuncs, setLoadingFuncs] = useState(false)
  const [erroServidor, setErroServidor] = useState('')
  const [diasManual, setDiasManual] = useState(false)
  const [hoje] = useState(() => new Date().toLocaleDateString('sv-SE'))
  const [tocou, setTocou] = useState<Set<string>>(new Set())
  const [tentou, setTentou] = useState(false)
  const [prazoRevelado, setPrazoRevelado] = useState(false)

  const tocar = useCallback((k: string) => {
    setTocou(prev => (prev.has(k) ? prev : new Set(prev).add(k)))
  }, [])

  const set = useCallback(<K extends keyof FormState>(k: K, v: FormState[K]) => {
    setF(prev => ({ ...prev, [k]: v }))
    const chave = CHAVE_DO_FORM[k]
    // limpar um campo (ex.: trocar de aba de período/horas) não conta como "tocar"
    if (chave && (k === 'datasAjuste' || k === 'folgas' || (typeof v === 'string' && v !== ''))) tocar(chave)
  }, [tocar])

  function escolherSituacao(id: TemplateId) {
    if (id !== template || !situacaoEscolhida) {
      setTemplate(id)
      setDiasManual(false)
      setF(prev => ({ ...prev, datasAjuste: [] }))
    }
    setSituacaoEscolhida(true)
    tocar('situacao')
  }

  // Carrega funcionários automaticamente ao escolher o(s) posto(s)
  useEffect(() => {
    let ativo = true
    if (postosSel.length === 0) {
      setFuncs([])
      setSelectedIds(new Set())
      setLoadingFuncs(false)
      return
    }
    setLoadingFuncs(true)
    buscarFuncionariosPorPostos(postosSel).then(res => {
      if (!ativo) return
      setFuncs(res)
      setSelectedIds(new Set(res.filter(x => x.elegivel && (x.status === 'ativo' || x.status === 'ferias')).map(x => x.id)))
      setLoadingFuncs(false)
    })
    return () => { ativo = false }
  }, [postosSel])

  function togglePosto(id: string) {
    tocar('posto')
    setPostosSel(prev => (tipo === 'individual' ? [id] : prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]))
  }

  function toggleFunc(id: string) {
    tocar('funcionarios')
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selecionados = useMemo(() => funcs.filter(x => selectedIds.has(x.id)), [funcs, selectedIds])
  const calc: FuncionarioCalc[] = useMemo(
    () => selecionados.map(x => ({ id: x.id, nome: x.nome, status: x.status, regime: x.regime, semana: x.semana, semTurno: x.sem_turno })),
    [selecionados],
  )
  const feriados = useMemo(() => calendarioParaMapa(calendario), [calendario])
  const campos = useMemo(() => montarCampos(template, f, selectedIds), [template, f, selectedIds])
  const grupos = useMemo(() => agruparPorJornada(campos, calc), [campos, calc])

  // Título automático enquanto o usuário não digitar nele
  const postoNome = postos.find(p => p.id === postosSel[0])?.nome
  const tituloAuto = situacaoEscolhida ? tituloSugerido(template, campos, postoNome) : ''
  const tituloAtual = tituloManual ? titulo : tituloAuto

  const nomesEvento = useMemo(() => combinarNomesEvento(nomesRecentes, NOMES_EVENTO_SUGERIDOS), [nomesRecentes])
  const atalhosCalendario = useMemo(() => proximasDatasCalendario(calendario, hoje), [calendario, hoje])

  const achados: Achado[] = useMemo(() => {
    if (grupos.length === 0) return validarAcordo(campos, [], feriados)
    const vistos = new Set<string>()
    const out: Achado[] = []
    for (const g of grupos) {
      for (const a of validarAcordo(campos, g, feriados)) {
        const chave = `${a.codigo}|${a.funcionarioId ?? ''}|${a.mensagem}`
        if (!vistos.has(chave)) { vistos.add(chave); out.push(a) }
      }
    }
    return out
  }, [campos, grupos, feriados])

  // Dias de ajuste sugeridos automaticamente enquanto o usuário não editar a lista à mão
  const sugestaoDias = useMemo(
    () => sugerirDiasAjuste({ ...campos, datasAjuste: [] }, calc, feriados, hoje),
    [campos, calc, feriados, hoje],
  )
  useEffect(() => {
    if (diasManual) return
    if (sugestaoDias.join('|') !== f.datasAjuste.join('|')) setF(prev => ({ ...prev, datasAjuste: sugestaoDias }))
  }, [diasManual, sugestaoDias, f.datasAjuste])

  // ── Turnos ────────────────────────────────────────────────────────────────
  const turnos = useMemo(() => {
    const m = new Map<string, FuncionarioCalc[]>()
    for (const x of calc) {
      const k = assinaturaSemana(x.semana)
      m.set(k, [...(m.get(k) ?? []), x])
    }
    return Array.from(m.values())
  }, [calc])
  // Mesmos rótulos do PDF/banco: Turno A, B, C… (ou Turno Único)
  const rotuloTurno = useCallback(
    (i: number) => (turnos.length === 1 ? 'Turno Único' : `Turno ${String.fromCharCode(65 + i)}`),
    [turnos.length],
  )
  const turnosDoGrupo = useCallback(
    (g: FuncionarioCalc[]) => {
      const ids = new Set(g.map(x => x.id))
      return turnos.flatMap((fs, i) => (ids.has(fs[0].id) ? [rotuloTurno(i)] : []))
    },
    [turnos, rotuloTurno],
  )

  const turnosResumo: TurnoResumo[] = useMemo(
    () => turnos.map((fs, i) => {
      const s = fs[0].semana
      const diaUtil = DIAS_SEMANA.find(d => !s[d].folga)
      const g = grupos.find(gr => gr.some(x => x.id === fs[0].id))
      const r = g && situacaoEscolhida ? resumoCalculo(campos, g) : null
      return {
        rotulo: rotuloTurno(i),
        qtd: fs.length,
        semana: s,
        nomes: fs.map(x => x.nome),
        horario: diaUtil ? `${s[diaUtil].e1}–${saidaDoDia(s[diaUtil])}` : 'sem expediente',
        aRepor: r && r.horasTotalMin > 0 ? `${fmtDuracao(r.horasTotalMin)} ${verboCompensacao(template)}` : null,
        cor: i,
      }
    }),
    [turnos, grupos, campos, situacaoEscolhida, template, rotuloTurno],
  )

  const textos: TextoGrupo[] = useMemo(
    () => (situacaoEscolhida ? grupos : []).map(g => {
      const r = gerarObjeto(campos, resumoCalculo(campos, g))
      return {
        cabecalho: grupos.length > 1 ? `Grupo ${grupos.indexOf(g) + 1} · ${juntarRotulos(turnosDoGrupo(g))} · ${g.length} func.` : null,
        // revezamento: o parágrafo abre com os nomes do grupo (igual ao PDF)
        texto: r.ok ? (campos.folgasPorFuncionario ? `${juntarRotulos(g.map(x => x.nome))} ${r.texto}` : r.texto) : null,
      }
    }),
    [campos, grupos, situacaoEscolhida, turnosDoGrupo],
  )

  // ── Textos de apoio dos campos ────────────────────────────────────────────
  const r0 = grupos.length ? resumoCalculo(campos, grupos[0]) : null
  // "varia por turno" só quando os totais mesmo diferem (no revezamento os grupos podem diferir só na data)
  const variaPorTurno = new Set(grupos.map(g => resumoCalculo(campos, g).horasTotalMin)).size > 1
  const conta = r0 ? textoConta(template, campos.datasAjuste.length, r0.minutosPorDia, r0.horasTotalMin, variaPorTurno) : null
  const periodoMin = (template === 'T1' || template === 'T5') && f.periodoInicio && f.periodoFim
    ? hhmmParaMin(f.periodoFim) - hhmmParaMin(f.periodoInicio)
    : 0
  const notaPeriodo = r0 && periodoMin > 0 && r0.horasTotalMin > 0
    ? !variaPorTurno
      ? `Deste período, ${fmtDuracao(r0.horasTotalMin)} ficam fora do horário normal e serão compensados.`
      : 'O quanto fica fora do horário normal varia por turno (veja o resumo ao lado).'
    : null
  const dicaDispensa = template === 'T2' && r0?.horaNormal
    ? `Saída normal do turno nesse dia: ${fmtHoraCurta(r0.horaNormal)}${grupos.length > 1 ? ' (varia por turno)' : ''}. Só conta o que passar desse horário.`
    : null

  // ── Checklist, pendências e erros por campo ──────────────────────────────
  const prazoMostrado = precisaPrazo(template, achados, f.prazoLimite)
  const checklist = useMemo(
    () => montarChecklist({
      situacaoEscolhida, titulo: tituloAtual, postosSel: postosSel.length, funcionarios: selecionados.length, campos, achados,
      prazoObrigatorio: prazoMostrado,
    }),
    [situacaoEscolhida, tituloAtual, postosSel.length, selecionados.length, campos, achados, prazoMostrado],
  )
  const pendentes = checklist.filter(i => !i.ok)
  const nPend = Math.max(pendentes.length, temErro(achados) ? 1 : 0)
  const okDe = (id: ItemChecklistId) => checklist.find(i => i.id === id)?.ok ?? true

  const achadoPrazo = achados.find(a => CODIGOS_PRAZO.includes(a.codigo))
  const faltando = useMemo(() => camposFaltando(campos), [campos])
  const prazoObrigatorioDeFato = template === 'T4' || achados.some(a => a.codigo === 'PRAZO_OBRIGATORIO')
  // Prazo é o único item que sobrou: já vale mostrar em vermelho
  const soFaltaPrazo = situacaoEscolhida && okDe('titulo') && okDe('funcionarios') && okDe('datas') && okDe('motivo')
  const prazoVisivel = tentou || tocou.has('prazo') || !!achadoPrazo || soFaltaPrazo
  const erroPrazo = !okDe('prazo') && prazoVisivel ? (achadoPrazo?.mensagem ?? 'Informe o prazo limite.') : null

  const itemVisivel = (id: ItemChecklistId) =>
    tentou || CHAVES_DO_ITEM[id].some(k => tocou.has(k)) || (id === 'prazo' && prazoVisivel)
  const itensResumo: ItemResumo[] = checklist.map(i => ({
    id: i.id,
    label: i.label,
    estado: i.ok ? 'ok' : itemVisivel(i.id) ? 'erro' : 'neutro',
  }))

  const erros = useMemo(() => {
    const out: Partial<Record<CampoChave, string>> = {}
    if (!situacaoEscolhida) return out
    const mostra = (k: string) => tentou || tocou.has(k)
    const msgDe = (codigos: string[]) => achados.find(a => a.nivel === 'erro' && codigos.includes(a.codigo))?.mensagem
    if (faltando.includes('data do evento') && mostra('dataEvento')) out.dataEvento = 'Informe a data.'
    if (faltando.includes('nome do evento') && mostra('nomeEvento')) out.nomeEvento = 'Informe o nome do evento.'
    if (faltando.includes('horas trabalhadas no evento') && mostra('horas')) {
      out.horas = f.periodoInicio && !f.periodoFim ? 'Informe também o fim do período.'
        : !f.periodoInicio && f.periodoFim ? 'Informe também o início do período.'
        : 'Informe o período ou as horas trabalhadas.'
    }
    if (faltando.includes('horário de dispensa') && mostra('horaDispensa')) out.horaDispensa = 'Informe o horário de dispensa.'
    if (faltando.includes('data da folga') && mostra('dataFolga')) out.dataFolga = 'Informe a data.'
    if (faltando.includes('motivo') && mostra('motivo')) out.motivo = 'Escolha ou escreva o motivo.'
    const faltaDias = faltando.find(x => x.startsWith('dias de '))
    if (faltaDias && mostra('dias')) out.dias = 'Informe ao menos um dia. Use "Adicionar outro dia" ou "Recalcular dias".'
    out.dataFolga = out.dataFolga ?? msgDe(['FOLGA_SEM_DATA'])
    out.horas = out.horas ?? msgDe(CODIGOS_HORAS)
    out.dias = out.dias ?? msgDe(CODIGOS_DIAS)
    return out
  }, [situacaoEscolhida, tentou, tocou, faltando, achados, f.periodoInicio, f.periodoFim])

  const gruposResumo = useMemo(
    () => (situacaoEscolhida ? agruparAchados(achados.filter(a => !CODIGOS_DO_CHECKLIST.includes(a.codigo))) : []),
    [achados, situacaoEscolhida],
  )
  const nAvisos = gruposResumo.filter(g => g.nivel === 'aviso').length

  // erro de conteúdo (não só campo faltando): bloqueia o texto gerado
  const erroReal = situacaoEscolhida && achados.some(a => a.nivel === 'erro' && !CODIGOS_DO_CHECKLIST.includes(a.codigo))
  const interagiu = tocou.size > 0 || tentou
  const status: StatusResumo = !interagiu ? 'neutro' : nPend > 0 ? 'pendente' : nAvisos > 0 ? 'aviso' : 'pronto'
  const faltam = tentou && nPend > 0 ? `Faltam ${nPend} ${nPend === 1 ? 'item' : 'itens'}` : null

  function irPara(id: ItemChecklistId) {
    document.getElementById(ANCORA[id])?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  function handleSalvar() {
    if (nPend > 0) {
      setTentou(true)
      setErroServidor('')
      const primeiro = pendentes[0]
      if (primeiro) irPara(primeiro.id)
      return
    }
    setErroServidor('')
    startTransition(async () => {
      const postosObj = postos.filter(p => postosSel.includes(p.id))
      const res = await criarAcordo({
        titulo: tituloAtual.trim(),
        tipo,
        postos: postosObj,
        funcionarioIds: selecionados.map(x => x.id),
        data_documento: dataDoc,
        campos,
      })
      if ('error' in res) {
        setErroServidor(res.error)
        return
      }
      router.refresh()
      onClose()
    })
  }

  const erroTitulo = tentou && !tituloAtual.trim()
  const erroFuncionarios = !loadingFuncs && !okDe('funcionarios') && itemVisivel('funcionarios')
    ? postosSel.length === 0 ? 'Escolha um posto.' : selecionados.length === 0 ? 'Marque ao menos um funcionário.' : 'Há funcionários não elegíveis selecionados.'
    : null
  const numeroPrazo = 4

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overflow-x-hidden bg-black/50 px-4 py-8">
      <div className="w-full max-w-5xl rounded-2xl bg-white shadow-2xl">
        <div className="rounded-t-2xl bg-slate-900 px-6 py-5">
          <h2 className="text-base font-bold text-white">Novo Acordo de Compensação</h2>
          <p className="mt-0.5 text-xs text-slate-400">Responda os passos; o texto é gerado a partir dos campos e o PDF sai após salvar</p>
        </div>

        <div className="grid gap-4 rounded-b-2xl bg-slate-50 p-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <div className="space-y-4">
            <section id="passo-topo" className="scroll-mt-4 space-y-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div>
                <label htmlFor="campo-titulo" className={`${LABEL_CLS} mb-1.5`}>Título do acordo</label>
                <input
                  id="campo-titulo"
                  value={tituloAtual}
                  onChange={e => { setTitulo(e.target.value); setTituloManual(true); tocar('titulo') }}
                  placeholder="ex: Emenda 05/06 — Junho 2026"
                  className={erroTitulo ? INPUT_ERRO_CLS : INPUT_CLS}
                />
                {erroTitulo && <p className="mt-1 text-xs font-medium text-red-600">Informe o título do acordo.</p>}
                {!erroTitulo && !tituloManual && tituloAuto && <p className="mt-1 text-xs text-gray-400">Sugerido automaticamente. Pode editar.</p>}
                {tituloManual && tituloAuto && tituloAuto !== titulo && (
                  <button type="button" onClick={() => setTituloManual(false)} className="mt-1 text-xs font-medium text-slate-500 underline hover:text-slate-800">
                    usar sugestão: {tituloAuto}
                  </button>
                )}
              </div>
              <div>
                <label className={`${LABEL_CLS} mb-1.5`}>Abrangência</label>
                <div className="grid grid-cols-2 gap-2">
                  {([['individual', 'Individual', 'Uma unidade'], ['coletivo', 'Coletivo', 'Múltiplas unidades']] as const).map(([val, nome, sub]) => (
                    <label key={val} className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 px-3 py-2 ${tipo === val ? 'border-slate-900 bg-slate-50' : 'border-gray-200 hover:border-gray-300'}`}>
                      <input type="radio" checked={tipo === val} onChange={() => { setTipo(val); setPostosSel([]) }} className="accent-slate-900" />
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{nome}</p>
                        <p className="text-xs text-gray-400">{sub}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </section>

            <Passo id="passo-situacao" numero={1} titulo="O que aconteceu?" feito={situacaoEscolhida} erro={tentou && !situacaoEscolhida}>
              <SituacaoCards selecionado={situacaoEscolhida ? template : null} onSelect={escolherSituacao} />
              {tentou && !situacaoEscolhida && <p className="text-xs font-medium text-red-600">Escolha a situação que melhor descreve o caso.</p>}
            </Passo>

            <Passo id="passo-funcionarios" numero={2} titulo="Onde e quem?" feito={okDe('funcionarios')} erro={!!erroFuncionarios}>
              <PassoFuncionarios
                postos={postos}
                tipo={tipo}
                postosSel={postosSel}
                onTogglePosto={togglePosto}
                funcs={funcs}
                selectedIds={selectedIds}
                onToggleFunc={toggleFunc}
                onSetSelecionados={ids => { tocar('funcionarios'); setSelectedIds(ids) }}
                loading={loadingFuncs}
                erro={erroFuncionarios}
              />
            </Passo>

            <Passo id="passo-dados" numero={3} titulo="Dados do acordo" feito={situacaoEscolhida && okDe('datas') && okDe('motivo')}>
              {situacaoEscolhida ? (
                <CamposTemplate
                  template={template}
                  f={f}
                  set={set}
                  feriados={feriados}
                  diasManual={diasManual}
                  onDatasManuais={() => setDiasManual(true)}
                  onRecalcular={() => setDiasManual(false)}
                  erros={erros}
                  conta={conta}
                  dicaDispensa={dicaDispensa}
                  notaPeriodo={notaPeriodo}
                  nomesEvento={nomesEvento}
                  funcionarios={selecionados.map(x => ({ id: x.id, nome: x.nome }))}
                  atalhosCalendario={atalhosCalendario}
                />
              ) : (
                <p className="text-sm text-gray-400">Escolha a situação no passo 1 para ver os campos.</p>
              )}
            </Passo>

            {situacaoEscolhida && (prazoMostrado || prazoRevelado) && (
              <PrazoLimite
                numero={numeroPrazo}
                obrigatorio={prazoObrigatorioDeFato}
                valor={f.prazoLimite}
                onChange={v => set('prazoLimite', v)}
                erro={erroPrazo}
                max={dataMaximaPrazo(campos)}
              />
            )}
            {situacaoEscolhida && !prazoMostrado && !prazoRevelado && (
              <button type="button" onClick={() => setPrazoRevelado(true)} className="text-xs font-medium text-slate-500 underline hover:text-slate-800">
                Definir prazo limite (opcional)
              </button>
            )}
          </div>

          <ResumoAcordo
            status={status}
            nPendencias={nPend}
            nAvisos={nAvisos}
            checklist={itensResumo}
            onIrPara={irPara}
            turnos={turnosResumo}
            gruposDeCompensacao={situacaoEscolhida ? grupos.length : 0}
            achados={gruposResumo}
            textos={textos}
            temErro={erroReal}
            dataDoc={dataDoc}
            onDataDoc={setDataDoc}
            faltam={faltam}
            erroServidor={erroServidor}
            pending={pending}
            onCancelar={onClose}
            onSalvar={handleSalvar}
          />
        </div>
      </div>
    </div>
  )
}
