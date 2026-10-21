import { Page, Text, View } from '@react-pdf/renderer'
import { formatarCep, formatarCpf } from '@/lib/admissao/cpf'
import { MAX_LINHAS_VT, type PacoteAdmissao } from '@/lib/admissao/tipos'
import { linhaVtPreenchida, numeroBR } from '@/lib/admissao/vt'
import { Campo, COR_BORDA, Linha, Titulo, brl, marca, st } from './base'

const CLAUSULAS = [
  'Nos termos do artigo 7º do Decreto nº 95.247 de 17 de novembro de 1987, solicito receber o Vale transporte e comprometo-me :',
  'a) a utilizá-lo exclusivamente para meu efetivo deslocamento residência-trabalho e vice-versa;',
  'b) informar sempre que houver alteração no meu endereço residencial ou dos serviços e meios de transporte mais adequados ao meu deslocamento residência-trabalho e vice-versa;',
  'c) conforme dispõe o artigo 9º do decreto nº 95.247/87, autorizo descontar até 6% (seis por cento) do meu salário básico mensal para concorrer ao custeio do vale transporte;',
  'd) declaro estar ciente que a declaração falsa ou uso indevido do Vale Transporte constituem falta grave, conforme dispõe o parágrafo 3º do artigo 7º do Decreto nº 95.247/87;',
  'e) ciente de que, em caso de cancelamento o mesmo passará a ter efeito no 1° dia do mês seguinte ao crédito pago de forma antecipado.',
]

function enderecoCompleto(p: PacoteAdmissao['dossie']): string {
  const rua = [p.logradouro, p.numero].filter(Boolean).join(', ')
  const comp = p.complemento ? ` - ${p.complemento}` : ''
  const local = [p.bairro, [p.cidade, p.uf].filter(Boolean).join('/')].filter(Boolean).join(' - ')
  return `${rua}${comp}${local ? ` — ${local}` : ''}`
}

export function VtPage({ pacote, logo }: { pacote: PacoteAdmissao; logo?: string }) {
  const { dossie: d, contexto: c } = pacote
  const linhas = d.vt_utiliza ? d.vt_linhas.filter(linhaVtPreenchida) : []
  const vazias = Math.max(0, MAX_LINHAS_VT - linhas.length)
  const celulaTabela = { paddingHorizontal: 4, paddingVertical: 3, minHeight: 22, borderRightWidth: 1, borderColor: COR_BORDA }

  return (
    <Page size="A4" style={st.pagina}>
      <Titulo texto="SOLICITAÇÃO DE VALE TRANSPORTE" logo={logo} tamanho={13} />

      <Linha>
        <Campo rotulo="NOME:" valor={d.nome} peso={4} />
        <Campo rotulo="REGISTRO:" peso={1.4} ultima />
      </Linha>
      <Linha>
        <Campo rotulo="CPF:" valor={formatarCpf(d.cpf)} peso={2} />
        <Campo rotulo="CEP:" valor={formatarCep(d.cep)} peso={2} ultima />
      </Linha>
      <Linha>
        <Campo rotulo="ENDEREÇO:" valor={enderecoCompleto(d)} pequeno ultima />
      </Linha>
      <Linha>
        <Campo rotulo="LOCAL DE TRABALHO:" valor={[c.posto_nome, c.secretaria].filter(Boolean).join(' — ')} pequeno ultima />
      </Linha>
      <Linha>
        <View style={[st.celula, { flex: 1 }]}>
          <Text style={st.valorPequeno}>{marca(d.vt_utiliza)}  UTILIZO VALE TRANSPORTE</Text>
        </View>
        <View style={[st.celulaUltima, { flex: 1 }]}>
          <Text style={st.valorPequeno}>{marca(!d.vt_utiliza)}  NÃO UTILIZO VALE TRANSPORTE</Text>
        </View>
      </Linha>
      <View style={{ borderLeftWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderColor: COR_BORDA, padding: 6 }} wrap={false}>
        {CLAUSULAS.map((t, i) => (
          <Text key={i} style={{ fontSize: 7.6, lineHeight: 1.35, marginBottom: 3, textAlign: 'justify' }}>{t}</Text>
        ))}
      </View>

      <Text style={st.secao}>TRANSPORTE UTILIZADO</Text>
      <View style={{ flexDirection: 'row', borderLeftWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderColor: COR_BORDA, backgroundColor: '#f1f5f9' }} wrap={false}>
        <View style={[celulaTabela, { flex: 1.2 }]}><Text style={st.rotulo}>TIPO</Text></View>
        <View style={[celulaTabela, { flex: 2 }]}><Text style={st.rotulo}>NOME E Nº DA LINHA</Text></View>
        <View style={[celulaTabela, { flex: 1.8 }]}><Text style={st.rotulo}>EMPRESA DE ÔNIBUS</Text></View>
        <View style={[celulaTabela, { flex: 1.1 }]}><Text style={st.rotulo}>VALOR DA PASSAGEM</Text></View>
        <View style={[celulaTabela, { flex: 1.3, borderRightWidth: 0 }]}><Text style={st.rotulo}>QTD. PASSAGENS POR DIA</Text></View>
      </View>
      {linhas.map((l, i) => (
        <View key={`l${i}`} style={{ flexDirection: 'row', borderLeftWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderColor: COR_BORDA }} wrap={false}>
          <View style={[celulaTabela, { flex: 1.2 }]}><Text style={st.valorPequeno}>{l.tipo}</Text></View>
          <View style={[celulaTabela, { flex: 2 }]}><Text style={st.valorPequeno}>{l.linha}</Text></View>
          <View style={[celulaTabela, { flex: 1.8 }]}><Text style={st.valorPequeno}>{l.empresa}</Text></View>
          <View style={[celulaTabela, { flex: 1.1 }]}><Text style={st.valorPequeno}>{brl(numeroBR(l.valor))}</Text></View>
          <View style={[celulaTabela, { flex: 1.3, borderRightWidth: 0 }]}><Text style={st.valorPequeno}>{l.qtd}</Text></View>
        </View>
      ))}
      {Array.from({ length: vazias }).map((_, i) => (
        <View key={`v${i}`} style={{ flexDirection: 'row', borderLeftWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderColor: COR_BORDA }} wrap={false}>
          <View style={[celulaTabela, { flex: 1.2 }]} />
          <View style={[celulaTabela, { flex: 2 }]} />
          <View style={[celulaTabela, { flex: 1.8 }]} />
          <View style={[celulaTabela, { flex: 1.1 }]} />
          <View style={[celulaTabela, { flex: 1.3, borderRightWidth: 0 }]} />
        </View>
      ))}

      <Linha>
        <View style={[st.celula, { flex: 1 }]}>
          <Text style={st.rotulo}>POSSUI CARTÃO?   {marca(d.vt_utiliza && d.vt_cartao !== 'nenhum')} SIM    {marca(!(d.vt_utiliza && d.vt_cartao !== 'nenhum'))} NÃO</Text>
        </View>
        <View style={[st.celulaUltima, { flex: 3 }]}>
          <Text style={st.valorPequeno}>
            QUAL:  {marca(d.vt_cartao === 'bilhete_unico')} BILHETE ÚNICO   {marca(d.vt_cartao === 'top')} CARTÃO TOP   OUTRO: {d.vt_cartao === 'outro' ? d.vt_cartao_outro : '____________________'}
          </Text>
        </View>
      </Linha>
      <Linha>
        <Campo rotulo="OBS.:" ultima />
      </Linha>

      <View style={{ marginTop: 56, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12 }} wrap={false}>
        <View style={{ width: '28%' }}><Text style={st.assinatura}>LOCAL E DATA</Text></View>
        <View style={{ width: '34%' }}><Text style={st.assinatura}>ASSINATURA DO EMPREGADO</Text></View>
        <View style={{ width: '28%' }}><Text style={st.assinatura}>DEMAX</Text></View>
      </View>
    </Page>
  )
}
