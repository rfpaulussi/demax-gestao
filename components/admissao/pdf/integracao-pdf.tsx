import { Image, Page, Text, View } from '@react-pdf/renderer'
import type { PacoteAdmissao } from '@/lib/admissao/tipos'
import { COR_BORDA, fmtData, st } from './base'

const TEMAS = [
  '1. APRESENTAÇÃO DA EMPRESA E ISO 9000',
  '2. EPIs E DISQUE DENÚNCIA',
  '3. DIREITOS E DEVERES',
  '4. NORMAS DE VESTIMENTA E DE CONVIVÊNCIA',
  '5. INFORMAÇÕES DE UTILIZAÇÃO DE APARELHOS CELULARES',
]

/** Texto do contrato como no modelo do RH; o campo de contrato do cadastro traz só o número. */
const CONTRATO_FIXO = 'MOGI DAS CRUZES - LIMPEZA PREDIAL - 706'

/** Total de linhas da tabela, como no modelo do RH (a primeira já sai com o nome do admitido). */
const LINHAS = 21

const negrito = { fontSize: 10, fontFamily: 'Helvetica-Bold' } as const

/**
 * Lista de presença da integração, no padrão do RH ("Lista de presença de Treinamento").
 * Palestrante = supervisor que fez a admissão; data = data de admissão; nome = admitido; assinatura em branco.
 */
export function IntegracaoPage({ pacote, logo }: { pacote: PacoteAdmissao; logo?: string }) {
  const { dossie: d, contexto: c } = pacote
  return (
    <Page size="A4" style={[st.pagina, { paddingTop: 40, paddingHorizontal: 40, paddingBottom: 30 }]}>
      <View style={{ borderWidth: 1, borderColor: COR_BORDA }}>
        <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderColor: COR_BORDA }}>
          <View style={{ width: 78, alignItems: 'center', justifyContent: 'center', borderRightWidth: 1, borderColor: COR_BORDA }}>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            {logo ? <Image src={logo} style={{ width: 60, height: 60 }} /> : null}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontFamily: 'Helvetica-Bold', textAlign: 'center', padding: 6, borderBottomWidth: 1, borderColor: COR_BORDA }}>
              Lista de Presença
            </Text>
            <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderColor: COR_BORDA }}>
              <Text style={[negrito, { flex: 1, padding: 5, borderRightWidth: 1, borderColor: COR_BORDA }]}>
                ASSUNTO: INTEGRAÇÃO DAS NORMAS DA EMPRESA
              </Text>
              <Text style={[negrito, { width: 130, padding: 5 }]}>DATA: {fmtData(d.data_admissao)}</Text>
            </View>
            <View style={{ padding: 5, borderBottomWidth: 1, borderColor: COR_BORDA }}>
              <Text style={negrito}>CONTEÚDO PROGRAMÁTICO:</Text>
              {TEMAS.map(t => (
                <Text key={t} style={{ fontSize: 9.5, marginTop: 3 }}>{t}</Text>
              ))}
            </View>
            <Text style={[negrito, { padding: 5 }]}>PALESTRANTE: {c.palestrante}</Text>
          </View>
        </View>

        <Text style={[negrito, { padding: 5, borderBottomWidth: 1, borderColor: COR_BORDA }]}>CONTRATO: {CONTRATO_FIXO}</Text>

        <View style={{ flexDirection: 'row', backgroundColor: '#e2e8f0', borderBottomWidth: 1, borderColor: COR_BORDA }}>
          <Text style={[negrito, { flex: 1, padding: 5, textAlign: 'center', borderRightWidth: 1, borderColor: COR_BORDA }]}>Nome</Text>
          <Text style={[negrito, { flex: 1, padding: 5, textAlign: 'center' }]}>Assinatura</Text>
        </View>
        {Array.from({ length: LINHAS }, (_, i) => (
          <View key={i} style={{ flexDirection: 'row', height: 25, borderBottomWidth: i === LINHAS - 1 ? 0 : 1, borderColor: COR_BORDA }}>
            <Text style={{ flex: 1, fontSize: 10, padding: 6, borderRightWidth: 1, borderColor: COR_BORDA }}>{i === 0 ? d.nome : ' '}</Text>
            <View style={{ flex: 1 }} />
          </View>
        ))}
      </View>
    </Page>
  )
}
