# Score de Risco do Funcionário Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Calcular um score de risco (faltas + advertências + atestados + movimentações nos últimos 90 dias) e exibir um badge colorido no perfil individual do funcionário e como coluna ordenável na lista de efetivo.

**Architecture:** Função pura `calcularScoreRisco()` em `lib/risk-score.ts` recebe eventos já filtrados pela janela de 90 dias e devolve `{ score, nivel, breakdown }`. Componente `BadgeRisco` renderiza o resultado. Perfil individual (`app/(admin)/efetivo/[id]/page.tsx`) busca eventos do funcionário via `Promise.all` e chama a função. Lista de efetivo (`app/(admin)/efetivo/page.tsx`) busca todos os eventos da janela sem filtro de `funcionario_id` (mesmo padrão já usado para `faltasAtivas`/`coberturasHoje`), agrupa em `Map`s e calcula o score por funcionário no loop de enrichment existente.

**Tech Stack:** Next.js 14 App Router, TypeScript, Supabase (`createClient()` síncrono), Tailwind, Vitest.

Referência de design completo: [docs/superpowers/specs/2026-09-22-score-risco-funcionario-design.md](../specs/2026-09-22-score-risco-funcionario-design.md)

---

### Task 1: Função pura de cálculo do score

**Files:**
- Create: `lib/risk-score.ts`
- Test: `lib/risk-score.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// lib/risk-score.test.ts
import { describe, it, expect } from 'vitest'
import { calcularScoreRisco, dataCorteScoreRisco, JANELA_SCORE_RISCO_DIAS } from './risk-score'

describe('calcularScoreRisco', () => {
  it('devolve score 0 e nível ok sem nenhum evento', () => {
    const r = calcularScoreRisco({ faltas: [], advertencias: [], atestados: [], movimentacoes: [] })
    expect(r.score).toBe(0)
    expect(r.nivel).toBe('ok')
    expect(r.breakdown).toEqual([])
  })

  it('pontua falta sem justificativa com peso 3', () => {
    const r = calcularScoreRisco({
      faltas: [{ data_falta: '2026-09-01', tipo: 'sem_justificativa' }],
      advertencias: [], atestados: [], movimentacoes: [],
    })
    expect(r.score).toBe(3)
    expect(r.nivel).toBe('ok')
  })

  it('pontua falta justificada com peso 0.5', () => {
    const r = calcularScoreRisco({
      faltas: [{ data_falta: '2026-09-01', tipo: 'com_atestado' }],
      advertencias: [], atestados: [], movimentacoes: [],
    })
    expect(r.score).toBe(0.5)
  })

  it('pontua advertência por grau (verbal=3, escrita=5, suspensao=8)', () => {
    const r = calcularScoreRisco({
      faltas: [], atestados: [], movimentacoes: [],
      advertencias: [
        { data_ocorrencia: '2026-09-01', grau: 'verbal' },
        { data_ocorrencia: '2026-09-05', grau: 'escrita' },
        { data_ocorrencia: '2026-09-10', grau: 'suspensao' },
      ],
    })
    expect(r.score).toBe(16)
  })

  it('trata grau nulo/desconhecido como leve (peso 3)', () => {
    const r = calcularScoreRisco({
      faltas: [], atestados: [], movimentacoes: [],
      advertencias: [{ data_ocorrencia: '2026-09-01', grau: null }],
    })
    expect(r.score).toBe(3)
  })

  it('pontua atestado por dia de afastamento (0.3/dia)', () => {
    const r = calcularScoreRisco({
      faltas: [], advertencias: [], movimentacoes: [],
      atestados: [{ data_inicio: '2026-09-01', data_fim: '2026-09-10' }], // 10 dias
    })
    expect(r.score).toBe(3)
  })

  it('atestado de 1 dia (sem data_fim) conta como 1 dia', () => {
    const r = calcularScoreRisco({
      faltas: [], advertencias: [], movimentacoes: [],
      atestados: [{ data_inicio: '2026-09-01', data_fim: null }],
    })
    expect(r.score).toBe(0.3)
  })

  it('só pontua movimentação relevante além da 2ª no período', () => {
    const mov = (tipo: string, i: number) => ({ tipo, created_at: `2026-09-0${i}T00:00:00Z` })
    const r = calcularScoreRisco({
      faltas: [], advertencias: [], atestados: [],
      movimentacoes: [
        mov('transferencia', 1),
        mov('mudanca_funcao', 2),
        mov('mudanca_horario', 3),
        mov('mudanca_horario', 4),
      ],
    })
    // 4 movimentações relevantes, limite 2 sem ponto → 2 extras × 1pt
    expect(r.score).toBe(2)
  })

  it('ignora movimentação de tipo não relevante para o score', () => {
    const r = calcularScoreRisco({
      faltas: [], advertencias: [], atestados: [],
      movimentacoes: [
        { tipo: 'outro_tipo_qualquer', created_at: '2026-09-01T00:00:00Z' },
        { tipo: 'outro_tipo_qualquer', created_at: '2026-09-02T00:00:00Z' },
        { tipo: 'outro_tipo_qualquer', created_at: '2026-09-03T00:00:00Z' },
      ],
    })
    expect(r.score).toBe(0)
  })

  it('classifica nível por faixa: ok < 5, atencao 5-9, critico >= 10', () => {
    const faltasN = (n: number) => Array.from({ length: n }, (_, i) => ({ data_falta: `2026-09-${String(i + 1).padStart(2, '0')}`, tipo: 'sem_justificativa' }))
    expect(calcularScoreRisco({ faltas: faltasN(1), advertencias: [], atestados: [], movimentacoes: [] }).nivel).toBe('ok')      // 3pt
    expect(calcularScoreRisco({ faltas: faltasN(2), advertencias: [], atestados: [], movimentacoes: [] }).nivel).toBe('atencao') // 6pt
    expect(calcularScoreRisco({ faltas: faltasN(4), advertencias: [], atestados: [], movimentacoes: [] }).nivel).toBe('critico') // 12pt
  })

  it('score não tem teto — soma aberta', () => {
    const faltasN = (n: number) => Array.from({ length: n }, (_, i) => ({ data_falta: `2026-01-${String((i % 28) + 1).padStart(2, '0')}`, tipo: 'sem_justificativa' }))
    const r = calcularScoreRisco({ faltas: faltasN(20), advertencias: [], atestados: [], movimentacoes: [] })
    expect(r.score).toBe(60)
    expect(r.nivel).toBe('critico')
  })

  it('breakdown descreve cada categoria pontuada', () => {
    const r = calcularScoreRisco({
      faltas: [{ data_falta: '2026-09-01', tipo: 'sem_justificativa' }],
      advertencias: [{ data_ocorrencia: '2026-09-01', grau: 'verbal' }],
      atestados: [], movimentacoes: [],
    })
    expect(r.breakdown).toEqual([
      '1 falta(s) sem justificativa (3pt)',
      '1 advertência(s) grau verbal (3pt)',
    ])
  })
})

describe('dataCorteScoreRisco', () => {
  it('devolve a data 90 dias antes da referência, formato YYYY-MM-DD', () => {
    expect(dataCorteScoreRisco(new Date('2026-09-22T12:00:00Z'))).toBe('2026-06-24')
  })

  it('usa JANELA_SCORE_RISCO_DIAS = 90', () => {
    expect(JANELA_SCORE_RISCO_DIAS).toBe(90)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/risk-score.test.ts`
Expected: FAIL — `Cannot find module './risk-score'`

- [ ] **Step 3: Write the implementation**

```typescript
// lib/risk-score.ts

export type NivelRisco = 'ok' | 'atencao' | 'critico'

export type FaltaEvento = { data_falta: string; tipo: string }
export type AdvertenciaEvento = { data_ocorrencia: string; grau: string | null }
export type AtestadoEvento = { data_inicio: string; data_fim: string | null }
export type MovimentacaoEvento = { created_at: string | null; tipo: string }

export type EventosScoreRisco = {
  faltas: FaltaEvento[]
  advertencias: AdvertenciaEvento[]
  atestados: AtestadoEvento[]
  movimentacoes: MovimentacaoEvento[]
}

export type ScoreRisco = {
  score: number
  nivel: NivelRisco
  breakdown: string[]
}

export const JANELA_SCORE_RISCO_DIAS = 90

const PESO_FALTA_SEM_JUSTIFICATIVA = 3
const PESO_FALTA_JUSTIFICADA = 0.5
const PESO_ATESTADO_POR_DIA = 0.3
const PESO_MOVIMENTACAO_EXTRA = 1
const LIMITE_MOVIMENTACOES_SEM_PONTO = 2

const PESO_GRAU_ADVERTENCIA: Record<string, number> = {
  verbal: 3,
  escrita: 5,
  suspensao: 8,
}
const PESO_GRAU_PADRAO = 3

const TIPOS_FALTA_JUSTIFICADA = new Set([
  'com_atestado', 'falta_justificada', 'declaracao',
])

const TIPOS_MOVIMENTACAO_RELEVANTES = new Set([
  'transferencia', 'mudanca_funcao', 'mudanca_horario',
])

const LIMIAR_ATENCAO = 5
const LIMIAR_CRITICO = 10

function diasEntre(inicio: string, fim: string | null): number {
  if (!fim) return 1
  const d1 = new Date(inicio)
  const d2 = new Date(fim)
  const diff = Math.round((d2.getTime() - d1.getTime()) / 86400000)
  return Math.max(1, diff + 1)
}

function arredondar(n: number): number {
  return Math.round(n * 10) / 10
}

export function dataCorteScoreRisco(referencia: Date = new Date()): string {
  const d = new Date(referencia)
  d.setUTCDate(d.getUTCDate() - JANELA_SCORE_RISCO_DIAS)
  return d.toISOString().split('T')[0]
}

export function calcularScoreRisco(eventos: EventosScoreRisco): ScoreRisco {
  let score = 0
  const breakdown: string[] = []

  const faltasSemJustificativa = eventos.faltas.filter(f => !TIPOS_FALTA_JUSTIFICADA.has(f.tipo))
  const faltasJustificadas = eventos.faltas.filter(f => TIPOS_FALTA_JUSTIFICADA.has(f.tipo))

  if (faltasSemJustificativa.length > 0) {
    const pts = arredondar(faltasSemJustificativa.length * PESO_FALTA_SEM_JUSTIFICATIVA)
    score += pts
    breakdown.push(`${faltasSemJustificativa.length} falta(s) sem justificativa (${pts}pt)`)
  }
  if (faltasJustificadas.length > 0) {
    const pts = arredondar(faltasJustificadas.length * PESO_FALTA_JUSTIFICADA)
    score += pts
    breakdown.push(`${faltasJustificadas.length} falta(s) justificada(s) (${pts}pt)`)
  }

  const advertenciasPorGrau = new Map<string, number>()
  for (const a of eventos.advertencias) {
    const grau = a.grau ?? 'verbal'
    advertenciasPorGrau.set(grau, (advertenciasPorGrau.get(grau) ?? 0) + 1)
  }
  for (const [grau, qtd] of advertenciasPorGrau) {
    const peso = PESO_GRAU_ADVERTENCIA[grau] ?? PESO_GRAU_PADRAO
    const pts = arredondar(qtd * peso)
    score += pts
    breakdown.push(`${qtd} advertência(s) grau ${grau} (${pts}pt)`)
  }

  const totalDiasAtestado = eventos.atestados.reduce((sum, a) => sum + diasEntre(a.data_inicio, a.data_fim), 0)
  if (totalDiasAtestado > 0) {
    const pts = arredondar(totalDiasAtestado * PESO_ATESTADO_POR_DIA)
    score += pts
    breakdown.push(`${totalDiasAtestado} dia(s) de atestado (${pts}pt)`)
  }

  const movRelevantes = eventos.movimentacoes.filter(m => TIPOS_MOVIMENTACAO_RELEVANTES.has(m.tipo))
  const extras = Math.max(0, movRelevantes.length - LIMITE_MOVIMENTACOES_SEM_PONTO)
  if (extras > 0) {
    const pts = arredondar(extras * PESO_MOVIMENTACAO_EXTRA)
    score += pts
    breakdown.push(`${movRelevantes.length} movimentação(ões) no período, ${extras} além do limite (${pts}pt)`)
  }

  score = arredondar(score)
  const nivel: NivelRisco = score >= LIMIAR_CRITICO ? 'critico' : score >= LIMIAR_ATENCAO ? 'atencao' : 'ok'

  return { score, nivel, breakdown }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/risk-score.test.ts`
Expected: PASS (14 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/risk-score.ts lib/risk-score.test.ts
git commit -m "feat(efetivo): função de cálculo do score de risco"
```

---

### Task 2: Componente de badge visual

**Files:**
- Create: `components/efetivo/badge-risco.tsx`

- [ ] **Step 1: Write the component**

```typescript
// components/efetivo/badge-risco.tsx
import { cn } from '@/lib/utils'
import type { NivelRisco } from '@/lib/risk-score'

const NIVEL_STYLE: Record<NivelRisco, { emoji: string; label: string; className: string }> = {
  ok:      { emoji: '🟢', label: 'ok',       className: 'bg-green-50 text-green-700 ring-green-200' },
  atencao: { emoji: '🟡', label: 'atenção',  className: 'bg-amber-50 text-amber-700 ring-amber-200' },
  critico: { emoji: '🔴', label: 'crítico',  className: 'bg-red-50 text-red-700 ring-red-200'       },
}

export function BadgeRisco({
  score,
  nivel,
  breakdown,
}: {
  score: number
  nivel: NivelRisco
  breakdown: string[]
}) {
  const style = NIVEL_STYLE[nivel]
  const title = breakdown.length > 0 ? breakdown.join(' · ') : 'Nenhuma ocorrência nos últimos 90 dias'

  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset',
        style.className,
      )}
    >
      {style.emoji} Risco: {score}pt
    </span>
  )
}
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: no new errors referencing `badge-risco.tsx`

- [ ] **Step 3: Commit**

```bash
git add components/efetivo/badge-risco.tsx
git commit -m "feat(efetivo): componente BadgeRisco"
```

---

### Task 3: Badge no perfil individual

**Files:**
- Modify: `app/(admin)/efetivo/[id]/page.tsx`

- [ ] **Step 1: Adicionar imports**

In `app/(admin)/efetivo/[id]/page.tsx`, after the existing imports (line 12), add:

```typescript
import { calcularScoreRisco, dataCorteScoreRisco } from '@/lib/risk-score'
import { BadgeRisco } from '@/components/efetivo/badge-risco'
```

- [ ] **Step 2: Adicionar `grau` na query de advertências**

Replace (around line 82-86):

```typescript
    supabase
      .from('advertencias')
      .select('id, tipo, descricao, data_ocorrencia, status')
      .eq('funcionario_id', id)
      .order('created_at', { ascending: false }),
```

with:

```typescript
    supabase
      .from('advertencias')
      .select('id, tipo, grau, descricao, data_ocorrencia, status')
      .eq('funcionario_id', id)
      .order('created_at', { ascending: false }),
```

- [ ] **Step 3: Adicionar `grau` ao tipo `AdvertenciaItem`**

In `components/efetivo/perfil-tabs.tsx`, modify the type (around line 33-39):

```typescript
export type AdvertenciaItem = {
  id: string
  tipo: string | null
  grau: string | null
  descricao: string | null
  data_ocorrencia: string | null
  status: 'pendente' | 'gerada' | 'entregue' | null
}
```

- [ ] **Step 4: Buscar faltas e atestados da janela de 90 dias**

In `app/(admin)/efetivo/[id]/page.tsx`, right after the `Promise.all` block that fetches `movRaw`/`advRaw`/`solRaw`/etc. (ends around line 134), add a second fetch for the score window:

```typescript
  const cutoffRisco = dataCorteScoreRisco()
  const [
    { data: faltasRiscoRaw },
    { data: atestadosRiscoRaw },
  ] = await Promise.all([
    supabase
      .from('faltas')
      .select('data_falta, tipo')
      .eq('funcionario_id', id)
      .gte('data_falta', cutoffRisco),
    supabase
      .from('atestados')
      .select('data_inicio, data_fim')
      .eq('funcionario_id', id)
      .gte('data_inicio', cutoffRisco),
  ])
```

- [ ] **Step 5: Calcular o score**

After the line `const advertencias  = (advRaw ?? []) as unknown as AdvertenciaItem[]` (around line 187), add:

```typescript
  const advertenciasJanela = advertencias.filter(a => (a.data_ocorrencia ?? '') >= cutoffRisco)
  const movimentacoesJanela = movimentacoes.filter(m => (m.created_at ?? '').slice(0, 10) >= cutoffRisco)

  const scoreRisco = calcularScoreRisco({
    faltas: (faltasRiscoRaw ?? []) as { data_falta: string; tipo: string }[],
    atestados: (atestadosRiscoRaw ?? []) as { data_inicio: string; data_fim: string | null }[],
    advertencias: advertenciasJanela.map(a => ({ data_ocorrencia: a.data_ocorrencia ?? '', grau: a.grau ?? a.tipo })),
    movimentacoes: movimentacoesJanela.map(m => ({ created_at: m.created_at, tipo: m.tipo })),
  })
```

- [ ] **Step 6: Renderizar o badge no header**

Replace (around line 276-283):

```tsx
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{f.nome}</h1>
              {statusBadge && (
                <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset', statusBadge.className)}>
                  {statusBadge.label}
                </span>
              )}
            </div>
```

with:

```tsx
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{f.nome}</h1>
              {statusBadge && (
                <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset', statusBadge.className)}>
                  {statusBadge.label}
                </span>
              )}
              <BadgeRisco score={scoreRisco.score} nivel={scoreRisco.nivel} breakdown={scoreRisco.breakdown} />
            </div>
```

- [ ] **Step 7: Build**

Run: `npm run build`
Expected: build succeeds, no type errors

- [ ] **Step 8: Commit**

```bash
git add "app/(admin)/efetivo/[id]/page.tsx" components/efetivo/perfil-tabs.tsx
git commit -m "feat(efetivo): badge de score de risco no perfil individual"
```

---

### Task 4: Coluna de risco na lista de efetivo

**Files:**
- Modify: `app/(admin)/efetivo/page.tsx`
- Modify: `components/efetivo/funcionarios-table.tsx`
- Modify: `components/efetivo/efetivo-client.tsx`

- [ ] **Step 1: Buscar eventos da janela de 90 dias (todos os funcionários)**

In `app/(admin)/efetivo/page.tsx`, add the import after the existing ones (line 10):

```typescript
import { calcularScoreRisco, dataCorteScoreRisco } from '@/lib/risk-score'
```

Right after the "Coberturas ativas hoje" block (ends around line 227), add:

```typescript
  // Eventos dos últimos 90 dias para o score de risco — mesmo padrão de
  // faltasRaw/coberturasHoje acima: busca sem filtro de funcionario_id
  // (evita URL enorme com ~1500 UUIDs) e agrupa em Maps.
  const cutoffRisco = dataCorteScoreRisco()
  const [
    { data: faltasRiscoRaw },
    { data: atestadosRiscoRaw },
    { data: advertenciasRiscoRaw },
    { data: movimentacoesRiscoRaw },
  ] = await Promise.all([
    (supabase as unknown as AnyQ).from('faltas').select('funcionario_id, data_falta, tipo').gte('data_falta', cutoffRisco),
    (supabase as unknown as AnyQ).from('atestados').select('funcionario_id, data_inicio, data_fim').gte('data_inicio', cutoffRisco),
    (supabase as unknown as AnyQ).from('advertencias').select('funcionario_id, data_ocorrencia, grau, tipo').gte('data_ocorrencia', cutoffRisco),
    (supabase as unknown as AnyQ).from('movimentacoes').select('funcionario_id, tipo, created_at').gte('created_at', cutoffRisco),
  ])

  type FaltaRisco = { funcionario_id: string; data_falta: string; tipo: string }
  type AtestadoRisco = { funcionario_id: string; data_inicio: string; data_fim: string | null }
  type AdvertenciaRisco = { funcionario_id: string; data_ocorrencia: string; grau: string | null; tipo: string | null }
  type MovimentacaoRisco = { funcionario_id: string; tipo: string; created_at: string | null }

  function agrupar<T extends { funcionario_id: string }>(rows: T[] | null): Map<string, T[]> {
    const map = new Map<string, T[]>()
    for (const row of rows ?? []) {
      const list = map.get(row.funcionario_id)
      if (list) list.push(row)
      else map.set(row.funcionario_id, [row])
    }
    return map
  }

  const faltasRiscoMap        = agrupar<FaltaRisco>(faltasRiscoRaw)
  const atestadosRiscoMap     = agrupar<AtestadoRisco>(atestadosRiscoRaw)
  const advertenciasRiscoMap  = agrupar<AdvertenciaRisco>(advertenciasRiscoRaw)
  const movimentacoesRiscoMap = agrupar<MovimentacaoRisco>(movimentacoesRiscoRaw)
```

- [ ] **Step 2: Calcular o score no loop de enrichment**

Replace the `funcionarios` map (around line 230-243):

```typescript
  // Enrich ALL funcionarios with supervisor_nome + supervisor_id + origem_ocupacional_cat + turno_atual
  const funcionarios = rawFuncs.map(f => {
    const sup = f.posto_id ? postoSupervisorMap.get(f.posto_id) : undefined
    const horario = horarioMap.get(f.id)
    return {
      ...f,
      supervisor_nome:        sup?.nomeCompleto ?? null,
      supervisor_id:          sup?.id ?? null,
      origem_ocupacional_cat: catOrigemMap.get(f.id) ?? null,
      turno_atual_nome:       horario?.nome ?? null,
      turno_atual_regime:     horario?.regime ?? null,
      turno_atual_resumo:     horario?.resumo ?? null,
      data_fim_prevista_afastamento: f.status === 'afastado' ? (afastamentoPrevistoMap.get(f.id) ?? null) : null,
    }
  })
```

with:

```typescript
  // Enrich ALL funcionarios with supervisor_nome + supervisor_id + origem_ocupacional_cat + turno_atual + score_risco
  const funcionarios = rawFuncs.map(f => {
    const sup = f.posto_id ? postoSupervisorMap.get(f.posto_id) : undefined
    const horario = horarioMap.get(f.id)
    const scoreRisco = calcularScoreRisco({
      faltas: faltasRiscoMap.get(f.id) ?? [],
      atestados: atestadosRiscoMap.get(f.id) ?? [],
      advertencias: (advertenciasRiscoMap.get(f.id) ?? []).map(a => ({ data_ocorrencia: a.data_ocorrencia, grau: a.grau ?? a.tipo })),
      movimentacoes: movimentacoesRiscoMap.get(f.id) ?? [],
    })
    return {
      ...f,
      supervisor_nome:        sup?.nomeCompleto ?? null,
      supervisor_id:          sup?.id ?? null,
      origem_ocupacional_cat: catOrigemMap.get(f.id) ?? null,
      turno_atual_nome:       horario?.nome ?? null,
      turno_atual_regime:     horario?.regime ?? null,
      turno_atual_resumo:     horario?.resumo ?? null,
      data_fim_prevista_afastamento: f.status === 'afastado' ? (afastamentoPrevistoMap.get(f.id) ?? null) : null,
      score_risco:  scoreRisco.score,
      nivel_risco:  scoreRisco.nivel,
      breakdown_risco: scoreRisco.breakdown,
    }
  })
```

- [ ] **Step 3: Adicionar campos ao tipo `FuncionarioRow`**

In `components/efetivo/funcionarios-table.tsx`, add the import (after line 7) and extend the type (around line 18-46):

```typescript
import type { NivelRisco } from '@/lib/risk-score'
import { BadgeRisco } from './badge-risco'
```

```typescript
export type FuncionarioRow = {
  id: string
  nome: string
  registro: string | null
  cpf: string | null
  pcd: boolean | null
  pcd_tipo: string | null
  pcd_tipo_outro: string | null
  status: 'ativo' | 'atestado' | 'afastado' | 'ferias' | 'desligado' | 'faltante' | 'rescisao_indireta' | null
  motivo_afastamento: 'ausencia_temporaria' | 'inss' | null
  origem_ocupacional_cat: string | null
  data_fim_prevista_afastamento?: string | null
  data_admissao: string | null
  data_desligamento: string | null
  motivo_desligamento: string | null
  tipo_desligamento: string | null
  posto_id: string | null
  periodo_experiencia: '30+30' | '45+45' | null
  fase_experiencia: '1' | '2' | 'concluido' | null
  data_fim_fase1: string | null
  data_fim_fase2: string | null
  funcoes: { id: string; nome: string } | null
  postos: { id: string; nome: string; secretaria: string | null } | null
  supervisor_nome?: string | null
  supervisor_id?: string | null
  turno_atual_nome?:   string | null
  turno_atual_regime?: string | null
  turno_atual_resumo?: string | null
  score_risco?: number
  nivel_risco?: NivelRisco
  breakdown_risco?: string[]
}
```

- [ ] **Step 4: Adicionar coluna "Risco" na tabela**

In `components/efetivo/funcionarios-table.tsx`, add to `COLS` (around line 93-103), right before `{ label: 'Ações' }`:

```typescript
const COLS: { label: string; sortKey?: string }[] = [
  { label: 'Registro'                           },
  { label: 'Nome',       sortKey: 'nome'       },
  { label: 'Função',     sortKey: 'funcao'     },
  { label: 'Posto',      sortKey: 'posto'      },
  { label: 'Secretaria', sortKey: 'secretaria' },
  { label: 'Supervisor'                         },
  { label: 'Status',     sortKey: 'status'     },
  { label: 'Risco',      sortKey: 'risco'      },
  { label: 'Retorno Previsto'                   },
  { label: 'Ações'                              },
]
```

- [ ] **Step 5: Renderizar a célula**

Find the `<tbody>` row rendering in `components/efetivo/funcionarios-table.tsx` (each `<tr>` renders one `<td>` per column — locate the `<td>` for the Status column and add a new `<td>` immediately after it):

```tsx
                    <td className="px-5 py-3">
                      <BadgeRisco
                        score={f.score_risco ?? 0}
                        nivel={f.nivel_risco ?? 'ok'}
                        breakdown={f.breakdown_risco ?? []}
                      />
                    </td>
```

- [ ] **Step 6: Ordenação numérica por risco**

In `components/efetivo/efetivo-client.tsx`, replace the sort block (around line 107-120):

```typescript
  const sorted = useMemo(() => {
    const list = [...filtered]
    list.sort((a, b) => {
      let av = '', bv = ''
      if (sortCol === 'nome')       { av = a.nome ?? '';                bv = b.nome ?? ''                }
      if (sortCol === 'funcao')     { av = a.funcoes?.nome ?? '';       bv = b.funcoes?.nome ?? ''       }
      if (sortCol === 'posto')      { av = a.postos?.nome ?? '';        bv = b.postos?.nome ?? ''        }
      if (sortCol === 'secretaria') { av = a.postos?.secretaria ?? '';  bv = b.postos?.secretaria ?? ''  }
      if (sortCol === 'status')     { av = a.status ?? '';              bv = b.status ?? ''              }
      const cmp = av.localeCompare(bv, 'pt-BR', { sensitivity: 'base' })
      return sortDir === 'asc' ? cmp : -cmp
    })
    return list
  }, [filtered, sortCol, sortDir])
```

with:

```typescript
  const sorted = useMemo(() => {
    const list = [...filtered]
    list.sort((a, b) => {
      if (sortCol === 'risco') {
        const cmp = (a.score_risco ?? 0) - (b.score_risco ?? 0)
        return sortDir === 'asc' ? cmp : -cmp
      }
      let av = '', bv = ''
      if (sortCol === 'nome')       { av = a.nome ?? '';                bv = b.nome ?? ''                }
      if (sortCol === 'funcao')     { av = a.funcoes?.nome ?? '';       bv = b.funcoes?.nome ?? ''       }
      if (sortCol === 'posto')      { av = a.postos?.nome ?? '';        bv = b.postos?.nome ?? ''        }
      if (sortCol === 'secretaria') { av = a.postos?.secretaria ?? '';  bv = b.postos?.secretaria ?? ''  }
      if (sortCol === 'status')     { av = a.status ?? '';              bv = b.status ?? ''              }
      const cmp = av.localeCompare(bv, 'pt-BR', { sensitivity: 'base' })
      return sortDir === 'asc' ? cmp : -cmp
    })
    return list
  }, [filtered, sortCol, sortDir])
```

- [ ] **Step 7: Build**

Run: `npm run build`
Expected: build succeeds, no type errors

- [ ] **Step 8: Commit**

```bash
git add "app/(admin)/efetivo/page.tsx" components/efetivo/funcionarios-table.tsx components/efetivo/efetivo-client.tsx
git commit -m "feat(efetivo): coluna de score de risco ordenável na lista de efetivo"
```

---

### Task 5: Verificação manual no browser

**Files:** none (verification only)

- [ ] **Step 1: Rodar o dev server e abrir o perfil de um funcionário com ocorrências**

Confirmar visualmente:
- Badge de risco aparece ao lado de "Ativo" no header do perfil
- Cor bate com o nível (verde/amber/vermelho)
- Hover no badge mostra o breakdown no tooltip nativo

- [ ] **Step 2: Abrir a lista de Efetivo**

Confirmar visualmente:
- Coluna "Risco" aparece com badge por linha
- Clicar no cabeçalho "Risco" ordena a lista por score (asc/desc alternando)
- Funcionário sem ocorrências mostra badge verde "Risco: 0pt"
