import { createClient } from '@/lib/supabase/server'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import type { AuthUser } from '@/lib/auth/get-user'
import type { FuncionarioParaCasar } from './casar-funcionario'

type Linha = {
  id: string
  nome: string
  cpf: string | null
  status: string | null
  posto_id: string | null
  funcoes: { nome: string } | null
  postos: { nome: string } | null
}

/** Funcionários não desligados que o usuário pode ver: admin/coordenador todos; supervisor só os dos postos dele. */
export async function carregarFuncionariosVisiveis(auth: AuthUser): Promise<FuncionarioParaCasar[]> {
  const supabase = createClient()

  const role = auth.perfil.role
  let postoIds: string[] | null = null
  if (role === 'supervisor') {
    const { data } = await supabase
      .from('config_supervisores_postos')
      .select('posto_id')
      .eq('supervisor_id', auth.user.id)
      .eq('ativo', true)
    postoIds = (data ?? []).map(r => r.posto_id as string)
    if (postoIds.length === 0) return []
  } else if (role !== 'admin' && role !== 'coordenador') {
    return []
  }

  const linhas = await fetchAllRows<Linha>((from, to) => {
    let q = supabase
      .from('funcionarios')
      .select('id, nome, cpf, status, posto_id, funcoes!funcao_id(nome), postos!posto_id(nome)')
      .or('status.is.null,status.neq.desligado')
      .not('posto_id', 'is', null) // sem posto não dá para lançar atestado (atestados.posto_id é obrigatório)
      .order('nome')
      .order('id')
      .range(from, to)
    if (postoIds) q = q.in('posto_id', postoIds)
    return q as unknown as PromiseLike<{ data: Linha[] | null; error: { message: string } | null }>
  })

  return linhas.map(l => ({
    id: l.id,
    nome: l.nome,
    cpf: l.cpf,
    postoId: l.posto_id,
    postoNome: l.postos?.nome ?? null,
    funcaoNome: l.funcoes?.nome ?? null,
    status: l.status,
  }))
}
