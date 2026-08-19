import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth/get-user'
import { isAdminOrCoord, type Role } from '@/types'
import { UploadForm } from '@/components/auditoria-atestados/upload-form'

export default async function AuditoriaAtestadosPage() {
  const auth = await getUser()
  if (!auth) redirect('/login')
  if (!isAdminOrCoord(auth.perfil.role as Role)) redirect('/dashboard')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Auditoria SESMT × Atestados</h1>
        <p className="text-sm text-gray-400">
          Envie a planilha exportada do sistema de segurança e medicina do trabalho pra comparar com os
          atestados lançados no sistema.
        </p>
      </div>
      <UploadForm />
    </div>
  )
}
