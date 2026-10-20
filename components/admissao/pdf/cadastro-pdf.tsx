import { Page, Text, View } from '@react-pdf/renderer'
import { horarioParaCadastro } from '@/lib/admissao/horario'
import { DOCUMENTOS_ADMISSAO, DOCUMENTOS_DEPENDENTES, type PacoteAdmissao } from '@/lib/admissao/tipos'
import { formatarTelefone } from '@/lib/admissao/cpf'
import { numeroBR, totaisVT } from '@/lib/admissao/vt'
import { Campo, Linha, Titulo, brl, fmtData, marca, st } from './base'

function textoAdicional(perc: number | null, valor: number | null): string {
  if (!valor || valor <= 0) return 'NÃO'
  return `${perc ? `${perc}% · ` : ''}${brl(valor)}`
}

const dinheiro = (texto: string): string => {
  const n = numeroBR(texto)
  return n === null ? '' : brl(n)
}

/** Células vazias (para preenchimento à mão) com a mesma altura dos campos. */
function Vazio({ rotulo, peso = 1, ultima }: { rotulo: string; peso?: number; ultima?: boolean }) {
  return <Campo rotulo={rotulo} peso={peso} ultima={ultima} />
}

function HorarioCelulas({ rotulo, entrada, saida, peso = 1, ultima }: { rotulo?: string; entrada: string; saida: string; peso?: number; ultima?: boolean }) {
  return (
    <View style={[ultima ? st.celulaUltima : st.celula, { flex: peso, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' }]}>
      {rotulo ? <Text style={st.rotulo}>{rotulo}</Text> : null}
      <Text style={st.valor}>{entrada || ' '}</Text>
      <Text style={st.valor}>{saida || ' '}</Text>
    </View>
  )
}

export function CadastroPage({ pacote, logo }: { pacote: PacoteAdmissao; logo?: string }) {
  const { dossie: d, contexto: c } = pacote
  const h = c.turno ? horarioParaCadastro(c.turno) : null
  const vt = totaisVT(d.vt_linhas)
  const substituicao = d.motivo === 'substituicao'

  return (
    <Page size="A4" style={st.pagina}>
      <Titulo texto="CADASTRO DE FUNCIONÁRIOS" logo={logo} />

      <Linha>
        <Campo rotulo="NOME COMPLETO:" valor={d.nome} peso={3.2} />
        <Campo rotulo="TELEFONE:" valor={formatarTelefone(d.telefone)} peso={1.3} ultima />
      </Linha>
      <Linha>
        <Campo rotulo="E-MAIL:" valor={d.email} ultima />
      </Linha>

      <Text style={st.secao}>PREENCHIMENTO PELO SUPERVISOR</Text>
      <Linha>
        <Campo rotulo="FUNÇÃO:" valor={c.funcao_nome} peso={2.2} pequeno />
        <Campo rotulo="SALÁRIO:" valor={brl(c.salario_base)} peso={1.2} />
        <Campo rotulo="INSALUBRID." valor={textoAdicional(c.insalubridade_perc, c.insalubridade_valor)} peso={1.4} pequeno ultima />
      </Linha>
      <Linha>
        <Campo rotulo="CONTRATO:" valor={d.contrato} peso={2.2} pequeno />
        <Campo rotulo="CENTRO DE CUSTO:" valor={d.centro_custo} peso={1.2} pequeno />
        <Campo rotulo="PERICUL." valor={textoAdicional(c.periculosidade_perc, c.periculosidade_valor)} peso={0.9} pequeno />
        <Campo rotulo="OBS" peso={0.5} ultima />
      </Linha>
      <Linha>
        <Campo
          rotulo="VT (VALOR / DIA · QTD PASSAGENS):"
          valor={d.vt_utiliza ? `${brl(vt.valorDia)} · ${vt.passagensDia}` : 'NÃO UTILIZA'}
          peso={2.2}
          pequeno
        />
        <Campo rotulo="VALE ALIMENTAÇÃO:" valor={dinheiro(d.va)} peso={1.2} pequeno />
        <Campo rotulo="VALE REFEIÇÃO:" valor={dinheiro(d.vr)} peso={0.9} pequeno />
        <Campo rotulo="SINDICATO:" valor={d.sindicato} peso={0.9} pequeno ultima />
      </Linha>
      <Linha>
        <Campo rotulo="DATA DE ADMISSÃO:" valor={fmtData(d.data_admissao)} peso={2.2} />
        <View style={[st.celulaUltima, { flex: 3 }]}>
          <Text style={st.rotulo}>MOTIVO:</Text>
          <Text style={st.valorPequeno}>
            AUMENTO DE EFETIVO {marca(!substituicao)}      SUBSTITUIÇÃO {marca(substituicao)}
          </Text>
        </View>
      </Linha>
      <Linha>
        <Campo rotulo="MOTIVO DA SUBSTITUIÇÃO:" valor={substituicao ? d.substituido_motivo : ''} ultima pequeno />
      </Linha>
      <Linha>
        <Campo rotulo="NOME DO SUBSTITUÍDO:" valor={substituicao ? d.substituido_nome : ''} peso={3} pequeno />
        <Campo rotulo="DATA DO DESLIGAMENTO:" valor={substituicao ? fmtData(d.substituido_data_desligamento) : ''} peso={1.5} ultima />
      </Linha>
      <Linha>
        <View style={[st.celula, { flex: 1.6 }]}>
          <Text style={st.rotulo}>PERÍODO DE EXPERIÊNCIA:</Text>
        </View>
        <View style={[st.celula, { flex: 1.8 }]}>
          <Text style={st.valorPequeno}>
            45+45 {marca(d.periodo_experiencia === '45+45')}     30+30 {marca(d.periodo_experiencia === '30+30')}
          </Text>
        </View>
        <Campo rotulo="OUTRO:" valor={d.periodo_experiencia === 'nenhum' ? 'SEM EXPERIÊNCIA' : ''} peso={1.4} pequeno ultima />
      </Linha>

      <Text style={st.secao}>PREENCHIMENTO PELO DEPARTAMENTO DE SEGURANÇA E MEDICINA DO TRABALHO</Text>
      <Text style={[st.secao, { backgroundColor: '#f1f5f9' }]}>SETORES</Text>
      <Linha>
        <Campo rotulo="NOME DO SETOR:" valor={d.setor} peso={2} pequeno />
        <Vazio rotulo="REGIÃO:" peso={1} />
        <Vazio rotulo="SETOR DESENVOLVIDO:" peso={2} ultima />
      </Linha>
      <Text style={[st.secao, { backgroundColor: '#f1f5f9' }]}>CARGOS</Text>
      <Linha>
        <Campo rotulo="CBO:" valor={d.cbo} peso={1.4} />
        <Campo rotulo="CARGO DESENVOLVIDO:" valor={c.funcao_nome} peso={3.6} pequeno ultima />
      </Linha>
      <Linha>
        <View style={[st.celula, { flex: 2 }]}><Text style={st.rotulo}>EXAME ADMISSIONAL</Text></View>
        <View style={[st.celulaUltima, { flex: 3 }]}><Text style={st.rotulo}>SEGURANÇA E MEDICINA DO TRABALHO</Text></View>
      </Linha>
      <Linha>
        <Vazio rotulo="DATA DO ASO:" peso={1} />
        <View style={[st.celula, { flex: 0.5 }]}><Text style={st.rotulo}>APTO: {marca(false)}</Text></View>
        <View style={[st.celula, { flex: 0.5 }]}><Text style={st.rotulo}>INAPTO: {marca(false)}</Text></View>
        <View style={[st.celulaUltima, { flex: 3 }]}>
          <Text style={st.rotulo}>APROVADO POR:</Text>
          <Text style={[st.rotulo, { marginTop: 6 }]}>DATA DA APROVAÇÃO:        /        /</Text>
        </View>
      </Linha>

      <Text style={st.secao}>HORÁRIO DE TRABALHO</Text>
      <Linha>
        <View style={[st.celula, { flex: 3.2 }]}>
          <Text style={st.valorPequeno}>
            {marca(h?.dias === 'seg_sex')} Segunda à Sexta-Feira  ou  {marca(h?.dias === 'seg_qui')} Segunda a Quinta
          </Text>
        </View>
        <View style={[st.celulaUltima, { flex: 2 }]}>
          <Text style={st.valorPequeno}>
            {marca(!!h?.sabado)} Sábado  OU  {marca(!!h?.sexta)} Sexta
          </Text>
        </View>
      </Linha>
      <Linha>
        <View style={[st.celula, { flex: 1 }]} />
        <View style={[st.celula, { flex: 2 }]}><Text style={[st.rotulo, { textAlign: 'center' }]}>1º PERÍODO</Text></View>
        <View style={[st.celula, { flex: 2 }]}><Text style={[st.rotulo, { textAlign: 'center' }]}>2º PERÍODO</Text></View>
        <View style={[st.celulaUltima, { flex: 2 }]}><Text style={[st.rotulo, { textAlign: 'center' }]}>PERÍODO ÚNICO</Text></View>
      </Linha>
      <Linha>
        <View style={[st.celula, { flex: 1 }]}><Text style={st.rotulo}>ENTRADA / SAÍDA</Text></View>
        <HorarioCelulas peso={2} entrada={h?.periodo1.entrada ?? ''} saida={h?.periodo1.saida ?? ''} />
        <HorarioCelulas peso={2} entrada={h?.periodo2?.entrada ?? ''} saida={h?.periodo2?.saida ?? ''} />
        <HorarioCelulas
          peso={2}
          ultima
          entrada={(h?.sexta ?? h?.sabado)?.entrada ?? ''}
          saida={(h?.sexta ?? h?.sabado)?.saida ?? ''}
        />
      </Linha>
      {(h?.sexta?.pausa || h?.sabado?.pausa || (h?.sexta && h?.sabado)) ? (
        <Linha>
          <View style={[st.celulaUltima, { flex: 1, minHeight: 14 }]}>
            <Text style={st.rotulo}>
              {h?.sexta ? `SEXTA ${h.sexta.entrada}–${h.sexta.saida}${h.sexta.pausa ? ` (pausa ${h.sexta.pausa})` : ''}` : ''}
              {h?.sexta && h?.sabado ? '   ·   ' : ''}
              {h?.sabado ? `SÁBADO ${h.sabado.entrada}–${h.sabado.saida}${h.sabado.pausa ? ` (pausa ${h.sabado.pausa})` : ''}` : ''}
            </Text>
          </View>
        </Linha>
      ) : null}
      <Linha>
        <View style={[st.celulaUltima, { flex: 1 }]}>
          <Text style={st.valorPequeno}>
            TURNO:  {marca(!!h?.escala5x1)} 5x1 ou 6x1    {marca(false)} 1x1{h?.escalaOutra ? `    ${marca(true)} ${h.escalaOutra}` : ''}
          </Text>
        </View>
      </Linha>

      <View style={{ flexDirection: 'row', borderLeftWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderColor: '#334155' }} wrap={false}>
        <View style={{ flex: 3.4, padding: 4, borderRightWidth: 1, borderColor: '#334155' }}>
          <Text style={[st.rotulo, { textAlign: 'center', marginBottom: 3 }]}>DOCUMENTOS NECESSÁRIOS PARA ADMISSÃO</Text>
          {DOCUMENTOS_ADMISSAO.map(doc => (
            <Text key={doc.id} style={{ fontSize: 7.2, marginBottom: 1.6 }}>
              {marca(d.docs.includes(doc.id))}  {doc.label}
            </Text>
          ))}
        </View>
        <View style={{ flex: 1.3, padding: 4 }}>
          <Text style={[st.rotulo, { marginBottom: 3 }]}>UNIFORME                       Nº</Text>
          <Text style={{ fontSize: 8, marginBottom: 6 }}>Calça:   {d.uniforme_calca}</Text>
          <Text style={{ fontSize: 8, marginBottom: 6 }}>Camisa:  {d.uniforme_camisa}</Text>
          <Text style={{ fontSize: 8 }}>Sapato:  {d.uniforme_sapato}</Text>
        </View>
      </View>

      <View style={{ borderLeftWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderColor: '#334155', padding: 4 }} wrap={false}>
        <Text style={[st.rotulo, { textAlign: 'center', marginBottom: 3 }]}>DOCUMENTOS DEPENDENTES</Text>
        {DOCUMENTOS_DEPENDENTES.map(doc => (
          <Text key={doc.id} style={{ fontSize: 7.2, marginBottom: 1.6 }}>
            {marca(d.docs_dependentes.includes(doc.id))}  {doc.label}
          </Text>
        ))}
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 6 }} wrap={false}>
        <View style={{ width: '30%' }}>
          <Text style={st.assinatura}>Supervisor / Coord.</Text>
          {c.palestrante ? <Text style={{ fontSize: 6.5, textAlign: 'center', color: '#475569' }}>{c.palestrante}</Text> : null}
        </View>
        <View style={{ width: '30%' }}><Text style={st.assinatura}>Gerente Operacional</Text></View>
        <View style={{ width: '30%' }}><Text style={st.assinatura}>Coordenador RH</Text></View>
      </View>
    </Page>
  )
}
