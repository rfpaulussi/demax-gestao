import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { AdvertenciaMesRow } from '@/app/(admin)/relatorios/advertencias-mes/actions'

function fmt(iso: string): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

const GRAU_LABELS: Record<string, string> = {
  verbal: 'Verbal', escrita: 'Escrita', suspensao: 'Suspensão',
}

const s = StyleSheet.create({
  page:     { padding: 28, fontSize: 7, fontFamily: 'Helvetica', backgroundColor: '#ffffff' },
  title:    { fontSize: 10, fontWeight: 'bold', marginBottom: 2 },
  subtitle: { fontSize: 7, color: '#6b7280', marginBottom: 12 },
  thead:    { flexDirection: 'row', backgroundColor: '#f8fafc', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  th:       { fontSize: 6, fontWeight: 'bold', color: '#94a3b8', paddingVertical: 3, paddingHorizontal: 4, textTransform: 'uppercase' },
  row:      { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  rowAlt:   { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f1f5f9', backgroundColor: '#fafafa' },
  rowSusp:  { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f1f5f9', backgroundColor: '#fff1f2' },
  td:       { fontSize: 7, color: '#374151', paddingVertical: 3, paddingHorizontal: 4 },
  tdBold:   { fontSize: 7, fontWeight: 'bold', color: '#111827', paddingVertical: 3, paddingHorizontal: 4 },
  tdNum:    { fontSize: 7, color: '#374151', paddingVertical: 3, paddingHorizontal: 4, textAlign: 'center' },
  cData:    { width: 52 },
  cNome:    { width: 150 },
  cReg:     { width: 55 },
  cPosto:   { width: 88 },
  cSec:     { width: 62 },
  cSup:     { width: 82 },
  cGrau:    { width: 54 },
  cDesc:    { width: 102 },
  cDias:    { width: 36 },
  cStatus:  { width: 50 },
})

interface Props { rows: AdvertenciaMesRow[]; mes: number; ano: number; MESES: string[] }

export function AdvertenciasMesDoc({ rows, mes, ano, MESES }: Props) {
  const geradoEm = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={s.page}>
        <Text style={s.title}>Advertências do Mês — {MESES[mes]} {ano}</Text>
        <Text style={s.subtitle}>Gerado em {geradoEm} · {rows.length} registro{rows.length !== 1 ? 's' : ''}</Text>

        <View style={s.thead}>
          <Text style={[s.th, s.cData  ]}>Data</Text>
          <Text style={[s.th, s.cNome  ]}>Funcionário</Text>
          <Text style={[s.th, s.cReg   ]}>Matrícula</Text>
          <Text style={[s.th, s.cPosto ]}>Posto</Text>
          <Text style={[s.th, s.cSec   ]}>Secretaria</Text>
          <Text style={[s.th, s.cSup   ]}>Supervisor</Text>
          <Text style={[s.th, s.cGrau  ]}>Grau</Text>
          <Text style={[s.th, s.cDesc  ]}>Descrição</Text>
          <Text style={[s.th, s.cDias  ]}>D. Susp.</Text>
          <Text style={[s.th, s.cStatus]}>Status</Text>
        </View>

        {rows.map((r, i) => {
          const rowStyle = r.grau === 'suspensao' ? s.rowSusp : i % 2 === 0 ? s.row : s.rowAlt
          return (
            <View key={r.id} style={rowStyle}>
              <Text style={[s.tdNum,  s.cData  ]}>{fmt(r.data_ocorrencia)}</Text>
              <Text style={[s.tdBold, s.cNome  ]}>{r.funcionario_nome}</Text>
              <Text style={[s.td,     s.cReg   ]}>{r.registro ?? '—'}</Text>
              <Text style={[s.td,     s.cPosto ]}>{r.posto_nome}</Text>
              <Text style={[s.td,     s.cSec   ]}>{r.secretaria}</Text>
              <Text style={[s.td,     s.cSup   ]}>{r.supervisor}</Text>
              <Text style={[s.td,     s.cGrau  ]}>{GRAU_LABELS[r.grau] ?? r.grau}</Text>
              <Text style={[s.td,     s.cDesc  ]}>{r.descricao}</Text>
              <Text style={[s.tdNum,  s.cDias  ]}>{r.dias_suspensao ?? '—'}</Text>
              <Text style={[s.td,     s.cStatus]}>{r.status}</Text>
            </View>
          )
        })}
      </Page>
    </Document>
  )
}
