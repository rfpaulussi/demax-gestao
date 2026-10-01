# Considerações ao RH geradas a partir da devolutiva (fluxo sequencial) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar o campo `email_rh` (gerado em paralelo e às vezes vazio) por um fluxo sequencial onde o coordenador primeiro ajusta a devolutiva ao supervisor e só depois, com um botão dedicado, pede à IA para gerar as considerações ao RH a partir dessa devolutiva.

**Architecture:** Espelha o padrão já existente do fluxo "retorno do RH" (`previaRetorno`/`rascunharDevolutivaRetorno`): uma função que prepara e anonimiza a mensagem (contexto da ocorrência + devolutiva, juntos, com os mesmos códigos FUNC_n), uma action de prévia (não chama a IA) e uma action de geração (audita antes de chamar, chama, valida, audita depois). No modal, um pequeno sub-fluxo de 3 passos (`inicial` → `previa` → `gerado`) substitui a caixa que hoje era preenchida automaticamente.

**Tech Stack:** Next.js 14 Server Actions, `@anthropic-ai/sdk` via `lib/acordos/ia/cliente.ts`, Supabase (migração SQL manual), React (`useState`/`useTransition`).

---

## Observação sobre testes

Não há testes automatizados (`*.test.ts`) para `app/(admin)/ocorrencias/ia-actions.ts` nem para os módulos em `lib/ocorrencias/ia/`. Este plano não introduz um padrão de teste novo para essa área — segue o padrão já em uso: verificação via `npx tsc --noEmit`, `npm run build` e teste manual no preview do navegador. Cada task termina com checagem de tipos; a verificação funcional completa (gerar prévia → gerar considerações → encaminhar) acontece na Task 8, depois que todas as peças estão no lugar.

---

### Task 1: Branch e migração SQL

**Files:**
- Create: `supabase/migrations/20261001_consideracoes_rh_tipo.sql`

- [ ] **Step 1: Criar a branch de feature**

```bash
git checkout -b feat/consideracoes-rh-sequencial
```

- [ ] **Step 2: Criar a migração**

```sql
ALTER TABLE ocorrencia_analises_ia
  DROP CONSTRAINT IF EXISTS ocorrencia_analises_ia_tipo_check;

ALTER TABLE ocorrencia_analises_ia
  ADD CONSTRAINT ocorrencia_analises_ia_tipo_check
  CHECK (tipo IN ('analise', 'devolutiva_retorno', 'consideracoes_rh'));
```

- [ ] **Step 3: Avisar o usuário para rodar a migração manualmente no Supabase Studio**

Não aplicar via MCP (projeto errado está conectado). Perguntar ao usuário e esperar confirmação antes de prosseguir para tasks que dependam do novo valor `'consideracoes_rh'` ser aceito em produção — mas o código pode ser escrito e testado localmente mesmo antes da migração rodar, já que o preview local aponta para o mesmo banco Supabase (produção) usado em dev. Por isso: escrever o código normalmente, mas o teste funcional de ponta a ponta (Task 8) só funciona depois que o usuário confirmar que rodou a migração.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20261001_consideracoes_rh_tipo.sql
git commit -m "feat(ocorrencias): adiciona tipo consideracoes_rh à auditoria de IA"
```

---

### Task 2: `lib/ocorrencias/ia/prompt.ts` — remover email_rh, adicionar PROMPT_CONSIDERACOES_RH

**Files:**
- Modify: `lib/ocorrencias/ia/prompt.ts`

- [ ] **Step 1: Atualizar o import do topo**

De:
```typescript
import { NOME_FERRAMENTA_ANALISE, NOME_FERRAMENTA_RETORNO } from './schema'
```
Para:
```typescript
import { NOME_FERRAMENTA_ANALISE, NOME_FERRAMENTA_RETORNO, NOME_FERRAMENTA_CONSIDERACOES_RH } from './schema'
```

(Vai dar erro de import até a Task 3 criar `NOME_FERRAMENTA_CONSIDERACOES_RH` em `schema.ts` — normal, resolve na Task 3.)

- [ ] **Step 2: Ajustar o bullet de tom de escrita (linha 14)**

De:
```
Tom de escrita (vale sobretudo para "devolutiva_supervisor" e "email_rh"):
```
Para:
```
Tom de escrita (vale sobretudo para "devolutiva_supervisor"):
```

- [ ] **Step 3: Remover o bullet de `email_rh` de `PROMPT_ANALISE`**

De:
```typescript
- "devolutiva_supervisor": agradeça o registro, diga o que será feito e o que o supervisor deve fazer agora. Não prometa o que ainda não foi decidido.
- "email_rh": quando encaminhar_rh for true, este campo é OBRIGATÓRIO e NUNCA pode ficar vazio — sempre escreva 2 a 6 frases sobre o motivo e o que se pede ao RH, sem saudação nem assinatura. Termine com uma recomendação objetiva de encaminhamento (ex.: "sugerimos orientação sobre medida disciplinar", "sugerimos acompanhamento formal antes de nova medida") pra ajudar o coordenador a decidir rápido se concorda antes de enviar. Quando encaminhar_rh for false, deixe "" (vazio).`
```
Para:
```typescript
- "devolutiva_supervisor": agradeça o registro, diga o que será feito e o que o supervisor deve fazer agora. Não prometa o que ainda não foi decidido.`
```

- [ ] **Step 4: Adicionar `PROMPT_CONSIDERACOES_RH` no final do arquivo**

Depois de `PROMPT_RETORNO`, adicionar:

```typescript

export const PROMPT_CONSIDERACOES_RH = `${BASE}

Você recebe o contexto da ocorrência e a devolutiva que o coordenador já escreveu para o supervisor. A partir disso, redija o texto de considerações para encaminhar o caso ao RH: 2 a 6 frases, sem saudação nem assinatura, explicando o motivo do encaminhamento e o que se pede ao RH. Termine com uma recomendação objetiva (ex.: "sugerimos orientação sobre medida disciplinar", "sugerimos acompanhamento formal antes de nova medida") para o coordenador decidir rápido se concorda antes de enviar. Baseie-se no que a devolutiva já diz; não contradiga nem invente uma decisão diferente da que o coordenador escreveu. Responda SEMPRE chamando a ferramenta ${NOME_FERRAMENTA_CONSIDERACOES_RH}.`
```

- [ ] **Step 5: Commit (junto com a Task 3, pois o import só compila com schema.ts atualizado)**

Deixar sem commit por ora — commitar junto no fim da Task 3.

---

### Task 3: `lib/ocorrencias/ia/schema.ts` — remover email_rh, adicionar ConsideracoesRH

**Files:**
- Modify: `lib/ocorrencias/ia/schema.ts`

- [ ] **Step 1: Remover o campo `email_rh` de `AnaliseOcorrencia`**

De:
```typescript
  /** Rascunho da devolutiva ao supervisor (ainda com códigos FUNC_n; o servidor restaura os nomes). */
  devolutiva_supervisor: string
  /** Só um bloco de "considerações e pedido ao RH", sem saudação nem assinatura. Vazio se não encaminhar. */
  email_rh: string
  alertas: string[]
```
Para:
```typescript
  /** Rascunho da devolutiva ao supervisor (ainda com códigos FUNC_n; o servidor restaura os nomes). */
  devolutiva_supervisor: string
  alertas: string[]
```

- [ ] **Step 2: Remover a propriedade `email_rh` de `FERRAMENTA_ANALISE.input_schema.properties`**

De:
```typescript
      devolutiva_supervisor: {
        type: 'string',
        description: 'Rascunho respeitoso de resposta ao supervisor, em português, sem afirmar decisões ainda não tomadas.',
      },
      email_rh: {
        type: 'string',
        description: 'Se encaminhar_rh for true: 2 a 6 frases com o motivo do encaminhamento e o que se pede ao RH, SEM saudação e SEM assinatura. Vazio se não encaminhar.',
      },
      alertas: {
```
Para:
```typescript
      devolutiva_supervisor: {
        type: 'string',
        description: 'Rascunho respeitoso de resposta ao supervisor, em português, sem afirmar decisões ainda não tomadas.',
      },
      alertas: {
```

- [ ] **Step 3: Remover a linha `email_rh` de `lerAnalise`**

De:
```typescript
    devolutiva_supervisor: texto(o.devolutiva_supervisor, 3000),
    email_rh: encaminhar ? texto(o.email_rh, 3000) : '',
    alertas: listaTextos(o.alertas, 6, 200),
```
Para:
```typescript
    devolutiva_supervisor: texto(o.devolutiva_supervisor, 3000),
    alertas: listaTextos(o.alertas, 6, 200),
```

- [ ] **Step 4: Adicionar tipo, nome de ferramenta, tool e validador de considerações ao RH**

No final do arquivo, depois de `lerRetorno`:

```typescript

export interface ConsideracoesRH {
  consideracoes_rh: string
}

export const NOME_FERRAMENTA_CONSIDERACOES_RH = 'redigir_consideracoes_rh'

export const FERRAMENTA_CONSIDERACOES_RH: Anthropic.Tool = {
  name: NOME_FERRAMENTA_CONSIDERACOES_RH,
  description:
    'Redige as considerações para encaminhar uma ocorrência ao RH, a partir da devolutiva que o coordenador já escreveu ao supervisor.',
  input_schema: {
    type: 'object' as const,
    properties: {
      consideracoes_rh: {
        type: 'string',
        description: '2 a 6 frases sobre o motivo do encaminhamento e o que se pede ao RH, SEM saudação e SEM assinatura, terminando com uma recomendação objetiva.',
      },
    },
    required: ['consideracoes_rh'],
  },
}

export function lerConsideracoesRH(bruto: unknown): ConsideracoesRH | null {
  if (!bruto || typeof bruto !== 'object' || Array.isArray(bruto)) return null
  const o = bruto as Record<string, unknown>
  const consideracoes = texto(o.consideracoes_rh, 3000)
  if (!consideracoes) return null
  return { consideracoes_rh: consideracoes }
}
```

Importante: `NOME_FERRAMENTA_CONSIDERACOES_RH` precisa estar declarado **antes** de ser usado por `prompt.ts` (que o importa) — como `schema.ts` e `prompt.ts` são arquivos separados, a ordem dentro de `schema.ts` não importa para isso, só precisa existir como export.

- [ ] **Step 5: Verificar tipos**

```bash
npx tsc --noEmit
```
Esperado: ainda vai dar erro em `app/(admin)/ocorrencias/ia-actions.ts` (usa `email_rh` em `restaurarAnalise`) e em `components/ocorrencias/modal-analise-ia.tsx` — normal, resolvido nas Tasks 5 e 6. Confirmar que **não há mais erro** em `lib/ocorrencias/ia/prompt.ts` nem `lib/ocorrencias/ia/schema.ts`.

- [ ] **Step 6: Commit (Tasks 2 e 3 juntas)**

```bash
git add lib/ocorrencias/ia/prompt.ts lib/ocorrencias/ia/schema.ts
git commit -m "feat(ocorrencias): remove email_rh do schema de análise, adiciona schema de considerações ao RH"
```

---

### Task 4: `lib/ocorrencias/ia/contexto.ts` — novo helper de contexto

**Files:**
- Modify: `lib/ocorrencias/ia/contexto.ts`

- [ ] **Step 1: Adicionar `montarContextoConsideracoesRH` no final do arquivo**

```typescript

export function montarContextoConsideracoesRH(p: { contexto: string; devolutivaAnonima: string }): string {
  return [p.contexto, '', 'Devolutiva que o coordenador escreveu ao supervisor:', p.devolutivaAnonima].join('\n')
}
```

- [ ] **Step 2: Verificar tipos**

```bash
npx tsc --noEmit
```
Esperado: nenhum novo erro introduzido por este arquivo.

- [ ] **Step 3: Commit**

```bash
git add lib/ocorrencias/ia/contexto.ts
git commit -m "feat(ocorrencias): adiciona montarContextoConsideracoesRH"
```

---

### Task 5: `app/(admin)/ocorrencias/ia-actions.ts` — actions de prévia e geração

**Files:**
- Modify: `app/(admin)/ocorrencias/ia-actions.ts`

- [ ] **Step 1: Atualizar imports do topo**

De:
```typescript
import { montarContexto, montarContextoRetorno } from '@/lib/ocorrencias/ia/contexto'
import { PROMPT_ANALISE, PROMPT_RETORNO } from '@/lib/ocorrencias/ia/prompt'
import {
  FERRAMENTA_ANALISE,
  FERRAMENTA_RETORNO,
  lerAnalise,
  lerRetorno,
  type AnaliseOcorrencia,
} from '@/lib/ocorrencias/ia/schema'
```
Para:
```typescript
import { montarContexto, montarContextoRetorno, montarContextoConsideracoesRH } from '@/lib/ocorrencias/ia/contexto'
import { PROMPT_ANALISE, PROMPT_RETORNO, PROMPT_CONSIDERACOES_RH } from '@/lib/ocorrencias/ia/prompt'
import {
  FERRAMENTA_ANALISE,
  FERRAMENTA_RETORNO,
  FERRAMENTA_CONSIDERACOES_RH,
  lerAnalise,
  lerRetorno,
  lerConsideracoesRH,
  type AnaliseOcorrencia,
} from '@/lib/ocorrencias/ia/schema'
```

- [ ] **Step 2: Remover a linha `email_rh` de `restaurarAnalise`**

De:
```typescript
function restaurarAnalise(a: AnaliseOcorrencia, nomes: Record<string, string>): AnaliseOcorrencia {
  const r = (t: string) => restaurarNomes(t, nomes)
  return {
    ...a,
    resumo: r(a.resumo),
    resolucao_sugerida: a.resolucao_sugerida.map(r),
    motivo_rh: a.motivo_rh ? r(a.motivo_rh) : null,
    devolutiva_supervisor: r(a.devolutiva_supervisor),
    email_rh: r(a.email_rh),
    alertas: a.alertas.map(r),
  }
}
```
Para:
```typescript
function restaurarAnalise(a: AnaliseOcorrencia, nomes: Record<string, string>): AnaliseOcorrencia {
  const r = (t: string) => restaurarNomes(t, nomes)
  return {
    ...a,
    resumo: r(a.resumo),
    resolucao_sugerida: a.resolucao_sugerida.map(r),
    motivo_rh: a.motivo_rh ? r(a.motivo_rh) : null,
    devolutiva_supervisor: r(a.devolutiva_supervisor),
    alertas: a.alertas.map(r),
  }
}
```

- [ ] **Step 3: Verificar tipos (checkpoint intermediário)**

```bash
npx tsc --noEmit
```
Esperado: erro de `email_rh` em `ia-actions.ts` resolvido. Ainda deve sobrar erro em `components/ocorrencias/modal-analise-ia.tsx` (Task 6).

- [ ] **Step 4: Atualizar o tipo `AnaliseHistorico['tipo']`**

De:
```typescript
export type AnaliseHistorico = {
  id: string
  created_at: string
  tipo: 'analise' | 'devolutiva_retorno'
  decisao: 'pendente' | 'aprovada' | 'reprovada'
  categoria: string | null
}
```
Para:
```typescript
export type AnaliseHistorico = {
  id: string
  created_at: string
  tipo: 'analise' | 'devolutiva_retorno' | 'consideracoes_rh'
  decisao: 'pendente' | 'aprovada' | 'reprovada'
  categoria: string | null
}
```

E no corpo de `listarAnalises`, o `.map` que tipa `resultado` como `{ id: string; created_at: string; tipo: AnaliseHistorico['tipo']; ... }` já referencia `AnaliseHistorico['tipo']` — não precisa de outra mudança ali, o tipo é propagado automaticamente.

- [ ] **Step 5: Adicionar `prepararMensagemConsideracoesRH` depois de `prepararMensagemRetorno`**

Localizar a função `prepararMensagemRetorno` (que usa `SEPARADOR_RESPOSTA_RH`, `validarTexto`, `carregarBase`, `anonimizarOcorrencia`, `carregarPessoas`, `montarContexto`, `montarContextoRetorno`) e adicionar imediatamente depois:

```typescript

async function prepararMensagemConsideracoesRH(ocorrenciaId: string, devolutivaFinal: string): Promise<MensagemRetorno> {
  const validado = validarTexto(devolutivaFinal)
  if (!validado.ok) return { ok: false, error: validado.error }
  if (validado.texto.includes(SEPARADOR_RESPOSTA_RH.trim())) {
    return { ok: false, error: 'O texto contém um trecho reservado. Remova "<<<SEPARADOR_RESPOSTA_RH>>>".' }
  }

  const base = await carregarBase(ocorrenciaId)
  if (!base) return { ok: false, error: 'Ocorrência não encontrada' }

  const junto = anonimizarOcorrencia(`${base.descricao}${SEPARADOR_RESPOSTA_RH}${validado.texto}`, await carregarPessoas())
  const partes = junto.texto.split(SEPARADOR_RESPOSTA_RH)
  if (partes.length !== 2) return { ok: false, error: 'Não foi possível preparar o texto para a IA.' }

  const contexto = montarContexto({
    funcao: base.funcao,
    dataOcorrencia: base.dataOcorrencia,
    gravidade: base.gravidade,
    textoAnonimo: partes[0],
    historico: base.historico,
  })
  return { ok: true, mensagem: montarContextoConsideracoesRH({ contexto, devolutivaAnonima: partes[1] }), nomes: junto.nomes }
}
```

(Reaproveita o tipo `MensagemRetorno` já existente no arquivo — não precisa criar tipo novo.)

- [ ] **Step 6: Adicionar `previaConsideracoesRH` depois de `previaRetorno`**

```typescript

export type PreviaConsideracoesRH =
  | { success: true; mensagem: string; iaConfigurada: boolean }
  | { success: false; error: string }

// Prévia das considerações ao RH: mostra o texto exato que iria à IA. Nada é enviado.
export async function previaConsideracoesRH(ocorrenciaId: string, devolutivaFinal: string): Promise<PreviaConsideracoesRH> {
  const guard = await requireRole(['admin', 'coordenador'])
  if (!guard.success) return { success: false, error: guard.error }

  const preparada = await prepararMensagemConsideracoesRH(ocorrenciaId, devolutivaFinal)
  if (!preparada.ok) return { success: false, error: preparada.error }
  return { success: true, mensagem: preparada.mensagem, iaConfigurada: iaConfigurada() }
}
```

- [ ] **Step 7: Adicionar `gerarConsideracoesRH` depois de `previaConsideracoesRH`**

```typescript

export type ResultadoConsideracoesRH =
  | { success: true; analiseId: string; consideracoes: string }
  | { success: false; error: string }

export async function gerarConsideracoesRH(ocorrenciaId: string, devolutivaFinal: string): Promise<ResultadoConsideracoesRH> {
  const guard = await requireRole(['admin', 'coordenador'])
  if (!guard.success) return { success: false, error: guard.error }
  const { auth } = guard

  if (!iaConfigurada()) return { success: false, error: 'A IA não está configurada neste ambiente (falta ANTHROPIC_API_KEY).' }
  if (!dentroDoLimite(auth.user.id)) {
    return { success: false, error: 'Muitas análises em pouco tempo. Aguarde alguns minutos.' }
  }

  const preparada = await prepararMensagemConsideracoesRH(ocorrenciaId, devolutivaFinal)
  if (!preparada.ok) return { success: false, error: preparada.error }
  const { mensagem, nomes } = preparada

  const auditoriaId = await abrirAuditoria({
    ocorrenciaId,
    tipo: 'consideracoes_rh',
    userId: auth.user.id,
    textoEnviado: mensagem,
    mapa: nomes,
  })
  if (!auditoriaId) {
    return { success: false, error: 'Não foi possível registrar a auditoria. Nada foi enviado à IA.' }
  }

  try {
    const resp = await chamarFerramenta(PROMPT_CONSIDERACOES_RH, FERRAMENTA_CONSIDERACOES_RH, mensagem, opcoesIA())
    const resultado = lerConsideracoesRH(resp.entrada)
    if (!resultado) {
      await falharAuditoria(auditoriaId, 'Resposta da IA fora do formato', resp)
      return { success: false, error: 'A IA devolveu uma resposta fora do formato. Tente de novo.' }
    }

    await fecharAuditoria(auditoriaId, resp, resultado)
    return {
      success: true,
      analiseId: auditoriaId,
      consideracoes: restaurarNomes(resultado.consideracoes_rh, nomes),
    }
  } catch (e) {
    const erro = mensagemErroIA(e)
    await falharAuditoria(auditoriaId, erro)
    return { success: false, error: erro }
  }
}
```

- [ ] **Step 8: Verificar tipos**

```bash
npx tsc --noEmit
```
Esperado: nenhum erro em `ia-actions.ts`. Deve sobrar só o erro em `modal-analise-ia.tsx` (Task 6).

- [ ] **Step 9: Commit**

```bash
git add "app/(admin)/ocorrencias/ia-actions.ts"
git commit -m "feat(ocorrencias): actions de prévia e geração das considerações ao RH"
```

---

### Task 6: `components/ocorrencias/modal-analise-ia.tsx` — UI do fluxo sequencial

**Files:**
- Modify: `components/ocorrencias/modal-analise-ia.tsx`

- [ ] **Step 1: Atualizar o import de `ia-actions`**

De:
```typescript
import {
  previaAnalise,
  analisarOcorrencia,
  rascunharDevolutivaRetorno,
  previaRetorno,
  decidirAnalise,
  listarAnalises,
  type AnaliseHistorico,
} from '@/app/(admin)/ocorrencias/ia-actions'
```
Para:
```typescript
import {
  previaAnalise,
  analisarOcorrencia,
  rascunharDevolutivaRetorno,
  previaRetorno,
  previaConsideracoesRH,
  gerarConsideracoesRH,
  decidirAnalise,
  listarAnalises,
  type AnaliseHistorico,
} from '@/app/(admin)/ocorrencias/ia-actions'
```

- [ ] **Step 2: Adicionar estado novo**

Depois da linha `const [pontos, setPontos] = useState<string[]>([])`, adicionar:
```typescript
  const [passoRH, setPassoRH] = useState<'inicial' | 'previa' | 'gerado'>('inicial')
  const [mensagemRH, setMensagemRH] = useState('')
```

- [ ] **Step 3: Remover o preenchimento automático de `consideracoes` em `handleAnalisar`**

De:
```typescript
  function handleAnalisar() {
    setErro(null)
    startTransition(async () => {
      const r = await analisarOcorrencia(ocorrenciaId)
      if (!r.success) { setErro(r.error); return }
      setAnaliseId(r.analiseId)
      setAnalise(r.analise)
      setDevolutiva(r.analise.devolutiva_supervisor)
      setConsideracoes(r.analise.email_rh)
    })
  }
```
Para:
```typescript
  function handleAnalisar() {
    setErro(null)
    startTransition(async () => {
      const r = await analisarOcorrencia(ocorrenciaId)
      if (!r.success) { setErro(r.error); return }
      setAnaliseId(r.analiseId)
      setAnalise(r.analise)
      setDevolutiva(r.analise.devolutiva_supervisor)
    })
  }
```

- [ ] **Step 4: Adicionar os dois handlers novos, depois de `handleRascunharRetorno`**

```typescript

  function handlePreviaConsideracoesRH() {
    setErro(null)
    startTransition(async () => {
      const r = await previaConsideracoesRH(ocorrenciaId, devolutiva)
      if (!r.success) { setErro(r.error); return }
      setMensagemRH(r.mensagem)
      setIaOk(r.iaConfigurada)
      setPassoRH('previa')
    })
  }

  function handleGerarConsideracoesRH() {
    setErro(null)
    startTransition(async () => {
      const r = await gerarConsideracoesRH(ocorrenciaId, devolutiva)
      if (!r.success) { setErro(r.error); return }
      setConsideracoes(r.consideracoes)
      setPassoRH('gerado')
    })
  }
```

- [ ] **Step 5: Substituir o bloco da caixa de considerações**

De:
```tsx
              {analise?.encaminhar_rh && (
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-widest text-gray-400">
                    Considerações para o e-mail ao RH (entram no rascunho do e-mail)
                  </label>
                  <textarea value={consideracoes} onChange={e => setConsideracoes(e.target.value)} rows={4} className={textareaClass} />
                </div>
              )}
```
Para:
```tsx
              {analise && passoRH === 'inicial' && (
                <div className="flex justify-end">
                  <button
                    disabled={isPending || !devolutiva.trim()}
                    onClick={handlePreviaConsideracoesRH}
                    className="h-9 rounded-lg border border-indigo-200 px-4 text-xs font-semibold uppercase tracking-widest text-indigo-600 hover:bg-indigo-50 disabled:opacity-50"
                  >
                    Gerar considerações ao RH
                  </button>
                </div>
              )}

              {analise && passoRH === 'previa' && (
                <div className="space-y-2 rounded-lg border border-indigo-100 bg-indigo-50/50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
                    Texto exato que vai para a IA (confira antes de enviar)
                  </p>
                  <pre className="max-h-56 overflow-y-auto whitespace-pre-wrap rounded-lg border border-gray-200 bg-white p-3 text-xs text-gray-700">
                    {mensagemRH}
                  </pre>
                  {!iaOk && <p className="text-xs text-red-500">A IA não está configurada neste ambiente.</p>}
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setPassoRH('inicial')} className="h-9 rounded-lg border border-gray-200 px-4 text-xs font-semibold uppercase tracking-widest text-gray-500 hover:bg-gray-50">
                      Voltar
                    </button>
                    <button
                      disabled={isPending || !iaOk}
                      onClick={handleGerarConsideracoesRH}
                      className="h-9 rounded-lg bg-indigo-600 px-4 text-xs font-semibold uppercase tracking-widest text-white hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {isPending ? 'Gerando…' : 'Enviar para a IA'}
                    </button>
                  </div>
                </div>
              )}

              {analise && passoRH === 'gerado' && (
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-widest text-gray-400">
                    Considerações para o e-mail ao RH (edite antes de encaminhar)
                  </label>
                  <textarea value={consideracoes} onChange={e => setConsideracoes(e.target.value)} rows={4} className={textareaClass} />
                </div>
              )}
```

- [ ] **Step 6: Trocar o gate do botão "Encaminhar ao RH"**

De:
```tsx
                  {analise?.encaminhar_rh && (
                    <button disabled={isPending} onClick={handleEncaminhar} className="h-9 rounded-lg bg-indigo-600 px-4 text-xs font-semibold uppercase tracking-widest text-white hover:bg-indigo-700 disabled:opacity-50">
                      Encaminhar ao RH
                    </button>
                  )}
```
Para:
```tsx
                  {passoRH === 'gerado' && (
                    <button disabled={isPending} onClick={handleEncaminhar} className="h-9 rounded-lg bg-indigo-600 px-4 text-xs font-semibold uppercase tracking-widest text-white hover:bg-indigo-700 disabled:opacity-50">
                      Encaminhar ao RH
                    </button>
                  )}
```

- [ ] **Step 7: Verificar que o badge e o bloco "Por que encaminhar ao RH" não mudaram**

Confirmar que as linhas 253-266 (badges, incluindo "Sugere encaminhar ao RH" / "Não precisa ir ao RH") e 294-299 (`motivo_rh`) continuam intactas — nenhuma edição nelas.

- [ ] **Step 8: Verificar tipos**

```bash
npx tsc --noEmit
```
Esperado: nenhum erro em nenhum arquivo do projeto.

- [ ] **Step 9: Commit**

```bash
git add components/ocorrencias/modal-analise-ia.tsx
git commit -m "feat(ocorrencias): UI do fluxo sequencial de considerações ao RH"
```

---

### Task 7: Build completo

**Files:** nenhum (só verificação)

- [ ] **Step 1: Rodar o build de produção**

```bash
npm run build
```
Esperado: build passa sem erros. Se houver erro, voltar à task correspondente e corrigir antes de seguir.

- [ ] **Step 2: Se o build passar sem alterações de código, não há o que commitar nesta task.**

---

### Task 8: Teste manual no preview

**Files:** nenhum (só verificação)

Pré-requisito: usuário confirmou que rodou a migração `20261001_consideracoes_rh_tipo.sql` no Supabase Studio (Task 1, Step 3). Sem isso, `gerarConsideracoesRH` vai falhar ao tentar inserir `tipo: 'consideracoes_rh'` (violação do CHECK).

- [ ] **Step 1: Iniciar o servidor de dev e abrir uma ocorrência com análise de IA pendente**

Abrir `/ocorrencias`, escolher um funcionário com ocorrência aberta, abrir o modal "Analisar com IA".

- [ ] **Step 2: Rodar a análise inicial**

Clicar "Enviar para análise". Confirmar que:
- a caixa de devolutiva aparece preenchida;
- **não aparece** mais nenhuma caixa de "considerações" preenchida automaticamente;
- aparece o botão "Gerar considerações ao RH" (independente do que o badge "Sugere encaminhar ao RH" / "Não precisa ir ao RH" mostrar).

- [ ] **Step 3: Editar a devolutiva e gerar as considerações**

Editar o texto da devolutiva. Clicar "Gerar considerações ao RH". Confirmar que aparece a prévia do texto exato (contexto anonimizado + a devolutiva editada, anonimizada). Clicar "Enviar para a IA". Confirmar que:
- aparece a caixa editável "Considerações para o e-mail ao RH" preenchida;
- aparece o botão "Encaminhar ao RH".

- [ ] **Step 4: Encaminhar ao RH**

Clicar "Encaminhar ao RH". Confirmar que abre o modal de e-mail com as considerações geradas dentro, igual ao comportamento anterior.

- [ ] **Step 5: Confirmar que "Aprovar devolutiva" continua funcionando isoladamente**

Em outra ocorrência (ou reabrindo a mesma antes de decidir), confirmar que dá para aprovar e postar a devolutiva sem nunca clicar em "Gerar considerações ao RH".

---

### Task 9: Merge e push (com autorização)

**Files:** nenhum (só git)

- [ ] **Step 1: Perguntar ao usuário se pode fazer merge para master e push**

Não executar sem confirmação explícita, conforme regra do projeto (`CLAUDE.md`: "Nunca fazer sem confirmação explícita" para qualquer operação git que altere o remoto).

- [ ] **Step 2: Merge**

```bash
git checkout master
git merge feat/consideracoes-rh-sequencial
```

- [ ] **Step 3: Push (só com autorização confirmada)**

```bash
git push origin master
```

---

## Self-Review

1. **Cobertura da spec:** migração SQL (Task 1), prompt.ts (Task 2), schema.ts (Task 3), contexto.ts (Task 4), ia-actions.ts — prévia + geração + restaurarAnalise + AnaliseHistorico (Task 5), modal-analise-ia.tsx — UI completa incluindo botão sempre disponível, prévia, geração, gate do "Encaminhar ao RH" (Task 6). Todas as seções do spec têm task correspondente.
2. **Placeholders:** nenhum "TBD"/"similar to"/"add validation" — todo código é literal e completo.
3. **Consistência de tipos:** `ConsideracoesRH`/`lerConsideracoesRH`/`FERRAMENTA_CONSIDERACOES_RH`/`NOME_FERRAMENTA_CONSIDERACOES_RH` (Task 3) usados identicamente em `prompt.ts` (Task 2) e `ia-actions.ts` (Task 5). `previaConsideracoesRH`/`gerarConsideracoesRH` (Task 5) importados e chamados com a mesma assinatura em `modal-analise-ia.tsx` (Task 6). `passoRH`/`mensagemRH` usados de forma consistente em todos os steps da Task 6.
