# Filtro por Supervisor — /efetivo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar um dropdown de supervisor à barra de filtros da página `/efetivo`, funcionando em combinação com os filtros de busca, secretaria e status já existentes.

**Architecture:** Duas queries extras em `Promise.all` no Server Component (`page.tsx`) buscam supervisores e a tabela de vínculo `config_supervisores_postos`. Dois índices em memória (Map e Set) permitem filtrar in-memory no mesmo padrão já usado para secretaria e status. O Client Component `FiltrosEfetivo` recebe a lista de supervisores como prop e expõe o novo dropdown.

**Tech Stack:** Next.js 13+ App Router (Server Components), Supabase JS client, React, TypeScript.

---

## Mapa de arquivos

| Arquivo | Ação | Responsabilidade da mudança |
|---|---|---|
| `app/(admin)/efetivo/page.tsx` | Modificar | Queries, índices, filtro, prop nova |
| `components/efetivo/filtros-efetivo.tsx` | Modificar | Nova prop `supervisores`, novo dropdown |

---

## Task 1: Atualizar `page.tsx` — queries, índices e filtro

**Files:**
- Modify: `app/(admin)/efetivo/page.tsx`

- [ ] **Step 1.1: Adicionar `supervisor` ao tipo `SearchParams`**

Substitua o bloco de tipo (linhas 30-34):

```ts
type SearchParams = {
  secretaria?: string
  status?: string
  busca?: string
  supervisor?: string
}
```

- [ ] **Step 1.2: Converter a query única em `Promise.all` com três queries**

Substitua o trecho atual (da linha `const supabase = createClient()` até `const funcionarios = ...`) por:

```ts
const supabase = createClient()

const [{ data: raw }, { data: supervisoresRaw }, { data: configRaw }] = await Promise.all([
  supabase
    .from('funcionarios')
    .select(`
      id, nome, cpf, status, data_admissao, posto_id,
      funcoes!funcao_id ( id, nome ),
      postos!posto_id ( id, nome, secretaria )
    `)
    .order('nome'),
  supabase
    .from('perfis')
    .select('id, nome')
    .eq('role', 'supervisor')
    .eq('ativo', true)
    .order('nome'),
  supabase
    .from('config_supervisores_postos')
    .select('supervisor_id, posto_id')
    .eq('ativo', true),
])

const funcionarios = (raw ?? []) as unknown as FuncionarioRow[]
```

- [ ] **Step 1.3: Construir os dois índices em memória logo após `funcionarios`**

Adicione imediatamente após `const funcionarios = ...`:

```ts
// supervisor_id → Set<posto_id>
const supervisorPostoMap = new Map<string, Set<string>>()
for (const row of configRaw ?? []) {
  if (!supervisorPostoMap.has(row.supervisor_id)) {
    supervisorPostoMap.set(row.supervisor_id, new Set())
  }
  supervisorPostoMap.get(row.supervisor_id)!.add(row.posto_id)
}
// todos os posto_ids com pelo menos um supervisor ativo
const supervisedPostoIds = new Set((configRaw ?? []).map(r => r.posto_id))
```

- [ ] **Step 1.4: Adicionar `supervisor` à desestruturação de searchParams e aplicar o filtro**

Substitua:
```ts
const { busca, status, secretaria } = searchParams
```
Por:
```ts
const { busca, status, secretaria, supervisor } = searchParams
```

Em seguida, após o bloco `if (secretaria) { ... }`, adicione:

```ts
if (supervisor === 'sem_supervisor') {
  filtered = filtered.filter(f => !f.posto_id || !supervisedPostoIds.has(f.posto_id))
} else if (supervisor) {
  const postosDoSup = supervisorPostoMap.get(supervisor) ?? new Set<string>()
  filtered = filtered.filter(f => !!f.posto_id && postosDoSup.has(f.posto_id))
}
```

- [ ] **Step 1.5: Passar `supervisores` para `FiltrosEfetivo`**

Substitua:
```tsx
<FiltrosEfetivo secretarias={secretarias} />
```
Por:
```tsx
<FiltrosEfetivo secretarias={secretarias} supervisores={supervisoresRaw ?? []} />
```

- [ ] **Step 1.6: Verificar TypeScript**

```bash
cd demax-gestao
npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Step 1.7: Commit**

```bash
git add app/(admin)/efetivo/page.tsx
git commit -m "feat(efetivo): adicionar queries e filtro por supervisor"
```

---

## Task 2: Atualizar `filtros-efetivo.tsx` — nova prop e dropdown

**Files:**
- Modify: `components/efetivo/filtros-efetivo.tsx`

- [ ] **Step 2.1: Adicionar `supervisores` à assinatura da função**

Substitua:
```ts
export function FiltrosEfetivo({ secretarias }: { secretarias: string[] }) {
```
Por:
```ts
export function FiltrosEfetivo({
  secretarias,
  supervisores,
}: {
  secretarias: string[]
  supervisores: { id: string; nome: string | null }[]
}) {
```

- [ ] **Step 2.2: Ler `supervisor` do searchParams**

Adicione após `const secretaria = searchParams.get('secretaria') ?? ''`:

```ts
const supervisor = searchParams.get('supervisor') ?? ''
```

- [ ] **Step 2.3: Inserir o dropdown de supervisor no JSX**

O dropdown vai entre o input de busca e o select de secretaria. Substitua o bloco `<select` de secretaria (que começa com `<select value={secretaria}`) para ficar assim — primeiro o novo dropdown, depois o de secretaria existente:

```tsx
      <select
        value={supervisor}
        onChange={e => update('supervisor', e.target.value)}
        className={inputClass}
      >
        <option value="">Todos os supervisores</option>
        <option value="sem_supervisor">Sem Supervisor</option>
        {supervisores.map(s => (
          <option key={s.id} value={s.id}>{s.nome ?? '—'}</option>
        ))}
      </select>

      <select
        value={secretaria}
        onChange={e => update('secretaria', e.target.value)}
        className={inputClass}
      >
        <option value="">Todas as secretarias</option>
        {secretarias.map(s => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
```

- [ ] **Step 2.4: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Step 2.5: Commit**

```bash
git add components/efetivo/filtros-efetivo.tsx
git commit -m "feat(efetivo): dropdown de supervisor no componente de filtros"
```

---

## Task 3: Build e verificação final

- [ ] **Step 3.1: Rodar o build**

```bash
npm run build
```

Esperado: build limpo, sem erros de tipo ou compilação. Pode haver warnings de lint não relacionados — apenas erros bloqueiam o aceite.

- [ ] **Step 3.2: Checar comportamento esperado (manual)**

Na página `/efetivo`:
- Dropdown "Todos os supervisores" exibe todos os funcionários
- Selecionar um supervisor filtra apenas funcionários cujo posto está vinculado a ele
- Selecionar "Sem Supervisor" exibe funcionários em postos sem supervisor configurado
- Os quatro filtros (busca + supervisor + secretaria + status) funcionam combinados

- [ ] **Step 3.3: Commit final (se não houver mais alterações)**

```bash
git add .
git commit -m "chore: verificação de build do filtro por supervisor"
```
