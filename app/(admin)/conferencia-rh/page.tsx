import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth/get-user'
import { createClient } from '@/lib/supabase/server'
import { UploadForm } from '@/components/conferencia-rh/upload-form'
import { ConfigCodigos } from '@/components/conferencia-rh/config-codigos'
import { isAdminOrCoord, type Role } from '@/types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyQ = { from: (t: string) => any }

export default async function ConferenciaRHPage() {
  const auth = await getUser()
  if (!auth) redirect('/login')
  if (!isAdminOrCoord(auth.perfil.role as Role)) redirect('/dashboard')

  const supabase = createClient()
  const [{ data: codigosRaw, error: errCodigos }, { data: supervisoresRaw, error: errSupervisores }] = await Promise.all([
    (supabase as unknown as AnyQ).from('config_codigos_rh').select('codigo, apelido, supervisor_id').order('codigo'),
    supabase.from('perfis').select('id, nome').in('role', ['supervisor', 'admin']).eq('ativo', true).order('nome'),
  ])

  if (errCodigos || errSupervisores) {
    console.error('[conferencia-rh] erro ao carregar dados iniciais', { errCodigos, errSupervisores })
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Conferência RH</h1>
          <p className="text-sm text-gray-400">Compara a listagem de ativos/afastados do RH com o efetivo cadastrado no sistema</p>
        </div>
        <div className="rounded-xl border border-red-100 bg-red-50 p-5 text-sm text-red-700 shadow-sm">
          Não foi possível carregar os dados desta página ({errCodigos?.message ?? errSupervisores?.message ?? 'erro desconhecido'}).
          Tente recarregar a página; se o problema persistir, contate o suporte.
        </div>
      </div>
    )
  }

  type ConfigCodigo = { codigo: number; apelido: string; supervisor_id: string | null }
  const codigos = (codigosRaw ?? []) as unknown as ConfigCodigo[]
  const supervisoresApelidos = codigos.map(c => c.apelido)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Conferência RH</h1>
        <p className="text-sm text-gray-400">Compara a listagem de ativos/afastados do RH com o efetivo cadastrado no sistema</p>
      </div>

      <UploadForm supervisoresApelidos={supervisoresApelidos} />

      {auth.perfil.role === 'admin' && (
        <ConfigCodigos codigos={codigos} supervisores={(supervisoresRaw ?? []) as { id: string; nome: string | null }[]} />
      )}
    </div>
  )
}
