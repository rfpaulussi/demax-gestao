'use client'

import { Document, Page, Text, View, StyleSheet, pdf } from '@react-pdf/renderer'
import type { InsalubridadeGrupo, InsalubridadeCobertura } from '@/app/(admin)/insalubridade/actions'

const MESES_EXT = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro']

function fmtMesAno(mes: number, ano: number): string {
  return `${String(mes).padStart(2,'0')}/${ano}`
}

function fmtDataExtenso(date: Date): string {
  return `${date.getDate()} de ${MESES_EXT[date.getMonth()]} de ${date.getFullYear()}`
}

function fmtData(iso: string | null): string {
  if (!iso) return '—'
  const [y,m,d] = iso.split('T')[0].split('-')
  return `${d}/${m}/${y}`
}

interface Periodo {
  inicio: string
  fim: string
  count: number
  agente: string
}

function agruparPeriodos(registros: InsalubridadeCobertura[]): Periodo[] {
  const sorted = [...registros].sort((a,b) =>
    (a.data_cobertura ?? '').localeCompare(b.data_cobertura ?? '')
  )

  const groups: Periodo[] = []
  if (sorted.length === 0) return groups

  let startDate = sorted[0].data_cobertura
  let endDate   = sorted[0].data_cobertura
  let agente    = sorted[0].agente_ausente_nome ?? '—'
  let count     = 1

  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date((endDate ?? '') + 'T12:00:00')
    const curr = new Date((sorted[i].data_cobertura ?? '') + 'T12:00:00')
    const diffDays = Math.round((curr.getTime() - prev.getTime()) / 86400000)
    const sameAgent = (sorted[i].agente_ausente_nome ?? '—') === agente

    if (diffDays === 1 && sameAgent) {
      endDate = sorted[i].data_cobertura
      count++
    } else {
      groups.push({ inicio: startDate ?? '', fim: endDate ?? '', count, agente })
      startDate = sorted[i].data_cobertura
      endDate   = sorted[i].data_cobertura
      agente    = sorted[i].agente_ausente_nome ?? '—'
      count     = 1
    }
  }
  groups.push({ inicio: startDate ?? '', fim: endDate ?? '', count, agente })
  return groups
}

const s = StyleSheet.create({
  page:      { fontFamily: 'Helvetica', fontSize: 10, padding: 48, color: '#111827', lineHeight: 1.5 },
  header:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20, paddingBottom: 10, borderBottomWidth: 2, borderBottomColor: '#111827' },
  logo:      { fontSize: 22, fontFamily: 'Helvetica-Bold', letterSpacing: 3 },
  subtitle:  { fontSize: 8, color: '#6b7280', marginTop: 2 },
  docTitle:  { textAlign: 'center', fontSize: 11, fontFamily: 'Helvetica-Bold', letterSpacing: 0.5, marginBottom: 18, borderWidth: 1, borderColor: '#111827', paddingVertical: 7, paddingHorizontal: 10 },
  body:      { fontSize: 10, lineHeight: 1.7, marginBottom: 14, textAlign: 'justify' },
  bold:      { fontFamily: 'Helvetica-Bold' },
  periodo:   { marginBottom: 4 },
  apuracaoBox: { borderWidth: 1, borderColor: '#d1d5db', padding: 10, marginVertical: 12, backgroundColor: '#f9fafb' },
  apTtl:     { fontSize: 9, fontFamily: 'Helvetica-Bold', letterSpacing: 0.5, marginBottom: 6, color: '#374151' },
  apRow:     { flexDirection: 'row', marginBottom: 2 },
  apLbl:     { width: 200, fontSize: 9, color: '#4b5563' },
  apVal:     { fontSize: 9, fontFamily: 'Helvetica-Bold' },
  legal:     { fontSize: 9, lineHeight: 1.7, color: '#4b5563', textAlign: 'justify', marginBottom: 14 },
  footer:    { marginTop: 20, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  sigBox:    { marginTop: 20, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#d1d5db' },
  sigTtl:    { fontSize: 8, fontFamily: 'Helvetica-Bold', letterSpacing: 0.5, marginBottom: 8, color: '#374151' },
  sigRow:    { flexDirection: 'row', marginBottom: 3 },
  sigLbl:    { width: 70, fontSize: 9, color: '#4b5563' },
  sigVal:    { fontSize: 9 },
  sigLine:   { borderBottomWidth: 1, borderBottomColor: '#9ca3af', width: 200, marginTop: 2 },
})

function DeclaracaoDocument({ grupo, mes, ano }: { grupo: InsalubridadeGrupo; mes: number; ano: number }) {
  const mesAno = fmtMesAno(mes, ano)
  const hoje   = new Date()
  const periodos = agruparPeriodos(grupo.registros)

  return (
    <Document>
      <Page size="A4" style={s.page}>

        {/* Cabeçalho */}
        <View style={s.header}>
          <View>
            <Text style={s.logo}>DEMAX</Text>
            <Text style={s.subtitle}>Serviços e Comércio Ltda.</Text>
          </View>
          <Text style={{ fontSize: 9, color: '#6b7280' }}>Declaração — {mesAno}</Text>
        </View>

        {/* Título */}
        <Text style={s.docTitle}>
          DECLARAÇÃO DE COBERTURA INSALUBRE — {mesAno}
        </Text>

        {/* Corpo */}
        <Text style={s.body}>
          A <Text style={s.bold}>DEMAX SERVIÇOS E COMÉRCIO LTDA</Text>, inscrita no CNPJ nº{' '}
          <Text style={s.bold}>48.096.044/0001-93</Text>, por meio desta, declara para os devidos fins
          que o(a) colaborador(a){' '}
          <Text style={s.bold}>{grupo.funcionario_nome.toUpperCase()}</Text>,
          atualmente na função de{' '}
          <Text style={s.bold}>{(grupo.funcao ?? 'Ajudante de Limpeza').toUpperCase()}</Text> e
          alocado(a) no posto{' '}
          <Text style={s.bold}>{(grupo.posto_nome ?? '—').toUpperCase()}</Text>, realizou{' '}
          <Text style={s.bold}>coberturas pontuais</Text> da função de{' '}
          <Text style={s.bold}>Agente de Higienização</Text> nos períodos abaixo relacionados,
          conforme registros internos:
        </Text>

        {/* Lista de períodos */}
        <View style={{ marginBottom: 12 }}>
          {periodos.map((p, i) => (
            <Text key={i} style={s.periodo}>
              {'  '}• {fmtData(p.inicio)}{p.inicio !== p.fim ? ` a ${fmtData(p.fim)}` : ''}{' '}
              ({p.count} dia{p.count !== 1 ? 's' : ''}) — Agente ausente:{' '}
              <Text style={s.bold}>{p.agente}</Text>
            </Text>
          ))}
        </View>

        {/* Apuração */}
        <View style={s.apuracaoBox}>
          <Text style={s.apTtl}>APURAÇÃO DO ADICIONAL — {mesAno}</Text>
          <View style={s.apRow}>
            <Text style={s.apLbl}>Total de dias cobertos:</Text>
            <Text style={s.apVal}>{grupo.total_dias} dia{grupo.total_dias !== 1 ? 's' : ''}</Text>
          </View>
          <View style={s.apRow}>
            <Text style={s.apLbl}>Percentual aplicável por dia coberto:</Text>
            <Text style={s.apVal}>40% INS.</Text>
          </View>
        </View>

        {/* Parágrafo legal */}
        <Text style={s.legal}>
          Declara a empresa que o(a) colaborador(a) acima identificado(a) realizou, nos períodos
          relacionados, cobertura pontual e eventual de função de Agente de Higienização, com adicional
          de insalubridade em grau máximo (40%), conforme CLT e NR-15.{'\n'}
          A presente declaração tem por finalidade resguardar a empresa quanto à comprovação de
          atividade insalubre exercida pelo(a) colaborador(a) em caráter de substituição/cobertura,
          para fins de auditoria e controles internos.
        </Text>

        {/* Rodapé */}
        <View style={s.footer}>
          <Text style={{ fontSize: 9, marginBottom: 6 }}>
            Local e data: Mogi das Cruzes,{' '}
            <Text style={s.bold}>{fmtDataExtenso(hoje)}</Text>
          </Text>
          <Text style={{ fontSize: 9 }}>Nome: <Text style={s.bold}>Rodolfo Paulussi</Text></Text>
          <Text style={{ fontSize: 9 }}>Cargo: <Text style={s.bold}>Coordenador Operacional</Text></Text>
        </View>

        {/* Ciência do colaborador */}
        <View style={s.sigBox}>
          <Text style={s.sigTtl}>CIÊNCIA DO COLABORADOR</Text>
          <View style={s.sigRow}>
            <Text style={s.sigLbl}>Nome:</Text>
            <Text style={s.sigVal}>{grupo.funcionario_nome.toUpperCase()}</Text>
          </View>
          <View style={[s.sigRow, { marginTop: 12 }]}>
            <Text style={s.sigLbl}>Assinatura:</Text>
            <View style={s.sigLine} />
          </View>
        </View>

      </Page>
    </Document>
  )
}

export async function downloadDeclaracaoPDF(
  grupo: InsalubridadeGrupo,
  mes: number,
  ano: number
): Promise<void> {
  const nome = grupo.funcionario_nome
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '_')
    .toUpperCase()
  const mesAno = `${String(mes).padStart(2,'0')}-${ano}`
  const filename = `Declaracao_Insalubridade_${nome}_${mesAno}.pdf`

  const blob = await pdf(<DeclaracaoDocument grupo={grupo} mes={mes} ano={ano} />).toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
