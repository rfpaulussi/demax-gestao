# Conferência RH — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a page where admin/coordenador upload the RH's "ATIVOS" xlsx and instantly see (1) an aggregated headcount grid (função × supervisor, RH vs Sistema) and (2) an employee-level table of every divergence to fix.

**Architecture:** Client-side xlsx parsing (browser `FileReader` + `xlsx-js-style`, same lib/pattern already used in `components/importacao/importacao-client.tsx`) turns the uploaded file's `LISTAGEM` sheet into plain JSON rows. Those rows are sent to a Server Action, which loads the current `funcionarios`/`postos`/`config_supervisores_postos`/`config_codigos_rh` state from Supabase and runs a pure comparison function (`lib/conferencia-rh/comparar.ts`) — no server-side file I/O, no persistence of the upload. The action returns a typed result object the client renders into two tables.

**Tech Stack:** Next.js 14 App Router, Server Actions, Supabase (`@supabase/supabase-js` via `lib/supabase/server.ts`), `xlsx-js-style` (already a dependency), Tailwind, project's existing `lib/export-excel.ts` for the divergences export.

No automated test framework exists in this repo (verified: no jest/vitest config, no `*.test.*` files). Verification here follows the project's established convention: `npx tsc --noEmit`, `npm run build`, and manual smoke-testing in the browser preview — per `CLAUDE.md`. Each task's comparison logic is still designed as small pure functions so it can be exercised by hand (a one-off `console.log` script) before wiring into the UI, giving the same confidence TDD would.

---

## Task 1: Migration — `config_codigos_rh` table

**Files:**
- Create: `supabase/migrations/20260811_config_codigos_rh.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Mapeia o código de 6 dígitos que o RH usa na coluna CONTRATO da planilha
-- "ATIVOS MOGI" para o supervisor correspondente. Não é código de posto —
-- é convenção interna do RH e pode mudar de dono sem aviso, por isso fica
-- em tabela editável (não hardcoded) e não em `postos`.
CREATE TABLE IF NOT EXISTS config_codigos_rh (
  codigo        integer PRIMARY KEY,
  apelido       text NOT NULL,
  supervisor_id uuid REFERENCES perfis(id) ON DELETE SET NULL,
  updated_at    timestamptz DEFAULT now()
);

INSERT INTO config_codigos_rh (codigo, apelido) VALUES
  (70601, 'SIL'),
  (70602, 'HEB'),
  (70603, 'BRAZ'),
  (70604, 'PEDRO'),
  (70605, 'CRISL'),
  (70606, 'ROS'),
  (70607, 'CHRIS'),
  (706999, 'ADMIN')
ON CONFLICT (codigo) DO NOTHING;

ALTER TABLE config_codigos_rh ENABLE ROW LEVEL SECURITY;

CREATE POLICY "config_codigos_rh_select" ON config_codigos_rh
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "config_codigos_rh_write_admin" ON config_codigos_rh
  FOR ALL USING (
    EXISTS (SELECT 1 FROM perfis WHERE perfis.id = auth.uid() AND perfis.role = 'admin')
  );
```

- [ ] **Step 2: Apply the migration**

Use the Supabase MCP `apply_migration` tool (project_id `fwdhnipekbmeqozkpfyh`, name `config_codigos_rh`, pass the SQL above). If the MCP tool is unavailable in this session, paste the SQL into Supabase Studio → SQL Editor and run it manually — tell the user which path was used.

- [ ] **Step 3: Verify**

Run (via MCP `execute_sql`, or Studio):
```sql
SELECT codigo, apelido, supervisor_id FROM config_codigos_rh ORDER BY codigo;
```
Expected: 8 rows, `supervisor_id` null on all of them.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260811_config_codigos_rh.sql
git commit -m "feat(conferencia-rh): tabela de mapeamento código RH -> supervisor"
```

---

## Task 2: TypeScript types for the new table

**Files:**
- Modify: `types/database.ts:547` (insert new block right before the existing `config_escalas_postos: {` entry, since it's alphabetically earlier)
- Modify: `types/index.ts` (add alias)

- [ ] **Step 1: Insert the table type block**

In `types/database.ts`, immediately before the line `      config_escalas_postos: {` (currently line 547), insert:

```ts
      config_codigos_rh: {
        Row: {
          codigo: number
          apelido: string
          supervisor_id: string | null
          updated_at: string | null
        }
        Insert: {
          codigo: number
          apelido: string
          supervisor_id?: string | null
          updated_at?: string | null
        }
        Update: {
          codigo?: number
          apelido?: string
          supervisor_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "config_codigos_rh_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
        ]
      }
```

- [ ] **Step 2: Add the alias in `types/index.ts`**

Right after the line `export type ConfigSupervisorPosto   = Tables<'config_supervisores_postos'>`, add:

```ts
export type ConfigCodigoRH          = Tables<'config_codigos_rh'>
```

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit
```
Expected: no new errors (pre-existing errors, if any, are out of scope).

- [ ] **Step 4: Commit**

```bash
git add types/database.ts types/index.ts
git commit -m "feat(conferencia-rh): tipos TypeScript para config_codigos_rh"
```

---

## Task 3: Normalization helpers

**Files:**
- Create: `lib/conferencia-rh/normalizar.ts`

- [ ] **Step 1: Write the module**

```ts
/** Normaliza nome pra comparação: maiúsculas, sem acento, espaços colapsados. */
export function normalizarNome(nome: string | null | undefined): string {
  return (nome ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** Normaliza RE/registro pra comparação: só dígitos, sem zeros à esquerda. */
export function normalizarRE(re: string | number | null | undefined): string {
  const digitos = String(re ?? '').replace(/\D/g, '')
  return digitos.replace(/^0+(?=\d)/, '')
}
```

- [ ] **Step 2: Sanity-check by hand**

```bash
node -e "
const { normalizarNome, normalizarRE } = require('./lib/conferencia-rh/normalizar.ts')
" 2>&1 | head -5
```
(This will fail because Node can't `require` a `.ts` file directly — that's expected and fine; real verification happens via `tsc` in Step 3. Skip running this step if it errors on the require itself; it's not the check that matters.)

Instead verify with a scratch script:
```bash
cat > /tmp/check-normalizar.mjs <<'EOF'
function normalizarNome(nome) {
  return (nome ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim()
}
function normalizarRE(re) {
  const digitos = String(re ?? '').replace(/\D/g, '')
  return digitos.replace(/^0+(?=\d)/, '')
}
console.assert(normalizarNome('José da Silva  ') === 'JOSE DA SILVA', 'nome falhou')
console.assert(normalizarRE('0102305') === '102305', 're falhou')
console.assert(normalizarRE(102305) === '102305', 're numero falhou')
console.log('OK')
EOF
node /tmp/check-normalizar.mjs
```
Expected: `OK` printed, no assertion errors.

- [ ] **Step 3: Commit**

```bash
git add lib/conferencia-rh/normalizar.ts
git commit -m "feat(conferencia-rh): helpers de normalização de nome/RE"
```

---

## Task 4: Shared types for the comparison domain

**Files:**
- Create: `lib/conferencia-rh/tipos.ts`

- [ ] **Step 1: Write the module**

```ts
/** Uma linha da aba LISTAGEM da planilha do RH, já parseada no browser. */
export type LinhaRH = {
  re: string
  nome: string
  funcao: string
  admissao: string | null       // ISO yyyy-mm-dd
  afastadoEm: string | null     // ISO yyyy-mm-dd, null = ativo
  codigoSupervisor: number
}

/** Um funcionário vindo do nosso banco, já achatado pra comparação. */
export type FuncionarioSistema = {
  id: string
  registro: string | null
  nome: string
  funcao: string | null
  afastado: boolean
  supervisorNome: string | null
}

export type TipoDivergencia =
  | 'so_no_rh'
  | 'so_no_sistema'
  | 'nome_diferente'
  | 're_divergente'
  | 'funcao_diferente'
  | 'afastado_diferente'
  | 'supervisor_diferente'

export type Divergencia = {
  chave: string
  tipos: TipoDivergencia[]
  rh: { re: string | null; nome: string | null; funcao: string | null; afastado: boolean | null; supervisor: string | null }
  sistema: { id: string | null; re: string | null; nome: string | null; funcao: string | null; afastado: boolean | null; supervisor: string | null }
}

export type CelulaResumo = { rh: number; sistema: number }

export type LinhaResumo = {
  funcao: string
  porSupervisor: Record<string, CelulaResumo>  // chave = apelido do supervisor
  afastados: CelulaResumo
  total: CelulaResumo
}

export type ResultadoComparacao = {
  resumo: LinhaResumo[]
  totalGeral: LinhaResumo
  divergencias: Divergencia[]
  codigosSemSupervisorVinculado: number[]
  linhasIgnoradas: number
}
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add lib/conferencia-rh/tipos.ts
git commit -m "feat(conferencia-rh): tipos do domínio de comparação"
```

---

## Task 5: Core comparison logic (pure function)

**Files:**
- Create: `lib/conferencia-rh/comparar.ts`

- [ ] **Step 1: Write the module**

```ts
import { normalizarNome, normalizarRE } from './normalizar'
import type {
  LinhaRH,
  FuncionarioSistema,
  Divergencia,
  TipoDivergencia,
  CelulaResumo,
  LinhaResumo,
  ResultadoComparacao,
} from './tipos'

function novaCelula(): CelulaResumo {
  return { rh: 0, sistema: 0 }
}

function novaLinhaResumo(funcao: string, supervisores: string[]): LinhaResumo {
  const porSupervisor: Record<string, CelulaResumo> = {}
  for (const s of supervisores) porSupervisor[s] = novaCelula()
  return { funcao, porSupervisor, afastados: novaCelula(), total: novaCelula() }
}

function somaCelula(a: CelulaResumo, lado: 'rh' | 'sistema') {
  a[lado] += 1
}

export function compararListagem(
  linhasRH: LinhaRH[],
  funcionariosSistema: FuncionarioSistema[],
  codigoParaApelido: Map<number, string>,
): ResultadoComparacao {
  const supervisoresApelidos = Array.from(new Set(codigoParaApelido.values())).sort()

  // ── índices pro lado sistema ──
  const porRegistro = new Map<string, FuncionarioSistema>()
  const porNomeSistema = new Map<string, FuncionarioSistema>()
  for (const f of funcionariosSistema) {
    if (f.registro) porRegistro.set(normalizarRE(f.registro), f)
    porNomeSistema.set(normalizarNome(f.nome), f)
  }

  const sistemaCasados = new Set<string>() // ids já usados num match
  const divergencias: Divergencia[] = []
  const resumoPorFuncao = new Map<string, LinhaResumo>()
  const codigosSemSupervisor = new Set<number>()
  let linhasIgnoradas = 0

  function linhaResumoDe(funcao: string): LinhaResumo {
    let linha = resumoPorFuncao.get(funcao)
    if (!linha) {
      linha = novaLinhaResumo(funcao, supervisoresApelidos)
      resumoPorFuncao.set(funcao, linha)
    }
    return linha
  }

  for (const linha of linhasRH) {
    if (!linha.re || !linha.nome) { linhasIgnoradas++; continue }

    const apelidoSupervisor = codigoParaApelido.get(linha.codigoSupervisor)
    if (!apelidoSupervisor) codigosSemSupervisor.add(linha.codigoSupervisor)

    // resumo agregado (lado RH)
    const linhaResumo = linhaResumoDe(linha.funcao)
    if (apelidoSupervisor) somaCelula(linhaResumo.porSupervisor[apelidoSupervisor], 'rh')
    if (linha.afastadoEm) somaCelula(linhaResumo.afastados, 'rh')
    somaCelula(linhaResumo.total, 'rh')

    // matching
    const reNorm = normalizarRE(linha.re)
    let matchSistema = porRegistro.get(reNorm)
    let tipos: TipoDivergencia[] = []

    if (!matchSistema) {
      const porNome = porNomeSistema.get(normalizarNome(linha.nome))
      if (porNome) {
        matchSistema = porNome
        tipos.push('re_divergente')
      }
    }

    if (!matchSistema) {
      tipos = ['so_no_rh']
      divergencias.push({
        chave: `rh-${reNorm}`,
        tipos,
        rh: { re: linha.re, nome: linha.nome, funcao: linha.funcao, afastado: !!linha.afastadoEm, supervisor: apelidoSupervisor ?? null },
        sistema: { id: null, re: null, nome: null, funcao: null, afastado: null, supervisor: null },
      })
      continue
    }

    sistemaCasados.add(matchSistema.id)

    if (normalizarNome(matchSistema.nome) !== normalizarNome(linha.nome)) tipos.push('nome_diferente')
    if (normalizarNome(matchSistema.funcao ?? '') !== normalizarNome(linha.funcao)) tipos.push('funcao_diferente')
    if (matchSistema.afastado !== !!linha.afastadoEm) tipos.push('afastado_diferente')
    if (apelidoSupervisor && matchSistema.supervisorNome !== apelidoSupervisor) tipos.push('supervisor_diferente')

    if (tipos.length > 0) {
      divergencias.push({
        chave: `par-${reNorm}`,
        tipos,
        rh: { re: linha.re, nome: linha.nome, funcao: linha.funcao, afastado: !!linha.afastadoEm, supervisor: apelidoSupervisor ?? null },
        sistema: { id: matchSistema.id, re: matchSistema.registro, nome: matchSistema.nome, funcao: matchSistema.funcao, afastado: matchSistema.afastado, supervisor: matchSistema.supervisorNome },
      })
    }
  }

  // resumo agregado (lado Sistema) + "só no sistema"
  for (const f of funcionariosSistema) {
    const funcaoNome = f.funcao ?? '(sem função)'
    const linhaResumo = linhaResumoDe(funcaoNome)
    if (f.supervisorNome) {
      if (!linhaResumo.porSupervisor[f.supervisorNome]) linhaResumo.porSupervisor[f.supervisorNome] = novaCelula()
      somaCelula(linhaResumo.porSupervisor[f.supervisorNome], 'sistema')
    }
    if (f.afastado) somaCelula(linhaResumo.afastados, 'sistema')
    somaCelula(linhaResumo.total, 'sistema')

    if (!sistemaCasados.has(f.id)) {
      divergencias.push({
        chave: `sistema-${f.id}`,
        tipos: ['so_no_sistema'],
        rh: { re: null, nome: null, funcao: null, afastado: null, supervisor: null },
        sistema: { id: f.id, re: f.registro, nome: f.nome, funcao: f.funcao, afastado: f.afastado, supervisor: f.supervisorNome },
      })
    }
  }

  const totalGeral = novaLinhaResumo('TOTAL', supervisoresApelidos)
  for (const linha of resumoPorFuncao.values()) {
    for (const sup of supervisoresApelidos) {
      totalGeral.porSupervisor[sup].rh += linha.porSupervisor[sup]?.rh ?? 0
      totalGeral.porSupervisor[sup].sistema += linha.porSupervisor[sup]?.sistema ?? 0
    }
    totalGeral.afastados.rh += linha.afastados.rh
    totalGeral.afastados.sistema += linha.afastados.sistema
    totalGeral.total.rh += linha.total.rh
    totalGeral.total.sistema += linha.total.sistema
  }

  return {
    resumo: Array.from(resumoPorFuncao.values()).sort((a, b) => a.funcao.localeCompare(b.funcao)),
    totalGeral,
    divergencias,
    codigosSemSupervisorVinculado: Array.from(codigosSemSupervisor).sort((a, b) => a - b),
    linhasIgnoradas,
  }
}
```

- [ ] **Step 2: Verify by hand with a scratch script**

```bash
cat > /tmp/check-comparar.mjs <<'EOF'
// Reimplementação mínima inline só pra validar a lógica de matching antes de plugar no TS real.
// (O tsc --noEmit no Step 3 valida o arquivo de verdade.)
const linhasRH = [
  { re: '100', nome: 'ANA SILVA', funcao: 'AJUDANTE', admissao: null, afastadoEm: null, codigoSupervisor: 70601 },
  { re: '200', nome: 'BRUNO SOUZA', funcao: 'AJUDANTE', admissao: null, afastadoEm: '2026-01-01', codigoSupervisor: 70601 },
  { re: '300', nome: 'SO NO RH', funcao: 'AJUDANTE', admissao: null, afastadoEm: null, codigoSupervisor: 70601 },
]
const sistema = [
  { id: 'a', registro: '100', nome: 'ANA SILVA', funcao: 'AJUDANTE', afastado: false, supervisorNome: 'SIL' },
  { id: 'b', registro: '200', nome: 'BRUNO SOUZA', funcao: 'AJUDANTE', afastado: false, supervisorNome: 'SIL' }, // diverge: RH diz afastado
  { id: 'c', registro: '999', nome: 'SO NO SISTEMA', funcao: 'AJUDANTE', afastado: false, supervisorNome: 'SIL' },
]
// checagem manual dos 3 casos esperados: 1 sem divergência, 1 afastado_diferente, 1 so_no_rh + 1 so_no_sistema
console.log('esperado: linha 300 -> so_no_rh; linha id=c -> so_no_sistema; par 200/b -> afastado_diferente')
console.log('conferir manualmente rodando a página real após Task 8')
EOF
node /tmp/check-comparar.mjs
```

Expected: prints the expectation notes (this task's real verification is `tsc` below plus the end-to-end manual test in Task 9).

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add lib/conferencia-rh/comparar.ts
git commit -m "feat(conferencia-rh): lógica pura de comparação RH x sistema"
```

---

## Task 6: Server Actions

**Files:**
- Create: `app/(admin)/conferencia-rh/actions.ts`

- [ ] **Step 1: Write the actions**

```ts
'use server'

import { getUser } from '@/lib/auth/get-user'
import { createClient } from '@/lib/supabase/server'
import { compararListagem } from '@/lib/conferencia-rh/comparar'
import type { LinhaRH, FuncionarioSistema, ResultadoComparacao } from '@/lib/conferencia-rh/tipos'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyQ = { from: (t: string) => any }

export async function compararConferenciaRH(linhasRH: LinhaRH[]): Promise<ResultadoComparacao | { erro: string }> {
  const auth = await getUser()
  if (!auth) return { erro: 'Não autenticado' }
  if (auth.perfil.role !== 'admin' && auth.perfil.role !== 'coordenador') return { erro: 'Sem permissão' }

  const supabase = createClient()

  const [{ data: funcsRaw }, { data: codigosRaw }] = await Promise.all([
    supabase
      .from('funcionarios')
      .select(`
        id, registro, nome, status,
        funcoes!funcao_id ( nome ),
        postos!posto_id (
          id,
          config_supervisores_postos ( ativo, perfis!supervisor_id ( nome ) )
        )
      `)
      .neq('status', 'desligado')
      .range(0, 1499),
    (supabase as AnyQ).from('config_codigos_rh').select('codigo, apelido, supervisor_id'),
  ])

  type FuncRaw = {
    id: string
    registro: string | null
    nome: string
    status: string | null
    funcoes: { nome: string } | null
    postos: { id: string; config_supervisores_postos: { ativo: boolean | null; perfis: { nome: string | null } | null }[] } | null
  }

  const funcionariosSistema: FuncionarioSistema[] = ((funcsRaw ?? []) as unknown as FuncRaw[]).map(f => {
    const configAtiva = f.postos?.config_supervisores_postos?.find(c => c.ativo)
    return {
      id: f.id,
      registro: f.registro,
      nome: f.nome,
      funcao: f.funcoes?.nome ?? null,
      afastado: f.status === 'afastado' || f.status === 'atestado',
      supervisorNome: configAtiva?.perfis?.nome ?? null,
    }
  })

  type CodigoRow = { codigo: number; apelido: string; supervisor_id: string | null }
  const codigoParaApelido = new Map<number, string>()
  for (const c of ((codigosRaw ?? []) as unknown as CodigoRow[])) codigoParaApelido.set(c.codigo, c.apelido)

  return compararListagem(linhasRH, funcionariosSistema, codigoParaApelido)
}

export async function salvarConfigCodigoRH(codigo: number, supervisorId: string | null): Promise<{ ok: boolean; erro?: string }> {
  const auth = await getUser()
  if (!auth || auth.perfil.role !== 'admin') return { ok: false, erro: 'Sem permissão' }

  const supabase = createClient()
  const { error } = await (supabase as AnyQ)
    .from('config_codigos_rh')
    .update({ supervisor_id: supervisorId, updated_at: new Date().toISOString() })
    .eq('codigo', codigo)

  if (error) return { ok: false, erro: error.message }
  return { ok: true }
}
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```
Expected: no new errors. (The `config_supervisores_postos.perfis!supervisor_id` nested-relation shape mirrors the join used in `app/(admin)/efetivo/page.tsx:75-89` — if `tsc` flags the nested select shape, fall back to the two-step fetch pattern from that file: fetch `funcionarios` with `posto_id`, separately fetch `config_supervisores_postos` + `perfis`, and join with a `Map` in JS, exactly like `efetivo/page.tsx` does.)

- [ ] **Step 3: Commit**

```bash
git add "app/(admin)/conferencia-rh/actions.ts"
git commit -m "feat(conferencia-rh): server actions de comparação e config"
```

---

## Task 7: Presentational components — resumo and divergências tables

**Files:**
- Create: `components/conferencia-rh/resumo-agregado.tsx`
- Create: `components/conferencia-rh/tabela-divergencias.tsx`

- [ ] **Step 1: Write `resumo-agregado.tsx`**

```tsx
'use client'

import type { LinhaResumo } from '@/lib/conferencia-rh/tipos'

const TIPO_LABEL: Record<string, string> = {}

function Celula({ rh, sistema }: { rh: number; sistema: number }) {
  const bate = rh === sistema
  return (
    <td className={`px-2 py-1.5 text-center text-xs tabular-nums ${bate ? 'text-gray-600' : 'bg-amber-50 font-semibold text-amber-700'}`}>
      {rh} / {sistema}
    </td>
  )
}

export function ResumoAgregado({
  linhas,
  totalGeral,
  supervisores,
}: {
  linhas: LinhaResumo[]
  totalGeral: LinhaResumo
  supervisores: string[]
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white shadow-sm">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-slate-900 text-white">
            <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-widest">Função</th>
            {supervisores.map(s => (
              <th key={s} className="px-2 py-2 text-center text-xs font-semibold uppercase tracking-widest">{s}</th>
            ))}
            <th className="px-2 py-2 text-center text-xs font-semibold uppercase tracking-widest">Afast.</th>
            <th className="px-2 py-2 text-center text-xs font-semibold uppercase tracking-widest">Total</th>
          </tr>
          <tr className="bg-slate-800 text-white/70">
            <th className="px-3 py-1 text-left text-[10px] font-normal">RH / Sistema</th>
            <th colSpan={supervisores.length + 2}></th>
          </tr>
        </thead>
        <tbody>
          {linhas.map(linha => (
            <tr key={linha.funcao} className="border-b border-gray-100">
              <td className="px-3 py-1.5 text-xs font-medium text-gray-700">{linha.funcao}</td>
              {supervisores.map(s => (
                <Celula key={s} rh={linha.porSupervisor[s]?.rh ?? 0} sistema={linha.porSupervisor[s]?.sistema ?? 0} />
              ))}
              <Celula rh={linha.afastados.rh} sistema={linha.afastados.sistema} />
              <Celula rh={linha.total.rh} sistema={linha.total.sistema} />
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-gray-200 bg-gray-50 font-bold">
            <td className="px-3 py-1.5 text-xs text-gray-900">TOTAL</td>
            {supervisores.map(s => (
              <Celula key={s} rh={totalGeral.porSupervisor[s]?.rh ?? 0} sistema={totalGeral.porSupervisor[s]?.sistema ?? 0} />
            ))}
            <Celula rh={totalGeral.afastados.rh} sistema={totalGeral.afastados.sistema} />
            <Celula rh={totalGeral.total.rh} sistema={totalGeral.total.sistema} />
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
```

(`TIPO_LABEL` constant is unused here — remove it; it was left from a copy-paste. Final file must not declare it.)

- [ ] **Step 2: Write `tabela-divergencias.tsx`**

```tsx
'use client'

import { useMemo, useState } from 'react'
import { exportToExcel } from '@/lib/export-excel'
import type { Divergencia, TipoDivergencia } from '@/lib/conferencia-rh/tipos'

const TIPO_LABEL: Record<TipoDivergencia, string> = {
  so_no_rh: 'Só no RH',
  so_no_sistema: 'Só no Sistema',
  nome_diferente: 'Nome diferente',
  re_divergente: 'RE divergente',
  funcao_diferente: 'Função diferente',
  afastado_diferente: 'Status afastado diferente',
  supervisor_diferente: 'Supervisor diferente',
}

export function TabelaDivergencias({ divergencias }: { divergencias: Divergencia[] }) {
  const [filtroTipo, setFiltroTipo] = useState<TipoDivergencia | 'todos'>('todos')
  const [busca, setBusca] = useState('')

  const filtradas = useMemo(() => {
    return divergencias.filter(d => {
      if (filtroTipo !== 'todos' && !d.tipos.includes(filtroTipo)) return false
      if (busca) {
        const alvo = `${d.rh.nome ?? ''} ${d.sistema.nome ?? ''}`.toLowerCase()
        if (!alvo.includes(busca.toLowerCase())) return false
      }
      return true
    })
  }, [divergencias, filtroTipo, busca])

  function exportar() {
    exportToExcel(
      filtradas,
      [
        { label: 'Tipo(s)', value: d => d.tipos.map(t => TIPO_LABEL[t]).join(', ') },
        { label: 'Nome (RH)', value: d => d.rh.nome ?? '' },
        { label: 'Nome (Sistema)', value: d => d.sistema.nome ?? '' },
        { label: 'RE (RH)', value: d => d.rh.re ?? '' },
        { label: 'RE (Sistema)', value: d => d.sistema.re ?? '' },
        { label: 'Função (RH)', value: d => d.rh.funcao ?? '' },
        { label: 'Função (Sistema)', value: d => d.sistema.funcao ?? '' },
        { label: 'Supervisor (RH)', value: d => d.rh.supervisor ?? '' },
        { label: 'Supervisor (Sistema)', value: d => d.sistema.supervisor ?? '' },
      ],
      `conferencia-rh-divergencias-${new Date().toISOString().slice(0, 10)}.xlsx`,
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          placeholder="Buscar por nome..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
          className="h-9 w-56 rounded-lg border border-gray-200 px-3 text-sm"
        />
        <select
          value={filtroTipo}
          onChange={e => setFiltroTipo(e.target.value as TipoDivergencia | 'todos')}
          className="h-9 rounded-lg border border-gray-200 px-3 text-sm"
        >
          <option value="todos">Todos os tipos</option>
          {Object.entries(TIPO_LABEL).map(([tipo, label]) => (
            <option key={tipo} value={tipo}>{label}</option>
          ))}
        </select>
        <button
          onClick={exportar}
          className="ml-auto h-9 rounded-lg bg-amber-500 px-4 text-sm font-medium text-slate-900 hover:bg-amber-400"
        >
          Exportar Excel
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white shadow-sm">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-widest text-gray-400">Divergência</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-widest text-gray-400">RH</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-widest text-gray-400">Sistema</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-widest text-gray-400"></th>
            </tr>
          </thead>
          <tbody>
            {filtradas.map(d => (
              <tr key={d.chave} className="border-b border-gray-50">
                <td className="px-3 py-2 text-xs text-amber-700">
                  {d.tipos.map(t => TIPO_LABEL[t]).join(', ')}
                </td>
                <td className="px-3 py-2 text-xs text-gray-700">
                  {d.rh.nome ? `${d.rh.nome} · RE ${d.rh.re} · ${d.rh.funcao} · ${d.rh.supervisor ?? '—'}` : '—'}
                </td>
                <td className="px-3 py-2 text-xs text-gray-700">
                  {d.sistema.nome ? `${d.sistema.nome} · RE ${d.sistema.re ?? '—'} · ${d.sistema.funcao ?? '—'} · ${d.sistema.supervisor ?? '—'}` : '—'}
                </td>
                <td className="px-3 py-2 text-right">
                  {d.sistema.id && (
                    <a href={`/efetivo/${d.sistema.id}`} className="text-xs font-medium text-slate-900 underline">
                      Abrir perfil
                    </a>
                  )}
                </td>
              </tr>
            ))}
            {filtradas.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-xs text-gray-400">
                  Nenhuma divergência encontrada com esse filtro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit
```
Expected: no new errors. (Confirm `/efetivo/[id]` route exists — check `app/(admin)/efetivo/` for a `[id]` folder; if the profile route uses a different path, adjust the `href` above to match it before moving on.)

- [ ] **Step 4: Commit**

```bash
git add components/conferencia-rh/resumo-agregado.tsx components/conferencia-rh/tabela-divergencias.tsx
git commit -m "feat(conferencia-rh): tabelas de resumo agregado e divergências"
```

---

## Task 8: Upload form (client) + config de códigos (admin)

**Files:**
- Create: `components/conferencia-rh/upload-form.tsx`
- Create: `components/conferencia-rh/config-codigos.tsx`

- [ ] **Step 1: Write `upload-form.tsx`**

```tsx
'use client'

import { useState } from 'react'
import * as XLSX from 'xlsx-js-style'
import { compararConferenciaRH } from '@/app/(admin)/conferencia-rh/actions'
import { ResumoAgregado } from './resumo-agregado'
import { TabelaDivergencias } from './tabela-divergencias'
import type { LinhaRH, ResultadoComparacao } from '@/lib/conferencia-rh/tipos'

function excelDataParaISO(valor: unknown): string | null {
  if (valor == null || valor === '') return null
  if (valor instanceof Date) return valor.toISOString().slice(0, 10)
  return null
}

function parseListagem(file: File): Promise<{ linhas: LinhaRH[]; erro?: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const buffer = e.target?.result as ArrayBuffer
        const wb = XLSX.read(buffer, { type: 'array', cellDates: true })
        const ws = wb.Sheets['LISTAGEM']
        if (!ws) {
          resolve({ linhas: [], erro: 'Aba "LISTAGEM" não encontrada no arquivo.' })
          return
        }
        const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null }) as unknown[][]
        // linha 0 = cabeçalho: RE, NOME DO FUNCIONARIO, FUNCAO, ADMISSAO, AFASTADO, CONTRATO, ..., NUM
        const linhas: LinhaRH[] = []
        for (const row of raw.slice(1)) {
          const re = row[0]
          const nome = row[1]
          if (re == null || nome == null || String(nome).trim() === '') continue
          linhas.push({
            re: String(re).trim(),
            nome: String(nome).trim(),
            funcao: String(row[2] ?? '').trim(),
            admissao: excelDataParaISO(row[3]),
            afastadoEm: excelDataParaISO(row[4]),
            codigoSupervisor: Number(row[5]) || 0,
          })
        }
        resolve({ linhas })
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

export function UploadForm({ supervisoresApelidos }: { supervisoresApelidos: string[] }) {
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [resultado, setResultado] = useState<ResultadoComparacao | null>(null)
  const [nomeArquivo, setNomeArquivo] = useState<string | null>(null)

  async function onFile(file: File) {
    setCarregando(true)
    setErro(null)
    setResultado(null)
    setNomeArquivo(file.name)
    try {
      const { linhas, erro: erroParse } = await parseListagem(file)
      if (erroParse) { setErro(erroParse); return }
      if (linhas.length === 0) { setErro('Nenhuma linha válida encontrada na aba LISTAGEM.'); return }

      const res = await compararConferenciaRH(linhas)
      if ('erro' in res) { setErro(res.erro); return }
      setResultado(res)
    } catch {
      setErro('Falha ao ler o arquivo. Confirme que é um .xlsx válido.')
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-gray-500">
          Planilha do RH (.xlsx, aba LISTAGEM)
        </label>
        <input
          type="file"
          accept=".xlsx"
          onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f) }}
          className="text-sm"
        />
        {nomeArquivo && <p className="mt-2 text-xs text-gray-400">Arquivo: {nomeArquivo}</p>}
        {carregando && <p className="mt-2 text-xs text-gray-500">Comparando...</p>}
        {erro && <p className="mt-2 text-xs font-medium text-red-600">{erro}</p>}
      </div>

      {resultado && (
        <>
          {resultado.codigosSemSupervisorVinculado.length > 0 && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
              Códigos do RH sem supervisor vinculado na configuração: {resultado.codigosSemSupervisorVinculado.join(', ')}.
              A comparação seguiu, mas vincule-os na seção "Configuração de Códigos" abaixo pra conferir o supervisor corretamente.
            </p>
          )}
          {resultado.linhasIgnoradas > 0 && (
            <p className="text-xs text-gray-400">{resultado.linhasIgnoradas} linha(s) da planilha ignorada(s) por falta de RE ou nome.</p>
          )}
          <ResumoAgregado linhas={resultado.resumo} totalGeral={resultado.totalGeral} supervisores={supervisoresApelidos} />
          <TabelaDivergencias divergencias={resultado.divergencias} />
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Write `config-codigos.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { salvarConfigCodigoRH } from '@/app/(admin)/conferencia-rh/actions'

type ConfigCodigo = { codigo: number; apelido: string; supervisor_id: string | null }
type Supervisor = { id: string; nome: string | null }

export function ConfigCodigos({ codigos, supervisores }: { codigos: ConfigCodigo[]; supervisores: Supervisor[] }) {
  const [salvando, setSalvando] = useState<number | null>(null)
  const [valores, setValores] = useState<Record<number, string>>(
    Object.fromEntries(codigos.map(c => [c.codigo, c.supervisor_id ?? '']))
  )

  async function onChange(codigo: number, supervisorId: string) {
    setValores(v => ({ ...v, [codigo]: supervisorId }))
    setSalvando(codigo)
    await salvarConfigCodigoRH(codigo, supervisorId || null)
    setSalvando(null)
  }

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-500">
        Configuração de Códigos RH → Supervisor
      </h2>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-400">
            <th className="pb-2">Código</th>
            <th className="pb-2">Apelido</th>
            <th className="pb-2">Supervisor vinculado</th>
          </tr>
        </thead>
        <tbody>
          {codigos.map(c => (
            <tr key={c.codigo} className="border-t border-gray-50">
              <td className="py-2 text-xs text-gray-700">{c.codigo}</td>
              <td className="py-2 text-xs font-medium text-gray-900">{c.apelido}</td>
              <td className="py-2">
                <select
                  value={valores[c.codigo] ?? ''}
                  onChange={e => onChange(c.codigo, e.target.value)}
                  className="h-8 rounded-lg border border-gray-200 px-2 text-xs"
                >
                  <option value="">— não vinculado —</option>
                  {supervisores.map(s => (
                    <option key={s.id} value={s.id}>{s.nome}</option>
                  ))}
                </select>
                {salvando === c.codigo && <span className="ml-2 text-[10px] text-gray-400">salvando...</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit
```
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add components/conferencia-rh/upload-form.tsx components/conferencia-rh/config-codigos.tsx
git commit -m "feat(conferencia-rh): formulário de upload e config de códigos"
```

---

## Task 9: Page + nav entry

**Files:**
- Create: `app/(admin)/conferencia-rh/page.tsx`
- Modify: `components/admin/nav-config.ts:43-46` (add item to "Administração" group)

- [ ] **Step 1: Write the page**

```tsx
import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth/get-user'
import { createClient } from '@/lib/supabase/server'
import { UploadForm } from '@/components/conferencia-rh/upload-form'
import { ConfigCodigos } from '@/components/conferencia-rh/config-codigos'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyQ = { from: (t: string) => any }

export default async function ConferenciaRHPage() {
  const auth = await getUser()
  if (!auth) redirect('/login')
  if (auth.perfil.role !== 'admin' && auth.perfil.role !== 'coordenador') redirect('/dashboard')

  const supabase = createClient()
  const [{ data: codigosRaw }, { data: supervisoresRaw }] = await Promise.all([
    (supabase as AnyQ).from('config_codigos_rh').select('codigo, apelido, supervisor_id').order('codigo'),
    supabase.from('perfis').select('id, nome').eq('role', 'supervisor').eq('ativo', true).order('nome'),
  ])

  type ConfigCodigo = { codigo: number; apelido: string; supervisor_id: string | null }
  const codigos = (codigosRaw ?? []) as unknown as ConfigCodigo[]
  const supervisoresApelidos = codigos.map(c => c.apelido)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Conferência RH</h1>
        <p className="text-sm text-gray-400">Compara a listagem de ativos/afastados do RH com o efetivo cadastrado no sistema</p>
      </div>

      <UploadForm supervisoresApelidos={supervisoresApelidos} />

      {auth.perfil.role === 'admin' && (
        <ConfigCodigos codigos={codigos} supervisores={(supervisoresRaw ?? []) as { id: string; nome: string | null }[]} />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Add the nav entry**

In `components/admin/nav-config.ts`, inside the `'Administração'` group's `items` array, right after the `{ href: '/auditoria', label: 'Auditoria' },` line, add:

```ts
      { href: '/conferencia-rh', label: 'Conferência RH' },
```

- [ ] **Step 3: Verify — type-check and build**

```bash
npx tsc --noEmit
npm run build
```
Expected: both succeed with no errors.

- [ ] **Step 4: Commit**

```bash
git add "app/(admin)/conferencia-rh/page.tsx" components/admin/nav-config.ts
git commit -m "feat(conferencia-rh): página e item de menu"
```

---

## Task 10: Manual end-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Start the dev server preview and log in as admin**

Use the browser preview tool against `npm run dev`, navigate to `/conferencia-rh`.

- [ ] **Step 2: Upload the real RH file**

Upload `C:\Users\Rodolfo\Downloads\ATIVOS MOGI 10-08-2026.xlsx`. Confirm:
- The resumo agregado table renders with 8 supervisor columns + Afast. + Total, and the totals match the source file's RESUMO tab (877 total, 836 total ativos, 41 afastados) *for the RH side* — the Sistema side will legitimately differ, that's the point of the feature.
- The divergências table lists rows, filter and search work, "Exportar Excel" downloads a file.
- Clicking "Abrir perfil" on a row with a system match navigates to that funcionário's page.

- [ ] **Step 3: Verify role gating**

Log in (or check middleware logic) as a `viewer` role and confirm `/conferencia-rh` redirects to `/dashboard`. Confirm the "Configuração de Códigos" section is hidden for a `coordenador` login and visible for `admin`.

- [ ] **Step 4: Fix any issues found, re-run `npx tsc --noEmit` and `npm run build`, then commit fixes**

```bash
git add -A
git commit -m "fix(conferencia-rh): ajustes pós-teste manual"
```
(Only run this commit if there were actual fixes — skip if Step 2/3 passed clean.)

---

## Notes for whoever executes this plan

- Everything lives on branch `feature/conferencia-rh` (already created). Do not merge to `master` without the user's explicit go-ahead — per `CLAUDE.md`, `git push` or any remote-affecting git operation requires confirmation.
- The Supabase MCP tools may report a permission error for `execute_sql`/`apply_migration` in this environment (seen during design). If so, surface the exact SQL to the user and ask them to run it in Supabase Studio, or retry once they've granted access — don't skip the migration silently.
- `funcionarios.status` values observed in the codebase: `ativo` (implicit/default), `afastado`, `atestado`, `ferias`, `rescisao_indireta`, `desligado`. Task 6 treats `afastado` and `atestado` as "afastado" for the RH comparison — confirm this reads right against real data during Task 10; if `ferias` should also count as RH's "AFASTADO", that's a one-line change to the `.includes` check in `actions.ts`.
