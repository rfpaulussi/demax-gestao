import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth/get-user'
import { hojeBR } from '@/lib/agenda/datas'
import { agendaDisponivel, carregarAgenda, carregarVisaoGeral } from './actions'
import { AgendaSupervisor } from '@/components/agenda/agenda-supervisor'
import { VisaoGeral } from '@/components/agenda/visao-geral'

export const dynamic = 'force-dynamic'

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: { semana?: string; supervisor?: string }
}) {
  const auth = await getUser()
  if (!auth) redirect('/login')
  const role = auth.perfil.role
  const gestao = role === 'admin' || role === 'coordenador'
  if (role !== 'supervisor' && !gestao) redirect('/dashboard')

  if (!(await agendaDisponivel())) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-900">
          <p className="font-bold">Agenda ainda não habilitada</p>
          <p className="mt-1">
            Aplique a migração <code className="rounded bg-amber-100 px-1">supabase/migrations/20261011_agenda_semanal.sql</code> no
            Supabase Studio (SQL Editor) e recarregue a página.
          </p>
        </div>
      </div>
    )
  }

  if (gestao && !searchParams.supervisor) {
    const { semanaInicio, cards, tipos } = await carregarVisaoGeral(searchParams.semana)
    return (
      <div className="p-6">
        <VisaoGeral semanaInicio={semanaInicio} cards={cards} tipos={tipos} ehAdmin={role === 'admin'} />
      </div>
    )
  }

  const r = await carregarAgenda(searchParams.semana, searchParams.supervisor)
  if (!r.ok) {
    return (
      <div className="p-6">
        <p className="rounded-xl bg-rose-50 p-4 text-sm font-medium text-rose-700">{r.erro}</p>
      </div>
    )
  }

  return (
    <div className="p-6">
      <AgendaSupervisor dados={r.dados} hoje={hojeBR()} modoGestao={gestao} />
    </div>
  )
}
