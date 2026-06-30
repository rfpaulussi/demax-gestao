'use client'

import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { AcordoCompensacao } from '@/app/(admin)/acordos/actions'

const MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro']

function fmtDataExtenso(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${parseInt(d)} de ${MESES[parseInt(m) - 1]} de ${y}`
}

const s = StyleSheet.create({
  page:         { fontFamily: 'Helvetica', fontSize: 10, paddingHorizontal: 50, paddingVertical: 40, lineHeight: 1.5 },
  title:        { fontSize: 13, fontFamily: 'Helvetica-Bold', textAlign: 'center', marginBottom: 16 },
  para:         { marginBottom: 10, textAlign: 'justify' },
  bold:         { fontFamily: 'Helvetica-Bold' },
  tableWrap:    { marginVertical: 6, borderWidth: 1, borderColor: '#000' },
  tableRow:     { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#000' },
  tableRowLast: { flexDirection: 'row' },
  cellDay:      { width: '45%', padding: 4, borderRightWidth: 1, borderColor: '#000', fontFamily: 'Helvetica-Bold', fontSize: 9 },
  cellHour:     { width: '55%', padding: 4, fontSize: 9 },
  turnoTitle:   { fontFamily: 'Helvetica-Bold', fontSize: 10, marginTop: 8, marginBottom: 2, textDecoration: 'underline' },
  sectionTitle: { fontFamily: 'Helvetica-Bold', fontSize: 10, marginTop: 6 },
  signBlock:    { marginTop: 8, paddingBottom: 6, borderBottomWidth: 0.5, borderColor: '#aaa' },
  signName:     { fontSize: 10, marginBottom: 2 },
  signLine:     { borderBottomWidth: 0.5, borderColor: '#000', marginTop: 14, marginBottom: 2 },
  signLabel:    { fontSize: 8, color: '#555', textAlign: 'center' },
  cityDate:     { marginTop: 20, marginBottom: 6 },
  empresa:      { fontFamily: 'Helvetica-Bold', marginBottom: 20 },
  empLine:      { borderBottomWidth: 0.5, borderColor: '#000', marginTop: 20, width: 200, alignSelf: 'center' },
  empLineLabel: { fontSize: 8, color: '#555', textAlign: 'center', width: 200, alignSelf: 'center' },
})

const DIAS = ['Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado','Domingo']

interface Props { acordo: AcordoCompensacao }

export function AcordoPdfDoc({ acordo }: Props) {
  const multiTurno = acordo.horarios.length > 1

  // Lookup funcId → funcionario
  const funcMap = new Map(acordo.funcionarios.map(f => [f.id, f]))

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <Text style={s.title}>ACORDO DE COMPENSAÇÃO DE HORAS</Text>

        {/* Intro */}
        <Text style={s.para}>
          {'     '}Por este instrumento particular, fica celebrado um{' '}
          <Text style={s.bold}>ACORDO</Text>, que celebram, de um lado,{' '}
          <Text style={s.bold}>DEMAX SERVIÇOS E COMÉRCIO LTDA</Text>, inscrita no CNPJ sob nº
          {' '}48.096.044/0001-93, por seu representante legal{' '}
          <Text style={s.bold}>JACQUES DOMINGUES DE PAULA MUFFO</Text>, brasileiro, solteiro,
          empresário, inscrito no CPF/MF sob o n.º 215.570.118-77, e de outro lado os empregados
          abaixo indicados, tendo em vista o pedido de{' '}
          <Text style={s.bold}>COMPENSAÇÃO DE HORAS</Text>, qual atende à vontade de ambas as
          partes, empresa e funcionários, de acordo com as disposições legais vigentes, o seguinte
          horário normal de trabalho semanal:
        </Text>

        {/* Tabela(s) de horário — uma por turno */}
        {acordo.horarios.map(turno => (
          <View key={turno.label}>
            {multiTurno && <Text style={s.turnoTitle}>{turno.label}</Text>}
            <View style={s.tableWrap}>
              {DIAS.map((dia, i) => {
                const horario = turno.horario[dia] ?? '—'
                const isLast = i === DIAS.length - 1
                return (
                  <View key={dia} style={isLast ? s.tableRowLast : s.tableRow}>
                    <Text style={s.cellDay}>{dia}</Text>
                    <Text style={s.cellHour}>{horario}</Text>
                  </View>
                )
              })}
            </View>
          </View>
        ))}

        {/* Texto livre */}
        <Text style={s.para}>
          {'     '}As partes celebram o presente acordo de compensação de horas, com a finalidade
          de que os funcionários{' '}{acordo.descricao_acordo}
        </Text>

        {/* Cláusulas padrão */}
        <Text style={s.para}>
          {'     '}Manifestam os empregados, por livre espontânea vontade, que referido acordo não
          acarreta qualquer prejuízo aos mesmos, seja a que título for.
        </Text>
        <Text style={s.para}>
          {'     '}O empregado que tiver faltas não justificadas, ou que por qualquer outro motivo
          deixar de cumprir o presente Acordo, terá redução do seu salário, naquele mês, na mesma
          proporção das horas não compensadas.
        </Text>
        <Text style={s.para}>
          {'     '}Os empregados que vierem a ser admitidos após a celebração do presente Acordo,
          incrementaram automaticamente esta condição, salvo manifestação expressa ao contrário.
        </Text>
        <Text style={s.para}>
          {'     '}Os empregados que forem desligados no decorrer do ano (POR INICIATIVA PRÓPRIA
          ou da EMPRESA), e na ocasião do seu desligamento da empresa, tiverem horas compensadas
          em haver, receberão as mesmas como horas extras, com acréscimo de 50% (cinquenta por
          cento) sobre a hora normal, em sua rescisão de Contrato de Trabalho.
        </Text>
        <Text style={s.para}>
          {'     '}De igual forma, os empregados que forem desligados no decorrer do ano (POR
          INICIATIVA PRÓPRIA ou da EMPRESA), e na ocasião do seu desligamento da empresa, tiverem
          horas compensadas devedora, terão descontados de sua rescisão, de forma simples, o valor
          correspondente às mesmas.
        </Text>
        <Text style={s.para}>
          {'     '}E, por estarem de pleno acordo e devidamente contratados, assinam o presente
          Acordo as partes acordadas.
        </Text>

        {/* Data e empresa */}
        <Text style={s.cityDate}>Mogi das Cruzes, {fmtDataExtenso(acordo.data_documento)}</Text>
        <Text style={s.empresa}>DEMAX SERVIÇOS E COMÉRCIO LTDA</Text>

        {/* Assinaturas — agrupadas por turno quando houver múltiplos */}
        {acordo.horarios.map(turno => {
          const funcs = turno.funcionario_ids
            .map(id => funcMap.get(id))
            .filter(Boolean) as typeof acordo.funcionarios
          if (!funcs.length) return null
          return (
            <View key={turno.label}>
              {multiTurno && <Text style={s.sectionTitle}>EMPREGADOS — {turno.label.toUpperCase()}:</Text>}
              {!multiTurno && <Text style={s.sectionTitle}>EMPREGADOS:</Text>}
              {funcs.map(f => (
                <View key={f.id} style={s.signBlock} wrap={false}>
                  <Text style={s.signName}>{f.nome}{f.funcao ? ` — ${f.funcao}` : ''}</Text>
                  <View style={s.signLine} />
                  <Text style={s.signLabel}>Assinatura</Text>
                </View>
              ))}
            </View>
          )
        })}

        {/* Assinatura da empresa */}
        <View style={{ marginTop: 30 }} wrap={false}>
          <View style={s.empLine} />
          <Text style={s.empLineLabel}>DEMAX SERVIÇOS E COMÉRCIO LTDA</Text>
        </View>
      </Page>
    </Document>
  )
}
