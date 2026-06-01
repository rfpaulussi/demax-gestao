import { Inter } from 'next/font/google'
import { redirect } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { getUser } from '@/lib/auth/get-user'
import { createClient } from '@/lib/supabase/server'
import { SidebarNav } from '@/components/admin/sidebar-nav'
import { ROLE_LABELS } from '@/types'

const inter = Inter({ subsets: ['latin'] })

async function signOut() {
  'use server'
  const supabase = createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const auth = await getUser()
  if (!auth) redirect('/login')

  const { perfil } = auth
  const displayName = perfil.nome ?? perfil.email ?? 'Usuário'
  const roleLabel = perfil.role ? ROLE_LABELS[perfil.role] : ''

  return (
    <div className={`${inter.className} min-h-screen bg-gray-50`}>
      <SidebarNav role={perfil.role} />

      {/* Content area — offset by sidebar width on desktop */}
      <div className="flex min-h-screen flex-col md:pl-64">

        {/* Top header */}
        <header className="sticky top-0 z-20 flex h-16 items-center border-b border-gray-200 bg-white px-4 md:px-6">
          {/* Spacer keeps header content from overlapping mobile hamburger */}
          <div className="w-10 shrink-0 md:hidden" aria-hidden />

          <div className="ml-auto flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold text-gray-900">{displayName}</p>
              {roleLabel && (
                <p className="text-xs uppercase tracking-widest text-gray-400">
                  {roleLabel}
                </p>
              )}
            </div>

            <div className="h-6 w-px bg-gray-200 hidden sm:block" aria-hidden />

            <form action={signOut}>
              <button
                type="submit"
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-widest text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600"
                title="Sair da conta"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Sair</span>
              </button>
            </form>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  )
}
