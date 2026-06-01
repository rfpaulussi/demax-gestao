// Gatilho: cron no dia 1 de cada mês à meia-noite (schedule: "0 0 1 * *")
// Registra em logs_alocacoes_mensais o efetivo real de cada posto no mês anterior.
// Operação idempotente: apaga e reinsere o snapshot do mês de referência.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (_req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Cron roda no dia 1 do mês atual — captura o mês anterior
    const agora         = new Date()
    const mesAnterior   = new Date(agora.getFullYear(), agora.getMonth() - 1, 1)
    const mesReferencia = mesAnterior.toISOString().split('T')[0]
    const mesLabel      = mesAnterior.toLocaleDateString('pt-BR', {
      month: 'long',
      year:  'numeric',
    })

    const [
      { data: postos,       error: postosErr },
      { data: funcionarios, error: funcsErr  },
    ] = await Promise.all([
      supabase
        .from('postos')
        .select('id, efetivo_previsto')
        .eq('ativo', true),
      supabase
        .from('funcionarios')
        .select('id, nome, posto_id')
        .eq('status', 'ativo'),
    ])

    if (postosErr)  throw postosErr
    if (funcsErr)   throw funcsErr

    if (!postos?.length) {
      console.log('[snapshot-alocacoes] Nenhum posto ativo encontrado.')
      return new Response(
        JSON.stringify({ message: 'Nenhum posto ativo.', inseridos: 0 }),
        { headers: { 'Content-Type': 'application/json' } },
      )
    }

    // Agrupa funcionários ativos por posto
    type FuncEntry = { id: string; nome: string }
    const byPosto = new Map<string, FuncEntry[]>()
    for (const f of funcionarios ?? []) {
      if (!f.posto_id) continue
      if (!byPosto.has(f.posto_id)) byPosto.set(f.posto_id, [])
      byPosto.get(f.posto_id)!.push({ id: f.id, nome: f.nome })
    }

    // Apaga snapshot anterior do mesmo mês (idempotência)
    const { error: deleteErr } = await supabase
      .from('logs_alocacoes_mensais')
      .delete()
      .eq('mes_referencia', mesReferencia)

    if (deleteErr) throw deleteErr

    const rows = postos.map(p => ({
      posto_id:           p.id,
      mes_referencia:     mesReferencia,
      efetivo_previsto:   p.efetivo_previsto ?? 0,
      efetivo_real:       byPosto.get(p.id)?.length ?? 0,
      nomes_funcionarios: byPosto.get(p.id) ?? [],
    }))

    const { error: insertErr } = await supabase
      .from('logs_alocacoes_mensais')
      .insert(rows)

    if (insertErr) throw insertErr

    const totalAtivos  = funcionarios?.length ?? 0
    const totalPostos  = rows.length
    const emDeficit    = rows.filter(r => r.efetivo_real < r.efetivo_previsto).length
    const emExcesso    = rows.filter(r => r.efetivo_real > r.efetivo_previsto).length
    const completos    = rows.filter(r => r.efetivo_real === r.efetivo_previsto).length

    console.log(
      `[snapshot-alocacoes] ${mesLabel} — ` +
      `${totalPostos} posto(s), ${totalAtivos} funcionário(s) ativo(s). ` +
      `Completos: ${completos} | Déficit: ${emDeficit} | Excesso: ${emExcesso}`,
    )

    return new Response(
      JSON.stringify({
        success:         true,
        mes_referencia:  mesReferencia,
        postos:          totalPostos,
        funcionarios:    totalAtivos,
        completos,
        em_deficit:      emDeficit,
        em_excesso:      emExcesso,
      }),
      { headers: { 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('[snapshot-alocacoes] Erro:', err)
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
})
