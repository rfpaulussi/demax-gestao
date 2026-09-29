// Regras de ciclo de vida de `afastamentos` compartilhadas entre coberturas, atestados,
// aprovações e retornos. Sempre receber um client admin (RLS de afastamentos é só admin/coord).
//
// Invariante: no máximo 1 afastamento ABERTO (data_fim_real IS NULL) por funcionário
// (reforçado no banco pelo índice único parcial de 20260929_afastamento_unico_aberto.sql).

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any

export async function existeAfastamentoAberto(admin: AnyClient, funcionarioId: string): Promise<boolean> {
  const { data } = await admin
    .from('afastamentos')
    .select('id')
    .eq('funcionario_id', funcionarioId)
    .is('data_fim_real', null)
    .limit(1)
  return (data?.length ?? 0) > 0
}

/**
 * Fecha (data_fim_real = data_fim_prevista) os afastamentos abertos cuja previsão de fim
 * já passou. Usar quando o funcionário volta a 'ativo' sem passar pelo fluxo formal de
 * retorno (fim de atestado/cobertura) — senão a linha fica aberta pra sempre.
 * Não mexe em afastamento sem previsão (aberto por natureza, ex.: INSS/rescisão).
 */
export async function fecharAfastamentosVencidos(admin: AnyClient, funcionarioId: string, hoje: string): Promise<void> {
  const { data } = await admin
    .from('afastamentos')
    .select('id, data_fim_prevista')
    .eq('funcionario_id', funcionarioId)
    .is('data_fim_real', null)
    .not('data_fim_prevista', 'is', null)
    .lt('data_fim_prevista', hoje)
  for (const a of (data ?? []) as { id: string; data_fim_prevista: string }[]) {
    const { error } = await admin.from('afastamentos').update({ data_fim_real: a.data_fim_prevista }).eq('id', a.id)
    if (error) console.error('[afastamentos] fecharAfastamentosVencidos:', a.id, error.message)
  }
}

/**
 * Desligou, encerrou: fecha os afastamentos abertos sem nunca passar da data de desligamento
 * (usa a previsão de fim quando ela é anterior).
 */
export async function fecharAfastamentosNoDesligamento(admin: AnyClient, funcionarioId: string, dataDesligamento: string): Promise<void> {
  const { data } = await admin
    .from('afastamentos')
    .select('id, data_inicio, data_fim_prevista')
    .eq('funcionario_id', funcionarioId)
    .is('data_fim_real', null)
  for (const a of (data ?? []) as { id: string; data_inicio: string; data_fim_prevista: string | null }[]) {
    let fim = a.data_fim_prevista && a.data_fim_prevista < dataDesligamento ? a.data_fim_prevista : dataDesligamento
    if (fim < a.data_inicio) fim = a.data_inicio
    const { error } = await admin.from('afastamentos').update({ data_fim_real: fim }).eq('id', a.id)
    if (error) console.error('[afastamentos] fecharAfastamentosNoDesligamento:', a.id, error.message)
  }
}

/**
 * Exclusão de atestado apaga o afastamento "espelho" que a cobertura por atestado criou junto
 * (sem solicitação vinculada e contido no período do atestado). Se foi lançado errado, o
 * afastamento some junto; se vier outro atestado, ele gera o seu.
 * Retorna quantos foram removidos.
 */
export async function removerAfastamentosEspelhoDeAtestado(
  admin: AnyClient,
  funcionarioId: string,
  dataInicio: string,
  dataFim: string,
): Promise<number> {
  const { data } = await admin
    .from('afastamentos')
    .select('id')
    .eq('funcionario_id', funcionarioId)
    .is('solicitacao_id', null)
    .gte('data_inicio', dataInicio)
    .not('data_fim_prevista', 'is', null)
    .lte('data_fim_prevista', dataFim)
  const ids = ((data ?? []) as { id: string }[]).map(a => a.id)
  if (ids.length === 0) return 0
  const { error } = await admin.from('afastamentos').delete().in('id', ids)
  if (error) {
    console.error('[afastamentos] removerAfastamentosEspelhoDeAtestado:', error.message)
    return 0
  }
  return ids.length
}
