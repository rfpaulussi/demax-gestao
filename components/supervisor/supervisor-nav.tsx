'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const TABS = [
  { href: '/supervisor/meu-posto',    label: 'Meu Posto'    },
  { href: '/supervisor/coberturas',   label: 'Coberturas'   },
  { href: '/supervisor/ocorrencias',  label: 'Ocorrências'  },
  { href: '/supervisor/solicitacoes', label: 'Solicitações' },
]

export function SupervisorNav() {
  const pathname = usePathname()

  return (
    <div className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-5xl gap-1 px-4">
        {TABS.map(tab => (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              'flex h-11 items-center border-b-2 px-4 text-xs font-semibold uppercase tracking-widest transition-colors',
              pathname === tab.href
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-400 hover:text-gray-600',
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>
    </div>
  )
}
