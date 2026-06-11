import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { CoberturaInsalubreRow } from '@/app/(admin)/relatorios/coberturas-insalubres/actions'

function fmt(iso: string): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

const s = StyleSheet.create({
  page:        { padding: 28, fontSize: 8, fontFamily: 'Helvetica', backgroundColor: '#ffffff' },
  title:       { fontSize: 11, fontWeight: 'bold', marginBottom: 2 },
  subtitle:    { fontSize: 8, color: '#6b7280', marginBottom: 14 },
  groupHeader: { backgroundColor: '#1e293b', color: '#ffffff', fontSize: 7, fontWeight: 'bold',
                 paddingVertical: 3, paddingHorizontal: 6, marginTop: 8 },
  totalsRow:   { flexDirection: 'row', backgroundColor: '#f1f5f9', borderBottomWidth: 1,
                 borderBottomColor: '#e2e8f0' },
  thead:       { flexDirection: 'row', backgroundColor: '#f8fafc', borderBottomWidth: 1,
                 borderBottomColor: '#e2e8f0' },
  th:          { fontSize: 7, fontWeight: 'bold', color: '#94a3b8', paddingVertical: 3,
                 paddingHorizontal: 3, textTransform: 'uppercase' },
  row:         { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  rowAlt:      { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
                 backgroundColor: '#fafafa' },
  td:          { fontSize: 8, color: '#374151', paddingVertical: 3, paddingHorizontal: 3 },
  tdNum:       { fontSize: 8, color: '#374151', paddingVertical: 3, paddingHorizontal: 3, textAlign: 'center' },
  tdBold:      { fontSize: 8, fontWeight: 'bold', color: '#374151', paddingVertical: 3, paddingHorizontal: 3 },
  cPosto:      { width: 90 },
  cSec:        { width: 70 },
  cColab:      { width: 100 },
  cFuncao:     { width: 80 },
  cAusente:    { width: 90 },
  cData:       { width: 55 },
  cDias:       { width: 30 },
  cMotivo:     { width: 80 },
})

const COLS = [
  { label: 'Posto',        style: s.cPosto,   num: false },
  { label: 'Secretaria',   style: s.cSec,     num: false },
  { label: 'Colaborador',  style: s.cColab,   num: false },
  { label: 'Função',       style: s.cFuncao,  num: false },
  { label: 'Ag. Ausente',  style: s.cAusente, num: false },
  { label: 'Data Início',  style: s.cData,    num: true  },
  { label: 'Dias',         style: s.cDias,    num: true  },
  { label: 'Motivo',       style: s.cMotivo,  num: false },
]

interface Props {
  dados: CoberturaInsalubreRow[]
  mes: number
  ano: number
  MESES: string[]
}

export function CoberturasInsalubresDoc({ dados, mes, ano, MESES }: Props) {
  const supervisores = Array.from(new Set(dados.map(r => r.supervisor))).sort()
  const geradoEm = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={s.page}>
        <Text style={s.title}>Coberturas Insalubres — {MESES[mes]} {ano}</Text>
        <Text style={s.subtitle}>Gerado em {geradoEm} · {dados.length} registros</Text>

        {supervisores.map(sup => {
          const grupo = dados.filter(r => r.supervisor === sup)
          const totalDias = grupo.reduce((a, r) => a + r.dias, 0)
          return (
            <View key={sup}>
              <Text style={s.groupHeader}>{sup.toUpperCase()} ({grupo.length} coberturas · {totalDias} dias)</Text>
              <View style={s.thead}>
                {COLS.map(c => <Text key={c.label} style={[s.th, c.style]}>{c.label}</Text>)}
              </View>
              {grupo.map((r, i) => (
                <View key={r.id} style={i % 2 === 0 ? s.row : s.rowAlt}>
                  <Text style={[s.td,    s.cPosto  ]}>{r.posto_nome}</Text>
                  <Text style={[s.td,    s.cSec    ]}>{r.secretaria}</Text>
                  <Text style={[s.tdBold,s.cColab  ]}>{r.colaborador_nome}</Text>
                  <Text style={[s.td,    s.cFuncao ]}>{r.colaborador_funcao}</Text>
                  <Text style={[s.td,    s.cAusente]}>{r.agente_ausente}</Text>
                  <Text style={[s.tdNum, s.cData   ]}>{fmt(r.data_inicio)}</Text>
                  <Text style={[s.tdNum, s.cDias   ]}>{r.dias}</Text>
                  <Text style={[s.td,    s.cMotivo ]}>{r.motivo}</Text>
                </View>
              ))}
              <View style={s.totalsRow}>
                <Text style={[s.tdBold, { width: 160 }]}>TOTAL</Text>
                <Text style={[s.td,     s.cColab  ]} />
                <Text style={[s.td,     s.cFuncao ]} />
                <Text style={[s.td,     s.cAusente]} />
                <Text style={[s.tdNum,  s.cData   ]} />
                <Text style={[s.tdBold, s.cDias   ]}>{totalDias}</Text>
                <Text style={[s.td,     s.cMotivo ]} />
              </View>
            </View>
          )
        })}
      </Page>
    </Document>
  )
}
