'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getUser } from '@/lib/auth/get-user'
import { revalidatePath } from 'next/cache'
import { executarAlteracaoTurno } from '@/app/(admin)/efetivo/horario/actions'
import { resolverTipoEscala, FUNCAO_JOVEM_APRENDIZ } from '@/lib/turnos/escala'

/**
 * Atribui o primeiro horário de um funcionário sem vigência — a única escrita em
 * horarios_funcionarios liberada para o role supervisor, e só para os postos que ele
 * supervisiona (config_supervisores_postos). A RLS de horarios_funcionarios/movimentacoes
 * só permite escrita de admin/coordenador, então a gravação usa o client de service role,
 * depois de toda a autorização ter sido validada aqui (role, posto, turno e ausência de
 * vigente) com o client do usuário.
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

  const { data: funcionarioRaw, error: errFunc } = await supabase
    .from('funcionarios')
    .select('posto_id, funcoes!funcao_id(nome)')
    .eq('id', funcionarioId)
    .single()
  const funcionario = funcionarioRaw as unknown as { posto_id: string | null; funcoes: { nome: string } | null } | null
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
    .select('posto_id, tipo_escala')
    .eq('id', turnoId)
    .eq('ativo', true)
    .single()
  if (!turno) return { success: false, error: 'Turno não encontrado' }

  // Jovem aprendiz usa só turnos de jovem aprendiz (globais ou do próprio posto);
  // os demais usam só turnos do próprio posto e nunca os de jovem aprendiz.
  const funcionarioEhJovem = funcionario.funcoes?.nome === FUNCAO_JOVEM_APRENDIZ
  const turnoEhJovem = resolverTipoEscala(turno.tipo_escala) === 'jovem_aprendiz'
  const turnoDoPostoOuGlobal = turno.posto_id === funcionario.posto_id || turno.posto_id === null
  if (funcionarioEhJovem) {
    if (!turnoEhJovem || !turnoDoPostoOuGlobal) return { success: false, error: 'Turno inválido para jovem aprendiz' }
  } else if (turnoEhJovem || turno.posto_id !== funcionario.posto_id) {
    return { success: false, error: 'Turno não pertence ao posto do funcionário' }
  }

  const resultado = await executarAlteracaoTurno(
    funcionarioId,
    turnoId,
    dataInicio,
    diaCurso,
    auth.user.id,
    createAdminClient(),
  )
  if (resultado.success) revalidatePath('/pendencias-horario')
  return resultado
}
