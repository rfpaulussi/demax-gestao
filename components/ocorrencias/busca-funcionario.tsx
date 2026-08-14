'use client'

import { useMemo, useState } from 'react'
import type { FuncionarioBusca } from '@/app/(admin)/ocorrencias/actions'

function maskCPF(cpf: string | null): string {
  if (!cpf) return '—'
  return '***.***.***-**'
}

const inputClass =
  'h-9 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm shadow-sm text-gray-700 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400'

export function BuscaFuncionario({
  funcionarios,
  onSelect,
}: {
  funcionarios: FuncionarioBusca[]
  onSelect: (id: string) => void
}) {
  const [busca, setBusca] = useState('')
  const [secretaria, setSecretaria] = useState('')

  const secretarias = useMemo(
    () => Array.from(new Set(funcionarios.map(f => f.secretaria).filter(Boolean))).sort(),
    [funcionarios],
  )

  const filtrados = useMemo(() => {
    let list = funcionarios
    if (secretaria) list = list.filter(f => f.secretaria === secretaria)
    if (busca.trim()) {
      const termo = busca.trim().toLowerCase()
      list = list.filter(f => f.nome.toLowerCase().includes(termo))
    }
    return list.slice(0, 50)
  }, [funcionarios, busca, secretaria])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Buscar funcionário pelo nome…"
          value={busca}
          onChange={e => setBusca(e.target.value)}
          className={inputClass + ' max-w-xs'}
        />
        <select
          value={secretaria}
          onChange={e => setSecretaria(e.target.value)}
          className={inputClass + ' max-w-xs'}
        >
          <option value="">Todas as secretarias</option>
          {secretarias.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
        {filtrados.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-gray-400">
            {busca || secretaria ? 'Nenhum funcionário encontrado' : 'Digite um nome ou escolha uma secretaria pra buscar'}
          </p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {filtrados.map(f => (
              <li key={f.id}>
                <button
                  type="button"
                  onClick={() => onSelect(f.id)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left text-sm hover:bg-gray-50"
                >
                  <span className="font-medium text-gray-900">{f.nome}</span>
                  <span className="flex items-center gap-3 text-xs text-gray-400">
                    <span>{f.posto_nome}{f.secretaria ? ` — ${f.secretaria}` : ''}</span>
                    <span>{maskCPF(f.cpf)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
