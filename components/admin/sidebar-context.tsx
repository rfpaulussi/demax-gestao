'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { PanelLeftClose, PanelLeftOpen, Menu } from 'lucide-react'

const STORAGE_KEY = 'demax:sidebar-collapsed'

type SidebarCtx = {
  /** Desktop (md+): sidebar fixa recolhida */
  collapsed: boolean
  /** Mobile: gaveta aberta */
  mobileOpen: boolean
  setMobileOpen: (v: boolean) => void
  toggleCollapsed: () => void
}

const Ctx = createContext<SidebarCtx>({
  collapsed: false,
  mobileOpen: false,
  setMobileOpen: () => {},
  toggleCollapsed: () => {},
})

export function useSidebar() {
  return useContext(Ctx)
}

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  // Preferência por aparelho; lida após a hidratação para não divergir do servidor.
  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === '1') setCollapsed(true)
    } catch {}
  }, [])

  const toggleCollapsed = useCallback(() => {
    setCollapsed(prev => {
      const next = !prev
      try { localStorage.setItem(STORAGE_KEY, next ? '1' : '0') } catch {}
      return next
    })
  }, [])

  return (
    <Ctx.Provider value={{ collapsed, mobileOpen, setMobileOpen, toggleCollapsed }}>
      {children}
    </Ctx.Provider>
  )
}

/** Wrapper da área de conteúdo: reserva o espaço da sidebar só quando ela está visível. */
export function SidebarContent({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebar()
  return (
    <div
      className={`flex min-h-screen flex-col transition-[padding] duration-200 ${collapsed ? 'md:pl-0' : 'md:pl-64'}`}
    >
      {children}
    </div>
  )
}

/** Botão do cabeçalho: abre a gaveta no celular, recolhe/expande a sidebar no desktop. */
export function SidebarToggle() {
  const { collapsed, setMobileOpen, toggleCollapsed } = useSidebar()
  const btn = 'rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-100'
  return (
    <>
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        aria-label="Abrir menu"
        className={`${btn} mr-2 md:hidden`}
      >
        <Menu className="h-5 w-5" />
      </button>
      <button
        type="button"
        onClick={toggleCollapsed}
        aria-label={collapsed ? 'Mostrar menu' : 'Recolher menu'}
        title={collapsed ? 'Mostrar menu' : 'Recolher menu'}
        className={`${btn} mr-2 hidden md:block`}
      >
        {collapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
      </button>
    </>
  )
}
