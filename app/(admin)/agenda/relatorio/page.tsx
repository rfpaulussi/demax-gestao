import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getUser } from '@/lib/auth/get-user'
import { carregarRelatorioMensal } from '../relatorio-actions'
import { RelatorioMensal } from '@/components/agenda/relatorio-mensal'

export const dynamic = 'force-dynamic'

export default async function RelatorioAgendaPage({ searchParams }: { searchParams: { mes?: string } }) {
  const auth = await getUser()
  if (!auth) redirect('/login')
  if (auth.perfil.role !== 'admin' && auth.perfil.role !== 'coordenador') redirect('/agenda')

  const r = await carregarRelatorioMensal(searchParams.mes)

  return (
    <div className="space-y-4 p-6">
      <Link href="/agenda" className="text-xs font-semibold text-slate-500 hover:text-slate-900">← Agenda</Link>
      {r.ok ? (
        <RelatorioMensal dados={r.dados} />
      ) : (
        <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">{r.erro}</p>
      )}
    </div>
  )
}
