'use server'

import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/auth/get-user'
import { revalidatePath } from 'next/cache'

export async function listarTurnosDoPosto(postoId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('turnos_postos')
    .select('id, nome, hora_entrada, hora_saida_seg_qui, hora_saida_sex, hora_inicio_almoco, hora_fim_almoco')
    .eq('posto_id', postoId)
    .eq('ativo', true)
    .order('hora_entrada')
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function alterarTurno(
  funcionarioId: string,
  turnoId: string,
  dataInicio: string,
) {
  const auth = await getUser()
  if (!auth || !['admin', 'coordenador'].includes(auth.perfil.role ?? '')) {
    return { success: false, error: 'Acesso negado' }
  }
  const supabase = createClient()

  // Fechar horário vigente, se houver
  const { data: vigente } = await supabase
    .from('horarios_funcionarios')
    .select('id, turno_id')
    .eq('funcionario_id', funcionarioId)
    .is('data_fim', null)
    .maybeSingle()

  if (vigente) {
    const d = new Date(dataInicio + 'T12:00:00')
    d.setDate(d.getDate() - 1)
    const dataFim = d.toISOString().split('T')[0]
    const { error: errClose } = await supabase
      .from('horarios_funcionarios')
      .update({ data_fim: dataFim })
      .eq('id', vigente.id)
    if (errClose) return { success: false, error: errClose.message }
  }

  // Inserir novo registro
  const { error } = await supabase.from('horarios_funcionarios').insert({
    funcionario_id: funcionarioId,
    turno_id: turnoId,
    data_inicio: dataInicio,
    criado_por: auth.user.id,
  })
  if (error) return { success: false, error: error.message }

  // Registrar movimentação
  await supabase.from('movimentacoes').insert({
    funcionario_id: funcionarioId,
    tipo: 'mudanca_horario',
    campo_alterado: 'turno_id',
    valor_antes: vigente?.turno_id ?? null,
    valor_depois: turnoId,
    executado_por: auth.user.id,
  })

  revalidatePath(`/efetivo/${funcionarioId}`)
  return { success: true }
}
