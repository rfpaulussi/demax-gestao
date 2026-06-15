'use client'

import { usePathname } from 'next/navigation'
import { NAV_GROUPS } from './nav-config'

export function AdminBreadcrumb() {
  const pathname = usePathname()

  let groupLabel: string | null = null
  let pageLabel: string | null = null

  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      if (pathname === item.href || pathname.startsWith(item.href + '/')) {
        groupLabel = group.label
        pageLabel  = item.label
        break
      }
    }
    if (groupLabel) break
  }

  if (!groupLabel || !pageLabel) return null

  return (
    <nav className="flex items-center gap-1.5 text-sm">
      <span className="font-normal text-gray-400">{groupLabel}</span>
      <span className="text-gray-300">/</span>
      <span className="font-medium text-gray-700">{pageLabel}</span>
    </nav>
  )
}
