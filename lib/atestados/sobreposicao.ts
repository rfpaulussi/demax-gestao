// lib/atestados/sobreposicao.ts
//
// Um funcionário não pode ter dois atestados cobrindo o mesmo dia (exceto a passagem de bastão de
// 1 dia — ver periodos.ts). Esta checagem roda em todo
// caminho que grava `atestados` (lançamento, edição, INSS, cobertura, aprovações da auditoria);
// o trigger `atestados_sem_sobreposicao` (migrations 20260929 e 20260930) é a rede de segurança no banco.

import type { SupabaseClient } from '@supabase/supabase-js'
import { atestadosConflitam } from './periodos'

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
  if (excluirId) q = q.neq('id', excluirId)
  const { data } = await q
  // A query traz quem toca o período; a regra fina (passagem de bastão de 1 dia é permitida) é aqui.
  const candidatos = (data ?? []) as AtestadoSobreposto[]
  return candidatos.find(c => atestadosConflitam({ data_inicio: dataInicio, data_fim: dataFim }, c)) ?? null
}

export function mensagemSobreposicao(a: AtestadoSobreposto): string {
  return `Já existe atestado neste período (${br(a.data_inicio)} a ${br(a.data_fim)}${a.cid_codigo ? `, CID ${a.cid_codigo}` : ''}). Não é permitido atestado duplicado ou sobreposto (só pode dividir um único dia de fronteira) — ajuste as datas ou edite o atestado existente.`
}
