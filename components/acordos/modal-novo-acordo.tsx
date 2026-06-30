'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Clock, MapPin, Users, FileText, Calendar, Plus, Trash2 } from 'lucide-react'
import {
  criarAcordo,
  buscarFuncionariosPorPostos,
} from '@/app/(admin)/acordos/actions'
import type { AcordoPostoItem, AcordoFuncionarioItem, TurnoHorario } from '@/app/(admin)/acordos/actions'

const DIAS = ['Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado','Domingo']

const HORARIOS: string[] = []
for (let h = 5; h <= 23; h++) {
  for (let m = 0; m < 60; m += 12) {
    if (h === 23 && m > 0) break
    HORARIOS.push(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`)
  }
}

function TimeSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-slate-300"
    >
      <option value="">--:--</option>
      {HORARIOS.map(h => <option key={h} value={h}>{h}</option>)}
    </select>
  )
}

interface DiaTimes { folga: boolean; e1: string; s1: string; e2: string; s2: string }

const DEFAULT_TIMES: Record<string, DiaTimes> = {
  'Segunda-feira': { folga: false, e1: '07:00', s1: '12:00', e2: '13:12', s2: '17:00' },
  'Terça-feira':   { folga: false, e1: '07:00', s1: '12:00', e2: '13:12', s2: '17:00' },
  'Quarta-feira':  { folga: false, e1: '07:00', s1: '12:00', e2: '13:12', s2: '17:00' },
  'Quinta-feira':  { folga: false, e1: '07:00', s1: '12:00', e2: '13:12', s2: '17:00' },
  'Sexta-feira':   { folga: false, e1: '07:00', s1: '12:00', e2: '13:12', s2: '17:00' },
  'Sábado':        { folga: true,  e1: '',      s1: '',      e2: '',      s2: ''      },
  'Domingo':       { folga: true,  e1: '',      s1: '',      e2: '',      s2: ''      },
}

function makeDefaultTimes(): Record<string, DiaTimes> {
  return Object.fromEntries(Object.entries(DEFAULT_TIMES).map(([k, v]) => [k, { ...v }]))
}

const MODELOS = {
  extra: `trabalharem no dia [DATA DO EVENTO] ([NOME DO EVENTO]), com acréscimo de [HH:MM] hora diária no horário normal nos dias [DATA COMP. 1], [DATA COMP. 2] e [DATA COMP. 3], compensando assim [X] hora(s) laborada(s) no referido evento.`,
  dispensa: `trabalharem normalmente até as [HORA NORMAL]h no dia [DATA DO EVENTO] ([NOME DO EVENTO]), sendo dispensados às [HORA DISPENSA]h conforme decreto municipal, compensando as [X] horas não laboradas com acréscimo de [HH:MM]h diária no horário normal nos dias [DATA COMP. 1], [DATA COMP. 2] e [DATA COMP. 3].`,
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  ativo:     { label: 'Ativo',     cls: 'bg-green-100 text-green-700' },
  ferias:    { label: 'Férias',    cls: 'bg-orange-100 text-orange-700' },
  afastado:  { label: 'Afastado', cls: 'bg-red-100 text-red-700' },
  atestado:  { label: 'Atestado', cls: 'bg-amber-100 text-amber-700' },
  faltante:  { label: 'Faltante', cls: 'bg-yellow-100 text-yellow-700' },
}

function minutosEntre(a: string, b: string): number {
  if (!a || !b) return 0
  const [ah, am] = a.split(':').map(Number)
  const [bh, bm] = b.split(':').map(Number)
  return Math.max(0, (bh * 60 + bm) - (ah * 60 + am))
}

function calcTotalSemanal(times: Record<string, DiaTimes>): string {
  let total = 0
  for (const dia of DIAS) {
    const t = times[dia]
    if (!t || t.folga) continue
    total += minutosEntre(t.e1, t.s1) + minutosEntre(t.e2, t.s2)
  }
  const h = Math.floor(total / 60)
  const m = total % 60
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2,'0')}min`
}

function timesToString(t: DiaTimes): string {
  if (t.folga) return 'FOLGA'
  const p1 = t.e1 && t.s1 ? `${t.e1} às ${t.s1}` : ''
  const p2 = t.e2 && t.s2 ? `${t.e2} às ${t.s2}` : ''
  return [p1, p2].filter(Boolean).join(' / ')
}

interface TurnoState {
  id: string
  label: string
  times: Record<string, DiaTimes>
}

let turnoCounter = 1
function newTurnoId() { return `turno-${turnoCounter++}` }

function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 pb-1 border-b border-slate-100">
      <div className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-900">
        <Icon className="h-3.5 w-3.5 text-white" />
      </div>
      <span className="text-xs font-bold uppercase tracking-widest text-slate-700">{title}</span>
    </div>
  )
}

interface Props {
  postos: AcordoPostoItem[]
  onClose: () => void
}

export function ModalNovoAcordo({ postos, onClose }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const [titulo, setTitulo]         = useState('')
  const [tipo, setTipo]             = useState<'individual' | 'coletivo'>('individual')
  const [postosSel, setPostosSel]   = useState<string[]>([])
  const [descricao, setDescricao]   = useState('')
  const [dataDoc, setDataDoc]       = useState(new Date().toISOString().split('T')[0])
  const [erro, setErro]             = useState('')

  // Funcionários — lista completa + seleção individual + turno assignment
  const [allFuncs, setAllFuncs]         = useState<AcordoFuncionarioItem[]>([])
  const [selectedIds, setSelectedIds]   = useState<Set<string>>(new Set())
  const [funcTurno, setFuncTurno]       = useState<Record<string, string>>({})  // funcId → turnoId
  const [loadingFuncs, setLoadingFuncs] = useState(false)

  // Turnos
  const firstId = 'turno-0'
  const [turnos, setTurnos] = useState<TurnoState[]>([
    { id: firstId, label: 'Turno Único', times: makeDefaultTimes() }
  ])

  const multiTurno = turnos.length > 1

  // ── Postos ───────────────────────────────────────────────────────────────────
  function togglePosto(id: string) {
    setPostosSel(prev =>
      tipo === 'individual' ? [id] : prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
    setAllFuncs([])
    setSelectedIds(new Set())
    setFuncTurno({})
  }

  // ── Funcionários ─────────────────────────────────────────────────────────────
  async function carregarFuncionarios() {
    if (!postosSel.length) return
    setLoadingFuncs(true)
    const funcs = await buscarFuncionariosPorPostos(postosSel)
    setAllFuncs(funcs)
    // Auto-selecionar ativos e em férias; desmarcar afastados/atestado/faltante
    const autoSelect = new Set(funcs.filter(f => f.status === 'ativo' || f.status === 'ferias').map(f => f.id))
    setSelectedIds(autoSelect)
    // Todos no primeiro turno por padrão
    const turnoMap: Record<string, string> = {}
    funcs.forEach(f => { turnoMap[f.id] = firstId })
    setFuncTurno(turnoMap)
    setLoadingFuncs(false)
  }

  function toggleFunc(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else { next.add(id) }
      return next
    })
  }

  function setFuncTurnoId(funcId: string, turnoId: string) {
    setFuncTurno(prev => ({ ...prev, [funcId]: turnoId }))
  }

  // ── Turnos ───────────────────────────────────────────────────────────────────
  function addTurno() {
    const id = newTurnoId()
    setTurnos(prev => {
      const updated = prev.map((t, i) => i === 0 && t.label === 'Turno Único' ? { ...t, label: 'Turno A' } : t)
      return [...updated, { id, label: `Turno ${String.fromCharCode(65 + prev.length)}`, times: makeDefaultTimes() }]
    })
  }

  function removeTurno(id: string) {
    setTurnos(prev => {
      const remaining = prev.filter(t => t.id !== id)
      if (remaining.length === 1) remaining[0] = { ...remaining[0], label: 'Turno Único' }
      return remaining
    })
    // Reassign employees from removed turno to first remaining
    setFuncTurno(prev => {
      const firstRemaining = turnos.find(t => t.id !== id)?.id ?? firstId
      return Object.fromEntries(
        Object.entries(prev).map(([fid, tid]) => [fid, tid === id ? firstRemaining : tid])
      )
    })
  }

  function updateTurnoLabel(id: string, label: string) {
    setTurnos(prev => prev.map(t => t.id === id ? { ...t, label } : t))
  }

  function updateTime(turnoId: string, dia: string, field: keyof DiaTimes, value: string | boolean) {
    setTurnos(prev => prev.map(t =>
      t.id === turnoId ? { ...t, times: { ...t.times, [dia]: { ...t.times[dia], [field]: value } } } : t
    ))
  }

  // ── Salvar ───────────────────────────────────────────────────────────────────
  function handleSalvar() {
    if (!titulo.trim())          { setErro('Informe o título do acordo.'); return }
    if (!postosSel.length)       { setErro('Selecione ao menos um posto.'); return }
    if (!allFuncs.length)        { setErro('Carregue os funcionários antes de salvar.'); return }
    if (selectedIds.size === 0)  { setErro('Selecione ao menos um funcionário.'); return }
    if (!descricao.trim())       { setErro('Descreva o evento e os termos de compensação.'); return }

    setErro('')

    const selectedFuncs = allFuncs.filter(f => selectedIds.has(f.id))

    const horarios: TurnoHorario[] = turnos.map(t => ({
      label: t.label,
      horario: Object.fromEntries(DIAS.map(dia => [dia, timesToString(t.times[dia])])),
      funcionario_ids: selectedFuncs
        .filter(f => (funcTurno[f.id] ?? firstId) === t.id)
        .map(f => f.id),
    })).filter(t => t.funcionario_ids.length > 0)

    if (!horarios.length) { setErro('Nenhum funcionário foi atribuído a um turno.'); return }

    startTransition(async () => {
      const postosObj = postos.filter(p => postosSel.includes(p.id))
      const res = await criarAcordo({
        titulo: titulo.trim(),
        tipo,
        postos: postosObj,
        funcionarios: selectedFuncs,
        horarios,
        descricao_acordo: descricao.trim(),
        data_documento: dataDoc,
      })
      if ('error' in res) { setErro(res.error); return }
      router.refresh()
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 overflow-y-auto py-8 px-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl">

        <div className="rounded-t-2xl bg-slate-900 px-6 py-5">
          <h2 className="text-base font-bold text-white">Novo Acordo de Compensação</h2>
          <p className="mt-0.5 text-xs text-slate-400">O PDF com o texto jurídico completo é gerado após salvar</p>
        </div>

        <div className="space-y-6 px-6 py-6">

          {/* Título */}
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-500">Título do Acordo</label>
            <input
              value={titulo}
              onChange={e => setTitulo(e.target.value)}
              placeholder="ex: Festa Junina — Junho 2026"
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
          </div>

          {/* Tipo */}
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-slate-500">Abrangência</label>
            <div className="flex gap-3">
              {([['individual','Individual','Uma unidade'], ['coletivo','Coletivo','Múltiplas unidades']] as const).map(([val, label, sub]) => (
                <label key={val} className={`flex flex-1 cursor-pointer items-center gap-3 rounded-xl border-2 px-4 py-3 transition-colors ${
                  tipo === val ? 'border-slate-900 bg-slate-50' : 'border-gray-200 hover:border-gray-300'
                }`}>
                  <input type="radio" checked={tipo === val} onChange={() => { setTipo(val); setPostosSel([]); setAllFuncs([]); setSelectedIds(new Set()); setFuncTurno({}) }} className="accent-slate-900" />
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{label}</p>
                    <p className="text-xs text-gray-400">{sub}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Postos */}
          <div>
            <SectionHeader icon={MapPin} title="Posto(s)" />
            <div className="mt-3 max-h-40 overflow-y-auto rounded-xl border border-gray-200 divide-y divide-gray-50">
              {postos.filter(p => !p.nome.startsWith('AFASTADO')).map(p => (
                <label key={p.id} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-slate-50">
                  <input
                    type={tipo === 'individual' ? 'radio' : 'checkbox'}
                    checked={postosSel.includes(p.id)}
                    onChange={() => togglePosto(p.id)}
                    className="accent-slate-900 shrink-0"
                  />
                  <span className="text-sm text-gray-800">{p.nome}</span>
                  {p.secretaria && <span className="ml-auto text-xs text-gray-400 shrink-0">{p.secretaria}</span>}
                </label>
              ))}
            </div>
          </div>

          {/* Funcionários */}
          <div>
            <SectionHeader icon={Users} title="Funcionários" />
            <div className="mt-3 space-y-3">
              <button
                type="button"
                disabled={!postosSel.length || loadingFuncs}
                onClick={carregarFuncionarios}
                className="flex h-9 items-center gap-2 rounded-lg border-2 border-dashed border-slate-300 px-4 text-sm font-medium text-slate-600 hover:border-slate-500 hover:bg-slate-50 disabled:opacity-40 transition-colors"
              >
                <Users className="h-4 w-4" />
                {loadingFuncs ? 'Carregando…' : postosSel.length ? `Carregar funcionários (${postosSel.length} posto${postosSel.length > 1 ? 's' : ''})` : 'Selecione um posto acima'}
              </button>

              {allFuncs.length > 0 && (
                <div className="rounded-xl border border-gray-200 overflow-hidden">
                  <div className="bg-gray-50 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-gray-400 flex items-center justify-between">
                    <span>{selectedIds.size} de {allFuncs.length} selecionados</span>
                    {multiTurno && <span className="text-gray-400">Turno</span>}
                  </div>
                  <div className="divide-y divide-gray-50 max-h-56 overflow-y-auto">
                    {allFuncs.map(f => {
                      const badge = STATUS_BADGE[f.status]
                      return (
                        <label key={f.id} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-slate-50">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(f.id)}
                            onChange={() => toggleFunc(f.id)}
                            className="accent-slate-900 shrink-0"
                          />
                          <span className="flex-1 text-sm text-gray-800">{f.nome}</span>
                          {f.funcao && <span className="text-xs text-gray-400 shrink-0">{f.funcao}</span>}
                          {badge && (
                            <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full shrink-0 ${badge.cls}`}>
                              {badge.label}
                            </span>
                          )}
                          {multiTurno && selectedIds.has(f.id) && (
                            <select
                              value={funcTurno[f.id] ?? firstId}
                              onChange={e => { e.stopPropagation(); setFuncTurnoId(f.id, e.target.value) }}
                              onClick={e => e.stopPropagation()}
                              className="ml-1 rounded border border-gray-200 text-xs px-1 py-0.5 shrink-0"
                            >
                              {turnos.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                            </select>
                          )}
                        </label>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Horários por turno */}
          <div>
            <div className="flex items-center justify-between pb-1 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-900">
                  <Clock className="h-3.5 w-3.5 text-white" />
                </div>
                <span className="text-xs font-bold uppercase tracking-widest text-slate-700">Horário Semanal</span>
              </div>
              <button
                type="button"
                onClick={addTurno}
                className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" /> Adicionar turno
              </button>
            </div>

            <div className="mt-3 space-y-4">
              {turnos.map((turno, ti) => (
                <div key={turno.id} className="rounded-xl border border-gray-200 overflow-hidden">
                  {/* Turno header */}
                  <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 border-b border-gray-200">
                    {multiTurno ? (
                      <input
                        value={turno.label}
                        onChange={e => updateTurnoLabel(turno.id, e.target.value)}
                        className="flex-1 bg-transparent text-xs font-bold uppercase tracking-widest text-slate-600 focus:outline-none"
                      />
                    ) : (
                      <span className="flex-1 text-xs font-bold uppercase tracking-widest text-slate-600">{turno.label}</span>
                    )}
                    <span className="text-xs text-gray-400">{calcTotalSemanal(turno.times)} {calcTotalSemanal(turno.times) === '44h' ? '✓' : '≠ 44h'}</span>
                    {multiTurno && ti > 0 && (
                      <button type="button" onClick={() => removeTurno(turno.id)} className="text-gray-400 hover:text-red-500">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Schedule rows */}
                  {DIAS.map((dia, i) => {
                    const t = turno.times[dia]
                    const isLast = i === DIAS.length - 1
                    return (
                      <div key={dia} className={`flex items-center gap-3 px-4 py-2.5 ${!isLast ? 'border-b border-gray-100' : ''} ${t.folga ? 'bg-gray-50' : ''}`}>
                        <span className="w-28 shrink-0 text-xs font-semibold text-slate-600">{dia}</span>
                        {t.folga ? (
                          <span className="flex-1 text-xs font-bold uppercase tracking-wider text-gray-400">Folga</span>
                        ) : (
                          <div className="flex flex-1 items-center gap-1.5 text-xs text-gray-600">
                            <TimeSelect value={t.e1} onChange={v => updateTime(turno.id, dia, 'e1', v)} />
                            <span className="text-gray-400">–</span>
                            <TimeSelect value={t.s1} onChange={v => updateTime(turno.id, dia, 's1', v)} />
                            <span className="mx-1 text-gray-300">/</span>
                            <TimeSelect value={t.e2} onChange={v => updateTime(turno.id, dia, 'e2', v)} />
                            <span className="text-gray-400">–</span>
                            <TimeSelect value={t.s2} onChange={v => updateTime(turno.id, dia, 's2', v)} />
                          </div>
                        )}
                        <label className="flex shrink-0 cursor-pointer items-center gap-1.5">
                          <input type="checkbox" checked={t.folga} onChange={e => updateTime(turno.id, dia, 'folga', e.target.checked)} className="accent-slate-900" />
                          <span className="text-xs text-gray-500">Folga</span>
                        </label>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Evento e compensação */}
          <div>
            <SectionHeader icon={FileText} title="Evento e Compensação" />
            <div className="mt-3 rounded-xl bg-slate-900 px-4 py-3">
              <p className="font-mono text-[11px] leading-relaxed text-slate-300">
                <span className="text-slate-500">…com a finalidade de que os funcionários </span>
                <span className="text-amber-400 italic">[seu texto aqui]</span>
              </p>
              <div className="mt-2 flex gap-2 flex-wrap">
                <button type="button" onClick={() => setDescricao(MODELOS.extra)}
                  className="rounded-md bg-slate-700 px-2.5 py-1 text-[11px] font-semibold text-slate-200 hover:bg-slate-600 transition-colors">
                  ✦ Evento trabalhado
                </button>
                <button type="button" onClick={() => setDescricao(MODELOS.dispensa)}
                  className="rounded-md bg-slate-700 px-2.5 py-1 text-[11px] font-semibold text-slate-200 hover:bg-slate-600 transition-colors">
                  ✦ Dispensa antecipada
                </button>
              </div>
            </div>
            <textarea
              value={descricao}
              onChange={e => setDescricao(e.target.value)}
              rows={4}
              placeholder="Clique em 'Usar modelo' acima ou escreva diretamente…"
              className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
          </div>

          {/* Data do documento */}
          <div>
            <SectionHeader icon={Calendar} title="Data do Documento" />
            <input
              type="date"
              value={dataDoc}
              onChange={e => setDataDoc(e.target.value)}
              className="mt-3 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
          </div>

          {erro && (
            <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">{erro}</div>
          )}
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
            {pending ? 'Salvando…' : 'Salvar Acordo'}
          </button>
        </div>
      </div>
    </div>
  )
}
