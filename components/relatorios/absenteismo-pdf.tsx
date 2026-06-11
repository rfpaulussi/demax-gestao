import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { AusenciaRow, FeriasRow } from '@/app/(admin)/relatorios/absenteismo/actions'

function fmt(iso: string): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

const TIPO_LABELS: Record<string, string> = { falta: 'Falta', atestado: 'Atestado', suspensao: 'Suspensão' }

const s = StyleSheet.create({
  page:          { padding: 28, fontSize: 7, fontFamily: 'Helvetica', backgroundColor: '#ffffff' },
  title:         { fontSize: 10, fontWeight: 'bold', marginBottom: 2 },
  subtitle:      { fontSize: 7, color: '#6b7280', marginBottom: 10 },
  sectionHeader: { fontSize: 8, fontWeight: 'bold', color: '#ffffff', backgroundColor: '#1e293b',
                   paddingVertical: 4, paddingHorizontal: 6, marginTop: 10, marginBottom: 0 },
  sectionHeader2:{ fontSize: 8, fontWeight: 'bold', color: '#ffffff', backgroundColor: '#1d4ed8',
                   paddingVertical: 4, paddingHorizontal: 6, marginTop: 14, marginBottom: 0 },
  groupHeader:   { backgroundColor: '#334155', color: '#ffffff', fontSize: 7, fontWeight: 'bold',
                   paddingVertical: 3, paddingHorizontal: 6 },
  thead:         { flexDirection: 'row', backgroundColor: '#f8fafc', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  th:            { fontSize: 6, fontWeight: 'bold', color: '#94a3b8', paddingVertical: 3, paddingHorizontal: 4, textTransform: 'uppercase' },
  row:           { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  rowAlt:        { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f1f5f9', backgroundColor: '#fafafa' },
  totalsRow:     { flexDirection: 'row', backgroundColor: '#f1f5f9', borderTopWidth: 2, borderTopColor: '#94a3b8',
                   borderBottomWidth: 1, borderBottomColor: '#e2e8f0', marginBottom: 4 },
  td:            { fontSize: 7, color: '#374151', paddingVertical: 3, paddingHorizontal: 4 },
  tdBold:        { fontSize: 7, fontWeight: 'bold', color: '#111827', paddingVertical: 3, paddingHorizontal: 4 },
  tdNum:         { fontSize: 7, color: '#374151', paddingVertical: 3, paddingHorizontal: 4, textAlign: 'center' },
  tdNumBold:     { fontSize: 7, fontWeight: 'bold', color: '#374151', paddingVertical: 3, paddingHorizontal: 4, textAlign: 'center' },
  // Absenteísmo columns
  cNome:  { width: 148 },
  cReg:   { width: 52 },
  cPosto: { width: 90 },
  cSec:   { width: 65 },
  cTipo:  { width: 58 },
  cData:  { width: 50 },
  cDias:  { width: 30 },
  cJust:  { width: 105 },
  // Férias columns
  fNome:  { width: 165 },
  fReg:   { width: 52 },
  fPosto: { width: 100 },
  fSec:   { width: 72 },
  fDataI: { width: 58 },
  fDataF: { width: 58 },
  fDias:  { width: 40 },
})

interface Props {
  absRows: AusenciaRow[]
  feriasRows: FeriasRow[]
  mes: number
  ano: number
  MESES: string[]
}

export function AbsenteismoDoc({ absRows, feriasRows, mes, ano, MESES }: Props) {
  const TIPOS = ['falta', 'atestado', 'suspensao'] as const
  const geradoEm = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  const totalDiasFerias = feriasRows.reduce((s, r) => s + r.dias_no_mes, 0)

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={s.page}>
        <Text style={s.title}>Absenteísmo — {MESES[mes]} {ano}</Text>
        <Text style={s.subtitle}>Gerado em {geradoEm}</Text>

        {/* Seção 1: Absenteísmo */}
        <Text style={s.sectionHeader}>
          ABSENTEÍSMO (NÃO PROGRAMADO) — {absRows.length} OCORRÊNCIA{absRows.length !== 1 ? 'S' : ''} · {absRows.reduce((s, r) => s + r.dias, 0)} DIAS
        </Text>

        {absRows.length === 0 ? (
          <Text style={[s.td, { marginTop: 6, color: '#94a3b8' }]}>Nenhuma ocorrência no período.</Text>
        ) : (
          TIPOS.map(tipo => {
            const grupo = absRows.filter(r => r.tipo_ausencia === tipo)
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
                  <Text style={[s.th, s.cTipo ]}>Tipo</Text>
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
                    <Text style={[s.td,     s.cTipo ]}>{TIPO_LABELS[r.tipo_ausencia]}</Text>
                    <Text style={[s.tdNum,  s.cData ]}>{fmt(r.data)}</Text>
                    <Text style={[s.tdNum,  s.cDias ]}>{r.dias}</Text>
                    <Text style={[s.td,     s.cJust ]}>{r.justificativa}</Text>
                  </View>
                ))}
                <View style={s.totalsRow}>
                  <Text style={[s.tdBold, { width: 200 }]}>TOTAL</Text>
                  <Text style={[s.td,     s.cPosto]} />
                  <Text style={[s.td,     s.cSec  ]} />
                  <Text style={[s.td,     s.cTipo ]} />
                  <Text style={[s.tdNum,  s.cData ]} />
                  <Text style={[s.tdNumBold, s.cDias]}>{totalDias}</Text>
                  <Text style={[s.td,     s.cJust ]} />
                </View>
              </View>
            )
          })
        )}

        {/* Seção 2: Férias */}
        <Text style={s.sectionHeader2}>
          AUSÊNCIAS PROGRAMADAS — FÉRIAS — {feriasRows.length} FUNCIONÁRIO{feriasRows.length !== 1 ? 'S' : ''} · {totalDiasFerias} DIAS NO MÊS
        </Text>

        {feriasRows.length === 0 ? (
          <Text style={[s.td, { marginTop: 6, color: '#94a3b8' }]}>Nenhum funcionário em férias no período.</Text>
        ) : (
          <View>
            <View style={s.thead}>
              <Text style={[s.th, s.fNome ]}>Funcionário</Text>
              <Text style={[s.th, s.fReg  ]}>Matrícula</Text>
              <Text style={[s.th, s.fPosto]}>Posto</Text>
              <Text style={[s.th, s.fSec  ]}>Secretaria</Text>
              <Text style={[s.th, s.fDataI]}>Dt. Início</Text>
              <Text style={[s.th, s.fDataF]}>Dt. Fim</Text>
              <Text style={[s.th, s.fDias ]}>Dias no Mês</Text>
            </View>
            {feriasRows.map((r, i) => (
              <View key={r.id} style={i % 2 === 0 ? s.row : s.rowAlt}>
                <Text style={[s.tdBold, s.fNome ]}>{r.funcionario_nome}</Text>
                <Text style={[s.td,     s.fReg  ]}>{r.registro ?? '—'}</Text>
                <Text style={[s.td,     s.fPosto]}>{r.posto_nome}</Text>
                <Text style={[s.td,     s.fSec  ]}>{r.secretaria}</Text>
                <Text style={[s.tdNum,  s.fDataI]}>{fmt(r.data_inicio)}</Text>
                <Text style={[s.tdNum,  s.fDataF]}>{fmt(r.data_fim)}</Text>
                <Text style={[s.tdNum,  s.fDias ]}>{r.dias_no_mes}</Text>
              </View>
            ))}
            <View style={s.totalsRow}>
              <Text style={[s.tdBold, { width: 217 }]}>TOTAL</Text>
              <Text style={[s.td,     s.fPosto]} />
              <Text style={[s.td,     s.fSec  ]} />
              <Text style={[s.tdNum,  s.fDataI]} />
              <Text style={[s.tdNum,  s.fDataF]} />
              <Text style={[s.tdNumBold, s.fDias]}>{totalDiasFerias}</Text>
            </View>
          </View>
        )}
      </Page>
    </Document>
  )
}
