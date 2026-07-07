import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { ProntuarioFuncionario, ProntuarioEvento } from '@/app/(admin)/efetivo/[id]/historico/page'
import type { MesEntry } from '@/components/efetivo/prontuario-client'

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
  const hasPostoNome = dados.posto_nome != null && dados.posto_nome !== ''
  return Object.entries(dados)
    .filter(([k, v]) => v != null && v !== '' && !(hasPostoNome && k === 'posto_id'))
    .map(([k, v]) => `${k === 'posto_nome' ? 'Posto' : k}: ${v}`)
    .join('  ·  ')
}

const MONTH_NAMES = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
function fmtMesAno(ym: string): string {
  const [y, m] = ym.split('-')
  return `${MONTH_NAMES[Number(m)]}/${y}`
}

// A4 content width = 595 - 2*40 = 515pt
const COL = { mes: 44, posto: 112, sec: 68, funcao: 80, status: 50, sup: 72, evento: 89 }

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
  // histórico por mês table
  tHead:    { flexDirection: 'row', backgroundColor: '#f8fafc', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  tRow:     { flexDirection: 'row', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  tRowAlt:  { backgroundColor: '#f9fafb' },
  tHCell:   { fontSize: 6, fontWeight: 'bold', color: '#9ca3af', textTransform: 'uppercase' },
  tDCell:   { fontSize: 7, color: '#374151' },
  tDMuted:  { fontSize: 7, color: '#6b7280' },
})

interface Props {
  funcionario: ProntuarioFuncionario
  eventos: ProntuarioEvento[]
  mesEntries: MesEntry[]
}

export function ProntuarioPDFDoc({ funcionario, eventos, mesEntries }: Props) {
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
              <Text style={s.eventDate}>{fmt(e.dataDisplay ?? e.data)}</Text>
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

      {/* Page 2: Histórico por Mês */}
      {mesEntries.length > 0 && (
        <Page size="A4" style={s.page}>
          <Text style={s.coverTitle}>{funcionario.nome}</Text>
          <Text style={[s.coverSub, { marginBottom: 16 }]}>Histórico por Mês</Text>

          {/* Table header */}
          <View style={s.tHead}>
            <Text style={[s.tHCell, { width: COL.mes }]}>Mês/Ano</Text>
            <Text style={[s.tHCell, { width: COL.posto }]}>Posto</Text>
            <Text style={[s.tHCell, { width: COL.sec }]}>Secretaria</Text>
            <Text style={[s.tHCell, { width: COL.funcao }]}>Função</Text>
            <Text style={[s.tHCell, { width: COL.status }]}>Status</Text>
            <Text style={[s.tHCell, { width: COL.sup }]}>Supervisor</Text>
            <Text style={[s.tHCell, { width: COL.evento }]}>Evento no Mês</Text>
          </View>

          {mesEntries.map((entry, i) => {
            const statusLabel = STATUS_LABEL[entry.status] ?? entry.status
            const eventosLabel = Array.from(new Set(entry.eventosNoMes))
              .map(t => TIPO_LABEL[t] ?? t)
              .join(', ')
            return (
              <View key={entry.ym} style={[s.tRow, i % 2 === 1 ? s.tRowAlt : {}]}>
                <Text style={[s.tDCell, { width: COL.mes, fontWeight: 'bold' }]}>{fmtMesAno(entry.ym)}</Text>
                <Text style={[s.tDCell, { width: COL.posto }]}>{entry.posto || '—'}</Text>
                <Text style={[s.tDMuted, { width: COL.sec }]}>{entry.secretaria || '—'}</Text>
                <Text style={[s.tDCell, { width: COL.funcao }]}>{entry.funcao || '—'}</Text>
                <Text style={[s.tDMuted, { width: COL.status }]}>{statusLabel || '—'}</Text>
                <Text style={[s.tDMuted, { width: COL.sup }]}>{entry.supervisor || '—'}</Text>
                <Text style={[s.tDCell, { width: COL.evento, color: eventosLabel ? '#2563eb' : '#d1d5db' }]}>
                  {eventosLabel || '—'}
                </Text>
              </View>
            )
          })}
        </Page>
      )}
    </Document>
  )
}
