import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

export type DadosComunicadoDesligamento = {
  nome: string
  registro: string | null
  funcao: string | null
  dataAdmissao: string | null
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
  blank:           { fontSize: 10, color: '#9ca3af', borderBottomWidth: 1, borderBottomColor: '#d1d5db', paddingBottom: 2, minHeight: 14 },
  causaGrid:       { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  causaItem:       { flexDirection: 'row', alignItems: 'center', width: '48%', marginBottom: 6 },
  checkbox:        { width: 10, height: 10, borderWidth: 1, borderColor: '#111827', marginRight: 6 },
  causaLabel:      { fontSize: 9, color: '#111827' },
  motivoBox:       { borderWidth: 1, borderColor: '#d1d5db', minHeight: 40, marginTop: 4, padding: 6 },
  sigGrid:         { flexDirection: 'row', marginTop: 24, gap: 8 },
  sigBox:          { flex: 1, borderTopWidth: 1, borderTopColor: '#9ca3af', paddingTop: 6 },
  sigRole:         { fontSize: 7, color: '#6b7280', textAlign: 'center' },
  footer:          { position: 'absolute', bottom: 20, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingTop: 6 },
  footerText:      { fontSize: 7, color: '#9ca3af' },
})

const CAUSAS = [
  'Pedido de Demissão',
  'Reprova na Experiência',
  'Dispensa sem Justa Causa Indenizado',
  'Dispensa com Justa Causa',
  'Dispensa sem Justa Causa Trabalhado',
  'Falecimento',
]

function fmt(iso: string | null): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('T')[0].split('-')
  return `${d}/${m}/${y}`
}

function ComunicadoDocument({ dados }: { dados: DadosComunicadoDesligamento }) {
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
            <Text style={s.regLabel}>Recursos Humanos</Text>
            <Text style={s.regValue}>Comunicação</Text>
          </View>
        </View>

        <Text style={s.title}>COMUNICAÇÃO DE DESLIGAMENTO</Text>

        {/* Colaborador */}
        <View style={s.section}>
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
            <View style={s.cell}>
              <Text style={s.label}>Função</Text>
              <Text style={s.value}>{dados.funcao ?? '—'}</Text>
            </View>
            <View style={s.cell}>
              <Text style={s.label}>Contrato</Text>
              <Text style={s.blank}> </Text>
            </View>
          </View>
        </View>

        {/* Causa */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>CAUSA</Text>
          <View style={s.causaGrid}>
            {CAUSAS.map(c => (
              <View key={c} style={s.causaItem}>
                <View style={s.checkbox} />
                <Text style={s.causaLabel}>{c}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Motivo */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>MOTIVO(S)</Text>
          <View style={s.motivoBox} />
        </View>

        {/* Uniforme / exame */}
        <View style={s.section}>
          <View style={s.row}>
            <View style={s.cell}>
              <Text style={s.label}>Devolução de Uniforme</Text>
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 2 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={s.checkbox} /><Text style={s.causaLabel}>Sim</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={s.checkbox} /><Text style={s.causaLabel}>Não</Text>
                </View>
              </View>
            </View>
            <View style={s.cell}>
              <Text style={s.label}>Exame Demissional</Text>
              <Text style={s.blank}>____/____/____</Text>
            </View>
          </View>
          <View style={s.row}>
            <View style={s.cell}>
              <Text style={s.label}>Data de Admissão</Text>
              <Text style={s.value}>{fmt(dados.dataAdmissao)}</Text>
            </View>
            <View style={s.cell}>
              <Text style={s.label}>Data de Desligamento</Text>
              <Text style={s.blank}>____/____/____</Text>
            </View>
          </View>
          <View style={s.row}>
            <View style={s.cell}>
              <Text style={s.label}>Será Substituído</Text>
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 2 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={s.checkbox} /><Text style={s.causaLabel}>Sim</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={s.checkbox} /><Text style={s.causaLabel}>Não</Text>
                </View>
              </View>
            </View>
            <View style={s.cell} />
          </View>
        </View>

        {/* Assinaturas */}
        <View style={s.sigGrid} wrap={false}>
          {['Diretoria', 'Coordenador', 'Supervisor', 'RH', 'Gerente Operacional'].map(papel => (
            <View key={papel} style={s.sigBox}>
              <Text style={s.sigRole}>{papel}</Text>
            </View>
          ))}
        </View>

        {/* Rodapé */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>DEMAX Serviços e Comércio LTDA</Text>
          <Text style={s.footerText}>Emitido em {emitidoEm}</Text>
        </View>

      </Page>
    </Document>
  )
}

export async function downloadComunicadoDesligamentoPDF(dados: DadosComunicadoDesligamento): Promise<void> {
  const { pdf } = await import('@react-pdf/renderer')
  const blob = await pdf(<ComunicadoDocument dados={dados} />).toBlob()
  const url = URL.createObjectURL(blob)
  const nomeSanitizado = dados.nome
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '')
  const data = new Date().toISOString().split('T')[0]
  const a = document.createElement('a')
  a.href = url
  a.download = `comunicado_desligamento_${nomeSanitizado}_${data}.pdf`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}
