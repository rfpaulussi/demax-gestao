import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth/get-user'
import { createClient } from '@/lib/supabase/server'
import { PostosDashboard } from '@/components/supervisor/postos-dashboard'
import type { PostoData } from '@/components/supervisor/postos-dashboard'

export default async function MeuPostoPage() {
  const auth = await getUser()
  if (!auth) redirect('/login')

  const supabase = createClient()

  const { data: configs } = await supabase
    .from('config_supervisores_postos')
    .select(`
      posto_id,
      postos!posto_id ( id, nome, secretaria, efetivo_previsto )
    `)
    .eq('supervisor_id', auth.user.id)
    .eq('ativo', true)

  if (!configs?.length) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Meu Posto</h1>
          <p className="text-sm text-gray-400">Nenhum posto vinculado ao seu perfil.</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-10 text-center text-sm text-gray-400 shadow-sm">
          Entre em contato com o administrador para vincular postos ao seu perfil.
        </div>
      </div>
    )
  }

  const postoIds = configs.map(c => c.posto_id)

  const { data: funcionarios } = await supabase
    .from('funcionarios')
    .select('id, nome, status, posto_id, funcoes!funcao_id ( nome )')
    .in('posto_id', postoIds)
    .neq('status', 'desligado')
    .order('nome')

  const postos: PostoData[] = configs.map(c => {
    const p = c.postos as unknown as {
      id: string; nome: string; secretaria: string | null; efetivo_previsto: number | null
    }
    const funcs = (funcionarios ?? []).filter(f => f.posto_id === p.id)
    const ativosCount = funcs.filter(f => f.status === 'ativo').length
    const previsto    = p.efetivo_previsto ?? 0
    const diff        = ativosCount - previsto

    return {
      posto: { id: p.id, nome: p.nome, secretaria: p.secretaria, efetivo_previsto: previsto },
      funcionarios: funcs.map(f => ({
        id:          f.id,
        nome:        f.nome,
        status:      f.status as string,
        funcao_nome: (f.funcoes as unknown as { nome: string } | null)?.nome ?? null,
      })),
      ativosCount,
      situacao: diff === 0 ? 'completo' : diff < 0 ? 'deficit' : 'excesso',
    }
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Meu Posto</h1>
        <p className="text-sm text-gray-400">Situação atual dos postos sob sua supervisão</p>
      </div>
      <PostosDashboard postos={postos} />
    </div>
  )
}
