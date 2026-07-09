import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { MovimentacaoItem } from './perfil-tabs'

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type FuncionarioParaPDF = {
  id: string
  nome: string
  cpf: string | null
  funcao: string | null
  posto: string | null
  secretaria: string | null
  data_admissao: string | null
  supervisor: string | null
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

const BRAND = '#1e293b'
const ACCENT = '#0f172a'

const s = StyleSheet.create({
  page:         { fontFamily: 'Helvetica', fontSize: 10, padding: 48, color: '#111827', backgroundColor: '#ffffff' },
  headerRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20, paddingBottom: 14, borderBottomWidth: 2, borderBottomColor: BRAND },
  companyName:  { fontSize: 22, fontFamily: 'Helvetica-Bold', letterSpacing: 4, color: BRAND },
  companySub:   { fontSize: 8, color: '#94a3b8', marginTop: 3, letterSpacing: 0.5 },
  regBlock:     { alignItems: 'flex-end' },
  regLabel:     { fontSize: 7, color: '#94a3b8', letterSpacing: 1.5, textTransform: 'uppercase' },
  regValue:     { fontSize: 12, fontFamily: 'Helvetica-Bold', color: ACCENT },
  docTitle:     { textAlign: 'center', fontSize: 11, fontFamily: 'Helvetica-Bold', letterSpacing: 2, marginVertical: 18, borderWidth: 1.5, borderColor: BRAND, paddingVertical: 9, paddingHorizontal: 12, color: BRAND },
  section:      { marginBottom: 18 },
  sectionTitle: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', letterSpacing: 1.5, color: '#475569', marginBottom: 8, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', textTransform: 'uppercase' },
  row:          { flexDirection: 'row', marginBottom: 4 },
  label:        { width: 148, fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#374151' },
  value:        { flex: 1, fontSize: 9, color: '#1f2937' },
  movBox:       { borderWidth: 1, borderColor: '#cbd5e1', borderLeftWidth: 3, borderLeftColor: BRAND, padding: 12, backgroundColor: '#f8fafc', marginBottom: 10, borderRadius: 2 },
  movBoxRow:    { flexDirection: 'row', marginBottom: 4 },
  movLabel:     { width: 148, fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#475569' },
  movValue:     { flex: 1, fontSize: 9, color: '#1f2937' },
  alteracaoBox: { marginTop: 4, padding: 8, backgroundColor: '#f1f5f9', borderRadius: 2 },
  alteracaoLabel:{ fontSize: 8, color: '#64748b', marginBottom: 3, fontFamily: 'Helvetica-Bold', letterSpacing: 0.5 },
  alteracaoRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  valorAntes:   { fontSize: 9, color: '#94a3b8', textDecoration: 'line-through' },
  arrow:        { fontSize: 10, color: '#64748b', marginHorizontal: 6 },
  valorDepois:  { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#0f172a' },
  motivoBox:    { marginTop: 6, padding: 8, backgroundColor: '#fffbeb', borderLeftWidth: 2, borderLeftColor: '#f59e0b', borderRadius: 2 },
  motivoLabel:  { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#92400e', letterSpacing: 0.5, marginBottom: 2 },
  motivoText:   { fontSize: 9, color: '#78350f' },
  declaracao:   { fontSize: 9, lineHeight: 1.8, color: '#4b5563', textAlign: 'justify' },
  sigGrid:      { flexDirection: 'row', marginTop: 32 },
  sigBox:       { flex: 1, borderTopWidth: 1, borderTopColor: '#94a3b8', paddingTop: 8, marginRight: 18 },
  sigBoxLast:   { flex: 1, borderTopWidth: 1, borderTopColor: '#94a3b8', paddingTop: 8 },
  sigName:      { fontSize: 8, fontFamily: 'Helvetica-Bold', marginTop: 22, color: '#1f2937' },
  sigRole:      { fontSize: 7, color: '#94a3b8', marginTop: 2 },
  footer:       { position: 'absolute', bottom: 22, left: 48, right: 48, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 7 },
  footerText:   { fontSize: 7, color: '#94a3b8' },
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

function resolveValor(
  campo: string | null,
  valor: string | null,
  postoNomeMap: Record<string, string>,
  funcaoNomeMap: Record<string, string>,
): string {
  if (!valor) return '—'
  if (campo === 'posto_id')  return postoNomeMap[valor]  ?? valor
  if (campo === 'funcao_id') return funcaoNomeMap[valor] ?? valor
  return valor
}

// ─── Document ─────────────────────────────────────────────────────────────────

function MovimentacaoDocument({
  mov,
  func,
  postoNomeMap,
  funcaoNomeMap,
}: {
  mov: MovimentacaoItem
  func: FuncionarioParaPDF
  postoNomeMap: Record<string, string>
  funcaoNomeMap: Record<string, string>
}) {
  const idShort    = mov.id.substring(0, 8).toUpperCase()
  const tipoLabel  = TIPO_LABELS[mov.tipo] ?? mov.tipo.replace(/_/g, ' ')
  const campoLabel = mov.campo_alterado ? (CAMPO_LABELS[mov.campo_alterado] ?? mov.campo_alterado) : null
  const emitidoEm  = fmt(new Date().toISOString())

  const valorAntes  = resolveValor(mov.campo_alterado, mov.valor_antes,  postoNomeMap, funcaoNomeMap)
  const valorDepois = resolveValor(mov.campo_alterado, mov.valor_depois, postoNomeMap, funcaoNomeMap)

  const solicitacao = mov.solicitacoes as { motivo?: string | null; perfis?: { nome: string | null } | null } | null
  const motivo         = solicitacao?.motivo ?? null
  const supervisorNome = solicitacao?.perfis?.nome ?? func.supervisor ?? '—'

  return (
    <Document>
      <Page size="A4" style={s.page}>

        {/* Cabeçalho */}
        <View style={s.headerRow}>
          <View>
            <Text style={s.companyName}>DEMAX</Text>
            <Text style={s.companySub}>Serviços e Comércio LTDA</Text>
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
          <Text style={s.sectionTitle}>I. Dados do Colaborador</Text>
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
          <Text style={s.sectionTitle}>II. Movimentação</Text>
          <View style={s.movBox}>
            <View style={s.movBoxRow}>
              <Text style={s.movLabel}>Tipo de Movimentação:</Text>
              <Text style={[s.movValue, { fontFamily: 'Helvetica-Bold' }]}>{tipoLabel}</Text>
            </View>
            <View style={s.movBoxRow}>
              <Text style={s.movLabel}>Data:</Text>
              <Text style={s.movValue}>{fmt(mov.created_at)} às {fmtHora(mov.created_at)}</Text>
            </View>
            {mov.perfis?.nome && (
              <View style={s.movBoxRow}>
                <Text style={s.movLabel}>Executado por:</Text>
                <Text style={s.movValue}>{mov.perfis.nome}</Text>
              </View>
            )}
          </View>

          {campoLabel && (
            <View style={s.alteracaoBox}>
              <Text style={s.alteracaoLabel}>{campoLabel}</Text>
              <View style={s.alteracaoRow}>
                <Text style={s.valorAntes}>{valorAntes}</Text>
                <Text style={s.arrow}>{'→'}</Text>
                <Text style={s.valorDepois}>{valorDepois}</Text>
              </View>
            </View>
          )}

          {motivo && (
            <View style={s.motivoBox}>
              <Text style={s.motivoLabel}>Motivo</Text>
              <Text style={s.motivoText}>{motivo}</Text>
            </View>
          )}
        </View>

        {/* III. Declaração */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>III. Declaração</Text>
          <Text style={s.declaracao}>
            A DEMAX SERVIÇOS E COMÉRCIO LTDA declara, para os devidos fins, que a movimentação
            descrita neste termo foi devidamente registrada no sistema de gestão de pessoal na data
            acima indicada, sendo parte integrante do histórico funcional do(a) colaborador(a){' '}
            <Text style={{ fontFamily: 'Helvetica-Bold' }}>{func.nome.toUpperCase()}</Text>.
          </Text>
        </View>

        {/* IV. Ciência */}
        <View style={[s.section, { marginTop: 8 }]}>
          <Text style={s.sectionTitle}>IV. Ciência</Text>
          <View style={s.sigGrid}>
            <View style={s.sigBox}>
              <Text style={s.sigName}>{func.nome}</Text>
              <Text style={s.sigRole}>Colaborador(a)</Text>
            </View>
            <View style={s.sigBox}>
              <Text style={s.sigName}>{supervisorNome}</Text>
              <Text style={s.sigRole}>Supervisor(a) / Coord.</Text>
            </View>
            <View style={s.sigBoxLast}>
              <Text style={s.sigName}>Rodolfo Paulussi</Text>
              <Text style={s.sigRole}>Coordenador Operacional</Text>
            </View>
          </View>
        </View>

        {/* Rodapé */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>DEMAX Serviços e Comércio LTDA</Text>
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
  postoNomeMap: Record<string, string> = {},
  funcaoNomeMap: Record<string, string> = {},
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
  const blob = await pdf(
    <MovimentacaoDocument mov={mov} func={func} postoNomeMap={postoNomeMap} funcaoNomeMap={funcaoNomeMap} />
  ).toBlob()
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
