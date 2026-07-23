'use server'

import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/auth/get-user'
import { revalidatePath } from 'next/cache'
import { isTipoEscalaPosto, type TipoEscalaPosto } from '@/lib/turnos/escala'

export interface TurnoData {
  nome: string
  hora_entrada: string
  hora_inicio_almoco: string | null
  hora_fim_almoco: string | null
  hora_saida_seg_qui: string
  hora_saida_sex: string | null
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

/** Regime de trabalho configurado para o posto em Config Escalas, ou null se ainda não configurado / valor inválido. */
export async function obterRegimePosto(postoId: string): Promise<TipoEscalaPosto | null> {
  const supabase = createClient()
  const { data } = await supabase
    .from('config_escalas_postos')
    .select('regime')
    .eq('posto_id', postoId)
    .maybeSingle()
  const regime = data?.regime
  return isTipoEscalaPosto(regime) ? regime : null
}

export async function criarTurno(postoId: string, dados: TurnoData) {
  const auth = await getUser()
  if (!auth || !['admin', 'coordenador'].includes(auth.perfil.role ?? '')) {
    return { success: false, error: 'Acesso negado' }
  }
  const regime = await obterRegimePosto(postoId)
  if (!regime) {
    return { success: false, error: 'Configure o regime de trabalho deste posto antes de cadastrar turnos.' }
  }
  const supabase = createClient()
  const { error } = await supabase.from('turnos_postos').insert({
    posto_id: postoId,
    nome: dados.nome,
    hora_entrada: dados.hora_entrada,
    tipo_escala: regime,
    hora_inicio_almoco: dados.hora_inicio_almoco,
    hora_fim_almoco: dados.hora_fim_almoco,
    hora_saida_seg_qui: dados.hora_saida_seg_qui,
    hora_saida_sex: dados.hora_saida_sex,
  })
  if (error) return { success: false, error: error.message }
  revalidatePath('/postos')
  return { success: true }
}

export async function editarTurno(id: string, dados: TurnoData) {
  const auth = await getUser()
  if (!auth || !['admin', 'coordenador'].includes(auth.perfil.role ?? '')) {
    return { success: false, error: 'Acesso negado' }
  }
  const supabase = createClient()
  const { error } = await supabase
    .from('turnos_postos')
    .update({
      nome: dados.nome,
      hora_entrada: dados.hora_entrada,
      hora_inicio_almoco: dados.hora_inicio_almoco,
      hora_fim_almoco: dados.hora_fim_almoco,
      hora_saida_seg_qui: dados.hora_saida_seg_qui,
      hora_saida_sex: dados.hora_saida_sex,
    })
    .eq('id', id)
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
