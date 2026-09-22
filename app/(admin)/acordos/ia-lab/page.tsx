import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getUser } from '@/lib/auth/get-user'
import { iaConfigurada } from '@/lib/acordos/ia/cliente'
import { buscarPostosParaAcordo } from '../actions'
import { IaLab } from '@/components/acordos/ia-lab'
import { isAdminOrCoord, type Role } from '@/types/roles'

export const dynamic = 'force-dynamic'

export default async function IaLabPage() {
  const auth = await getUser()
  if (!auth || !isAdminOrCoord(auth.perfil.role as Role)) notFound()
  const postos = await buscarPostosParaAcordo()
  return (
    <div className="space-y-6">
      <div>
        <Link href="/acordos" className="mb-2 inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800">
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar para Acordos
        </Link>
        <h1 className="text-lg font-bold text-gray-900">Laboratório da IA — Acordos</h1>
        <p className="text-sm text-gray-400">
          Teste como a IA interpreta pedidos em texto livre. Dry-run: nada é gravado e nenhum acordo é criado.
        </p>
      </div>
      <IaLab configurada={iaConfigurada()} postos={postos.map(p => ({ id: p.id, nome: p.nome }))} />
    </div>
  )
}
