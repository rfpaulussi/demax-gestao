import { Check } from 'lucide-react'

export const INPUT_CLS =
  'w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300'
export const INPUT_ERRO_CLS =
  'w-full rounded-xl border border-red-400 bg-red-50/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200'
export const LABEL_CLS = 'block text-xs font-bold uppercase tracking-widest text-slate-500'

interface PassoProps {
  id?: string
  numero?: number
  titulo: React.ReactNode
  /** Passo concluído: o círculo vira um check verde. */
  feito?: boolean
  /** Borda vermelha (pendência visível). */
  erro?: boolean
  children: React.ReactNode
}

/** Card branco com círculo numerado e título-pergunta. */
export function Passo({ id, numero, titulo, feito, erro, children }: PassoProps) {
  return (
    <section id={id} className={`scroll-mt-4 rounded-xl border bg-white p-4 shadow-sm ${erro ? 'border-red-300' : 'border-gray-200'}`}>
      <header className="flex items-center gap-2.5">
        {numero !== undefined && (
          <span
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${feito ? 'bg-green-600' : 'bg-slate-900'}`}
          >
            {feito ? <Check className="h-3.5 w-3.5" /> : numero}
          </span>
        )}
        <h3 className="text-sm font-semibold text-slate-900">{titulo}</h3>
      </header>
      <div className="mt-3 space-y-4">{children}</div>
    </section>
  )
}

/** Sub-passo (a, b, c…) dentro de um passo. */
export function SubPasso({ id, letra, titulo, children }: { id?: string; letra: string; titulo: string; children: React.ReactNode }) {
  return (
    <div id={id} className="scroll-mt-4 space-y-3 rounded-lg border border-gray-100 bg-slate-50/60 p-3">
      <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500">
        <span className="flex h-5 w-5 items-center justify-center rounded bg-slate-200 text-[11px] font-bold normal-case tracking-normal text-slate-700">
          {letra}
        </span>
        {titulo}
      </h4>
      {children}
    </div>
  )
}

/** Campo com pergunta, linha de ajuda com exemplo e mensagem de erro (vermelha) opcional. */
export function Campo({ titulo, ajuda, erro, children }: { titulo: string; ajuda?: string; erro?: string | null; children: React.ReactNode }) {
  return (
    <div>
      <label className={`${LABEL_CLS} mb-1.5`}>{titulo}</label>
      {children}
      {erro ? <p className="mt-1 text-xs font-medium text-red-600">{erro}</p> : ajuda && <p className="mt-1 text-xs text-gray-400">{ajuda}</p>}
    </div>
  )
}
