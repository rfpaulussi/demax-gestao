import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { calcularKPIsAtuais } from '@/lib/dashboard-kpis'
import { buscarEmailsAdmins, enviarEmail, templateAlertaFerias } from '@/lib/email'

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

async function alertarFeriasVencendo(supabase: ReturnType<typeof createAdminClient>, hoje: string) {
  // Busca períodos ativos com limite de gozo nos próximos 30 dias (ou já vencidos)
  const limite30 = new Date(hoje)
  limite30.setDate(limite30.getDate() + 30)
  const limite30Str = limite30.toISOString().split('T')[0]

  const { data } = await supabase
    .from('ferias')
    .select(`
      limite_gozo, numero_periodo, status,
      funcionarios ( nome, postos ( nome ) )
    `)
    .in('status', ['disponivel', 'agendado', 'aprovado'])
    .not('limite_gozo', 'is', null)
    .lte('limite_gozo', limite30Str)
    .order('limite_gozo')

  if (!data?.length) return { enviado: false, vencidos: 0, criticos: 0 }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const vencidos = (data as any[]).filter(r => r.limite_gozo < hoje).map(r => ({
    nome:   r.funcionarios?.nome ?? '—',
    posto:  r.funcionarios?.postos?.nome ?? '—',
    limite: r.limite_gozo,
    dias:   0,
  }))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const criticos = (data as any[]).filter(r => r.limite_gozo >= hoje).map(r => {
    const diff = Math.ceil((new Date(r.limite_gozo + 'T00:00:00').getTime() - new Date(hoje + 'T00:00:00').getTime()) / 86400000)
    return {
      nome:   r.funcionarios?.nome ?? '—',
      posto:  r.funcionarios?.postos?.nome ?? '—',
      limite: r.limite_gozo,
      dias:   diff,
    }
  })

  const emails = await buscarEmailsAdmins()
  const dataFormatada = new Date(hoje + 'T00:00:00').toLocaleDateString('pt-BR')

  await enviarEmail({
    to:      emails,
    subject: `⚠️ Alerta de Férias — ${vencidos.length} vencido(s), ${criticos.length} crítico(s) · ${dataFormatada}`,
    html:    templateAlertaFerias({ dataHoje: dataFormatada, vencidos, criticos }),
  })

  return { enviado: true, vencidos: vencidos.length, criticos: criticos.length }
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const hoje = new Date().toISOString().split('T')[0]

  const ferias    = await sincronizarStatusFerias(supabase, hoje)
  const emailAlerta = await alertarFeriasVencendo(supabase, hoje)

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

  return NextResponse.json({ ok: true, data: hoje, ferias, emailAlerta, kpis: {
    ativos: kpis.ativos,
    afastados: kpis.afastados,
    em_ferias: kpis.em_ferias,
    postos_deficit: kpis.postos_deficit,
    aprovacoes_pendentes: kpis.aprovacoes_pendentes,
    coberturas_ativas: kpis.coberturas_ativas,
  }})
}
