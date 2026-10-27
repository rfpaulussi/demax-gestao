import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { AdvertenciaCompleta } from '@/app/(admin)/advertencias/actions'

const GRAU_LABEL: Record<string, string> = {
  verbal:    'Advertência Verbal',
  escrita:   'Advertência Escrita',
  suspensao: 'Suspensão Disciplinar',
}

const NATUREZA_LABEL: Record<string, string> = {
  comportamento:   'Mau Procedimento / Conduta Inadequada',
  falta:           'Falta Injustificada',
  atraso:          'Atraso Recorrente',
  negligencia:     'Negligência no Trabalho',
  descumprimento:  'Descumprimento de Normas Internas',
  insubordinacao:  'Insubordinação',
  'desídia':       'Desídia no Desempenho das Funções',
  improbidade:     'Improbidade / Desonestidade',
  ofensa_honra:    'Ofensa à Honra de Colegas ou Terceiros',
  ofensa_superior: 'Ofensa ao Empregador ou Superior Hierárquico',
  uso_indevido:    'Uso Indevido de Equipamentos/Patrimônio',
  embriaguez:      'Embriaguez em Serviço',
  abandono:        'Abandono de Emprego / Posto de Trabalho',
  outro:           'Outro',
}

const NATUREZA_CLT_PDF: Record<string, string> = {
  comportamento:   'Art. 482, alínea "b" da CLT',
  falta:           'Art. 482, alínea "e" da CLT',
  atraso:          'Art. 482, alínea "e" da CLT',
  negligencia:     'Art. 482, alínea "e" da CLT',
  descumprimento:  'Art. 482, alínea "h" da CLT',
  insubordinacao:  'Art. 482, alínea "h" da CLT',
  'desídia':       'Art. 482, alínea "e" da CLT',
  improbidade:     'Art. 482, alínea "a" da CLT',
  ofensa_honra:    'Art. 482, alínea "j" da CLT',
  ofensa_superior: 'Art. 482, alínea "k" da CLT',
  uso_indevido:    'Art. 482, alínea "h" da CLT',
  embriaguez:      'Art. 482, alínea "f" da CLT',
  abandono:        'Art. 482, alínea "i" da CLT',
  outro:           'Art. 482 da CLT e Regulamento Interno',
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
  relato:          { fontSize: 9, lineHeight: 1.6, borderWidth: 1, borderColor: '#d1d5db', padding: 8, marginTop: 4, backgroundColor: '#f9fafb' },
  sigGrid:         { flexDirection: 'row', marginTop: 8 },
  sigBox:          { width: 260, borderTopWidth: 1, borderTopColor: '#9ca3af', paddingTop: 6 },
  sigName:         { fontSize: 8, fontFamily: 'Helvetica-Bold', marginTop: 20 },
  footer:          { position: 'absolute', bottom: 20, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingTop: 6 },
  footerText:      { fontSize: 7, color: '#9ca3af' },
})

function fmt(iso: string | null): string {
  if (!iso) return '—'
  const d = iso.split('T')[0].split('-')
  return `${d[2]}/${d[1]}/${d[0]}`
}

function AdvertenciaDocument({ adv }: { adv: AdvertenciaCompleta }) {
  const grauKey = (adv.grau ?? adv.tipo ?? '') as string
  const grauLabel = GRAU_LABEL[grauKey] ?? (grauKey || '—')
  const naturezaLabel = adv.natureza ? (NATUREZA_LABEL[adv.natureza] ?? adv.natureza) : '—'
  const idShort = adv.id.substring(0, 8).toUpperCase()
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

        {/* Título */}
        <Text style={s.title}>TERMO DE ADVERTÊNCIA DISCIPLINAR</Text>

        {/* I. Dados do Colaborador */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>I. DADOS DO COLABORADOR</Text>
          <View style={s.row}>
            <Text style={s.label}>Nome:</Text>
            <Text style={s.value}>{adv.funcionarios?.nome ?? '—'}</Text>
          </View>
          <View style={s.row}>
            <Text style={s.label}>CPF:</Text>
            <Text style={s.value}>***.***.***-**</Text>
          </View>
          <View style={s.row}>
            <Text style={s.label}>Função:</Text>
            <Text style={s.value}>{adv.funcionarios?.funcoes?.nome ?? '—'}</Text>
          </View>
          <View style={s.row}>
            <Text style={s.label}>Posto de Trabalho:</Text>
            <Text style={s.value}>{adv.funcionarios?.postos?.nome ?? '—'}</Text>
          </View>
          <View style={s.row}>
            <Text style={s.label}>Secretaria:</Text>
            <Text style={s.value}>{adv.funcionarios?.postos?.secretaria ?? '—'}</Text>
          </View>
        </View>

        {/* II. Ocorrência */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>II. DESCRIÇÃO DA OCORRÊNCIA</Text>
          <View style={s.row}>
            <Text style={s.label}>Data da Ocorrência:</Text>
            <Text style={s.value}>{fmt(adv.data_ocorrencia)}</Text>
          </View>
          {adv.horario_fato ? (
            <View style={s.row}>
              <Text style={s.label}>Horário:</Text>
              <Text style={s.value}>{adv.horario_fato}</Text>
            </View>
          ) : null}
          <View style={s.row}>
            <Text style={s.label}>Natureza:</Text>
            <Text style={s.value}>{naturezaLabel}</Text>
          </View>
          {adv.natureza && NATUREZA_CLT_PDF[adv.natureza] && (
            <View style={s.row}>
              <Text style={s.label}>Fundamentação Legal:</Text>
              <Text style={s.value}>{NATUREZA_CLT_PDF[adv.natureza]}</Text>
            </View>
          )}
          {(adv.relato || adv.descricao) ? (
            <View style={{ marginTop: 4 }}>
              <Text style={[s.label, { marginBottom: 4 }]}>Relato:</Text>
              <Text style={s.relato}>{adv.relato || adv.descricao}</Text>
            </View>
          ) : null}
        </View>

        {/* III. Medida Disciplinar */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>III. MEDIDA DISCIPLINAR APLICADA</Text>
          <View style={s.row}>
            <Text style={s.label}>Grau da Medida:</Text>
            <Text style={s.value}>{grauLabel}</Text>
          </View>
          {(adv.grau === 'suspensao' && adv.dias_suspensao) ? (
            <View style={s.row}>
              <Text style={s.label}>Dias de Suspensão:</Text>
              <Text style={s.value}>{adv.dias_suspensao} dia{adv.dias_suspensao > 1 ? 's' : ''}</Text>
            </View>
          ) : null}
          <View style={s.row}>
            <Text style={s.label}>Data de Aplicação:</Text>
            <Text style={s.value}>{fmt(adv.data_aplicacao)}</Text>
          </View>
          {adv.registrado_por ? (
            <View style={s.row}>
              <Text style={s.label}>Aplicado por:</Text>
              <Text style={s.value}>{adv.registrado_por}</Text>
            </View>
          ) : null}
        </View>

        {/* Assinatura do colaborador */}
        <View style={[s.section, { marginTop: 40 }]} wrap={false}>
          <View style={s.sigGrid}>
            <View style={s.sigBox}>
              <Text style={s.sigName}>{adv.funcionarios?.nome ?? '—'}</Text>
            </View>
          </View>
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

export async function downloadAdvertenciaPDF(adv: AdvertenciaCompleta): Promise<void> {
  const { pdf } = await import('@react-pdf/renderer')
  const blob = await pdf(<AdvertenciaDocument adv={adv} />).toBlob()
  const url = URL.createObjectURL(blob)
  const nomeSanitizado = (adv.funcionarios?.nome ?? 'colaborador')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '')
  const data = (adv.data_ocorrencia ?? new Date().toISOString()).split('T')[0]
  const idCurto = adv.id.substring(0, 8)
  const a = document.createElement('a')
  a.href = url
  a.download = `advertencia_${nomeSanitizado}_${data}_${idCurto}.pdf`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}
