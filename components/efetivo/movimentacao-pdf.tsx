import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { TermoData } from '@/lib/termos/tipos'
import { COR_TIPO } from '@/lib/termos/montar-termo'

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

// ─── Styles ───────────────────────────────────────────────────────────────────

const BRAND = '#1e293b'

const s = StyleSheet.create({
  page:         { fontFamily: 'Helvetica', fontSize: 9, paddingTop: 36, paddingHorizontal: 40, paddingBottom: 56, color: '#111827', backgroundColor: '#ffffff' },
  headerRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10, paddingBottom: 8, borderBottomWidth: 2 },
  companyName:  { fontSize: 20, fontFamily: 'Helvetica-Bold', letterSpacing: 4, color: BRAND },
  companySub:   { fontSize: 8, color: '#94a3b8', marginTop: 2 },
  regBlock:     { alignItems: 'flex-end' },
  regLabel:     { fontSize: 7, color: '#94a3b8', letterSpacing: 1.5 },
  regValue:     { fontSize: 12, fontFamily: 'Helvetica-Bold', color: BRAND },
  docTitle:     { textAlign: 'center', fontSize: 11, fontFamily: 'Helvetica-Bold', letterSpacing: 1.5, marginBottom: 10, borderWidth: 1.5, paddingVertical: 7, paddingHorizontal: 10 },
  section:      { marginBottom: 9 },
  sectionTitle: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', letterSpacing: 1.2, color: '#475569', marginBottom: 5, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  grid:         { flexDirection: 'row', flexWrap: 'wrap' },
  gridCell:     { width: '50%', flexDirection: 'row', marginBottom: 3 },
  label:        { width: 78, fontFamily: 'Helvetica-Bold', color: '#374151' },
  value:        { flex: 1, color: '#1f2937' },
  tHead:        { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#cbd5e1' },
  tRow:         { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#e2e8f0', minHeight: 20 },
  cItem:        { width: '20%', padding: 4, fontFamily: 'Helvetica-Bold', color: '#475569' },
  cOrig:        { width: '40%', padding: 4, backgroundColor: '#f1f5f9', color: '#64748b' },
  cDest:        { width: '40%', padding: 4, backgroundColor: '#ecfdf5', color: '#0f172a' },
  thText:       { fontSize: 7.5, fontFamily: 'Helvetica-Bold', letterSpacing: 1 },
  semAlt:       { fontSize: 6.5, color: '#94a3b8', marginTop: 1 },
  cards:        { flexDirection: 'row' },
  card:         { flex: 1, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#f8fafc', padding: 5, marginRight: 5 },
  cardLast:     { flex: 1, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#f8fafc', padding: 5 },
  cardLabel:    { fontSize: 6.5, color: '#64748b', letterSpacing: 1, marginBottom: 2 },
  cardValue:    { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: '#1f2937' },
  cardSub:      { fontSize: 7, color: '#64748b', marginTop: 1 },
  motivoBox:    { padding: 6, backgroundColor: '#fffbeb', borderLeftWidth: 2, borderLeftColor: '#f59e0b' },
  motivoText:   { fontSize: 9, color: '#78350f' },
  declaracao:   { fontSize: 9, lineHeight: 1.5, color: '#4b5563', textAlign: 'justify' },
  sigGrid:      { flexDirection: 'row', marginTop: 24 },
  sigBox:       { flex: 1, borderTopWidth: 1, borderTopColor: '#94a3b8', paddingTop: 4, marginRight: 14 },
  sigBoxLast:   { flex: 1, borderTopWidth: 1, borderTopColor: '#94a3b8', paddingTop: 4 },
  sigName:      { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#1f2937' },
  sigRole:      { fontSize: 7, color: '#94a3b8', marginTop: 1 },
  aprovado:     { marginTop: 10, padding: 6, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0' },
  aprovadoText: { fontSize: 8.5, color: '#1f2937' },
  protocolo:    { marginTop: 4, padding: 8, borderWidth: 1, borderColor: '#94a3b8', borderStyle: 'dashed', backgroundColor: '#f8fafc' },
  protTitle:    { fontSize: 7.5, fontFamily: 'Helvetica-Bold', letterSpacing: 1.2, color: '#475569', marginBottom: 8 },
  protText:     { fontSize: 8.5, color: '#374151' },
  footer:       { position: 'absolute', bottom: 20, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 5 },
  footerText:   { fontSize: 7, color: '#94a3b8' },
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(iso: string | null): string {
  if (!iso) return '—'
  const d = iso.split('T')[0].split('-')
  return `${d[2]}/${d[1]}/${d[0]}`
}

function fmtDataHora(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return fmt(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`
}

function Linhas({ texto, style }: { texto: string; style?: { fontFamily?: string; color?: string } }) {
  const partes = (texto || '—').split('\n')
  return (
    <>
      {partes.map((l, i) => (
        <Text key={i} style={style}>{l}</Text>
      ))}
    </>
  )
}

// ─── Document ─────────────────────────────────────────────────────────────────

function TermoDocument({ termo }: { termo: TermoData }) {
  const cor = COR_TIPO[termo.tipo]
  const c = termo.colaborador
  const efet = fmt(termo.efetivacao)
  const emitido = fmtDataHora(termo.emitidoEm)
  const mostrarDestino =
    termo.tipo === 'transferencia' &&
    !!termo.supervisorDestino &&
    termo.supervisorDestino !== termo.solicitadoPor

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Cabeçalho */}
        <View style={[s.headerRow, { borderBottomColor: cor.hex }]}>
          <View>
            <Text style={s.companyName}>DEMAX</Text>
            <Text style={s.companySub}>Serviços e Comércio LTDA</Text>
          </View>
          <View style={s.regBlock}>
            <Text style={s.regLabel}>REGISTRO</Text>
            <Text style={s.regValue}>{termo.codigo}</Text>
          </View>
        </View>

        {/* Título */}
        <Text style={[s.docTitle, { borderColor: cor.hex, backgroundColor: cor.fundo, color: cor.hex }]}>
          {termo.titulo}
        </Text>

        {/* I. Colaborador */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>I. COLABORADOR</Text>
          <View style={s.grid}>
            <View style={s.gridCell}><Text style={s.label}>Nome:</Text><Text style={s.value}>{c.nome}</Text></View>
            <View style={s.gridCell}><Text style={s.label}>RE:</Text><Text style={s.value}>{c.registro ?? '—'}</Text></View>
            <View style={s.gridCell}><Text style={s.label}>Função atual:</Text><Text style={s.value}>{c.funcao ?? '—'}</Text></View>
            <View style={s.gridCell}><Text style={s.label}>CPF:</Text><Text style={s.value}>***.***.***-**</Text></View>
            <View style={s.gridCell}><Text style={s.label}>Admissão:</Text><Text style={s.value}>{fmt(c.admissao)}</Text></View>
          </View>
        </View>

        {/* II. Alterações */}
        <View style={s.section} wrap={false}>
          <Text style={s.sectionTitle}>II. ALTERAÇÕES (ORIGEM E DESTINO)</Text>
          <View style={s.tHead}>
            <View style={s.cItem}><Text style={s.thText}>ITEM</Text></View>
            <View style={[s.cOrig, { color: '#475569' }]}><Text style={[s.thText, { color: '#475569' }]}>ORIGEM</Text></View>
            <View style={s.cDest}><Text style={[s.thText, { color: '#047857' }]}>DESTINO</Text></View>
          </View>
          {termo.diffs.map((d, i) => (
            <View
              key={i}
              style={[
                s.tRow,
                d.mudou ? { backgroundColor: '#fffbeb', borderLeftWidth: 3, borderLeftColor: cor.hex } : {},
              ]}
            >
              <View style={s.cItem}><Text>{d.rotulo}</Text></View>
              <View style={s.cOrig}><Linhas texto={d.antes} /></View>
              <View style={s.cDest}>
                {d.mudou ? (
                  <Linhas texto={d.depois} style={{ fontFamily: 'Helvetica-Bold' }} />
                ) : (
                  <>
                    <Linhas texto={d.depois} style={{ color: '#6b7280' }} />
                    <Text style={s.semAlt}>sem alteração</Text>
                  </>
                )}
              </View>
            </View>
          ))}
        </View>

        {/* III. Efetivação e trâmite */}
        <View style={s.section} wrap={false}>
          <Text style={s.sectionTitle}>III. EFETIVAÇÃO E TRÂMITE</Text>
          <View style={s.cards}>
            <View style={s.card}>
              <Text style={s.cardLabel}>EFETIVAÇÃO</Text>
              <Text style={s.cardValue}>{efet}</Text>
            </View>
            <View style={s.card}>
              <Text style={s.cardLabel}>SOLICITADO POR</Text>
              <Text style={s.cardValue}>{termo.solicitadoPor ?? '—'}</Text>
              <Text style={s.cardSub}>{fmtDataHora(termo.solicitadoEm)}</Text>
            </View>
            <View style={s.card}>
              <Text style={s.cardLabel}>APROVADO POR</Text>
              <Text style={s.cardValue}>{termo.aprovadoPor ?? '—'}</Text>
              <Text style={s.cardSub}>{fmtDataHora(termo.aprovadoEm)}</Text>
            </View>
            <View style={s.cardLast}>
              <Text style={s.cardLabel}>EMITIDO EM</Text>
              <Text style={s.cardValue}>{emitido}</Text>
            </View>
          </View>
        </View>

        {/* IV. Motivo */}
        {termo.motivo ? (
          <View style={s.section} wrap={false}>
            <Text style={s.sectionTitle}>IV. MOTIVO</Text>
            <View style={s.motivoBox}>
              <Text style={s.motivoText}>{termo.motivo}</Text>
            </View>
          </View>
        ) : null}

        {/* V. Declaração */}
        <View style={s.section} wrap={false}>
          <Text style={s.sectionTitle}>{termo.motivo ? 'V.' : 'IV.'} DECLARAÇÃO</Text>
          <Text style={s.declaracao}>
            A DEMAX SERVIÇOS E COMÉRCIO LTDA comunica ao Departamento de Recursos Humanos que o(a) colaborador(a){' '}
            <Text style={{ fontFamily: 'Helvetica-Bold' }}>{c.nome.toUpperCase()}</Text> teve as alterações acima
            registradas, com efeito a partir de <Text style={{ fontFamily: 'Helvetica-Bold' }}>{efet}</Text>.
            Solicita-se a atualização do cadastro funcional, controle de ponto, benefícios e demais registros
            pertinentes, conforme aplicável.
          </Text>
        </View>

        {/* Assinaturas + protocolo */}
        <View wrap={false}>
          <Text style={s.sectionTitle}>{termo.motivo ? 'VI.' : 'V.'} ASSINATURAS</Text>
          <View style={s.sigGrid}>
            <View style={s.sigBox}>
              <Text style={s.sigName}>{c.nome}</Text>
              <Text style={s.sigRole}>Colaborador(a)</Text>
            </View>
            <View style={mostrarDestino ? s.sigBox : s.sigBoxLast}>
              <Text style={s.sigName}>{termo.solicitadoPor ?? '—'}</Text>
              <Text style={s.sigRole}>Supervisor(a) solicitante</Text>
            </View>
            {mostrarDestino && (
              <View style={s.sigBoxLast}>
                <Text style={s.sigName}>{termo.supervisorDestino}</Text>
                <Text style={s.sigRole}>Supervisor(a) de destino</Text>
              </View>
            )}
          </View>

          <View style={s.aprovado}>
            <Text style={s.aprovadoText}>
              <Text style={{ fontFamily: 'Helvetica-Bold' }}>APROVADO POR: </Text>
              {termo.aprovadoPor ?? '—'} — Coordenação/Administração · {fmtDataHora(termo.aprovadoEm)}
            </Text>
          </View>

          <View style={{ marginTop: 10 }}>
            <View style={s.protocolo}>
              <Text style={s.protTitle}>PROTOCOLO RH</Text>
              <Text style={s.protText}>
                Recebido em ___/___/______  ·  Nome do recebedor: ______________________________  ·  Carimbo / assinatura RH
              </Text>
            </View>
          </View>
        </View>

        {/* Rodapé */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>DEMAX Serviços e Comércio LTDA</Text>
          <Text style={s.footerText}>{termo.codigo} · Emitido em {emitido}</Text>
          <Text
            style={s.footerText}
            render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  )
}

// ─── Download ─────────────────────────────────────────────────────────────────

export async function downloadTermoPDF(termo: TermoData): Promise<void> {
  const nomeSlug = termo.colaborador.nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '_')
    .toUpperCase()
  const dataSlug = (termo.efetivacao ?? termo.emitidoEm).split('T')[0].replace(/-/g, '')
  const filename = `MOV_${termo.codigo.replace(/^MOV-/, '')}_${nomeSlug}_${dataSlug}.pdf`

  const { pdf } = await import('@react-pdf/renderer')
  const blob = await pdf(<TermoDocument termo={termo} />).toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// Exportado para testes de geração de PDF em Node
export { TermoDocument }
