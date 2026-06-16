import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { FechamentoFuncionario } from '@/app/(admin)/fechamento/actions'

const s = StyleSheet.create({
  page:        { padding: 32, fontSize: 8, fontFamily: 'Helvetica', backgroundColor: '#ffffff' },
  title:       { fontSize: 11, fontWeight: 'bold', marginBottom: 2 },
  subtitle:    { fontSize: 8, color: '#6b7280', marginBottom: 16 },
  groupHeader: { backgroundColor: '#1e293b', color: '#ffffff', fontSize: 7, fontWeight: 'bold',
                 paddingVertical: 3, paddingHorizontal: 6, marginTop: 10, marginBottom: 0 },
  thead:       { flexDirection: 'row', backgroundColor: '#f8fafc', borderBottomWidth: 1,
                 borderBottomColor: '#e2e8f0' },
  th:          { fontSize: 7, fontWeight: 'bold', color: '#94a3b8', paddingVertical: 3,
                 paddingHorizontal: 3, textTransform: 'uppercase' },
  row:         { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  rowAlt:      { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
                 backgroundColor: '#fafafa' },
  rowSusp:     { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
                 backgroundColor: '#fff1f2' },
  td:          { fontSize: 8, color: '#374151', paddingVertical: 3, paddingHorizontal: 3 },
  tdNum:       { fontSize: 8, color: '#374151', paddingVertical: 3, paddingHorizontal: 3,
                 textAlign: 'center' },
  tdBold:      { fontSize: 8, fontWeight: 'bold', color: '#1d4ed8', paddingVertical: 3,
                 paddingHorizontal: 3, textAlign: 'center' },
  // column widths
  cNome:   { width: 120 },
  cFuncao: { width: 75 },
  cPosto:  { width: 80 },
  cSec:    { width: 75 },
  cReg:    { width: 30 },
  cN5:     { width: 30 },  // small numeric cols
  cAfast:  { width: 30 },
  cTrab:   { width: 44 },  // Trabalhados (highlighted)
  cAdv:    { width: 52 },  // Advertência (text badge)
})

function advLabel(f: FechamentoFuncionario) {
  if (f.tem_suspensao) return 'Suspensão'
  if (f.tem_advertencia) return 'Sim'
  return '—'
}

const COLS = [
  { label: 'Nome',          style: s.cNome,   num: false },
  { label: 'Função',        style: s.cFuncao, num: false },
  { label: 'Posto',         style: s.cPosto,  num: false },
  { label: 'Secretaria',    style: s.cSec,    num: false },
  { label: 'Regime',        style: s.cReg,    num: true  },
  { label: 'D.Úteis',       style: s.cN5,     num: true  },
  { label: 'Férias',        style: s.cN5,     num: true  },
  { label: 'Faltas',        style: s.cN5,     num: true  },
  { label: 'Atestados',     style: s.cN5,     num: true  },
  { label: 'Suspensão',     style: s.cN5,     num: true  },
  { label: 'Afast.',        style: s.cAfast,  num: true  },
  { label: 'Trabalhados',   style: s.cTrab,   num: true  },
  { label: 'Insalubridade', style: s.cN5,     num: true  },
  { label: 'Advertência',   style: s.cAdv,    num: false },
]

function cellValue(f: FechamentoFuncionario, idx: number): string {
  const vals = [
    f.funcionario_nome,
    f.funcao ?? '—',
    f.posto_nome ?? '—',
    f.secretaria ?? '—',
    f.regime,
    String(f.dias_uteis),
    f.ferias_dias > 0 ? String(f.ferias_dias) : '—',
    f.faltas_dias > 0 ? String(f.faltas_dias) : '—',
    f.atestados_dias > 0 ? String(f.atestados_dias) : '—',
    f.dias_suspensao > 0 ? String(f.dias_suspensao) : '—',
    f.afastamento_dias > 0 ? String(f.afastamento_dias) : '—',
    String(f.dias_trabalhados),
    f.insalubridade_dias > 0 ? String(f.insalubridade_dias) : '—',
    advLabel(f),
  ]
  return vals[idx]
}

interface Props {
  dados: FechamentoFuncionario[]
  mes: number
  ano: number
  MESES: string[]
}

export function FechamentoPDFDoc({ dados, mes, ano, MESES }: Props) {
  const secretarias = Array.from(new Set(dados.map(f => f.secretaria ?? 'Sem Secretaria'))).sort()
  const geradoEm = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={s.page}>
        <Text style={s.title}>Fechamento — {MESES[mes]} {ano}</Text>
        <Text style={s.subtitle}>Gerado em {geradoEm} · {dados.length} funcionários</Text>

        {secretarias.map(sec => {
          const grupo = dados.filter(f => (f.secretaria ?? 'Sem Secretaria') === sec)
          return (
            <View key={sec}>
              <Text style={s.groupHeader}>{sec.toUpperCase()} ({grupo.length})</Text>

              {/* thead */}
              <View style={s.thead}>
                {COLS.map(c => (
                  <Text key={c.label} style={[s.th, c.style]}>{c.label}</Text>
                ))}
              </View>

              {/* rows */}
              {grupo.map((f, i) => {
                const rowStyle = f.tem_suspensao ? s.rowSusp : i % 2 === 0 ? s.row : s.rowAlt
                return (
                  <View key={f.funcionario_id} style={rowStyle}>
                    {COLS.map((c, ci) => {
                      const isTrab = c.label === 'Trabalhados'
                      return (
                        <Text
                          key={c.label}
                          style={[isTrab ? s.tdBold : c.num ? s.tdNum : s.td, c.style]}
                        >
                          {cellValue(f, ci)}
                        </Text>
                      )
                    })}
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
