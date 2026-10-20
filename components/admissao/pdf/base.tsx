import { StyleSheet, Text, View } from '@react-pdf/renderer'
import type { ReactNode } from 'react'

export const COR_BORDA = '#334155'

export const st = StyleSheet.create({
  pagina:       { fontFamily: 'Helvetica', fontSize: 8, paddingTop: 28, paddingHorizontal: 32, paddingBottom: 24, color: '#0f172a', backgroundColor: '#ffffff' },
  titulo:       { fontSize: 12, fontFamily: 'Helvetica-Bold', textAlign: 'center', paddingVertical: 5, borderWidth: 1, borderColor: COR_BORDA },
  secao:        { fontSize: 7.5, fontFamily: 'Helvetica-Bold', textAlign: 'center', paddingVertical: 3, backgroundColor: '#e2e8f0', borderLeftWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderColor: COR_BORDA, letterSpacing: 0.4 },
  linha:        { flexDirection: 'row', borderLeftWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderColor: COR_BORDA },
  celula:       { paddingHorizontal: 4, paddingVertical: 2.5, borderRightWidth: 1, borderColor: COR_BORDA, minHeight: 20, justifyContent: 'flex-start' },
  celulaUltima: { paddingHorizontal: 4, paddingVertical: 2.5, minHeight: 20, justifyContent: 'flex-start' },
  rotulo:       { fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: '#475569' },
  valor:        { fontSize: 9, marginTop: 1 },
  valorPequeno: { fontSize: 8, marginTop: 1 },
  assinatura:   { borderTopWidth: 1, borderColor: COR_BORDA, marginTop: 28, paddingTop: 2, textAlign: 'center', fontSize: 7.5 },
})

export const fmtData = (iso: string | null | undefined): string => {
  if (!iso) return ''
  const [a, m, d] = iso.slice(0, 10).split('-')
  return a && m && d ? `${d}/${m}/${a}` : ''
}

export const brl = (v: number | null | undefined): string =>
  v === null || v === undefined ? '' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/** "(X)" / "( )" como no formulário em papel. */
export const marca = (ligado: boolean): string => (ligado ? '( X )' : '(    )')

export function Linha({ children }: { children: ReactNode }) {
  return <View style={st.linha} wrap={false}>{children}</View>
}

/** Célula com rótulo pequeno e valor embaixo. `peso` é o flex; a última da linha não leva borda direita. */
export function Campo({ rotulo, valor, peso = 1, ultima, pequeno }: {
  rotulo: string
  valor?: string | null
  peso?: number
  ultima?: boolean
  pequeno?: boolean
}) {
  return (
    <View style={[ultima ? st.celulaUltima : st.celula, { flex: peso }]}>
      <Text style={st.rotulo}>{rotulo}</Text>
      {valor ? <Text style={pequeno ? st.valorPequeno : st.valor}>{valor}</Text> : null}
    </View>
  )
}
