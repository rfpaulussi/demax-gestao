import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { AusenciaRow } from '@/app/(admin)/relatorios/absenteismo/actions'

function fmt(iso: string): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function maskCpf(cpf: string | null): string {
  if (!cpf) return '—'
  const d = cpf.replace(/\D/g, '')
  if (d.length !== 11) return cpf
  return `***.***.${ d.slice(6, 9) }-${ d.slice(9) }`
}

const TIPO_LABELS: Record<string, string> = {
  falta: 'Falta', atestado: 'Atestado', ferias: 'Férias',
}

const s = StyleSheet.create({
  page:        { padding: 28, fontSize: 8, fontFamily: 'Helvetica', backgroundColor: '#ffffff' },
  title:       { fontSize: 11, fontWeight: 'bold', marginBottom: 2 },
  subtitle:    { fontSize: 8, color: '#6b7280', marginBottom: 14 },
  groupHeader: { backgroundColor: '#1e293b', color: '#ffffff', fontSize: 7, fontWeight: 'bold',
                 paddingVertical: 3, paddingHorizontal: 6, marginTop: 8 },
  thead:       { flexDirection: 'row', backgroundColor: '#f8fafc', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  th:          { fontSize: 7, fontWeight: 'bold', color: '#94a3b8', paddingVertical: 3, paddingHorizontal: 3, textTransform: 'uppercase' },
  row:         { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  rowAlt:      { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f1f5f9', backgroundColor: '#fafafa' },
  td:          { fontSize: 8, color: '#374151', paddingVertical: 3, paddingHorizontal: 3 },
  tdBold:      { fontSize: 8, fontWeight: 'bold', color: '#374151', paddingVertical: 3, paddingHorizontal: 3 },
  totalsRow:   { flexDirection: 'row', backgroundColor: '#f1f5f9', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  cNome:       { width: 110 },
  cCpf:        { width: 68 },
  cPosto:      { width: 80 },
  cSec:        { width: 60 },
  cData:       { width: 50 },
  cDias:       { width: 28 },
  cJust:       { width: 90 },
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
                {[
                  { l: 'Funcionário', st: s.cNome },
                  { l: 'Matrícula',   st: s.cCpf  },
                  { l: 'Posto',       st: s.cPosto },
                  { l: 'Secretaria',  st: s.cSec  },
                  { l: 'Data',        st: s.cData  },
                  { l: 'Dias',        st: s.cDias  },
                  { l: 'Justificativa', st: s.cJust },
                ].map(c => <Text key={c.l} style={[s.th, c.st]}>{c.l}</Text>)}
              </View>
              {grupo.map((r, i) => (
                <View key={r.id} style={i % 2 === 0 ? s.row : s.rowAlt}>
                  <Text style={[s.tdBold, s.cNome ]}>{r.funcionario_nome}</Text>
                  <Text style={[s.td,     s.cCpf  ]}>{maskCpf(r.cpf)}</Text>
                  <Text style={[s.td,     s.cPosto]}>{r.posto_nome}</Text>
                  <Text style={[s.td,     s.cSec  ]}>{r.secretaria}</Text>
                  <Text style={[s.td,     s.cData ]}>{fmt(r.data)}</Text>
                  <Text style={[s.td,     s.cDias ]}>{r.dias}</Text>
                  <Text style={[s.td,     s.cJust ]}>{r.justificativa}</Text>
                </View>
              ))}
              <View style={s.totalsRow}>
                <Text style={[s.tdBold, { width: 178 }]}>TOTAL</Text>
                <Text style={[s.td,     s.cPosto]} />
                <Text style={[s.td,     s.cSec  ]} />
                <Text style={[s.td,     s.cData ]} />
                <Text style={[s.tdBold, s.cDias ]}>{totalDias}</Text>
                <Text style={[s.td,     s.cJust ]} />
              </View>
            </View>
          )
        })}
      </Page>
    </Document>
  )
}
