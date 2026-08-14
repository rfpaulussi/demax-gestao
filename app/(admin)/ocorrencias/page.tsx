import { getUser } from '@/lib/auth/get-user'
import { getPainelFuncionarios, getSupervisoresSimples, getAlertas } from './actions'
import { OcorrenciasClient } from '@/components/ocorrencias/ocorrencias-client'

export default async function OcorrenciasPage() {
  const [funcionarios, supervisores, alertas, auth] = await Promise.all([
    getPainelFuncionarios(),
    getSupervisoresSimples(),
    getAlertas(),
    getUser(),
  ])

  const canWrite = auth?.perfil.role === 'admin' || auth?.perfil.role === 'coordenador' || auth?.perfil.role === 'supervisor'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Ocorrências</h1>
        <p className="text-sm text-gray-400">Dossiê do funcionário: advertências, atestados, faltas e ocorrências num só lugar</p>
      </div>

      <OcorrenciasClient
        funcionarios={funcionarios}
        supervisores={supervisores}
        alertasIniciais={alertas}
        currentUserId={auth?.user.id ?? null}
        canWrite={canWrite}
      />
    </div>
  )
}
