// Regras puras do encaminhamento ao RH (sem I/O, testadas em encaminhar-rh.test.ts).
//
// LGPD / decisão do usuário: o e-mail ao RH leva nome, RE, posto, função, relato e resumo do histórico.
// NUNCA leva CPF, salário, PCD, CID nem motivo de atestado, conversa ou notas internas.
// Por isso o rascunho recebe CAMPOS EXPLÍCITOS (nunca um registro de funcionário inteiro).

import { escapeHtml } from './devolutiva'

export const MAX_DESTINATARIOS = 5

export type DadosRascunhoRH = {
  remetenteNome: string
  funcionarioNome: string
  registro: string | null
  funcao: string | null
  postoNome: string
  secretaria: string
  dataOcorrencia: string | null // AAAA-MM-DD
  gravidade: string | null // já com rótulo ("Média")
  supervisorNome: string | null
  textoOcorrencia: string
  advertencias: { grau: string; natureza: string; data: string | null }[]
  atestados: { inicio: string; fim: string | null }[] // só datas: sem CID nem motivo
  faltas: { tipo: string; dias: number; data: string }[]
}

function fmtData(iso: string | null): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('T')[0].split('-')
  return `${d}/${m}/${y}`
}

function diasInclusivos(inicio: string, fim: string | null): number {
  if (!fim) return 1
  const d1 = new Date(inicio.split('T')[0] + 'T00:00:00')
  const d2 = new Date(fim.split('T')[0] + 'T00:00:00')
  return Math.max(1, Math.round((d2.getTime() - d1.getTime()) / 86400000) + 1)
}

export function montarRascunhoRH(d: DadosRascunhoRH): { assunto: string; corpo: string } {
  const assunto = d.registro
    ? `Ocorrência — ${d.funcionarioNome} (RE ${d.registro})`
    : `Ocorrência — ${d.funcionarioNome}`

  const advertencias = d.advertencias.length === 0
    ? 'Advertências: nenhuma'
    : ['Advertências:', ...d.advertencias.map(a => `- ${a.grau} — ${a.natureza} (${fmtData(a.data)})`)].join('\n')

  const atestados = d.atestados.length === 0
    ? 'Atestados: nenhum'
    : [
        'Atestados:',
        ...d.atestados.map(a => {
          const dias = diasInclusivos(a.inicio, a.fim)
          const periodo = a.fim && a.fim !== a.inicio ? `${fmtData(a.inicio)} a ${fmtData(a.fim)}` : fmtData(a.inicio)
          return `- ${periodo} (${dias} ${dias === 1 ? 'dia' : 'dias'})`
        }),
      ].join('\n')

  const faltas = d.faltas.length === 0
    ? 'Faltas: nenhuma'
    : ['Faltas:', ...d.faltas.map(f => `- ${f.tipo}, ${f.dias} dia(s) (${fmtData(f.data)})`)].join('\n')

  const quemRegistrou = d.supervisorNome ? `, registrada pelo supervisor ${d.supervisorNome},` : ''

  const corpo = [
    'Prezada Coordenadora de RH,',
    '',
    `Encaminho a ocorrência abaixo${quemRegistrou} para sua análise e orientação.`,
    '',
    'COLABORADOR',
    `Nome: ${d.funcionarioNome}`,
    `Matrícula (RE): ${d.registro ?? '—'}`,
    `Função: ${d.funcao ?? '—'}`,
    `Posto: ${d.postoNome}${d.secretaria ? ` — ${d.secretaria}` : ''}`,
    '',
    'OCORRÊNCIA',
    `Data: ${fmtData(d.dataOcorrencia)}`,
    `Gravidade: ${d.gravidade ?? '—'}`,
    'Relato:',
    d.textoOcorrencia,
    '',
    'HISTÓRICO',
    advertencias,
    atestados,
    faltas,
    '',
    'Fico no aguardo da sua orientação. Pode responder diretamente a este e-mail.',
    '',
    'Atenciosamente,',
    d.remetenteNome,
  ].join('\n')

  return { assunto, corpo }
}

const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/

export function validarEmails(
  texto: string,
): { ok: true; emails: string[] } | { ok: false; error: string } {
  const partes = texto.split(/[;,]/).map(s => s.trim()).filter(Boolean)
  if (partes.length === 0) return { ok: false, error: 'Informe o e-mail do destinatário' }
  const invalido = partes.find(p => !EMAIL_RE.test(p))
  if (invalido) return { ok: false, error: `E-mail inválido: ${invalido}` }
  const emails = Array.from(new Set(partes.map(p => p.toLowerCase())))
  if (emails.length > MAX_DESTINATARIOS) {
    return { ok: false, error: `Máximo de ${MAX_DESTINATARIOS} destinatários` }
  }
  return { ok: true, emails }
}

export function diasComRH(desde: string, hoje: Date = new Date()): number {
  const ms = hoje.getTime() - new Date(desde).getTime()
  return Math.max(0, Math.floor(ms / 86400000))
}

// O corpo é texto puro editado pelo coordenador: escapa e preserva as quebras de linha.
export function corpoParaHtml(corpo: string): string {
  const conteudo = escapeHtml(corpo).replace(/\r?\n/g, '<br>')
  return `<!DOCTYPE html>
<html lang="pt-BR">
<body style="margin:0;padding:16px;background:#f1f5f9;font-family:Arial,sans-serif">
<div style="max-width:640px;margin:0 auto;background:#fff;border-radius:10px;padding:24px;font-size:14px;line-height:1.6;color:#1e293b">${conteudo}</div>
</body></html>`
}

/**
 * Insere um bloco de "CONSIDERAÇÕES" (sugerido pela IA) no rascunho do e-mail, antes da frase de fechamento.
 * O cabeçalho com nome, RE, posto e histórico continua vindo do sistema, nunca da IA.
 */
export function inserirConsideracoes(corpo: string, consideracoes: string): string {
  const bloco = consideracoes.trim()
  if (!bloco) return corpo
  const secao = `CONSIDERAÇÕES\n${bloco}\n`
  const marca = 'Fico no aguardo da sua orientação.'
  const i = corpo.indexOf(marca)
  if (i < 0) return `${corpo.trimEnd()}\n\n${secao}`
  return `${corpo.slice(0, i)}${secao}\n${corpo.slice(i)}`
}
