'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  CheckSquare,
  ArrowLeftRight,
  Calendar,
  AlertTriangle,
  UserX,
  Shield,
  FileText,
  AlertCircle,
  UserCog,
  Menu,
  MapPin,
  FileCheck,
  Upload,
  BarChart2,
} from 'lucide-react'
import { Sheet, SheetContent, SheetClose } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import type { Role } from '@/types'

// ─── nav definition ──────────────────────────────────────────────────────────

const NAV = [
  { href: '/dashboard',     label: 'Dashboard',     icon: LayoutDashboard },
  { href: '/efetivo',       label: 'Efetivo',       icon: Users           },
  { href: '/postos',        label: 'Postos',        icon: MapPin          },
  { href: '/aprovacoes',    label: 'Aprovações',    icon: CheckSquare, badge: true },
  { href: '/coberturas',    label: 'Coberturas',    icon: ArrowLeftRight  },
  { href: '/ferias',        label: 'Férias',        icon: Calendar        },
  { href: '/advertencias',  label: 'Advertências',  icon: AlertTriangle   },
  { href: '/faltas',        label: 'Faltas',        icon: UserX           },
  { href: '/insalubridade', label: 'Insalubridade', icon: Shield          },
  { href: '/medicao',       label: 'Medição',       icon: FileText        },
  { href: '/ocorrencias',   label: 'Ocorrências',   icon: AlertCircle     },
] as const

const ADMIN_NAV = [
  { href: '/fechamento',  label: 'Fechamento',  icon: FileCheck  },
  { href: '/relatorios',  label: 'Relatórios',  icon: BarChart2  },
  { href: '/importacao',  label: 'Importação',  icon: Upload     },
  { href: '/usuarios',    label: 'Usuários',    icon: UserCog    },
] as const

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
  const items = role === 'admin' ? [...NAV, ...ADMIN_NAV] : [...NAV]

  return (
    <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-4">
      {items.map(({ href, label, icon: Icon, ...rest }) => {
        const active = pathname === href || pathname.startsWith(href + '/')
        const showBadge = 'badge' in rest && rest.badge && pendingCount > 0
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-semibold uppercase tracking-wide transition-colors',
              active
                ? 'bg-slate-700 text-white'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white',
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="flex-1">{label}</span>
            {showBadge && (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                {pendingCount > 99 ? '99+' : pendingCount}
              </span>
            )}
          </Link>
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
