// Gatilho: Database Webhook — INSERT em advertencias onde status='pendente'
// Gera PDF da advertência, salva no Storage (bucket 'advertencias') e atualiza o registro.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { PDFDocument, StandardFonts, rgb } from 'https://esm.sh/pdf-lib@1.17.1'

interface WebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE'
  table: string
  record: {
    id: string
    funcionario_id: string
    tipo: string | null
    descricao: string | null
    data_ocorrencia: string | null
    status: string | null
  }
  schema: string
}

function fmtDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR')
}

function drawField(
  page: ReturnType<PDFDocument['addPage']>,
  label: string,
  value: string,
  x: number,
  y: number,
  fonts: { bold: Awaited<ReturnType<PDFDocument['embedFont']>>; regular: Awaited<ReturnType<PDFDocument['embedFont']>> },
): number {
  const gray  = rgb(0.45, 0.45, 0.45)
  const black = rgb(0, 0, 0)
  page.drawText(label.toUpperCase(), { x, y, font: fonts.bold, size: 8, color: gray })
  y -= 15
  page.drawText(value, { x, y, font: fonts.regular, size: 11, color: black })
  return y - 22
}

function wrapText(text: string, maxChars = 78): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    if ((current + word).length > maxChars) {
      if (current) lines.push(current.trimEnd())
      current = ''
    }
    current += word + ' '
  }
  if (current.trim()) lines.push(current.trimEnd())
  return lines
}

Deno.serve(async (req) => {
  try {
    const payload: WebhookPayload = await req.json()

    if (payload.type !== 'INSERT' || payload.record.status !== 'pendente') {
      return new Response(
        JSON.stringify({ skipped: true, reason: 'not a pendente INSERT' }),
        { headers: { 'Content-Type': 'application/json' } },
      )
    }

    const { id: advertenciaId, funcionario_id: funcionarioId } = payload.record

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: adv, error: advErr } = await supabase
      .from('advertencias')
      .select(`
        id, tipo, descricao, data_ocorrencia,
        funcionarios!funcionario_id (
          id, nome,
          funcoes!funcao_id ( nome ),
          postos!posto_id ( nome, secretaria )
        )
      `)
      .eq('id', advertenciaId)
      .single()

    if (advErr || !adv) throw advErr ?? new Error('Advertência não encontrada')

    type FuncData = {
      id: string; nome: string
      funcoes: { nome: string } | null
      postos: { nome: string; secretaria: string | null } | null
    }
    const func = adv.funcionarios as unknown as FuncData

    // ── Geração do PDF ────────────────────────────────────────────
    const pdfDoc  = await PDFDocument.create()
    const page    = pdfDoc.addPage([595.28, 841.89]) // A4
    const bold    = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
    const regular = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const fonts   = { bold, regular }
    const black   = rgb(0, 0, 0)
    const lightGray = rgb(0.85, 0.85, 0.85)
    const { width, height } = page.getSize()

    let y = height - 55

    // Cabeçalho
    page.drawText('DEMAX', { x: 50, y, font: bold, size: 26, color: black })
    y -= 16
    page.drawText('Gestão de Facilities', { x: 50, y, font: regular, size: 10, color: rgb(0.5, 0.5, 0.5) })
    y -= 28
    page.drawLine({ start: { x: 50, y }, end: { x: width - 50, y }, thickness: 1, color: lightGray })
    y -= 34

    // Título do documento
    page.drawText('ADVERTÊNCIA', { x: 50, y, font: bold, size: 22, color: black })
    y -= 40

    // Dados do funcionário
    y = drawField(page, 'Funcionário',  func.nome ?? '—',               50, y, fonts)
    y = drawField(page, 'Função',       func.funcoes?.nome ?? '—',       50, y, fonts)
    y = drawField(page, 'Posto',        func.postos?.nome ?? '—',        50, y, fonts)
    if (func.postos?.secretaria) {
      y = drawField(page, 'Secretaria', func.postos.secretaria,          50, y, fonts)
    }
    y = drawField(page, 'Tipo',         adv.tipo ?? '—',                 50, y, fonts)
    y = drawField(page, 'Data',         fmtDate(adv.data_ocorrencia),    50, y, fonts)

    // Descrição (com quebra de linha)
    page.drawText('DESCRIÇÃO', { x: 50, y, font: bold, size: 8, color: rgb(0.45, 0.45, 0.45) })
    y -= 15
    const linhas = wrapText(adv.descricao ?? '—')
    for (const linha of linhas) {
      page.drawText(linha, { x: 50, y, font: regular, size: 11, color: black })
      y -= 15
    }

    // Assinatura
    y -= 60
    page.drawLine({ start: { x: 50, y }, end: { x: 280, y }, thickness: 0.6, color: black })
    y -= 14
    page.drawText('Assinatura do Funcionário', { x: 50, y, font: regular, size: 9, color: rgb(0.5, 0.5, 0.5) })
    y -= 24
    page.drawText(new Date().toLocaleDateString('pt-BR'), { x: 50, y, font: regular, size: 9, color: rgb(0.5, 0.5, 0.5) })

    const pdfBytes = await pdfDoc.save()

    // ── Upload para Storage ───────────────────────────────────────
    const storagePath = `${funcionarioId}/${advertenciaId}.pdf`

    const { error: uploadErr } = await supabase.storage
      .from('advertencias')
      .upload(storagePath, pdfBytes, { contentType: 'application/pdf', upsert: true })

    if (uploadErr) throw uploadErr

    const { data: { publicUrl } } = supabase.storage
      .from('advertencias')
      .getPublicUrl(storagePath)

    const { error: updateErr } = await supabase
      .from('advertencias')
      .update({ pdf_url: publicUrl, status: 'gerada' })
      .eq('id', advertenciaId)

    if (updateErr) throw updateErr

    console.log(`[gerar-advertencia-pdf] PDF gerado: ${storagePath}`)

    return new Response(
      JSON.stringify({ success: true, pdf_url: publicUrl }),
      { headers: { 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('[gerar-advertencia-pdf] Erro:', err)
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
})
