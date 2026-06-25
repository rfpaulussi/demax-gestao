import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { FechamentoFuncionario, FechamentoPosto } from '@/app/(admin)/fechamento/actions'

const s = StyleSheet.create({
  page:        { padding: 20, fontSize: 8, fontFamily: 'Helvetica', backgroundColor: '#ffffff' },
  title:       { fontSize: 11, fontWeight: 'bold', marginBottom: 2 },
  subtitle:    { fontSize: 8, color: '#6b7280', marginBottom: 16 },
  groupHeader: { backgroundColor: '#1e293b', color: '#ffffff', fontSize: 7, fontWeight: 'bold',
                 paddingVertical: 3, paddingHorizontal: 6, marginTop: 10, marginBottom: 0 },
  thead:       { flexDirection: 'row', backgroundColor: '#f8fafc', borderBottomWidth: 1,
                 borderBottomColor: '#e2e8f0' },
  th:          { fontSize: 7, fontWeight: 'bold', color: '#94a3b8', paddingVertical: 3,
                 paddingHorizontal: 3, textTransform: 'uppercase' },
  row:         { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  rowAlt:      { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
                 backgroundColor: '#fafafa' },
  rowSusp:     { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
                 backgroundColor: '#fff1f2' },
  td:          { fontSize: 8, color: '#374151', paddingVertical: 3, paddingHorizontal: 3 },
  tdNum:       { fontSize: 8, color: '#374151', paddingVertical: 3, paddingHorizontal: 3,
                 textAlign: 'center' },
  tdBold:      { fontSize: 8, fontWeight: 'bold', color: '#1d4ed8', paddingVertical: 3,
                 paddingHorizontal: 3, textAlign: 'center' },
  // column widths
  cNome:   { width: 160 },
  cFuncao: { width: 100 },
  cReg:    { width: 32 },
  cN5:     { width: 32 },
  cAfast:  { width: 32 },
  cSusp:   { width: 42 },
  cTrab:   { width: 52 },
  cAdv:    { width: 58 },
})

function advLabel(f: FechamentoFuncionario) {
  if (f.tem_suspensao) return 'Suspensão'
  if (f.tem_advertencia) return 'Sim'
  return '—'
}

const COLS = [
  { label: 'Nome',         style: s.cNome,   num: false },
  { label: 'Função',       style: s.cFuncao, num: false },
  { label: 'Posto Princ.', style: s.cFuncao, num: false },
  { label: 'Regime',       style: s.cReg,    num: true  },
  { label: 'D.Úteis',      style: s.cN5,     num: true  },
  { label: 'Férias',       style: s.cN5,     num: true  },
  { label: 'Faltas',       style: s.cN5,     num: true  },
  { label: 'Atestados',    style: s.cN5,     num: true  },
  { label: 'Suspens.',     style: s.cSusp,   num: true  },
  { label: 'Afast.',       style: s.cAfast,  num: true  },
  { label: 'Trabalhados',  style: s.cTrab,   num: true  },
  { label: 'Ins.(dias)',   style: s.cN5,     num: true  },
  { label: 'Advertên.',    style: s.cAdv,    num: false },
]

function cellValue(f: FechamentoFuncionario, idx: number): string {
  const postoPrinc = f.multi_posto && f.posto_preponderante_id !== f.posto_id
    ? `★ ${f.posto_preponderante_nome ?? '—'}`
    : '—'
  const vals = [
    f.funcionario_nome,
    f.funcao ?? '—',
    postoPrinc,
    f.regime,
    String(f.dias_uteis),
    f.ferias_dias > 0 ? String(f.ferias_dias) : '—',
    f.faltas_dias > 0 ? String(f.faltas_dias) : '—',
    f.atestados_dias > 0 ? String(f.atestados_dias) : '—',
    f.dias_suspensao > 0 ? String(f.dias_suspensao) : '—',
    f.afastamento_dias > 0 ? String(f.afastamento_dias) : '—',
    String(f.dias_trabalhados),
    f.insalubridade_dias > 0 ? String(f.insalubridade_dias) : '—',
    advLabel(f),
  ]
  return vals[idx]
}

interface Props {
  dados: FechamentoFuncionario[]
  mes: number
  ano: number
  MESES: string[]
}

// ─── PDF Por Posto ────────────────────────────────────────────────────────────

const sp = StyleSheet.create({
  page:        { padding: 20, fontSize: 8, fontFamily: 'Helvetica', backgroundColor: '#ffffff' },
  title:       { fontSize: 11, fontWeight: 'bold', marginBottom: 2 },
  subtitle:    { fontSize: 8, color: '#6b7280', marginBottom: 14 },
  secHeader:   { backgroundColor: '#1e293b', color: '#ffffff', fontSize: 8, fontWeight: 'bold', paddingVertical: 4, paddingHorizontal: 6, marginTop: 12, marginBottom: 0 },
  postoHeader: { backgroundColor: '#475569', color: '#ffffff', fontSize: 7, fontWeight: 'bold', paddingVertical: 3, paddingHorizontal: 6, marginBottom: 0 },
  thead:       { flexDirection: 'row', backgroundColor: '#f8fafc', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  th:          { fontSize: 7, fontWeight: 'bold', color: '#94a3b8', paddingVertical: 3, paddingHorizontal: 4, textTransform: 'uppercase' },
  row:         { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  rowCob:      { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f1f5f9', backgroundColor: '#fefce8' },
  td:          { fontSize: 8, color: '#374151', paddingVertical: 3, paddingHorizontal: 4 },
  tdC:         { fontSize: 8, color: '#374151', paddingVertical: 3, paddingHorizontal: 4, textAlign: 'center' },
  tdB:         { fontSize: 8, fontWeight: 'bold', color: '#1d4ed8', paddingVertical: 3, paddingHorizontal: 4, textAlign: 'center' },
  cNome:  { width: 160 },
  cFuncao:{ width: 100 },
  cTipo:  { width: 55 },
  cPer:   { width: 80 },
  cDias:  { width: 35 },
  cOcor:  { width: 70 },
})

function fmtPdf(iso: string | null): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

interface PropsPosto {
  porPosto: FechamentoPosto[]
  mes: number
  ano: number
  MESES: string[]
}

export function FechamentoPorPostoPDF({ porPosto, mes, ano, MESES }: PropsPosto) {
  const secretarias = Array.from(new Set(porPosto.map(p => p.secretaria || 'Sem Secretaria')))
    .sort((a, b) => { if (a === 'AFASTADOS') return 1; if (b === 'AFASTADOS') return -1; return a.localeCompare(b, 'pt-BR') })
  const geradoEm = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={sp.page}>
        <Text style={sp.title}>Fechamento por Posto — {MESES[mes]} {ano}</Text>
        <Text style={sp.subtitle}>Gerado em {geradoEm} · {porPosto.length} postos</Text>

        {secretarias.map(sec => {
          const postosGrupo = porPosto.filter(p => (p.secretaria || 'Sem Secretaria') === sec)
          return (
            <View key={sec}>
              <Text style={sp.secHeader}>{sec.toUpperCase()} — {postosGrupo.length} POSTOS</Text>
              {postosGrupo.map(posto => {
                const titulares  = posto.funcionarios.filter(f => f.tipo === 'titular')
                const coberturas = posto.funcionarios.filter(f => f.tipo === 'cobertura')
                const totalDias  = posto.funcionarios.reduce((s, f) => s + f.dias_no_posto, 0)
                return (
                  <View key={posto.posto_id}>
                    <Text style={sp.postoHeader}>{posto.posto_nome} ({posto.regime}) — {totalDias} dias · {titulares.length} titular{titulares.length !== 1 ? 'es' : ''}{coberturas.length > 0 ? ` · ${coberturas.length} cob.` : ''}</Text>
                    <View style={sp.thead}>
                      {[
                        { label: 'Nome',    style: sp.cNome  },
                        { label: 'Função',  style: sp.cFuncao },
                        { label: 'Tipo',    style: sp.cTipo  },
                        { label: 'Período', style: sp.cPer   },
                        { label: 'Dias',    style: sp.cDias  },
                        { label: 'Ocorr.',  style: sp.cOcor  },
                      ].map(c => <Text key={c.label} style={[sp.th, c.style]}>{c.label}</Text>)}
                    </View>
                    {titulares.map(f => (
                      <View key={f.funcionario_id + '-t'} style={sp.row}>
                        <Text style={[sp.td,  sp.cNome]}>{f.funcionario_nome}</Text>
                        <Text style={[sp.td,  sp.cFuncao]}>{f.funcao ?? '—'}</Text>
                        <Text style={[sp.tdC, sp.cTipo]}>
                          {f.multi_posto
                            ? (f.is_posto_preponderante ? 'Titular ★' : 'Titular (sec.)')
                            : 'Titular'}
                        </Text>
                        <Text style={[sp.tdC, sp.cPer]}>{fmtPdf(f.data_inicio_no_posto)} – {fmtPdf(f.data_fim_no_posto)}</Text>
                        <Text style={[sp.tdB, sp.cDias]}>{f.dias_no_posto}</Text>
                        <Text style={[sp.td,  sp.cOcor]}>{[
                          f.tem_advertencia ? 'Adv' : '',
                          f.faltas_dias > 0 ? `${f.faltas_dias}F` : '',
                          f.atestados_dias > 0 ? `${f.atestados_dias}At` : '',
                          f.insalubridade_dias > 0 ? `${f.insalubridade_dias}In` : '',
                        ].filter(Boolean).join(' · ') || '—'}</Text>
                      </View>
                    ))}
                    {coberturas.map((f, i) => (
                      <View key={f.funcionario_id + '-c-' + i} style={sp.rowCob}>
                        <Text style={[sp.td,  sp.cNome]}>{f.funcionario_nome}</Text>
                        <Text style={[sp.td,  sp.cFuncao]}>{f.funcao ?? '—'}</Text>
                        <Text style={[sp.tdC, sp.cTipo]}>
                          {f.is_posto_preponderante ? 'Cobertura ★' : 'Cobertura'}
                        </Text>
                        <Text style={[sp.tdC, sp.cPer]}>{fmtPdf(f.data_inicio_no_posto)} – {fmtPdf(f.data_fim_no_posto)}</Text>
                        <Text style={[{ fontSize: 8, fontWeight: 'bold', color: '#854d0e', paddingVertical: 3, paddingHorizontal: 4, textAlign: 'center' }, sp.cDias]}>{f.dias_no_posto}</Text>
                        <Text style={[sp.td, sp.cOcor]}>—</Text>
                      </View>
                    ))}
                  </View>
                )
              })}
            </View>
          )
        })}
      </Page>
    </Document>
  )
}

// ─── PDF Por Funcionário (original) ──────────────────────────────────────────

export function FechamentoPDFDoc({ dados, mes, ano, MESES }: Props) {
  const secretarias = Array.from(new Set(dados.map(f => f.secretaria ?? 'Sem Secretaria')))
    .sort((a, b) => { if (a === 'AFASTADOS') return 1; if (b === 'AFASTADOS') return -1; return a.localeCompare(b, 'pt-BR') })
  const geradoEm = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={s.page}>
        <Text style={s.title}>Fechamento — {MESES[mes]} {ano}</Text>
        <Text style={s.subtitle}>Gerado em {geradoEm} · {dados.length} funcionários</Text>

        {secretarias.map(sec => {
          const grupo = dados.filter(f => (f.secretaria ?? 'Sem Secretaria') === sec)
          return (
            <View key={sec}>
              <Text style={s.groupHeader}>{sec.toUpperCase()} ({grupo.length})</Text>

              {/* thead */}
              <View style={s.thead}>
                {COLS.map(c => (
                  <Text key={c.label} style={[s.th, c.style]}>{c.label}</Text>
                ))}
              </View>

              {/* rows */}
              {grupo.map((f, i) => {
                const rowStyle = f.tem_suspensao ? s.rowSusp : i % 2 === 0 ? s.row : s.rowAlt
                return (
                  <View key={f.funcionario_id} style={rowStyle}>
                    {COLS.map((c, ci) => {
                      const isTrab = c.label === 'Trabalhados'
                      return (
                        <Text
                          key={c.label}
                          style={[isTrab ? s.tdBold : c.num ? s.tdNum : s.td, c.style]}
                        >
                          {cellValue(f, ci)}
                        </Text>
                      )
                    })}
                  </View>
                )
              })}
            </View>
          )
        })}
      </Page>
    </Document>
  )
}
