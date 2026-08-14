# PDF do Dossiê do Funcionário Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Botão "Baixar PDF" no modal do dossiê, gerando um PDF com cabeçalho do funcionário, resumo automático dos KPIs e a timeline completa (advertências/atestados/faltas/ocorrências).

**Architecture:** Novo componente `dossie-pdf.tsx` segue exatamente o padrão já usado em `advertencia-pdf.tsx` (`@react-pdf/renderer`, import dinâmico de `pdf`, blob → link temporário → download). Usa só os dados já carregados no state do `modal-dossie.tsx` — sem nova chamada ao servidor.

**Tech Stack:** `@react-pdf/renderer` (já usado no projeto), TypeScript, React.

**Referência:** spec em `docs/superpowers/specs/2026-08-14-dossie-pdf-design.md`.

---

## Task 1: Criar `components/ocorrencias/dossie-pdf.tsx`

**Files:**
- Create: `components/ocorrencias/dossie-pdf.tsx`

- [ ] **Step 1: Criar o arquivo**

```tsx
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { DossieFuncionario, TimelineTipo } from '@/app/(admin)/ocorrencias/actions'

const TIPO_LABEL: Record<TimelineTipo, string> = {
  advertencia: 'Advertência',
  atestado:    'Atestado',
  falta:       'Falta',
  ocorrencia:  'Ocorrência',
}

const TIPO_COLOR: Record<TimelineTipo, string> = {
  advertencia: '#c2410c',
  atestado:    '#2563eb',
  falta:       '#dc2626',
  ocorrencia:  '#9333ea',
}

const s = StyleSheet.create({
  page:            { fontFamily: 'Helvetica', fontSize: 10, padding: 40, color: '#111827' },
  headerRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#111827' },
  companyName:     { fontSize: 20, fontFamily: 'Helvetica-Bold', letterSpacing: 3 },
  companySubtitle: { fontSize: 8, color: '#6b7280', marginTop: 2 },
  regBlock:        { alignItems: 'flex-end' },
  regLabel:        { fontSize: 7, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1 },
  regValue:        { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#111827' },
  title:           { textAlign: 'center', fontSize: 13, fontFamily: 'Helvetica-Bold', letterSpacing: 1, marginVertical: 14, borderWidth: 1, borderColor: '#111827', paddingVertical: 7, paddingHorizontal: 12 },
  section:         { marginBottom: 14 },
  sectionTitle:    { fontSize: 8, fontFamily: 'Helvetica-Bold', letterSpacing: 1, color: '#6b7280', marginBottom: 6, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  row:             { flexDirection: 'row', marginBottom: 3 },
  label:           { width: 130, fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#374151' },
  value:           { flex: 1, fontSize: 9 },
  resumo:          { fontSize: 9, lineHeight: 1.6, borderWidth: 1, borderColor: '#d1d5db', padding: 8, backgroundColor: '#f9fafb' },
  eventRow:        { flexDirection: 'row', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f3f4f6', gap: 10 },
  eventDate:       { width: 60, fontSize: 8, color: '#6b7280', paddingTop: 1 },
  eventBadge:      { width: 80, fontSize: 7, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', paddingTop: 1 },
  eventBody:       { flex: 1 },
  eventTitulo:     { fontSize: 9, color: '#111827', marginBottom: 2 },
  eventDetalhe:    { fontSize: 8, color: '#6b7280' },
  footer:          { position: 'absolute', bottom: 20, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingTop: 6 },
  footerText:      { fontSize: 7, color: '#9ca3af' },
})

function fmt(iso: string): string {
  if (!iso) return '—'
  const d = iso.split('T')[0].split('-')
  return `${d[2]}/${d[1]}/${d[0]}`
}

function resumoTexto(kpis: DossieFuncionario['kpis']): string {
  return `Registra ${kpis.advertencias} advertência(s), ${kpis.diasAtestado12m} dia(s) de atestado nos últimos 12 meses, ${kpis.faltas} falta(s) e ${kpis.ocorrenciasAbertas} ocorrência(s) aberta(s) no momento da emissão.`
}

function DossieDocument({ dossie }: { dossie: DossieFuncionario }) {
  const idShort = dossie.funcionario.id.substring(0, 8).toUpperCase()
  const emitidoEm = fmt(new Date().toISOString())

  return (
    <Document>
      <Page size="A4" style={s.page}>

        {/* Cabeçalho */}
        <View style={s.headerRow}>
          <View>
            <Text style={s.companyName}>DEMAX</Text>
            <Text style={s.companySubtitle}>Serviços e Comércio LTDA</Text>
          </View>
          <View style={s.regBlock}>
            <Text style={s.regLabel}>Registro</Text>
            <Text style={s.regValue}>{idShort}</Text>
          </View>
        </View>

        <Text style={s.title}>DOSSIÊ DO FUNCIONÁRIO</Text>

        {/* Dados do colaborador */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>DADOS DO COLABORADOR</Text>
          <View style={s.row}>
            <Text style={s.label}>Nome:</Text>
            <Text style={s.value}>{dossie.funcionario.nome}</Text>
          </View>
          <View style={s.row}>
            <Text style={s.label}>RE:</Text>
            <Text style={s.value}>{dossie.funcionario.registro ?? '—'}</Text>
          </View>
          <View style={s.row}>
            <Text style={s.label}>CPF:</Text>
            <Text style={s.value}>***.***.***-**</Text>
          </View>
          <View style={s.row}>
            <Text style={s.label}>Posto de Trabalho:</Text>
            <Text style={s.value}>{dossie.funcionario.posto_nome}</Text>
          </View>
          <View style={s.row}>
            <Text style={s.label}>Secretaria:</Text>
            <Text style={s.value}>{dossie.funcionario.secretaria || '—'}</Text>
          </View>
        </View>

        {/* Resumo */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>RESUMO</Text>
          <Text style={s.resumo}>{resumoTexto(dossie.kpis)}</Text>
        </View>

        {/* Histórico completo */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>HISTÓRICO COMPLETO ({dossie.timeline.length})</Text>
          {dossie.timeline.length === 0 ? (
            <Text style={{ fontSize: 9, color: '#9ca3af' }}>Nenhum registro encontrado.</Text>
          ) : (
            dossie.timeline.map(item => (
              <View key={item.id} style={s.eventRow}>
                <Text style={s.eventDate}>{fmt(item.data)}</Text>
                <Text style={[s.eventBadge, { color: TIPO_COLOR[item.tipo] }]}>{TIPO_LABEL[item.tipo]}</Text>
                <View style={s.eventBody}>
                  <Text style={s.eventTitulo}>{item.titulo}</Text>
                  {item.detalhe ? <Text style={s.eventDetalhe}>{item.detalhe}</Text> : null}
                </View>
              </View>
            ))
          )}
        </View>

        {/* Rodapé */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>DEMAX Serviços e Comércio LTDA</Text>
          <Text style={s.footerText}>Reg. {idShort} · Emitido em {emitidoEm}</Text>
        </View>

      </Page>
    </Document>
  )
}

export async function downloadDossiePDF(dossie: DossieFuncionario): Promise<void> {
  const { pdf } = await import('@react-pdf/renderer')
  const blob = await pdf(<DossieDocument dossie={dossie} />).toBlob()
  const url = URL.createObjectURL(blob)
  const nomeSanitizado = dossie.funcionario.nome
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '')
  const data = new Date().toISOString().split('T')[0]
  const a = document.createElement('a')
  a.href = url
  a.download = `dossie_${nomeSanitizado}_${data}.pdf`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}
```

Nota: a função de sanitização de nome (`.normalize('NFD').replace(/[̀-ͯ]/g, '')...`) é uma cópia literal do mesmo trecho já usado em `components/advertencias/advertencia-pdf.tsx` (`downloadAdvertenciaPDF`) — copie exatamente esse caractere/range, não retipe manualmente (é um intervalo Unicode de diacríticos que não digita bem por engano).

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: nenhum erro se originando em `dossie-pdf.tsx`.

- [ ] **Step 3: Commit**

```bash
git add components/ocorrencias/dossie-pdf.tsx
git commit -m "feat(ocorrencias): PDF do dossiê do funcionário

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 2: Botão "Baixar PDF" no `modal-dossie.tsx`

**Files:**
- Modify: `components/ocorrencias/modal-dossie.tsx`

- [ ] **Step 1: Adicionar o import**

No topo do arquivo, logo abaixo do import de `ModalNovaOcorrencia`:

```tsx
import { ModalNovaOcorrencia } from './modal-nova-ocorrencia'
import { downloadDossiePDF } from './dossie-pdf'
```

- [ ] **Step 2: Trocar o bloco do botão "Nova Ocorrência"**

Localizar este trecho (dentro do `<div className="mb-4 flex flex-wrap items-center justify-between gap-3">`, logo depois do `</div>` que fecha os chips de filtro):

```tsx
                {canWrite && (
                  <button
                    onClick={() => setNovaOpen(true)}
                    className="h-8 rounded-lg bg-slate-900 px-3 text-xs font-semibold uppercase tracking-widest text-white hover:bg-slate-700"
                  >
                    Nova Ocorrência
                  </button>
                )}
```

Substituir por:

```tsx
                <div className="flex gap-2">
                  <button
                    onClick={() => downloadDossiePDF(dossie)}
                    className="h-8 rounded-lg bg-amber-500 px-3 text-xs font-semibold uppercase tracking-widest text-slate-900 hover:bg-amber-400"
                  >
                    Baixar PDF
                  </button>
                  {canWrite && (
                    <button
                      onClick={() => setNovaOpen(true)}
                      className="h-8 rounded-lg bg-slate-900 px-3 text-xs font-semibold uppercase tracking-widest text-white hover:bg-slate-700"
                    >
                      Nova Ocorrência
                    </button>
                  )}
                </div>
```

(O botão "Baixar PDF" fica sempre visível — não depende de `canWrite`, é exportação de leitura, não escrita. `dossie` já está garantido não-nulo nesse ponto do JSX, dentro do bloco `{loading || !dossie ? (...) : (<>...)}`.)

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: zero erros no projeto inteiro.

- [ ] **Step 4: Commit**

```bash
git add components/ocorrencias/modal-dossie.tsx
git commit -m "feat(ocorrencias): botão Baixar PDF no modal do dossiê

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: Build e verificação manual

**Files:** nenhum (apenas verificação)

- [ ] **Step 1: Build de produção**

Run: `npm run build`
Expected: build conclui sem erros.

- [ ] **Step 2: QA manual**

1. Abrir `/ocorrencias`, abrir o dossiê de um funcionário com registros nos 4 tipos (ex: alguém com advertências, atestados e faltas).
2. Clicar "Baixar PDF" — confirmar que baixa um arquivo `dossie_<nome>_<data>.pdf`.
3. Abrir o PDF e conferir: cabeçalho DEMAX, título "DOSSIÊ DO FUNCIONÁRIO", dados do colaborador (nome/RE/CPF mascarado/posto/secretaria), frase de resumo com os números batendo com os cards da tela, e a lista completa do histórico (mesmo que o chip de filtro na tela esteja em algo diferente de "Todos" no momento do clique).
4. Testar com um funcionário sem nenhum registro (dossiê vazio) — confirmar que o PDF gera normalmente, com "Nenhum registro encontrado." na seção de histórico e resumo "0 advertência(s), 0 dia(s)...".
5. Testar como usuário sem permissão de escrita (viewer, se houver usuário de teste) — confirmar que "Baixar PDF" aparece mesmo sem "Nova Ocorrência" ao lado.

---

## Self-Review

**Cobertura da spec:**
- Botão dentro do modal do dossiê, ao lado de "Nova Ocorrência" → Task 2. ✅
- PDF sempre com os 4 tipos completos, ignora filtro de chip da tela → Task 1 usa `dossie.timeline` (não `timelineFiltrada`). ✅
- Resumo descritivo automático a partir dos KPIs → Task 1 (`resumoTexto`). ✅
- Tema visual consistente com `advertencia-pdf.tsx` (cabeçalho DEMAX + registro, rodapé) → Task 1 replica o mesmo `StyleSheet` de seções/cabeçalho/rodapé. ✅
- Nome de arquivo sanitizado, mesmo padrão de `downloadAdvertenciaPDF` → Task 1. ✅
- Sem chamada nova ao servidor → Task 1/2 usam só o `dossie` já em state. ✅

**Consistência de tipos:** `DossieFuncionario` e `TimelineTipo` já existem em `app/(admin)/ocorrencias/actions.ts` (implementados na feature do dossiê) e são só importados aqui, sem redefinição — os campos usados (`funcionario.{id,nome,registro,posto_nome,secretaria}`, `kpis.{advertencias,diasAtestado12m,faltas,ocorrenciasAbertas}`, `timeline[].{id,tipo,data,titulo,detalhe}`) batem exatamente com o que `modal-dossie.tsx` já usa hoje.
