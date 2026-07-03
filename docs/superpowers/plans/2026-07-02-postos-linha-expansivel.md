# Linha Expansível + Espaçamento em /postos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Na aba "Visão Geral" de `/postos`, permitir expandir cada linha de posto para ver nome/função/status dos funcionários alocados, sem sair da página; e reduzir o espaçamento das colunas Posto/Secretaria/Supervisor.

**Architecture:** `getPostosData()` (server) já itera todos os funcionários vinculados a postos para calcular contadores — passamos a agrupar esses mesmos registros por `posto_id` num Map e anexar a lista a cada `PostoRow`. No client, uma linha `<tr>` extra por posto (renderizada condicionalmente via `Fragment`) mostra essa lista quando o usuário clica no chevron da linha.

**Tech Stack:** Next.js 14 App Router (Server Component + Server Action já existentes), React (client component), Tailwind, `lucide-react` (ícone `ChevronRight`).

## Global Constraints

- Este projeto não tem suite de testes automatizados (`package.json` não define script `test`). Verificação = `npx tsc --noEmit` + `npm run build`, conforme `CLAUDE.md`. Cada task termina com essas checagens em vez de testes unitários.
- `createClient()` é síncrono — nunca `await createClient()` (regra do projeto, não se aplica diretamente aqui pois não criamos novos clients, mas vale para qualquer código tocado).
- Manter os `STATUS_CHIP`/badges existentes intactos — a cor no nome é um complemento, não substitui os badges já presentes na coluna Status.
- Não filtrar a lista de funcionários expandida por função/status/volante — ela deve refletir 100% dos vinculados ao `posto_id`, ao contrário dos contadores (`efetivo_atual` etc.) que têm filtros específicos.

---

### Task 1: Expor lista de funcionários por posto em `getPostosData()`

**Files:**
- Modify: `app/(admin)/postos/actions.ts:68-113` (tipos), `app/(admin)/postos/actions.ts:130-226` (query + loop + return)

**Interfaces:**
- Consumes: nada de tasks anteriores (primeira task)
- Produces: `PostoFuncionario` type (`{ id, nome, funcao_nome, status }`) e `PostoRow.funcionarios: PostoFuncionario[]`, consumidos pela Task 2 em `postos-client.tsx`

- [ ] **Step 1: Adicionar o tipo `PostoFuncionario` e o campo `funcionarios` em `PostoRow`**

Em `app/(admin)/postos/actions.ts`, localizar:

```ts
export type PostoRow = {
  id: string
  nome: string
  secretaria: string
  efetivo_previsto: number
  cota_insalubridade: number
  ativo: boolean
  efetivo_atual: number
  insalubridade_atual: number
  em_ferias: number
  supervisor_nome: string | null
  cobertura_como_origem: boolean
  cobertura_como_destino: boolean
}
```

Substituir por:

```ts
export type PostoFuncionario = {
  id: string
  nome: string
  funcao_nome: string
  status: string
}

export type PostoRow = {
  id: string
  nome: string
  secretaria: string
  efetivo_previsto: number
  cota_insalubridade: number
  ativo: boolean
  efetivo_atual: number
  insalubridade_atual: number
  em_ferias: number
  supervisor_nome: string | null
  cobertura_como_origem: boolean
  cobertura_como_destino: boolean
  funcionarios: PostoFuncionario[]
}
```

- [ ] **Step 2: Adicionar `nome` e `funcoes` ao tipo local `FuncionarioRow`**

Localizar:

```ts
// Tipo local até eh_encarregado_volante ser adicionado aos tipos gerados do Supabase
interface FuncionarioRow {
  id: string
  posto_id: string | null
  status: string
  funcao_id: string | null
  eh_encarregado_volante: boolean | null
}
```

Substituir por:

```ts
// Tipo local até eh_encarregado_volante ser adicionado aos tipos gerados do Supabase
interface FuncionarioRow {
  id: string
  nome: string
  posto_id: string | null
  status: string
  funcao_id: string | null
  eh_encarregado_volante: boolean | null
  funcoes: { nome: string } | null
}
```

- [ ] **Step 3: Trazer `nome` e `funcoes(nome)` na query paginada**

Localizar dentro de `getPostosData()`:

```ts
    fetchAllRows<FuncionarioRow>((from, to) =>
      supabase
        .from('funcionarios')
        .select('id, posto_id, status, funcao_id, eh_encarregado_volante')
        .in('status', ['ativo', 'ferias', 'atestado', 'afastado', 'faltante'])
        .order('id', { ascending: true })
        .range(from, to) as unknown as PromiseLike<{ data: FuncionarioRow[] | null; error: { message: string } | null }>,
    ),
```

Substituir por:

```ts
    fetchAllRows<FuncionarioRow>((from, to) =>
      supabase
        .from('funcionarios')
        .select('id, nome, posto_id, status, funcao_id, eh_encarregado_volante, funcoes!funcao_id(nome)')
        .in('status', ['ativo', 'ferias', 'atestado', 'afastado', 'faltante'])
        .order('id', { ascending: true })
        .range(from, to) as unknown as PromiseLike<{ data: FuncionarioRow[] | null; error: { message: string } | null }>,
    ),
```

- [ ] **Step 4: Agrupar funcionários por posto, sem os filtros usados nos contadores**

Localizar o início do loop:

```ts
  const efetivoMap = new Map<string, number>()
  const insalubMap = new Map<string, number>()
  const feriasMap  = new Map<string, number>()
  for (const f of funcionariosRaw) {
    if (!f.posto_id) continue
    const secretaria = postoSecretariaMap.get(f.posto_id) ?? ''
```

Substituir por:

```ts
  const efetivoMap = new Map<string, number>()
  const insalubMap = new Map<string, number>()
  const feriasMap  = new Map<string, number>()
  const funcionariosPorPosto = new Map<string, PostoFuncionario[]>()
  for (const f of funcionariosRaw) {
    if (!f.posto_id) continue

    const lista = funcionariosPorPosto.get(f.posto_id) ?? []
    lista.push({
      id: f.id,
      nome: f.nome,
      funcao_nome: f.funcoes?.nome ?? '—',
      status: f.status,
    })
    funcionariosPorPosto.set(f.posto_id, lista)

    const secretaria = postoSecretariaMap.get(f.posto_id) ?? ''
```

O resto do corpo do loop (cálculo de `efetivoMap`/`insalubMap`/`feriasMap`) permanece exatamente como está — a nova lista é preenchida antes de qualquer `continue` de filtro, então inclui todos os vinculados ao posto, inclusive afastados/atestado/faltante/volantes.

- [ ] **Step 5: Incluir `funcionarios` no retorno de `getPostosData()`**

Localizar:

```ts
  return (postos ?? []).map(p => ({
    id: p.id,
    nome: p.nome,
    secretaria: p.secretaria ?? '',
    efetivo_previsto: p.efetivo_previsto ?? 0,
    cota_insalubridade: p.cota_insalubridade ?? 0,
    ativo: p.ativo ?? true,
    efetivo_atual: efetivoMap.get(p.id) ?? 0,
    insalubridade_atual: insalubMap.get(p.id) ?? 0,
    em_ferias: feriasMap.get(p.id) ?? 0,
    supervisor_nome: supervisorMap.get(p.id) ?? null,
    cobertura_como_origem:  coberturaOrigemIds.has(p.id),
    cobertura_como_destino: coberturaDestinoIds.has(p.id),
  }))
```

Substituir por:

```ts
  return (postos ?? []).map(p => ({
    id: p.id,
    nome: p.nome,
    secretaria: p.secretaria ?? '',
    efetivo_previsto: p.efetivo_previsto ?? 0,
    cota_insalubridade: p.cota_insalubridade ?? 0,
    ativo: p.ativo ?? true,
    efetivo_atual: efetivoMap.get(p.id) ?? 0,
    insalubridade_atual: insalubMap.get(p.id) ?? 0,
    em_ferias: feriasMap.get(p.id) ?? 0,
    supervisor_nome: supervisorMap.get(p.id) ?? null,
    cobertura_como_origem:  coberturaOrigemIds.has(p.id),
    cobertura_como_destino: coberturaDestinoIds.has(p.id),
    funcionarios: funcionariosPorPosto.get(p.id) ?? [],
  }))
```

- [ ] **Step 6: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: nenhum erro relacionado a `actions.ts` (o `postos-client.tsx` ainda não consome `funcionarios`, então nenhuma quebra é esperada nesta task).

- [ ] **Step 7: Commit**

```bash
git add app/\(admin\)/postos/actions.ts
git commit -m "feat(postos): expor lista de funcionarios por posto em getPostosData"
```

---

### Task 2: Coluna de expandir + sub-linha com nome/função/status

**Files:**
- Modify: `components/postos/postos-client.tsx`

**Interfaces:**
- Consumes: `PostoRow.funcionarios: PostoFuncionario[]` (Task 1), `PostoFuncionario = { id, nome, funcao_nome, status }`
- Produces: nada consumido por tasks posteriores (última task de código)

- [ ] **Step 1: Importar `Fragment` e `ChevronRight`**

Localizar:

```ts
import { useState, useMemo, useEffect } from 'react'
import { UserPlus, FileSpreadsheet } from 'lucide-react'
```

Substituir por:

```ts
import { useState, useMemo, useEffect, Fragment } from 'react'
import { UserPlus, FileSpreadsheet, ChevronRight } from 'lucide-react'
```

- [ ] **Step 2: Adicionar mapas de cor/ordem por status da lista expandida**

Localizar:

```ts
const STATUS_ORDER: Record<StatusPosto, number> = {
  vago: 0, deficit: 1, ok: 2, excesso: 3,
}
```

Substituir por:

```ts
const STATUS_ORDER: Record<StatusPosto, number> = {
  vago: 0, deficit: 1, ok: 2, excesso: 3,
}

const NOME_COR_STATUS: Record<string, string> = {
  ativo:     'text-green-700',
  ferias:    'text-orange-600',
  afastado:  'text-red-600',
  atestado:  'text-red-600',
  faltante:  'text-amber-600',
}

const STATUS_ORDER_LISTA: Record<string, number> = {
  ativo: 0, ferias: 1, faltante: 2, afastado: 3, atestado: 3,
}
```

- [ ] **Step 3: Adicionar coluna do chevron e `padTight` em `ColDef`/`COLS`**

Localizar:

```ts
type ColDef = { label: string; sortKey: SortCol | null; align: 'left' | 'center' }

const COLS: ColDef[] = [
  { label: 'Posto',              sortKey: 'nome',             align: 'left'   },
  { label: 'Secretaria',         sortKey: 'secretaria',       align: 'left'   },
  { label: 'Supervisor',         sortKey: 'supervisor',       align: 'left'   },
  { label: 'Aloc / Prev',        sortKey: 'efetivo_atual',    align: 'center' },
  { label: 'Insalub / Cota',     sortKey: null,               align: 'center' },
  { label: 'Status',             sortKey: 'status',           align: 'center' },
]
```

Substituir por:

```ts
type ColDef = { label: string; sortKey: SortCol | null; align: 'left' | 'center'; padTight?: boolean }

const COLS: ColDef[] = [
  { label: '',                   sortKey: null,               align: 'center', padTight: true },
  { label: 'Posto',              sortKey: 'nome',             align: 'left',   padTight: true },
  { label: 'Secretaria',         sortKey: 'secretaria',       align: 'left',   padTight: true },
  { label: 'Supervisor',         sortKey: 'supervisor',       align: 'left',   padTight: true },
  { label: 'Aloc / Prev',        sortKey: 'efetivo_atual',    align: 'center' },
  { label: 'Insalub / Cota',     sortKey: null,               align: 'center' },
  { label: 'Status',             sortKey: 'status',           align: 'center' },
]
```

`key={col.label}` no `<thead>` deixaria de ser único (duas colunas com `sortKey: null` já existiam — "Insalub / Cota" e agora a nova coluna vazia — mas seus `label`s são diferentes: `''` vs `'Insalub / Cota'`, então a key continua única).

- [ ] **Step 4: Usar `padTight` no `<th>` e ajustar `colSpan` do estado vazio**

Localizar:

```tsx
                  {COLS.map(col => (
                    <th
                      key={col.label}
                      onClick={col.sortKey ? () => handleSort(col.sortKey!) : undefined}
                      className={[
                        `px-4 py-3 ${col.align === 'center' ? 'text-center' : 'text-left'} text-xs font-semibold uppercase tracking-widest`,
                        col.sortKey === sortCol ? 'text-gray-700' : 'text-gray-400',
                        col.sortKey ? 'cursor-pointer select-none hover:text-gray-600' : '',
                      ].join(' ')}
                    >
```

Substituir por:

```tsx
                  {COLS.map(col => (
                    <th
                      key={col.label}
                      onClick={col.sortKey ? () => handleSort(col.sortKey!) : undefined}
                      className={[
                        `${col.padTight ? 'px-2' : 'px-4'} py-3 ${col.align === 'center' ? 'text-center' : 'text-left'} text-xs font-semibold uppercase tracking-widest`,
                        col.sortKey === sortCol ? 'text-gray-700' : 'text-gray-400',
                        col.sortKey ? 'cursor-pointer select-none hover:text-gray-600' : '',
                      ].join(' ')}
                    >
```

`colSpan={7}` da linha "Nenhum posto encontrado" já está correto — antes desta task o `<table>` tinha 6 colunas reais (era um off-by-one pré-existente inofensivo), agora com a coluna do chevron passam a ser 7. Não precisa alterar essa linha.

- [ ] **Step 5: Adicionar estado de expansão**

Localizar (dentro do componente `PostosClient`, junto aos demais `useState`):

```ts
  const [aba, setAba]                        = useState<'visao' | 'gerenciar'>('visao')
```

Substituir por:

```ts
  const [aba, setAba]                        = useState<'visao' | 'gerenciar'>('visao')
  const [expandidos, setExpandidos]          = useState<Set<string>>(new Set())
```

E logo após a função `handleSort` (antes do comentário `// ── render ──`), adicionar:

```ts
  function toggleExpandir(id: string) {
    setExpandidos(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
```

- [ ] **Step 6: Trocar o `<tr>` principal por `Fragment` com sub-linha condicional**

Localizar o bloco completo (início do `.map` até o fechamento):

```tsx
                  sorted.map(p => {
                    const st = getStatusPosto(p.efetivo_atual, p.efetivo_previsto)
                    const rowBg =
                      p.secretaria === 'AFASTADOS' ? 'hover:bg-purple-50' :
                      st === 'vago'                ? 'bg-red-50' :
                      !p.supervisor_nome           ? 'bg-amber-50' :
                      'hover:bg-gray-50'
                    return (
                      <tr key={p.id} className={rowBg}>
                        <td className="px-4 py-3 font-medium text-gray-900">{p.nome}</td>
                        <td className="px-4 py-3 text-gray-600">{p.secretaria || '—'}</td>
                        <td className="px-4 py-3">
                          {p.supervisor_nome ? (
                            <span className="text-gray-600">{p.supervisor_nome}</span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                              Sem supervisor
                            </span>
                          )}
                        </td>
```

Substituir por:

```tsx
                  sorted.map(p => {
                    const st = getStatusPosto(p.efetivo_atual, p.efetivo_previsto)
                    const rowBg =
                      p.secretaria === 'AFASTADOS' ? 'hover:bg-purple-50' :
                      st === 'vago'                ? 'bg-red-50' :
                      !p.supervisor_nome           ? 'bg-amber-50' :
                      'hover:bg-gray-50'
                    const expandido = expandidos.has(p.id)
                    return (
                      <Fragment key={p.id}>
                      <tr className={rowBg}>
                        <td className="px-2 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => toggleExpandir(p.id)}
                            className="text-gray-400 hover:text-gray-700"
                            aria-label={expandido ? 'Recolher' : 'Expandir'}
                          >
                            <ChevronRight className={cn('h-4 w-4 transition-transform', expandido && 'rotate-90')} />
                          </button>
                        </td>
                        <td className="px-2 py-3 font-medium text-gray-900">{p.nome}</td>
                        <td className="px-2 py-3 text-gray-600">{p.secretaria || '—'}</td>
                        <td className="px-2 py-3">
                          {p.supervisor_nome ? (
                            <span className="text-gray-600">{p.supervisor_nome}</span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                              Sem supervisor
                            </span>
                          )}
                        </td>
```

- [ ] **Step 7: Fechar a linha principal com `</tr>`, adicionar a sub-linha expandida e fechar o `Fragment`**

Localizar o fim do mesmo bloco:

```tsx
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
```

(esse é o fechamento da célula "Status", seguido do fechamento de `<tr>` e do `return`). Substituir por:

```tsx
                          </div>
                        </td>
                      </tr>
                      {expandido && (
                        <tr>
                          <td colSpan={7} className="bg-gray-50 px-6 py-3">
                            {p.funcionarios.length === 0 ? (
                              <p className="text-xs text-gray-400">Nenhum funcionário vinculado</p>
                            ) : (
                              <ul className="grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3">
                                {[...p.funcionarios]
                                  .sort((a, b) =>
                                    (STATUS_ORDER_LISTA[a.status] ?? 9) - (STATUS_ORDER_LISTA[b.status] ?? 9) ||
                                    a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' })
                                  )
                                  .map(f => (
                                    <li key={f.id} className="flex items-baseline gap-1.5 text-xs">
                                      <span className={cn('font-medium', NOME_COR_STATUS[f.status] ?? 'text-gray-700')}>
                                        {f.nome}
                                      </span>
                                      <span className="text-gray-400">— {f.funcao_nome}</span>
                                    </li>
                                  ))}
                              </ul>
                            )}
                          </td>
                        </tr>
                      )}
                      </Fragment>
                    )
                  })
                )}
```

- [ ] **Step 8: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: nenhum erro (confirma que `PostoFuncionario`, `Fragment`, `ChevronRight` e `cn` estão todos corretamente referenciados).

- [ ] **Step 9: Commit**

```bash
git add components/postos/postos-client.tsx
git commit -m "feat(postos): linha expansivel com funcionarios do posto e colunas mais compactas"
```

---

### Task 3: Build completo e verificação manual no navegador

**Files:**
- Nenhum arquivo novo — apenas verificação.

**Interfaces:**
- Consumes: resultado das Tasks 1 e 2 (nenhuma interface nova é produzida)

- [ ] **Step 1: Build de produção**

Run: `npm run build`
Expected: build conclui sem erros de tipo ou lint.

- [ ] **Step 2: Subir o servidor e abrir `/postos`**

Iniciar o dev server (`npm run dev` ou via ferramenta de preview) e navegar até `/postos`, aba "Visão Geral".

- [ ] **Step 3: Testar expandir/colapsar uma linha com funcionários ativos**

Clicar no chevron de um posto com déficit (ex: "CEMPRE IVAN NUNES SIQUEIRA" no screenshot original). Verificar:
- A sub-linha aparece com nomes coloridos (verde para ativo) + função.
- Clicar de novo recolhe.
- O chevron gira 90° quando expandido.

- [ ] **Step 4: Testar múltiplas linhas expandidas simultaneamente**

Expandir 2-3 postos diferentes ao mesmo tempo e confirmar que todos permanecem abertos (sem exclusividade tipo accordion-único).

- [ ] **Step 5: Testar posto vago**

Expandir um posto com `Aloc: 0` (ex: "UBS VILA NOVA APARECIDA" no screenshot) e confirmar a mensagem "Nenhum funcionário vinculado".

- [ ] **Step 6: Testar posto com funcionário em férias/afastado**

Expandir um posto que tenha o badge "🌴 X em férias" (ex: "CEMPRE RUTH CARDOSO") e confirmar que o funcionário aparece na lista com o nome em laranja.

- [ ] **Step 7: Confirmar visualmente a redução de espaçamento**

Comparar a largura das colunas Posto/Secretaria/Supervisor antes/depois — o vão entre "Posto" e "Secretaria" deve estar visivelmente menor.

- [ ] **Step 8: Commit final (se houver ajustes)**

Caso a verificação manual não exija mudanças de código, esta task não gera commit. Caso exija ajuste, repetir Steps 8-9 da Task 2 com o fix aplicado.

---

## Self-Review

**Spec coverage:**
- Linha expansível (chevron, múltiplas abertas, ordenação por status→nome, posto vago) → Task 2, Steps 3-7.
- Dados agregados sem round-trip extra (via `getPostosData()`) → Task 1.
- Cores por status no nome → Task 2, Step 2 (`NOME_COR_STATUS`) e Step 7 (aplicação).
- Redução de padding em Posto/Secretaria/Supervisor via `px-2` → Task 2, Steps 3-4 e 6.
- Verificação (`tsc`, `build`, manual) → Task 3.

**Placeholder scan:** nenhum "TBD"/"implementar depois" — todo código é completo e copiável.

**Type consistency:** `PostoFuncionario` (Task 1) usado identicamente em Task 2 (`p.funcionarios`, `f.nome`, `f.funcao_nome`, `f.status`). `funcionariosPorPosto` só existe em `actions.ts`, não vaza para o client (o client só vê `PostoRow.funcionarios`).
