import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { calcularKPIsAtuais } from '@/lib/dashboard-kpis'

export const runtime = 'nodejs'

async function sincronizarStatusFerias(supabase: ReturnType<typeof createAdminClient>, hoje: string) {
  // agendado/aprovado com data_inicio <= hoje → em_curso
  const { data: iniciar } = await supabase
    .from('ferias')
    .select('id, funcionario_id')
    .in('status', ['agendado', 'aprovado'])
    .lte('data_inicio', hoje)
    .not('data_inicio', 'is', null)

  for (const f of iniciar ?? []) {
    await supabase.from('ferias').update({ status: 'em_curso' }).eq('id', f.id)
    await supabase.from('funcionarios').update({ status: 'ferias' }).eq('id', f.funcionario_id)
  }

  // em_curso com data_fim < hoje → concluido
  const { data: concluir } = await supabase
    .from('ferias')
    .select('id, funcionario_id')
    .eq('status', 'em_curso')
    .lt('data_fim', hoje)
    .not('data_fim', 'is', null)

  for (const f of concluir ?? []) {
    await supabase.from('ferias').update({ status: 'concluido' }).eq('id', f.id)
    await supabase.from('funcionarios').update({ status: 'ativo' }).eq('id', f.funcionario_id)
  }

  return { iniciadas: (iniciar ?? []).length, concluidas: (concluir ?? []).length }
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const hoje = new Date().toISOString().split('T')[0]

  const ferias = await sincronizarStatusFerias(supabase, hoje)

  const kpis = await calcularKPIsAtuais(supabase)

  const { error } = await supabase.from('snapshots_diarios').upsert(
    {
      data: hoje,
      ativos: kpis.ativos,
      afastados: kpis.afastados,
      em_ferias: kpis.em_ferias,
      postos_deficit: kpis.postos_deficit,
      aprovacoes_pendentes: kpis.aprovacoes_pendentes,
      coberturas_ativas: kpis.coberturas_ativas,
    },
    { onConflict: 'data' }
  )

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, data: hoje, ferias, kpis: {
    ativos: kpis.ativos,
    afastados: kpis.afastados,
    em_ferias: kpis.em_ferias,
    postos_deficit: kpis.postos_deficit,
    aprovacoes_pendentes: kpis.aprovacoes_pendentes,
    coberturas_ativas: kpis.coberturas_ativas,
  }})
}
