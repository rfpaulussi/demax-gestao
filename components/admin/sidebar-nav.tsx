'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  ArrowLeftRight,
  Calendar,
  AlertTriangle,
  Shield,
  FileText,
  AlertCircle,
  UserCog,
  Menu,
} from 'lucide-react'
import { Sheet, SheetContent, SheetClose } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import type { Role } from '@/types'

// ─── nav definition ──────────────────────────────────────────────────────────

const NAV = [
  { href: '/dashboard',     label: 'Dashboard',     icon: LayoutDashboard },
  { href: '/efetivo',       label: 'Efetivo',       icon: Users           },
  { href: '/coberturas',    label: 'Coberturas',    icon: ArrowLeftRight  },
  { href: '/ferias',        label: 'Férias',        icon: Calendar        },
  { href: '/advertencias',  label: 'Advertências',  icon: AlertTriangle   },
  { href: '/insalubridade', label: 'Insalubridade', icon: Shield          },
  { href: '/medicao',       label: 'Medição',       icon: FileText        },
  { href: '/ocorrencias',   label: 'Ocorrências',   icon: AlertCircle     },
] as const

const ADMIN_NAV = [{ href: '/usuarios', label: 'Usuários', icon: UserCog }] as const

// ─── shared nav content ──────────────────────────────────────────────────────

function NavLinks({
  role,
  onNavigate,
}: {
  role: Role | null
  onNavigate?: () => void
}) {
  const pathname = usePathname()
  const items = role === 'admin' ? [...NAV, ...ADMIN_NAV] : NAV

  return (
    <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-4">
      {items.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + '/')
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-semibold uppercase tracking-wide transition-colors',
              active
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900',
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}

function SidebarHeader() {
  return (
    <div className="flex h-16 shrink-0 items-center border-b border-gray-100 px-6">
      <span className="text-sm font-black uppercase tracking-widest text-gray-900">
        DEMAX
      </span>
    </div>
  )
}

// ─── main component ──────────────────────────────────────────────────────────

export function SidebarNav({ role }: { role: Role | null }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Mobile: hamburger triggers Sheet */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Abrir menu"
        className="fixed left-4 top-4 z-50 rounded-lg p-1.5 text-gray-600 transition-colors hover:bg-gray-100 md:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile: Sheet sidebar */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="pt-0">
          <SheetClose />
          <SidebarHeader />
          <NavLinks role={role} onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Desktop: fixed sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-gray-100 bg-white md:flex">
        <SidebarHeader />
        <NavLinks role={role} />
      </aside>
    </>
  )
}
