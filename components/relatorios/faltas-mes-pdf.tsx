import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { FaltaMesRow } from '@/app/(admin)/relatorios/faltas-mes/actions'

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
  sem_justificativa: 'Sem Justif.', declaracao: 'Declaração',
  sem_atestado: 'Sem Atestado', com_atestado: 'Com Atestado', suspensao: 'Suspensão',
}

const s = StyleSheet.create({
  page:     { padding: 28, fontSize: 8, fontFamily: 'Helvetica', backgroundColor: '#ffffff' },
  title:    { fontSize: 11, fontWeight: 'bold', marginBottom: 2 },
  subtitle: { fontSize: 8, color: '#6b7280', marginBottom: 14 },
  thead:    { flexDirection: 'row', backgroundColor: '#f8fafc', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  th:       { fontSize: 7, fontWeight: 'bold', color: '#94a3b8', paddingVertical: 3, paddingHorizontal: 3, textTransform: 'uppercase' },
  row:      { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  rowAlt:   { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f1f5f9', backgroundColor: '#fafafa' },
  td:       { fontSize: 8, color: '#374151', paddingVertical: 3, paddingHorizontal: 3 },
  tdBold:   { fontSize: 8, fontWeight: 'bold', color: '#374151', paddingVertical: 3, paddingHorizontal: 3 },
  cData:    { width: 52 },
  cNome:    { width: 115 },
  cCpf:     { width: 68 },
  cPosto:   { width: 85 },
  cSec:     { width: 60 },
  cSup:     { width: 75 },
  cTipo:    { width: 60 },
  cDias:    { width: 28 },
  cDoc:     { width: 35 },
  cJust:    { width: 75 },
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
          {[
            { l: 'Data',        st: s.cData },
            { l: 'Funcionário', st: s.cNome },
            { l: 'Matrícula',   st: s.cCpf  },
            { l: 'Posto',       st: s.cPosto},
            { l: 'Secretaria',  st: s.cSec  },
            { l: 'Supervisor',  st: s.cSup  },
            { l: 'Tipo',        st: s.cTipo },
            { l: 'Dias',        st: s.cDias },
            { l: 'Doc.',        st: s.cDoc  },
            { l: 'Justificativa', st: s.cJust },
          ].map(c => <Text key={c.l} style={[s.th, c.st]}>{c.l}</Text>)}
        </View>

        {rows.map((r, i) => (
          <View key={r.id} style={i % 2 === 0 ? s.row : s.rowAlt}>
            <Text style={[s.td,     s.cData ]}>{fmt(r.data_falta)}</Text>
            <Text style={[s.tdBold, s.cNome ]}>{r.funcionario_nome}</Text>
            <Text style={[s.td,     s.cCpf  ]}>{maskCpf(r.cpf)}</Text>
            <Text style={[s.td,     s.cPosto]}>{r.posto_nome}</Text>
            <Text style={[s.td,     s.cSec  ]}>{r.secretaria}</Text>
            <Text style={[s.td,     s.cSup  ]}>{r.supervisor}</Text>
            <Text style={[s.td,     s.cTipo ]}>{TIPO_LABELS[r.tipo] ?? r.tipo}</Text>
            <Text style={[s.td,     s.cDias ]}>{r.dias}</Text>
            <Text style={[s.td,     s.cDoc  ]}>{r.tem_documento ? 'Sim' : 'Não'}</Text>
            <Text style={[s.td,     s.cJust ]}>{r.justificativa}</Text>
          </View>
        ))}
      </Page>
    </Document>
  )
}
