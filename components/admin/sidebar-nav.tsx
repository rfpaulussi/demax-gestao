'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  Building2,
  ClipboardCheck,
  Repeat2,
  Palmtree,
  ShieldAlert,
  UserMinus,
  Stethoscope,
  Biohazard,
  Siren,
  UserCog,
  Menu,
  Upload,
  ClipboardList,
  BarChart3,
  ClipboardX,
  UserX,
} from 'lucide-react'
import { Sheet, SheetContent, SheetClose } from '@/components/ui/sheet'
import { NAV_GROUPS } from './nav-config'
import type { Role } from '@/types'

// ─── icon mapping ─────────────────────────────────────────────────────────────

const ICONS: Record<string, React.ElementType> = {
  '/dashboard':     LayoutDashboard,
  '/efetivo':       Users,
  '/postos':        Building2,
  '/aprovacoes':    ClipboardCheck,
  '/coberturas':    Repeat2,
  '/ferias':        Palmtree,
  '/advertencias':  ShieldAlert,
  '/faltas':        UserMinus,
  '/atestados':     Stethoscope,
  '/insalubridade': Biohazard,
  '/ocorrencias':   Siren,
  '/desligamentos': UserX,
  '/pendencias':    ClipboardX,
  '/fechamento':    ClipboardList,
  '/relatorios':    BarChart3,
  '/importacao':    Upload,
  '/usuarios':      UserCog,
}

// ─── shared nav content ──────────────────────────────────────────────────────

function NavLinks({
  role,
  pendingCount,
  onNavigate,
}: {
  role: Role | null
  pendingCount: number
  onNavigate?: () => void
}) {
  const pathname = usePathname()

  return (
    <nav className="flex flex-1 flex-col overflow-y-auto px-3 py-4">
      {NAV_GROUPS.map((group, i) => {
        if (group.adminOnly && role !== 'admin') return null
        return (
          <div key={group.label} className={i > 0 ? 'mt-6' : undefined}>
            <p className="text-[10px] uppercase tracking-widest text-slate-500 px-3 mb-2">
              {group.label}
            </p>
            <div className="flex flex-col gap-0.5">
              {group.items.map(({ href, label, badge }) => {
                const Icon = ICONS[href]
                const active = pathname === href || pathname.startsWith(href + '/')
                const showBadge = badge && pendingCount > 0
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={onNavigate}
                    className={
                      active
                        ? 'flex items-center gap-3 rounded-r-lg border-l-2 border-blue-500 bg-white/10 px-3 py-2.5 text-sm font-semibold text-white'
                        : 'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:bg-white/5 hover:text-white'
                    }
                  >
                    {Icon && <Icon className="h-4 w-4 shrink-0" />}
                    <span className="flex-1">{label}</span>
                    {showBadge && (
                      <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                        {pendingCount > 99 ? '99+' : pendingCount}
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        )
      })}
    </nav>
  )
}

function SidebarHeader() {
  return (
    <div className="flex h-16 shrink-0 items-center border-b border-slate-800 px-6">
      <span className="text-sm font-black uppercase tracking-widest text-white">
        DEMAX
      </span>
    </div>
  )
}

// ─── main component ──────────────────────────────────────────────────────────

export function SidebarNav({
  role,
  pendingCount = 0,
}: {
  role: Role | null
  pendingCount?: number
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Mobile: hamburger triggers Sheet */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Abrir menu"
        className="fixed left-4 top-4 z-50 rounded-lg p-1.5 text-slate-600 transition-colors hover:bg-slate-100 md:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile: Sheet sidebar */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="bg-slate-900 pt-0">
          <SheetClose />
          <SidebarHeader />
          <NavLinks role={role} pendingCount={pendingCount} onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Desktop: fixed sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-800 bg-slate-900 md:flex">
        <SidebarHeader />
        <NavLinks role={role} pendingCount={pendingCount} />
      </aside>
    </>
  )
}
