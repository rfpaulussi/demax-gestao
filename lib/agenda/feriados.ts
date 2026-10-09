import { createAdminClient } from '@/lib/supabase/admin'
import { feriadosParaAno } from '@/lib/calendario/feriados-mogi'
import { addDias } from '@/lib/agenda/datas'
import type { FeriadoDia } from '@/lib/agenda/tema'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = { from: (table: string) => any }

/** Feriado de lei (nacional, estadual, municipal). Ponto facultativo não bloqueia o planejamento. */
export function ehFeriadoDeLei(f: FeriadoDia | undefined | null): boolean {
  return !!f && f.tipo !== 'facultativo'
}

/**
 * Feriados e pontos facultativos de Mogi das Cruzes entre duas datas (YYYY-MM-DD), por data.
 * Usa o calendário da empresa (tabela `calendario_feriados`, editável); se a tabela não existir
 * ou não tiver o ano, cai no calendário padrão gerado em código — assim o supervisor nunca
 * fica sem feriados por causa de permissão de leitura ou migração pendente.
 */
export async function feriadosDoPeriodo(inicio: string, fim: string): Promise<Record<string, FeriadoDia>> {
  const anos = Array.from(new Set([Number(inicio.slice(0, 4)), Number(fim.slice(0, 4))]))
  const out: Record<string, FeriadoDia> = {}
  const admin = createAdminClient() as unknown as AnyClient

  for (const ano of anos) {
    let linhas: { data: string; nome: string; tipo: FeriadoDia['tipo']; ate_hora: string | null }[] = []
    const { data, error } = await admin
      .from('calendario_feriados')
      .select('data, nome, tipo, ate_hora')
      .eq('ativo', true)
      .gte('data', `${ano}-01-01`)
      .lte('data', `${ano}-12-31`)
    if (!error && Array.isArray(data) && data.length > 0) {
      linhas = data
    } else {
      linhas = feriadosParaAno(ano).map(f => ({ data: f.data, nome: f.nome, tipo: f.tipo, ate_hora: f.ate_hora }))
    }
    for (const l of linhas) {
      if (l.data < inicio || l.data > fim) continue
      const atual = out[l.data]
      // Se houver feriado de lei e facultativo no mesmo dia, o de lei prevalece.
      if (atual && ehFeriadoDeLei(atual)) continue
      out[l.data] = { nome: l.nome, tipo: l.tipo, ate_hora: l.ate_hora ? l.ate_hora.slice(0, 5) : null }
    }
  }
  return out
}

/** Feriados dos 5 dias úteis da semana que começa em `segunda`. */
export async function feriadosDaSemana(segunda: string): Promise<Record<string, FeriadoDia>> {
  return feriadosDoPeriodo(segunda, addDias(segunda, 4))
}
