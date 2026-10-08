import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getUser } from '@/lib/auth/get-user'
import { listarLocais } from '../geo-actions'
import { LocaisCliente } from '@/components/agenda/locais-cliente'

export const dynamic = 'force-dynamic'

export default async function LocaisPage() {
  const auth = await getUser()
  if (!auth) redirect('/login')
  if (auth.perfil.role !== 'admin' && auth.perfil.role !== 'coordenador') redirect('/agenda')

  const r = await listarLocais()

  return (
    <div className="space-y-4 p-6">
      <Link href="/agenda" className="text-xs font-semibold text-slate-500 hover:text-slate-900">← Agenda</Link>
      {r.ok ? (
        <LocaisCliente postos={r.postos} />
      ) : (
        <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">{r.erro}</p>
      )}
    </div>
  )
}
