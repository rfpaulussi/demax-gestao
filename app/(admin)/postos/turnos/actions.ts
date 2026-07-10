'use server'

import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/auth/get-user'
import { revalidatePath } from 'next/cache'

export interface TurnoData {
  nome: string
  hora_entrada: string
  hora_saida_seg_qui: string
  hora_saida_sex: string
  hora_inicio_almoco: string
  hora_fim_almoco: string
}

export async function listarTurnosPosto(postoId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('turnos_postos')
    .select('*')
    .eq('posto_id', postoId)
    .order('hora_entrada')
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function criarTurno(postoId: string, dados: TurnoData) {
  const auth = await getUser()
  if (!auth || !['admin', 'coordenador'].includes(auth.perfil.role ?? '')) {
    return { success: false, error: 'Acesso negado' }
  }
  const supabase = createClient()
  const { error } = await supabase.from('turnos_postos').insert({
    posto_id: postoId,
    ...dados,
  })
  if (error) return { success: false, error: error.message }
  revalidatePath('/postos')
  return { success: true }
}

export async function editarTurno(id: string, dados: Partial<TurnoData>) {
  const auth = await getUser()
  if (!auth || !['admin', 'coordenador'].includes(auth.perfil.role ?? '')) {
    return { success: false, error: 'Acesso negado' }
  }
  const supabase = createClient()
  const { error } = await supabase.from('turnos_postos').update(dados).eq('id', id)
  if (error) return { success: false, error: error.message }
  revalidatePath('/postos')
  return { success: true }
}

export async function desativarTurno(id: string) {
  const auth = await getUser()
  if (!auth || !['admin', 'coordenador'].includes(auth.perfil.role ?? '')) {
    return { success: false, error: 'Acesso negado' }
  }
  const supabase = createClient()
  const { error } = await supabase.from('turnos_postos').update({ ativo: false }).eq('id', id)
  if (error) return { success: false, error: error.message }
  revalidatePath('/postos')
  return { success: true }
}
