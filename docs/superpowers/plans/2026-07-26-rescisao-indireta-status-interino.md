# Status Interino de Rescisão Indireta — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Desdobrar o fluxo existente de solicitação "Rescisão Indireta" em duas etapas — aviso do funcionário (status interino `rescisao_indireta`, aguardando audiência) e desligamento efetivo (via fluxo genérico já existente, após a audiência confirmar) — em vez de finalizar o desligamento no momento do aviso.

**Architecture:** Um novo valor de status (`rescisao_indireta`) é adicionado ao enum `funcionarios.status`. A solicitação de "Rescisão Indireta" (já existente em `Nova Solicitação`) passa a registrar apenas o aviso; ao ser aprovada, move o funcionário para esse status interino (em vez de `desligado`) e grava a data/observação na tabela `afastamentos` (reaproveitando o padrão já usado para o tipo `afastamento`). O desligamento efetivo, quando a audiência confirmar, continua usando o caminho genérico já existente (`Solicitar Desligamento` → Judicial → Rescisão Indireta), sem alterações.

**Tech Stack:** Next.js 14 App Router, Server Actions, Supabase (Postgres via `@supabase/ssr`), TypeScript.

## Global Constraints

- `createClient()` do Supabase é **síncrono** — nunca `await createClient()`.
- Este projeto **não tem suíte de testes automatizados** (sem Jest/Vitest configurado, sem script `test` no `package.json`). Verificação de cada tarefa é feita via `npx tsc --noEmit` (checagem rápida de tipos) e, ao final, `npm run build`. Verificação funcional é manual, via navegador (dev server) e consultas SQL de leitura no Supabase.
- Após qualquer alteração de código, rodar `npm run build` e corrigir todos os erros antes de finalizar (regra do `CLAUDE.md`).
- CPF sempre mascarado na interface — não se aplica diretamente a esta feature (nenhuma tela nova exibe CPF), mas nenhuma tarefa deve introduzir exibição de CPF não mascarado.
- Status de funcionário sempre em minúsculo/snake_case no banco (`rescisao_indireta`, não `RescisaoIndireta` nem `RESCISAO_INDIRETA`).
- Migração SQL deve ser criada como arquivo em `supabase/migrations/` (histórico versionado) **e** aplicada ao projeto Supabase real via MCP — não deixar a migração só no arquivo sem aplicar.

---

### Task 1: Novo status `rescisao_indireta` no banco e nos tipos

**Files:**
- Create: `supabase/migrations/20260726_status_rescisao_indireta.sql`
- Modify: `types/index.ts:140`
- Modify: `components/efetivo/funcionarios-table.tsx:21`

**Interfaces:**
- Produces: valor de status `'rescisao_indireta'` válido em `funcionarios.status` (CHECK constraint do banco), no type `StatusFuncionario` (`types/index.ts`) e no type local `FuncionarioRow['status']` (`components/efetivo/funcionarios-table.tsx`). Tarefas seguintes (2-5) dependem deste valor existir nos três lugares.

- [ ] **Step 1: Criar o arquivo de migração**

Criar `supabase/migrations/20260726_status_rescisao_indireta.sql`:

```sql
-- Adiciona status 'rescisao_indireta' na tabela funcionarios
-- Rescisao_indireta = funcionario avisou que entrou com acao de rescisao
-- indireta (Art. 483 CLT) e parou de trabalhar; aguardando audiencia
-- confirmar o desligamento. Sai da contagem de Ativos, mas so vira
-- 'desligado' quando a audiencia confirmar (fluxo separado).

ALTER TABLE funcionarios
  DROP CONSTRAINT IF EXISTS funcionarios_status_check;

ALTER TABLE funcionarios
  ADD CONSTRAINT funcionarios_status_check
  CHECK (status IN ('ativo', 'atestado', 'afastado', 'ferias', 'desligado', 'faltante', 'rescisao_indireta'));
```

- [ ] **Step 2: Aplicar a migração no projeto Supabase real**

Usar a tool MCP do Supabase (`apply_migration`) com `name: "status_rescisao_indireta"` e o SQL acima, no projeto `fwdhnipekbmeqozkpfyh`.

- [ ] **Step 3: Confirmar que a constraint foi atualizada**

Rodar via MCP `execute_sql`:
```sql
select conname, pg_get_constraintdef(oid) from pg_constraint
where conrelid = 'funcionarios'::regclass and contype = 'c';
```
Esperado: `funcionarios_status_check` incluindo `'rescisao_indireta'::text` na lista.

- [ ] **Step 4: Atualizar `StatusFuncionario` em `types/index.ts`**

Linha 140, hoje:
```ts
export type StatusFuncionario = 'ativo' | 'afastado' | 'ferias' | 'desligado'
```
Substituir por (também inclui `atestado`/`faltante`, que já existem no CHECK do banco mas faltavam neste type):
```ts
export type StatusFuncionario = 'ativo' | 'atestado' | 'afastado' | 'ferias' | 'desligado' | 'faltante' | 'rescisao_indireta'
```

- [ ] **Step 5: Atualizar o type local `FuncionarioRow['status']`**

Em `components/efetivo/funcionarios-table.tsx:21`, hoje:
```ts
status: 'ativo' | 'atestado' | 'afastado' | 'ferias' | 'desligado' | 'faltante' | null
```
Substituir por:
```ts
status: 'ativo' | 'atestado' | 'afastado' | 'ferias' | 'desligado' | 'faltante' | 'rescisao_indireta' | null
```

- [ ] **Step 6: Checar tipos**

Rodar: `npx tsc --noEmit`
Esperado: sem erros novos relacionados a `funcionarios-table.tsx` ou `types/index.ts`. Erros vão aparecer em `STATUS_BADGE`/`STATUS_ROW` (Task 4) — isso é esperado nesta etapa, pois esses `Record` ainda não têm a chave nova. Confirme que o(s) erro(s) reportado(s) são exatamente `Property 'rescisao_indireta' is missing in type` nesses dois objetos e nenhum outro lugar.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260726_status_rescisao_indireta.sql types/index.ts "app/(admin)/efetivo/actions.ts" components/efetivo/funcionarios-table.tsx
git commit -m "feat(efetivo): adiciona status rescisao_indireta ao enum de funcionarios"
```
(Nota: `app/(admin)/efetivo/actions.ts` só entra no commit se você já tiver alterações da Task 2 — se ainda não, remova esse path do `git add`.)

---

### Task 2: Solicitação registra o aviso, não o desligamento

**Files:**
- Modify: `components/efetivo/modal-nova-solicitacao.tsx:418-438`
- Modify: `app/(admin)/efetivo/actions.ts:366-393`

**Interfaces:**
- Consumes: nenhuma dependência de código de outras tasks (só precisa do status válido da Task 1 para não quebrar o fluxo, mas compila independente).
- Produces: `solicitarRescisaoIndireta(fd: FormData)` passa a gravar `dados_depois: { motivo, data_parou_trabalhar, observacao }` em vez de `{ motivo, data_rescisao }`. Task 3 (aprovação) depende desses três nomes de campo exatos.

- [ ] **Step 1: Ajustar os campos do formulário**

Em `components/efetivo/modal-nova-solicitacao.tsx`, localizar o bloco (linhas 418-438):
```tsx
            {/* rescisao_indireta */}
            {tipo === 'rescisao_indireta' && (
              <>
                <div>
                  <label className={labelClass}>Data da Rescisão</label>
                  <input type="date" name="data_rescisao" required className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Motivo</label>
                  <select name="motivo" required className={inputClass}>
                    <option value="">Selecione...</option>
                    <option value="Falta de Pagamento">Falta de Pagamento</option>
                    <option value="Desvio de Função">Desvio de Função</option>
                    <option value="Assédio Moral">Assédio Moral</option>
                    <option value="Condições de Trabalho Inadequadas">Condições de Trabalho Inadequadas</option>
                    <option value="Alteração Contratual Ilícita">Alteração Contratual Ilícita</option>
                    <option value="Outros">Outros</option>
                  </select>
                </div>
              </>
            )}
```

Substituir por:
```tsx
            {/* rescisao_indireta */}
            {tipo === 'rescisao_indireta' && (
              <>
                <div className="rounded border border-purple-200 bg-purple-50 px-3 py-2 text-sm text-purple-700">
                  Isso registra o aviso do funcionário. O desligamento efetivo só deve ser lançado depois que a audiência confirmar a rescisão indireta, usando &quot;Solicitar Desligamento&quot; → Judicial → Rescisão Indireta.
                </div>
                <div>
                  <label className={labelClass}>Data em que Parou de Trabalhar</label>
                  <input type="date" name="data_parou_trabalhar" required className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Motivo</label>
                  <select name="motivo" required className={inputClass}>
                    <option value="">Selecione...</option>
                    <option value="Falta de Pagamento">Falta de Pagamento</option>
                    <option value="Desvio de Função">Desvio de Função</option>
                    <option value="Assédio Moral">Assédio Moral</option>
                    <option value="Condições de Trabalho Inadequadas">Condições de Trabalho Inadequadas</option>
                    <option value="Alteração Contratual Ilícita">Alteração Contratual Ilícita</option>
                    <option value="Outros">Outros</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Observação</label>
                  <textarea name="observacao" rows={3} className={inputClass} placeholder="Detalhes adicionais (opcional)..." />
                </div>
              </>
            )}
```

- [ ] **Step 2: Ajustar `solicitarRescisaoIndireta`**

Em `app/(admin)/efetivo/actions.ts:366-393`, hoje:
```ts
export async function solicitarRescisaoIndireta(fd: FormData): Promise<ActionResult> {
  const supabase = createClient()
  const auth = await getUser()
  if (!auth) return { success: false, error: 'Não autenticado' }
  const funcionario_id = fd.get('funcionario_id') as string
  const motivo         = fd.get('motivo') as string
  const data_rescisao  = fd.get('data_rescisao') as string

  const { data: func } = await supabase
    .from('funcionarios')
    .select('status, posto_id, funcao_id')
    .eq('id', funcionario_id)
    .single()

  const { error } = await supabase.from('solicitacoes').insert({
    funcionario_id,
    tipo:         'rescisao_indireta' as unknown as 'desligamento',
    status:       'pendente',
    supervisor_id: auth.user.id,
    dados_antes:  { status: func?.status ?? null, posto_id: func?.posto_id ?? null, funcao_id: func?.funcao_id ?? null },
    dados_depois: { motivo, data_rescisao },
    motivo,
  })
  if (error) return { success: false, error: error.message }
  revalidatePath('/efetivo')
  revalidatePath('/aprovacoes')
  return { success: true }
}
```

Substituir por:
```ts
export async function solicitarRescisaoIndireta(fd: FormData): Promise<ActionResult> {
  const supabase = createClient()
  const auth = await getUser()
  if (!auth) return { success: false, error: 'Não autenticado' }
  const funcionario_id       = fd.get('funcionario_id') as string
  const motivo               = fd.get('motivo') as string
  const data_parou_trabalhar = fd.get('data_parou_trabalhar') as string
  const observacao           = (fd.get('observacao') as string)?.trim() || null

  const { data: func } = await supabase
    .from('funcionarios')
    .select('status, posto_id, funcao_id')
    .eq('id', funcionario_id)
    .single()

  const { error } = await supabase.from('solicitacoes').insert({
    funcionario_id,
    tipo:         'rescisao_indireta' as unknown as 'desligamento',
    status:       'pendente',
    supervisor_id: auth.user.id,
    dados_antes:  { status: func?.status ?? null, posto_id: func?.posto_id ?? null, funcao_id: func?.funcao_id ?? null },
    dados_depois: { motivo, data_parou_trabalhar, observacao },
    motivo,
  })
  if (error) return { success: false, error: error.message }
  revalidatePath('/efetivo')
  revalidatePath('/aprovacoes')
  return { success: true }
}
```

- [ ] **Step 3: Checar tipos**

Rodar: `npx tsc --noEmit`
Esperado: nenhum erro novo em `modal-nova-solicitacao.tsx` ou `efetivo/actions.ts`.

- [ ] **Step 4: Commit**

```bash
git add components/efetivo/modal-nova-solicitacao.tsx "app/(admin)/efetivo/actions.ts"
git commit -m "feat(efetivo): solicitacao de rescisao indireta registra so o aviso"
```

---

### Task 3: Aprovação move para status interino, não finaliza desligamento

**Files:**
- Modify: `app/(admin)/aprovacoes/actions.ts:216-226` (case `rescisao_indireta`)
- Modify: `app/(admin)/aprovacoes/actions.ts:298` (`campoMap`)

**Interfaces:**
- Consumes: `dados_depois.data_parou_trabalhar`, `dados_depois.motivo`, `dados_depois.observacao` — produzidos pela Task 2. Se a Task 2 não tiver rodado, `dadosDepois.data_parou_trabalhar` será `undefined` (campo não existirá ainda no banco para solicitações antigas — tratado como `string | undefined`, ok).
- Produces: ao aprovar uma solicitação `rescisao_indireta`, `funcionarios.status` vira `'rescisao_indireta'` (não mais `'desligado'`) e é criado um registro em `afastamentos` com `data_inicio`, `motivo`, `solicitacao_id`.

- [ ] **Step 1: Ajustar o case `rescisao_indireta`**

Em `app/(admin)/aprovacoes/actions.ts:216-226`, hoje:
```ts
    case 'rescisao_indireta': {
      await supabase
        .from('funcionarios')
        .update({
          status:              'desligado',
          data_desligamento:   (dadosDepois.data_rescisao as string) ?? null,
          motivo_desligamento: (dadosDepois.motivo as string) ?? sol.motivo ?? 'Rescisão Indireta',
        })
        .eq('id', funcionarioId)
      break
    }
```

Substituir por:
```ts
    case 'rescisao_indireta': {
      await supabase
        .from('funcionarios')
        .update({ status: 'rescisao_indireta' })
        .eq('id', funcionarioId)

      await supabase.from('afastamentos').insert({
        funcionario_id: funcionarioId,
        motivo:         (dadosDepois.observacao as string | null) || (dadosDepois.motivo as string) || sol.motivo || 'Rescisão Indireta — aguardando audiência',
        data_inicio:    dadosDepois.data_parou_trabalhar as string,
        solicitacao_id: id,
      })
      break
    }
```

- [ ] **Step 2: Ajustar a entrada no `campoMap`**

Em `app/(admin)/aprovacoes/actions.ts:298`, hoje:
```ts
    rescisao_indireta:   { campo: 'status',       antes: func?.status ?? null,            depois: 'desligado'  },
```

Substituir por:
```ts
    rescisao_indireta:   { campo: 'status',       antes: func?.status ?? null,            depois: 'rescisao_indireta'  },
```

- [ ] **Step 3: Checar tipos**

Rodar: `npx tsc --noEmit`
Esperado: nenhum erro novo em `aprovacoes/actions.ts`.

- [ ] **Step 4: Commit**

```bash
git add "app/(admin)/aprovacoes/actions.ts"
git commit -m "feat(aprovacoes): aprovar rescisao indireta move para status interino"
```

---

### Task 4: Badges, labels e filtro do novo status

**Files:**
- Modify: `components/efetivo/funcionarios-table.tsx:51-73`
- Modify: `components/efetivo/prontuario-client.tsx:55-60`
- Modify: `components/efetivo/filtros-efetivo.tsx:6-12`
- Modify: `components/efetivo/efetivo-client.tsx:12-24`

**Interfaces:**
- Consumes: valor de status `'rescisao_indireta'` (Task 1).
- Produces: nenhuma interface nova consumida por outras tasks — só exibição.

- [ ] **Step 1: `STATUS_BADGE` e `STATUS_ROW` em `funcionarios-table.tsx`**

Linhas 51-73, hoje:
```ts
const STATUS_BADGE: Record<
  NonNullable<FuncionarioRow['status']>,
  { label: string; className: string }
> = {
  ativo:     { label: 'Ativo',     className: 'bg-green-50 text-green-700 ring-green-200'      },
  atestado:  { label: 'Atestado',  className: 'bg-amber-50 text-amber-700 ring-amber-200'      },
  afastado:  { label: 'Afastado',  className: 'bg-red-50 text-red-700 ring-red-200'            },
  ferias:    { label: 'Férias',    className: 'bg-orange-50 text-orange-700 ring-orange-200'   },
  desligado: { label: 'Desligado', className: 'bg-gray-100 text-gray-500 ring-gray-200'        },
  faltante:  { label: '⚑ FALTANTE', className: 'bg-rose-100 text-rose-800 ring-rose-400 font-bold' },
}

const STATUS_ROW: Record<
  NonNullable<FuncionarioRow['status']>,
  { bg: string; hover: string; borderLeft: string; dimmed: boolean }
> = {
  ativo:     { bg: 'bg-white',    hover: 'hover:bg-gray-50',    borderLeft: '',                                    dimmed: false },
  atestado:  { bg: 'bg-amber-50', hover: 'hover:bg-amber-100',  borderLeft: 'border-l-[3px] border-l-amber-400',  dimmed: false },
  afastado:  { bg: 'bg-red-50',   hover: 'hover:bg-red-100',    borderLeft: 'border-l-[3px] border-l-red-400',    dimmed: false },
  ferias:    { bg: 'bg-blue-50',  hover: 'hover:bg-blue-100',   borderLeft: 'border-l-[3px] border-l-blue-400',   dimmed: false },
  desligado: { bg: 'bg-gray-50',  hover: 'hover:bg-gray-100',   borderLeft: '',                                    dimmed: true  },
  faltante:  { bg: 'bg-rose-50',  hover: 'hover:bg-rose-100',   borderLeft: 'border-l-[3px] border-l-rose-500',   dimmed: false },
}
```

Substituir por (adiciona a chave `rescisao_indireta` nos dois objetos):
```ts
const STATUS_BADGE: Record<
  NonNullable<FuncionarioRow['status']>,
  { label: string; className: string }
> = {
  ativo:             { label: 'Ativo',             className: 'bg-green-50 text-green-700 ring-green-200'      },
  atestado:          { label: 'Atestado',          className: 'bg-amber-50 text-amber-700 ring-amber-200'      },
  afastado:          { label: 'Afastado',          className: 'bg-red-50 text-red-700 ring-red-200'            },
  ferias:            { label: 'Férias',            className: 'bg-orange-50 text-orange-700 ring-orange-200'   },
  desligado:         { label: 'Desligado',         className: 'bg-gray-100 text-gray-500 ring-gray-200'        },
  faltante:          { label: '⚑ FALTANTE',        className: 'bg-rose-100 text-rose-800 ring-rose-400 font-bold' },
  rescisao_indireta: { label: 'Rescisão Indireta', className: 'bg-purple-50 text-purple-700 ring-purple-200'   },
}

const STATUS_ROW: Record<
  NonNullable<FuncionarioRow['status']>,
  { bg: string; hover: string; borderLeft: string; dimmed: boolean }
> = {
  ativo:             { bg: 'bg-white',      hover: 'hover:bg-gray-50',      borderLeft: '',                                      dimmed: false },
  atestado:          { bg: 'bg-amber-50',   hover: 'hover:bg-amber-100',    borderLeft: 'border-l-[3px] border-l-amber-400',    dimmed: false },
  afastado:          { bg: 'bg-red-50',     hover: 'hover:bg-red-100',      borderLeft: 'border-l-[3px] border-l-red-400',      dimmed: false },
  ferias:            { bg: 'bg-blue-50',    hover: 'hover:bg-blue-100',     borderLeft: 'border-l-[3px] border-l-blue-400',     dimmed: false },
  desligado:         { bg: 'bg-gray-50',    hover: 'hover:bg-gray-100',     borderLeft: '',                                      dimmed: true  },
  faltante:          { bg: 'bg-rose-50',    hover: 'hover:bg-rose-100',     borderLeft: 'border-l-[3px] border-l-rose-500',     dimmed: false },
  rescisao_indireta: { bg: 'bg-purple-50',  hover: 'hover:bg-purple-100',   borderLeft: 'border-l-[3px] border-l-purple-400',   dimmed: false },
}
```

- [ ] **Step 2: `STATUS_BADGE` em `prontuario-client.tsx`**

Linhas 55-60, hoje:
```ts
const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  ativo:     { label: 'Ativo',     className: 'bg-green-50  text-green-700  ring-green-200'  },
  afastado:  { label: 'Afastado',  className: 'bg-orange-50 text-orange-700 ring-orange-200' },
  ferias:    { label: 'Férias',    className: 'bg-amber-50  text-amber-700  ring-amber-200'  },
  desligado: { label: 'Desligado', className: 'bg-gray-100  text-gray-500   ring-gray-200'   },
}
```

Substituir por:
```ts
const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  ativo:             { label: 'Ativo',             className: 'bg-green-50  text-green-700  ring-green-200'  },
  afastado:          { label: 'Afastado',          className: 'bg-orange-50 text-orange-700 ring-orange-200' },
  ferias:            { label: 'Férias',            className: 'bg-amber-50  text-amber-700  ring-amber-200'  },
  desligado:         { label: 'Desligado',         className: 'bg-gray-100  text-gray-500   ring-gray-200'   },
  rescisao_indireta: { label: 'Rescisão Indireta', className: 'bg-purple-50 text-purple-700  ring-purple-200' },
}
```

- [ ] **Step 3: `STATUS_LABELS` em `filtros-efetivo.tsx`**

Linhas 6-12, hoje:
```ts
const STATUS_LABELS: Record<string, string> = {
  ativo:     'Ativo',
  atestado:  'Atestado',
  afastado:  'Afastado (INSS)',
  ferias:    'Em Férias',
  desligado: 'Desligado',
}
```

Substituir por:
```ts
const STATUS_LABELS: Record<string, string> = {
  ativo:             'Ativo',
  atestado:          'Atestado',
  afastado:          'Afastado (INSS)',
  ferias:            'Em Férias',
  desligado:         'Desligado',
  rescisao_indireta: 'Rescisão Indireta',
}
```

- [ ] **Step 4: `STATUS_LABELS`/`STATUS_COLORS` em `efetivo-client.tsx`**

Linhas 12-24, hoje:
```ts
const STATUS_LABELS: Record<string, string> = {
  ativo:     'Ativo',
  afastado:  'Afastado',
  ferias:    'Férias',
  desligado: 'Desligado',
}

const STATUS_COLORS: Record<string, { fill: string; color: string }> = {
  ativo:     { fill: 'F0FDF4', color: '15803D' },
  afastado:  { fill: 'FFF1F2', color: 'B91C1C' },
  ferias:    { fill: 'FFF7ED', color: 'C2410C' },
  desligado: { fill: 'F3F4F6', color: '6B7280' },
}
```

Substituir por:
```ts
const STATUS_LABELS: Record<string, string> = {
  ativo:             'Ativo',
  afastado:          'Afastado',
  ferias:            'Férias',
  desligado:         'Desligado',
  rescisao_indireta: 'Rescisão Indireta',
}

const STATUS_COLORS: Record<string, { fill: string; color: string }> = {
  ativo:             { fill: 'F0FDF4', color: '15803D' },
  afastado:          { fill: 'FFF1F2', color: 'B91C1C' },
  ferias:            { fill: 'FFF7ED', color: 'C2410C' },
  desligado:         { fill: 'F3F4F6', color: '6B7280' },
  rescisao_indireta: { fill: 'FAF5FF', color: '7E22CE' },
}
```

- [ ] **Step 5: Checar tipos**

Rodar: `npx tsc --noEmit`
Esperado: **zero erros** no projeto inteiro (os erros esperados na Task 1, Step 6, sobre `STATUS_BADGE`/`STATUS_ROW` faltando a chave, desaparecem aqui).

- [ ] **Step 6: Commit**

```bash
git add components/efetivo/funcionarios-table.tsx components/efetivo/prontuario-client.tsx components/efetivo/filtros-efetivo.tsx components/efetivo/efetivo-client.tsx
git commit -m "feat(efetivo): badges e labels para status rescisao_indireta"
```

---

### Task 5: Card contador "Em Processo" no topo do Efetivo

**Files:**
- Modify: `app/(admin)/efetivo/page.tsx:61-95`
- Modify: `app/(admin)/efetivo/page.tsx:165-189`

**Interfaces:**
- Consumes: status `'rescisao_indireta'` (Task 1).
- Produces: nenhuma interface consumida por outra task.

- [ ] **Step 1: Adicionar a nova query de contagem**

Em `app/(admin)/efetivo/page.tsx`, dentro do `Promise.all` (linhas 55-95), hoje a lista de destructuring é:
```ts
    { count: countTotal },
    { count: countAtivos },
    { count: countAfastados },
    { count: countFerias },
  ] = await Promise.all([
```
e o final do array de promises (linha 91-94):
```ts
    supabase.from('funcionarios').select('*', { count: 'exact', head: true }),
    supabase.from('funcionarios').select('*', { count: 'exact', head: true }).eq('status', 'ativo'),
    supabase.from('funcionarios').select('*', { count: 'exact', head: true }).in('status', ['afastado', 'atestado']),
    supabase.from('funcionarios').select('*', { count: 'exact', head: true }).eq('status', 'ferias'),
  ])
```

Substituir o destructuring por:
```ts
    { count: countTotal },
    { count: countAtivos },
    { count: countAfastados },
    { count: countFerias },
    { count: countRescisaoIndireta },
  ] = await Promise.all([
```
e o final do array de promises por:
```ts
    supabase.from('funcionarios').select('*', { count: 'exact', head: true }),
    supabase.from('funcionarios').select('*', { count: 'exact', head: true }).eq('status', 'ativo'),
    supabase.from('funcionarios').select('*', { count: 'exact', head: true }).in('status', ['afastado', 'atestado']),
    supabase.from('funcionarios').select('*', { count: 'exact', head: true }).eq('status', 'ferias'),
    supabase.from('funcionarios').select('*', { count: 'exact', head: true }).eq('status', 'rescisao_indireta'),
  ])
```

- [ ] **Step 2: Computar o valor e renderizar o card**

Logo abaixo (linhas 165-169), hoje:
```ts
  const total     = countTotal    ?? 0
  const ativos    = countAtivos   ?? 0
  const afastados = countAfastados ?? 0
  const emFerias  = countFerias   ?? 0
```

Substituir por:
```ts
  const total       = countTotal    ?? 0
  const ativos      = countAtivos   ?? 0
  const afastados   = countAfastados ?? 0
  const emFerias    = countFerias   ?? 0
  const emProcesso  = countRescisaoIndireta ?? 0
```

E o bloco dos cards (linhas 184-189), hoje:
```tsx
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <CounterCard label="Total"      value={total}     topColor="border-t-gray-400"   />
        <CounterCard label="Ativos"     value={ativos}    topColor="border-t-green-500"  />
        <CounterCard label="Afastados"  value={afastados} topColor="border-t-red-500"    />
        <CounterCard label="Em Férias"  value={emFerias}  topColor="border-t-orange-500" />
      </div>
```

Substituir por:
```tsx
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <CounterCard label="Total"        value={total}      topColor="border-t-gray-400"   />
        <CounterCard label="Ativos"       value={ativos}     topColor="border-t-green-500"  />
        <CounterCard label="Afastados"    value={afastados}  topColor="border-t-red-500"    />
        <CounterCard label="Em Férias"    value={emFerias}   topColor="border-t-orange-500" />
        <CounterCard label="Em Processo"  value={emProcesso} topColor="border-t-purple-500" />
      </div>
```

- [ ] **Step 3: Checar tipos**

Rodar: `npx tsc --noEmit`
Esperado: zero erros.

- [ ] **Step 4: Commit**

```bash
git add "app/(admin)/efetivo/page.tsx"
git commit -m "feat(efetivo): card contador Em Processo para rescisao indireta"
```

---

### Task 6: Verificação end-to-end (build + fluxo completo no navegador)

**Files:** nenhum (apenas verificação)

**Interfaces:**
- Consumes: todo o trabalho das Tasks 1-5.

- [ ] **Step 1: Build completo**

Rodar: `npm run build`
Esperado: build conclui sem erros.

- [ ] **Step 2: Abrir o dev server e logar como admin**

Iniciar o servidor de desenvolvimento e abrir `/efetivo` no navegador (usar as ferramentas de preview). Confirmar que aparecem 5 cards no topo: Total, Ativos, Afastados, Em Férias, Em Processo (este último em 0, se nenhum funcionário estiver nesse status ainda).

- [ ] **Step 3: Criar a solicitação de aviso**

Escolher um funcionário com status "Ativo" na tabela → "Nova Solicitação" → Tipo "⚠️ Rescisão Indireta" → preencher Data em que Parou de Trabalhar, Motivo e Observação → Enviar. Confirmar que a mensagem de sucesso aparece e o funcionário continua "Ativo" (a solicitação ainda está pendente, não aprovada).

- [ ] **Step 4: Aprovar a solicitação**

Ir em `/aprovacoes`, localizar a solicitação "Rescisão Indireta" recém-criada, aprovar. Confirmar que a aprovação é aceita sem erro.

- [ ] **Step 5: Confirmar o novo status no Efetivo**

Voltar para `/efetivo`. Confirmar:
- O card "Em Processo" incrementou em 1
- O card "Ativos" decrementou em 1
- O funcionário aparece na tabela com badge roxo "Rescisão Indireta"
- Filtrar por esse status no dropdown de filtros mostra esse funcionário

- [ ] **Step 6: Confirmar o registro em `afastamentos` (leitura via SQL)**

Via MCP do Supabase, `execute_sql`:
```sql
select a.funcionario_id, a.motivo, a.data_inicio, a.data_fim_real, a.solicitacao_id
from afastamentos a
join funcionarios f on f.id = a.funcionario_id
where f.status = 'rescisao_indireta'
order by a.created_at desc
limit 5;
```
Esperado: uma linha para o funcionário testado, com `data_inicio` igual à data preenchida no formulário, `motivo` com a observação/motivo informado, e `data_fim_real` nulo.

- [ ] **Step 7: Finalizar o desligamento (simulando a audiência)**

No mesmo funcionário (agora com status "Rescisão Indireta"), abrir "Nova Solicitação" — confirmar que só a opção "Desligamento" aparece disponível (não deve mostrar Transferência/Mudança de Função/etc.). Selecionar Desligamento → Tipo "Judicial (rescisão indireta, ação trabalhista)" → Motivo "Rescisão Indireta (Art. 483 CLT)" → preencher data → Enviar.

- [ ] **Step 8: Aprovar o desligamento e confirmar o estado final**

Aprovar essa solicitação em `/aprovacoes`. Voltar para `/efetivo` e confirmar que o funcionário agora está "Desligado" (badge cinza), e no Prontuário dele (`Ver Perfil` → `Prontuário`) a timeline mostra o evento de afastamento (rescisão indireta pendente) seguido do evento de desligamento judicial.

- [ ] **Step 9: Screenshot final**

Tirar um screenshot da tabela de Efetivo mostrando os 5 cards e o funcionário de teste já como "Desligado", para registro de que o fluxo ponta-a-ponta funciona.
