import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { AdvertenciaMesRow } from '@/app/(admin)/relatorios/advertencias-mes/actions'

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

const GRAU_LABELS: Record<string, string> = {
  verbal: 'Verbal', escrita: 'Escrita', suspensao: 'Suspensão',
}

const s = StyleSheet.create({
  page:     { padding: 28, fontSize: 8, fontFamily: 'Helvetica', backgroundColor: '#ffffff' },
  title:    { fontSize: 11, fontWeight: 'bold', marginBottom: 2 },
  subtitle: { fontSize: 8, color: '#6b7280', marginBottom: 14 },
  thead:    { flexDirection: 'row', backgroundColor: '#f8fafc', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  th:       { fontSize: 7, fontWeight: 'bold', color: '#94a3b8', paddingVertical: 3, paddingHorizontal: 3, textTransform: 'uppercase' },
  row:      { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  rowAlt:   { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f1f5f9', backgroundColor: '#fafafa' },
  rowSusp:  { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f1f5f9', backgroundColor: '#fff1f2' },
  td:       { fontSize: 8, color: '#374151', paddingVertical: 3, paddingHorizontal: 3 },
  tdBold:   { fontSize: 8, fontWeight: 'bold', color: '#374151', paddingVertical: 3, paddingHorizontal: 3 },
  cData:    { width: 50 },
  cNome:    { width: 110 },
  cCpf:     { width: 65 },
  cPosto:   { width: 80 },
  cSec:     { width: 58 },
  cSup:     { width: 70 },
  cGrau:    { width: 52 },
  cDesc:    { width: 90 },
  cDias:    { width: 30 },
  cStatus:  { width: 48 },
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
          {[
            { l: 'Data',        st: s.cData   },
            { l: 'Funcionário', st: s.cNome   },
            { l: 'Matrícula',   st: s.cCpf    },
            { l: 'Posto',       st: s.cPosto  },
            { l: 'Secretaria',  st: s.cSec    },
            { l: 'Supervisor',  st: s.cSup    },
            { l: 'Grau',        st: s.cGrau   },
            { l: 'Descrição',   st: s.cDesc   },
            { l: 'Dias Susp.',  st: s.cDias   },
            { l: 'Status',      st: s.cStatus },
          ].map(c => <Text key={c.l} style={[s.th, c.st]}>{c.l}</Text>)}
        </View>

        {rows.map((r, i) => {
          const rowStyle = r.grau === 'suspensao' ? s.rowSusp : i % 2 === 0 ? s.row : s.rowAlt
          return (
            <View key={r.id} style={rowStyle}>
              <Text style={[s.td,     s.cData  ]}>{fmt(r.data_ocorrencia)}</Text>
              <Text style={[s.tdBold, s.cNome  ]}>{r.funcionario_nome}</Text>
              <Text style={[s.td,     s.cCpf   ]}>{maskCpf(r.cpf)}</Text>
              <Text style={[s.td,     s.cPosto ]}>{r.posto_nome}</Text>
              <Text style={[s.td,     s.cSec   ]}>{r.secretaria}</Text>
              <Text style={[s.td,     s.cSup   ]}>{r.supervisor}</Text>
              <Text style={[s.td,     s.cGrau  ]}>{GRAU_LABELS[r.grau] ?? r.grau}</Text>
              <Text style={[s.td,     s.cDesc  ]}>{r.descricao}</Text>
              <Text style={[s.td,     s.cDias  ]}>{r.dias_suspensao ?? '—'}</Text>
              <Text style={[s.td,     s.cStatus]}>{r.status}</Text>
            </View>
          )
        })}
      </Page>
    </Document>
  )
}
