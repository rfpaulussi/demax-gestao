// Acesso ao contador de mudanças da semana. Uso só no servidor (Server Actions).
// Tolerante à migração 20261030 ainda não aplicada: sem as colunas, o limite simplesmente não se aplica.

import { LIMITE_MUDANCAS_SEMANA, type ResumoMudancas } from '@/lib/agenda/mudancas'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = { from: (table: string) => any }

/** Null se a migração 20261030 ainda não foi aplicada. */
export async function lerMudancas(admin: AnyClient, semanaId: string): Promise<ResumoMudancas | null> {
  const { data, error } = await admin
    .from('agenda_semanas')
    .select('mudancas_pos_publicacao, mudancas_extras')
    .eq('id', semanaId)
    .maybeSingle()
  if (error || !data) return null
  const { count } = await admin
    .from('agenda_mudanca_pedidos')
    .select('id', { count: 'exact', head: true })
    .eq('semana_id', semanaId)
    .eq('status', 'pendente')
  return {
    usadas: data.mudancas_pos_publicacao ?? 0,
    extras: data.mudancas_extras ?? 0,
    limite: LIMITE_MUDANCAS_SEMANA,
    pedidoPendente: (count ?? 0) > 0,
  }
}

/** Conta mais uma mudança do supervisor na semana (depois de a alteração ter dado certo). */
export async function contarMudanca(admin: AnyClient, semanaId: string, atual: number): Promise<void> {
  await admin.from('agenda_semanas').update({ mudancas_pos_publicacao: atual + 1 }).eq('id', semanaId)
}
