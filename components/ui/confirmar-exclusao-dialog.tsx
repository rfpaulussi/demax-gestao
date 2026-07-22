'use client'

import { useState } from 'react'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'

const PALAVRA_CONFIRMACAO = 'deletar'
const DESCRICAO_PADRAO = 'Esta ação é irreversível. O registro será apagado permanentemente.'

interface ConfirmarExclusaoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  titulo: string
  descricao?: React.ReactNode
  onConfirmar: () => Promise<{ success: boolean; error?: string }>
}

export function ConfirmarExclusaoDialog({
  open,
  onOpenChange,
  titulo,
  descricao = DESCRICAO_PADRAO,
  onConfirmar,
}: ConfirmarExclusaoDialogProps) {
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const habilitado = texto.trim().toLowerCase() === PALAVRA_CONFIRMACAO

  function limparEFechar(novoOpen: boolean) {
    if (!novoOpen) {
      setTexto('')
      setErro(null)
    }
    onOpenChange(novoOpen)
  }

  async function handleConfirmar() {
    if (!habilitado || enviando) return
    setEnviando(true)
    setErro(null)
    const res = await onConfirmar()
    setEnviando(false)
    if (!res.success) {
      setErro(res.error ?? 'Erro ao excluir. Tente novamente.')
      return
    }
    limparEFechar(false)
  }

  return (
    <AlertDialog open={open} onOpenChange={limparEFechar}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{titulo}</AlertDialogTitle>
          <AlertDialogDescription>{descricao}</AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-widest text-gray-500">
            Digite &quot;deletar&quot; para confirmar
          </label>
          <input
            type="text"
            value={texto}
            onChange={e => setTexto(e.target.value)}
            autoComplete="off"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400"
          />
        </div>

        {erro && <p className="px-1 text-sm text-red-600">{erro}</p>}

        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => limparEFechar(false)}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirmar}
            disabled={!habilitado || enviando}
            className="bg-red-600 text-white hover:bg-red-700 focus:ring-red-600 disabled:opacity-40"
          >
            {enviando ? 'Excluindo…' : 'Excluir'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
