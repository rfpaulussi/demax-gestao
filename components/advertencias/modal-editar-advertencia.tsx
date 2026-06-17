'use client'

import { useState, useEffect, useTransition } from 'react'
import { editarAdvertencia } from '@/app/(admin)/advertencias/actions'
import type { AdvertenciaCompleta, SupervisorOpt } from '@/app/(admin)/advertencias/actions'
import { cn } from '@/lib/utils'

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

const input  = 'flex h-9 w-full rounded-lg border border-gray-200 bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400'
const lbl    = 'block text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1.5'
const secTtl = 'text-xs font-bold uppercase tracking-widest text-gray-500 border-b border-gray-100 pb-2 mb-4'

interface Props {
  adv: AdvertenciaCompleta | null
  supervisores: SupervisorOpt[]
  onClose: () => void
  onSuccess: () => void
}

export function ModalEditarAdvertencia({ adv, supervisores, onClose, onSuccess }: Props) {
  const [grau,      setGrau]      = useState('')
  const [relato,    setRelato]    = useState('')
  const [natureza,  setNatureza]  = useState('')
  const [isPending, startTransition] = useTransition()
  const [erro,      setErro]      = useState('')

  useEffect(() => {
    if (adv) {
      setGrau(adv.grau ?? '')
      setRelato(adv.relato ?? '')
      setNatureza(adv.natureza ?? '')
      setErro('')
    }
  }, [adv])

  if (!adv) return null

  function handleClose() {
    setErro('')
    onClose()
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      try {
        await editarAdvertencia({
          id:                 adv!.id,
          funcionario_id:     adv!.funcionario_id,
          data_ocorrencia:    fd.get('data_ocorrencia') as string,
          horario_fato:       (fd.get('horario_fato') as string) || null,
          natureza:           natureza || null,
          relato:             relato || null,
          descricao:          (fd.get('descricao') as string) || null,
          grau,
          dias_suspensao:     grau === 'suspensao' ? Number(fd.get('dias_suspensao')) || null : null,
          data_aplicacao:     (fd.get('data_aplicacao') as string) || null,
          registrado_por:     (fd.get('registrado_por') as string) || null,
          testemunha_1:       (fd.get('testemunha_1') as string) || null,
          testemunha_2:       (fd.get('testemunha_2') as string) || null,
          defesa_colaborador: (fd.get('defesa_colaborador') as string) || null,
        })
        onSuccess()
        handleClose()
      } catch (err: unknown) {
        setErro(err instanceof Error ? err.message : 'Erro ao salvar')
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Editar Advertência</h2>
            <p className="text-sm text-gray-400">{adv.funcionarios?.nome ?? '—'}</p>
          </div>
          <button type="button" onClick={handleClose} className="text-gray-400 hover:text-gray-600 text-xl font-bold">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto px-6 py-4 space-y-6 flex-1">

          {/* 1. Ocorrência */}
          <div>
            <p className={secTtl}>1. Ocorrência</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Data da Ocorrência *</label>
                <input type="date" name="data_ocorrencia" required
                  defaultValue={adv.data_ocorrencia?.split('T')[0] ?? ''}
                  className={input} />
              </div>
              <div>
                <label className={lbl}>Horário</label>
                <input type="time" name="horario_fato"
                  defaultValue={adv.horario_fato ?? ''}
                  className={input} />
              </div>
              <div className="col-span-2">
                <label className={lbl}>Natureza da Infração</label>
                <select value={natureza} onChange={e => setNatureza(e.target.value)} className={input}>
                  <option value="">Selecione...</option>
                  {NATUREZA_OPTS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className={lbl}>Relato Detalhado</label>
                <textarea
                  rows={4}
                  value={relato}
                  onChange={e => setRelato(e.target.value)}
                  className={cn(input, 'h-auto py-2 resize-none')}
                />
              </div>
              <div className="col-span-2">
                <label className={lbl}>Observações Internas</label>
                <textarea name="descricao" rows={2}
                  defaultValue={adv.descricao ?? ''}
                  placeholder="Notas internas (não aparece no PDF)..."
                  className={cn(input, 'h-auto py-2 resize-none')} />
              </div>
            </div>
          </div>

          {/* 2. Medida Disciplinar */}
          <div>
            <p className={secTtl}>2. Medida Disciplinar</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Grau *</label>
                <select required value={grau} onChange={e => setGrau(e.target.value)} className={input}>
                  <option value="">Selecione...</option>
                  <option value="verbal">Advertência Verbal</option>
                  <option value="escrita">Advertência Escrita</option>
                  <option value="suspensao">Suspensão</option>
                </select>
              </div>
              {grau === 'suspensao' && (
                <div>
                  <label className={lbl}>Dias de Suspensão *</label>
                  <input type="number" name="dias_suspensao" min={1} max={30} required
                    defaultValue={adv.dias_suspensao ?? ''}
                    className={input} />
                </div>
              )}
              <div>
                <label className={lbl}>Data de Aplicação</label>
                <input type="date" name="data_aplicacao"
                  defaultValue={adv.data_aplicacao?.split('T')[0] ?? ''}
                  className={input} />
              </div>
              <div>
                <label className={lbl}>Aplicado por (supervisor)</label>
                <select name="registrado_por" className={input}
                  defaultValue={adv.registrado_por ?? ''}>
                  <option value="">Selecione o supervisor...</option>
                  {supervisores.map(s => (
                    <option key={s.id} value={s.nome}>{s.nome}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* 3. Testemunhas e Defesa */}
          <div>
            <p className={secTtl}>3. Testemunhas e Defesa</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Testemunha 1</label>
                <input type="text" name="testemunha_1"
                  defaultValue={adv.testemunha_1 ?? ''}
                  placeholder="Nome completo..." className={input} />
              </div>
              <div>
                <label className={lbl}>Testemunha 2</label>
                <input type="text" name="testemunha_2"
                  defaultValue={adv.testemunha_2 ?? ''}
                  placeholder="Nome completo..." className={input} />
              </div>
              <div className="col-span-2">
                <label className={lbl}>Defesa do Colaborador</label>
                <textarea name="defesa_colaborador" rows={3}
                  defaultValue={adv.defesa_colaborador ?? ''}
                  placeholder="Registro da defesa apresentada pelo colaborador..."
                  className={cn(input, 'h-auto py-2 resize-none')} />
              </div>
            </div>
          </div>

          {erro && (
            <div className="bg-red-50 text-red-600 text-sm rounded-lg px-3 py-2">{erro}</div>
          )}

          <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
            <button type="button" onClick={handleClose}
              className="flex h-9 items-center rounded-lg border border-gray-200 px-4 text-sm font-medium text-gray-500 hover:bg-gray-50">
              Cancelar
            </button>
            <button type="submit" disabled={isPending}
              className="flex h-9 items-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50">
              {isPending ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>

        </form>
      </div>
    </div>
  )
}
