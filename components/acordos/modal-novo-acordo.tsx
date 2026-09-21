'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Calendar, Clock, FileText, MapPin, Users, XCircle } from 'lucide-react'
import { buscarFuncionariosPorPostos, criarAcordo } from '@/app/(admin)/acordos/actions'
import type { AcordoPostoItem, FuncionarioParaAcordo } from '@/app/(admin)/acordos/actions'
import { calendarioParaMapa, type CalendarioLinha } from '@/lib/calendario/mapa'
import { DIAS_SEMANA, type Achado, type FuncionarioCalc, type TemplateId } from '@/lib/acordos/tipos'
import { agruparPorJornada, resumoCalculo } from '@/lib/acordos/movimentos'
import { gerarObjeto, TEMPLATES } from '@/lib/acordos/templates'
import { temErro, validarAcordo } from '@/lib/acordos/validar'
import { assinaturaSemana, semanaParaTexto, totalSemanalMin } from '@/lib/acordos/horario-do-turno'
import { sugerirDiasAjuste } from '@/lib/acordos/dias'
import { fmtHorasTotal, hhmmParaMin, minParaHHMM } from '@/lib/acordos/tempo'
import { CamposTemplate, FORM_VAZIO, montarCampos, type FormState } from './campos-template'

const CORES_TURNO = [
  { borda: 'border-t-blue-500', fundo: 'bg-blue-50' },
  { borda: 'border-t-orange-500', fundo: 'bg-orange-50' },
  { borda: 'border-t-purple-500', fundo: 'bg-purple-50' },
  { borda: 'border-t-indigo-500', fundo: 'bg-indigo-50' },
  { borda: 'border-t-green-500', fundo: 'bg-green-50' },
]

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  ativo:    { label: 'Ativo',    cls: 'bg-green-100 text-green-700' },
  ferias:   { label: 'Férias',   cls: 'bg-orange-100 text-orange-700' },
  afastado: { label: 'Afastado', cls: 'bg-red-100 text-red-700' },
  atestado: { label: 'Atestado', cls: 'bg-amber-100 text-amber-700' },
  faltante: { label: 'Faltante', cls: 'bg-yellow-100 text-yellow-700' },
}

function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 border-b border-slate-100 pb-1">
      <div className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-900">
        <Icon className="h-3.5 w-3.5 text-white" />
      </div>
      <span className="text-xs font-bold uppercase tracking-widest text-slate-700">{title}</span>
    </div>
  )
}

interface Props {
  postos: AcordoPostoItem[]
  calendario: CalendarioLinha[]
  onClose: () => void
}

export function ModalNovoAcordo({ postos, calendario, onClose }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const [titulo, setTitulo] = useState('')
  const [tipo, setTipo] = useState<'individual' | 'coletivo'>('individual')
  const [postosSel, setPostosSel] = useState<string[]>([])
  const [dataDoc, setDataDoc] = useState(new Date().toLocaleDateString('sv-SE'))
  const [template, setTemplate] = useState<TemplateId>('T3')
  const [f, setF] = useState<FormState>(FORM_VAZIO)
  const [funcs, setFuncs] = useState<FuncionarioParaAcordo[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [loadingFuncs, setLoadingFuncs] = useState(false)
  const [erro, setErro] = useState('')
  const [diasManual, setDiasManual] = useState(false)
  const [hoje] = useState(() => new Date().toLocaleDateString('sv-SE'))

  const set = useCallback(<K extends keyof FormState>(k: K, v: FormState[K]) => {
    setF(prev => ({ ...prev, [k]: v }))
  }, [])

  function trocarTemplate(id: TemplateId) {
    setTemplate(id)
    setDiasManual(false)
    set('datasAjuste', [])
  }

  // Carrega funcionários automaticamente ao escolher o(s) posto(s)
  useEffect(() => {
    let ativo = true
    if (postosSel.length === 0) {
      setFuncs([])
      setSelectedIds(new Set())
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
    setPostosSel(prev => (tipo === 'individual' ? [id] : prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]))
  }

  function toggleFunc(id: string) {
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
  const campos = useMemo(() => montarCampos(template, f), [template, f])
  const grupos = useMemo(() => agruparPorJornada(campos, calc), [campos, calc])

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

  const textos = useMemo(
    () => grupos.map(g => gerarObjeto(campos, resumoCalculo(campos, g))),
    [campos, grupos],
  )

  // Dias de ajuste sugeridos automaticamente enquanto o usuário não editar a lista à mão
  const sugestaoDias = useMemo(
    () => sugerirDiasAjuste({ ...campos, datasAjuste: [] }, calc, feriados, hoje),
    [campos, calc, feriados, hoje],
  )
  useEffect(() => {
    if (diasManual) return
    if (sugestaoDias.join('|') !== f.datasAjuste.join('|')) set('datasAjuste', sugestaoDias)
  }, [diasManual, sugestaoDias, f.datasAjuste, set])

  const turnos = useMemo(() => {
    const m = new Map<string, FuncionarioCalc[]>()
    for (const x of calc) {
      const k = assinaturaSemana(x.semana)
      m.set(k, [...(m.get(k) ?? []), x])
    }
    return Array.from(m.values())
  }, [calc])

  function handleSalvar() {
    if (!titulo.trim()) { setErro('Informe o título do acordo.'); return }
    if (!postosSel.length) { setErro('Selecione ao menos um posto.'); return }
    if (temErro(achados)) { setErro('Corrija os itens em vermelho antes de salvar.'); return }
    setErro('')
    startTransition(async () => {
      const postosObj = postos.filter(p => postosSel.includes(p.id))
      const res = await criarAcordo({
        titulo: titulo.trim(),
        tipo,
        postos: postosObj,
        funcionarioIds: selecionados.map(x => x.id),
        data_documento: dataDoc,
        campos,
      })
      if ('error' in res) {
        setErro(res.error)
        return
      }
      router.refresh()
      onClose()
    })
  }

  function painelCompensar() {
    const periodo = (template === 'T1' || template === 'T5') && f.dataEvento && f.periodoInicio && f.periodoFim
      ? hhmmParaMin(f.periodoFim) - hhmmParaMin(f.periodoInicio)
      : 0
    return (
      <div className="space-y-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-700">
        <p className="font-bold uppercase tracking-widest text-slate-500">A compensar</p>
        {grupos.map((g, gi) => {
          const r = resumoCalculo(campos, g)
          return (
            <div key={gi}>
              <p>
                <span className="font-semibold">Grupo {gi + 1} ({g.length} func.)</span> — a compensar:{' '}
                <span className="font-semibold">{fmtHorasTotal(r.horasTotalMin)}</span> por funcionário
              </p>
              {periodo > 0 && (
                <p className="text-slate-500">
                  Período de {f.periodoInicio} às {f.periodoFim}: {fmtHorasTotal(Math.max(0, periodo - r.horasTotalMin))} dentro do horário normal,{' '}
                  {fmtHorasTotal(r.horasTotalMin)} fora (a compensar)
                </p>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  const inputCls = 'w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300'
  const labelCls = 'mb-2 block text-xs font-bold uppercase tracking-widest text-slate-500'

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overflow-x-hidden bg-black/50 px-4 py-8">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
        <div className="rounded-t-2xl bg-slate-900 px-6 py-5">
          <h2 className="text-base font-bold text-white">Novo Acordo de Compensação</h2>
          <p className="mt-0.5 text-xs text-slate-400">O texto é gerado a partir dos campos; o PDF sai após salvar</p>
        </div>

        <div className="space-y-6 px-6 py-6">
          <div>
            <label className={labelCls}>Título do Acordo</label>
            <input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="ex: Emenda 05/06 — Junho 2026" className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>Abrangência</label>
            <div className="flex gap-3">
              {([['individual', 'Individual', 'Uma unidade'], ['coletivo', 'Coletivo', 'Múltiplas unidades']] as const).map(([val, nome, sub]) => (
                <label key={val} className={`flex flex-1 cursor-pointer items-center gap-3 rounded-xl border-2 px-4 py-3 ${tipo === val ? 'border-slate-900 bg-slate-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <input type="radio" checked={tipo === val} onChange={() => { setTipo(val); setPostosSel([]) }} className="accent-slate-900" />
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{nome}</p>
                    <p className="text-xs text-gray-400">{sub}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className={labelCls}>Situação</label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {(Object.keys(TEMPLATES) as TemplateId[]).map(id => (
                <label key={id} className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 px-3 py-2.5 ${template === id ? 'border-slate-900 bg-slate-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <input type="radio" checked={template === id} onChange={() => trocarTemplate(id)} className="mt-1 accent-slate-900" />
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{TEMPLATES[id].titulo}</p>
                    <p className="text-xs text-gray-400">{TEMPLATES[id].resumo}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div>
            <SectionHeader icon={MapPin} title="Posto(s)" />
            <div className="mt-3 max-h-40 divide-y divide-gray-50 overflow-y-auto rounded-xl border border-gray-200">
              {postos.filter(p => !p.nome.startsWith('AFASTADO')).map(p => (
                <label key={p.id} className="flex cursor-pointer items-center gap-3 px-4 py-2.5 hover:bg-slate-50">
                  <input
                    type={tipo === 'individual' ? 'radio' : 'checkbox'}
                    checked={postosSel.includes(p.id)}
                    onChange={() => togglePosto(p.id)}
                    className="shrink-0 accent-slate-900"
                  />
                  <span className="text-sm text-gray-800">{p.nome}</span>
                  {p.secretaria && <span className="ml-auto shrink-0 text-xs text-gray-400">{p.secretaria}</span>}
                </label>
              ))}
            </div>
          </div>

          <div>
            <SectionHeader icon={Users} title="Funcionários" />
            <div className="mt-3">
              {postosSel.length === 0 && <p className="text-sm text-gray-400">Selecione um posto acima.</p>}
              {loadingFuncs && <p className="text-sm text-gray-400">Carregando…</p>}
              {funcs.length > 0 && (
                <div className="overflow-hidden rounded-xl border border-gray-200">
                  <div className="bg-gray-50 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-gray-400">
                    {selectedIds.size} de {funcs.length} selecionados
                  </div>
                  <div className="max-h-56 divide-y divide-gray-50 overflow-y-auto">
                    {funcs.map(x => {
                      const badge = STATUS_BADGE[x.status]
                      return (
                        <label key={x.id} className={`flex items-center gap-3 px-4 py-2.5 ${x.elegivel ? 'cursor-pointer hover:bg-slate-50' : 'bg-gray-50 opacity-60'}`}>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(x.id)}
                            disabled={!x.elegivel}
                            onChange={() => toggleFunc(x.id)}
                            className="shrink-0 accent-slate-900"
                          />
                          <span className="flex-1 text-sm text-gray-800">
                            {x.nome}
                            {!x.elegivel && <span className="block text-xs text-red-600">{x.motivo_inelegivel}</span>}
                            {x.elegivel && x.sem_turno && <span className="block text-xs text-amber-700">Sem horário cadastrado — usando o padrão 5x2 de 44h</span>}
                          </span>
                          {x.funcao && <span className="shrink-0 text-xs text-gray-400">{x.funcao}</span>}
                          {badge && <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-xs font-medium ${badge.cls}`}>{badge.label}</span>}
                        </label>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div>
            <SectionHeader icon={FileText} title="Dados do acordo" />
            <div className="mt-3">
              <CamposTemplate
                template={template}
                f={f}
                set={set}
                feriados={feriados}
                diasManual={diasManual}
                onDatasManuais={() => setDiasManual(true)}
                onRecalcular={() => setDiasManual(false)}
              />
            </div>
          </div>

          {grupos.some(g => resumoCalculo(campos, g).horasTotalMin > 0) && painelCompensar()}

          {turnos.length > 0 && (
            <div>
              <SectionHeader icon={Clock} title="Horário (do turno cadastrado)" />
              <div className="mt-3 space-y-3">
                {turnos.map((fs, ti) => {
                  const s = fs[0].semana
                  const txt = semanaParaTexto(s)
                  const cor = CORES_TURNO[ti % CORES_TURNO.length]
                  return (
                    <div key={ti} className={`overflow-hidden rounded-xl border border-t-4 border-gray-200 ${cor.borda}`}>
                      <div className={`flex items-center justify-between px-4 py-2 text-xs font-bold uppercase tracking-widest text-slate-600 ${cor.fundo}`}>
                        <span>Turno {ti + 1} · {fs.length} funcionário(s)</span>
                        <span className="font-normal text-gray-500">{minParaHHMM(totalSemanalMin(s))}h/semana</span>
                      </div>
                      {DIAS_SEMANA.map(d => (
                        <div key={d} className="flex gap-3 border-t border-gray-100 px-4 py-1.5 text-xs">
                          <span className="w-28 shrink-0 font-semibold text-slate-600">{d}</span>
                          <span className={txt[d] === 'FOLGA' ? 'font-bold uppercase text-gray-400' : 'font-mono text-gray-700'}>{txt[d]}</span>
                        </div>
                      ))}
                      <details className="border-t border-gray-100 px-4 py-1.5 text-xs">
                        <summary className="cursor-pointer font-semibold text-slate-600">Ver funcionários</summary>
                        <ul className="mt-1 space-y-0.5 text-gray-700">
                          {fs.map(x => <li key={x.id}>{x.nome}</li>)}
                        </ul>
                      </details>
                    </div>
                  )
                })}
                {grupos.length > 1 && (
                  <p className="text-xs text-amber-700">
                    Será gerado um único acordo com {grupos.length} grupos de compensação (jornadas ou horários diferentes por turno).
                  </p>
                )}
              </div>
            </div>
          )}

          {achados.length > 0 && (
            <div className="space-y-1.5">
              {achados.map((a, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-sm ${a.nivel === 'erro' ? 'border-red-100 bg-red-50 text-red-700' : 'border-amber-100 bg-amber-50 text-amber-800'}`}
                >
                  {a.nivel === 'erro' ? <XCircle className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
                  <span>{a.mensagem}</span>
                </div>
              ))}
            </div>
          )}

          <div>
            <SectionHeader icon={FileText} title="Texto do acordo (gerado)" />
            <div className="mt-3 space-y-2 rounded-xl bg-slate-900 px-4 py-3">
              {(textos.length ? textos : [null]).map((texto, i) => (
                <div key={i}>
                  {textos.length > 1 && (
                    <p className="mb-0.5 font-sans text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      Grupo {i + 1} · {grupos[i].length} func.
                    </p>
                  )}
                  <p className="font-mono text-[11px] leading-relaxed text-slate-300">
                    <span className="text-slate-500">…com a finalidade de que os funcionários </span>
                    {texto?.ok && !temErro(achados)
                      ? <span className="text-amber-300">{texto.texto}</span>
                      : <span className="italic text-slate-500">{temErro(achados) ? 'Corrija os itens em vermelho para gerar o texto' : 'preencha os dados acima para gerar o texto'}</span>}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <SectionHeader icon={Calendar} title="Data do Documento" />
            <input type="date" value={dataDoc} onChange={e => setDataDoc(e.target.value)} className={`mt-3 ${inputCls}`} />
          </div>

          {erro && <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">{erro}</div>}
        </div>

        <div className="flex justify-end gap-2 rounded-b-2xl border-t border-gray-100 bg-gray-50 px-6 py-4">
          <button onClick={onClose} className="flex h-9 items-center rounded-lg border border-gray-200 bg-white px-4 text-sm font-medium text-gray-600 hover:bg-gray-100">
            Cancelar
          </button>
          <button
            onClick={handleSalvar}
            disabled={pending || temErro(achados)}
            title={temErro(achados) ? 'Corrija os itens em vermelho' : undefined}
            className="flex h-9 items-center rounded-lg bg-slate-900 px-6 text-sm font-bold text-white hover:bg-slate-700 disabled:opacity-40"
          >
            {pending ? 'Salvando…' : 'Salvar Acordo'}
          </button>
        </div>
      </div>
    </div>
  )
}
