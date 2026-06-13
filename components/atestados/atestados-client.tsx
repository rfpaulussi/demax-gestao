'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { deleteAtestado } from '@/app/(admin)/atestados/actions'
import { ModalEditarAtestado } from './modal-editar-atestado'

export type AtestadoRow = {
  id: string
  funcionario_id: string
  posto_id: string | null
  data_inicio: string
  data_fim: string
  motivo: string | null
  cid_codigo: string | null
  funcionario_nome: string
  posto_nome: string
  secretaria: string
  dias: number
  acumulado: number
  alerta: boolean
  cid_desc: string
}

type CidOpt = { codigo: string; descricao: string }

interface Props {
  atestados: AtestadoRow[]
  cids: CidOpt[]
}

export function AtestadosClient({ atestados, cids }: Props) {
  const [editando, setEditando] = useState<AtestadoRow | null>(null)
  const [excluindoId, setExcluindoId] = useState<string | null>(null)
  const [erroExcluir, setErroExcluir] = useState('')
  const [pendingDelete, setPendingDelete] = useState(false)

  async function confirmarExclusao() {
    if (!excluindoId) return
    setPendingDelete(true)
    setErroExcluir('')
    const res = await deleteAtestado(excluindoId)
    setPendingDelete(false)
    if (res.error) { setErroExcluir(res.error); return }
    setExcluindoId(null)
  }

  if (atestados.length === 0) {
    return <p className="px-6 py-10 text-center text-sm text-gray-400">Nenhum atestado encontrado.</p>
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-100 bg-slate-50">
            <tr>
              {['Funcionário', 'Posto', 'Secretaria', 'Início', 'Fim', 'Dias', 'CID', 'Acum. 30d', 'Ações'].map(col => (
                <th
                  key={col}
                  className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-widest text-gray-400"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {atestados.map(a => (
              <tr
                key={a.id}
                className={cn(
                  'transition-colors',
                  a.alerta ? 'bg-red-50 hover:bg-red-100' : 'bg-white hover:bg-gray-50',
                )}
              >
                <td className="px-5 py-3.5 font-medium text-gray-900">{a.funcionario_nome}</td>
                <td className="px-5 py-3.5 text-gray-500">{a.posto_nome}</td>
                <td className="px-5 py-3.5 text-gray-500">{a.secretaria}</td>
                <td className="px-5 py-3.5 tabular-nums text-gray-500">
                  {a.data_inicio.split('-').reverse().join('/')}
                </td>
                <td className="px-5 py-3.5 tabular-nums text-gray-500">
                  {a.data_fim.split('-').reverse().join('/')}
                </td>
                <td className="px-5 py-3.5 tabular-nums text-gray-700">{a.dias}</td>
                <td className="px-5 py-3.5 text-gray-500">
                  {a.cid_codigo ? (
                    <span>
                      <span className="font-mono font-semibold text-blue-700">{a.cid_codigo}</span>
                      {a.cid_desc && a.cid_desc !== a.cid_codigo && (
                        <span className="ml-1 text-gray-400">— {a.cid_desc}</span>
                      )}
                    </span>
                  ) : (
                    <span className="text-gray-400">{a.cid_desc || '—'}</span>
                  )}
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2">
                    <span className={cn('tabular-nums font-semibold', a.alerta ? 'text-red-700' : 'text-gray-700')}>
                      {a.acumulado}d
                    </span>
                    {a.alerta && (
                      <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-red-700 ring-1 ring-inset ring-red-200">
                        ⚠️ Avaliar INSS
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-5 py-3.5">
                  {excluindoId === a.id ? (
                    <div className="flex flex-col gap-1">
                      <p className="text-xs text-gray-600">Tem certeza? Esta ação não pode ser desfeita.</p>
                      {erroExcluir && <p className="text-xs text-red-600">{erroExcluir}</p>}
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={confirmarExclusao}
                          disabled={pendingDelete}
                          className="rounded bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                        >
                          {pendingDelete ? '...' : 'Confirmar'}
                        </button>
                        <button
                          type="button"
                          onClick={() => { setExcluindoId(null); setErroExcluir('') }}
                          className="rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setEditando(a)}
                        className="rounded border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => setExcluindoId(a.id)}
                        className="rounded border border-red-200 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                      >
                        Excluir
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ModalEditarAtestado
        atestado={editando}
        onClose={() => setEditando(null)}
        cids={cids}
      />
    </>
  )
}
