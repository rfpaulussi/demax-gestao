import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { MedicaoRow } from './medicao-table'

const SITUACAO_LABELS: Record<MedicaoRow['situacao'], string> = {
  completo: 'Completo',
  deficit:  'Déficit',
  excesso:  'Excesso',
}

const s = StyleSheet.create({
  page:          { padding: 24, fontSize: 7, fontFamily: 'Helvetica', backgroundColor: '#ffffff' },
  title:         { fontSize: 10, fontWeight: 'bold', marginBottom: 2 },
  subtitle:      { fontSize: 7, color: '#6b7280', marginBottom: 4 },
  statsRow:      { flexDirection: 'row', gap: 16, marginBottom: 10 },
  stat:          { flexDirection: 'row', gap: 3 },
  statLabel:     { fontSize: 7, color: '#6b7280' },
  statValue:     { fontSize: 7, fontWeight: 'bold', color: '#111827' },
  secHeader:     { backgroundColor: '#1e293b', color: '#ffffff', fontSize: 7, fontWeight: 'bold',
                   paddingVertical: 3, paddingHorizontal: 6, marginTop: 8 },
  thead:         { flexDirection: 'row', backgroundColor: '#f8fafc',
                   borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  th:            { fontSize: 6, fontWeight: 'bold', color: '#94a3b8',
                   paddingVertical: 3, paddingHorizontal: 4, textTransform: 'uppercase' },
  row:           { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  rowAlt:        { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
                   backgroundColor: '#fafafa' },
  rowDeficit:    { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#fecaca',
                   backgroundColor: '#fff5f5' },
  rowExcesso:    { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#c7d2fe',
                   backgroundColor: '#f5f3ff' },
  workerRow:     { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
                   backgroundColor: '#fafafa' },
  td:            { fontSize: 7, color: '#374151', paddingVertical: 2.5, paddingHorizontal: 4 },
  tdBold:        { fontSize: 7, fontWeight: 'bold', color: '#111827',
                   paddingVertical: 2.5, paddingHorizontal: 4 },
  tdRed:         { fontSize: 7, fontWeight: 'bold', color: '#dc2626',
                   paddingVertical: 2.5, paddingHorizontal: 4, textAlign: 'right' },
  tdGreen:       { fontSize: 7, fontWeight: 'bold', color: '#16a34a',
                   paddingVertical: 2.5, paddingHorizontal: 4, textAlign: 'right' },
  tdCenter:      { fontSize: 7, color: '#374151', paddingVertical: 2.5,
                   paddingHorizontal: 4, textAlign: 'center' },
  tdGray:        { fontSize: 7, color: '#9ca3af', paddingVertical: 2.5, paddingHorizontal: 4 },
  // Colunas — soma: 155+40+40+40+58+65+flex1 (usable ~794 pt landscape)
  cPosto: { width: 155 },
  cNum:   { width: 40, textAlign: 'center' },
  cDiff:  { width: 40, textAlign: 'right' },
  cSit:   { width: 58 },
  cRe:    { width: 65 },
  cNome:  { flex: 1 },
})

export interface MedicaoPdfProps {
  rows: MedicaoRow[]
  mesLabel: string
}

export function MedicaoPdfDoc({ rows, mesLabel }: MedicaoPdfProps) {
  const total    = rows.length
  const completo = rows.filter(r => r.situacao === 'completo').length
  const deficit  = rows.filter(r => r.situacao === 'deficit').length
  const excesso  = rows.filter(r => r.situacao === 'excesso').length

  const geradoEm = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })

  const secSet = Array.from(
    new Set(rows.map(r => r.secretaria ?? 'Sem Secretaria')),
  ).sort()

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={s.page}>
        <Text style={s.title}>Medição Mensal — {mesLabel}</Text>
        <Text style={s.subtitle}>Gerado em {geradoEm}</Text>

        <View style={s.statsRow}>
          <View style={s.stat}>
            <Text style={s.statLabel}>Total:</Text>
            <Text style={s.statValue}>{total} postos</Text>
          </View>
          <View style={s.stat}>
            <Text style={s.statLabel}>Completos:</Text>
            <Text style={s.statValue}>{completo}</Text>
          </View>
          <View style={s.stat}>
            <Text style={s.statLabel}>Déficit:</Text>
            <Text style={s.statValue}>{deficit}</Text>
          </View>
          <View style={s.stat}>
            <Text style={s.statLabel}>Excesso:</Text>
            <Text style={s.statValue}>{excesso}</Text>
          </View>
        </View>

        {secSet.map(sec => {
          const grupo = rows.filter(r => (r.secretaria ?? 'Sem Secretaria') === sec)
          return (
            <View key={sec}>
              <Text style={s.secHeader}>{sec.toUpperCase()} — {grupo.length} posto(s)</Text>

              <View style={s.thead}>
                <Text style={[s.th, s.cPosto]}>Posto</Text>
                <Text style={[s.th, s.cNum]}>Prev.</Text>
                <Text style={[s.th, s.cNum]}>Real</Text>
                <Text style={[s.th, s.cDiff]}>Dif.</Text>
                <Text style={[s.th, s.cSit]}>Situação</Text>
                <Text style={[s.th, s.cRe]}>RE</Text>
                <Text style={[s.th, s.cNome]}>Funcionário</Text>
              </View>

              {grupo.map((r, i) => {
                const rowStyle =
                  r.situacao === 'deficit' ? s.rowDeficit :
                  r.situacao === 'excesso' ? s.rowExcesso :
                  i % 2 === 0 ? s.row : s.rowAlt

                const diffLabel = r.diferenca > 0 ? `+${r.diferenca}` : String(r.diferenca)
                const diffStyle = r.diferenca < 0 ? s.tdRed : r.diferenca > 0 ? s.tdGreen : s.tdCenter
                const first = r.funcionarios[0]

                return (
                  <View key={r.posto_id}>
                    {/* Linha do posto + primeiro funcionário */}
                    <View style={rowStyle}>
                      <Text style={[s.tdBold, s.cPosto]}>{r.posto_nome}</Text>
                      <Text style={[s.tdCenter, s.cNum]}>{r.efetivo_previsto}</Text>
                      <Text style={[s.tdCenter, s.cNum]}>{r.efetivo_real}</Text>
                      <Text style={[diffStyle, s.cDiff]}>{diffLabel}</Text>
                      <Text style={[s.td, s.cSit]}>{SITUACAO_LABELS[r.situacao]}</Text>
                      <Text style={[s.tdGray, s.cRe]}>{first?.registro ?? '—'}</Text>
                      <Text style={[s.td, s.cNome]}>{first?.nome ?? '—'}</Text>
                    </View>

                    {/* Linhas adicionais para os demais funcionários do posto */}
                    {r.funcionarios.slice(1).map(f => (
                      <View key={f.id} style={s.workerRow}>
                        <Text style={[s.td, s.cPosto]}>{''}</Text>
                        <Text style={[s.td, s.cNum]}>{''}</Text>
                        <Text style={[s.td, s.cNum]}>{''}</Text>
                        <Text style={[s.td, s.cDiff]}>{''}</Text>
                        <Text style={[s.td, s.cSit]}>{''}</Text>
                        <Text style={[s.tdGray, s.cRe]}>{f.registro ?? '—'}</Text>
                        <Text style={[s.td, s.cNome]}>{f.nome}</Text>
                      </View>
                    ))}
                  </View>
                )
              })}
            </View>
          )
        })}
      </Page>
    </Document>
  )
}
