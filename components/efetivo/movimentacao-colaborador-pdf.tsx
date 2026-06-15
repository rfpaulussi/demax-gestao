'use client'

import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import type { DadosMovColaborador } from '@/lib/movimentacao-colaborador-constants'

// ─── Styles ───────────────────────────────────────────────────────────────────

const AMBER  = '#FEF3C7'   // amarelo claro — coluna ATUAL
const AMBERH = '#FDE68A'   // cabeçalho ATUAL
const GREEN  = '#DCFCE7'   // verde claro — coluna PROPOSTA
const GREENH = '#A7F3D0'   // cabeçalho PROPOSTA
const BORDER = '#D1D5DB'
const LABEL  = '#6B7280'
const DARK   = '#111827'

const s = StyleSheet.create({
  page:    { fontFamily: 'Helvetica', fontSize: 8.5, padding: 28, color: DARK },

  // Header
  hRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, paddingBottom: 8, borderBottomWidth: 1.5, borderBottomColor: DARK },
  company: { fontSize: 18, fontFamily: 'Helvetica-Bold', letterSpacing: 2 },
  sub:     { fontSize: 7, color: LABEL, marginTop: 2 },
  titleBlock: { alignItems: 'flex-end' },
  title:   { fontSize: 11, fontFamily: 'Helvetica-Bold', letterSpacing: 0.5 },
  cbRow:   { flexDirection: 'row', gap: 10, marginTop: 4 },
  cb:      { flexDirection: 'row', gap: 3, alignItems: 'center' },
  cbBox:   { width: 8, height: 8, borderWidth: 1, borderColor: DARK, alignItems: 'center', justifyContent: 'center' },
  cbX:     { fontSize: 6, fontFamily: 'Helvetica-Bold' },
  cbLabel: { fontSize: 7.5 },
  vigRow:  { flexDirection: 'row', marginTop: 4, alignItems: 'center', gap: 4 },
  vigLabel:{ fontSize: 7, color: LABEL, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', letterSpacing: 0.5 },
  vigVal:  { fontSize: 8.5, fontFamily: 'Helvetica-Bold' },

  // Colaborador
  colabBox:{ borderWidth: 1, borderColor: BORDER, padding: 6, marginBottom: 0, flexDirection: 'row', gap: 16 },
  colabField: { flexDirection: 'row', gap: 4, alignItems: 'baseline' },
  fieldLabel: { fontSize: 7, color: LABEL, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', letterSpacing: 0.3 },
  fieldVal:   { fontSize: 9, fontFamily: 'Helvetica-Bold' },

  // Columns
  cols:    { flexDirection: 'row', borderWidth: 1, borderColor: BORDER, borderTopWidth: 0 },
  colA:    { flex: 1, backgroundColor: AMBER, borderRightWidth: 1, borderRightColor: BORDER },
  colP:    { flex: 1, backgroundColor: GREEN },
  colHead: { padding: '5 8', fontFamily: 'Helvetica-Bold', fontSize: 8, textTransform: 'uppercase', letterSpacing: 0.8, textAlign: 'center' },
  colHeadA:{ backgroundColor: AMBERH },
  colHeadP:{ backgroundColor: GREENH },

  // Rows inside columns
  row:     { flexDirection: 'row', borderTopWidth: 1, borderTopColor: BORDER },
  cell:    { flex: 1, padding: '4 8', borderRightWidth: 1, borderRightColor: BORDER },
  cellLast:{ flex: 1, padding: '4 8' },
  lbl:     { fontSize: 6.5, color: LABEL, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 1.5 },
  val:     { fontSize: 8.5 },
  valBold: { fontSize: 8.5, fontFamily: 'Helvetica-Bold' },

  // Full-width rows
  fullRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: BORDER },
  fullA:   { flex: 1, padding: '4 8', backgroundColor: AMBER, borderRightWidth: 1, borderRightColor: BORDER },
  fullP:   { flex: 1, padding: '4 8', backgroundColor: GREEN },

  // Observações
  obsBox:  { borderWidth: 1, borderColor: BORDER, borderTopWidth: 0, padding: 6 },
  obsLbl:  { fontSize: 6.5, color: LABEL, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 3 },
  obsVal:  { fontSize: 8.5, minHeight: 20 },

  // Assinaturas
  sigGrid: { flexDirection: 'row', marginTop: 18, gap: 10 },
  sigBox:  { flex: 1, borderTopWidth: 1, borderTopColor: '#9CA3AF', paddingTop: 4 },
  sigRole: { fontSize: 7, color: LABEL, textTransform: 'uppercase', letterSpacing: 0.3 },
  sigName: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', marginTop: 14 },

  // Footer
  footer:  { position: 'absolute', bottom: 16, left: 28, right: 28, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 0.5, borderTopColor: '#E5E7EB', paddingTop: 4 },
  footTxt: { fontSize: 6.5, color: '#9CA3AF' },
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtSalario(v: number | null): string {
  if (v == null) return '—'
  return 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function local(posto: string | null): string {
  if (!posto) return '—'
  return `EM "${posto}"`
}

function insalText(ins: boolean, perc: number): string {
  return ins ? `Sim — ${perc}%` : 'Não'
}

const BENEFICIOS = [
  'Vale Transporte',
  'Vale Refeição',
  'Vale Alimentação',
  'Prêmio',
  'Sindicato',
]

// ─── Document ─────────────────────────────────────────────────────────────────

function Checkbox({ checked, label }: { checked: boolean; label: string }) {
  return (
    <View style={s.cb}>
      <View style={s.cbBox}>
        {checked ? <Text style={s.cbX}>X</Text> : null}
      </View>
      <Text style={s.cbLabel}>{label}</Text>
    </View>
  )
}

function ColRow({
  label,
  valorA,
  valorP,
  bold,
}: {
  label: string
  valorA: string
  valorP: string
  bold?: boolean
}) {
  return (
    <View style={s.fullRow}>
      <View style={s.fullA}>
        <Text style={s.lbl}>{label}</Text>
        <Text style={bold ? s.valBold : s.val}>{valorA}</Text>
      </View>
      <View style={s.fullP}>
        <Text style={s.lbl}>{label}</Text>
        <Text style={bold ? s.valBold : s.val}>{valorP}</Text>
      </View>
    </View>
  )
}

function ColRowDiff({
  labelA, valorA,
  labelP, valorP,
  bold,
}: {
  labelA: string; valorA: string
  labelP: string; valorP: string
  bold?: boolean
}) {
  return (
    <View style={s.fullRow}>
      <View style={s.fullA}>
        <Text style={s.lbl}>{labelA}</Text>
        <Text style={bold ? s.valBold : s.val}>{valorA}</Text>
      </View>
      <View style={s.fullP}>
        <Text style={s.lbl}>{labelP}</Text>
        <Text style={bold ? s.valBold : s.val}>{valorP}</Text>
      </View>
    </View>
  )
}

function MovColaboradorDoc({ dados, tipo }: { dados: DadosMovColaborador; tipo: string }) {
  const emitidoEm = new Date().toLocaleDateString('pt-BR')
  const localStr  = local(dados.posto)
  const salStr    = fmtSalario(dados.salario)

  return (
    <Document>
      <Page size="A4" style={s.page}>

        {/* ── Cabeçalho ─────────────────────────────────────────────────── */}
        <View style={s.hRow}>
          <View>
            <Text style={s.company}>DEMAX</Text>
            <Text style={s.sub}>Gestão de Serviços Terceirizados</Text>
          </View>
          <View style={s.titleBlock}>
            <Text style={s.title}>MOVIMENTAÇÃO DE COLABORADOR</Text>
            <View style={s.cbRow}>
              <Checkbox checked={tipo === 'transferencia'}  label="Transferência" />
              <Checkbox checked={tipo === 'mudanca_funcao'} label="Mudança de Função" />
              <Checkbox checked={tipo === 'promocao'}       label="Promoção" />
            </View>
            <View style={s.vigRow}>
              <Text style={s.vigLabel}>Vigência:</Text>
              <Text style={s.vigVal}>{dados.vigencia}</Text>
            </View>
          </View>
        </View>

        {/* ── Colaborador ───────────────────────────────────────────────── */}
        <View style={s.colabBox}>
          <View style={s.colabField}>
            <Text style={s.fieldLabel}>Nº Registro:</Text>
            <Text style={s.fieldVal}>{dados.registro ?? '—'}</Text>
          </View>
          <View style={[s.colabField, { flex: 1 }]}>
            <Text style={s.fieldLabel}>Colaborador:</Text>
            <Text style={s.fieldVal}>{dados.nome}</Text>
          </View>
          <View style={s.colabField}>
            <Text style={s.fieldLabel}>CPF:</Text>
            <Text style={s.fieldVal}>***.***.***-**</Text>
          </View>
        </View>

        {/* ── Colunas ───────────────────────────────────────────────────── */}
        <View style={s.cols}>
          {/* Cabeçalhos */}
          <View style={[s.colA, { borderTopWidth: 1, borderTopColor: BORDER }]}>
            <Text style={[s.colHead, s.colHeadA]}>Situação Atual</Text>
          </View>
          <View style={[s.colP, { borderTopWidth: 1, borderTopColor: BORDER }]}>
            <Text style={[s.colHead, s.colHeadP]}>Situação Proposta</Text>
          </View>
        </View>

        {/* Contrato */}
        <ColRow label="Contrato" valorA="MOGI LIMPEZA - 706" valorP="MOGI LIMPEZA - 706" />

        {/* Supervisor */}
        <ColRow label="Supervisor / Coord." valorA={dados.supervisor ?? '—'} valorP={dados.supervisor ?? '—'} />

        {/* Função */}
        <ColRowDiff
          labelA="Função" valorA={dados.funcaoAtual.nome ?? '—'}
          labelP="Função" valorP={dados.funcaoProposta.nome ?? '—'}
          bold
        />

        {/* Setor */}
        <ColRowDiff
          labelA="Setor" valorA={dados.funcaoAtual.codigo != null ? String(dados.funcaoAtual.codigo) : '—'}
          labelP="Setor" valorP={dados.funcaoProposta.codigo != null ? String(dados.funcaoProposta.codigo) : '—'}
        />

        {/* Salário */}
        <ColRow label="Salário" valorA={salStr} valorP={salStr} />

        {/* Escala */}
        <ColRow label="Escala" valorA={dados.regime.escala} valorP={dados.regime.escala} />

        {/* Horário */}
        <ColRow label="Horário" valorA={dados.regime.horario} valorP={dados.regime.horario} />

        {/* Local */}
        <ColRow label="Local" valorA={localStr} valorP={localStr} />

        {/* Insalubridade */}
        <ColRowDiff
          labelA="Insalubridade"
          valorA={insalText(dados.funcaoAtual.insalubridade,   dados.funcaoAtual.insalubridade_perc)}
          labelP="Insalubridade"
          valorP={insalText(dados.funcaoProposta.insalubridade, dados.funcaoProposta.insalubridade_perc)}
        />

        {/* Benefícios */}
        {BENEFICIOS.map(ben => (
          <ColRow key={ben} label={ben} valorA="Padrão para a função" valorP="Padrão para a função" />
        ))}

        {/* ── Observações ───────────────────────────────────────────────── */}
        <View style={s.obsBox}>
          <Text style={s.obsLbl}>Observações</Text>
          <Text style={s.obsVal}>{dados.motivo ?? ''}</Text>
        </View>

        {/* ── Assinaturas ───────────────────────────────────────────────── */}
        <View style={s.sigGrid}>
          {['Coord. / Supervisor', 'Segurança do Trabalho', 'Gerente Operacional', 'Coordenador RH'].map(role => (
            <View key={role} style={s.sigBox}>
              <Text style={s.sigRole}>{role}</Text>
              <Text style={s.sigName}> </Text>
            </View>
          ))}
        </View>

        {/* ── Rodapé ────────────────────────────────────────────────────── */}
        <View style={s.footer} fixed>
          <Text style={s.footTxt}>DEMAX — Gestão de Serviços Terceirizados</Text>
          <Text style={s.footTxt}>Emitido em {emitidoEm}</Text>
        </View>

      </Page>
    </Document>
  )
}

// ─── Download ─────────────────────────────────────────────────────────────────

export async function downloadMovColaboradorPDF(dados: DadosMovColaborador, tipo: string): Promise<void> {
  const slug = dados.nome
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '_').toUpperCase()
  const filename = `MUD_FUNCAO_${slug}.pdf`

  const { pdf } = await import('@react-pdf/renderer')
  const blob = await pdf(<MovColaboradorDoc dados={dados} tipo={tipo} />).toBlob()
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
