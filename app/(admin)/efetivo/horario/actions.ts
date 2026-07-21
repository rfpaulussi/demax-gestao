'use server'

import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/auth/get-user'
import { revalidatePath } from 'next/cache'
import { resolverTipoEscala } from '@/lib/turnos/escala'

export async function listarTurnosDoPosto(postoId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('turnos_postos')
    .select('id, nome, hora_entrada, hora_saida_seg_qui, hora_saida_sex, hora_inicio_almoco, hora_fim_almoco, tipo_escala')
    .eq('posto_id', postoId)
    .eq('ativo', true)
    .order('hora_entrada')
  if (error) throw new Error(error.message)
  return data ?? []
}

/** Os dois turnos globais de jovem aprendiz (Manhã/Tarde) — sem posto_id, fixos, semeados via migração. */
export async function listarTurnosJovemAprendiz() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('turnos_postos')
    .select('id, nome, hora_entrada, hora_saida_seg_qui, hora_saida_sex, hora_inicio_almoco, hora_fim_almoco, tipo_escala')
    .is('posto_id', null)
    .eq('tipo_escala', 'jovem_aprendiz')
    .eq('ativo', true)
    .order('hora_entrada')
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function alterarTurno(
  funcionarioId: string,
  turnoId: string,
  dataInicio: string,
  diaCurso?: number,
) {
  const auth = await getUser()
  if (!auth || !['admin', 'coordenador'].includes(auth.perfil.role ?? '')) {
    return { success: false, error: 'Acesso negado' }
  }
  const supabase = createClient()

  const { data: turnoNovo, error: errTurnoNovo } = await supabase
    .from('turnos_postos')
    .select('tipo_escala')
    .eq('id', turnoId)
    .single()
  if (errTurnoNovo || !turnoNovo) return { success: false, error: 'Turno não encontrado' }

  const ehJovemAprendiz = resolverTipoEscala(turnoNovo.tipo_escala) === 'jovem_aprendiz'
  if (ehJovemAprendiz && !diaCurso) {
    return { success: false, error: 'Informe o dia de curso' }
  }

  // Fechar horário vigente, se houver
  const { data: vigente } = await supabase
    .from('horarios_funcionarios')
    .select('id, turno_id, data_inicio')
    .eq('funcionario_id', funcionarioId)
    .is('data_fim', null)
    .maybeSingle()

  if (vigente && dataInicio <= vigente.data_inicio) {
    const [y, m, d] = vigente.data_inicio.split('-')
    return {
      success: false,
      error: `A data de início deve ser posterior a ${d}/${m}/${y} (início do turno vigente).`,
    }
  }

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
    dia_curso: ehJovemAprendiz ? diaCurso : null,
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

export async function deletarHorarioFuncionario(id: string) {
  const auth = await getUser()
  if (!auth || !['admin', 'coordenador'].includes(auth.perfil.role ?? '')) {
    return { success: false, error: 'Acesso negado' }
  }
  const supabase = createClient()

  const { data: registro, error: errFetch } = await supabase
    .from('horarios_funcionarios')
    .select('id, data_fim, funcionario_id')
    .eq('id', id)
    .single()

  if (errFetch || !registro) return { success: false, error: 'Registro não encontrado' }
  if (!registro.data_fim) return { success: false, error: 'Não é possível excluir o horário vigente' }

  const { error } = await supabase
    .from('horarios_funcionarios')
    .delete()
    .eq('id', id)

  if (error) return { success: false, error: error.message }

  revalidatePath(`/efetivo/${registro.funcionario_id}`)
  return { success: true }
}
