import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

export type DadosSolicitacaoFerias = {
  nome: string
  registro: string | null
  posto: string
  secretaria: string
  numeroPeriodo: number | null
  periodoInicio: string | null
  periodoFim: string | null
  diasDireito: number
  diasAbono: number
  dataInicio: string
  dataFim: string
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
  row:             { flexDirection: 'row', marginBottom: 8 },
  cell:            { flex: 1 },
  label:           { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  value:           { fontSize: 10, color: '#111827' },
  valueBold:       { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#111827' },
  abonoBox:        { borderWidth: 1, borderColor: '#111827', padding: 8, marginTop: 4 },
  sigGrid:         { flexDirection: 'row', marginTop: 40, gap: 12 },
  sigBox:          { flex: 1, borderTopWidth: 1, borderTopColor: '#9ca3af', paddingTop: 6 },
  sigRole:         { fontSize: 8, color: '#6b7280', textAlign: 'center' },
  footer:          { position: 'absolute', bottom: 20, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingTop: 6 },
  footerText:      { fontSize: 7, color: '#9ca3af' },
})

function fmt(iso: string | null): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('T')[0].split('-')
  return `${d}/${m}/${y}`
}

// Retorno ao trabalho = dia seguinte ao último dia de gozo
function diaSeguinte(iso: string): string {
  const d = new Date(iso.split('T')[0] + 'T00:00:00')
  d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}

function SolicitacaoDocument({ dados }: { dados: DadosSolicitacaoFerias }) {
  const diasGozo = dados.diasDireito - dados.diasAbono
  const emitidoEm = fmt(new Date().toISOString())

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.headerRow}>
          <View>
            <Text style={s.companyName}>DEMAX</Text>
            <Text style={s.companySubtitle}>Serviços e Comércio LTDA</Text>
          </View>
          <View style={s.regBlock}>
            <Text style={s.regLabel}>Recursos Humanos</Text>
            <Text style={s.regValue}>Solicitação</Text>
          </View>
        </View>

        <Text style={s.title}>SOLICITAÇÃO DE FÉRIAS</Text>

        <View style={s.section}>
          <Text style={s.sectionTitle}>COLABORADOR</Text>
          <View style={s.row}>
            <View style={[s.cell, { flex: 2 }]}>
              <Text style={s.label}>Nome</Text>
              <Text style={s.value}>{dados.nome}</Text>
            </View>
            <View style={s.cell}>
              <Text style={s.label}>RE</Text>
              <Text style={s.value}>{dados.registro ?? '—'}</Text>
            </View>
          </View>
          <View style={s.row}>
            <View style={[s.cell, { flex: 2 }]}>
              <Text style={s.label}>Posto</Text>
              <Text style={s.value}>{dados.posto}</Text>
            </View>
            <View style={s.cell}>
              <Text style={s.label}>Secretaria</Text>
              <Text style={s.value}>{dados.secretaria}</Text>
            </View>
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>PERÍODO AQUISITIVO</Text>
          <View style={s.row}>
            <View style={s.cell}>
              <Text style={s.label}>Período</Text>
              <Text style={s.value}>{dados.numeroPeriodo ?? '—'}º</Text>
            </View>
            <View style={[s.cell, { flex: 2 }]}>
              <Text style={s.label}>Aquisitivo</Text>
              <Text style={s.value}>{fmt(dados.periodoInicio)} a {fmt(dados.periodoFim)}</Text>
            </View>
            <View style={s.cell}>
              <Text style={s.label}>Dias de direito</Text>
              <Text style={s.value}>{dados.diasDireito}</Text>
            </View>
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>GOZO</Text>
          <View style={s.row}>
            <View style={s.cell}>
              <Text style={s.label}>Início</Text>
              <Text style={s.valueBold}>{fmt(dados.dataInicio)}</Text>
            </View>
            <View style={s.cell}>
              <Text style={s.label}>Fim</Text>
              <Text style={s.valueBold}>{fmt(dados.dataFim)}</Text>
            </View>
            <View style={s.cell}>
              <Text style={s.label}>Retorno</Text>
              <Text style={s.valueBold}>{fmt(diaSeguinte(dados.dataFim))}</Text>
            </View>
            <View style={s.cell}>
              <Text style={s.label}>Dias de gozo</Text>
              <Text style={s.valueBold}>{diasGozo}</Text>
            </View>
          </View>
          {dados.diasAbono > 0 && (
            <View style={s.abonoBox}>
              <Text style={s.value}>
                O colaborador solicita a conversão de {dados.diasAbono} dias de férias em abono pecuniário (CLT art. 143).
              </Text>
            </View>
          )}
        </View>

        <View style={s.sigGrid} wrap={false}>
          {['Colaborador', 'Supervisor', 'RH'].map(papel => (
            <View key={papel} style={s.sigBox}>
              <Text style={s.sigRole}>{papel}</Text>
            </View>
          ))}
        </View>

        <View style={s.footer} fixed>
          <Text style={s.footerText}>DEMAX Serviços e Comércio LTDA</Text>
          <Text style={s.footerText}>Emitido em {emitidoEm}</Text>
        </View>
      </Page>
    </Document>
  )
}

export async function downloadSolicitacaoFeriasPDF(dados: DadosSolicitacaoFerias): Promise<void> {
  const { pdf } = await import('@react-pdf/renderer')
  const blob = await pdf(<SolicitacaoDocument dados={dados} />).toBlob()
  const url = URL.createObjectURL(blob)
  const nomeSanitizado = dados.nome
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '')
  const a = document.createElement('a')
  a.href = url
  a.download = `solicitacao_ferias_${nomeSanitizado}_${dados.dataInicio}.pdf`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}
