'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Calendar, Clock, FileText, MapPin, Users, XCircle } from 'lucide-react'
import { buscarFuncionariosPorPostos, criarAcordo } from '@/app/(admin)/acordos/actions'
import type { AcordoPostoItem, FuncionarioParaAcordo } from '@/app/(admin)/acordos/actions'
import { calendarioParaMapa, type CalendarioLinha } from '@/lib/calendario/mapa'
import { DIAS_SEMANA, type Achado, type FuncionarioCalc, type TemplateId } from '@/lib/acordos/tipos'
import { agruparPorJornada, resumoCalculo } from '@/lib/acordos/movimentos'
import { gerarObjeto, TEMPLATES } from '@/lib/acordos/templates'
import { temErro, validarAcordo } from '@/lib/acordos/validar'
import { jornadaDiaMin, semanaParaTexto, totalSemanalMin } from '@/lib/acordos/horario-do-turno'
import { proximosDiasUteis, sugerirQuantidadeDias } from '@/lib/acordos/dias'
import { MAX_ACRESCIMO_DIA_MIN, MAX_JORNADA_DIA_MIN } from '@/lib/acordos/regras'
import { minParaHHMM } from '@/lib/acordos/tempo'
import { CamposTemplate, FORM_VAZIO, montarCampos, type FormState } from './campos-template'

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

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setF(prev => ({ ...prev, [k]: v }))
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

  const texto = useMemo(
    () => (grupos.length ? gerarObjeto(campos, resumoCalculo(campos, grupos[0])) : null),
    [campos, grupos],
  )

  function sugerirDias() {
    if (!calc.length) { setErro('Selecione os funcionários antes de sugerir os dias.'); return }
    const r = resumoCalculo(campos, grupos[0] ?? calc)
    const jornadaMax = Math.max(...calc.flatMap(x => DIAS_SEMANA.map(d => jornadaDiaMin(x.semana[d]))))
    const maxPorDia = template === 'T1' ? 60 : Math.min(MAX_ACRESCIMO_DIA_MIN, MAX_JORNADA_DIA_MIN - jornadaMax)
    const n = sugerirQuantidadeDias(r.horasTotalMin, maxPorDia)
    const base = template === 'T3' ? f.dataFolga : f.dataEvento
    if (!n || !base || r.horasTotalMin <= 0) {
      setErro('Preencha a data e as horas antes de sugerir os dias (ou não existe divisão possível).')
      return
    }
    setErro('')
    set('datasAjuste', proximosDiasUteis(base, n, calc, feriados))
  }

  function handleSalvar() {
    if (!titulo.trim()) { setErro('Informe o título do acordo.'); return }
    if (!postosSel.length) { setErro('Selecione ao menos um posto.'); return }
    if (temErro(achados)) { setErro('Corrija os itens em vermelho antes de salvar.'); return }
    setErro('')
    startTransition(async () => {
      const postosObj = postos.filter(p => postosSel.includes(p.id))
      for (let i = 0; i < grupos.length; i++) {
        const res = await criarAcordo({
          titulo: grupos.length > 1 ? `${titulo.trim()} — grupo ${i + 1}` : titulo.trim(),
          tipo,
          postos: postosObj,
          funcionarioIds: grupos[i].map(x => x.id),
          data_documento: dataDoc,
          campos,
        })
        if ('error' in res) {
          setErro(grupos.length > 1 ? `Grupo ${i + 1}: ${res.error}` : res.error)
          router.refresh()
          return
        }
      }
      router.refresh()
      onClose()
    })
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
                  <input type="radio" checked={template === id} onChange={() => setTemplate(id)} className="mt-1 accent-slate-900" />
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
                onSugerirDias={template === 'T4' || template === 'T5' ? null : sugerirDias}
              />
            </div>
          </div>

          {grupos.length > 0 && (
            <div>
              <SectionHeader icon={Clock} title="Horário (do turno cadastrado)" />
              <div className="mt-3 space-y-3">
                {grupos.map((g, gi) => {
                  const s = g[0].semana
                  const txt = semanaParaTexto(s)
                  return (
                    <div key={gi} className="overflow-hidden rounded-xl border border-gray-200">
                      <div className="flex items-center justify-between bg-slate-50 px-4 py-2 text-xs font-bold uppercase tracking-widest text-slate-600">
                        <span>{grupos.length > 1 ? `Grupo ${gi + 1} · ` : ''}{g.length} funcionário(s)</span>
                        <span className="font-normal text-gray-400">{minParaHHMM(totalSemanalMin(s))}h/semana · ref. {g[0].nome}</span>
                      </div>
                      {DIAS_SEMANA.map(d => (
                        <div key={d} className="flex gap-3 border-t border-gray-100 px-4 py-1.5 text-xs">
                          <span className="w-28 shrink-0 font-semibold text-slate-600">{d}</span>
                          <span className={txt[d] === 'FOLGA' ? 'font-bold uppercase text-gray-400' : 'font-mono text-gray-700'}>{txt[d]}</span>
                        </div>
                      ))}
                    </div>
                  )
                })}
                {grupos.length > 1 && (
                  <p className="text-xs text-amber-700">
                    Os funcionários têm jornadas diferentes nesse dia: serão gerados {grupos.length} acordos, um por grupo.
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
            <div className="mt-3 rounded-xl bg-slate-900 px-4 py-3">
              <p className="font-mono text-[11px] leading-relaxed text-slate-300">
                <span className="text-slate-500">…com a finalidade de que os funcionários </span>
                {texto?.ok
                  ? <span className="text-amber-300">{texto.texto}</span>
                  : <span className="italic text-slate-500">preencha os dados acima para gerar o texto</span>}
              </p>
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
            disabled={pending}
            className="flex h-9 items-center rounded-lg bg-slate-900 px-6 text-sm font-bold text-white hover:bg-slate-700 disabled:opacity-40"
          >
            {pending ? 'Salvando…' : grupos.length > 1 ? `Salvar ${grupos.length} acordos` : 'Salvar Acordo'}
          </button>
        </div>
      </div>
    </div>
  )
}
