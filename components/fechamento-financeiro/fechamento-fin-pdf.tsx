import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { FechamentoFinanceiro } from '@/app/(admin)/fechamento-financeiro/actions'

const s = StyleSheet.create({
  page:              { padding: 20, fontSize: 7.5, fontFamily: 'Helvetica', backgroundColor: '#ffffff' },
  title:             { fontSize: 11, fontWeight: 'bold', marginBottom: 2 },
  subtitle:          { fontSize: 7.5, color: '#6b7280', marginBottom: 14 },
  groupHeader:       { backgroundColor: '#1e293b', color: '#ffffff', fontSize: 7, fontWeight: 'bold',
                       paddingVertical: 3, paddingHorizontal: 6, marginTop: 10 },
  groupHeaderGray:   { backgroundColor: '#6b7280', color: '#ffffff', fontSize: 7, fontWeight: 'bold',
                       paddingVertical: 3, paddingHorizontal: 6, marginTop: 10, flexDirection: 'row',
                       justifyContent: 'space-between' },
  groupHeaderGrayNote: { fontSize: 6.5, color: '#d1d5db' },
  groupTotal:        { backgroundColor: '#e2e8f0', flexDirection: 'row', borderBottomWidth: 1,
                       borderBottomColor: '#cbd5e1', paddingVertical: 3 },
  thead:       { flexDirection: 'row', backgroundColor: '#f8fafc', borderBottomWidth: 1,
                 borderBottomColor: '#e2e8f0' },
  th:          { fontSize: 6.5, fontWeight: 'bold', color: '#64748b', paddingVertical: 3,
                 paddingHorizontal: 3, textTransform: 'uppercase' },
  row:         { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  rowAlt:      { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
                 backgroundColor: '#fafafa' },
  rowAmber:    { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#fef3c7',
                 backgroundColor: '#fffbeb' },
  rowOrange:   { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#fed7aa',
                 backgroundColor: '#fff7ed' },
  badgeOrange: { fontSize: 6, color: '#c2410c', backgroundColor: '#ffedd5',
                 paddingHorizontal: 3, paddingVertical: 1, marginLeft: 3 },
  td:          { fontSize: 7.5, color: '#374151', paddingVertical: 3, paddingHorizontal: 3 },
  tdNum:       { fontSize: 7.5, color: '#374151', paddingVertical: 3, paddingHorizontal: 3, textAlign: 'right' },
  tdBold:      { fontSize: 7.5, fontWeight: 'bold', color: '#374151', paddingVertical: 3, paddingHorizontal: 3 },
  tdIndigo:    { fontSize: 7.5, fontWeight: 'bold', color: '#4338ca', paddingVertical: 3, paddingHorizontal: 3, textAlign: 'right' },
  tdAmber:     { fontSize: 7.5, color: '#92400e', paddingVertical: 3, paddingHorizontal: 3, textAlign: 'right' },
  cNome:   { width: 130 },
  cFuncao: { width: 90 },
  cPosto:  { width: 90 },
  cDias:   { width: 48 },
  cSal:    { width: 68 },
  cCusto:  { width: 68 },
})

function fmtBRL(v: number | null): string {
  if (v == null) return '—'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

interface Props {
  dados: FechamentoFinanceiro[]
  mes: number
  ano: number
  MESES: string[]
}

export function FechamentoFinPdfDoc({ dados, mes, ano, MESES }: Props) {
  const secretarias = Array.from(new Set(dados.map(d => d.secretaria ?? 'Sem Secretaria')))
    .sort((a, b) => {
      if (a === 'AFASTADOS') return 1
      if (b === 'AFASTADOS') return -1
      return a.localeCompare(b, 'pt-BR')
    })
  const geradoEm = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  const custoGeral = dados.filter(d => !d.is_afastado).reduce((s, d) => s + (d.custo_prop ?? 0), 0)

  const COLS = [
    { label: 'Funcionário', style: s.cNome },
    { label: 'Função',      style: s.cFuncao },
    { label: 'Posto',       style: s.cPosto },
    { label: 'Dias T/Ú',    style: s.cDias },
    { label: 'Sal. Prop.',  style: s.cSal },
    { label: 'Custo Prop.', style: s.cCusto },
  ]

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={s.page}>
        <Text style={s.title}>Fechamento Financeiro — {MESES[mes]} {ano}</Text>
        <Text style={s.subtitle}>
          Gerado em {geradoEm} · {dados.length} funcionários · Custo total: {fmtBRL(custoGeral)}
        </Text>

        {secretarias.map(sec => {
          const grupo        = dados.filter(d => (d.secretaria ?? 'Sem Secretaria') === sec)
          const isAfastados  = sec.toUpperCase() === 'AFASTADOS'
          const totalSalario = grupo.reduce((acc, d) => acc + d.salario_prop, 0)
          const totalCusto   = isAfastados ? 0 : grupo.reduce((acc, d) => acc + (d.custo_prop ?? 0), 0)

          return (
            <View key={sec} wrap={false}>
              {isAfastados ? (
                <View style={s.groupHeaderGray}>
                  <Text>{sec.toUpperCase()} ({grupo.length})</Text>
                  <Text style={s.groupHeaderGrayNote}>Custo não computado</Text>
                </View>
              ) : (
                <Text style={s.groupHeader}>{sec.toUpperCase()} ({grupo.length})</Text>
              )}

              <View style={s.thead}>
                {COLS.map(c => (
                  <View key={c.label} style={c.style}>
                    <Text style={s.th}>{c.label}</Text>
                  </View>
                ))}
              </View>

              {grupo.map((d, idx) => {
                const rowStyle = d.sem_custo
                  ? s.rowAmber
                  : d.em_ferias
                    ? s.rowOrange
                    : idx % 2 === 0 ? s.row : s.rowAlt
                return (
                  <View key={d.funcionario_id} style={rowStyle}>
                    <View style={[s.cNome, { flexDirection: 'row', alignItems: 'center' }]}>
                      <Text style={s.td}>{d.funcionario_nome}</Text>
                      {d.em_ferias && (
                        <Text style={s.badgeOrange}>Férias {d.dias_ferias}d</Text>
                      )}
                    </View>
                    <View style={s.cFuncao}><Text style={s.td}>{d.funcao ?? '—'}</Text></View>
                    <View style={s.cPosto}><Text style={s.td}>{d.posto_nome ?? '—'}</Text></View>
                    <View style={s.cDias}>
                      <Text style={s.tdNum}>{isAfastados ? '—' : `${d.dias_trabalhados}/${d.dias_uteis}`}</Text>
                    </View>
                    <View style={s.cSal}>
                      <Text style={s.tdNum}>{isAfastados ? '—' : fmtBRL(d.salario_prop)}</Text>
                    </View>
                    <View style={s.cCusto}>
                      <Text style={isAfastados ? s.td : d.sem_custo ? s.tdAmber : s.tdIndigo}>
                        {isAfastados ? '—' : d.custo_prop != null ? fmtBRL(d.custo_prop) : '—'}
                      </Text>
                    </View>
                  </View>
                )
              })}

              <View style={s.groupTotal}>
                <View style={s.cNome}><Text style={s.tdBold}>TOTAL</Text></View>
                <View style={s.cFuncao}><Text style={s.td} /></View>
                <View style={s.cPosto}><Text style={s.td} /></View>
                <View style={s.cDias}><Text style={s.td} /></View>
                <View style={s.cSal}>
                  <Text style={[s.tdNum, { fontWeight: 'bold' }]}>
                    {isAfastados ? '—' : fmtBRL(totalSalario)}
                  </Text>
                </View>
                <View style={s.cCusto}>
                  <Text style={[s.tdIndigo, { fontWeight: 'bold' }]}>
                    {isAfastados ? '—' : fmtBRL(totalCusto)}
                  </Text>
                </View>
              </View>
            </View>
          )
        })}
      </Page>
    </Document>
  )
}
