import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { FaltaMesRow } from '@/app/(admin)/relatorios/faltas-mes/actions'

function fmt(iso: string): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

const TIPO_LABELS: Record<string, string> = {
  sem_justificativa: 'Sem Justif.', declaracao: 'Declaração',
  sem_atestado: 'Sem Atestado', com_atestado: 'Com Atestado', suspensao: 'Suspensão',
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
  cNome:    { width: 148 },
  cReg:     { width: 55 },
  cPosto:   { width: 90 },
  cSec:     { width: 65 },
  cSup:     { width: 82 },
  cTipo:    { width: 62 },
  cDias:    { width: 30 },
  cDoc:     { width: 36 },
  cJust:    { width: 78 },
})

interface Props { rows: FaltaMesRow[]; mes: number; ano: number; MESES: string[] }

export function FaltasMesDoc({ rows, mes, ano, MESES }: Props) {
  const geradoEm = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={s.page}>
        <Text style={s.title}>Faltas do Mês — {MESES[mes]} {ano}</Text>
        <Text style={s.subtitle}>Gerado em {geradoEm} · {rows.length} registro{rows.length !== 1 ? 's' : ''}</Text>

        <View style={s.thead}>
          <Text style={[s.th, s.cData ]}>Data</Text>
          <Text style={[s.th, s.cNome ]}>Funcionário</Text>
          <Text style={[s.th, s.cReg  ]}>Matrícula</Text>
          <Text style={[s.th, s.cPosto]}>Posto</Text>
          <Text style={[s.th, s.cSec  ]}>Secretaria</Text>
          <Text style={[s.th, s.cSup  ]}>Supervisor</Text>
          <Text style={[s.th, s.cTipo ]}>Tipo</Text>
          <Text style={[s.th, s.cDias ]}>Dias</Text>
          <Text style={[s.th, s.cDoc  ]}>Doc.</Text>
          <Text style={[s.th, s.cJust ]}>Justificativa</Text>
        </View>

        {rows.map((r, i) => (
          <View key={r.id} style={i % 2 === 0 ? s.row : s.rowAlt}>
            <Text style={[s.tdNum,  s.cData ]}>{fmt(r.data_falta)}</Text>
            <Text style={[s.tdBold, s.cNome ]}>{r.funcionario_nome}</Text>
            <Text style={[s.td,     s.cReg  ]}>{r.registro ?? '—'}</Text>
            <Text style={[s.td,     s.cPosto]}>{r.posto_nome}</Text>
            <Text style={[s.td,     s.cSec  ]}>{r.secretaria}</Text>
            <Text style={[s.td,     s.cSup  ]}>{r.supervisor}</Text>
            <Text style={[s.td,     s.cTipo ]}>{TIPO_LABELS[r.tipo] ?? r.tipo}</Text>
            <Text style={[s.tdNum,  s.cDias ]}>{r.dias}</Text>
            <Text style={[s.tdNum,  s.cDoc  ]}>{r.tem_documento ? 'Sim' : 'Não'}</Text>
            <Text style={[s.td,     s.cJust ]}>{r.justificativa}</Text>
          </View>
        ))}
      </Page>
    </Document>
  )
}
