// Gatilho: cron diário às 17:30 (schedule: "30 17 * * *")
// Encerra automaticamente coberturas vencidas e restaura funcionários ao posto de origem.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (_req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const hoje = new Date().toISOString().split('T')[0]

    const { data: coberturas, error: fetchError } = await supabase
      .from('coberturas_temporarias')
      .select('id, funcionario_id, posto_origem_id')
      .eq('status', 'ativa')
      .lte('data_prev_retorno', hoje)

    if (fetchError) throw fetchError

    if (!coberturas?.length) {
      console.log(`[retorno-automatico] ${hoje}: nenhuma cobertura vencida.`)
      return new Response(
        JSON.stringify({ message: 'Nenhuma cobertura vencida.', encerradas: 0 }),
        { headers: { 'Content-Type': 'application/json' } },
      )
    }

    const ids = coberturas.map(c => c.id)

    const { error: encerraError } = await supabase
      .from('coberturas_temporarias')
      .update({ status: 'encerrada', data_retorno_real: hoje })
      .in('id', ids)

    if (encerraError) throw encerraError

    await Promise.all(
      coberturas.map(c => {
        const update: Record<string, unknown> = { status: 'ativo' }
        if (c.posto_origem_id) update.posto_id = c.posto_origem_id
        return supabase
          .from('funcionarios')
          .update(update)
          .eq('id', c.funcionario_id)
      }),
    )

    console.log(
      `[retorno-automatico] ${hoje}: ${coberturas.length} cobertura(s) encerrada(s).`,
    )

    return new Response(
      JSON.stringify({ success: true, encerradas: coberturas.length }),
      { headers: { 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('[retorno-automatico] Erro:', err)
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
})
