import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getUser } from '@/lib/auth/get-user'
import { addMeses, hojeBR, mesValido } from '@/lib/agenda/datas'
import { carregarRelatorioMensal } from '../relatorio-actions'
import { RelatorioMensal } from '@/components/agenda/relatorio-mensal'

export const dynamic = 'force-dynamic'

export default async function RelatorioAgendaPage({ searchParams }: { searchParams: { mes?: string } }) {
  const auth = await getUser()
  if (!auth) redirect('/login')
  if (auth.perfil.role !== 'admin' && auth.perfil.role !== 'coordenador') redirect('/agenda')

  const mes = mesValido(searchParams.mes) ? searchParams.mes : hojeBR().slice(0, 7)
  const [r, anterior] = await Promise.all([
    carregarRelatorioMensal(mes),
    carregarRelatorioMensal(addMeses(mes, -1)),
  ])

  return (
    <div className="space-y-4 p-6">
      <Link href="/agenda" className="text-xs font-semibold text-slate-500 hover:text-slate-900 print:hidden">← Agenda</Link>
      {r.ok ? (
        <RelatorioMensal dados={r.dados} anterior={anterior.ok ? anterior.dados : null} />
      ) : (
        <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">{r.erro}</p>
      )}
    </div>
  )
}
