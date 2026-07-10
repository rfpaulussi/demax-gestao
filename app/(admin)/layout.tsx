import { Inter } from 'next/font/google'
import { redirect } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { getUser } from '@/lib/auth/get-user'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { SidebarNav } from '@/components/admin/sidebar-nav'
import { NotificacoesBell } from '@/components/admin/notificacoes-bell'
import type { LogAcao } from '@/components/admin/notificacoes-bell'
import { SupervisorBell } from '@/components/admin/supervisor-bell'
import type { SolicitacaoNotif } from '@/components/admin/supervisor-bell'
import { ROLE_LABELS } from '@/types'
import type { Role } from '@/types'

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
  const roleLabel = perfil.role ? (ROLE_LABELS[perfil.role as keyof typeof ROLE_LABELS] ?? '') : ''

  const isAdminOrCoord = perfil.role === 'admin' || perfil.role === 'coordenador'

  const supabaseLayout = createClient()

  const { count: pendingCount } = await supabaseLayout
    .from('solicitacoes')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pendente')

  // Conta funções em uso por funcionários ativos que não têm custos_funcoes
  let alertCount = 0
  if (isAdminOrCoord) {
    const [{ data: comCusto }, { data: funcUsadas }] = await Promise.all([
      supabaseLayout.from('custos_funcoes').select('funcao_id'),
      supabaseLayout.from('funcionarios').select('funcao_id').is('data_desligamento', null).not('funcao_id', 'is', null),
    ])
    const comCustoSet = new Set((comCusto ?? []).map(r => r.funcao_id as string))
    const funcUsadasSet = new Set((funcUsadas ?? []).map(r => r.funcao_id as string))
    alertCount = Array.from(funcUsadasSet).filter(id => !comCustoSet.has(id)).length
  }

  // Notificações de ações de supervisores (só para admin/coordenador)
  let notifUnread = 0
  let notifLogs: LogAcao[] = []
  if (isAdminOrCoord) {
    const admin = createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adminAny = admin as any
    const [{ count }, { data: logsData }] = await Promise.all([
      adminAny.from('log_supervisor_acoes').select('*', { count: 'exact', head: true }).eq('lido', false),
      adminAny.from('log_supervisor_acoes').select('id, created_at, supervisor_nome, tipo, acao, funcionario_nome, detalhes, lido').order('created_at', { ascending: false }).limit(30),
    ])
    notifUnread = count ?? 0
    notifLogs   = (logsData ?? []) as LogAcao[]
  }

  // Notificações de solicitações processadas (só para supervisor)
  let supNotifUnread = 0
  let supNotifs: SolicitacaoNotif[] = []
  if (perfil.role === 'supervisor') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createClient() as any
    const [{ count: cnt }, { data: solsData }] = await Promise.all([
      sb.from('solicitacoes')
        .select('*', { count: 'exact', head: true })
        .eq('supervisor_id', perfil.id)
        .neq('status', 'pendente')
        .eq('lida_supervisor', false),
      sb.from('solicitacoes')
        .select('id, tipo, status, created_at, observacao_admin, lida_supervisor, funcionarios!funcionario_id(nome)')
        .eq('supervisor_id', perfil.id)
        .neq('status', 'pendente')
        .order('created_at', { ascending: false })
        .limit(30),
    ])
    supNotifUnread = cnt ?? 0
    supNotifs = ((solsData ?? []) as {
      id: string; tipo: string; status: string; created_at: string | null
      observacao_admin: string | null; lida_supervisor: boolean
      funcionarios: { nome: string | null } | null
    }[]).map(s => ({
      id: s.id, tipo: s.tipo, status: s.status, created_at: s.created_at,
      observacao_admin: s.observacao_admin, lida_supervisor: s.lida_supervisor,
      funcionario_nome: s.funcionarios?.nome ?? null,
    }))
  }

  return (
    <div className={`${inter.className} min-h-screen bg-gray-50`}>
      <SidebarNav role={perfil.role as Role | null} pendingCount={pendingCount ?? 0} alertCount={alertCount} />

      {/* Content area — offset by sidebar width on desktop */}
      <div className="flex min-h-screen flex-col md:pl-64">

        {/* Top header */}
        <header className="sticky top-0 z-20 flex h-12 items-center border-b border-gray-200 bg-white px-4 md:px-6">
          {/* Spacer keeps header content from overlapping mobile hamburger */}
          <div className="w-10 shrink-0 md:hidden" aria-hidden />

          <div className="ml-auto flex items-center gap-2">
            <div className="hidden items-center gap-1.5 rounded-lg bg-slate-50 px-3 py-1.5 sm:flex">
              <span className="text-xs font-semibold text-slate-500">
                {new Date().toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })}
              </span>
            </div>

            <div className="h-6 w-px bg-gray-200 hidden sm:block" aria-hidden />

            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold text-gray-900">{displayName}</p>
              {roleLabel && (
                <p className="text-xs uppercase tracking-widest text-gray-400">
                  {roleLabel}
                </p>
              )}
            </div>

            {isAdminOrCoord && (
              <NotificacoesBell unread={notifUnread} logs={notifLogs} />
            )}
            {perfil.role === 'supervisor' && (
              <SupervisorBell unread={supNotifUnread} notifs={supNotifs} />
            )}

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

        <main className="flex-1 p-3 md:p-4">{children}</main>
      </div>
    </div>
  )
}
