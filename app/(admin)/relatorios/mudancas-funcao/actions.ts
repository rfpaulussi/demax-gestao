'use server'

import { createClient } from '@/lib/supabase/server'

export interface MudancaFuncaoRow {
  id: string
  data_evento: string
  funcionario_nome: string
  cpf: string | null
  funcao_anterior: string
  funcao_nova: string
  posto_nome: string
  secretaria: string
  supervisor: string
}

export async function buscarMudancasFuncao(mes: number, ano: number): Promise<MudancaFuncaoRow[]> {
  const supabase = createClient()

  const pad = (n: number) => String(n).padStart(2, '0')
  const inicio = `${ano}-${pad(mes)}-01`
  const fim    = `${ano}-${pad(mes)}-${new Date(ano, mes, 0).getDate()}`

  const [{ data: historico }, { data: funcoes }, { data: configs }] = await Promise.all([
    supabase
      .from('historico_funcionarios')
      .select(`
        id, funcionario_id, data_evento, dados_anteriores, dados_novos,
        funcionarios!funcionario_id ( nome, cpf, posto_id, postos!posto_id ( nome, secretaria ) )
      `)
      .eq('tipo', 'mudanca_funcao')
      .gte('data_evento', inicio)
      .lte('data_evento', fim)
      .order('data_evento', { ascending: true }),
    supabase.from('funcoes').select('id, nome'),
    supabase
      .from('config_supervisores_postos')
      .select('posto_id, perfis!supervisor_id ( nome )')
      .eq('ativo', true),
  ])

  const funcaoById = new Map<string, string>((funcoes ?? []).map(f => [f.id, f.nome]))

  const supByPosto = new Map<string, string>()
  for (const c of configs ?? []) {
    if (!supByPosto.has(c.posto_id)) {
      supByPosto.set(c.posto_id, (c.perfis as unknown as { nome: string } | null)?.nome ?? '—')
    }
  }

  type FuncJoin = {
    nome: string
    cpf: string | null
    posto_id: string | null
    postos: { nome: string; secretaria: string | null } | null
  }

  return (historico ?? []).map(h => {
    const func          = h.funcionarios as unknown as FuncJoin | null
    const postoId       = func?.posto_id ?? ''
    const postoNome     = func?.postos?.nome ?? '—'
    const secretaria    = func?.postos?.secretaria ?? '—'
    const supervisor    = supByPosto.get(postoId) ?? '—'

    const funcaoAnteriorId = (h.dados_anteriores as { funcao_id?: string } | null)?.funcao_id ?? ''
    const funcaoNovaId     = (h.dados_novos     as { funcao_id?: string } | null)?.funcao_id ?? ''

    return {
      id:              h.id,
      data_evento:     h.data_evento,
      funcionario_nome: func?.nome ?? '—',
      cpf:             func?.cpf ?? null,
      funcao_anterior: funcaoById.get(funcaoAnteriorId) ?? '—',
      funcao_nova:     funcaoById.get(funcaoNovaId)     ?? '—',
      posto_nome:      postoNome,
      secretaria,
      supervisor,
    }
  })
}
