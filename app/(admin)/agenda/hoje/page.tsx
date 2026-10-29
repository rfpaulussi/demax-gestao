import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getUser } from '@/lib/auth/get-user'
import { carregarHoje } from '../hoje-actions'
import { HojeEmCampo } from '@/components/agenda/hoje-em-campo'

export const dynamic = 'force-dynamic'

export default async function HojeEmCampoPage() {
  const auth = await getUser()
  if (!auth) redirect('/login')
  if (auth.perfil.role !== 'admin' && auth.perfil.role !== 'coordenador') redirect('/agenda')

  const r = await carregarHoje()

  return (
    <div className="space-y-4 p-6">
      <Link href="/agenda" className="text-xs font-semibold text-slate-500 hover:text-slate-900">← Agenda</Link>
      {r.ok ? (
        <HojeEmCampo dados={r.dados} />
      ) : (
        <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">{r.erro}</p>
      )}
    </div>
  )
}
