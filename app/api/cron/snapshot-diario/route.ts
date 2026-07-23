import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { calcularKPIsAtuais } from '@/lib/dashboard-kpis'
import { processarRetornosAtestado } from '@/lib/processar-retornos'
import { encerrarCoberturasVencidas } from '@/app/(admin)/coberturas/actions'

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
  const limite30 = new Date(hoje)
  limite30.setDate(limite30.getDate() + 30)
  const limite30Str = limite30.toISOString().split('T')[0]

  const { data } = await supabase
    .from('ferias')
    .select('limite_gozo, status')
    .in('status', ['disponivel', 'agendado', 'aprovado'])
    .not('limite_gozo', 'is', null)
    .lte('limite_gozo', limite30Str)

  if (!data?.length) return { notificado: false, vencidos: 0, criticos: 0 }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const vencidos = (data as any[]).filter(r => r.limite_gozo < hoje).length
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const criticos = (data as any[]).filter(r => r.limite_gozo >= hoje).length

  // Evita duplicar: atualiza registro do dia se já existir
  const { data: existing } = await supabase
    .from('log_supervisor_acoes')
    .select('id')
    .eq('tipo', 'alerta_ferias')
    .gte('created_at', `${hoje}T00:00:00`)
    .lte('created_at', `${hoje}T23:59:59`)
    .maybeSingle()

  const payload = {
    supervisor_nome: 'Sistema',
    tipo: 'alerta_ferias',
    acao: 'alerta',
    funcionario_nome: `${vencidos} vencido(s), ${criticos} crítico(s)`,
    detalhes: JSON.stringify({ vencidos, criticos, data: hoje }),
    lido: false,
  }

  if (existing) {
    await supabase.from('log_supervisor_acoes').update(payload).eq('id', existing.id)
  } else {
    await supabase.from('log_supervisor_acoes').insert(payload)
  }

  return { notificado: true, vencidos, criticos }
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const hoje = new Date().toISOString().split('T')[0]

  const ferias      = await sincronizarStatusFerias(supabase, hoje)
  const alertaFerias = await alertarFeriasVencendo(supabase, hoje)
  const retornosAtestado = await processarRetornosAtestado()
  const coberturasEncerradas = await encerrarCoberturasVencidas()

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

  return NextResponse.json({ ok: true, data: hoje, ferias, alertaFerias, retornosAtestado, coberturasEncerradas, kpis: {
    ativos: kpis.ativos,
    afastados: kpis.afastados,
    em_ferias: kpis.em_ferias,
    postos_deficit: kpis.postos_deficit,
    aprovacoes_pendentes: kpis.aprovacoes_pendentes,
    coberturas_ativas: kpis.coberturas_ativas,
  }})
}
