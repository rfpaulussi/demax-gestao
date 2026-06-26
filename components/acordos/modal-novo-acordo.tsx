'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  criarAcordo,
  buscarFuncionariosPorPostos,
} from '@/app/(admin)/acordos/actions'
import type { AcordoPostoItem, AcordoFuncionarioItem, HorarioSemana } from '@/app/(admin)/acordos/actions'

const DIAS = ['Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado','Domingo']

const HORARIO_DEFAULT: HorarioSemana = {
  'Segunda-feira': '08:00 às 12:00 / 13:30 às 18:00',
  'Terça-feira':   '08:00 às 12:00 / 13:30 às 18:00',
  'Quarta-feira':  '08:00 às 12:00 / 13:30 às 18:00',
  'Quinta-feira':  '08:00 às 12:00 / 13:30 às 18:00',
  'Sexta-feira':   '08:00 às 12:00 / 13:30 às 18:00',
  'Sábado':        'FOLGA',
  'Domingo':       'FOLGA',
}

interface Props {
  postos: AcordoPostoItem[]
  onClose: () => void
}

export function ModalNovoAcordo({ postos, onClose }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const [titulo, setTitulo]                 = useState('')
  const [tipo, setTipo]                     = useState<'individual' | 'coletivo'>('individual')
  const [postosSel, setPostosSel]           = useState<string[]>([])
  const [funcionarios, setFuncionarios]     = useState<AcordoFuncionarioItem[]>([])
  const [loadingFuncs, setLoadingFuncs]     = useState(false)
  const [horario, setHorario]               = useState<HorarioSemana>({ ...HORARIO_DEFAULT })
  const [descricao, setDescricao]           = useState('')
  const [dataDoc, setDataDoc]               = useState(new Date().toISOString().split('T')[0])
  const [erro, setErro]                     = useState('')

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
    if (!descricao.trim())    { setErro('Descreva os termos do acordo.'); return }

    setErro('')
    startTransition(async () => {
      const postosObj = postos.filter(p => postosSel.includes(p.id))
      const res = await criarAcordo({
        titulo: titulo.trim(),
        tipo,
        postos: postosObj,
        funcionarios,
        horario_semana: horario,
        descricao_acordo: descricao.trim(),
        data_documento: dataDoc,
      })
      if ('error' in res) { setErro(res.error); return }
      router.refresh()
      onClose()
    })
  }

  const inputCls = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400'

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 overflow-y-auto py-8 px-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-base font-bold text-gray-900">Novo Acordo de Compensação</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">×</button>
        </div>

        <div className="space-y-5 px-6 py-5">
          {/* Título */}
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-400">Título</label>
            <input
              value={titulo}
              onChange={e => setTitulo(e.target.value)}
              placeholder="ex: Acordo Festa Junina — Junho 2026"
              className={inputCls}
            />
          </div>

          {/* Tipo */}
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-gray-400">Tipo</label>
            <div className="flex gap-4">
              {(['individual', 'coletivo'] as const).map(t => (
                <label key={t} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={tipo === t}
                    onChange={() => { setTipo(t); setPostosSel([]); setFuncionarios([]) }}
                    className="accent-slate-900"
                  />
                  <span className="text-sm capitalize text-gray-700">{t}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Seleção de postos */}
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-gray-400">
              {tipo === 'individual' ? 'Posto' : 'Postos (múltipla seleção)'}
            </label>
            <div className="max-h-36 overflow-y-auto rounded-lg border border-gray-200 divide-y divide-gray-50">
              {postos.map(p => (
                <label key={p.id} className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-50">
                  <input
                    type={tipo === 'individual' ? 'radio' : 'checkbox'}
                    checked={postosSel.includes(p.id)}
                    onChange={() => togglePosto(p.id)}
                    className="accent-slate-900 shrink-0"
                  />
                  <span className="text-sm text-gray-700">{p.nome}</span>
                  {p.secretaria && <span className="ml-auto text-xs text-gray-400 shrink-0">{p.secretaria}</span>}
                </label>
              ))}
            </div>
            <button
              type="button"
              disabled={!postosSel.length || loadingFuncs}
              onClick={carregarFuncionarios}
              className="mt-2 flex h-8 items-center rounded-lg bg-slate-100 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-40"
            >
              {loadingFuncs ? 'Carregando…' : `Carregar funcionários ${postosSel.length ? `(${postosSel.length} posto${postosSel.length > 1 ? 's' : ''})` : ''}`}
            </button>
            {funcionarios.length > 0 && (
              <p className="mt-1.5 text-xs text-gray-500">
                {funcionarios.length} funcionário{funcionarios.length !== 1 ? 's' : ''} carregado{funcionarios.length !== 1 ? 's' : ''}
              </p>
            )}
          </div>

          {/* Horário semanal */}
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-gray-400">Horário Semanal</label>
            <div className="overflow-hidden rounded-lg border border-gray-200 divide-y divide-gray-100">
              {DIAS.map(dia => (
                <div key={dia} className="flex items-center gap-3 px-3 py-2">
                  <span className="w-32 shrink-0 text-xs font-medium text-gray-600">{dia}</span>
                  <input
                    value={horario[dia] ?? ''}
                    onChange={e => setHorario(h => ({ ...h, [dia]: e.target.value }))}
                    placeholder="ex: 08:00 às 12:00 / 13:30 às 18:00"
                    className="flex-1 rounded-md border border-gray-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-slate-300"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Descrição do acordo */}
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-400">
              Termos específicos
            </label>
            <p className="mb-1.5 text-xs text-gray-400">
              Complete a frase: &quot;…com a finalidade de que os funcionários <strong>___</strong>&quot;
            </p>
            <textarea
              value={descricao}
              onChange={e => setDescricao(e.target.value)}
              rows={4}
              placeholder="ex: trabalhem no dia 28/06/2026 (Festa Junina), compensando as horas com acréscimo de 01:00h diária nos dias 30/06 e 01/07/2026."
              className={inputCls}
            />
          </div>

          {/* Data do documento */}
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-400">Data do documento</label>
            <input type="date" value={dataDoc} onChange={e => setDataDoc(e.target.value)} className={inputCls} />
          </div>

          {erro && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{erro}</p>}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-gray-100 px-6 py-4">
          <button onClick={onClose} className="flex h-9 items-center rounded-lg border border-gray-200 px-4 text-sm text-gray-600 hover:bg-gray-50">
            Cancelar
          </button>
          <button
            onClick={handleSalvar}
            disabled={pending}
            className="flex h-9 items-center rounded-lg bg-slate-900 px-5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-40"
          >
            {pending ? 'Salvando…' : 'Salvar Acordo'}
          </button>
        </div>
      </div>
    </div>
  )
}
