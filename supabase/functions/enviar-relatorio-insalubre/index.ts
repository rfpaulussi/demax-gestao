// Gatilho: HTTP POST on demand (chamada manual ou via botão "Enviar ao RH")
// Consolida coberturas_insalubres pendentes do mês atual, envia e-mail via Resend
// e marca todos os registros como 'enviada'.
// Env vars necessárias: RESEND_API_KEY, RESEND_TO_RH

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const GRAU_LABEL: Record<string, string> = {
  minimo: 'Mínimo (10%)',
  medio:  'Médio (20%)',
  maximo: 'Máximo (40%)',
}

function fmt(d: string | null): string {
  if (!d) return '—'
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR')
}

function buildHtml(
  registros: Array<{
    grau: string | null
    percentual: number | null
    data_inicio: string | null
    data_fim: string | null
    func: { nome: string; postoNome: string; secretaria: string | null }
  }>,
  mesLabel: string,
): string {
  const thStyle = `
    padding:10px 12px;text-align:left;
    font-size:10px;text-transform:uppercase;letter-spacing:.08em;
    color:#666;font-weight:600;background:#f8f8f8
  `.replace(/\s+/g, ' ')

  const linhas = registros.map(r => `
    <tr>
      <td style="padding:9px 12px;border-bottom:1px solid #f0f0f0">${r.func.nome}</td>
      <td style="padding:9px 12px;border-bottom:1px solid #f0f0f0">${r.func.postoNome}</td>
      <td style="padding:9px 12px;border-bottom:1px solid #f0f0f0">${r.func.secretaria ?? '—'}</td>
      <td style="padding:9px 12px;border-bottom:1px solid #f0f0f0">${GRAU_LABEL[r.grau ?? ''] ?? r.grau ?? '—'}</td>
      <td style="padding:9px 12px;border-bottom:1px solid #f0f0f0;text-align:center">${r.percentual ?? '—'}%</td>
      <td style="padding:9px 12px;border-bottom:1px solid #f0f0f0">${fmt(r.data_inicio)} – ${fmt(r.data_fim)}</td>
    </tr>
  `).join('')

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"><title>Insalubridade</title></head>
<body style="font-family:sans-serif;color:#111;max-width:820px;margin:0 auto;padding:32px">
  <h1 style="font-size:22px;font-weight:800;margin:0">DEMAX</h1>
  <p style="font-size:11px;color:#999;margin:4px 0 32px;text-transform:uppercase;letter-spacing:.1em">
    Gestão de Facilities
  </p>
  <h2 style="font-size:17px;font-weight:700;margin:0 0 6px">
    Relatório de Insalubridade — ${mesLabel}
  </h2>
  <p style="font-size:14px;color:#555;margin:0 0 24px">
    ${registros.length} declaração(ões) processada(s) neste período.
  </p>
  <table style="width:100%;border-collapse:collapse;font-size:13px">
    <thead>
      <tr>
        <th style="${thStyle}">Funcionário</th>
        <th style="${thStyle}">Posto</th>
        <th style="${thStyle}">Secretaria</th>
        <th style="${thStyle}">Grau</th>
        <th style="${thStyle};text-align:center">%</th>
        <th style="${thStyle}">Período</th>
      </tr>
    </thead>
    <tbody>${linhas}</tbody>
  </table>
  <p style="margin-top:36px;font-size:11px;color:#bbb">
    Gerado automaticamente pelo sistema DEMAX em
    ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}.
  </p>
</body>
</html>`
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const now          = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
    const endOfMonth   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]
    const mesLabel     = now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

    const { data: raw, error: fetchErr } = await supabase
      .from('coberturas_insalubres')
      .select(`
        id, grau, percentual, data_inicio, data_fim,
        funcionarios!funcionario_id (
          nome,
          postos!posto_id ( nome, secretaria )
        )
      `)
      .eq('status', 'pendente')
      .gte('data_inicio', startOfMonth)
      .lte('data_inicio', endOfMonth)
      .order('data_inicio', { ascending: true })

    if (fetchErr) throw fetchErr

    if (!raw?.length) {
      console.log(`[enviar-relatorio-insalubre] Nenhum registro pendente em ${mesLabel}.`)
      return new Response(
        JSON.stringify({ message: 'Nenhum registro pendente para o mês atual.', processados: 0 }),
        { headers: { 'Content-Type': 'application/json' } },
      )
    }

    type FuncJoin = { nome: string; postos: { nome: string; secretaria: string | null } | null }

    const registros = raw.map(r => ({
      id:         r.id,
      grau:       r.grau,
      percentual: r.percentual,
      data_inicio: r.data_inicio,
      data_fim:    r.data_fim,
      func: {
        nome:      (r.funcionarios as unknown as FuncJoin).nome,
        postoNome: (r.funcionarios as unknown as FuncJoin).postos?.nome ?? '—',
        secretaria:(r.funcionarios as unknown as FuncJoin).postos?.secretaria ?? null,
      },
    }))

    const html = buildHtml(registros, mesLabel)

    const resendKey = Deno.env.get('RESEND_API_KEY')
    const toRH      = Deno.env.get('RESEND_TO_RH')
    if (!resendKey || !toRH) throw new Error('RESEND_API_KEY ou RESEND_TO_RH não configurados')

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from:    'DEMAX <noreply@demax.com.br>',
        to:      toRH,
        subject: `Relatório de Insalubridade — ${mesLabel}`,
        html,
      }),
    })

    if (!resendRes.ok) {
      const body = await resendRes.text()
      throw new Error(`Resend retornou ${resendRes.status}: ${body}`)
    }

    const ids = registros.map(r => r.id)
    const { error: updateErr } = await supabase
      .from('coberturas_insalubres')
      .update({ status: 'enviada' })
      .in('id', ids)

    if (updateErr) throw updateErr

    console.log(`[enviar-relatorio-insalubre] ${ids.length} registro(s) enviados para ${toRH}`)

    return new Response(
      JSON.stringify({ success: true, processados: ids.length }),
      { headers: { 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('[enviar-relatorio-insalubre] Erro:', err)
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
})
