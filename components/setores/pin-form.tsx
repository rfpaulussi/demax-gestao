'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { entrarComPin } from '@/lib/setores/actions'

export function PinForm({ slug, titulo }: { slug: string; titulo: string }) {
  const [pin, setPin] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    startTransition(async () => {
      const res = await entrarComPin(slug, pin)
      if (!res.ok) {
        setErro(res.erro ?? 'Código incorreto.')
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-xl border-t-4 border-indigo-500 bg-white p-6 shadow-sm"
      >
        <h1 className="text-lg font-bold text-slate-900">{titulo}</h1>
        <p className="mt-1 text-sm text-slate-500">Consulta de efetivo</p>

        <label className="mt-6 block text-xs font-semibold uppercase tracking-widest text-slate-500">
          Código de acesso
        </label>
        <input
          type="password"
          inputMode="numeric"
          autoFocus
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-center text-lg tracking-[0.3em] focus:border-slate-900 focus:outline-none"
          placeholder="••••••"
        />

        {erro && <p className="mt-2 text-sm text-red-600">{erro}</p>}

        <button
          type="submit"
          disabled={pending || !pin}
          className="mt-4 w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {pending ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}
