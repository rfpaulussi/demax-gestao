# Nível recomendado + Admissão no dossiê + Comunicado de Desligamento Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A análise de IA ganha um nível recomendado (orientar/advertir/suspender/dispensar) com aviso sobre dispensa; o dossiê mostra a data de admissão; admin/coordenador ganha um botão no dossiê pra gerar o PDF do Comunicado de Desligamento pré-preenchido com o que o sistema já sabe.

**Architecture:** Três mudanças independentes no mesmo módulo de ocorrências: (1) campo novo no schema/prompt/UI da IA já existente; (2) uma coluna extra numa query já existente + uma linha de texto no cabeçalho; (3) componente PDF novo (mesmo padrão de `advertencia-pdf.tsx`) + botão condicionado a `ehGestao` (flag que já existe no `modal-dossie.tsx`).

**Tech Stack:** Next.js 14, Server Actions, TypeScript, Tailwind, `@react-pdf/renderer`, Vitest.

**Referência:** spec em `docs/superpowers/specs/2026-09-30-nivel-recomendado-admissao-comunicado-design.md`.

**Antes de começar:** criar branch nova (`git checkout -b feature/nivel-admissao-comunicado`). Não implementar direto no `master`.

**Convenções do projeto:** `createClient()` é síncrono; tabelas/colunas usam cast `as unknown as AnyClient` onde já se aplica; testes com `npm test` (Vitest); commits terminam com `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`; ignorar avisos `failed to delete '.git/worktrees/wt-*'` e LF/CRLF (arquivos existentes usam CRLF — editar pontualmente com Edit, nunca reescrever inteiro por script).

---

## Task 1: `nivel_recomendado` no schema e prompt da IA (TDD)

**Files:**
- Modify: `lib/ocorrencias/ia/schema.test.ts`
- Modify: `lib/ocorrencias/ia/schema.ts`
- Modify: `lib/ocorrencias/ia/prompt.ts`

- [ ] **Step 1: Adicionar os testes que falham**

Em `lib/ocorrencias/ia/schema.test.ts`, no import do topo, trocar:
```typescript
import { lerAnalise, lerRetorno, CATEGORIAS, URGENCIAS } from './schema'
```
por:
```typescript
import { lerAnalise, lerRetorno, CATEGORIAS, URGENCIAS, NIVEIS_RECOMENDADOS } from './schema'
```

No objeto `valida` (usado em várias asserções do arquivo), acrescentar o campo:
```typescript
const valida = {
  categoria: 'saude',
  urgencia: 'alta',
  nivel_recomendado: 'advertir',
  resumo: 'Colaboradora teve três crises em nove dias.',
  resolucao_sugerida: ['Contatar familiar', 'Agendar consulta no ambulatório'],
  encaminhar_rh: true,
  motivo_rh: 'Recorrência de episódios de saúde.',
  devolutiva_supervisor: 'Obrigado pelo registro. Vamos acompanhar.',
  email_rh: 'Solicito orientação sobre o acompanhamento.',
  alertas: ['Cita dado de saúde'],
}
```

Dentro do `describe('lerAnalise', ...)`, acrescentar estes casos (no fim do describe, antes do `})` que fecha):
```typescript
  it('aceita os 4 níveis recomendados', () => {
    for (const nivel of NIVEIS_RECOMENDADOS) {
      expect(lerAnalise({ ...valida, nivel_recomendado: nivel })?.nivel_recomendado).toBe(nivel)
    }
  })

  it('recusa nivel_recomendado fora da lista', () => {
    expect(lerAnalise({ ...valida, nivel_recomendado: 'demitir' })).toBeNull()
  })

  it('as combinações de nível são as 4 esperadas, nesta ordem', () => {
    expect([...NIVEIS_RECOMENDADOS]).toEqual(['orientar', 'advertir', 'suspender', 'dispensar'])
  })
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run lib/ocorrencias/ia/schema.test.ts`
Expected: FAIL — `NIVEIS_RECOMENDADOS` não existe, e os testes de `nivel_recomendado` falham porque `lerAnalise` não valida esse campo.

- [ ] **Step 3: Implementar em `schema.ts`**

Depois da linha `export type Urgencia = (typeof URGENCIAS)[number]`, adicionar:
```typescript
export const NIVEIS_RECOMENDADOS = ['orientar', 'advertir', 'suspender', 'dispensar'] as const
export type NivelRecomendado = (typeof NIVEIS_RECOMENDADOS)[number]
```

Em `AnaliseOcorrencia`, adicionar o campo logo depois de `urgencia: Urgencia`:
```typescript
export interface AnaliseOcorrencia {
  categoria: Categoria
  urgencia: Urgencia
  nivel_recomendado: NivelRecomendado
  resumo: string
  resolucao_sugerida: string[]
  encaminhar_rh: boolean
  motivo_rh: string | null
  devolutiva_supervisor: string
  email_rh: string
  alertas: string[]
}
```

Em `FERRAMENTA_ANALISE.input_schema.properties`, adicionar a propriedade logo depois de `urgencia`:
```typescript
      urgencia: { type: 'string', enum: [...URGENCIAS], description: 'baixa, media ou alta.' },
      nivel_recomendado: {
        type: 'string',
        enum: [...NIVEIS_RECOMENDADOS],
        description:
          'Nível de medida que a situação parece pedir: orientar, advertir, suspender ou dispensar. ' +
          'Independente de encaminhar_rh — decida os dois campos separadamente.',
      },
```

Em `FERRAMENTA_ANALISE.input_schema.required`, adicionar `'nivel_recomendado'`:
```typescript
    required: ['categoria', 'urgencia', 'nivel_recomendado', 'resumo', 'resolucao_sugerida', 'encaminhar_rh', 'devolutiva_supervisor', 'alertas'],
```

Em `lerAnalise`, depois da linha `if (!(URGENCIAS as readonly string[]).includes(o.urgencia as string)) return null`, adicionar:
```typescript
  if (!(NIVEIS_RECOMENDADOS as readonly string[]).includes(o.nivel_recomendado as string)) return null
```
E no objeto retornado, adicionar o campo logo depois de `urgencia: o.urgencia as Urgencia,`:
```typescript
    nivel_recomendado: o.nivel_recomendado as NivelRecomendado,
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run lib/ocorrencias/ia/schema.test.ts`
Expected: PASS, todos os testes do arquivo (os já existentes + os 3 novos).

- [ ] **Step 5: Atualizar o prompt**

Em `lib/ocorrencias/ia/prompt.ts`, dentro de `PROMPT_ANALISE`, depois da linha `- "encaminhar_rh": ...`, adicionar:
```typescript
- "nivel_recomendado": independente de "encaminhar_rh" — não force um a partir do outro.
  - orientar: caso pontual, sem padrão recorrente.
  - advertir: já houve conversa/orientação sobre o mesmo tipo de problema antes, sem melhora, ou a gravidade justifica registro formal.
  - suspender: repetição após advertência já registrada, ou gravidade alta com risco à operação.
  - dispensar: só quando o relato E o histórico mostram padrão recorrente do MESMO problema, já tratado antes (conversa, mudança de setor, advertência) e sem melhora. Nunca por um episódio isolado, mesmo que grave.
```

- [ ] **Step 6: Verificar**

Run: `npx tsc --noEmit` — Expected: sem erros (o erro esperado aqui seria em `ia-actions.ts`/`modal-analise-ia.tsx`, que ainda não leem o campo novo — mas como ele é só mais um campo do mesmo objeto, sem quebrar nada que já existe, não deve dar erro).
Run: `npm test` — Expected: tudo passa.

- [ ] **Step 7: Commit**

```bash
git add lib/ocorrencias/ia/schema.ts lib/ocorrencias/ia/schema.test.ts lib/ocorrencias/ia/prompt.ts
git commit -m "feat(ocorrencias): nivel_recomendado na análise de IA (orientar/advertir/suspender/dispensar)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 2: Selo do nível recomendado na tela de análise

**Files:**
- Modify: `components/ocorrencias/modal-analise-ia.tsx`

- [ ] **Step 1: Import**

No import de tipos do topo do arquivo, trocar:
```tsx
import type { AnaliseOcorrencia } from '@/lib/ocorrencias/ia/schema'
```
por:
```tsx
import type { AnaliseOcorrencia, NivelRecomendado } from '@/lib/ocorrencias/ia/schema'
```

- [ ] **Step 2: Rótulos e cores**

Logo depois da constante `URGENCIA_COR` (que já existe no arquivo), adicionar:
```tsx
const NIVEL_LABEL: Record<NivelRecomendado, string> = {
  orientar: 'Orientar', advertir: 'Advertir', suspender: 'Suspender', dispensar: 'Dispensar',
}
const NIVEL_COR: Record<NivelRecomendado, string> = {
  orientar: 'bg-gray-100 text-gray-600',
  advertir: 'bg-amber-100 text-amber-700',
  suspender: 'bg-orange-100 text-orange-700',
  dispensar: 'bg-red-100 text-red-700',
}
```

- [ ] **Step 3: Selo + aviso de dispensa**

Localizar o bloco (dentro de `{analise && ( <> ... )}`):
```tsx
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-700">
                      {CATEGORIA_LABEL[analise.categoria] ?? analise.categoria}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${URGENCIA_COR[analise.urgencia] ?? ''}`}>
                      Urgência {analise.urgencia}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${analise.encaminhar_rh ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'}`}>
                      {analise.encaminhar_rh ? 'Sugere encaminhar ao RH' : 'Não precisa ir ao RH'}
                    </span>
                  </div>
```
Substituir por:
```tsx
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-700">
                      {CATEGORIA_LABEL[analise.categoria] ?? analise.categoria}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${URGENCIA_COR[analise.urgencia] ?? ''}`}>
                      Urgência {analise.urgencia}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${NIVEL_COR[analise.nivel_recomendado]}`}>
                      Nível: {NIVEL_LABEL[analise.nivel_recomendado]}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${analise.encaminhar_rh ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'}`}>
                      {analise.encaminhar_rh ? 'Sugere encaminhar ao RH' : 'Não precisa ir ao RH'}
                    </span>
                  </div>

                  {analise.nivel_recomendado === 'dispensar' && (
                    <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                      Decisão de dispensa é tratada diretamente com o gerente operacional. O sistema não envia nada automaticamente.
                    </p>
                  )}
```

- [ ] **Step 4: Verificar**

Run: `npx tsc --noEmit` — Expected: sem erros.

- [ ] **Step 5: Commit**

```bash
git add components/ocorrencias/modal-analise-ia.tsx
git commit -m "feat(ocorrencias): selo do nível recomendado e aviso de dispensa na tela de IA

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: Data de admissão no dossiê

**Files:**
- Modify: `app/(admin)/ocorrencias/actions.ts`
- Modify: `components/ocorrencias/modal-dossie.tsx`

- [ ] **Step 1: `actions.ts` — tipo `DossieFuncionario`**

Localizar o tipo (por volta da linha 402-410):
```typescript
export type DossieFuncionario = {
  funcionario: {
    id: string
    nome: string
    cpf: string | null
    registro: string | null
    posto_nome: string
    secretaria: string
  }
```
Acrescentar `dataAdmissao` depois de `registro`:
```typescript
export type DossieFuncionario = {
  funcionario: {
    id: string
    nome: string
    cpf: string | null
    registro: string | null
    dataAdmissao: string | null
    posto_nome: string
    secretaria: string
  }
```

- [ ] **Step 2: `actions.ts` — query e montagem do objeto**

Dentro de `getDossieFuncionario`, localizar a query do funcionário:
```typescript
    .select('id, nome, cpf, registro, postos!posto_id(nome, secretaria)')
```
Trocar por:
```typescript
    .select('id, nome, cpf, registro, data_admissao, postos!posto_id(nome, secretaria)')
```

Localizar o cast do resultado dessa query (o objeto `func` tipado manualmente, algo como):
```typescript
  const func = funcRaw as unknown as {
    id: string; nome: string; cpf: string | null; registro: string | null
    postos: { nome: string; secretaria: string | null } | null
  }
```
Trocar por:
```typescript
  const func = funcRaw as unknown as {
    id: string; nome: string; cpf: string | null; registro: string | null; data_admissao: string | null
    postos: { nome: string; secretaria: string | null } | null
  }
```

Localizar o `return` que monta `funcionario: { id: func.id, nome: func.nome, cpf: func.cpf, registro: func.registro, ... }` dentro de `DossieFuncionario`, e acrescentar `dataAdmissao` depois de `registro: func.registro,`:
```typescript
      registro: func.registro,
      dataAdmissao: func.data_admissao,
```

- [ ] **Step 3: `modal-dossie.tsx` — mostrar no cabeçalho**

Localizar:
```tsx
                  <p className="text-sm text-gray-400">
                    {dossie.funcionario.posto_nome} — {dossie.funcionario.secretaria || '—'}
                    {dossie.funcionario.registro && ` · RE ${dossie.funcionario.registro}`}
                    {' · CPF '}{maskCPF(dossie.funcionario.cpf)}
                  </p>
```
Substituir por:
```tsx
                  <p className="text-sm text-gray-400">
                    {dossie.funcionario.posto_nome} — {dossie.funcionario.secretaria || '—'}
                    {dossie.funcionario.registro && ` · RE ${dossie.funcionario.registro}`}
                    {dossie.funcionario.dataAdmissao && ` · Admissão ${new Date(dossie.funcionario.dataAdmissao + 'T12:00:00').toLocaleDateString('pt-BR')}`}
                    {' · CPF '}{maskCPF(dossie.funcionario.cpf)}
                  </p>
```

- [ ] **Step 4: Verificar**

Run: `npx tsc --noEmit` — Expected: sem erros.
Run: `npm test` — Expected: tudo passa.

- [ ] **Step 5: Commit**

```bash
git add "app/(admin)/ocorrencias/actions.ts" components/ocorrencias/modal-dossie.tsx
git commit -m "feat(ocorrencias): mostra data de admissão no cabeçalho do dossiê

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: Componente `comunicado-desligamento-pdf.tsx`

**Files:**
- Create: `components/ocorrencias/comunicado-desligamento-pdf.tsx`

- [ ] **Step 1: Criar o arquivo**

```tsx
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

export type DadosComunicadoDesligamento = {
  nome: string
  registro: string | null
  funcao: string | null
  dataAdmissao: string | null
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
  row:             { flexDirection: 'row', marginBottom: 8 },
  cell:            { flex: 1 },
  label:           { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  value:           { fontSize: 10, color: '#111827' },
  blank:           { fontSize: 10, color: '#9ca3af', borderBottomWidth: 1, borderBottomColor: '#d1d5db', paddingBottom: 2, minHeight: 14 },
  causaGrid:       { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  causaItem:       { flexDirection: 'row', alignItems: 'center', width: '48%', marginBottom: 6 },
  checkbox:        { width: 10, height: 10, borderWidth: 1, borderColor: '#111827', marginRight: 6 },
  causaLabel:      { fontSize: 9, color: '#111827' },
  motivoBox:       { borderWidth: 1, borderColor: '#d1d5db', minHeight: 40, marginTop: 4, padding: 6 },
  sigGrid:         { flexDirection: 'row', marginTop: 24, gap: 8 },
  sigBox:          { flex: 1, borderTopWidth: 1, borderTopColor: '#9ca3af', paddingTop: 6 },
  sigRole:         { fontSize: 7, color: '#6b7280', textAlign: 'center' },
  footer:          { position: 'absolute', bottom: 20, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingTop: 6 },
  footerText:      { fontSize: 7, color: '#9ca3af' },
})

const CAUSAS = [
  'Pedido de Demissão',
  'Reprova na Experiência',
  'Dispensa sem Justa Causa Indenizado',
  'Dispensa com Justa Causa',
  'Dispensa sem Justa Causa Trabalhado',
  'Falecimento',
]

function fmt(iso: string | null): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('T')[0].split('-')
  return `${d}/${m}/${y}`
}

function ComunicadoDocument({ dados }: { dados: DadosComunicadoDesligamento }) {
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
            <Text style={s.regLabel}>Recursos Humanos</Text>
            <Text style={s.regValue}>Comunicação</Text>
          </View>
        </View>

        <Text style={s.title}>COMUNICAÇÃO DE DESLIGAMENTO</Text>

        {/* Colaborador */}
        <View style={s.section}>
          <View style={s.row}>
            <View style={[s.cell, { flex: 2 }]}>
              <Text style={s.label}>Nome</Text>
              <Text style={s.value}>{dados.nome}</Text>
            </View>
            <View style={s.cell}>
              <Text style={s.label}>RE</Text>
              <Text style={s.value}>{dados.registro ?? '—'}</Text>
            </View>
          </View>
          <View style={s.row}>
            <View style={s.cell}>
              <Text style={s.label}>Função</Text>
              <Text style={s.value}>{dados.funcao ?? '—'}</Text>
            </View>
            <View style={s.cell}>
              <Text style={s.label}>Contrato</Text>
              <Text style={s.blank}> </Text>
            </View>
          </View>
        </View>

        {/* Causa */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>CAUSA</Text>
          <View style={s.causaGrid}>
            {CAUSAS.map(c => (
              <View key={c} style={s.causaItem}>
                <View style={s.checkbox} />
                <Text style={s.causaLabel}>{c}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Motivo */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>MOTIVO(S)</Text>
          <View style={s.motivoBox} />
        </View>

        {/* Uniforme / exame */}
        <View style={s.section}>
          <View style={s.row}>
            <View style={s.cell}>
              <Text style={s.label}>Devolução de Uniforme</Text>
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 2 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={s.checkbox} /><Text style={s.causaLabel}>Sim</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={s.checkbox} /><Text style={s.causaLabel}>Não</Text>
                </View>
              </View>
            </View>
            <View style={s.cell}>
              <Text style={s.label}>Exame Demissional</Text>
              <Text style={s.blank}>____/____/____</Text>
            </View>
          </View>
          <View style={s.row}>
            <View style={s.cell}>
              <Text style={s.label}>Data de Admissão</Text>
              <Text style={s.value}>{fmt(dados.dataAdmissao)}</Text>
            </View>
            <View style={s.cell}>
              <Text style={s.label}>Data de Desligamento</Text>
              <Text style={s.blank}>____/____/____</Text>
            </View>
          </View>
          <View style={s.row}>
            <View style={s.cell}>
              <Text style={s.label}>Será Substituído</Text>
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 2 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={s.checkbox} /><Text style={s.causaLabel}>Sim</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={s.checkbox} /><Text style={s.causaLabel}>Não</Text>
                </View>
              </View>
            </View>
            <View style={s.cell} />
          </View>
        </View>

        {/* Assinaturas */}
        <View style={s.sigGrid} wrap={false}>
          {['Diretoria', 'Coordenador', 'Supervisor', 'RH', 'Gerente Operacional'].map(papel => (
            <View key={papel} style={s.sigBox}>
              <Text style={s.sigRole}>{papel}</Text>
            </View>
          ))}
        </View>

        {/* Rodapé */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>DEMAX Serviços e Comércio LTDA</Text>
          <Text style={s.footerText}>Emitido em {emitidoEm}</Text>
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
```

O trecho `.replace(/[̀-ͯ]/g, '')` na sanitização do nome é uma cópia literal do mesmo caractere/intervalo Unicode já usado em `components/advertencias/advertencia-pdf.tsx` (`downloadAdvertenciaPDF`) e em `components/ocorrencias/dossie-pdf.tsx`. Copie esse trecho de um desses dois arquivos com o editor (não retipe à mão — é um intervalo de diacríticos que não se digita de forma confiável).

- [ ] **Step 2: Verificar**

Run: `npx tsc --noEmit` — Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add components/ocorrencias/comunicado-desligamento-pdf.tsx
git commit -m "feat(ocorrencias): PDF do Comunicado de Desligamento (nome/RE/função/admissão preenchidos, resto em branco)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 5: Botão no dossiê (só admin/coordenador)

**Files:**
- Modify: `components/ocorrencias/modal-dossie.tsx`

`ehGestao` já existe como prop do componente (usada nos botões "Encaminhar ao RH"/"Analisar com IA") — não precisa ser criada.

- [ ] **Step 1: Import**

Junto dos outros imports de PDF do arquivo (ao lado de `import { downloadDossiePDF } from './dossie-pdf'`), adicionar:
```tsx
import { downloadComunicadoDesligamentoPDF } from './comunicado-desligamento-pdf'
```

- [ ] **Step 2: Estado de carregamento**

Junto do estado `loadingPdf` já existente (`const [loadingPdf, setLoadingPdf] = useState(false)`), adicionar:
```tsx
  const [loadingComunicado, setLoadingComunicado] = useState(false)
```

- [ ] **Step 3: Handler**

Depois da função `handleBaixarPdf` já existente, adicionar:
```tsx
  async function handleBaixarComunicado() {
    if (!dossie) return
    setLoadingComunicado(true)
    try {
      await downloadComunicadoDesligamentoPDF({
        nome: dossie.funcionario.nome,
        registro: dossie.funcionario.registro,
        funcao: null,
        dataAdmissao: dossie.funcionario.dataAdmissao,
      })
    } finally {
      setLoadingComunicado(false)
    }
  }
```
(`DossieFuncionario.funcionario` não tem o campo `funcao` — o dossiê não carrega isso hoje. Passar `null` é intencional e correto: o PDF já deixa "Função" em branco quando `funcao` é `null`, igual já faz com "Contrato".)

- [ ] **Step 4: Botão**

Localizar o grupo de botões que já tem "Baixar PDF" e "Nova Ocorrência":
```tsx
                <div className="flex gap-2">
                  <button
                    disabled={loadingPdf}
                    onClick={handleBaixarPdf}
                    className="h-8 rounded-lg bg-amber-500 px-3 text-xs font-semibold uppercase tracking-widest text-slate-900 hover:bg-amber-400 disabled:opacity-50"
                  >
                    {loadingPdf ? 'Gerando…' : 'Baixar PDF'}
                  </button>
                  {canWrite && (
                    <button
                      onClick={() => setNovaOpen(true)}
                      className="h-8 rounded-lg bg-slate-900 px-3 text-xs font-semibold uppercase tracking-widest text-white hover:bg-slate-700"
                    >
                      Nova Ocorrência
                    </button>
                  )}
```
Substituir por (acrescenta o botão do comunicado entre os dois, só pra `ehGestao`):
```tsx
                <div className="flex gap-2">
                  <button
                    disabled={loadingPdf}
                    onClick={handleBaixarPdf}
                    className="h-8 rounded-lg bg-amber-500 px-3 text-xs font-semibold uppercase tracking-widest text-slate-900 hover:bg-amber-400 disabled:opacity-50"
                  >
                    {loadingPdf ? 'Gerando…' : 'Baixar PDF'}
                  </button>
                  {ehGestao && (
                    <button
                      disabled={loadingComunicado}
                      onClick={handleBaixarComunicado}
                      className="h-8 rounded-lg bg-red-50 px-3 text-xs font-semibold uppercase tracking-widest text-red-700 hover:bg-red-100 disabled:opacity-50"
                    >
                      {loadingComunicado ? 'Gerando…' : 'Comunicado de Desligamento'}
                    </button>
                  )}
                  {canWrite && (
                    <button
                      onClick={() => setNovaOpen(true)}
                      className="h-8 rounded-lg bg-slate-900 px-3 text-xs font-semibold uppercase tracking-widest text-white hover:bg-slate-700"
                    >
                      Nova Ocorrência
                    </button>
                  )}
```

- [ ] **Step 5: Verificar**

Run: `npx tsc --noEmit` — Expected: sem erros.
Run: `npm test` — Expected: tudo passa.
Run: `git diff --stat components/ocorrencias/modal-dossie.tsx` e confirme que a linha `Registrado por {item.supervisor_nome}` (se existir no arquivo) não foi tocada — a edição deste task é só no bloco de botões do topo e nos imports/estado/handler.

- [ ] **Step 6: Commit**

```bash
git add components/ocorrencias/modal-dossie.tsx
git commit -m "feat(ocorrencias): botão Comunicado de Desligamento no dossiê (só admin/coordenador)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 6: Build e verificação manual

**Files:** nenhum.

- [ ] **Step 1: Build**

Run: `npm run build` — Expected: conclui sem erros.

- [ ] **Step 2: QA manual (admin/coordenador)**
1. Rodar "Analisar com IA" numa ocorrência com histórico recorrente (mesmo tipo de problema já tratado antes, sem melhora): confirmar que aparece o selo "Nível: Dispensar" em vermelho e o aviso sobre o gerente operacional.
2. Rodar numa ocorrência pontual, sem histórico: confirmar que o nível vem "Orientar" ou "Advertir", não "Dispensar".
3. Abrir o dossiê de qualquer funcionário: confirmar "· Admissão dd/mm/aaaa" no cabeçalho, entre o RE e o CPF.
4. Clicar em "Comunicado de Desligamento": confirmar que baixa um PDF com nome/RE/data de admissão preenchidos, "Função" e "Contrato" em branco, as 6 opções de causa como quadradinhos vazios, e as 5 linhas de assinatura (Diretoria/Coordenador/Supervisor/RH/Gerente Operacional) em branco.

- [ ] **Step 3: QA manual (supervisor)**
1. Abrir o dossiê de um funcionário do seu posto: confirmar que **não** aparece o botão "Comunicado de Desligamento" (só "Baixar PDF" e, se aplicável, "Nova Ocorrência").
2. Confirmar que a data de admissão aparece normalmente (não é restrita por papel).

---

## Self-Review

**Cobertura da spec:**
- `nivel_recomendado` no schema/prompt/ferramenta/validação → Task 1. ✅
- Selo + aviso de dispensa na tela → Task 2. ✅
- Data de admissão na query e no tipo do dossiê → Task 3 (`actions.ts`). ✅
- Data de admissão no cabeçalho da tela → Task 3 (`modal-dossie.tsx`). ✅
- PDF do Comunicado com layout do formulário físico, campos preenchidos (nome/RE/função/admissão) e o resto em branco (contrato, causa, motivo, uniforme, exame, será substituído, data desligamento, 5 assinaturas) → Task 4. ✅
- Botão só admin/coordenador, no dossiê (não em Efetivo/Desligamentos) → Task 5 (`ehGestao`, reaproveitado, não recriado). ✅
- Sem e-mail/fluxo de aprovação para o gerente operacional → nenhuma task cria isso (fora de escopo, respeitado). ✅

**Consistência de tipos:** `NivelRecomendado`/`NIVEIS_RECOMENDADOS` (Task 1) usados com os mesmos nomes em `modal-analise-ia.tsx` (Task 2). `DadosComunicadoDesligamento` (Task 4) tem exatamente os 4 campos (`nome`, `registro`, `funcao`, `dataAdmissao`) que `handleBaixarComunicado` (Task 5) preenche a partir de `dossie.funcionario` (Task 3) — `funcao` como `null` de propósito, documentado no Step 3 da Task 5. `dossie.funcionario.dataAdmissao` (Task 3) é o mesmo nome de campo lido em `modal-dossie.tsx` nas Tasks 3 e 5.

**Placeholder scan:** nenhum "TBD"/"depois" — todo campo em branco do PDF é uma decisão explícita da spec (formulário físico continua sendo preenchido à mão nesses campos), não uma pendência.
