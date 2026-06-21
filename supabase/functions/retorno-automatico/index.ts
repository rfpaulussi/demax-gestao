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
      .select('id, funcionario_id, posto_origem_id, funcionario_ausente_id')
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

    // Reverter ausentes para 'ativo' se não há outra cobertura ativa cobrindo-os
    const ausenteIds = [...new Set(
      coberturas
        .map(c => c.funcionario_ausente_id as string | null)
        .filter((id): id is string => Boolean(id))
    )]
    await Promise.all(
      ausenteIds.map(async ausenteId => {
        const { count } = await supabase
          .from('coberturas_temporarias')
          .select('id', { count: 'exact', head: true })
          .eq('funcionario_ausente_id', ausenteId)
          .eq('status', 'ativa')
        if (count === 0) {
          const { error: errRev } = await supabase.from('funcionarios')
            .update({ status: 'ativo' })
            .eq('id', ausenteId)
            .eq('status', 'afastado')
          if (errRev) console.error(`[retorno-automatico] reverter status do ausente ${ausenteId}:`, errRev.message)
        }
      })
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
