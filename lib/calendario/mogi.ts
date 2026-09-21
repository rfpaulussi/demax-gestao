import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { feriadosParaAno } from './feriados-mogi'
import type { CalendarioLinha } from './mapa'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any

/** Tabela ainda inexistente (migration não aplicada): o calendário fica vazio em vez de quebrar a página. */
function tabelaAusente(error: { message?: string } | null): boolean {
  return !!error && /does not exist|schema cache|Could not find/i.test(error.message ?? '')
}

/** Semeia o ano com os feriados de lei (e facultativos conhecidos) se ainda não houver nenhuma linha nele. */
async function garantirAno(ano: number): Promise<void> {
  const admin = createAdminClient() as AnyClient
  const { data, error } = await admin
    .from('calendario_feriados')
    .select('id')
    .gte('data', `${ano}-01-01`)
    .lte('data', `${ano}-12-31`)
    .limit(1)
  if (tabelaAusente(error)) return
  if (error) throw new Error('Falha ao consultar o calendário de feriados')
  if (data && data.length > 0) return
  const { error: errSeed } = await admin
    .from('calendario_feriados')
    .upsert(feriadosParaAno(ano).map(f => ({ ...f, ativo: true })), { onConflict: 'data,nome', ignoreDuplicates: true })
  if (errSeed && !tabelaAusente(errSeed)) throw new Error('Falha ao semear o calendário de feriados')
}

/** Linhas ativas do calendário nos anos pedidos. Devolve [] se a tabela ainda não existir; lança em qualquer outro erro. */
export async function carregarCalendario(anos: number[]): Promise<CalendarioLinha[]> {
  if (anos.length === 0) return []
  await Promise.all(anos.map(garantirAno))
  const { data, error } = await (createClient() as AnyClient)
    .from('calendario_feriados')
    .select('data, nome, tipo, ate_hora')
    .eq('ativo', true)
    .gte('data', `${Math.min(...anos)}-01-01`)
    .lte('data', `${Math.max(...anos)}-12-31`)
    .order('data')
  if (tabelaAusente(error)) return []
  if (error) throw new Error('Falha ao carregar o calendário de feriados')
  return ((data ?? []) as CalendarioLinha[]).map(l => ({ ...l, ate_hora: l.ate_hora ? l.ate_hora.slice(0, 5) : null }))
}
