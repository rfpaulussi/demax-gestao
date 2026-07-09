import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getUser } from '@/lib/auth/get-user'
import { NovaConvencaoForm } from './nova-form'

export default async function NovaConvencaoPage() {
  const auth = await getUser()
  if (!auth) redirect('/login')
  if (!['admin', 'coordenador'].includes(auth.perfil.role ?? '')) redirect('/dashboard')

  return (
    <div className="max-w-2xl space-y-6">
      <Link href="/convencoes" className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-900">
        <ArrowLeft className="h-4 w-4" /> Voltar às Convenções
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Nova Convenção Coletiva</h1>
        <p className="mt-1 text-sm text-gray-500">
          Preencha os dados gerais. Após salvar, você poderá inserir os valores por função.
        </p>
      </div>

      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <NovaConvencaoForm />
      </div>
    </div>
  )
}
