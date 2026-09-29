// Falta nunca coexiste com atestado ou afastamento no mesmo dia — é um ou é outro.
// Helpers compartilhados por todo lugar que cria falta, atestado ou afastamento,
// pra manter essa regra consistente em qualquer fluxo de entrada.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = { from: (table: string) => any }

/** true se já existe atestado cobrindo algum dia do período informado. */
export async function existeAtestadoNoPeriodo(
  client: AnyClient,
  funcionarioId: string,
  dataInicio: string,
  dataFim: string,
): Promise<boolean> {
  const { data } = await client
    .from('atestados')
    .select('id')
    .eq('funcionario_id', funcionarioId)
    .lte('data_inicio', dataFim)
    .gte('data_fim', dataInicio)
    .limit(1)
    .maybeSingle()
  return !!data
}

/** true se já existe afastamento cobrindo algum dia do período informado (aberto ou fechado). */
export async function existeAfastamentoNoPeriodo(
  client: AnyClient,
  funcionarioId: string,
  dataInicio: string,
  dataFim: string,
): Promise<boolean> {
  const { data } = await client
    .from('afastamentos')
    .select('id')
    .eq('funcionario_id', funcionarioId)
    .lte('data_inicio', dataFim)
    .or(`data_fim_real.is.null,data_fim_real.gte.${dataInicio}`)
    .limit(1)
    .maybeSingle()
  return !!data
}

/**
 * Remove (e loga em movimentacoes) as faltas do funcionário totalmente cobertas pelo
 * período [periodoInicio, periodoFim] — chamar depois de criar/confirmar um atestado
 * ou afastamento. periodoFim null = período em aberto (afastamento ainda em curso):
 * qualquer falta a partir de periodoInicio conta como coberta.
 */
export async function removerFaltasCobertas(
  client: AnyClient,
  funcionarioId: string,
  periodoInicio: string,
  periodoFim: string | null,
  origemLabel: string,
  executadoPor: string | null,
): Promise<void> {
  const { data: faltas } = await client
    .from('faltas')
    .select('id, data_falta, data_fim')
    .eq('funcionario_id', funcionarioId)
    .gte('data_falta', periodoInicio)

  const cobertas = (faltas ?? []).filter(
    (f: { data_falta: string; data_fim: string | null }) =>
      periodoFim === null || (f.data_fim ?? f.data_falta) <= periodoFim,
  )
  if (cobertas.length === 0) return

  const { error: errDel } = await client.from('faltas').delete().in('id', cobertas.map((f: { id: string }) => f.id))
  if (errDel) {
    console.error('[faltas-conflito] removerFaltasCobertas:', errDel.message)
    return
  }

  await client.from('movimentacoes').insert(
    cobertas.map((f: { data_falta: string; data_fim: string | null }) => ({
      funcionario_id: funcionarioId,
      tipo: 'exclusao_falta',
      campo_alterado: 'falta',
      valor_antes: `${f.data_falta}${f.data_fim && f.data_fim !== f.data_falta ? ` → ${f.data_fim}` : ''} (substituída por ${origemLabel})`,
      valor_depois: null,
      executado_por: executadoPor,
    })),
  )
}
