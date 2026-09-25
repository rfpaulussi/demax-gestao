import { getUser } from '@/lib/auth/get-user'
import { getPainelFuncionarios, getSupervisoresSimples, getAlertas } from './actions'
import { OcorrenciasClient } from '@/components/ocorrencias/ocorrencias-client'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function OcorrenciasPage({ searchParams }: { searchParams: { f?: string } }) {
  const [funcionarios, supervisores, alertas, auth] = await Promise.all([
    getPainelFuncionarios(),
    getSupervisoresSimples(),
    getAlertas(),
    getUser(),
  ])

  const canWrite = auth?.perfil.role === 'admin' || auth?.perfil.role === 'coordenador' || auth?.perfil.role === 'supervisor'
  const ehGestao = auth?.perfil.role === 'admin' || auth?.perfil.role === 'coordenador'
  const funcionarioInicial = searchParams.f && UUID_RE.test(searchParams.f) ? searchParams.f : null

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
        ehGestao={ehGestao}
        funcionarioInicial={funcionarioInicial}
      />
    </div>
  )
}
