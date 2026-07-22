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
  ArrowLeftRight,
  ScrollText,
  FileSignature,
  UserCheck,
  HelpCircle,
  Scale,
  BadgeDollarSign,
  Briefcase,
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
  '/desligamentos':   UserX,
  '/mudancas-funcao': ArrowLeftRight,
  '/pendencias':      ClipboardX,
  '/fechamento':    ClipboardList,
  '/relatorios':    BarChart3,
  '/importacao':    Upload,
  '/supervisores':  UserCheck,
  '/usuarios':      UserCog,
  '/auditoria':     ScrollText,
  '/acordos':               FileSignature,
  '/ajuda':                 HelpCircle,
  '/convencoes':            Scale,
  '/fechamento-financeiro': BadgeDollarSign,
  '/funcoes':               Briefcase,
}

// ─── shared nav content ──────────────────────────────────────────────────────

function NavLinks({
  role,
  pendingCount,
  alertCount,
  onNavigate,
}: {
  role: Role | null
  pendingCount: number
  alertCount: number
  onNavigate?: () => void
}) {
  const pathname = usePathname()

  return (
    <nav className="flex flex-1 flex-col overflow-y-auto px-3 py-4">
      {NAV_GROUPS.map((group, i) => {
        const visibleItems = group.items.filter(item =>
          item.allowedRoles
            ? role != null && item.allowedRoles.includes(role)
            : !group.adminOnly || role === 'admin',
        )
        if (visibleItems.length === 0) return null
        return (
          <div key={group.label} className={i > 0 ? 'mt-6' : undefined}>
            <p className="text-[10px] uppercase tracking-widest px-3 mb-2" style={{ color: '#2d5a3d' }}>
              {group.label}
            </p>
            <div className="flex flex-col gap-0.5">
              {visibleItems.map(({ href, label, badge, alertBadge }) => {
                const Icon = ICONS[href]
                const active = pathname === href || pathname.startsWith(href + '/')
                const badgeVal = badge && pendingCount > 0 ? pendingCount : 0
                const alertVal = alertBadge && alertCount > 0 ? alertCount : 0
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={onNavigate}
                    className={
                      active
                        ? 'flex items-center gap-3 rounded-r-lg border-l-2 px-3 py-2.5 text-sm font-semibold text-white'
                        : 'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-400 transition-colors hover:text-white'
                    }
                    style={active ? { borderColor: '#22c55e', background: 'rgba(34,197,94,0.08)' } : undefined}
                  >
                    {Icon && <Icon className="h-4 w-4 shrink-0" />}
                    <span className="flex-1">{label}</span>
                    {badgeVal > 0 && (
                      <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                        {badgeVal > 99 ? '99+' : badgeVal}
                      </span>
                    )}
                    {alertVal > 0 && (
                      <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-white" title={`${alertVal} função(ões) sem encargos`}>
                        {alertVal > 99 ? '99+' : alertVal}
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
    <div className="flex h-16 shrink-0 items-center gap-2.5 px-6" style={{ borderBottom: '1px solid #0d2318' }}>
      <span className="block h-2 w-2 rounded-full flex-shrink-0" style={{ background: '#22c55e' }} aria-hidden />
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
  alertCount = 0,
}: {
  role: Role | null
  pendingCount?: number
  alertCount?: number
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
        <SheetContent side="left" className="pt-0 !bg-[#071510]">
          <SheetClose />
          <SidebarHeader />
          <NavLinks role={role} pendingCount={pendingCount} alertCount={alertCount} onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Desktop: fixed sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col md:flex" style={{ background: '#071510', borderRight: '1px solid #0d2318' }}>
        <SidebarHeader />
        <NavLinks role={role} pendingCount={pendingCount} alertCount={alertCount} />
      </aside>
    </>
  )
}
