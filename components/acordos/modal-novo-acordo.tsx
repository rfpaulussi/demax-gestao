'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Clock, MapPin, Users, FileText, Calendar } from 'lucide-react'
import {
  criarAcordo,
  buscarFuncionariosPorPostos,
} from '@/app/(admin)/acordos/actions'
import type { AcordoPostoItem, AcordoFuncionarioItem, HorarioSemana } from '@/app/(admin)/acordos/actions'

const DIAS = ['Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado','Domingo']

interface DiaTimes { folga: boolean; e1: string; s1: string; e2: string; s2: string }

function abreviarNome(nome: string): string {
  const partes = nome.trim().split(/\s+/).map(p => p.charAt(0) + p.slice(1).toLowerCase())
  if (partes.length <= 2) return partes.join(' ')
  return `${partes[0]} ${partes.slice(1, -1).map(p => p[0] + '.').join(' ')} ${partes[partes.length - 1]}`
}

const MODELO_TEXTO = `trabalhem no dia [DATA DO EVENTO], referente a [NOME DO EVENTO], com acréscimo de [HH:MM] hora diária no horário normal nos dias [DATA 1] e [DATA 2], compensando assim [X] hora(s) laborada(s) no referido evento.`

const DEFAULT_TIMES: Record<string, DiaTimes> = {
  'Segunda-feira': { folga: false, e1: '08:00', s1: '12:00', e2: '13:30', s2: '18:00' },
  'Terça-feira':   { folga: false, e1: '08:00', s1: '12:00', e2: '13:30', s2: '18:00' },
  'Quarta-feira':  { folga: false, e1: '08:00', s1: '12:00', e2: '13:30', s2: '18:00' },
  'Quinta-feira':  { folga: false, e1: '08:00', s1: '12:00', e2: '13:30', s2: '18:00' },
  'Sexta-feira':   { folga: false, e1: '08:00', s1: '12:00', e2: '13:30', s2: '18:00' },
  'Sábado':        { folga: true,  e1: '',      s1: '',      e2: '',      s2: ''      },
  'Domingo':       { folga: true,  e1: '',      s1: '',      e2: '',      s2: ''      },
}

function timesToString(t: DiaTimes): string {
  if (t.folga) return 'FOLGA'
  const p1 = t.e1 && t.s1 ? `${t.e1} às ${t.s1}` : ''
  const p2 = t.e2 && t.s2 ? `${t.e2} às ${t.s2}` : ''
  return [p1, p2].filter(Boolean).join(' / ')
}

interface Props {
  postos: AcordoPostoItem[]
  onClose: () => void
}

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

export function ModalNovoAcordo({ postos, onClose }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const [titulo, setTitulo]             = useState('')
  const [tipo, setTipo]                 = useState<'individual' | 'coletivo'>('individual')
  const [postosSel, setPostosSel]       = useState<string[]>([])
  const [funcionarios, setFuncionarios] = useState<AcordoFuncionarioItem[]>([])
  const [loadingFuncs, setLoadingFuncs] = useState(false)
  const [times, setTimes]               = useState<Record<string, DiaTimes>>({ ...DEFAULT_TIMES })
  const [descricao, setDescricao]       = useState('')
  const [dataDoc, setDataDoc]           = useState(new Date().toISOString().split('T')[0])
  const [erro, setErro]                 = useState('')

  function updateTime(dia: string, field: keyof DiaTimes, value: string | boolean) {
    setTimes(prev => ({ ...prev, [dia]: { ...prev[dia], [field]: value } }))
  }

  async function carregarFuncionarios() {
    if (!postosSel.length) return
    setLoadingFuncs(true)
    const funcs = await buscarFuncionariosPorPostos(postosSel)
    setFuncionarios(funcs)
    setLoadingFuncs(false)
  }

  function togglePosto(id: string) {
    setPostosSel(prev =>
      tipo === 'individual' ? [id] : prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
    setFuncionarios([])
  }

  function handleSalvar() {
    if (!titulo.trim())       { setErro('Informe o título do acordo.'); return }
    if (!postosSel.length)    { setErro('Selecione ao menos um posto.'); return }
    if (!funcionarios.length) { setErro('Carregue os funcionários antes de salvar.'); return }
    if (!descricao.trim())    { setErro('Descreva o evento e os termos de compensação.'); return }

    setErro('')
    const horario_semana: HorarioSemana = {}
    for (const dia of DIAS) horario_semana[dia] = timesToString(times[dia])

    startTransition(async () => {
      const postosObj = postos.filter(p => postosSel.includes(p.id))
      const res = await criarAcordo({
        titulo: titulo.trim(),
        tipo,
        postos: postosObj,
        funcionarios,
        horario_semana,
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

        {/* Header colorido */}
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
                  <input type="radio" checked={tipo === val} onChange={() => { setTipo(val); setPostosSel([]); setFuncionarios([]) }} className="accent-slate-900" />
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
            <div className="mt-3">
              <button
                type="button"
                disabled={!postosSel.length || loadingFuncs}
                onClick={carregarFuncionarios}
                className="flex h-9 items-center gap-2 rounded-lg border-2 border-dashed border-slate-300 px-4 text-sm font-medium text-slate-600 hover:border-slate-500 hover:bg-slate-50 disabled:opacity-40 transition-colors"
              >
                <Users className="h-4 w-4" />
                {loadingFuncs ? 'Carregando…' : postosSel.length ? `Carregar funcionários (${postosSel.length} posto${postosSel.length > 1 ? 's' : ''})` : 'Selecione um posto acima'}
              </button>
              {funcionarios.length > 0 && (
                <div className="mt-3">
                  <p className="mb-2 text-xs font-semibold text-green-700">
                    {funcionarios.length} funcionário{funcionarios.length !== 1 ? 's' : ''} incluído{funcionarios.length !== 1 ? 's' : ''}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {funcionarios.map(f => (
                      <span key={f.id} className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                        {abreviarNome(f.nome)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Horário semanal */}
          <div>
            <SectionHeader icon={Clock} title="Horário Semanal" />
            <div className="mt-3 overflow-hidden rounded-xl border border-gray-200">
              {DIAS.map((dia, i) => {
                const t = times[dia]
                const isLast = i === DIAS.length - 1
                return (
                  <div key={dia} className={`flex items-center gap-3 px-4 py-2.5 ${!isLast ? 'border-b border-gray-100' : ''} ${t.folga ? 'bg-gray-50' : ''}`}>
                    <span className="w-28 shrink-0 text-xs font-semibold text-slate-600">{dia}</span>

                    {t.folga ? (
                      <span className="flex-1 text-xs font-bold uppercase tracking-wider text-gray-400">Folga</span>
                    ) : (
                      <div className="flex flex-1 items-center gap-1.5 text-xs text-gray-600">
                        <input type="time" value={t.e1} onChange={e => updateTime(dia, 'e1', e.target.value)}
                          className="rounded-lg border border-gray-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-slate-300" />
                        <span className="text-gray-400">–</span>
                        <input type="time" value={t.s1} onChange={e => updateTime(dia, 's1', e.target.value)}
                          className="rounded-lg border border-gray-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-slate-300" />
                        <span className="mx-1 text-gray-300">/</span>
                        <input type="time" value={t.e2} onChange={e => updateTime(dia, 'e2', e.target.value)}
                          className="rounded-lg border border-gray-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-slate-300" />
                        <span className="text-gray-400">–</span>
                        <input type="time" value={t.s2} onChange={e => updateTime(dia, 's2', e.target.value)}
                          className="rounded-lg border border-gray-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-slate-300" />
                      </div>
                    )}

                    <label className="flex shrink-0 cursor-pointer items-center gap-1.5">
                      <input type="checkbox" checked={t.folga} onChange={e => updateTime(dia, 'folga', e.target.checked)}
                        className="accent-slate-900" />
                      <span className="text-xs text-gray-500">Folga</span>
                    </label>
                  </div>
                )
              })}
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
              <p className="mt-2 text-[10px] text-slate-500">
                Este trecho entra direto no documento jurídico. Informe o evento, a data trabalhada, o acréscimo de horas e os dias de compensação.
              </p>
              <button
                type="button"
                onClick={() => !descricao && setDescricao(MODELO_TEXTO)}
                className="mt-2 rounded-md bg-slate-700 px-2.5 py-1 text-[11px] font-semibold text-slate-200 hover:bg-slate-600 transition-colors"
              >
                ✦ Usar modelo
              </button>
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

        {/* Footer */}
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
