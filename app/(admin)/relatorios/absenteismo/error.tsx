// app/(admin)/relatorios/absenteismo/error.tsx
'use client'

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="rounded-xl border border-red-100 bg-white p-8 text-center shadow-sm">
      <p className="text-sm font-semibold text-gray-900">Não foi possível carregar o absenteísmo.</p>
      <p className="mt-1 text-xs text-gray-400">{error.message || 'Erro inesperado.'}</p>
      <button
        type="button"
        onClick={reset}
        className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
      >
        Tentar de novo
      </button>
    </div>
  )
}
