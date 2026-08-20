# Alerta de Retorno INSS Vencido Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar no dashboard (admin e supervisor) um alerta visual listando funcionários cujo "Retorno Previsto" de afastamento INSS já passou sem que o retorno tenha sido lançado — mesmo padrão visual dos alertas de déficit de posto/CAT/férias já existentes.

**Architecture:** Query nova na tabela `afastamentos` (`data_fim_real IS NULL` e `data_fim_prevista <= hoje`, funcionário ainda `status = 'afastado'`), adicionada nas duas funções de dashboard já existentes (`buscarAlertasDashboard` pro admin, sem filtro de posto; `buscarDadosSupervisor` pro supervisor, reaproveitando os `funcIds` já calculados e escopados aos postos dele). Renderizado como bloco novo nos dois componentes de alerta já existentes.

**Tech Stack:** Next.js 14 Server Components, TypeScript, Supabase.

**Nota sobre testes:** projeto sem test runner configurado. Verificação via `npx tsc --noEmit` e `npm run build` (roda `next lint` — já causou falha de deploy antes por erro que `tsc` sozinho não pega).

---

## Arquivos

- Modificar `app/(admin)/dashboard/actions.ts` — tipo `RetornoInssVencido`, query no admin (`buscarAlertasDashboard`) e no supervisor (`buscarDadosSupervisor`)
- Modificar `components/dashboard/alertas-criticos.tsx` — bloco de alerta pro admin
- Modificar `app/(admin)/dashboard/page.tsx` — bloco de alerta pro supervisor (dentro de `SupervisorDashboard`)

---

### Task 1: Tipo compartilhado + query no dashboard do admin

**Files:**
- Modify: `app/(admin)/dashboard/actions.ts`

- [ ] **Step 1: Adicionar o tipo `RetornoInssVencido` e o helper de dias em atraso**

Localizar o bloco de helpers internos (por volta da linha 144-153):

```typescript
// ─── Helpers internos ─────────────────────────────────────────────────────────

function todayPlusDays(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function currentDateStr(): string {
  return new Date().toISOString().split('T')[0]
}
```

Adicionar logo depois:

```typescript

function diasAtraso(dataFimPrevista: string, hoje: string): number {
  const a = new Date(dataFimPrevista + 'T00:00:00Z')
  const b = new Date(hoje + 'T00:00:00Z')
  return Math.round((b.getTime() - a.getTime()) / 86_400_000)
}
```

Localizar o tipo `CatAlerta` e `AlertasDashboard` (por volta da linha 82-94):

```typescript
export type CatAlerta = {
  id: string
  funcionarioNome: string
  prazoLimite: string
  emAtraso: boolean
}

export type AlertasDashboard = {
  postosDeficit: PostoDeficit[]
  postosExcedentes: PostoExcedente[]
  funcSemPosto: number
  feriasLimiteVencendo: number
  catAlertas: CatAlerta[]
}
```

Substituir por:

```typescript
export type CatAlerta = {
  id: string
  funcionarioNome: string
  prazoLimite: string
  emAtraso: boolean
}

export type RetornoInssVencido = {
  id: string
  funcionarioId: string
  funcionarioNome: string
  postoNome: string | null
  dataFimPrevista: string
  diasAtraso: number
}

export type AlertasDashboard = {
  postosDeficit: PostoDeficit[]
  postosExcedentes: PostoExcedente[]
  funcSemPosto: number
  feriasLimiteVencendo: number
  catAlertas: CatAlerta[]
  retornosInssVencidos: RetornoInssVencido[]
}
```

- [ ] **Step 2: Adicionar a query em `buscarAlertasDashboard`**

Localizar o `Promise.all` dentro de `buscarAlertasDashboard` (por volta da linha 188-213):

```typescript
  const [
    { count: funcSemPosto },
    { count: feriasLimiteVencendo },
    { data: catData },
    postoStatus,
  ] = await Promise.all([
    supabase
      .from('funcionarios')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'ativo')
      .is('posto_id', null),
    supabase
      .from('ferias')
      .select('*', { count: 'exact', head: true })
      .not('limite_gozo', 'is', null)
      .gte('limite_gozo', todayStr)
      .lte('limite_gozo', plus30str)
      .neq('status', 'concluido')
      .neq('status', 'cancelado')
      .neq('status', 'em_curso'),
    supabase
      .from('atestados')
      .select('id, data_inicio, funcionarios!funcionario_id(nome)')
      .eq('origem_ocupacional', 'acidente_trabalho')
      .gte('data_inicio', thirtyDaysAgoStr)
      .order('data_inicio', { ascending: false }),
    buscarPostoStatus(),
  ])
```

Substituir por (adiciona a 5ª query e captura o resultado):

```typescript
  const [
    { count: funcSemPosto },
    { count: feriasLimiteVencendo },
    { data: catData },
    postoStatus,
    { data: retornosInssData },
  ] = await Promise.all([
    supabase
      .from('funcionarios')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'ativo')
      .is('posto_id', null),
    supabase
      .from('ferias')
      .select('*', { count: 'exact', head: true })
      .not('limite_gozo', 'is', null)
      .gte('limite_gozo', todayStr)
      .lte('limite_gozo', plus30str)
      .neq('status', 'concluido')
      .neq('status', 'cancelado')
      .neq('status', 'em_curso'),
    supabase
      .from('atestados')
      .select('id, data_inicio, funcionarios!funcionario_id(nome)')
      .eq('origem_ocupacional', 'acidente_trabalho')
      .gte('data_inicio', thirtyDaysAgoStr)
      .order('data_inicio', { ascending: false }),
    buscarPostoStatus(),
    supabase
      .from('afastamentos')
      .select('id, funcionario_id, data_fim_prevista, funcionarios!inner(nome, status, postos!posto_id(nome))')
      .is('data_fim_real', null)
      .not('data_fim_prevista', 'is', null)
      .lte('data_fim_prevista', todayStr)
      .eq('funcionarios.status', 'afastado')
      .order('data_fim_prevista', { ascending: true }),
  ])
```

- [ ] **Step 3: Mapear o resultado e incluir no retorno**

Localizar o final de `buscarAlertasDashboard` (por volta da linha 230-241):

```typescript
  const catAlertas: CatAlerta[] = ((catData ?? []) as unknown as CatRow[]).map(c => {
    const inicio = new Date(c.data_inicio + 'T00:00:00')
    const prazo = addBusinessDays(inicio, 1)
    return {
      id: c.id,
      funcionarioNome: c.funcionarios?.nome ?? '—',
      prazoLimite: fmtDDMM(prazo),
      emAtraso: hoje > prazo,
    }
  })

  return {
    postosDeficit,
    postosExcedentes: postoStatus.postosExcedentes,
    funcSemPosto: funcSemPosto ?? 0,
    feriasLimiteVencendo: feriasLimiteVencendo ?? 0,
    catAlertas,
  }
}
```

Substituir por:

```typescript
  const catAlertas: CatAlerta[] = ((catData ?? []) as unknown as CatRow[]).map(c => {
    const inicio = new Date(c.data_inicio + 'T00:00:00')
    const prazo = addBusinessDays(inicio, 1)
    return {
      id: c.id,
      funcionarioNome: c.funcionarios?.nome ?? '—',
      prazoLimite: fmtDDMM(prazo),
      emAtraso: hoje > prazo,
    }
  })

  type RetornoInssRow = {
    id: string
    funcionario_id: string
    data_fim_prevista: string
    funcionarios: { nome: string; status: string; postos: { nome: string } | null } | null
  }
  const retornosInssVencidos: RetornoInssVencido[] = ((retornosInssData ?? []) as unknown as RetornoInssRow[]).map(r => ({
    id: r.id,
    funcionarioId: r.funcionario_id,
    funcionarioNome: r.funcionarios?.nome ?? '—',
    postoNome: r.funcionarios?.postos?.nome ?? null,
    dataFimPrevista: r.data_fim_prevista,
    diasAtraso: diasAtraso(r.data_fim_prevista, todayStr),
  }))

  return {
    postosDeficit,
    postosExcedentes: postoStatus.postosExcedentes,
    funcSemPosto: funcSemPosto ?? 0,
    feriasLimiteVencendo: feriasLimiteVencendo ?? 0,
    catAlertas,
    retornosInssVencidos,
  }
}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: sem erros novos em `app/(admin)/dashboard/actions.ts`

- [ ] **Step 5: Commit**

```bash
git add "app/(admin)/dashboard/actions.ts"
git commit -m "feat(dashboard): alerta de retorno inss vencido para admin

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Query escopada por posto no dashboard do supervisor

**Files:**
- Modify: `app/(admin)/dashboard/actions.ts`

- [ ] **Step 1: Adicionar o campo em `DadosSupervisor`**

Localizar (por volta da linha 673-692):

```typescript
export type DadosSupervisor = {
  postos: SupervisorPostoKpi[]
  kpis: {
    ativos: number
    atestados: number
    afastados: number
    ferias: number
    feriasAgendadas: number
    faltantes: number
    descobertos: number
    coberturas_ativas: number
    ocorrencias: number
    aprovacoes: number
  }
  atestadosAtivos: SupervisorAtestadoAtivo[]
  coberturas: SupervisorCobertura[]
  proximasFerias: SupervisorFerias[]
  atestadosRecentes: SupervisorAtestadoRecente[]
  postosDeficit: { id: string; nome: string; gap: number }[]
}
```

Substituir por (adiciona `retornosInssVencidos`):

```typescript
export type DadosSupervisor = {
  postos: SupervisorPostoKpi[]
  kpis: {
    ativos: number
    atestados: number
    afastados: number
    ferias: number
    feriasAgendadas: number
    faltantes: number
    descobertos: number
    coberturas_ativas: number
    ocorrencias: number
    aprovacoes: number
  }
  atestadosAtivos: SupervisorAtestadoAtivo[]
  coberturas: SupervisorCobertura[]
  proximasFerias: SupervisorFerias[]
  atestadosRecentes: SupervisorAtestadoRecente[]
  postosDeficit: { id: string; nome: string; gap: number }[]
  retornosInssVencidos: RetornoInssVencido[]
}
```

- [ ] **Step 2: Incluir o campo no retorno antecipado (postos vazios)**

Localizar (por volta da linha 719-721):

```typescript
  if (postos.length === 0) {
    return { postos: [], kpis: { ativos: 0, atestados: 0, afastados: 0, ferias: 0, feriasAgendadas: 0, faltantes: 0, descobertos: 0, coberturas_ativas: 0, ocorrencias: 0, aprovacoes: 0 }, atestadosAtivos: [], coberturas: [], proximasFerias: [], atestadosRecentes: [], postosDeficit: [] }
  }
```

Substituir por:

```typescript
  if (postos.length === 0) {
    return { postos: [], kpis: { ativos: 0, atestados: 0, afastados: 0, ferias: 0, feriasAgendadas: 0, faltantes: 0, descobertos: 0, coberturas_ativas: 0, ocorrencias: 0, aprovacoes: 0 }, atestadosAtivos: [], coberturas: [], proximasFerias: [], atestadosRecentes: [], postosDeficit: [], retornosInssVencidos: [] }
  }
```

- [ ] **Step 3: Adicionar a query, reaproveitando `funcIds` já calculado**

Localizar o bloco "3. Atestados ativos com data_fim" (por volta da linha 748-757):

```typescript
  // 3. Atestados ativos com data_fim
  const funcIds = funcs.map(f => f.id)
  const { data: atestadosDb } = funcIds.length > 0
    ? await supabase
        .from('atestados')
        .select('id, funcionario_id, data_fim, funcionarios!funcionario_id(nome, posto_id, postos!posto_id(nome))')
        .in('funcionario_id', funcIds)
        .gte('data_fim', hoje)
        .order('data_fim', { ascending: true })
    : { data: [] }
```

Adicionar logo depois desse bloco (antes do comentário "4. Coberturas ativas nos postos"):

```typescript

  // 3b. Retornos de INSS vencidos (funcionários com afastamento sem data_fim_real cujo
  // data_fim_prevista já passou) — mesmos funcionários escopados pelos postos do supervisor
  const { data: retornosInssData } = funcIds.length > 0
    ? await supabase
        .from('afastamentos')
        .select('id, funcionario_id, data_fim_prevista')
        .in('funcionario_id', funcIds)
        .is('data_fim_real', null)
        .not('data_fim_prevista', 'is', null)
        .lte('data_fim_prevista', hoje)
        .order('data_fim_prevista', { ascending: true })
    : { data: [] }
```

- [ ] **Step 4: Mapear o resultado e incluir no `return` final da função**

Localizar o final de `buscarDadosSupervisor` (por volta da linha 987-1010):

```typescript
  // Postos em déficit (ativos < previsto)
  const postosDeficit = postosKpi
    .filter(p => p.ativos < p.efetivo_previsto)
    .map(p => ({ id: p.id, nome: p.nome, gap: p.efetivo_previsto - p.ativos }))
    .sort((a, b) => b.gap - a.gap)

  return {
    postos: postosKpi,
    kpis: {
      ativos: totalAtivos,
      atestados: totalAtestados,
      afastados: totalAfastados,
      ferias: totalFerias,
      feriasAgendadas,
      faltantes: totalFaltantes,
      descobertos: totalDesc,
      coberturas_ativas: coberturas.length,
      ocorrencias: ocorrencias ?? 0,
      aprovacoes: aprovacoes ?? 0,
    },
    atestadosAtivos,
    coberturas,
    proximasFerias,
    atestadosRecentes,
    postosDeficit,
  }
}
```

Substituir por:

```typescript
  // Postos em déficit (ativos < previsto)
  const postosDeficit = postosKpi
    .filter(p => p.ativos < p.efetivo_previsto)
    .map(p => ({ id: p.id, nome: p.nome, gap: p.efetivo_previsto - p.ativos }))
    .sort((a, b) => b.gap - a.gap)

  const postoNomePorFuncId = new Map(funcs.map(f => [f.id, postos.find(p => p.id === f.posto_id)?.nome ?? null]))
  const nomePorFuncId = new Map(funcs.map(f => [f.id, f.nome]))

  type RetornoInssRow = { id: string; funcionario_id: string; data_fim_prevista: string }
  const retornosInssVencidos: RetornoInssVencido[] = ((retornosInssData ?? []) as unknown as RetornoInssRow[]).map(r => ({
    id: r.id,
    funcionarioId: r.funcionario_id,
    funcionarioNome: nomePorFuncId.get(r.funcionario_id) ?? '—',
    postoNome: postoNomePorFuncId.get(r.funcionario_id) ?? null,
    dataFimPrevista: r.data_fim_prevista,
    diasAtraso: diasAtraso(r.data_fim_prevista, hoje),
  }))

  return {
    postos: postosKpi,
    kpis: {
      ativos: totalAtivos,
      atestados: totalAtestados,
      afastados: totalAfastados,
      ferias: totalFerias,
      feriasAgendadas,
      faltantes: totalFaltantes,
      descobertos: totalDesc,
      coberturas_ativas: coberturas.length,
      ocorrencias: ocorrencias ?? 0,
      aprovacoes: aprovacoes ?? 0,
    },
    atestadosAtivos,
    coberturas,
    proximasFerias,
    atestadosRecentes,
    postosDeficit,
    retornosInssVencidos,
  }
}
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: sem erros novos em `app/(admin)/dashboard/actions.ts`

- [ ] **Step 6: Commit**

```bash
git add "app/(admin)/dashboard/actions.ts"
git commit -m "feat(dashboard): alerta de retorno inss vencido para supervisor

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Renderizar o alerta no dashboard do admin

**Files:**
- Modify: `components/dashboard/alertas-criticos.tsx`

- [ ] **Step 1: Adicionar ícone e desestruturar o novo campo**

Localizar (linha 1-13):

```typescript
import Link from 'next/link'
import { AlertCircle, Clock, Info, CheckCircle2, TrendingUp } from 'lucide-react'
import type { AlertasDashboard } from '@/app/(admin)/dashboard/actions'

interface Props {
  alertas: AlertasDashboard
}

export function AlertasCriticos({ alertas }: Props) {
  const { postosDeficit, postosExcedentes, funcSemPosto, feriasLimiteVencendo, catAlertas } = alertas

  const temAlertas =
    postosDeficit.length > 0 || funcSemPosto > 0 || feriasLimiteVencendo > 0 || catAlertas.length > 0
```

Substituir por:

```typescript
import Link from 'next/link'
import { AlertCircle, Clock, Info, CheckCircle2, TrendingUp, Timer } from 'lucide-react'
import type { AlertasDashboard } from '@/app/(admin)/dashboard/actions'

interface Props {
  alertas: AlertasDashboard
}

export function AlertasCriticos({ alertas }: Props) {
  const { postosDeficit, postosExcedentes, funcSemPosto, feriasLimiteVencendo, catAlertas, retornosInssVencidos } = alertas

  const temAlertas =
    postosDeficit.length > 0 || funcSemPosto > 0 || feriasLimiteVencendo > 0 || catAlertas.length > 0 || retornosInssVencidos.length > 0
```

- [ ] **Step 2: Adicionar o bloco de renderização**

Localizar o bloco `{/* ── CAT ... */}` (por volta da linha 103-120):

```typescript
        {/* ── CAT ──────────────────────────────────────────────────────────── */}
        {catAlertas.map(c => (
          <Link href="/atestados" key={c.id}>
            <div className={`flex items-start gap-3 rounded-lg border-l-[3px] px-3 py-2 transition-opacity hover:opacity-90 ${
              c.emAtraso ? 'border-red-500 bg-red-50' : 'border-orange-500 bg-orange-50'
            }`}>
              <Clock className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${c.emAtraso ? 'text-red-500' : 'text-orange-500'}`} />
              <div className="min-w-0">
                <p className={`text-xs font-semibold ${c.emAtraso ? 'text-red-800' : 'text-orange-800'}`}>
                  CAT {c.emAtraso ? 'em atraso' : 'pendente'}
                </p>
                <p className={`truncate text-[10px] ${c.emAtraso ? 'text-red-700' : 'text-orange-700'}`}>
                  {c.funcionarioNome} — prazo {c.emAtraso ? 'era' : 'até'} {c.prazoLimite}
                </p>
              </div>
            </div>
          </Link>
        ))}
```

Adicionar logo depois desse bloco:

```typescript

        {/* ── Retorno INSS vencido ─────────────────────────────────────────── */}
        {retornosInssVencidos.length > 0 && (
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-red-400">
              Retorno INSS vencido — {retornosInssVencidos.length} funcionário{retornosInssVencidos.length > 1 ? 's' : ''}
            </p>
            <div className="space-y-1.5">
              {retornosInssVencidos.map(r => (
                <Link href={`/efetivo?busca=${encodeURIComponent(r.funcionarioNome)}`} key={r.id}>
                  <div className="flex items-start gap-3 rounded-lg border-l-[3px] border-red-500 bg-red-50 px-3 py-2 transition-opacity hover:opacity-90">
                    <Timer className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-red-800">{r.funcionarioNome}</p>
                      <p className="truncate text-[10px] text-red-600">
                        {r.postoNome && <span className="mr-1 font-medium">{r.postoNome}</span>}
                        venceu há {r.diasAtraso} dia{r.diasAtraso !== 1 ? 's' : ''} ({r.dataFimPrevista.split('-').reverse().join('/')})
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: sem erros novos em `components/dashboard/alertas-criticos.tsx`

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/alertas-criticos.tsx
git commit -m "feat(dashboard): renderiza alerta de retorno inss vencido (admin)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Renderizar o alerta no dashboard do supervisor

**Files:**
- Modify: `app/(admin)/dashboard/page.tsx`

- [ ] **Step 1: Adicionar ícone e desestruturar o novo campo**

Localizar (por volta da linha 67-69):

```typescript
function SupervisorDashboard({ dados, nomeUsuario }: { dados: DadosSupervisor; nomeUsuario: string }) {
  const { kpis, postos, coberturas, proximasFerias, atestadosRecentes, postosDeficit } = dados
  const totalAusentes = kpis.atestados + kpis.afastados + kpis.ferias + kpis.faltantes
```

Substituir por:

```typescript
function SupervisorDashboard({ dados, nomeUsuario }: { dados: DadosSupervisor; nomeUsuario: string }) {
  const { kpis, postos, coberturas, proximasFerias, atestadosRecentes, postosDeficit, retornosInssVencidos } = dados
  const totalAusentes = kpis.atestados + kpis.afastados + kpis.ferias + kpis.faltantes
```

Localizar o import de ícones no topo do arquivo (linha 2):

```typescript
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
```

Substituir por:

```typescript
import { AlertTriangle, CheckCircle2, Timer } from 'lucide-react'
```

- [ ] **Step 2: Ajustar a condição "nenhum alerta crítico" e adicionar o bloco**

Localizar o bloco "Alertas dos meus postos" (por volta da linha 107-135):

```typescript
        {/* Alertas dos meus postos */}
        <div className="flex flex-col rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400">Alertas Críticos</p>
          {postosDeficit.length === 0 && kpis.descobertos === 0 ? (
            <div className="flex items-center gap-2.5 rounded-lg border border-green-100 bg-green-50 px-4 py-3">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
              <p className="text-sm font-medium text-green-700">Nenhum alerta crítico.</p>
            </div>
          ) : (
            <div className="flex-1 space-y-2 overflow-y-auto">
              {kpis.descobertos > 0 && (
                <div className="flex items-start gap-3 rounded-lg border-l-[3px] border-red-500 bg-red-50 px-3 py-2.5">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                  <div>
                    <p className="text-xs font-semibold text-red-800">Posto sem cobertura</p>
                    <p className="text-xs text-red-700">{kpis.descobertos} posto{kpis.descobertos > 1 ? 's' : ''} com ausente sem substituto</p>
                  </div>
                </div>
              )}
              {postosDeficit.slice(0, 5).map(p => (
                <div key={p.id} className="flex items-start gap-3 rounded-lg border-l-[3px] border-red-500 bg-red-50 px-3 py-2.5">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-red-800">Posto em déficit</p>
                    <p className="truncate text-xs text-red-700">{p.nome} — falta{p.gap === 1 ? '' : 'm'} {p.gap} pessoa{p.gap > 1 ? 's' : ''}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
```

Substituir por:

```typescript
        {/* Alertas dos meus postos */}
        <div className="flex flex-col rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400">Alertas Críticos</p>
          {postosDeficit.length === 0 && kpis.descobertos === 0 && retornosInssVencidos.length === 0 ? (
            <div className="flex items-center gap-2.5 rounded-lg border border-green-100 bg-green-50 px-4 py-3">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
              <p className="text-sm font-medium text-green-700">Nenhum alerta crítico.</p>
            </div>
          ) : (
            <div className="flex-1 space-y-2 overflow-y-auto">
              {kpis.descobertos > 0 && (
                <div className="flex items-start gap-3 rounded-lg border-l-[3px] border-red-500 bg-red-50 px-3 py-2.5">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                  <div>
                    <p className="text-xs font-semibold text-red-800">Posto sem cobertura</p>
                    <p className="text-xs text-red-700">{kpis.descobertos} posto{kpis.descobertos > 1 ? 's' : ''} com ausente sem substituto</p>
                  </div>
                </div>
              )}
              {postosDeficit.slice(0, 5).map(p => (
                <div key={p.id} className="flex items-start gap-3 rounded-lg border-l-[3px] border-red-500 bg-red-50 px-3 py-2.5">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-red-800">Posto em déficit</p>
                    <p className="truncate text-xs text-red-700">{p.nome} — falta{p.gap === 1 ? '' : 'm'} {p.gap} pessoa{p.gap > 1 ? 's' : ''}</p>
                  </div>
                </div>
              ))}
              {retornosInssVencidos.map(r => (
                <div key={r.id} className="flex items-start gap-3 rounded-lg border-l-[3px] border-red-500 bg-red-50 px-3 py-2.5">
                  <Timer className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-red-800">Retorno INSS vencido</p>
                    <p className="truncate text-xs text-red-700">
                      {r.funcionarioNome} — venceu há {r.diasAtraso} dia{r.diasAtraso !== 1 ? 's' : ''} ({r.dataFimPrevista.split('-').reverse().join('/')})
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: sem erros novos em `app/(admin)/dashboard/page.tsx`

- [ ] **Step 4: Build completo (inclui lint)**

Run: `npm run build`
Expected: `✓ Compiled successfully`, sem erros de lint, rota `/dashboard` presente

- [ ] **Step 5: Commit**

```bash
git add "app/(admin)/dashboard/page.tsx"
git commit -m "feat(dashboard): renderiza alerta de retorno inss vencido (supervisor)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Verificação manual (checkpoint, sem commit)

**Files:** nenhum

- [ ] **Step 1:** Rodar `npm run dev`, logar como admin, ir em `/dashboard`.
- [ ] **Step 2:** Se existir algum funcionário com afastamento INSS vencido nos dados de teste (ex: usar a Elica se ela tiver uma solicitação de INSS aprovada com retorno já no passado), confirmar que o bloco "Retorno INSS vencido" aparece no card "Situação dos Postos", com link pra `/efetivo?busca=<nome>`.
- [ ] **Step 3:** Logar como supervisor de um posto com esse mesmo funcionário, confirmar que o alerta aparece no card "Alertas Críticos" do dashboard dele.
- [ ] **Step 4:** Logar como supervisor de um posto SEM esse funcionário, confirmar que o alerta NÃO aparece (escopo por posto funcionando).
- [ ] **Step 5:** Reportar o resultado ao usuário — sem commit nesta task.
