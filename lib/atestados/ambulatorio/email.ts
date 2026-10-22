export type DadosEmailAmbulatorio = {
  funcionarioNome: string
  registro: string | null
  postoNome: string
  secretaria: string | null
  lancadoPor: string | null
  dataInicio: string
  dataFim: string
  /** E-mail de teste (preview/dev): vai só para quem testa, com aviso no assunto e no corpo. */
  teste?: boolean
}

const fmt = (d: string) => d.split('-').reverse().join('/')

function escapar(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function diasEntre(inicio: string, fim: string): number {
  const [ay, am, ad] = inicio.split('-').map(Number)
  const [by, bm, bd] = fim.split('-').map(Number)
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000) + 1
}

/** Nome do anexo: sem acento nem caractere especial, com a extensão do arquivo enviado. */
export function nomeDoAnexo(funcionarioNome: string, tipoMime: string): string {
  const ext = tipoMime === 'application/pdf' ? 'pdf' : tipoMime === 'image/png' ? 'png' : tipoMime === 'image/webp' ? 'webp' : 'jpg'
  const base = funcionarioNome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
  return `atestado-${base || 'funcionario'}.${ext}`
}

/**
 * Monta assunto e corpo do e-mail ao ambulatório. Sem CPF e sem CID: o CID já está no papel anexado.
 * Todo texto vindo do banco é escapado.
 */
export function montarEmailAmbulatorio(d: DadosEmailAmbulatorio): { assunto: string; html: string } {
  const periodo = d.dataInicio === d.dataFim
    ? fmt(d.dataInicio)
    : `${fmt(d.dataInicio)} a ${fmt(d.dataFim)}`
  const dias = diasEntre(d.dataInicio, d.dataFim)
  const assunto = `${d.teste ? '[TESTE] ' : ''}Atestado – ${d.funcionarioNome} – ${d.postoNome} – ${periodo}`.replace(/[\r\n]+/g, ' ')

  const linha = (rotulo: string, valor: string | null) => valor
    ? `<tr><td style="padding:6px 0;font-size:12px;color:#64748b;width:130px">${rotulo}</td><td style="font-size:13px;color:#1e293b">${escapar(valor)}</td></tr>`
    : ''

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<body style="margin:0;padding:16px;background:#f1f5f9;font-family:Arial,sans-serif">
<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08)">
  <div style="background:#1e293b;padding:20px 24px">
    <p style="margin:0;font-size:18px;font-weight:700;color:#fff">Demax Gestão</p>
    <p style="margin:4px 0 0;font-size:12px;color:#94a3b8">Atestado médico para o ambulatório</p>
  </div>
  <div style="padding:24px">
    ${d.teste ? '<p style="margin:0 0 12px;padding:8px 10px;background:#fef3c7;border-radius:6px;font-size:12px;color:#92400e">E-mail de teste: não foi enviado ao ambulatório.</p>' : ''}
    <p style="margin:0 0 16px;font-size:14px;color:#374151">O atestado segue em anexo.</p>
    <table style="width:100%;border-collapse:collapse">
      ${linha('Funcionário', d.funcionarioNome)}
      ${linha('Registro (RE)', d.registro)}
      ${linha('Posto', d.postoNome)}
      ${linha('Secretaria', d.secretaria)}
      ${linha('Lançado por', d.lancadoPor)}
      ${linha('Início', fmt(d.dataInicio))}
      ${linha('Fim', fmt(d.dataFim))}
      ${linha('Dias', String(dias))}
    </table>
  </div>
</div>
</body></html>`

  return { assunto, html }
}
