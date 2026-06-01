'use client'

import { useState, useEffect, useRef } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { createClient } from '@/lib/supabase/client'
import { registrarInsalubridade } from '@/app/(admin)/insalubridade/actions'

interface Funcionario {
  id: string
  nome: string
  posto_id: string | null
}

interface Props {
  open: boolean
  onClose: () => void
}

const PERCENTUAIS: Record<string, number> = {
  Mínimo: 10,
  Médio: 20,
  Máximo: 40,
}

export function ModalNovaInsalubridade({ open, onClose }: Props) {
  const [busca, setBusca] = useState('')
  const [resultados, setResultados] = useState<Funcionario[]>([])
  const [selecionado, setSelecionado] = useState<Funcionario | null>(null)
  const [grau, setGrau] = useState('')
  const [pending, setPending] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!open) return
    if (busca.trim().length < 2) {
      setResultados([])
      return
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('funcionarios')
        .select('id, nome, posto_id')
        .eq('status', 'ativo')
        .ilike('nome', `%${busca.trim()}%`)
        .limit(8)
      setResultados(data ?? [])
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [busca, open])

  function handleClose() {
    setBusca('')
    setResultados([])
    setSelecionado(null)
    setGrau('')
    onClose()
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!selecionado) return
    const form = e.currentTarget
    const data = new FormData(form)
    data.set('funcionario_id', selecionado.id)
    data.set('posto_id', selecionado.posto_id ?? '')
    data.set('percentual', String(PERCENTUAIS[grau] ?? 0))
    setPending(true)
    try {
      await registrarInsalubridade(data)
      form.reset()
      handleClose()
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(isOpen) => { if (!isOpen) handleClose() }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 bg-black/50 z-40" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-xl">
          <Dialog.Title className="mb-4 text-lg font-semibold">Nova Insalubridade</Dialog.Title>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!selecionado ? (
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-600">
                  Funcionário
                </label>
                <input
                  type="text"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Digite o nome..."
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
                {resultados.length > 0 && (
                  <ul className="mt-1 max-h-40 overflow-y-auto rounded border border-gray-200 bg-white shadow">
                    {resultados.map((f) => (
                      <li key={f.id}>
                        <button
                          type="button"
                          onClick={() => { setSelecionado(f); setBusca(''); setResultados([]) }}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                        >
                          <span className="font-medium">{f.nome}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-600">
                  Funcionário
                </label>
                <div className="flex items-center justify-between rounded border border-gray-200 bg-gray-50 px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">{selecionado.nome}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setSelecionado(null); setGrau('') }}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Trocar
                  </button>
                </div>
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-600">
                Grau
              </label>
              <select
                name="grau"
                required
                value={grau}
                onChange={(e) => setGrau(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="">Selecione...</option>
                <option value="Mínimo">Mínimo</option>
                <option value="Médio">Médio</option>
                <option value="Máximo">Máximo</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-600">
                Percentual
              </label>
              <input
                type="text"
                readOnly
                value={grau ? `${PERCENTUAIS[grau]}%` : '—'}
                className="w-full rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-600">
                Data Início
              </label>
              <input
                type="date"
                name="data_inicio"
                required
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-600">
                Data Fim
              </label>
              <input
                type="date"
                name="data_fim"
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="rounded px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={pending || !selecionado}
                className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {pending ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
