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
  SearchCheck,
  FileSearch,
  CalendarClock,
  FileCheck2,
  CalendarRange,
  FileSpreadsheet,
  ChevronDown,
} from 'lucide-react'
import { Sheet, SheetContent, SheetClose } from '@/components/ui/sheet'
import { useSidebar } from './sidebar-context'
import { varsDoTema, type TemaCampanha } from '@/lib/tema-campanha'
import { NAV_GROUPS } from './nav-config'
import type { Role } from '@/types'

// ─── icon mapping ─────────────────────────────────────────────────────────────

const ICONS: Record<string, React.ElementType> = {
  '/dashboard':     LayoutDashboard,
  '/efetivo':       Users,
  '/postos':        Building2,
  '/aprovacoes':    ClipboardCheck,
  '/movimentacoes': FileCheck2,
  '/coberturas':    Repeat2,
  '/ferias':        Palmtree,
  '/advertencias':  ShieldAlert,
  '/faltas':        UserMinus,
  '/atestados':     Stethoscope,
  '/pendencias-horario': CalendarClock,
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
  '/agenda':                CalendarRange,
  '/acordos':               FileSignature,
  '/ajuda':                 HelpCircle,
  '/convencoes':            Scale,
  '/fechamento-financeiro': BadgeDollarSign,
  '/funcoes':               Briefcase,
  '/revisor-operacional':   SearchCheck,
  '/auditoria-atestados':   FileSearch,
  '/conferencia-rh':        FileSpreadsheet,
}

// ─── shared nav content ──────────────────────────────────────────────────────

function NavLinks({
  role,
  pendingCount,
  alertCount,
  termosPendentes,
  onNavigate,
}: {
  role: Role | null
  pendingCount: number
  alertCount: number
  termosPendentes: number
  onNavigate?: () => void
}) {
  const pathname = usePathname()
  // Grupo da página atual (ou o primeiro) começa aberto; os demais recolhidos.
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    const atual = NAV_GROUPS.find(g =>
      g.items.some(it => pathname === it.href || pathname.startsWith(it.href + '/')),
    )
    return new Set([atual?.label ?? NAV_GROUPS[0].label])
  })
  const toggleGroup = (label: string) =>
    setOpenGroups(prev => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })

  return (
    <nav className="flex flex-1 flex-col overflow-y-auto px-3 py-4">
      {NAV_GROUPS.map((group, i) => {
        const visibleItems = group.items.filter(item =>
          item.allowedRoles
            ? role != null && item.allowedRoles.includes(role)
            : !group.adminOnly || role === 'admin',
        )
        if (visibleItems.length === 0) return null
        const aberto = openGroups.has(group.label)
        return (
          <div key={group.label} className={i > 0 ? 'mt-4' : undefined}>
            <button
              type="button"
              onClick={() => toggleGroup(group.label)}
              aria-expanded={aberto}
              className="mb-2 flex w-full items-center justify-between px-3 text-[10px] uppercase tracking-widest"
              style={{ color: 'var(--nav-label)' }}
            >
              {group.label}
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${aberto ? '' : '-rotate-90'}`} />
            </button>
            <div className={`flex flex-col gap-0.5 ${aberto ? '' : 'hidden'}`}>
              {visibleItems.map(({ href, label, badge, alertBadge, termosBadge }) => {
                const termosVal = termosBadge && termosPendentes > 0 ? termosPendentes : 0
                const Icon = ICONS[href]
                const active = pathname === href || pathname.startsWith(href + '/')
                const badgeVal = badge && pendingCount > 0 ? pendingCount : 0
                const alertVal = alertBadge && alertCount > 0 ? alertCount : 0
                return (
                  <Link
                    key={href}
                    href={href}
                    prefetch={false}
                    onClick={onNavigate}
                    className={
                      active
                        ? 'flex items-center gap-3 rounded-r-lg border-l-2 px-3 py-2.5 text-sm font-semibold text-white'
                        : 'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-400 transition-colors hover:text-white'
                    }
                    style={active ? { borderColor: 'var(--nav-accent)', background: 'var(--nav-accent-soft)' } : undefined}
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
                    {termosVal > 0 && (
                      <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-white" title={`${termosVal} termo(s) pendente(s) de protocolo`}>
                        {termosVal > 99 ? '99+' : termosVal}
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
    <div className="flex h-16 shrink-0 items-center gap-2.5 px-6" style={{ borderBottom: '1px solid var(--nav-border)' }}>
      <span className="block h-2 w-2 rounded-full flex-shrink-0" style={{ background: 'var(--nav-accent)' }} aria-hidden />
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
  termosPendentes = 0,
  tema,
}: {
  tema: TemaCampanha
  role: Role | null
  pendingCount?: number
  alertCount?: number
  termosPendentes?: number
}) {
  const { collapsed, mobileOpen: open, setMobileOpen: setOpen } = useSidebar()

  return (
    <div className="contents" style={varsDoTema(tema) as React.CSSProperties}>
      {/* Mobile: Sheet sidebar (aberta pelo botão do cabeçalho) */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="pt-0 !bg-[var(--nav-bg)]">
          <SheetClose />
          <SidebarHeader />
          <NavLinks role={role} pendingCount={pendingCount} alertCount={alertCount} termosPendentes={termosPendentes} onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Desktop: fixed sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-30 hidden w-64 flex-col ${collapsed ? '' : 'md:flex'}`} style={{ background: 'var(--nav-bg)', borderRight: '1px solid var(--nav-border)' }}>
        <SidebarHeader />
        <NavLinks role={role} pendingCount={pendingCount} alertCount={alertCount} termosPendentes={termosPendentes} />
      </aside>
    </div>
  )
}
