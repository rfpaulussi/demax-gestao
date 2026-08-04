'use server'

import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/auth/get-user'
import { revalidatePath } from 'next/cache'
import { resolverTipoEscala, FUNCAO_JOVEM_APRENDIZ } from '@/lib/turnos/escala'

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

  if (vigente && dataInicio < vigente.data_inicio) {
    const [y, m, d] = vigente.data_inicio.split('-')
    return {
      success: false,
      error: `A data de início deve ser posterior a ${d}/${m}/${y} (início do turno vigente).`,
    }
  }

  // Mesma data do vigente: não é uma nova vigência, é correção do que foi lançado no próprio
  // dia — apaga o registro antigo (em vez de fechá-lo com data_fim) para não deixar um período
  // de 1 dia fantasma no histórico.
  const corrigindoMesmoDia = !!vigente && dataInicio === vigente.data_inicio

  if (vigente && corrigindoMesmoDia) {
    const { error: errDelete } = await supabase
      .from('horarios_funcionarios')
      .delete()
      .eq('id', vigente.id)
    if (errDelete) return { success: false, error: errDelete.message }
  } else if (vigente) {
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

export interface FuncionarioLoteRow {
  id: string
  nome: string
  turno_atual_nome: string | null
  turno_atual_desde: string | null
}

export async function listarFuncionariosParaAtribuicaoLote(postoId: string): Promise<FuncionarioLoteRow[]> {
  const auth = await getUser()
  if (!auth || !['admin', 'coordenador'].includes(auth.perfil.role ?? '')) {
    return []
  }
  const supabase = createClient()

  const { data: funcionariosRaw, error } = await supabase
    .from('funcionarios')
    .select('id, nome, funcoes!funcao_id(nome)')
    .eq('posto_id', postoId)
    .eq('status', 'ativo')
    .order('nome')
  if (error) throw new Error(error.message)

  const funcionarios = (funcionariosRaw ?? []) as unknown as { id: string; nome: string; funcoes: { nome: string } | null }[]
  const elegiveis = funcionarios.filter(f => f.funcoes?.nome !== FUNCAO_JOVEM_APRENDIZ)
  if (elegiveis.length === 0) return []

  const { data: vigentesRaw } = await supabase
    .from('horarios_funcionarios')
    .select('funcionario_id, data_inicio, turnos_postos!turno_id(nome)')
    .in('funcionario_id', elegiveis.map(f => f.id))
    .is('data_fim', null)

  const vigentes = (vigentesRaw ?? []) as unknown as { funcionario_id: string; data_inicio: string; turnos_postos: { nome: string } | null }[]
  const vigenteMap = new Map<string, { nome: string; data_inicio: string }>()
  for (const v of vigentes) {
    if (v.turnos_postos) vigenteMap.set(v.funcionario_id, { nome: v.turnos_postos.nome, data_inicio: v.data_inicio })
  }

  return elegiveis.map(f => ({
    id: f.id,
    nome: f.nome,
    turno_atual_nome: vigenteMap.get(f.id)?.nome ?? null,
    turno_atual_desde: vigenteMap.get(f.id)?.data_inicio ?? null,
  }))
}

export async function atribuirTurnoEmLote(
  funcionarioIds: string[],
  turnoId: string,
  dataInicio: string,
): Promise<{ sucesso: string[]; falhas: { funcionarioId: string; erro: string }[] }> {
  const auth = await getUser()
  if (!auth || !['admin', 'coordenador'].includes(auth.perfil.role ?? '')) {
    return { sucesso: [], falhas: funcionarioIds.map(id => ({ funcionarioId: id, erro: 'Acesso negado' })) }
  }

  const sucesso: string[] = []
  const falhas: { funcionarioId: string; erro: string }[] = []
  for (const funcionarioId of funcionarioIds) {
    const res = await alterarTurno(funcionarioId, turnoId, dataInicio)
    if (res.success) sucesso.push(funcionarioId)
    else falhas.push({ funcionarioId, erro: res.error ?? 'Erro desconhecido' })
  }

  revalidatePath('/postos')
  return { sucesso, falhas }
}

/**
 * Fecha o horário vigente do funcionário (se houver) e, quando um novo turno foi informado,
 * já abre o próximo registro na data de efetivação. Chamado na aprovação de transferência,
 * mudança de função e retorno de afastamento — os 3 fluxos que alteram posto_id/funcao_id.
 * Se turnoDestinoId for null (destino ainda sem turno cadastrado no momento do pedido), só
 * fecha o vigente — o funcionário fica pendente de atribuição manual (tela de lote do posto).
 */
export async function aplicarMudancaHorario(
  funcionarioId: string,
  turnoDestinoId: string | null,
  diaCurso: number | null,
  dataEfetivacao: string,
  criadoPor: string,
): Promise<void> {
  // Defesa em profundidade: como o arquivo é 'use server', esta função é uma Server Action
  // invocável diretamente por um cliente. O único chamador hoje (aprovarSolicitacao) já
  // garante admin via assertAdmin() antes de chegar aqui, mas o guard também é aplicado
  // aqui, como nas demais funções deste arquivo.
  const auth = await getUser()
  if (!auth || !['admin', 'coordenador'].includes(auth.perfil.role ?? '')) return

  const supabase = createClient()

  const { data: vigente } = await supabase
    .from('horarios_funcionarios')
    .select('id, turno_id, data_inicio')
    .eq('funcionario_id', funcionarioId)
    .is('data_fim', null)
    .maybeSingle()

  if (vigente) {
    const d = new Date(dataEfetivacao + 'T12:00:00')
    d.setDate(d.getDate() - 1)
    const dataFim = d.toISOString().split('T')[0]
    // Fecha o vigente incondicionalmente: esta função roda automaticamente na aprovação,
    // sem chance de rejeitar o usuário — deixar aberto (mesmo que dataFim < data_inicio,
    // caso raro de vigente com início futuro) resultaria em 2 registros com data_fim NULL.
    await supabase.from('horarios_funcionarios').update({ data_fim: dataFim }).eq('id', vigente.id)
  }

  if (turnoDestinoId) {
    const { error } = await supabase.from('horarios_funcionarios').insert({
      funcionario_id: funcionarioId,
      turno_id: turnoDestinoId,
      data_inicio: dataEfetivacao,
      dia_curso: diaCurso,
      criado_por: criadoPor,
    })

    if (!error) {
      // Registrar movimentação — mesmo padrão de alterarTurno, para que reatribuições
      // automáticas apareçam no histórico do funcionário como as manuais.
      await supabase.from('movimentacoes').insert({
        funcionario_id: funcionarioId,
        tipo: 'mudanca_horario',
        campo_alterado: 'turno_id',
        valor_antes: vigente?.turno_id ?? null,
        valor_depois: turnoDestinoId,
        executado_por: criadoPor,
      })
    }
  }
}
