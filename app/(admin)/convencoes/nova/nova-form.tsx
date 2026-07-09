'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { criarConvencao } from '../actions'

const labelCls = 'block text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1.5'
const inputCls = 'w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400'

export function NovaConvencaoForm() {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [erro, setErro]  = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErro(null)
    const fd = new FormData(e.currentTarget)
    const pct = fd.get('percentual_reajuste') as string
    start(async () => {
      const res = await criarConvencao({
        descricao:            String(fd.get('descricao') ?? ''),
        data_vigencia_inicio: String(fd.get('data_vigencia_inicio') ?? ''),
        data_vigencia_fim:    String(fd.get('data_vigencia_fim') ?? ''),
        percentual_reajuste:  pct ? parseFloat(pct) : null,
        observacoes:          fd.get('observacoes') ? String(fd.get('observacoes')) : null,
      })
      if (res && !res.success) setErro(res.error)
      // Se success, o redirect no action já navega
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className={labelCls}>Descrição</label>
        <input
          name="descricao"
          required
          placeholder="Ex: Convenção Coletiva 2026 – Dissídio Geral"
          className={inputCls}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Início da Vigência</label>
          <input name="data_vigencia_inicio" type="date" required className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Fim da Vigência</label>
          <input name="data_vigencia_fim" type="date" required className={inputCls} />
        </div>
      </div>

      <div>
        <label className={labelCls}>Percentual de Reajuste (%)</label>
        <input
          name="percentual_reajuste"
          type="number"
          step="0.01"
          min="0"
          max="999"
          placeholder="Ex: 5.50"
          className={inputCls}
        />
        <p className="mt-1 text-xs text-gray-400">
          Opcional. Se informado, será usado para calcular automaticamente os novos valores das funções.
        </p>
      </div>

      <div>
        <label className={labelCls}>Observações</label>
        <textarea
          name="observacoes"
          rows={3}
          placeholder="Detalhes da convenção, cláusulas especiais, fonte do documento..."
          className={`${inputCls} resize-none`}
        />
      </div>

      {erro && <p className="text-sm text-red-600">{erro}</p>}

      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={() => router.push('/convencoes')}
          className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {pending ? 'Criando…' : 'Criar e Adicionar Valores →'}
        </button>
      </div>
    </form>
  )
}
