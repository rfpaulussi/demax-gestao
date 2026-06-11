import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { AusenciaRow } from '@/app/(admin)/relatorios/absenteismo/actions'

function fmt(iso: string): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

const TIPO_LABELS: Record<string, string> = {
  falta: 'Falta', atestado: 'Atestado', ferias: 'Férias',
}

const s = StyleSheet.create({
  page:        { padding: 28, fontSize: 7, fontFamily: 'Helvetica', backgroundColor: '#ffffff' },
  title:       { fontSize: 10, fontWeight: 'bold', marginBottom: 2 },
  subtitle:    { fontSize: 7, color: '#6b7280', marginBottom: 12 },
  groupHeader: { backgroundColor: '#1e293b', color: '#ffffff', fontSize: 7, fontWeight: 'bold',
                 paddingVertical: 3, paddingHorizontal: 6, marginTop: 8 },
  thead:       { flexDirection: 'row', backgroundColor: '#f8fafc', borderBottomWidth: 1,
                 borderBottomColor: '#e2e8f0' },
  th:          { fontSize: 6, fontWeight: 'bold', color: '#94a3b8', paddingVertical: 3,
                 paddingHorizontal: 4, textTransform: 'uppercase' },
  row:         { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  rowAlt:      { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
                 backgroundColor: '#fafafa' },
  totalsRow:   { flexDirection: 'row', backgroundColor: '#f1f5f9',
                 borderTopWidth: 2, borderTopColor: '#94a3b8', borderBottomWidth: 1,
                 borderBottomColor: '#e2e8f0', marginBottom: 6 },
  td:          { fontSize: 7, color: '#374151', paddingVertical: 3, paddingHorizontal: 4 },
  tdBold:      { fontSize: 7, fontWeight: 'bold', color: '#111827', paddingVertical: 3, paddingHorizontal: 4 },
  tdNum:       { fontSize: 7, color: '#374151', paddingVertical: 3, paddingHorizontal: 4, textAlign: 'center' },
  tdNumBold:   { fontSize: 7, fontWeight: 'bold', color: '#374151', paddingVertical: 3, paddingHorizontal: 4, textAlign: 'center' },
  cNome:       { width: 148 },
  cReg:        { width: 55 },
  cPosto:      { width: 90 },
  cSec:        { width: 65 },
  cData:       { width: 52 },
  cDias:       { width: 32 },
  cJust:       { width: 105 },
})

interface Props { rows: AusenciaRow[]; mes: number; ano: number; MESES: string[] }

export function AbsenteismoDoc({ rows, mes, ano, MESES }: Props) {
  const tipos = ['falta', 'atestado', 'ferias'] as const
  const geradoEm = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={s.page}>
        <Text style={s.title}>Absenteísmo — {MESES[mes]} {ano}</Text>
        <Text style={s.subtitle}>Gerado em {geradoEm} · {rows.length} registros</Text>

        {tipos.map(tipo => {
          const grupo = rows.filter(r => r.tipo_ausencia === tipo)
          if (grupo.length === 0) return null
          const totalDias = grupo.reduce((a, r) => a + r.dias, 0)
          return (
            <View key={tipo}>
              <Text style={s.groupHeader}>{TIPO_LABELS[tipo].toUpperCase()} ({grupo.length} · {totalDias} dias)</Text>
              <View style={s.thead}>
                <Text style={[s.th, s.cNome ]}>Funcionário</Text>
                <Text style={[s.th, s.cReg  ]}>Matrícula</Text>
                <Text style={[s.th, s.cPosto]}>Posto</Text>
                <Text style={[s.th, s.cSec  ]}>Secretaria</Text>
                <Text style={[s.th, s.cData ]}>Data</Text>
                <Text style={[s.th, s.cDias ]}>Dias</Text>
                <Text style={[s.th, s.cJust ]}>Justificativa</Text>
              </View>
              {grupo.map((r, i) => (
                <View key={r.id} style={i % 2 === 0 ? s.row : s.rowAlt}>
                  <Text style={[s.tdBold, s.cNome ]}>{r.funcionario_nome}</Text>
                  <Text style={[s.td,     s.cReg  ]}>{r.registro ?? '—'}</Text>
                  <Text style={[s.td,     s.cPosto]}>{r.posto_nome}</Text>
                  <Text style={[s.td,     s.cSec  ]}>{r.secretaria}</Text>
                  <Text style={[s.tdNum,  s.cData ]}>{fmt(r.data)}</Text>
                  <Text style={[s.tdNum,  s.cDias ]}>{r.dias}</Text>
                  <Text style={[s.td,     s.cJust ]}>{r.justificativa}</Text>
                </View>
              ))}
              <View style={s.totalsRow}>
                <Text style={[s.tdBold, { width: 203 }]}>TOTAL</Text>
                <Text style={[s.td,     s.cPosto]} />
                <Text style={[s.td,     s.cSec  ]} />
                <Text style={[s.tdNum,  s.cData ]} />
                <Text style={[s.tdNumBold, s.cDias]}>{totalDias}</Text>
                <Text style={[s.td,     s.cJust ]} />
              </View>
            </View>
          )
        })}
      </Page>
    </Document>
  )
}
