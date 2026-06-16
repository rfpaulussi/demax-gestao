'use client'

import { useState, useTransition } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { cn } from '@/lib/utils'
import { criarAdvertencia, buscarHistoricoAdvertencias } from '@/app/(admin)/advertencias/actions'
import type { FuncionarioOpt, SupervisorOpt, HistoricoAdvertencia } from '@/app/(admin)/advertencias/actions'

const NATUREZA_OPTS = [
  { value: 'comportamento',  label: 'Comportamento Inadequado' },
  { value: 'falta',          label: 'Falta Injustificada' },
  { value: 'atraso',         label: 'Atraso Recorrente' },
  { value: 'negligencia',    label: 'Negligência no Trabalho' },
  { value: 'descumprimento', label: 'Descumprimento de Normas Internas' },
  { value: 'insubordinacao', label: 'Insubordinação' },
  { value: 'desídia',        label: 'Desídia no Desempenho das Funções' },
  { value: 'improbidade',    label: 'Improbidade / Desonestidade' },
  { value: 'ofensa_honra',   label: 'Ofensa à Honra de Colegas ou Superiores' },
  { value: 'uso_indevido',   label: 'Uso Indevido de Equipamentos/Patrimônio' },
  { value: 'abandono',       label: 'Abandono de Posto de Trabalho' },
  { value: 'outro',          label: 'Outro' },
]

const NATUREZA_CLT: Record<string, string> = {
  comportamento:   'Art. 482, alínea "j" da CLT — ato lesivo à honra ou à boa fama praticado no serviço',
  falta:           'Art. 482, alínea "e" da CLT — desídia no desempenho das respectivas funções',
  atraso:          'Art. 482, alínea "e" da CLT — desídia no desempenho das respectivas funções',
  negligencia:     'Art. 482, alínea "e" da CLT — desídia no desempenho das respectivas funções',
  descumprimento:  'Art. 482, alínea "h" da CLT — ato de indisciplina ou de insubordinação',
  insubordinacao:  'Art. 482, alínea "h" da CLT — ato de indisciplina ou de insubordinação',
  'desídia':       'Art. 482, alínea "e" da CLT — desídia no desempenho das respectivas funções',
  improbidade:     'Art. 482, alínea "a" da CLT — ato de improbidade',
  ofensa_honra:    'Art. 482, alínea "j" da CLT — ato lesivo à honra ou à boa fama praticado no serviço',
  uso_indevido:    'Art. 482, alínea "f" da CLT — embriaguez habitual ou em serviço / uso indevido de bens da empresa',
  abandono:        'Art. 482, alínea "i" da CLT — abandono de emprego / abandono de posto',
  outro:           'Regulamento Interno da Empresa e Art. 482 da CLT',
}

const NATUREZA_TEXTO_BASE: Record<string, string> = {
  comportamento:   'O(A) colaborador(a) apresentou comportamento inadequado no ambiente de trabalho, em desacordo com as normas de conduta estabelecidas pela empresa e pelos princípios de convivência profissional, conforme verificado na data e horário indicados.',
  falta:           'O(A) colaborador(a) faltou ao trabalho sem apresentar justificativa ou documentação comprobatória no prazo regulamentar, caracterizando falta injustificada nos termos da legislação trabalhista e das normas internas da empresa.',
  atraso:          'O(A) colaborador(a) registrou atrasos recorrentes no cumprimento do horário de trabalho estabelecido em contrato, descumprindo reiteradamente as obrigações de pontualidade previstas no Regulamento Interno.',
  negligencia:     'O(A) colaborador(a) demonstrou negligência no desempenho de suas funções, deixando de executar as atividades de sua responsabilidade com o zelo e a qualidade exigidos, causando prejuízo à prestação dos serviços.',
  descumprimento:  'O(A) colaborador(a) descumpriu normas internas de segurança, conduta e procedimentos operacionais estabelecidos pela empresa, conforme orientações previamente fornecidas e de seu pleno conhecimento.',
  insubordinacao:  'O(A) colaborador(a) recusou-se a cumprir ordem direta e legítima emanada por seu superior hierárquico, caracterizando ato de insubordinação incompatível com a relação de emprego e as normas disciplinares da empresa.',
  'desídia':       'O(A) colaborador(a) demonstrou desídia reiterada no desempenho de suas funções, evidenciada pela falta de empenho, atenção e qualidade na execução das atividades que lhe competem.',
  improbidade:     'O(A) colaborador(a) praticou ato de improbidade no ambiente de trabalho, em violação aos princípios de honestidade, lealdade e boa-fé que devem nortear a relação de emprego.',
  ofensa_honra:    'O(A) colaborador(a) proferiu ofensas à honra e à boa fama de colega(s) ou superior(es) hierárquico(s) durante o expediente de trabalho, configurando conduta incompatível com o ambiente profissional.',
  uso_indevido:    'O(A) colaborador(a) utilizou de forma indevida equipamentos, ferramentas ou patrimônio da empresa, em desacordo com as normas de uso e conservação estabelecidas, causando risco de dano ao patrimônio público/empresarial.',
  abandono:        'O(A) colaborador(a) abandonou seu posto de trabalho sem autorização prévia de superior hierárquico e sem justificativa plausível, colocando em risco a continuidade dos serviços sob sua responsabilidade.',
  outro:           '',
}

interface Props {
  open: boolean
  onClose: () => void
  funcionarios: FuncionarioOpt[]
  supervisores: SupervisorOpt[]
  reincidencias: Record<string, number>
}

const input  = 'flex h-9 w-full rounded-lg border border-gray-200 bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400'
const lbl    = 'block text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1.5'
const secTtl = 'text-xs font-bold uppercase tracking-widest text-gray-500 border-b border-gray-100 pb-2 mb-4'

export function ModalAdvertencia({ open, onClose, funcionarios, supervisores, reincidencias }: Props) {
  const [selectedId,       setSelectedId]       = useState('')
  const [selectedFunc,     setSelectedFunc]     = useState<FuncionarioOpt | null>(null)
  const [grau,             setGrau]             = useState('')
  const [natureza,         setNatureza]         = useState('')
  const [busca,            setBusca]            = useState('')
  const [relato,           setRelato]           = useState('')
  const [historico,        setHistorico]        = useState<HistoricoAdvertencia[]>([])
  const [loadingHistorico, setLoadingHistorico] = useState(false)
  const [isPending,        startTransition]     = useTransition()

  const funcFiltradas = busca
    ? funcionarios.filter(f => f.nome.toLowerCase().includes(busca.toLowerCase()))
    : funcionarios.slice(0, 80)

  const reinc = selectedId ? (reincidencias[selectedId] ?? 0) : 0

  async function handleSelecionarFuncionario(id: string) {
    setSelectedId(id)
    const func = funcionarios.find(f => f.id === id) ?? null
    setSelectedFunc(func)
    if (id) {
      setLoadingHistorico(true)
      const hist = await buscarHistoricoAdvertencias(id)
      setHistorico(hist)
      setLoadingHistorico(false)
    } else {
      setHistorico([])
    }
  }

  function handleNatureza(value: string) {
    setNatureza(value)
    if (NATUREZA_TEXTO_BASE[value]) {
      setRelato(NATUREZA_TEXTO_BASE[value])
    }
  }

  function handleClose() {
    setSelectedId(''); setSelectedFunc(null); setGrau(''); setNatureza('')
    setBusca(''); setRelato(''); setHistorico([]); onClose()
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const form = e.currentTarget
    startTransition(async () => {
      try {
        await criarAdvertencia(formData)
        form.reset()
        handleClose()
      } catch (err) {
        console.error('Erro ao criar advertência:', err)
        alert('Erro ao salvar advertência: ' + (err instanceof Error ? err.message : 'Erro desconhecido'))
      }
    })
  }

  return (
    <Dialog.Root open={open} onOpenChange={(isOpen) => { if (!isOpen) handleClose() }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/50" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl bg-white p-6 shadow-xl">

          <Dialog.Title className="mb-1 text-lg font-semibold text-gray-900">
            Nova Advertência
          </Dialog.Title>
          <p className="mb-6 text-sm text-gray-400">Registro de medida disciplinar</p>

          <form onSubmit={handleSubmit} className="space-y-6">

            {/* 1. Colaborador */}
            <div>
              <p className={secTtl}>1. Colaborador</p>
              <div className="space-y-3">
                <div>
                  <label className={lbl}>Buscar pelo nome</label>
                  <input
                    type="text"
                    placeholder="Digite para filtrar..."
                    value={busca}
                    onChange={e => setBusca(e.target.value)}
                    className={input}
                  />
                </div>
                <div>
                  <label className={lbl}>Funcionário *</label>
                  <select
                    name="funcionario_id"
                    required
                    value={selectedId}
                    onChange={e => handleSelecionarFuncionario(e.target.value)}
                    className={input}
                  >
                    <option value="">Selecione o colaborador...</option>
                    {funcFiltradas.map(f => (
                      <option key={f.id} value={f.id}>
                        {f.nome}{f.postos?.nome ? ` - ${f.postos.nome}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                {selectedFunc && (
                  <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-sm text-slate-600">
                    <span className="font-medium">Posto:</span> {selectedFunc.postos?.nome ?? '—'} &nbsp;·&nbsp;
                    <span className="font-medium">Secretaria:</span> {selectedFunc.postos?.secretaria ?? '—'}
                  </div>
                )}
                {reinc > 0 && (
                  <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
                    <span className="text-sm font-semibold text-red-700">
                      Reincidente: {reinc} advertência{reinc > 1 ? 's' : ''} anterior{reinc > 1 ? 'es' : ''} registrada{reinc > 1 ? 's' : ''}.
                    </span>
                  </div>
                )}
                {selectedId && (
                  <div className="rounded-lg border border-slate-200 bg-white p-3">
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">
                      Histórico Disciplinar
                    </p>
                    {loadingHistorico ? (
                      <p className="text-xs text-slate-400">Carregando...</p>
                    ) : historico.length === 0 ? (
                      <p className="text-xs text-slate-400">Nenhuma ocorrência anterior registrada.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {historico.map(h => (
                          <div key={h.id} className="flex items-center justify-between text-xs">
                            <span className={`px-2 py-0.5 rounded-full font-medium ${
                              h.grau === 'suspensao' ? 'bg-red-100 text-red-700' :
                              h.grau === 'escrita'   ? 'bg-orange-100 text-orange-700' :
                                                       'bg-slate-100 text-slate-600'
                            }`}>
                              {h.grau === 'suspensao' ? `Suspensão ${h.dias_suspensao ?? ''}d` :
                               h.grau === 'escrita'   ? 'Advertência Escrita' : 'Advertência Verbal'}
                            </span>
                            <span className="text-slate-500">{h.natureza_label}</span>
                            <span className="text-slate-400">{h.data_fmt}</span>
                            <span className="text-slate-300">{h.dias_atras}d atrás</span>
                          </div>
                        ))}
                        {historico.some(h => h.grau === 'suspensao') && (
                          <div className="mt-2 rounded bg-red-50 border border-red-200 px-2 py-1 text-xs text-red-700 font-medium">
                            ⚠️ Funcionário já possui suspensão — próxima infração pode ensejar justa causa (Art. 482 CLT)
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* 2. Ocorrência */}
            <div>
              <p className={secTtl}>2. Ocorrência</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Data da Ocorrência *</label>
                  <input type="date" name="data_ocorrencia" required className={input} />
                </div>
                <div>
                  <label className={lbl}>Horário</label>
                  <input type="time" name="horario_fato" className={input} />
                </div>
                <div className="col-span-2">
                  <label className={lbl}>Natureza da Infração</label>
                  <select
                    value={natureza}
                    onChange={e => handleNatureza(e.target.value)}
                    className={input}
                  >
                    <option value="">Selecione...</option>
                    {NATUREZA_OPTS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  {natureza && NATUREZA_CLT[natureza] && (
                    <p className="text-xs text-slate-400 mt-1">
                      Base legal: {NATUREZA_CLT[natureza]}
                    </p>
                  )}
                </div>
                <div className="col-span-2">
                  <label className={lbl}>Relato Detalhado</label>
                  <textarea
                    rows={4}
                    value={relato}
                    onChange={e => setRelato(e.target.value)}
                    placeholder="Descreva o ocorrido com detalhes..."
                    className={cn(input, 'h-auto py-2 resize-none')}
                  />
                  <p className="text-xs text-slate-400 mt-1">
                    Texto sugerido preenchido automaticamente pela natureza — edite conforme o caso específico.
                  </p>
                </div>
                <div className="col-span-2">
                  <label className={lbl}>Observações Internas</label>
                  <textarea
                    name="descricao"
                    rows={2}
                    placeholder="Notas internas (não aparece no PDF)..."
                    className={cn(input, 'h-auto py-2 resize-none')}
                  />
                </div>
              </div>
            </div>

            {/* 3. Medida Disciplinar */}
            <div>
              <p className={secTtl}>3. Medida Disciplinar</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Grau *</label>
                  <select
                    name="grau"
                    required
                    value={grau}
                    onChange={e => setGrau(e.target.value)}
                    className={input}
                  >
                    <option value="">Selecione...</option>
                    <option value="verbal">Advertência Verbal</option>
                    <option value="escrita">Advertência Escrita</option>
                    <option value="suspensao">Suspensão</option>
                  </select>
                </div>
                {grau === 'suspensao' && (
                  <div>
                    <label className={lbl}>Dias de Suspensão *</label>
                    <input
                      type="number"
                      name="dias_suspensao"
                      min={1}
                      max={30}
                      required
                      className={input}
                    />
                  </div>
                )}
                <div>
                  <label className={lbl}>Data de Aplicação</label>
                  <input type="date" name="data_aplicacao" className={input} />
                </div>
                <div>
                  <label className={lbl}>Aplicado por (supervisor)</label>
                  <select name="registrado_por" className={input}>
                    <option value="">Selecione o supervisor...</option>
                    {supervisores.map(s => (
                      <option key={s.id} value={s.nome}>{s.nome}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* 4. Testemunhas e Defesa */}
            <div>
              <p className={secTtl}>4. Testemunhas e Defesa</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Testemunha 1</label>
                  <input
                    type="text"
                    name="testemunha_1"
                    placeholder="Nome completo..."
                    className={input}
                  />
                </div>
                <div>
                  <label className={lbl}>Testemunha 2</label>
                  <input
                    type="text"
                    name="testemunha_2"
                    placeholder="Nome completo..."
                    className={input}
                  />
                </div>
                <div className="col-span-2">
                  <label className={lbl}>Defesa do Colaborador</label>
                  <textarea
                    name="defesa_colaborador"
                    rows={3}
                    placeholder="Registro da defesa apresentada pelo colaborador..."
                    className={cn(input, 'h-auto py-2 resize-none')}
                  />
                </div>
              </div>
            </div>

            {/* Hidden inputs para campos controlados */}
            <input type="hidden" name="natureza" value={natureza} />
            <input type="hidden" name="relato" value={relato} />

            {/* Ações */}
            <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
              <button
                type="button"
                onClick={handleClose}
                className="flex h-9 items-center rounded-lg border border-gray-200 px-4 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="flex h-9 items-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white transition-colors hover:bg-slate-700 disabled:opacity-50"
              >
                {isPending ? 'Salvando...' : 'Registrar Advertência'}
              </button>
            </div>

          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
