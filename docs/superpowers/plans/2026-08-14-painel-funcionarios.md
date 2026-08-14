# Painel de Funcionários Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir a lista simples de busca de funcionário em `/ocorrencias` por uma tabela com contagens de advertências/atestados/faltas/ocorrências por pessoa, cards de resumo, ordenação por coluna e exportação Excel.

**Architecture:** Uma nova Server Action `getPainelFuncionarios()` agrega contagens por `funcionario_id` das 4 tabelas (advertencias/atestados/faltas/ocorrencias) em memória (mesmo padrão de `buscarDashFaltas` em `faltas/actions.ts`) e mapeia supervisor(es) por posto via `config_supervisores_postos`. O componente `busca-funcionario.tsx` é reescrito pra renderizar tabela + cards + export, mantendo a mesma interface (`onSelect`) com o resto do fluxo (dossiê modal não muda).

**Tech Stack:** Next.js 14 App Router, Server Actions, Supabase, TypeScript, Tailwind, `xlsx-js-style` (via `lib/export-excel.ts`, já existente).

**Referência:** spec em `docs/superpowers/specs/2026-08-14-painel-funcionarios-design.md`. Esta é a segunda fase do dossiê do funcionário (primeira fase: `docs/superpowers/plans/2026-08-14-dossie-funcionario.md`, já implementada e mergeada nesta mesma branch).

---

## Task 1: Substituir `getFuncionariosParaBusca` por `getPainelFuncionarios` em `actions.ts`

**Files:**
- Modify: `app/(admin)/ocorrencias/actions.ts`

- [ ] **Step 1: Remover a seção antiga de busca de funcionário**

Localizar e apagar este bloco inteiro (linhas 57–107 no arquivo atual — do comentário `// ─── busca de funcionário` até o fechamento de `getFuncionariosParaBusca`):

```typescript
// ─── busca de funcionário ─────────────────────────────────────────────────────

export type FuncionarioBusca = {
  id: string
  nome: string
  cpf: string | null
  registro: string | null
  posto_nome: string
  secretaria: string
}

type RawFuncBusca = {
  id: string
  nome: string
  cpf: string | null
  registro: string | null
  postos: { nome: string; secretaria: string | null } | null
}

export async function getFuncionariosParaBusca(): Promise<FuncionarioBusca[]> {
  const supabase = createClient()
  const auth = await getUser()

  let postoIds: string[] | null = null
  if (auth?.perfil.role === 'supervisor') {
    postoIds = await getPostoIdsSupervisor(supabase, auth.user.id)
    if (postoIds.length === 0) return []
  }

  // fetchAllRows contorna o max_rows do PostgREST (1000) — a base de
  // funcionários já ultrapassa esse limite em outras telas (ver postos/actions.ts).
  const data = await fetchAllRows<RawFuncBusca>((from, to) => {
    let query = supabase
      .from('funcionarios')
      .select('id, nome, cpf, registro, postos!posto_id(nome, secretaria)')
      .neq('status', 'desligado')
      .order('nome')
      .range(from, to)
    if (postoIds) query = query.in('posto_id', postoIds)
    return query as unknown as PromiseLike<{ data: RawFuncBusca[] | null; error: { message: string } | null }>
  })

  return data.map(f => ({
    id: f.id,
    nome: f.nome,
    cpf: f.cpf,
    registro: f.registro,
    posto_nome: f.postos?.nome ?? '—',
    secretaria: f.postos?.secretaria ?? '',
  }))
}
```

- [ ] **Step 2: Inserir a nova seção no lugar**

Substituir pelo bloco abaixo (mesmo lugar do arquivo — logo após `getPostoIdsSupervisor`, antes da seção `// ─── supervisores`):

```typescript
// ─── painel de funcionários (tabela inicial da tela) ──────────────────────────

export type FuncionarioPainel = {
  id: string
  nome: string
  registro: string | null
  posto_nome: string
  secretaria: string
  supervisor_nomes: string[]
  contagens: {
    advertencias: number
    atestados: number
    faltas: number
    ocorrencias: number
  }
}

type RawFuncPainel = {
  id: string
  nome: string
  registro: string | null
  posto_id: string | null
  postos: { nome: string; secretaria: string | null } | null
}

type RawContagem = { funcionario_id: string }

async function contarPorFuncionario(
  factory: (from: number, to: number) => PromiseLike<{ data: RawContagem[] | null; error: { message: string } | null }>,
): Promise<Map<string, number>> {
  const rows = await fetchAllRows<RawContagem>(factory)
  const map = new Map<string, number>()
  for (const r of rows) {
    map.set(r.funcionario_id, (map.get(r.funcionario_id) ?? 0) + 1)
  }
  return map
}

type RawConfigSupervisor = {
  posto_id: string
  perfis: { nome: string | null } | { nome: string | null }[] | null
}

async function getSupervisoresPorPosto(
  supabase: ReturnType<typeof createClient>,
): Promise<Map<string, string[]>> {
  const { data } = await supabase
    .from('config_supervisores_postos')
    .select('posto_id, perfis(nome)')
    .eq('ativo', true)

  const map = new Map<string, string[]>()
  for (const row of (data ?? []) as unknown as RawConfigSupervisor[]) {
    const perfil = Array.isArray(row.perfis) ? row.perfis[0] : row.perfis
    const nome = perfil?.nome
    if (!nome) continue
    const list = map.get(row.posto_id) ?? []
    list.push(nome)
    map.set(row.posto_id, list)
  }
  return map
}

export async function getPainelFuncionarios(): Promise<FuncionarioPainel[]> {
  const supabase = createClient()
  const auth = await getUser()

  let postoIds: string[] | null = null
  if (auth?.perfil.role === 'supervisor') {
    postoIds = await getPostoIdsSupervisor(supabase, auth.user.id)
    if (postoIds.length === 0) return []
  }

  // fetchAllRows contorna o max_rows do PostgREST (1000) — a base de
  // funcionários já ultrapassa esse limite em outras telas (ver postos/actions.ts).
  const funcionariosRaw = await fetchAllRows<RawFuncPainel>((from, to) => {
    let query = supabase
      .from('funcionarios')
      .select('id, nome, registro, posto_id, postos!posto_id(nome, secretaria)')
      .neq('status', 'desligado')
      .order('nome')
      .range(from, to)
    if (postoIds) query = query.in('posto_id', postoIds)
    return query as unknown as PromiseLike<{ data: RawFuncPainel[] | null; error: { message: string } | null }>
  })

  const [advertenciasMap, atestadosMap, faltasMap, ocorrenciasMap, supervisoresPorPosto] = await Promise.all([
    contarPorFuncionario((from, to) =>
      supabase.from('advertencias').select('funcionario_id').range(from, to) as unknown as PromiseLike<{ data: RawContagem[] | null; error: { message: string } | null }>,
    ),
    contarPorFuncionario((from, to) =>
      supabase.from('atestados').select('funcionario_id').range(from, to) as unknown as PromiseLike<{ data: RawContagem[] | null; error: { message: string } | null }>,
    ),
    contarPorFuncionario((from, to) =>
      supabase.from('faltas').select('funcionario_id').range(from, to) as unknown as PromiseLike<{ data: RawContagem[] | null; error: { message: string } | null }>,
    ),
    contarPorFuncionario((from, to) =>
      (supabase as unknown as AnyClient)
        .from('ocorrencias')
        .select('funcionario_id')
        .eq('tipo', 'ocorrencia')
        .not('funcionario_id', 'is', null)
        .range(from, to) as unknown as PromiseLike<{ data: RawContagem[] | null; error: { message: string } | null }>,
    ),
    getSupervisoresPorPosto(supabase),
  ])

  return funcionariosRaw.map(f => ({
    id: f.id,
    nome: f.nome,
    registro: f.registro,
    posto_nome: f.postos?.nome ?? '—',
    secretaria: f.postos?.secretaria ?? '',
    supervisor_nomes: f.posto_id ? (supervisoresPorPosto.get(f.posto_id) ?? []) : [],
    contagens: {
      advertencias: advertenciasMap.get(f.id) ?? 0,
      atestados: atestadosMap.get(f.id) ?? 0,
      faltas: faltasMap.get(f.id) ?? 0,
      ocorrencias: ocorrenciasMap.get(f.id) ?? 0,
    },
  }))
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: erros SÓ em `components/ocorrencias/busca-funcionario.tsx`, `components/ocorrencias/ocorrencias-client.tsx` e `app/(admin)/ocorrencias/page.tsx` (ainda importam `FuncionarioBusca`/`getFuncionariosParaBusca`, removidos neste passo — corrigidos nas Tasks 2–4). Nenhum erro deve se originar em `actions.ts` propriamente.

- [ ] **Step 4: Commit**

```bash
git add "app/(admin)/ocorrencias/actions.ts"
git commit -m "feat(ocorrencias): getPainelFuncionarios com contagens por tipo

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 2: Reescrever `busca-funcionario.tsx` (tabela + cards + export)

**Files:**
- Modify: `components/ocorrencias/busca-funcionario.tsx` (reescrita completa)

- [ ] **Step 1: Substituir todo o conteúdo do arquivo**

```tsx
'use client'

import { useMemo, useState } from 'react'
import type { FuncionarioPainel } from '@/app/(admin)/ocorrencias/actions'
import { exportToExcel } from '@/lib/export-excel'

const inputClass =
  'h-9 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm shadow-sm text-gray-700 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400'

type SortCol = 'nome' | 'total' | 'advertencias' | 'atestados' | 'faltas' | 'ocorrencias'
type SortDir = 'asc' | 'desc'

const MAX_LINHAS = 200

const COUNT_COLS: { key: SortCol; label: string }[] = [
  { key: 'advertencias', label: 'Advertências' },
  { key: 'atestados',    label: 'Atestados'    },
  { key: 'faltas',       label: 'Faltas'       },
  { key: 'ocorrencias',  label: 'Ocorrências'  },
]

function CounterCard({ label, value, topColor }: { label: string; value: number; topColor: string }) {
  return (
    <div className={`rounded-xl border border-gray-100 border-t-4 bg-white p-3 shadow-sm ${topColor}`}>
      <p className="text-2xl font-black tracking-tight text-gray-900">{value}</p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-gray-400">{label}</p>
    </div>
  )
}

function totalRegistros(f: FuncionarioPainel): number {
  return f.contagens.advertencias + f.contagens.atestados + f.contagens.faltas + f.contagens.ocorrencias
}

export function BuscaFuncionario({
  funcionarios,
  onSelect,
}: {
  funcionarios: FuncionarioPainel[]
  onSelect: (id: string) => void
}) {
  const [busca, setBusca]           = useState('')
  const [secretaria, setSecretaria] = useState('')
  const [sortCol, setSortCol]       = useState<SortCol>('total')
  const [sortDir, setSortDir]       = useState<SortDir>('desc')

  const secretarias = useMemo(
    () => Array.from(new Set(funcionarios.map(f => f.secretaria).filter(Boolean))).sort(),
    [funcionarios],
  )

  const temBusca = busca.trim().length > 0

  const filtrados = useMemo(() => {
    let list = funcionarios
    if (secretaria) list = list.filter(f => f.secretaria === secretaria)
    if (temBusca) {
      const termo = busca.trim().toLowerCase()
      list = list.filter(f => f.nome.toLowerCase().includes(termo))
    } else {
      list = list.filter(f => totalRegistros(f) > 0)
    }
    return list
  }, [funcionarios, busca, secretaria, temBusca])

  const ordenados = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1
    return [...filtrados].sort((a, b) => {
      switch (sortCol) {
        case 'nome':
          return dir * a.nome.localeCompare(b.nome, undefined, { sensitivity: 'base' })
        case 'total':
          return dir * (totalRegistros(a) - totalRegistros(b))
        case 'advertencias':
          return dir * (a.contagens.advertencias - b.contagens.advertencias)
        case 'atestados':
          return dir * (a.contagens.atestados - b.contagens.atestados)
        case 'faltas':
          return dir * (a.contagens.faltas - b.contagens.faltas)
        case 'ocorrencias':
          return dir * (a.contagens.ocorrencias - b.contagens.ocorrencias)
        default:
          return 0
      }
    })
  }, [filtrados, sortCol, sortDir])

  const cards = useMemo(() => {
    let comRegistro = 0
    let advertencias = 0
    let atestados = 0
    let faltas = 0
    let ocorrencias = 0
    for (const f of filtrados) {
      if (totalRegistros(f) > 0) comRegistro++
      advertencias += f.contagens.advertencias
      atestados += f.contagens.atestados
      faltas += f.contagens.faltas
      ocorrencias += f.contagens.ocorrencias
    }
    return { comRegistro, advertencias, atestados, faltas, ocorrencias }
  }, [filtrados])

  const visiveis = ordenados.slice(0, MAX_LINHAS)
  const cortado = ordenados.length > MAX_LINHAS

  function handleSort(col: SortCol) {
    if (col === sortCol) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortCol(col); setSortDir('desc') }
  }

  function handleExportar() {
    exportToExcel(
      ordenados,
      [
        { label: 'Funcionário',       value: f => f.nome },
        { label: 'Matrícula',         value: f => f.registro ?? '—' },
        { label: 'Posto de Trabalho', value: f => f.posto_nome },
        { label: 'Secretaria',        value: f => f.secretaria || '—' },
        { label: 'Supervisor(es)',    value: f => f.supervisor_nomes.join(', ') || '—' },
        { label: 'Advertências',      value: f => f.contagens.advertencias },
        { label: 'Atestados',         value: f => f.contagens.atestados },
        { label: 'Faltas',            value: f => f.contagens.faltas },
        { label: 'Ocorrências',       value: f => f.contagens.ocorrencias },
      ],
      `funcionarios-ocorrencias-${new Date().toISOString().split('T')[0]}.xlsx`,
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <CounterCard label="Funcionários c/ Registro" value={cards.comRegistro}  topColor="border-t-gray-400"   />
        <CounterCard label="Advertências"              value={cards.advertencias} topColor="border-t-orange-500" />
        <CounterCard label="Atestados"                 value={cards.atestados}    topColor="border-t-blue-500"   />
        <CounterCard label="Faltas"                    value={cards.faltas}       topColor="border-t-red-500"    />
        <CounterCard label="Ocorrências"                value={cards.ocorrencias}  topColor="border-t-purple-500" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Buscar funcionário pelo nome…"
          value={busca}
          onChange={e => setBusca(e.target.value)}
          className={inputClass + ' max-w-xs'}
        />
        <select
          value={secretaria}
          onChange={e => setSecretaria(e.target.value)}
          className={inputClass + ' max-w-xs'}
        >
          <option value="">Todas as secretarias</option>
          {secretarias.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button
          type="button"
          onClick={handleExportar}
          className="ml-auto h-9 rounded-lg bg-amber-500 px-4 text-xs font-semibold uppercase tracking-widest text-slate-900 hover:bg-amber-400"
        >
          Exportar Excel
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-gray-400">Funcionário</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-gray-400">Matrícula</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-gray-400">Posto de Trabalho</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-gray-400">Supervisor(es)</th>
                {COUNT_COLS.map(col => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className={[
                      'cursor-pointer select-none px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest hover:text-gray-600',
                      sortCol === col.key ? 'text-gray-700' : 'text-gray-400',
                    ].join(' ')}
                  >
                    {col.label}
                    {sortCol === col.key && <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {visiveis.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-400">
                    {temBusca || secretaria ? 'Nenhum funcionário encontrado' : 'Nenhum funcionário com registro no momento'}
                  </td>
                </tr>
              ) : (
                visiveis.map(f => (
                  <tr key={f.id} onClick={() => onSelect(f.id)} className="cursor-pointer hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{f.nome}</td>
                    <td className="px-4 py-3 text-gray-600">{f.registro ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{f.posto_nome}{f.secretaria ? ` — ${f.secretaria}` : ''}</td>
                    <td className="px-4 py-3 text-gray-600">{f.supervisor_nomes.join(', ') || '—'}</td>
                    <td className="px-4 py-3 tabular-nums text-gray-600">{f.contagens.advertencias}</td>
                    <td className="px-4 py-3 tabular-nums text-gray-600">{f.contagens.atestados}</td>
                    <td className="px-4 py-3 tabular-nums text-gray-600">{f.contagens.faltas}</td>
                    <td className="px-4 py-3 tabular-nums text-gray-600">{f.contagens.ocorrencias}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {cortado && (
          <p className="border-t border-gray-100 px-4 py-2 text-center text-xs text-gray-400">
            Mostrando {MAX_LINHAS} de {ordenados.length} — refine a busca pra ver mais
          </p>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: nenhum erro se originando em `busca-funcionario.tsx`. Erros remanescentes em `ocorrencias-client.tsx`/`page.tsx` são esperados (Tasks 3–4).

- [ ] **Step 3: Commit**

```bash
git add components/ocorrencias/busca-funcionario.tsx
git commit -m "feat(ocorrencias): tabela do painel com contagens, ordenação e export Excel

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: Atualizar tipo em `ocorrencias-client.tsx`

**Files:**
- Modify: `components/ocorrencias/ocorrencias-client.tsx`

- [ ] **Step 1: Trocar o import e o tipo da prop `funcionarios`**

Substituir:

```tsx
import type { FuncionarioBusca, SupervisorSimples, AlertaRow } from '@/app/(admin)/ocorrencias/actions'
```

por:

```tsx
import type { FuncionarioPainel, SupervisorSimples, AlertaRow } from '@/app/(admin)/ocorrencias/actions'
```

E substituir:

```tsx
  funcionarios: FuncionarioBusca[]
```

por:

```tsx
  funcionarios: FuncionarioPainel[]
```

(É a única mudança neste arquivo — o resto do componente já é agnóstico ao formato interno de `FuncionarioPainel`, só repassa a prop pra `BuscaFuncionario`.)

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: nenhum erro se originando em `ocorrencias-client.tsx`. Erro remanescente em `page.tsx` é esperado (Task 4).

- [ ] **Step 3: Commit**

```bash
git add components/ocorrencias/ocorrencias-client.tsx
git commit -m "refactor(ocorrencias): orquestrador usa FuncionarioPainel

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: Atualizar `app/(admin)/ocorrencias/page.tsx`

**Files:**
- Modify: `app/(admin)/ocorrencias/page.tsx`

- [ ] **Step 1: Trocar a Server Action chamada**

Substituir:

```tsx
import { getFuncionariosParaBusca, getSupervisoresSimples, getAlertas } from './actions'
```

por:

```tsx
import { getPainelFuncionarios, getSupervisoresSimples, getAlertas } from './actions'
```

E substituir:

```tsx
    getFuncionariosParaBusca(),
```

por:

```tsx
    getPainelFuncionarios(),
```

(A variável local continua se chamando `funcionarios` — só troca qual função a preenche. Nenhuma outra linha do arquivo muda.)

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: zero erros no projeto inteiro.

- [ ] **Step 3: Commit**

```bash
git add "app/(admin)/ocorrencias/page.tsx"
git commit -m "feat(ocorrencias): página usa getPainelFuncionarios

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 5: Build e verificação manual

**Files:** nenhum (apenas verificação)

- [ ] **Step 1: Build de produção**

Run: `npm run build`
Expected: build conclui sem erros.

- [ ] **Step 2: Confirmar que nada mais referencia os símbolos removidos**

Run: `grep -rn "getFuncionariosParaBusca\|FuncionarioBusca" --include="*.ts" --include="*.tsx" .`
Expected: nenhum resultado.

- [ ] **Step 3: QA manual (como admin)**

1. Abrir `/ocorrencias`. Sem digitar nada na busca, confirmar que só aparecem funcionários com pelo menos 1 registro, ordenado por total de registros (desc).
2. Conferir os 5 cards batendo com a soma das colunas visíveis na tabela.
3. Digitar o nome de alguém sem nenhum registro (ex: um funcionário recém-admitido) e confirmar que aparece na busca mesmo sem registro.
4. Clicar nos cabeçalhos Advertências/Atestados/Faltas/Ocorrências e confirmar que a ordenação muda (asc/desc no clique repetido).
5. Clicar em "Exportar Excel", abrir o arquivo baixado e conferir as 9 colunas (Funcionário, Matrícula, Posto de Trabalho, Secretaria, Supervisor(es), Advertências, Atestados, Faltas, Ocorrências) e que os totais batem com os cards.
6. Clicar numa linha da tabela e confirmar que o dossiê abre normalmente (comportamento inalterado da fase anterior).

- [ ] **Step 4: QA manual (como supervisor, se houver usuário de teste)**

1. Confirmar que a lista e os cards só contam funcionários dos postos do supervisor.
2. Confirmar que a coluna Supervisor(es) mostra o próprio nome (ou colegas do mesmo posto, se houver mais de um supervisor vinculado).

---

## Self-Review

**Cobertura da spec:**
- Regra de filtro padrão (só com registro) + busca alcança todos → Task 2 (`filtrados` no `useMemo`). ✅
- Cards reativos ao filtro atual → Task 2 (`cards` no `useMemo`, calculado sobre `filtrados`). ✅
- Colunas da tabela (Funcionário, Matrícula, Posto de Trabalho — Secretaria, Supervisor(es), 4 contagens) → Task 2. ✅
- Ordenação clicável nas 4 colunas de contagem, default por total desc → Task 2 (`sortCol`/`sortDir`, default `'total'`/`'desc'`). ✅
- Limite de 200 linhas renderizadas + export sem esse limite → Task 2 (`visiveis` vs `ordenados` no `handleExportar`). ✅
- `getPainelFuncionarios()` com contagens agregadas em memória e supervisor por posto → Task 1. ✅
- CPF removido da tabela (spec explícita) → Task 2 não usa `cpf` em nenhum lugar; `FuncionarioPainel` (Task 1) não tem campo `cpf`. ✅
- Permissões (escopo de supervisor) inalteradas → Task 1 reusa `getPostoIdsSupervisor` já existente. ✅

**Consistência de tipos:** `FuncionarioPainel` definido uma vez em `actions.ts` (Task 1) com `supervisor_nomes: string[]` e `contagens: { advertencias, atestados, faltas, ocorrencias }` — usado com os mesmos nomes de campo em `busca-funcionario.tsx` (Task 2) e propagado sem alteração de forma por `ocorrencias-client.tsx` (Task 3) e `page.tsx` (Task 4).
