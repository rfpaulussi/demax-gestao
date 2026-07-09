'use server'

import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/auth/get-user'
import { revalidatePath } from 'next/cache'

function requireAdminOrCoord(role: string | null) {
  if (!role || !['admin', 'coordenador'].includes(role)) {
    throw new Error('Acesso negado')
  }
}

export async function listarFuncoes() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('funcoes')
    .select('id, nome, salario_base, insalubridade_perc, insalubridade_valor, periculosidade_perc, periculosidade_valor')
    .eq('ativo', true)
    .order('nome')
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function atualizarSalarioFuncao(
  funcaoId: string,
  dados: {
    salario_base: number
    insalubridade_perc: number
    insalubridade_valor: number
    periculosidade_perc: number
    periculosidade_valor: number
  }
) {
  const auth = await getUser()
  requireAdminOrCoord(auth?.perfil.role ?? null)

  const supabase = createClient()
  const { error } = await supabase
    .from('funcoes')
    .update({
      salario_base:         dados.salario_base,
      insalubridade_perc:   dados.insalubridade_perc,
      insalubridade_valor:  dados.insalubridade_valor,
      periculosidade_perc:  dados.periculosidade_perc,
      periculosidade_valor: dados.periculosidade_valor,
      updated_at:           new Date().toISOString(),
    })
    .eq('id', funcaoId)

  if (error) return { success: false as const, error: error.message }

  revalidatePath('/funcoes')
  return { success: true as const }
}
