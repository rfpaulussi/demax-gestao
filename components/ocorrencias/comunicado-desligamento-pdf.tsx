import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer'
import type { Style } from '@react-pdf/types'
import type { ReactNode } from 'react'
import { CONTRATO_COMUNICADO, type CausaComunicado } from '@/lib/desligamentos/comunicado'

export type DadosComunicadoDesligamento = {
  nome: string
  registro: string | null
  funcao: string | null
  dataAdmissao: string | null
  /** Data em que o aviso começa (ou o desligamento acontece). */
  dataDesligamento: string | null
  causa: CausaComunicado | null
  motivo: string | null
  /** Padrão do formulário: uniforme devolvido = Sim. */
  uniformeDevolvido?: boolean
}

// Grade copiada do anexo "COMUNICADO DE DESLIGAMENTO.xlsx" (A4 paisagem, colunas A–F em pt).
const COL = { A: 126, B: 61.5, C: 141.75, D: 129, E: 102, F: 137.25 }
const W = {
  A: COL.A,
  BC: COL.B + COL.C,
  BD: COL.B + COL.C + COL.D,
  BF: COL.B + COL.C + COL.D + COL.E + COL.F,
  D: COL.D,
  E: COL.E,
  EF: COL.E + COL.F,
  DF: COL.D + COL.E + COL.F,
  DE: COL.D + COL.E,
  F: COL.F,
  total: COL.A + COL.B + COL.C + COL.D + COL.E + COL.F,
}
const BORDER = 0.75
const SERIF = 'Times-Roman'
const SERIF_BOLD = 'Times-Bold'

const s = StyleSheet.create({
  page:   { padding: 28, justifyContent: 'center', alignItems: 'center', fontFamily: SERIF, color: '#000' },
  table:  { width: W.total, borderTopWidth: BORDER, borderLeftWidth: BORDER, borderColor: '#000' },
  row:    { flexDirection: 'row' },
  cell:   { borderRightWidth: BORDER, borderBottomWidth: BORDER, borderColor: '#000', justifyContent: 'center', paddingHorizontal: 4 },
  bold10: { fontFamily: SERIF_BOLD, fontSize: 10 },
  bold9:  { fontFamily: SERIF_BOLD, fontSize: 9 },
  val10:  { fontFamily: SERIF, fontSize: 10 },
  center: { textAlign: 'center' },
  box:    { width: 21.6, height: 14.4, borderWidth: BORDER, borderColor: '#000', alignItems: 'center', justifyContent: 'center' },
  boxX:   { fontFamily: SERIF_BOLD, fontSize: 11, marginTop: -1 },
  logo:   { position: 'absolute', left: 5.4, top: 3, width: 34.8, height: 30.6 },
})

const H = { topo: 33.75, titulo: 36, linha: 26.1, motivo: 52.2, assinatura: 43.5, papeis: 18.75 }

function fmt(iso: string | null): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('T')[0].split('-')
  return `${d}/${m}/${y}`
}

function Caixa({ marcada }: { marcada: boolean }) {
  return (
    <View style={s.box}>
      {marcada ? <Text style={s.boxX}>X</Text> : null}
    </View>
  )
}

function Cel({ w, h, children, style }: { w: number; h: number; children?: ReactNode; style?: Style }) {
  return <View style={[s.cell, { width: w, height: h }, style ?? {}]}>{children}</View>
}

/** Item "TEXTO [caixa]" das linhas de CAUSA — a caixa fica à direita, como no anexo. */
function CausaItem({ w, label, marcada, recuo }: { w: number; label: string; marcada: boolean; recuo: number }) {
  return (
    <Cel w={w} h={H.linha} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Text style={[s.bold9, { fontSize: 7.5, flex: 1 }]}>{label}</Text>
      <View style={{ marginRight: recuo }}><Caixa marcada={marcada} /></View>
    </Cel>
  )
}

/** "SIM [ ]   NÃO [ ]" centralizado. */
function SimNao({ sim, nao, prefixo }: { sim: boolean; nao: boolean; prefixo?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
      {prefixo ? <Text style={[s.bold10, { marginRight: 14 }]}>{prefixo}</Text> : null}
      <Text style={s.bold10}>SIM</Text><Caixa marcada={sim} />
      <Text style={[s.bold10, { marginLeft: 14 }]}>NÃO</Text><Caixa marcada={nao} />
    </View>
  )
}

function ComunicadoDocument({ dados }: { dados: DadosComunicadoDesligamento }) {
  const uniforme = dados.uniformeDevolvido ?? true
  const causa = dados.causa

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={s.page}>
        <View style={s.table}>

          {/* linha 1 — respiro do topo */}
          <View style={{ height: H.topo, borderRightWidth: BORDER, borderColor: '#000' }} />

          {/* linha 2 — logo, título, RH */}
          <View style={s.row}>
            <Cel w={W.A} h={H.titulo}>
              {/* eslint-disable-next-line jsx-a11y/alt-text */}
              <Image src="/logo-demax.png" style={s.logo} />
            </Cel>
            <Cel w={W.BD} h={H.titulo} style={{ alignItems: 'center' }}>
              <Text style={[s.center, { fontFamily: SERIF_BOLD, fontSize: 11 }]}>COMUNICAÇÃO DE DESLIGAMENTO</Text>
            </Cel>
            <Cel w={W.EF} h={H.titulo} style={{ alignItems: 'center' }}>
              <Text style={[s.center, { fontFamily: SERIF_BOLD, fontSize: 11 }]}>RECURSOS HUMANOS</Text>
            </Cel>
          </View>

          {/* linha 3 — nome / RE */}
          <View style={s.row}>
            <Cel w={W.A} h={H.linha}><Text style={s.bold10}>NOME:</Text></Cel>
            <Cel w={W.BD} h={H.linha}><Text style={s.val10}>{dados.nome}</Text></Cel>
            <Cel w={W.E} h={H.linha}><Text style={s.bold10}>RE:</Text></Cel>
            <Cel w={W.F} h={H.linha}><Text style={s.val10}>{dados.registro ?? ''}</Text></Cel>
          </View>

          {/* linha 4 — função / contrato */}
          <View style={s.row}>
            <Cel w={W.A} h={H.linha}><Text style={s.bold10}>FUNÇÃO:</Text></Cel>
            <Cel w={W.BC} h={H.linha}><Text style={s.val10}>{dados.funcao ?? ''}</Text></Cel>
            <Cel w={W.D} h={H.linha}><Text style={s.bold10}>CONTRATO:</Text></Cel>
            <Cel w={W.EF} h={H.linha}><Text style={s.val10}>{CONTRATO_COMUNICADO}</Text></Cel>
          </View>

          {/* linhas 5–7 — causa */}
          <View style={s.row}>
            <Cel w={W.A} h={H.linha * 3}><Text style={s.bold9}>CAUSA:</Text></Cel>
            <View>
              <View style={s.row}>
                <CausaItem w={W.BC} label="PEDIDO DE DEMISSÃO" marcada={causa === 'pedido_demissao'} recuo={5} />
                <CausaItem w={W.DF} label="REPROVA NA EXPERIÊNCIA" marcada={causa === 'reprova_experiencia'} recuo={63} />
              </View>
              <View style={s.row}>
                <CausaItem w={W.BC} label="DISPENSA SEM JUSTA CAUSA INDENIZADO" marcada={causa === 'sem_justa_causa_indenizado'} recuo={5} />
                <CausaItem w={W.DF} label="DISPENSA COM JUSTA CAUSA" marcada={causa === 'com_justa_causa'} recuo={63} />
              </View>
              <View style={s.row}>
                <CausaItem w={W.BC} label="DISPENSA SEM JUSTA CAUSA TRABALHADO" marcada={causa === 'sem_justa_causa_trabalhado'} recuo={5} />
                <CausaItem w={W.DF} label="FALECIMENTO" marcada={causa === 'falecimento'} recuo={63} />
              </View>
            </View>
          </View>

          {/* linhas 8–9 — motivo(s) */}
          <View style={s.row}>
            <Cel w={W.A} h={H.motivo}><Text style={s.bold9}>MOTIVO (s):</Text></Cel>
            <Cel w={W.BF} h={H.motivo}><Text style={s.val10}>{dados.motivo ?? ''}</Text></Cel>
          </View>

          {/* linha 10 — uniforme / exame / admissão */}
          <View style={s.row}>
            <Cel w={W.A} h={H.linha} style={{ alignItems: 'center' }}><Text style={s.bold10}>DEVOLUÇÃO:</Text></Cel>
            <Cel w={W.BC} h={H.linha}><SimNao sim={uniforme} nao={!uniforme} prefixo="UNIFORME" /></Cel>
            <Cel w={W.D} h={H.linha}><Text style={[s.bold10, { fontSize: 9 }]}>EXAME: ____/____/____</Text></Cel>
            <Cel w={W.E} h={H.linha}><Text style={s.bold10}>DATA ADMISSÃO:</Text></Cel>
            <Cel w={W.F} h={H.linha} style={{ alignItems: 'center' }}><Text style={s.bold10}>{fmt(dados.dataAdmissao)}</Text></Cel>
          </View>

          {/* linha 11 — substituído / data de desligamento */}
          <View style={s.row}>
            <Cel w={W.A} h={H.linha}><Text style={s.bold10}>SERÁ SUBSTITUIDO:</Text></Cel>
            <Cel w={W.BC} h={H.linha}><SimNao sim={false} nao={false} /></Cel>
            <Cel w={W.DE} h={H.linha}><Text style={s.bold10}>DATA DESLIGAMENTO:</Text></Cel>
            <Cel w={W.F} h={H.linha} style={{ alignItems: 'center' }}><Text style={s.bold10}>{fmt(dados.dataDesligamento)}</Text></Cel>
          </View>

          {/* linha 12 — espaço de assinatura */}
          <View style={s.row}>
            <Cel w={W.A} h={H.assinatura} />
            <Cel w={W.BC} h={H.assinatura} />
            <Cel w={W.D} h={H.assinatura} />
            <Cel w={W.E} h={H.assinatura} />
            <Cel w={W.F} h={H.assinatura} />
          </View>

          {/* linha 13 — cargos */}
          <View style={s.row}>
            <Cel w={W.A} h={H.papeis} style={{ alignItems: 'center' }}><Text style={s.bold9}>DIRETORIA</Text></Cel>
            <Cel w={W.BC} h={H.papeis} style={{ alignItems: 'center' }}><Text style={s.bold9}>COORDENADOR</Text></Cel>
            <Cel w={W.D} h={H.papeis} style={{ alignItems: 'center' }}><Text style={s.bold9}>SUPERVISOR</Text></Cel>
            <Cel w={W.E} h={H.papeis} style={{ alignItems: 'center' }}><Text style={s.bold9}>RH</Text></Cel>
            <Cel w={W.F} h={H.papeis} style={{ alignItems: 'center' }}><Text style={[s.bold9, { fontSize: 8 }]}>GERENTE OPERACIONAL</Text></Cel>
          </View>

        </View>
      </Page>
    </Document>
  )
}

export async function downloadComunicadoDesligamentoPDF(dados: DadosComunicadoDesligamento): Promise<void> {
  const { pdf } = await import('@react-pdf/renderer')
  const blob = await pdf(<ComunicadoDocument dados={dados} />).toBlob()
  const url = URL.createObjectURL(blob)
  const nomeSanitizado = dados.nome
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '')
  const data = new Date().toISOString().split('T')[0]
  const a = document.createElement('a')
  a.href = url
  a.download = `comunicado_desligamento_${nomeSanitizado}_${data}.pdf`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}
