import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { MovimentacaoItem } from './perfil-tabs'

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type FuncionarioParaPDF = {
  nome: string
  cpf: string | null
  funcao: string | null
  posto: string | null
  secretaria: string | null
  data_admissao: string | null
}

// ─── Labels ───────────────────────────────────────────────────────────────────

const TIPO_LABELS: Record<string, string> = {
  desligamento:      'Desligamento',
  transferencia:     'Transferência',
  mudanca_funcao:    'Mudança de Função',
  promocao:          'Promoção',
  mudanca_supervisor:'Mudança de Supervisor',
  alteracao_salario: 'Alteração Salarial',
  afastamento:       'Afastamento',
  atestado:          'Atestado Médico',
}

const CAMPO_LABELS: Record<string, string> = {
  status:       'Status',
  posto_id:     'Posto de Trabalho',
  funcao_id:    'Função',
  salario_base: 'Salário Base',
  supervisor_id:'Supervisor',
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page:         { fontFamily: 'Helvetica', fontSize: 10, padding: 42, color: '#111827' },
  headerRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#111827' },
  companyName:  { fontSize: 20, fontFamily: 'Helvetica-Bold', letterSpacing: 3 },
  companySub:   { fontSize: 8, color: '#6b7280', marginTop: 2 },
  regBlock:     { alignItems: 'flex-end' },
  regLabel:     { fontSize: 7, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1 },
  regValue:     { fontSize: 11, fontFamily: 'Helvetica-Bold' },
  docTitle:     { textAlign: 'center', fontSize: 12, fontFamily: 'Helvetica-Bold', letterSpacing: 1, marginVertical: 14, borderWidth: 1, borderColor: '#111827', paddingVertical: 7, paddingHorizontal: 10 },
  section:      { marginBottom: 14 },
  sectionTitle: { fontSize: 8, fontFamily: 'Helvetica-Bold', letterSpacing: 1, color: '#6b7280', marginBottom: 6, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  row:          { flexDirection: 'row', marginBottom: 3 },
  label:        { width: 140, fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#374151' },
  value:        { flex: 1, fontSize: 9 },
  movBox:       { borderWidth: 1, borderColor: '#d1d5db', padding: 10, backgroundColor: '#f9fafb', marginBottom: 6 },
  arrow:        { fontSize: 9, color: '#9ca3af', marginHorizontal: 4 },
  sigGrid:      { flexDirection: 'row', marginTop: 24 },
  sigBox:       { flex: 1, borderTopWidth: 1, borderTopColor: '#9ca3af', paddingTop: 6, marginRight: 16 },
  sigBoxLast:   { flex: 1, borderTopWidth: 1, borderTopColor: '#9ca3af', paddingTop: 6 },
  sigName:      { fontSize: 8, fontFamily: 'Helvetica-Bold', marginTop: 18 },
  sigRole:      { fontSize: 7, color: '#6b7280' },
  footer:       { position: 'absolute', bottom: 20, left: 42, right: 42, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingTop: 6 },
  footerText:   { fontSize: 7, color: '#9ca3af' },
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(iso: string | null): string {
  if (!iso) return '—'
  const d = iso.split('T')[0].split('-')
  return `${d[2]}/${d[1]}/${d[0]}`
}

function fmtHora(iso: string | null): string {
  if (!iso) return '—'
  const t = iso.includes('T') ? iso.split('T')[1].slice(0, 5) : ''
  return t || '—'
}

// ─── Document ─────────────────────────────────────────────────────────────────

function MovimentacaoDocument({
  mov,
  func,
}: {
  mov: MovimentacaoItem
  func: FuncionarioParaPDF
}) {
  const idShort     = mov.id.substring(0, 8).toUpperCase()
  const tipoLabel   = TIPO_LABELS[mov.tipo] ?? mov.tipo.replace(/_/g, ' ')
  const campoLabel  = mov.campo_alterado ? (CAMPO_LABELS[mov.campo_alterado] ?? mov.campo_alterado) : null
  const emitidoEm   = fmt(new Date().toISOString())

  return (
    <Document>
      <Page size="A4" style={s.page}>

        {/* Cabeçalho */}
        <View style={s.headerRow}>
          <View>
            <Text style={s.companyName}>DEMAX</Text>
            <Text style={s.companySub}>Gestão de Serviços Terceirizados</Text>
          </View>
          <View style={s.regBlock}>
            <Text style={s.regLabel}>Registro</Text>
            <Text style={s.regValue}>MOV-{idShort}</Text>
          </View>
        </View>

        {/* Título */}
        <Text style={s.docTitle}>TERMO DE MOVIMENTAÇÃO DE PESSOAL</Text>

        {/* I. Dados do Colaborador */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>I. DADOS DO COLABORADOR</Text>
          <View style={s.row}>
            <Text style={s.label}>Nome:</Text>
            <Text style={s.value}>{func.nome}</Text>
          </View>
          <View style={s.row}>
            <Text style={s.label}>CPF:</Text>
            <Text style={s.value}>***.***.***-**</Text>
          </View>
          <View style={s.row}>
            <Text style={s.label}>Função:</Text>
            <Text style={s.value}>{func.funcao ?? '—'}</Text>
          </View>
          <View style={s.row}>
            <Text style={s.label}>Posto de Trabalho:</Text>
            <Text style={s.value}>{func.posto ?? '—'}</Text>
          </View>
          <View style={s.row}>
            <Text style={s.label}>Secretaria:</Text>
            <Text style={s.value}>{func.secretaria ?? '—'}</Text>
          </View>
          <View style={s.row}>
            <Text style={s.label}>Data de Admissão:</Text>
            <Text style={s.value}>{fmt(func.data_admissao)}</Text>
          </View>
        </View>

        {/* II. Movimentação */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>II. MOVIMENTAÇÃO</Text>
          <View style={s.movBox}>
            <View style={s.row}>
              <Text style={s.label}>Tipo de Movimentação:</Text>
              <Text style={[s.value, { fontFamily: 'Helvetica-Bold' }]}>{tipoLabel}</Text>
            </View>
            <View style={s.row}>
              <Text style={s.label}>Data:</Text>
              <Text style={s.value}>{fmt(mov.created_at)} às {fmtHora(mov.created_at)}</Text>
            </View>
            {mov.perfis?.nome && (
              <View style={s.row}>
                <Text style={s.label}>Executado por:</Text>
                <Text style={s.value}>{mov.perfis.nome}</Text>
              </View>
            )}
          </View>

          {campoLabel && (
            <>
              <View style={s.row}>
                <Text style={s.label}>Campo Alterado:</Text>
                <Text style={s.value}>{campoLabel}</Text>
              </View>
              <View style={[s.row, { alignItems: 'center' }]}>
                <Text style={s.label}>Alteração:</Text>
                <Text style={s.value}>
                  <Text style={{ color: '#9ca3af' }}>{mov.valor_antes ?? '—'}</Text>
                  <Text style={s.arrow}>{' → '}</Text>
                  <Text style={{ fontFamily: 'Helvetica-Bold' }}>{mov.valor_depois ?? '—'}</Text>
                </Text>
              </View>
            </>
          )}
        </View>

        {/* III. Declaração */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>III. DECLARAÇÃO</Text>
          <Text style={{ fontSize: 9, lineHeight: 1.7, color: '#4b5563', textAlign: 'justify' }}>
            A DEMAX SERVIÇOS E COMÉRCIO LTDA declara, para os devidos fins, que a movimentação
            descrita neste termo foi devidamente registrada no sistema de gestão de pessoal na data
            acima indicada, sendo parte integrante do histórico funcional do(a) colaborador(a){' '}
            <Text style={{ fontFamily: 'Helvetica-Bold' }}>{func.nome.toUpperCase()}</Text>.
          </Text>
        </View>

        {/* Assinaturas */}
        <View style={[s.section, { marginTop: 10 }]}>
          <Text style={s.sectionTitle}>IV. CIÊNCIA</Text>
          <View style={s.sigGrid}>
            <View style={s.sigBox}>
              <Text style={s.sigName}>{func.nome}</Text>
              <Text style={s.sigRole}>Colaborador(a)</Text>
            </View>
            <View style={s.sigBox}>
              <Text style={s.sigName}>{mov.perfis?.nome ?? 'Responsável'}</Text>
              <Text style={s.sigRole}>Responsável / Coordenação</Text>
            </View>
            <View style={s.sigBoxLast}>
              <Text style={s.sigName}>Rodolfo Paulussi</Text>
              <Text style={s.sigRole}>Coordenador Operacional</Text>
            </View>
          </View>
        </View>

        {/* Rodapé */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>DEMAX — Gestão de Serviços Terceirizados</Text>
          <Text style={s.footerText}>MOV-{idShort} · Emitido em {emitidoEm}</Text>
        </View>

      </Page>
    </Document>
  )
}

// ─── Download ─────────────────────────────────────────────────────────────────

export async function downloadMovimentacaoPDF(
  mov: MovimentacaoItem,
  func: FuncionarioParaPDF,
): Promise<void> {
  const nomeSlug = func.nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '_')
    .toUpperCase()

  const dataSlug = (mov.created_at ?? new Date().toISOString())
    .split('T')[0]
    .replace(/-/g, '')

  const idShort  = mov.id.substring(0, 8).toUpperCase()
  const filename = `MOV_${idShort}_${nomeSlug}_${dataSlug}.pdf`

  const { pdf } = await import('@react-pdf/renderer')
  const blob = await pdf(<MovimentacaoDocument mov={mov} func={func} />).toBlob()
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
