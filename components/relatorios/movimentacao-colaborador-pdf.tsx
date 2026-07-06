import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

const CONTRATO_NOME = 'MOGI LIMPEZA - 706'
const PADRAO = 'Padrão para a função'

// Mapeamento função → setor (normalizado NFC uppercase)
const SETOR_POR_FUNCAO: Record<string, string> = {
  'AGENTE DE HIGIENIZAÇÃO A': '45',
  'AGENTE DE HIGIENIZAÇÃO B': '66',
  'AGENTE DE HIGIENIZAÇÃO C': '67',
  'AJUDANTE DE LIMPEZA':      '1',
  'AUXILIAR ADMINISTRATIVO':  '12',
  'ENCARREGADO (A)':          '12',
  'JOVEM APRENDIZ':           '1',
  'LÍDER DE LIMPEZA':         '12',
  'LIMPADOR DE VIDROS':       '14',
  'SUPERVISOR (A) DE SERVIÇOS': '12',
}

function setor(funcao: string): string {
  const key = funcao.normalize('NFC').trim().toUpperCase()
  return SETOR_POR_FUNCAO[key] ?? '—'
}

function fmtSalario(v: number | null): string {
  if (v === null || v === undefined) return '—'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

function fmtInsalubridade(perc: number | null): string {
  if (perc === null || perc === undefined || perc === 0) return 'Não'
  return `Sim — ${perc}%`
}

export interface MovColaboradorData {
  registro: string | null
  nome: string
  supervisor: string
  funcao_anterior: string
  funcao_nova: string
  posto: string
  vigencia: string
  tipo_solicitacao: string | null
  motivo: string | null
  salario_anterior: number | null
  salario_nova: number | null
  escala: string | null
  insalubridade_anterior_perc: number | null
  insalubridade_nova_perc: number | null
}

const c = {
  amberBg:  '#fef3c7',
  greenBg:  '#d1fae5',
  border:   '#d1d5db',
  label:    '#6b7280',
  black:    '#111827',
  gray:     '#374151',
}

const s = StyleSheet.create({
  page:         { padding: 32, fontSize: 8, fontFamily: 'Helvetica', backgroundColor: '#ffffff' },

  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  logoMain:     { fontSize: 22, fontFamily: 'Helvetica-Bold', color: c.black },
  logoSub:      { fontSize: 7, color: c.label, marginTop: 2 },
  titleRight:   { alignItems: 'flex-end' },
  titleMain:    { fontSize: 11, fontFamily: 'Helvetica-Bold', color: c.black, marginBottom: 5 },

  checks:       { flexDirection: 'row' },
  checkItem:    { flexDirection: 'row', alignItems: 'center', marginRight: 14 },
  checkBox:        { width: 10, height: 10, borderWidth: 1, borderColor: c.gray, marginRight: 4 },
  checkBoxFilled:  { width: 10, height: 10, borderWidth: 1, borderColor: c.black, backgroundColor: c.black, marginRight: 4 },
  checkText:    { fontSize: 7, color: c.black },

  vigRow:       { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 4 },
  vigText:      { fontSize: 7, fontFamily: 'Helvetica-Bold', color: c.black },

  divider:      { borderBottomWidth: 1.5, borderBottomColor: c.black, marginBottom: 8, marginTop: 6 },

  empBar:       { flexDirection: 'row', borderWidth: 1, borderColor: c.border, paddingVertical: 5, paddingHorizontal: 8, marginBottom: 8, backgroundColor: '#f9fafb' },
  empItem:      { marginRight: 20 },
  empLabel:     { fontSize: 6, color: c.label, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  empValue:     { fontSize: 8, fontFamily: 'Helvetica-Bold', color: c.black },

  tableHeader:  { flexDirection: 'row' },
  colHdrLeft:   { flex: 1, backgroundColor: c.amberBg, paddingVertical: 5, paddingHorizontal: 8, marginRight: 1, borderTopWidth: 1, borderLeftWidth: 1, borderTopColor: c.border, borderLeftColor: c.border },
  colHdrRight:  { flex: 1, backgroundColor: c.greenBg, paddingVertical: 5, paddingHorizontal: 8, borderTopWidth: 1, borderRightWidth: 1, borderTopColor: c.border, borderRightColor: c.border },
  colHdrText:   { fontSize: 8, fontFamily: 'Helvetica-Bold', color: c.black, textAlign: 'center' },

  dataRow:      { flexDirection: 'row' },
  cellLeft:     { flex: 1, paddingVertical: 4, paddingHorizontal: 8, borderLeftWidth: 1, borderBottomWidth: 0.5, borderRightWidth: 0.5, borderColor: c.border },
  cellRight:    { flex: 1, paddingVertical: 4, paddingHorizontal: 8, borderRightWidth: 1, borderBottomWidth: 0.5, borderColor: c.border },
  cellLabel:    { fontSize: 6, color: c.label, fontFamily: 'Helvetica-Bold', marginBottom: 1 },
  cellValue:    { fontSize: 8, color: c.black },
  cellBold:     { fontSize: 8, fontFamily: 'Helvetica-Bold', color: c.black },

  obsCell:      { borderLeftWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderColor: c.border, paddingVertical: 4, paddingHorizontal: 8, minHeight: 36 },

  sigSection:   { flexDirection: 'row', marginTop: 20 },
  sigItem:      { flex: 1, alignItems: 'center', paddingHorizontal: 4 },
  sigLine:      { borderTopWidth: 0.5, borderTopColor: c.gray, width: '100%', marginBottom: 3 },
  sigLabel:     { fontSize: 6, color: c.label, textAlign: 'center' },

  footnote:     { marginTop: 8, fontSize: 6, color: c.label, fontFamily: 'Helvetica-Oblique' },

  footer:       { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, paddingTop: 6, borderTopWidth: 0.5, borderTopColor: c.border },
  footerText:   { fontSize: 6, color: c.label },
})

function Checkbox({ checked, label }: { checked: boolean; label: string }) {
  return (
    <View style={s.checkItem}>
      <View style={checked ? s.checkBoxFilled : s.checkBox} />
      <Text style={s.checkText}>{label}</Text>
    </View>
  )
}

function Row({
  label, antes, depois, bold,
}: { label: string; antes: string; depois: string; bold?: boolean }) {
  return (
    <View style={s.dataRow}>
      <View style={s.cellLeft}>
        <Text style={s.cellLabel}>{label}</Text>
        <Text style={bold ? s.cellBold : s.cellValue}>{antes}</Text>
      </View>
      <View style={s.cellRight}>
        <Text style={s.cellLabel}>{label}</Text>
        <Text style={bold ? s.cellBold : s.cellValue}>{depois}</Text>
      </View>
    </View>
  )
}

export function MovimentacaoColaboradorDoc({
  registro, nome, supervisor,
  funcao_anterior, funcao_nova,
  posto, vigencia, tipo_solicitacao, motivo,
  salario_anterior, salario_nova, escala,
  insalubridade_anterior_perc, insalubridade_nova_perc,
}: MovColaboradorData) {
  const isTrans   = tipo_solicitacao === 'transferencia'
  const isProm    = tipo_solicitacao === 'promocao'
  const isMudFunc = !isTrans && !isProm

  const emitidoEm     = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  const salarioAntFmt = fmtSalario(salario_anterior)
  const salarioNovFmt = fmtSalario(salario_nova)
  const escalaTxt     = escala ?? '—'

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.logoMain}>DEMAX</Text>
            <Text style={s.logoSub}>Serviços e Comércio LTDA</Text>
          </View>
          <View style={s.titleRight}>
            <Text style={s.titleMain}>MOVIMENTAÇÃO DE COLABORADOR</Text>
            <View style={s.checks}>
              <Checkbox checked={isTrans}   label="Transferência" />
              <Checkbox checked={isMudFunc} label="Mudança de Função" />
              <Checkbox checked={isProm}    label="Promoção" />
            </View>
            <View style={s.vigRow}>
              <Text style={s.vigText}>VIGÊNCIA: {vigencia}</Text>
            </View>
          </View>
        </View>

        <View style={s.divider} />

        {/* Employee bar */}
        <View style={s.empBar}>
          <View style={s.empItem}>
            <Text style={s.empLabel}>Nº REGISTRO</Text>
            <Text style={s.empValue}>{registro ?? '—'}</Text>
          </View>
          <View style={[s.empItem, { flex: 1 }]}>
            <Text style={s.empLabel}>COLABORADOR</Text>
            <Text style={s.empValue}>{nome}</Text>
          </View>
          <View style={s.empItem}>
            <Text style={s.empLabel}>CPF</Text>
            <Text style={s.empValue}>***.***.***-**</Text>
          </View>
        </View>

        {/* Column headers */}
        <View style={s.tableHeader}>
          <View style={s.colHdrLeft}>
            <Text style={s.colHdrText}>SITUAÇÃO ATUAL</Text>
          </View>
          <View style={s.colHdrRight}>
            <Text style={s.colHdrText}>SITUAÇÃO PROPOSTA</Text>
          </View>
        </View>

        <Row label="CONTRATO"           antes={CONTRATO_NOME}                        depois={CONTRATO_NOME}                    />
        <Row label="SUPERVISOR / COORD." antes={supervisor}                           depois={supervisor}                       />
        <Row label="FUNÇÃO"             antes={funcao_anterior}                      depois={funcao_nova}                      bold />
        <Row label="SETOR"              antes={setor(funcao_anterior)}               depois={setor(funcao_nova)}               />
        <Row label="SALÁRIO"            antes={salarioAntFmt}                        depois={salarioNovFmt}                    />
        <Row label="ESCALA"             antes={escalaTxt}                            depois={escalaTxt}                        />
        <Row label="HORÁRIO"            antes="* Ver observação"                     depois="* Ver observação"                 />
        <Row label="LOCAL"              antes={posto}                                depois={posto}                            />
        <Row label="INSALUBRIDADE"      antes={fmtInsalubridade(insalubridade_anterior_perc)} depois={fmtInsalubridade(insalubridade_nova_perc)} />
        <Row label="VALE TRANSPORTE"    antes={PADRAO}                               depois={PADRAO}                           />
        <Row label="VALE REFEIÇÃO"      antes={PADRAO}                               depois={PADRAO}                           />
        <Row label="VALE ALIMENTAÇÃO"   antes={PADRAO}                               depois={PADRAO}                           />
        <Row label="PRÊMIO"             antes={PADRAO}                               depois={PADRAO}                           />
        <Row label="SINDICATO"          antes={PADRAO}                               depois={PADRAO}                           />

        {/* Observações */}
        <View style={s.obsCell}>
          <Text style={s.cellLabel}>OBSERVAÇÕES</Text>
          {motivo ? <Text style={s.cellValue}>{motivo}</Text> : null}
        </View>

        {/* Signatures */}
        <View style={s.sigSection}>
          {['COORD. / SUPERVISOR', 'SEGURANÇA DO TRABALHO', 'GERENTE OPERACIONAL', 'COORDENADOR RH'].map(lbl => (
            <View key={lbl} style={s.sigItem}>
              <View style={s.sigLine} />
              <Text style={s.sigLabel}>{lbl}</Text>
            </View>
          ))}
        </View>

        {/* Footnote */}
        <Text style={s.footnote}>
          * HORÁRIO: conforme escala vigente no sistema Ginfor até que haja alteração formal.
        </Text>

        {/* Footer */}
        <View style={s.footer}>
          <Text style={s.footerText}>DEMAX Serviços e Comércio LTDA</Text>
          <Text style={s.footerText}>Emitido em {emitidoEm}</Text>
        </View>
      </Page>
    </Document>
  )
}
