'use server'

import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/auth/get-user'
import { revalidatePath } from 'next/cache'
import { executarAlteracaoTurno } from '@/app/(admin)/efetivo/horario/actions'

/**
 * Atribui o primeiro horário de um funcionário sem vigência — a única escrita em
 * horarios_funcionarios liberada para o role supervisor, e só para os postos que ele
 * supervisiona (config_supervisores_postos). Reaproveita a mesma lógica de
 * alterarTurno (admin/coordenador), só troca a checagem de autorização.
 */
export async function atribuirHorarioPendente(
  funcionarioId: string,
  turnoId: string,
  dataInicio: string,
  diaCurso?: number,
): Promise<{ success: boolean; error?: string }> {
  const auth = await getUser()
  if (!auth || !['admin', 'coordenador', 'supervisor'].includes(auth.perfil.role ?? '')) {
    return { success: false, error: 'Acesso negado' }
  }
  const supabase = createClient()

  const { data: funcionario, error: errFunc } = await supabase
    .from('funcionarios')
    .select('posto_id')
    .eq('id', funcionarioId)
    .single()
  if (errFunc || !funcionario?.posto_id) return { success: false, error: 'Funcionário sem posto definido' }

  if (auth.perfil.role === 'supervisor') {
    const { data: vinculo } = await supabase
      .from('config_supervisores_postos')
      .select('posto_id')
      .eq('supervisor_id', auth.user.id)
      .eq('posto_id', funcionario.posto_id)
      .maybeSingle()
    if (!vinculo) return { success: false, error: 'Você não supervisiona o posto deste funcionário' }
  }

  // Esta tela é só para quem ainda não tem horário — troca de horário vigente continua
  // restrita a admin/coordenador em Efetivo, evitando que a tela de pendências vire
  // um segundo caminho de edição.
  const { data: vigente } = await supabase
    .from('horarios_funcionarios')
    .select('id')
    .eq('funcionario_id', funcionarioId)
    .is('data_fim', null)
    .maybeSingle()
  if (vigente) return { success: false, error: 'Funcionário já tem horário vigente' }

  const { data: turno } = await supabase
    .from('turnos_postos')
    .select('posto_id')
    .eq('id', turnoId)
    .single()
  if (!turno || turno.posto_id !== funcionario.posto_id) {
    return { success: false, error: 'Turno não pertence ao posto do funcionário' }
  }

  const resultado = await executarAlteracaoTurno(funcionarioId, turnoId, dataInicio, diaCurso, auth.user.id)
  if (resultado.success) revalidatePath('/pendencias-horario')
  return resultado
}
