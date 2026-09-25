// Regras puras da devolutiva por ocorrência (sem I/O, testadas em devolutiva.test.ts)

export const MAX_COMENTARIO = 4000

const URL_BASE = 'https://demax-gestao.vercel.app'

export function validarTexto(
  texto: string,
): { ok: true; texto: string } | { ok: false; error: string } {
  const t = texto.trim()
  if (!t) return { ok: false, error: 'Escreva uma mensagem' }
  if (t.length > MAX_COMENTARIO) {
    return { ok: false, error: `Mensagem muito longa (máximo ${MAX_COMENTARIO} caracteres)` }
  }
  return { ok: true, texto: t }
}

// Supervisores do posto + o supervisor da ocorrência, sem repetir e sem o autor.
export function montarDestinatariosSupervisores(p: {
  supervisoresDoPosto: string[]
  supervisorDaOcorrencia: string | null
  autorId: string
}): string[] {
  const ids = new Set(p.supervisoresDoPosto)
  if (p.supervisorDaOcorrencia) ids.add(p.supervisorDaOcorrencia)
  ids.delete(p.autorId)
  return Array.from(ids)
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function assuntoDevolutiva(funcionarioNome: string): string {
  return `Nova devolutiva no dossiê de ${funcionarioNome}`
}

// LGPD: o e-mail NUNCA leva o texto da mensagem (pode ter dado de saúde ou de vida pessoal).
// Por isso este template nem recebe o texto como parâmetro.
export function templateDevolutivaOcorrencia(d: {
  funcionarioNome: string
  funcionarioId: string
  parecer: boolean
}): string {
  const nome = escapeHtml(d.funcionarioNome)
  const chamada = d.parecer
    ? `Uma ocorrência foi encerrada com parecer no dossiê de <strong>${nome}</strong>.`
    : `Há uma nova devolutiva no dossiê de <strong>${nome}</strong>.`
  const link = `${URL_BASE}/ocorrencias?f=${encodeURIComponent(d.funcionarioId)}`

  return `<!DOCTYPE html>
<html lang="pt-BR">
<body style="margin:0;padding:16px;background:#f1f5f9;font-family:Arial,sans-serif">
<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08)">
  <div style="background:#1e293b;padding:20px 24px">
    <p style="margin:0;font-size:18px;font-weight:700;color:#fff">Demax Gestão</p>
    <p style="margin:4px 0 0;font-size:12px;color:#94a3b8">Devolutiva em ocorrência</p>
  </div>
  <div style="padding:24px">
    <p style="margin:0 0 12px;font-size:14px;color:#374151">${chamada}</p>
    <p style="margin:0;font-size:12px;color:#6b7280">
      Por segurança, o conteúdo da mensagem não é enviado por e-mail. Acesse o sistema para ler.
    </p>
    <div style="margin-top:24px;text-align:center">
      <a href="${link}"
        style="display:inline-block;background:#1e293b;color:#fff;padding:11px 24px;border-radius:7px;text-decoration:none;font-size:14px;font-weight:600">
        Acessar o sistema →
      </a>
    </div>
  </div>
</div>
</body></html>`
}
