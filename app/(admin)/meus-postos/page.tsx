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

  const [dados, { data: funcoesRaw }, { data: spAfastadosRaw }] = await Promise.all([
    buscarDadosSupervisor(auth.user.id, 14),
    supabase.from('funcoes').select('id, nome').order('nome'),
    supabase
      .from('config_supervisores_postos')
      .select('postos!posto_id(id, nome, secretaria, efetivo_previsto, cota_insalubridade)')
      .eq('supervisor_id', auth.user.id)
      .eq('ativo', true),
  ])

  type SpAfastadosRow = { postos: { id: string; nome: string; secretaria: string | null; efetivo_previsto: number | null; cota_insalubridade: number | null } | null }
  const afastadosPostos = ((spAfastadosRaw ?? []) as unknown as SpAfastadosRow[])
    .map(r => r.postos)
    .filter(p => p && (p.secretaria ?? '').toUpperCase() === 'AFASTADOS') as { id: string; nome: string; secretaria: string | null; efetivo_previsto: number | null; cota_insalubridade: number | null }[]

  const afastadosPostoIds = afastadosPostos.map(p => p.id)
  const { data: afastadosFuncs } = afastadosPostoIds.length > 0
    ? await supabase.from('funcionarios').select('posto_id').in('posto_id', afastadosPostoIds).eq('status', 'afastado')
    : { data: [] }

  const afastadosPorPosto: Record<string, number> = {}
  for (const f of afastadosFuncs ?? []) {
    const pid = f.posto_id as string
    afastadosPorPosto[pid] = (afastadosPorPosto[pid] ?? 0) + 1
  }

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

  const supervisorNome = auth.perfil.nome ?? null

  // Converte SupervisorPostoKpi → PostoRow (formato esperado pelo PostosClient)
  const postosOperacionais: PostoRow[] = dados.postos.map(p => ({
    id: p.id,
    nome: p.nome,
    secretaria: p.secretaria ?? '',
    efetivo_previsto: p.efetivo_previsto,
    cota_insalubridade: p.cota_insalubridade,
    ativo: true,
    efetivo_atual: p.ativos,
    insalubridade_atual: p.insalubridade,
    em_ferias: p.ferias,
    supervisor_nome: supervisorNome,
    cobertura_como_origem: false,
    cobertura_como_destino: false,
  }))

  // Inclui postos AFASTADOS para mostrar no KPI de excesso
  const postosAfastadosRows: PostoRow[] = afastadosPostos.map(p => ({
    id: p.id,
    nome: p.nome,
    secretaria: 'AFASTADOS',
    efetivo_previsto: p.efetivo_previsto ?? 0,
    cota_insalubridade: p.cota_insalubridade ?? 0,
    ativo: true,
    efetivo_atual: afastadosPorPosto[p.id] ?? 0,
    insalubridade_atual: 0,
    em_ferias: 0,
    supervisor_nome: supervisorNome,
    cobertura_como_origem: false,
    cobertura_como_destino: false,
  }))

  const postos: PostoRow[] = [...postosOperacionais, ...postosAfastadosRows]

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
