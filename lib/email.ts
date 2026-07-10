// Utilitário de e-mail via Resend
// Variáveis de ambiente necessárias (configurar no Vercel):
//   RESEND_API_KEY       — chave da API do Resend
//   RESEND_FROM_EMAIL    — remetente verificado, ex: "Demax Gestão <noreply@seudominio.com.br>"
//   ADMIN_NOTIFY_EMAILS  — fallback: lista separada por vírgula de e-mails (caso a consulta ao Supabase falhe)

import { Resend } from 'resend'
import { createAdminClient } from './supabase/admin'

// Instanciado de forma lazy para não falhar no build sem a env var
function getResend() {
  return new Resend(process.env.RESEND_API_KEY ?? 'placeholder')
}

const FROM =
  process.env.RESEND_FROM_EMAIL ?? 'Demax Gestão <noreply@demaxgestao.vercel.app>'

// Busca e-mails de admins e coordenadores via Supabase Auth
export async function buscarEmailsAdmins(): Promise<string[]> {
  try {
    const supabase = createAdminClient()

    const [{ data: perfis }, { data: { users } }] = await Promise.all([
      supabase.from('perfis').select('id').in('role', ['admin', 'coordenador']),
      supabase.auth.admin.listUsers({ perPage: 1000 }),
    ])

    const ids = new Set((perfis ?? []).map((p) => p.id))
    const emails = (users ?? [])
      .filter((u) => ids.has(u.id))
      .map((u) => u.email)
      .filter(Boolean) as string[]

    if (emails.length > 0) return emails
  } catch (e) {
    console.error('[email] buscarEmailsAdmins:', e)
  }

  // Fallback: env var com lista manual
  const fallback = process.env.ADMIN_NOTIFY_EMAILS
  if (fallback) return fallback.split(',').map((e) => e.trim()).filter(Boolean)

  return []
}

export async function enviarEmail(opts: {
  to: string[]
  subject: string
  html: string
}): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY não configurada — e-mail ignorado')
    return
  }
  if (opts.to.length === 0) {
    console.warn('[email] Nenhum destinatário — e-mail ignorado')
    return
  }
  try {
    const { error } = await getResend().emails.send({
      from: FROM,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    })
    if (error) console.error('[email] Resend error:', error)
  } catch (e) {
    console.error('[email] Erro ao enviar:', e)
  }
}

// Template: alerta de férias vencendo/vencidas
export function templateAlertaFerias(dados: {
  dataHoje: string
  vencidos: { nome: string; posto: string; limite: string; dias: number }[]
  criticos: { nome: string; posto: string; limite: string; dias: number }[]
}): string {
  const row = (r: { nome: string; posto: string; limite: string; dias: number }, cor: string) => `
    <tr>
      <td style="padding:7px 10px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#1e293b">${r.nome}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #f1f5f9;font-size:12px;color:#64748b">${r.posto}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #f1f5f9;font-size:13px;font-weight:600;color:${cor}">${r.limite}</td>
    </tr>`

  const section = (
    titulo: string,
    cor: string,
    bg: string,
    itens: { nome: string; posto: string; limite: string; dias: number }[]
  ) => itens.length === 0 ? '' : `
    <h3 style="margin:24px 0 8px;font-size:14px;font-weight:700;color:${cor}">${titulo} (${itens.length})</h3>
    <table style="width:100%;border-collapse:collapse;background:${bg};border-radius:6px;overflow:hidden">
      <thead>
        <tr style="background:#f8fafc">
          <th style="text-align:left;padding:7px 10px;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#64748b">Funcionário</th>
          <th style="text-align:left;padding:7px 10px;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#64748b">Posto</th>
          <th style="text-align:left;padding:7px 10px;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#64748b">Limite Gozo</th>
        </tr>
      </thead>
      <tbody>${itens.map(r => row(r, cor)).join('')}</tbody>
    </table>`

  return `<!DOCTYPE html>
<html lang="pt-BR">
<body style="margin:0;padding:16px;background:#f1f5f9;font-family:Arial,sans-serif">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08)">
  <div style="background:#1e293b;padding:20px 24px">
    <p style="margin:0;font-size:18px;font-weight:700;color:#fff">Demax Gestão</p>
    <p style="margin:4px 0 0;font-size:12px;color:#94a3b8">Alerta de Férias · ${dados.dataHoje}</p>
  </div>
  <div style="padding:24px">
    <p style="margin:0 0 4px;font-size:15px;color:#374151">Há períodos de férias que precisam de ação:</p>
    <p style="margin:0;font-size:13px;color:#6b7280">
      <strong style="color:#dc2626">${dados.vencidos.length} vencido(s)</strong> &nbsp;·&nbsp;
      <strong style="color:#ea580c">${dados.criticos.length} vence(m) em 30 dias</strong>
    </p>
    ${section('🔴 Prazos Vencidos', '#dc2626', '#fff5f5', dados.vencidos)}
    ${section('⚠️ Vencem em 30 dias', '#ea580c', '#fff7ed', dados.criticos)}
    <div style="margin-top:28px;text-align:center">
      <a href="https://demax-gestao.vercel.app/ferias"
        style="display:inline-block;background:#1e293b;color:#fff;padding:11px 24px;border-radius:7px;text-decoration:none;font-size:14px;font-weight:600">
        Acessar o sistema →
      </a>
    </div>
  </div>
</div>
</body></html>`
}

// Template: notificação de férias agendada aguardando aprovação
export function templateFeriasAgendada(dados: {
  funcionarioNome: string
  postoNome: string
  numeroPeriodo: number | null
  dataInicio: string
  dataFim: string
  diasDireito: number | null
  supervisorNome?: string
}): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<body style="margin:0;padding:16px;background:#f1f5f9;font-family:Arial,sans-serif">
<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08)">
  <div style="background:#1e293b;padding:20px 24px">
    <p style="margin:0;font-size:18px;font-weight:700;color:#fff">Demax Gestão</p>
    <p style="margin:4px 0 0;font-size:12px;color:#94a3b8">📅 Férias Agendadas — Aguardando Aprovação</p>
  </div>
  <div style="padding:24px">
    <p style="margin:0 0 16px;font-size:14px;color:#374151">
      Um período de férias foi agendado e aguarda aprovação:
    </p>
    <table style="width:100%;border-collapse:collapse">
      <tr><td style="padding:6px 0;font-size:12px;color:#64748b;width:130px">Funcionário</td><td style="font-size:14px;font-weight:600;color:#1e293b">${dados.funcionarioNome}</td></tr>
      <tr><td style="padding:6px 0;font-size:12px;color:#64748b">Posto</td><td style="font-size:13px;color:#374151">${dados.postoNome}</td></tr>
      <tr><td style="padding:6px 0;font-size:12px;color:#64748b">Período</td><td style="font-size:13px;color:#374151">${dados.numeroPeriodo ?? '—'}º aquisitivo</td></tr>
      <tr><td style="padding:6px 0;font-size:12px;color:#64748b">Datas</td><td style="font-size:13px;font-weight:600;color:#1e293b">${dados.dataInicio} – ${dados.dataFim} (${dados.diasDireito ?? 30} dias)</td></tr>
      ${dados.supervisorNome ? `<tr><td style="padding:6px 0;font-size:12px;color:#64748b">Supervisor</td><td style="font-size:13px;color:#374151">${dados.supervisorNome}</td></tr>` : ''}
    </table>
    <div style="margin-top:24px;text-align:center">
      <a href="https://demax-gestao.vercel.app/ferias"
        style="display:inline-block;background:#4338ca;color:#fff;padding:11px 24px;border-radius:7px;text-decoration:none;font-size:14px;font-weight:600">
        Aprovar / Ver no sistema →
      </a>
    </div>
  </div>
</div>
</body></html>`
}
