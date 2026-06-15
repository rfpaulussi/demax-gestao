import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

export type KPIsAtuais = {
  ativos: number
  afastados: number
  em_ferias: number
  postos_deficit: number
  aprovacoes_pendentes: number
  coberturas_ativas: number
  postosCriticos: number
  feriasTerminando30dias: number
}

function hojeStr(): string {
  return new Date().toISOString().split('T')[0]
}

function hojeMaisDiasStr(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

export async function calcularKPIsAtuais(
  supabase: SupabaseClient<Database>
): Promise<KPIsAtuais> {
  const hoje = hojeStr()
  const mais30 = hojeMaisDiasStr(30)

  const [
    { count: ativos },
    { count: afastados },
    { count: em_ferias },
    { count: coberturas_ativas },
    { count: aprovacoes_pendentes },
    { count: feriasTerminando30dias },
    { data: postosData },
    { data: funcAtivosData },
  ] = await Promise.all([
    supabase.from('funcionarios').select('*', { count: 'exact', head: true }).eq('status', 'ativo'),
    supabase.from('funcionarios').select('*', { count: 'exact', head: true }).eq('status', 'afastado'),
    supabase.from('funcionarios').select('*', { count: 'exact', head: true }).eq('status', 'ferias'),
    supabase.from('coberturas_temporarias').select('*', { count: 'exact', head: true }).eq('status', 'ativa'),
    supabase.from('solicitacoes').select('*', { count: 'exact', head: true }).eq('status', 'pendente'),
    supabase
      .from('ferias')
      .select('*', { count: 'exact', head: true })
      .in('status', ['em_curso', 'aprovado'])
      .gte('data_fim', hoje)
      .lte('data_fim', mais30),
    supabase.from('postos').select('id, efetivo_previsto').eq('ativo', true),
    supabase.from('funcionarios').select('posto_id').eq('status', 'ativo').not('posto_id', 'is', null),
  ])

  const funcPorPosto: Record<string, number> = {}
  for (const f of funcAtivosData ?? []) {
    const pid = f.posto_id as string
    funcPorPosto[pid] = (funcPorPosto[pid] ?? 0) + 1
  }

  let postos_deficit = 0
  let postosCriticos = 0
  for (const p of postosData ?? []) {
    const previsto = p.efetivo_previsto ?? 0
    const real = funcPorPosto[p.id] ?? 0
    const gap = previsto - real
    if (gap > 0) postos_deficit++
    if (gap >= 2) postosCriticos++
  }

  return {
    ativos: ativos ?? 0,
    afastados: afastados ?? 0,
    em_ferias: em_ferias ?? 0,
    coberturas_ativas: coberturas_ativas ?? 0,
    aprovacoes_pendentes: aprovacoes_pendentes ?? 0,
    feriasTerminando30dias: feriasTerminando30dias ?? 0,
    postos_deficit,
    postosCriticos,
  }
}
