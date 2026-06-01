'use client'

import * as React from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── context ─────────────────────────────────────────────────────────────────

type CtxValue = { open: boolean; onOpenChange: (v: boolean) => void }
const SheetCtx = React.createContext<CtxValue>({ open: false, onOpenChange: () => {} })

// ─── root ─────────────────────────────────────────────────────────────────────

export function Sheet({
  open,
  onOpenChange,
  children,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  children: React.ReactNode
}) {
  React.useEffect(() => {
    if (!open) return
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onOpenChange(false) }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [open, onOpenChange])

  return <SheetCtx.Provider value={{ open, onOpenChange }}>{children}</SheetCtx.Provider>
}

// ─── content ─────────────────────────────────────────────────────────────────

export function SheetContent({
  side = 'left',
  className,
  children,
}: {
  side?: 'left' | 'right'
  className?: string
  children: React.ReactNode
}) {
  const { open, onOpenChange } = React.useContext(SheetCtx)

  return (
    <>
      <div
        aria-hidden
        onClick={() => onOpenChange(false)}
        className={cn(
          'fixed inset-0 z-40 bg-black/50 transition-opacity duration-200',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      />
      <div
        role="dialog"
        aria-modal
        className={cn(
          'fixed inset-y-0 z-50 flex w-72 flex-col bg-white shadow-2xl transition-transform duration-200 ease-in-out',
          side === 'left' ? 'left-0' : 'right-0',
          open
            ? 'translate-x-0'
            : side === 'left'
              ? '-translate-x-full'
              : 'translate-x-full',
          className,
        )}
      >
        {children}
      </div>
    </>
  )
}

// ─── close button ─────────────────────────────────────────────────────────────

export function SheetClose({ className }: { className?: string }) {
  const { onOpenChange } = React.useContext(SheetCtx)
  return (
    <button
      onClick={() => onOpenChange(false)}
      aria-label="Fechar"
      className={cn(
        'absolute right-4 top-4 rounded p-1 text-gray-400 transition-colors hover:text-gray-700',
        className,
      )}
    >
      <X className="h-4 w-4" />
    </button>
  )
}
