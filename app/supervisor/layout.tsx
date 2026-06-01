import { Inter } from 'next/font/google'
import { redirect } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { getUser } from '@/lib/auth/get-user'
import { createClient } from '@/lib/supabase/server'
import { SupervisorNav } from '@/components/supervisor/supervisor-nav'

const inter = Inter({ subsets: ['latin'] })

async function signOut() {
  'use server'
  const supabase = createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export default async function SupervisorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const auth = await getUser()
  if (!auth) redirect('/login')
  if (auth.perfil.role !== 'supervisor') redirect('/dashboard')

  const displayName = auth.perfil.nome ?? auth.perfil.email ?? 'Supervisor'

  return (
    <div className={`${inter.className} min-h-screen bg-gray-50`}>
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <div>
            <p className="text-sm font-bold text-gray-900">{displayName}</p>
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
              Supervisor
            </p>
          </div>
          <form action={signOut}>
            <button
              type="submit"
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-widest text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </button>
          </form>
        </div>
      </header>

      <SupervisorNav />

      <main className="mx-auto max-w-5xl px-4 py-6">
        {children}
      </main>
    </div>
  )
}
