// NÃO adicionar 'use client' — componente PDF é importado dinamicamente no download.
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import { DIAS_CURTOS, PERIODOS } from '@/lib/agenda/tema'
import { diasEntre, segundaDe } from '@/lib/agenda/datas'
import { formatarDistancia } from '@/lib/agenda/geo'
import type { MapaStats, StatusVisita, VisitaView } from '@/lib/agenda/visitas'

export type AgendaPdfData = {
  supervisorNome: string
  semanaInicio: string
  semanaLabel: string
  publicada: boolean
  stats: MapaStats
  visitas: VisitaView[]
  replanejamentos: { data: string; periodo: string; motivo: string }[]
}

const SITUACAO: Record<StatusVisita, string> = {
  ok: 'No posto',
  alerta: 'Atencao',
  sem_foto: 'Falta foto obrigatoria',
  falta: 'Sem check-in',
  agendado: 'Agendado',
  extra: 'Visita extra',
}
const COR: Record<StatusVisita, string> = {
  ok: '#047857', alerta: '#b45309', sem_foto: '#c2410c', falta: '#be123c', agendado: '#2563eb', extra: '#4b5563',
}
const ROTULO_PERIODO = Object.fromEntries(PERIODOS.map(p => [p.id, p.label])) as Record<string, string>

const s = StyleSheet.create({
  page:            { fontFamily: 'Helvetica', fontSize: 9, padding: 36, paddingBottom: 54, color: '#111827' },
  headerRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10, paddingBottom: 10, borderBottomWidth: 2, borderBottomColor: '#111827' },
  companyName:     { fontSize: 20, fontFamily: 'Helvetica-Bold', letterSpacing: 3 },
  companySubtitle: { fontSize: 8, color: '#6b7280', marginTop: 2 },
  title:           { textAlign: 'center', fontSize: 13, fontFamily: 'Helvetica-Bold', letterSpacing: 1, marginVertical: 10, borderWidth: 1, borderColor: '#111827', paddingVertical: 6, paddingHorizontal: 12 },
  section:         { marginBottom: 12 },
  sectionTitle:    { fontSize: 8, fontFamily: 'Helvetica-Bold', letterSpacing: 1, color: '#6b7280', marginBottom: 6, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  row:             { flexDirection: 'row', marginBottom: 3 },
  label:           { width: 110, fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#374151' },
  value:           { flex: 1, fontSize: 9 },
  kpis:            { flexDirection: 'row', marginBottom: 12 },
  kpi:             { flex: 1, borderWidth: 1, borderColor: '#e5e7eb', paddingVertical: 6, paddingHorizontal: 8, marginRight: 6 },
  kpiVal:          { fontSize: 15, fontFamily: 'Helvetica-Bold' },
  kpiLabel:        { fontSize: 6.5, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 1 },
  thead:           { flexDirection: 'row', backgroundColor: '#f1f5f9', borderBottomWidth: 1, borderBottomColor: '#cbd5e1' },
  th:              { fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: '#64748b', paddingVertical: 4, paddingHorizontal: 4, textTransform: 'uppercase' },
  tr:              { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  td:              { fontSize: 7.5, color: '#374151', paddingVertical: 4, paddingHorizontal: 4 },
  cDia:            { width: 48 },
  cPer:            { width: 44 },
  cPosto:          { width: 118 },
  cFoco:           { width: 98 },
  cSit:            { width: 82 },
  cHora:            { width: 66 },
  cDist:           { width: 42 },
  footer:          { position: 'absolute', bottom: 20, left: 36, right: 36, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingTop: 6 },
  footerText:      { fontSize: 7, color: '#9ca3af' },
})

function hora(iso: string | null): string {
  if (!iso) return '-'
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }).format(new Date(iso))
}

function diaLabel(data: string): string {
  const [, m, d] = data.split('-')
  const idx = diasEntre(segundaDe(data), data)
  return `${DIAS_CURTOS[idx] ?? ''} ${d}/${m}`
}

function duracao(min: number | null): string {
  if (min === null) return ''
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}`
}

export function AgendaSemanalDoc({ data }: { data: AgendaPdfData }) {
  const { stats, visitas } = data
  const kpis = [
    { v: stats.pct === null ? '-' : `${stats.pct}%`, l: 'Cumprimento' },
    { v: `${stats.cumpridas}/${stats.planejadas}`, l: 'Visitas cumpridas' },
    { v: String(stats.atencao), l: 'Com atencao' },
    { v: String(stats.faltas), l: 'Sem check-in' },
    { v: String(stats.semFoto), l: 'Sem foto obrig.' },
    { v: String(stats.extras), l: 'Visitas extras' },
    { v: stats.tempoMedioMin === null ? '-' : duracao(stats.tempoMedioMin), l: 'Tempo medio' },
  ]
  const idShort = data.semanaInicio.replace(/-/g, '')

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={s.page}>
        <View style={s.headerRow}>
          <View>
            <Text style={s.companyName}>DEMAX</Text>
            <Text style={s.companySubtitle}>Serviços e Comércio LTDA</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 7, color: '#9ca3af', letterSpacing: 1 }}>SEMANA</Text>
            <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold' }}>{data.semanaLabel}</Text>
          </View>
        </View>

        <Text style={s.title}>RELATORIO SEMANAL DE SUPERVISAO</Text>

        <View style={s.section}>
          <Text style={s.sectionTitle}>I. IDENTIFICACAO</Text>
          <View style={s.row}><Text style={s.label}>Supervisor(a):</Text><Text style={s.value}>{data.supervisorNome}</Text></View>
          <View style={s.row}><Text style={s.label}>Semana:</Text><Text style={s.value}>{data.semanaLabel}</Text></View>
          <View style={s.row}><Text style={s.label}>Agenda:</Text><Text style={s.value}>{data.publicada ? 'Publicada' : 'Rascunho (nao publicada) - visitas nao contam no cumprimento'}</Text></View>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>II. INDICADORES</Text>
          <View style={s.kpis}>
            {kpis.map(k => (
              <View key={k.l} style={s.kpi}>
                <Text style={s.kpiVal}>{k.v}</Text>
                <Text style={s.kpiLabel}>{k.l}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>III. VISITAS (PLANEJADO x REALIZADO)</Text>
          <View style={s.thead} fixed>
            <Text style={[s.th, s.cDia]}>Dia</Text>
            <Text style={[s.th, s.cPer]}>Periodo</Text>
            <Text style={[s.th, s.cPosto]}>Posto</Text>
            <Text style={[s.th, s.cFoco]}>Foco</Text>
            <Text style={[s.th, s.cSit]}>Situacao</Text>
            <Text style={[s.th, s.cHora]}>Chegada / saida</Text>
            <Text style={[s.th, s.cDist]}>Dist.</Text>
            <Text style={[s.th, { flex: 1 }]}>Observacao</Text>
          </View>
          {visitas.length === 0 && <Text style={[s.td, { color: '#9ca3af' }]}>Nenhuma visita planejada ou registrada.</Text>}
          {visitas.map(v => (
            <View key={v.key} style={s.tr} wrap={false}>
              <Text style={[s.td, s.cDia]}>{diaLabel(v.data)}</Text>
              <Text style={[s.td, s.cPer]}>{v.periodos.map(p => ROTULO_PERIODO[p]).join(' + ') || '-'}</Text>
              <Text style={[s.td, s.cPosto, { fontFamily: 'Helvetica-Bold' }]}>{v.posto_nome}</Text>
              <Text style={[s.td, s.cFoco]}>{v.focos.join(', ') || '-'}</Text>
              <Text style={[s.td, s.cSit, { color: COR[v.status], fontFamily: 'Helvetica-Bold' }]}>{SITUACAO[v.status]}</Text>
              <Text style={[s.td, s.cHora]}>
                {v.entrada_em ? `${hora(v.entrada_em)}${v.saida_em ? ` - ${hora(v.saida_em)}` : ''}` : '-'}
              </Text>
              <Text style={[s.td, s.cDist]}>{v.distancia_m != null ? formatarDistancia(v.distancia_m) : '-'}</Text>
              <Text style={[s.td, { flex: 1 }]}>
                {[...v.alertas, v.justificativa ? `Justificativa: "${v.justificativa}"` : '', v.tempo_min != null ? `permanencia ${duracao(v.tempo_min)}` : '']
                  .filter(Boolean).join(' · ')}
              </Text>
            </View>
          ))}
        </View>

        {data.replanejamentos.length > 0 && (
          <View style={s.section} wrap={false}>
            <Text style={s.sectionTitle}>IV. REPLANEJAMENTOS APOS PUBLICACAO</Text>
            {data.replanejamentos.map((r, i) => (
              <View key={i} style={s.row}>
                <Text style={[s.label, { width: 90 }]}>{diaLabel(r.data)} ({r.periodo})</Text>
                <Text style={s.value}>{r.motivo}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={[s.section, { marginTop: 24 }]} wrap={false}>
          <View style={{ flexDirection: 'row' }}>
            <View style={{ flex: 1, borderTopWidth: 1, borderTopColor: '#9ca3af', paddingTop: 6, marginRight: 24 }}>
              <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold' }}>{data.supervisorNome}</Text>
              <Text style={{ fontSize: 7, color: '#6b7280' }}>Supervisor(a)</Text>
            </View>
            <View style={{ flex: 1, borderTopWidth: 1, borderTopColor: '#9ca3af', paddingTop: 6 }}>
              <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold' }}>Coordenacao</Text>
              <Text style={{ fontSize: 7, color: '#6b7280' }}>Conferencia</Text>
            </View>
          </View>
        </View>

        <View style={s.footer} fixed>
          <Text style={s.footerText}>DEMAX Serviços e Comércio LTDA</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `Reg. ${idShort} · Emitido em ${new Date().toLocaleDateString('pt-BR')} · Pag. ${pageNumber}/${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}

export async function downloadAgendaSemanalPDF(data: AgendaPdfData): Promise<void> {
  const { pdf } = await import('@react-pdf/renderer')
  const blob = await pdf(<AgendaSemanalDoc data={data} />).toBlob()
  const url = URL.createObjectURL(blob)
  const nome = data.supervisorNome
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '')
  const a = document.createElement('a')
  a.href = url
  a.download = `agenda_semanal_${nome}_${data.semanaInicio}.pdf`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}
