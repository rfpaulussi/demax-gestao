'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { confirmarFalta, type FaltaParaConfirmar } from '@/app/(admin)/faltas/actions'
import { ModalAtestado } from '@/components/efetivo/modal-atestado'
import type { FuncionarioRow } from '@/components/efetivo/funcionarios-table'

const fmt = (d: string) => d.split('-').reverse().join('/')

interface Props {
  faltas: FaltaParaConfirmar[]
  cids: { codigo: string; descricao: string }[]
}

export function FaixaFaltasConfirmar({ faltas, cids }: Props) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  const [atestadoDe, setAtestadoDe] = useState<FaltaParaConfirmar | null>(null)

  if (faltas.length === 0) return null

  function confirmar(id: string) {
    setErro(null)
    start(async () => {
      const r = await confirmarFalta(id)
      if (r.error) setErro(r.error)
      else router.refresh()
    })
  }

  return (
    <div className="rounded-xl border-2 border-amber-400 bg-amber-50 p-4 shadow-sm">
      <p className="text-sm font-bold text-amber-900">
        ⚠ {faltas.length} falta{faltas.length > 1 ? 's' : ''} sem justificativa aguardando sua confirmação
      </p>
      <p className="mt-0.5 text-xs text-amber-800">
        Já se passaram 3 dias ou mais. Se o funcionário entregou atestado, registre-o para não penalizá-lo em dobro.
      </p>
      <ul className="mt-3 divide-y divide-amber-200">
        {faltas.map(f => (
          <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <span className="text-sm text-amber-950">
              <span className="font-semibold">{f.nome}</span>
              {' · '}{fmt(f.data_falta)}{f.data_fim && f.data_fim !== f.data_falta ? ` a ${fmt(f.data_fim)}` : ''}
              {' · '}{f.dias} dia{f.dias > 1 ? 's' : ''}
            </span>
            <span className="flex gap-2">
              <button
                type="button"
                onClick={() => setAtestadoDe(f)}
                className="rounded bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700"
              >
                Chegou atestado
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => confirmar(f.id)}
                className="rounded border border-amber-500 bg-white px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50"
              >
                Confirmar falta
              </button>
            </span>
          </li>
        ))}
      </ul>
      {erro && <p className="mt-2 text-xs text-red-700">{erro}</p>}

      {atestadoDe && (
        <ModalAtestado
          funcionario={{ id: atestadoDe.funcionario_id, nome: atestadoDe.nome, posto_id: atestadoDe.posto_id, status: 'faltante' } as FuncionarioRow}
          open
          cids={cids}
          onClose={() => { setAtestadoDe(null); router.refresh() }}
        />
      )}
    </div>
  )
}
