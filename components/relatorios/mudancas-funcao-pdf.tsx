import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { MudancaFuncaoRow } from '@/app/(admin)/relatorios/mudancas-funcao/actions'

function fmt(iso: string): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

const s = StyleSheet.create({
  page:     { padding: 28, fontSize: 7, fontFamily: 'Helvetica', backgroundColor: '#ffffff' },
  title:    { fontSize: 10, fontWeight: 'bold', marginBottom: 2 },
  subtitle: { fontSize: 7, color: '#6b7280', marginBottom: 12 },
  thead:    { flexDirection: 'row', backgroundColor: '#f8fafc', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  th:       { fontSize: 6, fontWeight: 'bold', color: '#94a3b8', paddingVertical: 3, paddingHorizontal: 4, textTransform: 'uppercase' },
  row:      { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  rowAlt:   { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f1f5f9', backgroundColor: '#fafafa' },
  td:       { fontSize: 7, color: '#374151', paddingVertical: 3, paddingHorizontal: 4 },
  tdBold:   { fontSize: 7, fontWeight: 'bold', color: '#111827', paddingVertical: 3, paddingHorizontal: 4 },
  tdNum:    { fontSize: 7, color: '#374151', paddingVertical: 3, paddingHorizontal: 4, textAlign: 'center' },
  cData:    { width: 52 },
  cNome:    { width: 152 },
  cReg:     { width: 55 },
  cSup:     { width: 88 },
  cFuncao:  { width: 108 },
  cPosto:   { width: 88 },
})

interface Props { rows: MudancaFuncaoRow[]; mes: number; ano: number; MESES: string[] }

export function MudancasFuncaoDoc({ rows, mes, ano, MESES }: Props) {
  const geradoEm = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={s.page}>
        <Text style={s.title}>Mudanças de Função — {MESES[mes]} {ano}</Text>
        <Text style={s.subtitle}>Gerado em {geradoEm} · {rows.length} registro{rows.length !== 1 ? 's' : ''}</Text>

        <View style={s.thead}>
          <Text style={[s.th, s.cData  ]}>Data</Text>
          <Text style={[s.th, s.cNome  ]}>Funcionário</Text>
          <Text style={[s.th, s.cReg   ]}>Matrícula</Text>
          <Text style={[s.th, s.cSup   ]}>Supervisor</Text>
          <Text style={[s.th, s.cFuncao]}>Fn. Anterior</Text>
          <Text style={[s.th, s.cFuncao]}>Fn. Nova</Text>
          <Text style={[s.th, s.cPosto ]}>Posto</Text>
        </View>

        {rows.map((r, i) => (
          <View key={r.id} style={i % 2 === 0 ? s.row : s.rowAlt}>
            <Text style={[s.tdNum,  s.cData  ]}>{fmt(r.data_evento)}</Text>
            <Text style={[s.tdBold, s.cNome  ]}>{r.funcionario_nome}</Text>
            <Text style={[s.td,     s.cReg   ]}>{r.registro ?? '—'}</Text>
            <Text style={[s.td,     s.cSup   ]}>{r.supervisor}</Text>
            <Text style={[s.td,     s.cFuncao]}>{r.funcao_anterior}</Text>
            <Text style={[s.td,     s.cFuncao]}>{r.funcao_nova}</Text>
            <Text style={[s.td,     s.cPosto ]}>{r.posto_nome}</Text>
          </View>
        ))}
      </Page>
    </Document>
  )
}
