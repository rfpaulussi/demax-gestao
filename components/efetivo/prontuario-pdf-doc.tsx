import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { ProntuarioFuncionario, ProntuarioEvento } from '@/app/(admin)/efetivo/[id]/historico/page'

const TIPO_LABEL: Record<string, string> = {
  admissao:            'Admissão',
  desligamento:        'Desligamento',
  mudanca_posto:       'Mudança de Posto',
  mudanca_funcao:      'Mudança de Função',
  ferias:              'Férias',
  atestado:            'Atestado',
  falta:               'Falta',
  advertencia:         'Advertência',
  suspensao:           'Suspensão',
  cobertura_insalubre: 'Cobertura Insalubre',
  transferencia:       'Transferência',
  reativacao:          'Reativação',
}

const TIPO_COLOR: Record<string, string> = {
  admissao:            '#16a34a',
  desligamento:        '#dc2626',
  mudanca_posto:       '#2563eb',
  mudanca_funcao:      '#9333ea',
  ferias:              '#f97316',
  atestado:            '#d97706',
  falta:               '#f43f5e',
  advertencia:         '#dc2626',
  suspensao:           '#7f1d1d',
  cobertura_insalubre: '#4f46e5',
  transferencia:       '#0891b2',
  reativacao:          '#22c55e',
}

const STATUS_LABEL: Record<string, string> = {
  ativo:     'Ativo',
  afastado:  'Afastado',
  ferias:    'Férias',
  desligado: 'Desligado',
}

function fmt(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = iso.split('T')[0]
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

function dadosText(dados: Record<string, unknown> | null): string {
  if (!dados) return ''
  return Object.entries(dados)
    .filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => `${k}: ${v}`)
    .join('  ·  ')
}

const s = StyleSheet.create({
  page:       { fontFamily: 'Helvetica', fontSize: 9, padding: 40, color: '#111827', backgroundColor: '#fff' },
  // cover
  coverTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
  coverSub:   { fontSize: 9, color: '#6b7280', marginBottom: 20 },
  coverGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginBottom: 24, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  coverCell:  { width: '45%' },
  coverLabel: { fontSize: 7, fontWeight: 'bold', color: '#9ca3af', textTransform: 'uppercase', marginBottom: 2 },
  coverValue: { fontSize: 10, color: '#111827' },
  // section
  sectionTitle: { fontSize: 10, fontWeight: 'bold', color: '#1e293b', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 },
  // event rows
  eventRow:   { flexDirection: 'row', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f3f4f6', gap: 10 },
  eventDate:  { width: 68, fontSize: 8, color: '#6b7280', paddingTop: 1 },
  eventBadge: { width: 110, fontSize: 7, fontWeight: 'bold', textTransform: 'uppercase', paddingTop: 1 },
  eventBody:  { flex: 1 },
  eventDesc:  { fontSize: 8, color: '#374151', marginBottom: 2 },
  eventData:  { fontSize: 7, color: '#9ca3af' },
})

interface Props {
  funcionario: ProntuarioFuncionario
  eventos: ProntuarioEvento[]
}

export function ProntuarioPDFDoc({ funcionario, eventos }: Props) {
  const geradoEm = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  const eventosAsc = [...eventos].sort((a, b) => a.data.localeCompare(b.data))

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Cover header */}
        <Text style={s.coverTitle}>{funcionario.nome}</Text>
        <Text style={s.coverSub}>Prontuário · Gerado em {geradoEm}</Text>

        <View style={s.coverGrid}>
          <View style={s.coverCell}>
            <Text style={s.coverLabel}>Função</Text>
            <Text style={s.coverValue}>{funcionario.funcao ?? '—'}</Text>
          </View>
          <View style={s.coverCell}>
            <Text style={s.coverLabel}>Posto</Text>
            <Text style={s.coverValue}>{funcionario.posto ?? '—'}</Text>
          </View>
          <View style={s.coverCell}>
            <Text style={s.coverLabel}>Secretaria</Text>
            <Text style={s.coverValue}>{funcionario.secretaria ?? '—'}</Text>
          </View>
          <View style={s.coverCell}>
            <Text style={s.coverLabel}>Status</Text>
            <Text style={s.coverValue}>{funcionario.status ? STATUS_LABEL[funcionario.status] ?? funcionario.status : '—'}</Text>
          </View>
          <View style={s.coverCell}>
            <Text style={s.coverLabel}>Admissão</Text>
            <Text style={s.coverValue}>{fmt(funcionario.data_admissao)}</Text>
          </View>
          <View style={s.coverCell}>
            <Text style={s.coverLabel}>Total de Eventos</Text>
            <Text style={s.coverValue}>{eventos.length}</Text>
          </View>
        </View>

        {/* Events */}
        <Text style={s.sectionTitle}>Histórico de Eventos</Text>

        {eventosAsc.map(e => {
          const cor = TIPO_COLOR[e.tipo] ?? '#6b7280'
          const dadosAnt = dadosText(e.dados_anteriores)
          const dadosNov = dadosText(e.dados_novos)
          const mudanca  = dadosAnt && dadosNov ? `${dadosAnt} → ${dadosNov}` : (dadosNov || dadosAnt)

          return (
            <View key={e.id} style={s.eventRow}>
              <Text style={s.eventDate}>{fmt(e.data)}</Text>
              <Text style={[s.eventBadge, { color: cor }]}>
                {TIPO_LABEL[e.tipo] ?? e.tipo}
              </Text>
              <View style={s.eventBody}>
                {e.descricao ? (
                  <Text style={s.eventDesc}>{e.descricao}</Text>
                ) : null}
                {mudanca ? (
                  <Text style={s.eventData}>{mudanca}</Text>
                ) : null}
              </View>
            </View>
          )
        })}
      </Page>
    </Document>
  )
}
