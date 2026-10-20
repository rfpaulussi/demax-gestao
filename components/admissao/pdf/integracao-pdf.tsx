import { Image, Page, Text, View } from '@react-pdf/renderer'
import type { PacoteAdmissao } from '@/lib/admissao/tipos'
import { COR_BORDA, fmtData, st } from './base'

const TEMAS = [
  '1. APRESENTAÇÃO DA EMPRESA E ISO 9000',
  '2. EPIs E DISC DENÚNCIA',
  '3. DIREITOS E DEVERES',
  '4. NORMAS DE VESTIMENTA E DE CONVIVÊNCIA',
  '5. INFORMAÇÕES DE UTILIZAÇÃO DE APARELHOS CELULARES',
]

function Bloco({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <View style={{ flexDirection: 'row', marginTop: 12 }}>
      <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', width: 92 }}>{rotulo}</Text>
      <Text style={{ fontSize: 10, flex: 1, borderBottomWidth: 0.7, borderColor: '#64748b', paddingBottom: 1 }}>{valor || ' '}</Text>
    </View>
  )
}

/** Lista de presença da integração — uma por funcionário, com o próprio nome já na linha. */
export function IntegracaoPage({ pacote, logo }: { pacote: PacoteAdmissao; logo?: string }) {
  const { dossie: d, contexto: c } = pacote
  return (
    <Page size="A4" style={[st.pagina, { paddingTop: 48, paddingHorizontal: 48 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
        <View style={{ width: 56 }}>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          {logo ? <Image src={logo} style={{ width: 48, height: 48 }} /> : null}
        </View>
        <Text style={{ flex: 1, fontSize: 17, fontFamily: 'Helvetica-Bold', textAlign: 'center' }}>Lista de Presença</Text>
        <View style={{ width: 56 }} />
      </View>

      <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', marginBottom: 6 }}>ASSUNTO: INTEGRAÇÃO DAS NORMAS DA EMPRESA</Text>
      {TEMAS.map(t => (
        <Text key={t} style={{ fontSize: 9.5, marginBottom: 3, marginLeft: 8 }}>{t}</Text>
      ))}

      <Bloco rotulo="DATA:" valor={fmtData(d.data_integracao)} />
      <Bloco rotulo="PALESTRANTE:" valor={c.palestrante} />
      <Bloco rotulo="CONTRATO:" valor={d.contrato} />

      <View style={{ marginTop: 26, borderWidth: 1, borderColor: COR_BORDA }}>
        <View style={{ flexDirection: 'row', backgroundColor: '#e2e8f0', borderBottomWidth: 1, borderColor: COR_BORDA }}>
          <Text style={{ flex: 1, fontSize: 10, fontFamily: 'Helvetica-Bold', padding: 5, borderRightWidth: 1, borderColor: COR_BORDA }}>Nome</Text>
          <Text style={{ flex: 1, fontSize: 10, fontFamily: 'Helvetica-Bold', padding: 5 }}>Assinatura</Text>
        </View>
        <View style={{ flexDirection: 'row', minHeight: 34 }}>
          <Text style={{ flex: 1, fontSize: 10, padding: 8, borderRightWidth: 1, borderColor: COR_BORDA }}>{d.nome}</Text>
          <View style={{ flex: 1 }} />
        </View>
      </View>
    </Page>
  )
}
