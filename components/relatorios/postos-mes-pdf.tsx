import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { EfetivoMesRow } from '@/app/(admin)/relatorios/postos-mes/actions'

const STATUS_LABELS: Record<string, string> = {
  ativo: 'Ativo', afastado: 'Afastado', ferias: 'Férias', desligado: 'Desligado',
}

const s = StyleSheet.create({
  page:        { padding: 28, fontSize: 8, fontFamily: 'Helvetica', backgroundColor: '#ffffff' },
  title:       { fontSize: 11, fontWeight: 'bold', marginBottom: 2 },
  subtitle:    { fontSize: 8, color: '#6b7280', marginBottom: 14 },
  groupHeader: { backgroundColor: '#1e293b', color: '#ffffff', fontSize: 7, fontWeight: 'bold',
                 paddingVertical: 3, paddingHorizontal: 6, marginTop: 8 },
  subHeader:   { backgroundColor: '#475569', color: '#ffffff', fontSize: 7, fontWeight: 'bold',
                 paddingVertical: 2, paddingHorizontal: 6 },
  thead:       { flexDirection: 'row', backgroundColor: '#f8fafc', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  th:          { fontSize: 7, fontWeight: 'bold', color: '#94a3b8', paddingVertical: 3, paddingHorizontal: 3, textTransform: 'uppercase' },
  row:         { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  rowAlt:      { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f1f5f9', backgroundColor: '#fafafa' },
  td:          { fontSize: 8, color: '#374151', paddingVertical: 3, paddingHorizontal: 3 },
  tdBold:      { fontSize: 8, fontWeight: 'bold', color: '#374151', paddingVertical: 3, paddingHorizontal: 3 },
  cNome:       { width: 140 },
  cFuncao:     { width: 100 },
  cStatus:     { width: 55 },
})

interface Props { dados: EfetivoMesRow[]; mes: number; ano: number; MESES: string[] }

export function PostosMesDoc({ dados, mes, ano, MESES }: Props) {
  const supervisores = Array.from(new Set(dados.map(r => r.supervisor))).sort()
  const geradoEm = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={s.page}>
        <Text style={s.title}>Efetivo por Posto / Mês — {MESES[mes]} {ano}</Text>
        <Text style={s.subtitle}>Gerado em {geradoEm} · {dados.length} funcionários</Text>

        {supervisores.map(sup => {
          const grupoSup = dados.filter(r => r.supervisor === sup)
          const secretarias = Array.from(new Set(grupoSup.map(r => r.secretaria))).sort()
          return (
            <View key={sup}>
              <Text style={s.groupHeader}>{sup.toUpperCase()} ({grupoSup.length})</Text>
              {secretarias.map(sec => {
                const grupoSec = grupoSup.filter(r => r.secretaria === sec)
                const postos = Array.from(new Set(grupoSec.map(r => r.posto_id)))
                return (
                  <View key={sec}>
                    <Text style={s.subHeader}>{sec} ({grupoSec.length})</Text>
                    {postos.map(pid => {
                      const grupoP = grupoSec.filter(r => r.posto_id === pid)
                      const postoNome = grupoP[0]?.posto_nome ?? '—'
                      return (
                        <View key={pid}>
                          <View style={s.thead}>
                            <Text style={[s.th, s.cNome]}>{postoNome}</Text>
                            <Text style={[s.th, s.cFuncao]}>Função</Text>
                            <Text style={[s.th, s.cStatus]}>Status</Text>
                          </View>
                          {grupoP.map((r, i) => (
                            <View key={r.funcionario_id} style={i % 2 === 0 ? s.row : s.rowAlt}>
                              <Text style={[s.tdBold, s.cNome  ]}>{r.nome}</Text>
                              <Text style={[s.td,     s.cFuncao]}>{r.funcao}</Text>
                              <Text style={[s.td,     s.cStatus]}>{STATUS_LABELS[r.status] ?? r.status}</Text>
                            </View>
                          ))}
                        </View>
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
