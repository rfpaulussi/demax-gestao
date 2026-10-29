// NÃO adicionar 'use client' — componente PDF é importado dinamicamente no download.
import { Document, Page, Text, View, StyleSheet, pdf } from '@react-pdf/renderer'
import { diaMes, rotuloMes } from '@/lib/agenda/datas'
import type { Insight } from '@/lib/agenda/relatorio-insights'
import type { RelatorioMensal } from '@/app/(admin)/agenda/relatorio-actions'

export type RelatorioPdfData = {
  dados: RelatorioMensal
  anterior: RelatorioMensal | null
  insights: Insight[]
}

const s = StyleSheet.create({
  page:            { fontFamily: 'Helvetica', fontSize: 9, padding: 36, paddingBottom: 54, color: '#111827' },
  headerRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10, paddingBottom: 10, borderBottomWidth: 2, borderBottomColor: '#111827' },
  companyName:     { fontSize: 20, fontFamily: 'Helvetica-Bold', letterSpacing: 3 },
  companySubtitle: { fontSize: 8, color: '#6b7280', marginTop: 2 },
  title:           { textAlign: 'center', fontSize: 13, fontFamily: 'Helvetica-Bold', letterSpacing: 1, marginVertical: 10, borderWidth: 1, borderColor: '#111827', paddingVertical: 6, paddingHorizontal: 12 },
  section:         { marginBottom: 12 },
  sectionTitle:    { fontSize: 8, fontFamily: 'Helvetica-Bold', letterSpacing: 1, color: '#6b7280', marginBottom: 6, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  kpis:            { flexDirection: 'row', marginBottom: 12 },
  kpi:             { flex: 1, borderWidth: 1, borderColor: '#e5e7eb', paddingVertical: 6, paddingHorizontal: 8, marginRight: 6 },
  kpiVal:          { fontSize: 15, fontFamily: 'Helvetica-Bold' },
  kpiLabel:        { fontSize: 6.5, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 1 },
  kpiDelta:        { fontSize: 6.5, color: '#6b7280', marginTop: 1 },
  thead:           { flexDirection: 'row', backgroundColor: '#f1f5f9', borderBottomWidth: 1, borderBottomColor: '#cbd5e1' },
  th:              { fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: '#64748b', paddingVertical: 4, paddingHorizontal: 4, textTransform: 'uppercase' },
  tr:              { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  td:              { fontSize: 7.5, color: '#374151', paddingVertical: 4, paddingHorizontal: 4 },
  item:            { flexDirection: 'row', marginBottom: 3 },
  bullet:          { width: 10, fontFamily: 'Helvetica-Bold' },
  nota:            { fontSize: 7, color: '#6b7280', marginTop: 4 },
  footer:          { position: 'absolute', bottom: 20, left: 36, right: 36, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingTop: 6 },
  footerText:      { fontSize: 7, color: '#9ca3af' },
})

const COR_NIVEL = { alto: '#be123c', medio: '#b45309', info: '#475569' } as const
const ROTULO_NIVEL = { alto: 'ALTO', medio: 'MEDIO', info: 'INFO' } as const

const pct = (p: number | null) => (p === null ? '-' : `${p}%`)

function delta(atual: number | null, ant: number | null | undefined, un = ''): string {
  if (atual === null || ant === null || ant === undefined) return ''
  const d = atual - ant
  return d === 0 ? 'igual ao mes anterior' : `${d > 0 ? '+' : ''}${d}${un} vs mes anterior`
}

function Tabela({ cols, linhas }: { cols: { t: string; w: number | string; alinhar?: 'right' }[]; linhas: (string | number)[][] }) {
  return (
    <View>
      <View style={s.thead} fixed>
        {cols.map(c => <Text key={c.t} style={[s.th, { width: c.w }]}>{c.t}</Text>)}
      </View>
      {linhas.map((l, i) => (
        <View key={i} style={s.tr} wrap={false}>
          {l.map((v, j) => <Text key={j} style={[s.td, { width: cols[j].w }]}>{String(v)}</Text>)}
        </View>
      ))}
    </View>
  )
}

export function RelatorioMensalDoc({ data }: { data: RelatorioPdfData }) {
  const { dados: d, anterior, insights } = data
  const t = d.totais
  const kpis = [
    { v: pct(t.pct), l: 'Cumprimento', d: delta(t.pct, anterior?.totais.pct, ' pp') },
    { v: `${t.cumpridas}/${t.planejadas}`, l: 'Cumpridas', d: '' },
    { v: String(t.faltas), l: 'Faltas', d: delta(t.faltas, anterior?.totais.faltas) },
    { v: String(t.atencao), l: 'Com atencao', d: delta(t.atencao, anterior?.totais.atencao) },
    { v: String(t.semFoto), l: 'Sem foto', d: delta(t.semFoto, anterior?.totais.semFoto) },
    { v: String(t.extras), l: 'Extras', d: delta(t.extras, anterior?.totais.extras) },
  ]
  const supervisores = [...d.supervisores].sort((a, b) => (a.pct ?? 101) - (b.pct ?? 101) || b.faltas - a.faltas)
  const periodo = `${rotuloMes(d.mes)}${d.parcial ? ` (ate ${diaMes(d.ateData)})` : ''}`
  const emitido = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date())

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={s.page}>
        <View style={s.headerRow}>
          <View>
            <Text style={s.companyName}>DEMAX</Text>
            <Text style={s.companySubtitle}>Serviços e Comércio LTDA</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 7, color: '#9ca3af', letterSpacing: 1 }}>PERIODO</Text>
            <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold' }}>{periodo}</Text>
          </View>
        </View>

        <Text style={s.title}>RELATORIO MENSAL DE SUPERVISAO</Text>

        <View style={s.section}>
          <Text style={s.sectionTitle}>I. INDICADORES GERAIS</Text>
          <View style={s.kpis}>
            {kpis.map(k => (
              <View key={k.l} style={s.kpi}>
                <Text style={s.kpiVal}>{k.v}</Text>
                <Text style={s.kpiLabel}>{k.l}</Text>
                {k.d ? <Text style={s.kpiDelta}>{k.d}</Text> : null}
              </View>
            ))}
          </View>
          {d.parcial && <Text style={s.nota}>Mes em andamento: conta apenas o que ja venceu ate {diaMes(d.ateData)}.</Text>}
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>II. PONTOS DE ATENCAO ({insights.length})</Text>
          {insights.length === 0 && <Text>Nenhum ponto de atencao neste mes.</Text>}
          {insights.map((i, idx) => (
            <View key={idx} style={s.item} wrap={false}>
              <Text style={[s.bullet, { color: COR_NIVEL[i.nivel] }]}>•</Text>
              <Text style={{ flex: 1 }}>
                <Text style={{ fontFamily: 'Helvetica-Bold', color: COR_NIVEL[i.nivel] }}>[{ROTULO_NIVEL[i.nivel]}] </Text>
                {i.supervisor ? <Text style={{ fontFamily: 'Helvetica-Bold' }}>{i.supervisor} </Text> : null}
                {i.texto}
              </Text>
            </View>
          ))}
        </View>
      </Page>

      <Page size="A4" orientation="landscape" style={s.page}>
        <View style={s.section}>
          <Text style={s.sectionTitle}>III. DESEMPENHO POR SUPERVISOR</Text>
          <Tabela
            cols={[
              { t: 'Supervisor', w: 150 }, { t: 'Cumprim.', w: 55 }, { t: 'Plan.', w: 40 }, { t: 'Faltas', w: 40 }, { t: 'Extras', w: 40 },
              { t: 'Atencao', w: 45 }, { t: 'Sem foto', w: 45 }, { t: 'Tempo med.', w: 55 }, { t: 'Replan.', w: 45 },
              { t: 'Agenda pub/rasc/sem', w: 95 }, { t: 'Postos s/ visita', w: 70 },
            ]}
            linhas={supervisores.map(v => [
              v.nome, pct(v.pct), v.planejadas, v.faltas, v.extras, v.atencao, v.semFoto,
              v.tempoMedioMin === null ? '-' : `${v.tempoMedioMin} min`, v.replanejamentos,
              `${v.semanasPublicadas}/${v.semanasRascunho}/${v.semanasSemAgenda}`, v.postosSemVisita,
            ])}
          />
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>IV. CUMPRIMENTO POR TIPO DE FOCO</Text>
          <Tabela
            cols={[{ t: 'Foco', w: 220 }, { t: 'Plan.', w: 50 }, { t: 'Cumpridas', w: 60 }, { t: 'Faltas', w: 50 }, { t: 'Sem foto', w: 55 }, { t: 'Cumprim.', w: 60 }]}
            linhas={d.porFoco.map(f => [f.foco, f.planejadas, f.cumpridas, f.faltas, f.semFoto, pct(f.pct)])}
          />
        </View>

        <View style={s.footer} fixed>
          <Text style={s.footerText}>Relatorio mensal de supervisao · {periodo}</Text>
          <Text style={s.footerText}>Emitido em {emitido}</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `Pagina ${pageNumber} de ${totalPages}`} />
        </View>
      </Page>

      <Page size="A4" orientation="landscape" style={s.page}>
        <View style={s.section}>
          <Text style={s.sectionTitle}>V. POSTOS COM MAIS FALTAS</Text>
          <Tabela
            cols={[{ t: 'Posto', w: 280 }, { t: 'Supervisor', w: 140 }, { t: 'Faltas', w: 50 }, { t: 'Planejadas', w: 60 }]}
            linhas={d.postos.filter(p => p.faltas > 0).slice(0, 20).map(p => [p.nome, p.supervisor, p.faltas, p.planejadas])}
          />
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>VI. BAIXA FREQUENCIA (MENOS DE {d.metaVisitasPosto} DIAS DE VISITA NO MES)</Text>
          <Tabela
            cols={[{ t: 'Posto', w: 280 }, { t: 'Supervisor', w: 140 }, { t: 'Dias com visita', w: 80 }]}
            linhas={d.postosBaixaFrequencia.slice(0, 30).map(p => [p.nome, p.supervisor, p.visitas])}
          />
          {d.postosBaixaFrequencia.length > 30 && <Text style={s.nota}>+ {d.postosBaixaFrequencia.length - 30} postos na planilha Excel.</Text>}
          <Text style={s.nota}>
            {d.postosNaoVisitados.length} postos sem nenhuma visita no mes (lista completa no Excel).
          </Text>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>VII. REPLANEJAMENTOS ({d.replanejamentos.length})</Text>
          <Tabela
            cols={[{ t: 'Data', w: 50 }, { t: 'Supervisor', w: 110 }, { t: 'Foco', w: 170 }, { t: 'Motivo', w: 330 }]}
            linhas={d.replanejamentos.slice(0, 25).map(r => [diaMes(r.data), r.supervisor, r.foco, r.motivo || 'Sem motivo informado'])}
          />
          {d.replanejamentos.length > 25 && <Text style={s.nota}>+ {d.replanejamentos.length - 25} replanejamentos na planilha Excel.</Text>}
        </View>

        {d.apoio.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>VIII. SUPERVISORES DE APOIO (SEM AGENDA)</Text>
            <Tabela
              cols={[
                { t: 'Supervisor', w: 90 }, { t: 'Dias em campo', w: 50 }, { t: 'Visitas', w: 42 }, { t: 'Postos', w: 42 },
                { t: 'Tempo total', w: 50 }, { t: 'Tempo medio', w: 50 }, { t: 'Sem foto', w: 42 }, { t: 'Sem saida', w: 45 }, { t: 'Atividades', w: 160 }, { t: 'Quem ajudou (visitas)', w: 170 },
              ]}
              linhas={d.apoio.map(a => [
                a.nome, a.diasEmCampo, a.visitas, a.postosDistintos,
                `${Math.floor(a.tempoTotalMin / 60)}h${String(a.tempoTotalMin % 60).padStart(2, '0')}`,
                a.tempoMedioMin === null ? '-' : `${a.tempoMedioMin} min`,
                a.semFoto, a.semSaida,
                a.porAtividade.map(x => `${x.atividade} (${x.visitas})`).join(', ') || '-',
                a.porSupervisor.map(x => `${x.supervisor} (${x.visitas})`).join(', ') || '-',
              ])}
            />
            <Text style={s.nota}>Lista completa das visitas, com posto, horario e observacao, na planilha Excel.</Text>
          </View>
        )}

        <View style={s.footer} fixed>
          <Text style={s.footerText}>Relatorio mensal de supervisao · {periodo}</Text>
          <Text style={s.footerText}>Emitido em {emitido}</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `Pagina ${pageNumber} de ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}

export async function downloadRelatorioMensalPDF(data: RelatorioPdfData): Promise<void> {
  const blob = await pdf(<RelatorioMensalDoc data={data} />).toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `relatorio-agenda-${data.dados.mes}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}
