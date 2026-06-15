import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { calcularKPIsAtuais } from '@/lib/dashboard-kpis'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const kpis = await calcularKPIsAtuais(supabase)

  const hoje = new Date().toISOString().split('T')[0]

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

  return NextResponse.json({ ok: true, data: hoje, kpis: {
    ativos: kpis.ativos,
    afastados: kpis.afastados,
    em_ferias: kpis.em_ferias,
    postos_deficit: kpis.postos_deficit,
    aprovacoes_pendentes: kpis.aprovacoes_pendentes,
    coberturas_ativas: kpis.coberturas_ativas,
  }})
}
