import { Document, Page, Text, View, Image, StyleSheet, Font } from '@react-pdf/renderer'
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
  /** Apelido do supervisor que gerou o documento; sai no campo SUPERVISOR com a data. */
  assinaturaSupervisor?: string | null
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
// sem hifenização: o texto longo das causas quebra só entre palavras, como no Excel
Font.registerHyphenationCallback(word => [word])

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
      <Text style={[s.bold9, { fontSize: 8.5, flex: 1, paddingRight: 4 }]}>{label}</Text>
      <View style={{ marginRight: recuo }}><Caixa marcada={marcada} /></View>
    </Cel>
  )
}

/** "SIM [ ]   NÃO [ ]" centralizado. */
function SimNao({ sim, nao, prefixo }: { sim: boolean; nao: boolean; prefixo?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
      {prefixo ? <Text style={[s.bold10, { marginRight: 10 }]}>{prefixo}</Text> : null}
      <Caixa marcada={sim} /><Text style={s.bold10}>SIM</Text>
      <View style={{ marginLeft: 10 }}><Caixa marcada={nao} /></View><Text style={s.bold10}>NÃO</Text>
    </View>
  )
}

function ComunicadoDocument({ dados }: { dados: DadosComunicadoDesligamento }) {
  const uniforme = dados.uniformeDevolvido ?? true
  const hoje = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  const causa = dados.causa

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={s.page}>
        <View style={s.table}>

          {/* linha 2 — logo, título, RH */}
          <View style={s.row}>
            <Cel w={W.A} h={H.titulo}>
              {/* eslint-disable-next-line jsx-a11y/alt-text */}
              <Image src="/logo-demax.jpg" style={s.logo} />
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
                <CausaItem w={W.BC} label="PEDIDO DE DEMISSÃO" marcada={causa === 'pedido_demissao'} recuo={18} />
                <CausaItem w={W.DF} label="REPROVA NA EXPERIÊNCIA" marcada={causa === 'reprova_experiencia'} recuo={63} />
              </View>
              <View style={s.row}>
                <CausaItem w={W.BC} label="DISPENSA SEM JUSTA CAUSA INDENIZADO" marcada={causa === 'sem_justa_causa_indenizado'} recuo={18} />
                <CausaItem w={W.DF} label="DISPENSA COM JUSTA CAUSA" marcada={causa === 'com_justa_causa'} recuo={63} />
              </View>
              <View style={s.row}>
                <CausaItem w={W.BC} label="DISPENSA SEM JUSTA CAUSA TRABALHADO" marcada={causa === 'sem_justa_causa_trabalhado'} recuo={18} />
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
            <Cel w={W.D} h={H.assinatura} style={{ alignItems: 'center' }}>
              {dados.assinaturaSupervisor ? (
                <>
                  <Text style={{ fontFamily: 'Times-BoldItalic', fontSize: 14 }}>{dados.assinaturaSupervisor}</Text>
                  <Text style={{ fontFamily: SERIF, fontSize: 8, marginTop: 1 }}>{hoje}</Text>
                </>
              ) : null}
            </Cel>
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

async function gerarComunicadoBlob(dados: DadosComunicadoDesligamento): Promise<{ blob: Blob; nomeArquivo: string }> {
  const { pdf } = await import('@react-pdf/renderer')
  const blob = await pdf(<ComunicadoDocument dados={dados} />).toBlob()
  const nomeSanitizado = dados.nome
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '')
  const data = new Date().toISOString().split('T')[0]
  return { blob, nomeArquivo: `comunicado_desligamento_${nomeSanitizado}_${data}.pdf` }
}

export async function downloadComunicadoDesligamentoPDF(dados: DadosComunicadoDesligamento): Promise<void> {
  const { blob, nomeArquivo } = await gerarComunicadoBlob(dados)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nomeArquivo
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}

/** Abre a folha de compartilhamento do aparelho (WhatsApp, e-mail…) com o PDF anexado.
 *  Retorna false se a pessoa cancelou o compartilhamento. */
export async function compartilharComunicadoDesligamentoPDF(dados: DadosComunicadoDesligamento): Promise<boolean> {
  const { blob, nomeArquivo } = await gerarComunicadoBlob(dados)
  const arquivo = new File([blob], nomeArquivo, { type: 'application/pdf' })
  try {
    await navigator.share({ files: [arquivo], title: `Comunicado de desligamento — ${dados.nome}` })
    return true
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return false
    throw e
  }
}
