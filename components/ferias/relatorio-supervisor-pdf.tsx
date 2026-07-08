import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer'

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface FeriasItem {
  funcionario_nome: string
  registro: string
  cargo: string
  posto_nome: string
  secretaria: string
  data_inicio: string        // ISO string
  data_fim: string           // ISO string
  dias_direito: number
  dias_utilizados: number | null
  numero_periodo: number
  periodo_inicio: string     // ISO string
  periodo_fim: string        // ISO string
  limite_gozo: string | null // ISO string
  status: string
  observacao: string | null
}

export interface SupervisorRelatorio {
  supervisor_nome: string
  itens: FeriasItem[]
}

export interface RelatorioFeriasPDFProps {
  supervisores: SupervisorRelatorio[]
  mesAno: string             // ex: "07/2026"
  geradoEm: string           // ex: "03/06/2026 às 14:32"
  geradoPor: string          // nome do supervisor ou "Coordenação"
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso + 'T00:00:00')
    return d.toLocaleDateString('pt-BR')
  } catch {
    return '—'
  }
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    agendado:  'Agendado',
    aprovado:  'Aprovado',
    em_curso:  'Em Curso',
    concluido: 'Concluído',
    cancelado: 'Cancelado',
    disponivel:'Disponível',
  }
  return map[status] ?? status
}

// ─── Paleta ───────────────────────────────────────────────────────────────────

const C = {
  slate900: '#0f172a',
  slate700: '#334155',
  slate500: '#64748b',
  slate400: '#94a3b8',
  slate200: '#e2e8f0',
  slate100: '#f1f5f9',
  slate50:  '#f8fafc',
  amber:    '#f59e0b',
  amberBg:  '#fef3c7',
  amberText:'#92400e',
  blue:     '#1d4ed8',
  blueBg:   '#eff6ff',
  blueText: '#1e40af',
  green:    '#15803d',
  greenBg:  '#f0fdf4',
  greenText:'#166534',
  red:      '#dc2626',
  redBg:    '#fef2f2',
  redText:  '#991b1b',
  white:    '#ffffff',
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 8,
    color: C.slate900,
    backgroundColor: C.white,
    paddingTop: 0,
    paddingBottom: 28,
    paddingHorizontal: 0,
  },

  // Cabeçalho
  header: {
    backgroundColor: C.slate900,
    paddingHorizontal: 28,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoMark: {
    width: 32,
    height: 32,
    backgroundColor: C.amber,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: C.slate900,
  },
  headerCompany: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: C.white,
    letterSpacing: 0.3,
  },
  headerSub: {
    fontSize: 7,
    color: C.slate400,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  headerRightValue: {
    fontSize: 8,
    color: C.white,
    fontFamily: 'Helvetica-Bold',
  },

  // Faixa âmbar
  titleBar: {
    backgroundColor: C.amber,
    paddingHorizontal: 28,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleText: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: C.slate900,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  titleRight: {
    fontSize: 8,
    color: C.slate700,
    fontFamily: 'Helvetica-Bold',
  },

  // Info bar
  infoBar: {
    backgroundColor: C.slate100,
    paddingHorizontal: 28,
    paddingVertical: 7,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 0.5,
    borderBottomColor: C.slate200,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  infoLabel: {
    fontSize: 7,
    color: C.slate500,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  infoValue: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: C.slate700,
  },

  // Body
  body: {
    paddingHorizontal: 28,
    paddingTop: 16,
  },

  // Bloco supervisor
  supervisorBlock: {
    marginBottom: 20,
  },
  supervisorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    paddingBottom: 5,
    borderBottomWidth: 1,
    borderBottomColor: C.slate900,
  },
  supervisorName: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: C.slate900,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  supervisorCount: {
    fontSize: 7,
    color: C.slate500,
    fontFamily: 'Helvetica',
  },

  // Tabela
  table: {
    borderWidth: 0.5,
    borderColor: C.slate200,
    borderRadius: 4,
    overflow: 'hidden',
  },
  tableHead: {
    flexDirection: 'row',
    backgroundColor: C.slate100,
    borderBottomWidth: 0.5,
    borderBottomColor: C.slate200,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: C.slate200,
  },
  tableRowAlt: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: C.slate200,
    backgroundColor: C.slate50,
  },
  tableRowLast: {
    flexDirection: 'row',
  },

  th: {
    paddingVertical: 4,
    paddingHorizontal: 5,
    fontSize: 6,
    fontFamily: 'Helvetica-Bold',
    color: C.slate500,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  td: {
    paddingVertical: 4,
    paddingHorizontal: 5,
    fontSize: 7,
    color: C.slate700,
  },
  tdBold: {
    paddingVertical: 4,
    paddingHorizontal: 5,
    fontSize: 7,
    color: C.slate900,
    fontFamily: 'Helvetica-Bold',
  },

  // Colunas — landscape A4 (786pt útil após margens)
  colNome:     { width: '18%' },
  colMatricula:{ width: '6%' },
  colCargo:    { width: '17%' },
  colPosto:    { width: '20%' },
  colPeriodo:  { width: '13%' },
  colInicio:   { width: '8%' },
  colFim:      { width: '8%' },
  colDias:     { width: '4%' },
  colStatus:   { width: '6%' },

  // Badge de status
  badge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 99,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: 6,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },

  // Rodapé do bloco (totais)
  blockFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 5,
    paddingTop: 5,
    borderTopWidth: 0.5,
    borderTopColor: C.slate200,
  },
  blockFooterItem: {
    alignItems: 'center',
  },
  blockFooterLabel: {
    fontSize: 6,
    color: C.slate400,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  blockFooterValue: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: C.slate700,
  },

  // Totalizador geral
  totalBox: {
    marginHorizontal: 28,
    marginTop: 8,
    backgroundColor: C.slate900,
    borderRadius: 6,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalTitle: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: C.amber,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  totalItems: {
    flexDirection: 'row',
    gap: 20,
  },
  totalItem: {
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 6,
    color: C.slate400,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  totalValue: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: C.white,
  },
  totalValueAmber: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: C.amber,
  },

  // Footer de página
  pageFooter: {
    position: 'absolute',
    bottom: 10,
    left: 28,
    right: 28,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 0.5,
    borderTopColor: C.slate200,
    paddingTop: 5,
  },
  pageFooterText: {
    fontSize: 6.5,
    color: C.slate400,
  },

  // Alerta prazo
  alertBox: {
    marginHorizontal: 28,
    marginTop: 10,
    backgroundColor: C.amberBg,
    borderLeftWidth: 3,
    borderLeftColor: C.amber,
    borderRadius: 3,
    padding: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  alertText: {
    fontSize: 7,
    color: C.amberText,
    lineHeight: 1.5,
  },
  alertBold: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 7,
    color: C.amberText,
  },
})

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { bg: string; color: string }> = {
    aprovado:  { bg: C.greenBg,  color: C.greenText },
    agendado:  { bg: C.blueBg,   color: C.blueText  },
    em_curso:  { bg: C.amberBg,  color: C.amberText },
    concluido: { bg: C.slate100, color: C.slate500  },
    cancelado: { bg: C.redBg,    color: C.redText   },
    disponivel:{ bg: C.slate100, color: C.slate500  },
  }
  const { bg, color } = cfg[status] ?? { bg: C.slate100, color: C.slate500 }
  return (
    <View style={[s.badge, { backgroundColor: bg }]}>
      <Text style={[s.badgeText, { color }]}>{statusLabel(status)}</Text>
    </View>
  )
}

function TabelaSupervisor({ itens }: { itens: FeriasItem[] }) {
  return (
    <View style={s.table}>
      {/* Cabeçalho */}
      <View style={s.tableHead}>
        <Text style={[s.th, s.colNome]}>Funcionário</Text>
        <Text style={[s.th, s.colMatricula]}>Matr.</Text>
        <Text style={[s.th, s.colCargo]}>Cargo</Text>
        <Text style={[s.th, s.colPosto]}>Posto</Text>
        <Text style={[s.th, s.colPeriodo]}>Per. Aquisitivo</Text>
        <Text style={[s.th, s.colInicio]}>Início</Text>
        <Text style={[s.th, s.colFim]}>Retorno</Text>
        <Text style={[s.th, s.colDias]}>Dias</Text>
        <Text style={[s.th, s.colStatus]}>Status</Text>
      </View>

      {/* Linhas */}
      {itens.map((item, idx) => {
        const isLast = idx === itens.length - 1
        const isAlt  = idx % 2 !== 0
        const rowStyle = isLast ? s.tableRowLast : isAlt ? s.tableRowAlt : s.tableRow

        const periodoLabel = item.periodo_inicio && item.periodo_fim
          ? `${formatDate(item.periodo_inicio)} – ${formatDate(item.periodo_fim)}`
          : '—'

        const dias = item.dias_utilizados ?? item.dias_direito ?? '—'

        return (
          <View key={idx} style={rowStyle}>
            <Text style={[s.tdBold, s.colNome]}>{item.funcionario_nome}</Text>
            <Text style={[s.td,     s.colMatricula]}>{item.registro}</Text>
            <Text style={[s.td,     s.colCargo]}>{item.cargo}</Text>
            <Text style={[s.td,     s.colPosto]}>{item.posto_nome}</Text>
            <Text style={[s.td,     s.colPeriodo]}>{periodoLabel}</Text>
            <Text style={[s.tdBold, s.colInicio]}>{formatDate(item.data_inicio)}</Text>
            <Text style={[s.tdBold, s.colFim]}>{formatDate(item.data_fim)}</Text>
            <Text style={[s.tdBold, s.colDias, { textAlign: 'center' }]}>{String(dias)}</Text>
            <View style={[s.colStatus, { paddingVertical: 3, paddingHorizontal: 3 }]}>
              <StatusBadge status={item.status} />
            </View>
          </View>
        )
      })}
    </View>
  )
}

// ─── Documento principal ──────────────────────────────────────────────────────

function RelatorioDocument({
  supervisores,
  mesAno,
  geradoEm,
  geradoPor,
}: RelatorioFeriasPDFProps) {
  const totalFuncionarios = supervisores.reduce((acc, s) => acc + s.itens.length, 0)
  const totalAprovados    = supervisores.reduce((acc, s) => acc + s.itens.filter(i => i.status === 'aprovado').length, 0)
  const totalAgendados    = supervisores.reduce((acc, s) => acc + s.itens.filter(i => i.status === 'agendado').length, 0)
  const totalEmCurso      = supervisores.reduce((acc, s) => acc + s.itens.filter(i => i.status === 'em_curso').length, 0)

  // Alerta de prazo: se estamos nos primeiros 10 dias do mês anterior ao período
  const [mesStr, anoStr] = mesAno.split('/')
  const mesNum = parseInt(mesStr, 10)
  const anoNum = parseInt(anoStr, 10)
  const hoje   = new Date()
  const mesAnterior = new Date(anoNum, mesNum - 2, 1)
  const dia10       = new Date(anoNum, mesNum - 2, 10)
  const showAlerta  = hoje >= mesAnterior && hoje <= dia10

  return (
    <Document
      title={`Relatorio_Ferias_${mesAno.replace('/', '-')}`}
      author="Sistema de Gestão Demax"
      subject={`Férias do período ${mesAno}`}
    >
      <Page size="A4" orientation="landscape" style={s.page}>

        {/* Cabeçalho */}
        <View style={s.header}>
          <View style={s.headerLeft}>
            <View style={s.logoMark}>
              <Text style={s.logoText}>D</Text>
            </View>
            <View>
              <Text style={s.headerSub}>Contrato Municipal · Mogi das Cruzes</Text>
              <Text style={s.headerCompany}>Demax Serviços</Text>
            </View>
          </View>
          <View style={s.headerRight}>
            <Text style={s.headerSub}>Gerado em</Text>
            <Text style={s.headerRightValue}>{geradoEm}</Text>
            <Text style={[s.headerSub, { marginTop: 4 }]}>Por</Text>
            <Text style={s.headerRightValue}>{geradoPor}</Text>
          </View>
        </View>

        {/* Faixa título */}
        <View style={s.titleBar}>
          <Text style={s.titleText}>Relação de Férias — {mesAno}</Text>
          <Text style={s.titleRight}>
            {supervisores.length} supervisor{supervisores.length !== 1 ? 'es' : ''} · {totalFuncionarios} funcionário{totalFuncionarios !== 1 ? 's' : ''}
          </Text>
        </View>

        {/* Barra de info */}
        <View style={s.infoBar}>
          <View style={s.infoItem}>
            <Text style={s.infoLabel}>Período: </Text>
            <Text style={s.infoValue}>{mesAno}</Text>
          </View>
          <View style={s.infoItem}>
            <Text style={s.infoLabel}>Aprovados: </Text>
            <Text style={[s.infoValue, { color: C.green }]}>{totalAprovados}</Text>
          </View>
          <View style={s.infoItem}>
            <Text style={s.infoLabel}>Agendados (pendente aprovação): </Text>
            <Text style={[s.infoValue, { color: C.blue }]}>{totalAgendados}</Text>
          </View>
          <View style={s.infoItem}>
            <Text style={s.infoLabel}>Em curso: </Text>
            <Text style={[s.infoValue, { color: C.amberText }]}>{totalEmCurso}</Text>
          </View>
          <View style={s.infoItem}>
            <Text style={s.infoLabel}>Prazo RH: </Text>
            <Text style={[s.infoValue, { color: C.red }]}>
              Até dia 10/{String(mesNum - 1).padStart(2, '0')}/{anoNum}
            </Text>
          </View>
        </View>

        {/* Alerta de prazo */}
        {showAlerta && (
          <View style={s.alertBox}>
            <Text style={s.alertBold}>⚠ Atenção: </Text>
            <Text style={s.alertText}>
              Você está dentro do prazo de envio ao RH. Revise os registros com status{' '}
              <Text style={s.alertBold}>Agendado</Text> e aprove antes do dia 10 do mês.
            </Text>
          </View>
        )}

        {/* Blocos por supervisor */}
        <View style={s.body}>
          {supervisores.map((sup, si) => {
            const nAprovados = sup.itens.filter(i => i.status === 'aprovado').length
            const nAgendados = sup.itens.filter(i => i.status === 'agendado').length
            const nEmCurso   = sup.itens.filter(i => i.status === 'em_curso').length

            return (
              <View key={si} style={s.supervisorBlock}>
                <View style={s.supervisorHeader}>
                  <Text style={s.supervisorName}>Supervisor: {sup.supervisor_nome}</Text>
                  <Text style={s.supervisorCount}>
                    {sup.itens.length} funcionário{sup.itens.length !== 1 ? 's' : ''}
                  </Text>
                </View>

                <TabelaSupervisor itens={sup.itens} />

                <View style={s.blockFooter}>
                  {nAprovados > 0 && (
                    <View style={s.blockFooterItem}>
                      <Text style={s.blockFooterLabel}>Aprovados</Text>
                      <Text style={[s.blockFooterValue, { color: C.green }]}>{nAprovados}</Text>
                    </View>
                  )}
                  {nAgendados > 0 && (
                    <View style={s.blockFooterItem}>
                      <Text style={s.blockFooterLabel}>Agendados</Text>
                      <Text style={[s.blockFooterValue, { color: C.blue }]}>{nAgendados}</Text>
                    </View>
                  )}
                  {nEmCurso > 0 && (
                    <View style={s.blockFooterItem}>
                      <Text style={s.blockFooterLabel}>Em curso</Text>
                      <Text style={[s.blockFooterValue, { color: C.amberText }]}>{nEmCurso}</Text>
                    </View>
                  )}
                </View>
              </View>
            )
          })}
        </View>

        {/* Totalizador geral */}
        <View style={s.totalBox} wrap={false}>
          <Text style={s.totalTitle}>Resumo Geral — {mesAno}</Text>
          <View style={s.totalItems}>
            <View style={s.totalItem}>
              <Text style={s.totalLabel}>Total</Text>
              <Text style={s.totalValueAmber}>{totalFuncionarios}</Text>
            </View>
            <View style={s.totalItem}>
              <Text style={s.totalLabel}>Aprovados</Text>
              <Text style={s.totalValue}>{totalAprovados}</Text>
            </View>
            <View style={s.totalItem}>
              <Text style={s.totalLabel}>Agendados</Text>
              <Text style={s.totalValue}>{totalAgendados}</Text>
            </View>
            <View style={s.totalItem}>
              <Text style={s.totalLabel}>Em Curso</Text>
              <Text style={s.totalValue}>{totalEmCurso}</Text>
            </View>
          </View>
        </View>

        {/* Rodapé de página */}
        <View style={s.pageFooter} fixed>
          <Text style={s.pageFooterText}>
            Sistema de Gestão Demax · demax-gestao.vercel.app
          </Text>
          <Text
            style={s.pageFooterText}
            render={({ pageNumber, totalPages }) =>
              `Página ${pageNumber} de ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  )
}

// ─── Função de download (client-side) ────────────────────────────────────────

export async function downloadRelatorioFerias(props: RelatorioFeriasPDFProps) {
  const { pdf } = await import('@react-pdf/renderer')
  const blob     = await pdf(<RelatorioDocument {...props} />).toBlob()
  const url      = URL.createObjectURL(blob)
  const a        = document.createElement('a')
  a.href         = url
  a.download     = `Relatorio_Ferias_${props.mesAno.replace('/', '-')}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}

export default RelatorioDocument