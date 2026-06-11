import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { MudancaFuncaoRow } from '@/app/(admin)/relatorios/mudancas-funcao/actions'

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
  cNome:    { width: 120 },
  cCpf:     { width: 70 },
  cSup:     { width: 80 },
  cFuncao:  { width: 90 },
  cPosto:   { width: 80 },
})

interface Props { dados: MudancaFuncaoRow[]; mes: number; ano: number; MESES: string[] }

export function MudancasFuncaoDoc({ dados, mes, ano, MESES }: Props) {
  const geradoEm = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={s.page}>
        <Text style={s.title}>Mudanças de Função — {MESES[mes]} {ano}</Text>
        <Text style={s.subtitle}>Gerado em {geradoEm} · {dados.length} registro{dados.length !== 1 ? 's' : ''}</Text>

        <View style={s.thead}>
          {[
            { label: 'Data',         style: s.cData   },
            { label: 'Funcionário',  style: s.cNome   },
            { label: 'Matrícula',    style: s.cCpf    },
            { label: 'Supervisor',   style: s.cSup    },
            { label: 'Fn. Anterior', style: s.cFuncao },
            { label: 'Fn. Nova',     style: s.cFuncao },
            { label: 'Posto',        style: s.cPosto  },
          ].map(c => <Text key={c.label} style={[s.th, c.style]}>{c.label}</Text>)}
        </View>

        {dados.map((r, i) => (
          <View key={r.id} style={i % 2 === 0 ? s.row : s.rowAlt}>
            <Text style={[s.td,     s.cData  ]}>{fmt(r.data_evento)}</Text>
            <Text style={[s.tdBold, s.cNome  ]}>{r.funcionario_nome}</Text>
            <Text style={[s.td,     s.cCpf   ]}>{maskCpf(r.cpf)}</Text>
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
