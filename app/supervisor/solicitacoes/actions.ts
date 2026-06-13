'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/auth/get-user'

type ActionResult = { success: true } | { success: false; error: string }

export async function solicitarAdmissao(fd: FormData): Promise<ActionResult> {
  const supabase = createClient()
  const auth = await getUser()
  if (!auth) return { success: false, error: 'Não autenticado' }

  const nome          = (fd.get('nome') as string)?.trim()
  const funcao_id     = fd.get('funcao_id') as string
  const posto_id      = fd.get('posto_id') as string
  const data_admissao = fd.get('data_admissao') as string

  if (!nome)          return { success: false, error: 'Nome obrigatório' }
  if (!funcao_id)     return { success: false, error: 'Função obrigatória' }
  if (!posto_id)      return { success: false, error: 'Posto obrigatório' }
  if (!data_admissao) return { success: false, error: 'Data de admissão obrigatória' }

  const [{ data: funcao }, { data: posto }] = await Promise.all([
    supabase.from('funcoes').select('nome').eq('id', funcao_id).single(),
    supabase.from('postos').select('nome, secretaria').eq('id', posto_id).single(),
  ])

  const postoTyped = posto as unknown as { nome: string; secretaria: string | null } | null

  const { error } = await supabase.from('solicitacoes').insert({
    tipo:           'admissao' as unknown as 'desligamento',
    status:         'pendente',
    supervisor_id:  auth.user.id,
    funcionario_id: null as unknown as string,
    dados_antes:    null,
    dados_depois: {
      nome,
      funcao_id,
      funcao_nome:   funcao?.nome ?? null,
      posto_id,
      posto_nome:    postoTyped?.nome ?? null,
      secretaria:    postoTyped?.secretaria ?? null,
      data_admissao,
    },
  })

  if (error) return { success: false, error: error.message }

  revalidatePath('/supervisor/solicitacoes')
  revalidatePath('/aprovacoes')
  return { success: true }
}
