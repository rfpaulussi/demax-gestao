// components/absenteismo/info-tip.tsx
import { Info } from 'lucide-react'

/** Ícone ⓘ com explicação. Abre no hover e no foco (teclado); o texto também vai no aria-label. */
export function InfoTip({ texto }: { texto: string }) {
  return (
    <span className="group relative inline-flex align-middle">
      <button
        type="button"
        aria-label={texto}
        className="rounded text-gray-300 hover:text-gray-500 focus:outline-none focus-visible:ring-1 focus-visible:ring-gray-400"
      >
        <Info className="h-3.5 w-3.5" aria-hidden />
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-20 mt-1.5 hidden w-60 -translate-x-1/2 rounded-lg bg-slate-900 px-3 py-2 text-left text-xs font-normal normal-case leading-snug tracking-normal text-white shadow-lg group-focus-within:block group-hover:block"
      >
        {texto}
      </span>
    </span>
  )
}
