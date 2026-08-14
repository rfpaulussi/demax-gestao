import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { DossieFuncionario, TimelineTipo } from '@/app/(admin)/ocorrencias/actions'

const TIPO_LABEL: Record<TimelineTipo, string> = {
  advertencia: 'Advertência',
  atestado:    'Atestado',
  falta:       'Falta',
  ocorrencia:  'Ocorrência',
}

const TIPO_COLOR: Record<TimelineTipo, string> = {
  advertencia: '#c2410c',
  atestado:    '#2563eb',
  falta:       '#dc2626',
  ocorrencia:  '#9333ea',
}

const s = StyleSheet.create({
  page:            { fontFamily: 'Helvetica', fontSize: 10, padding: 40, color: '#111827' },
  headerRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#111827' },
  companyName:     { fontSize: 20, fontFamily: 'Helvetica-Bold', letterSpacing: 3 },
  companySubtitle: { fontSize: 8, color: '#6b7280', marginTop: 2 },
  regBlock:        { alignItems: 'flex-end' },
  regLabel:        { fontSize: 7, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1 },
  regValue:        { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#111827' },
  title:           { textAlign: 'center', fontSize: 13, fontFamily: 'Helvetica-Bold', letterSpacing: 1, marginVertical: 14, borderWidth: 1, borderColor: '#111827', paddingVertical: 7, paddingHorizontal: 12 },
  section:         { marginBottom: 14 },
  sectionTitle:    { fontSize: 8, fontFamily: 'Helvetica-Bold', letterSpacing: 1, color: '#6b7280', marginBottom: 6, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  row:             { flexDirection: 'row', marginBottom: 3 },
  label:           { width: 130, fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#374151' },
  value:           { flex: 1, fontSize: 9 },
  resumo:          { fontSize: 9, lineHeight: 1.6, borderWidth: 1, borderColor: '#d1d5db', padding: 8, backgroundColor: '#f9fafb' },
  eventRow:        { flexDirection: 'row', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f3f4f6', gap: 10 },
  eventDate:       { width: 60, fontSize: 8, color: '#6b7280', paddingTop: 1 },
  eventBadge:      { width: 80, fontSize: 7, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', paddingTop: 1 },
  eventBody:       { flex: 1 },
  eventTitulo:     { fontSize: 9, color: '#111827', marginBottom: 2 },
  eventDetalhe:    { fontSize: 8, color: '#6b7280' },
  footer:          { position: 'absolute', bottom: 20, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingTop: 6 },
  footerText:      { fontSize: 7, color: '#9ca3af' },
})

function fmt(iso: string): string {
  if (!iso) return '—'
  const d = iso.split('T')[0].split('-')
  return `${d[2]}/${d[1]}/${d[0]}`
}

function resumoTexto(kpis: DossieFuncionario['kpis']): string {
  return `Registra ${kpis.advertencias} advertência(s), ${kpis.diasAtestado12m} dia(s) de atestado nos últimos 12 meses, ${kpis.faltas} falta(s) e ${kpis.ocorrenciasAbertas} ocorrência(s) aberta(s) no momento da emissão.`
}

function DossieDocument({ dossie }: { dossie: DossieFuncionario }) {
  const idShort = dossie.funcionario.id.substring(0, 8).toUpperCase()
  const emitidoEm = fmt(new Date().toISOString())

  return (
    <Document>
      <Page size="A4" style={s.page}>

        {/* Cabeçalho */}
        <View style={s.headerRow}>
          <View>
            <Text style={s.companyName}>DEMAX</Text>
            <Text style={s.companySubtitle}>Serviços e Comércio LTDA</Text>
          </View>
          <View style={s.regBlock}>
            <Text style={s.regLabel}>Registro</Text>
            <Text style={s.regValue}>{idShort}</Text>
          </View>
        </View>

        <Text style={s.title}>DOSSIÊ DO FUNCIONÁRIO</Text>

        {/* Dados do colaborador */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>DADOS DO COLABORADOR</Text>
          <View style={s.row}>
            <Text style={s.label}>Nome:</Text>
            <Text style={s.value}>{dossie.funcionario.nome}</Text>
          </View>
          <View style={s.row}>
            <Text style={s.label}>RE:</Text>
            <Text style={s.value}>{dossie.funcionario.registro ?? '—'}</Text>
          </View>
          <View style={s.row}>
            <Text style={s.label}>CPF:</Text>
            <Text style={s.value}>***.***.***-**</Text>
          </View>
          <View style={s.row}>
            <Text style={s.label}>Posto de Trabalho:</Text>
            <Text style={s.value}>{dossie.funcionario.posto_nome}</Text>
          </View>
          <View style={s.row}>
            <Text style={s.label}>Secretaria:</Text>
            <Text style={s.value}>{dossie.funcionario.secretaria || '—'}</Text>
          </View>
        </View>

        {/* Resumo */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>RESUMO</Text>
          <Text style={s.resumo}>{resumoTexto(dossie.kpis)}</Text>
        </View>

        {/* Histórico completo */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>HISTÓRICO COMPLETO ({dossie.timeline.length})</Text>
          {dossie.timeline.length === 0 ? (
            <Text style={{ fontSize: 9, color: '#9ca3af' }}>Nenhum registro encontrado.</Text>
          ) : (
            dossie.timeline.map(item => (
              <View key={item.id} style={s.eventRow}>
                <Text style={s.eventDate}>{fmt(item.data)}</Text>
                <Text style={[s.eventBadge, { color: TIPO_COLOR[item.tipo] }]}>{TIPO_LABEL[item.tipo]}</Text>
                <View style={s.eventBody}>
                  <Text style={s.eventTitulo}>{item.titulo}</Text>
                  {item.detalhe ? <Text style={s.eventDetalhe}>{item.detalhe}</Text> : null}
                </View>
              </View>
            ))
          )}
        </View>

        {/* Rodapé */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>DEMAX Serviços e Comércio LTDA</Text>
          <Text style={s.footerText}>Reg. {idShort} · Emitido em {emitidoEm}</Text>
        </View>

      </Page>
    </Document>
  )
}

export async function downloadDossiePDF(dossie: DossieFuncionario): Promise<void> {
  const { pdf } = await import('@react-pdf/renderer')
  const blob = await pdf(<DossieDocument dossie={dossie} />).toBlob()
  const url = URL.createObjectURL(blob)
  const nomeSanitizado = dossie.funcionario.nome
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '')
  const data = new Date().toISOString().split('T')[0]
  const a = document.createElement('a')
  a.href = url
  a.download = `dossie_${nomeSanitizado}_${data}.pdf`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}
