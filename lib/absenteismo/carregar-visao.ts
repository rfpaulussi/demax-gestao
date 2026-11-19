// lib/absenteismo/carregar-visao.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { carregarDados } from './carregar'
import { DADOS_DESDE } from './constantes'
import { maxData, minData, periodoDoMes } from './datas'
import type { FiltrosAbsenteismo } from './filtros'
import { mesesAte } from './series'
import { montarVisao, type VisaoExecutiva } from './visao'

/**
 * Carrega os dados necessários (do mesmo mês do ano anterior até o mês pedido, nunca antes de DADOS_DESDE
 * e nunca depois de hoje) e monta a Visão Executiva.
 */
export async function carregarVisao(
  supabase: SupabaseClient<Database>,
  filtros: FiltrosAbsenteismo,
  ano: number,
  mes: number,
  hoje: string,
): Promise<VisaoExecutiva> {
  const maisAntigo = mesesAte(ano, mes, 13)[0]
  const fim = minData(periodoDoMes(ano, mes).fim, hoje)
  const inicio = minData(maxData(periodoDoMes(maisAntigo.ano, maisAntigo.mes).inicio, DADOS_DESDE), fim)
  const dados = await carregarDados(supabase, { inicio, fim })
  return montarVisao({ dados, filtros, ano, mes, hoje })
}
