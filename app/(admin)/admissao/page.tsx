import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth/get-user'
import { createClient } from '@/lib/supabase/server'
import { filtroPostoDaFuncao, funcaoAdmissivel } from '@/lib/admissao/funcoes-posto'
import { AssistenteAdmissao } from '@/components/admissao/assistente-admissao'
import { admissaoDisponivel } from './actions'

export const dynamic = 'force-dynamic'

export default async function AdmissaoPage() {
  const auth = await getUser()
  if (!auth) redirect('/login')
  if (auth.perfil.role !== 'supervisor') redirect('/dashboard')

  const cabecalho = (
    <div>
      <h1 className="text-lg font-bold text-gray-900">Admissão</h1>
      <p className="text-sm text-gray-400">
        Prepare o Cadastro, o Vale Transporte e a Lista da Integração para impressão e envie a solicitação para aprovação.
      </p>
    </div>
  )

  if (!(await admissaoDisponivel())) {
    return (
      <div className="space-y-6">
        {cabecalho}
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-900">
          <p className="font-bold">Admissão ainda não habilitada</p>
          <p className="mt-1">
            Aplique a migração <code className="rounded bg-amber-100 px-1">supabase/migrations/20261025_admissao_assistida.sql</code> no
            Supabase Studio (SQL Editor) e recarregue a página.
          </p>
        </div>
      </div>
    )
  }

  const supabase = createClient()
  const [{ data: funcoesRaw }, { data: spRaw }] = await Promise.all([
    supabase.from('funcoes').select('id, nome').order('nome'),
    supabase
      .from('config_supervisores_postos')
      .select('posto_id, postos!posto_id ( id, nome, secretaria )')
      .eq('supervisor_id', auth.user.id)
      .eq('ativo', true),
  ])

  const funcoes = (funcoesRaw ?? [])
    .filter(f => funcaoAdmissivel(f.nome))
    .map(f => ({ id: f.id, nome: f.nome, postoFiltro: filtroPostoDaFuncao(f.nome) }))
  const postos = (spRaw ?? []).map((c: unknown) => {
    const p = (c as { postos: { id: string; nome: string; secretaria: string | null } }).postos
    return { id: p.id, nome: p.nome, secretaria: p.secretaria }
  })

  return (
    <div className="space-y-6">
      {cabecalho}
      {postos.length === 0 ? (
        <p className="rounded-xl border border-gray-200 bg-white p-5 text-sm text-gray-500">
          Você ainda não tem postos vinculados. Peça à gestão para vincular seus postos antes de preparar uma admissão.
        </p>
      ) : (
        <AssistenteAdmissao postos={postos} funcoes={funcoes} />
      )}
    </div>
  )
}
