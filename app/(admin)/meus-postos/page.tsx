import { getUser } from '@/lib/auth/get-user'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { buscarDadosSupervisor } from '@/app/(admin)/dashboard/actions'
import { PostosClient } from '@/components/postos/postos-client'
import type { PostoRow } from '@/app/(admin)/postos/actions'

export default async function MeusPostosPage() {
  const auth = await getUser()
  if (!auth) redirect('/login')

  if (auth.perfil.role === 'admin' || auth.perfil.role === 'coordenador') {
    redirect('/efetivo')
  }

  const supabase = createClient()

  const [dados, { data: funcoesRaw }] = await Promise.all([
    buscarDadosSupervisor(auth.user.id, 14),
    supabase.from('funcoes').select('id, nome').order('nome'),
  ])

  const funcoes = (funcoesRaw ?? [])
    .filter(f => {
      const n = f.nome.trim().normalize('NFC').toUpperCase()
      return !n.startsWith('SUPERVISOR')
    })
    .map(f => {
      const n = f.nome.trim().normalize('NFC').toUpperCase()
      const postoFiltro =
        (n.startsWith('AGENTE') && n.endsWith(' A')) ? 'apenas_sms' as const :
        n.startsWith('ENCARREGADO')                  ? 'todos'      as const :
                                                       'sem_sms'    as const
      return { id: f.id, nome: f.nome, postoFiltro }
    })

  // Converte SupervisorPostoKpi → PostoRow (formato esperado pelo PostosClient)
  const postos: PostoRow[] = dados.postos.map(p => ({
    id: p.id,
    nome: p.nome,
    secretaria: p.secretaria ?? '',
    efetivo_previsto: p.efetivo_previsto,
    cota_insalubridade: p.cota_insalubridade,
    ativo: true,
    efetivo_atual: p.ativos,
    insalubridade_atual: p.insalubridade,
    em_ferias: p.ferias,
    supervisor_nome: null,
    cobertura_como_origem: false,
    cobertura_como_destino: false,
  }))

  const supervisorPostos = dados.postos.map(p => ({
    id: p.id,
    nome: p.nome,
    secretaria: p.secretaria,
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Meus Postos</h1>
        <p className="text-sm text-gray-400">Efetivo e cobertura dos seus postos</p>
      </div>

      <PostosClient
        postos={postos}
        role="supervisor"
        funcoes={funcoes}
        supervisorPostos={supervisorPostos}
      />
    </div>
  )
}
