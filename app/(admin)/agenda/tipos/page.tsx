import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getUser } from '@/lib/auth/get-user'
import { agendaDisponivel, listarTiposFoco } from '../actions'
import { TiposFocoAdmin } from '@/components/agenda/tipos-foco-admin'

export const dynamic = 'force-dynamic'

export default async function TiposFocoPage() {
  const auth = await getUser()
  if (!auth) redirect('/login')
  if (auth.perfil.role !== 'admin') redirect('/agenda')

  const disponivel = await agendaDisponivel()
  const tipos = disponivel ? await listarTiposFoco() : []

  return (
    <div className="space-y-5 p-6">
      <div>
        <Link href="/agenda" className="text-xs font-semibold text-slate-500 hover:text-slate-900">← Agenda</Link>
        <h1 className="text-2xl font-bold text-slate-900">Tipos de foco</h1>
        <p className="text-sm text-slate-500">Categorias usadas pelos supervisores para classificar cada bloco da agenda.</p>
      </div>
      {disponivel ? (
        <TiposFocoAdmin tipos={tipos} />
      ) : (
        <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">Aplique a migração 20261011_agenda_semanal.sql primeiro.</p>
      )}
    </div>
  )
}
