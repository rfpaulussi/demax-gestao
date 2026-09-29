// lib/atestados/sobreposicao.ts
//
// Um funcionário não pode ter dois atestados cobrindo o mesmo dia. Esta checagem roda em todo
// caminho que grava `atestados` (lançamento, edição, INSS, cobertura, aprovações da auditoria);
// o trigger da migration 20260929_atestados_sem_sobreposicao.sql é a rede de segurança no banco.

import type { SupabaseClient } from '@supabase/supabase-js'

export type AtestadoSobreposto = {
  id: string
  data_inicio: string
  data_fim: string
  cid_codigo: string | null
}

const br = (iso: string) => iso.split('-').reverse().join('/')

/** Primeiro atestado do funcionário que cobre algum dia de [dataInicio, dataFim], ou null. */
export async function buscarAtestadoSobreposto(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: SupabaseClient<any, any, any>,
  funcionarioId: string,
  dataInicio: string,
  dataFim: string,
  excluirId?: string,
): Promise<AtestadoSobreposto | null> {
  let q = client
    .from('atestados')
    .select('id, data_inicio, data_fim, cid_codigo')
    .eq('funcionario_id', funcionarioId)
    .lte('data_inicio', dataFim)
    .gte('data_fim', dataInicio)
    .order('data_inicio', { ascending: true })
    .limit(1)
  if (excluirId) q = q.neq('id', excluirId)
  const { data } = await q
  return ((data ?? [])[0] as AtestadoSobreposto | undefined) ?? null
}

export function mensagemSobreposicao(a: AtestadoSobreposto): string {
  return `Já existe atestado neste período (${br(a.data_inicio)} a ${br(a.data_fim)}${a.cid_codigo ? `, CID ${a.cid_codigo}` : ''}). Não é permitido atestado duplicado ou sobreposto — ajuste as datas ou edite o atestado existente.`
}
