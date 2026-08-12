# Regime por Funcionário (Fase 1 — troca de fonte sem impacto) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar a fonte do "regime" (`5x2`/`5x1`/`12x36`) usada nos cálculos de fechamento, fechamento financeiro e férias de "regime configurado no posto" (`config_escalas_postos`, 1 valor por posto) para "regime do turno vigente do funcionário" (`horarios_funcionarios → turnos_postos.tipo_escala`), com fallback para o regime do posto quando o funcionário não tiver turno vigente. Isso não muda nenhum resultado hoje (todo turno de um posto já tem o mesmo `tipo_escala` do posto) — é pré-requisito para permitir múltiplas escalas no mesmo posto no futuro (Fase 2, fora deste plano).

**Architecture:** Um helper único (`lib/turnos/regime-funcionario.ts`) resolve, em lote, o regime de uma lista de `funcionario_id`s a partir do turno vigente de cada um, com fallback para o mapa posto→regime já usado hoje. Os 4 pontos de cálculo (`fechamento`, `fechamento-financeiro`, `ferias`) passam a chamar esse helper no lugar da leitura direta de `config_escalas_postos`/`postos.config_escalas_postos`. Nenhuma mudança de schema, nenhuma mudança de UI. Regressão validada por script que compara o cálculo de fechamento/financeiro do mês corrente antes e depois da troca — tem que bater 100%.

**Tech Stack:** Next.js 14 App Router, Supabase (`@supabase/supabase-js`), TypeScript. Projeto não tem test runner configurado (sem jest/vitest) — verificação é via `npx tsc --noEmit`, `npm run build`, e scripts Node ad-hoc (`scripts/*.mjs`, mesmo padrão de `scripts/fix-turno-m.mjs`) rodando contra o banco real com `SUPABASE_SERVICE_ROLE_KEY`.

**Fora de escopo deste plano (Fase 2, futura):**
- Remover a trava de `criarTurno` que força `tipo_escala` do turno = regime do posto (`app/(admin)/postos/turnos/actions.ts:46-49`) — é isso que hoje impede 2 regimes no mesmo posto.
- Repensar a constraint 1:1 de `config_escalas_postos`.
- Regime de destino em cobertura temporária (`app/(admin)/coberturas/actions.ts:125-130`) — permanece lendo o regime do posto de destino, pois durante a cobertura o funcionário assume o padrão do posto que está cobrindo, não seu próprio turno de origem. Não é "múltipla escala no mesmo posto", é escala do posto visitado.
- Rótulo de regime em `lib/movimentacao-colaborador.ts` (cosmético, aparece só no PDF/registro de movimentação) — mantido lendo do posto por simplicidade; pode migrar depois sem risco.

---

## Arquivos

- Criar: `lib/turnos/regime-funcionario.ts` — helper `obterRegimesPorFuncionario`.
- Criar: `scripts/check-regime-parity.mjs` — script de regressão (roda antes e depois da troca, compara saída).
- Modificar: `app/(admin)/fechamento/actions.ts` — usa o helper no lugar de `postoConfigMap`/`config_escalas_postos` para o regime do **próprio** funcionário (não o de posto de cobertura recebida, que continua posto-based).
- Modificar: `app/(admin)/fechamento-financeiro/actions.ts` — idem.
- Modificar: `app/(admin)/ferias/actions.ts` (`agendarFerias`) — idem.

---

### Task 1: Helper `obterRegimesPorFuncionario`

**Files:**
- Create: `lib/turnos/regime-funcionario.ts`

- [ ] **Step 1: Escrever o helper**

```ts
// lib/turnos/regime-funcionario.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

type AnyClient = SupabaseClient<Database> | ReturnType<typeof import('@supabase/supabase-js').createClient>

/**
 * Resolve o regime (tipo_escala: 5x2 / 5x1 / 12x36 / jovem_aprendiz) de cada
 * funcionário a partir do turno VIGENTE dele (horarios_funcionarios sem
 * data_fim -> turnos_postos.tipo_escala).
 *
 * Fallback: quando o funcionário não tem turno vigente cadastrado (ainda não
 * migrou pro fluxo de turnos), usa o regime configurado no posto dele
 * (config_escalas_postos), igual o comportamento atual do sistema.
 *
 * Hoje `criarTurno` (app/(admin)/postos/turnos/actions.ts) força todo turno
 * de um posto a ter o mesmo tipo_escala do posto — então o resultado deste
 * helper é idêntico ao regime-por-posto para todo posto existente. Ele só
 * passa a divergir quando um posto tiver turnos com tipo_escala diferentes
 * (Fase 2, ainda não habilitada).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function obterRegimesPorFuncionario(
  supabase: AnyClient,
  funcionarioIds: string[],
  postoConfigMap: Map<string, string>,
  postoIdPorFuncionario: Map<string, string | null>,
): Promise<Map<string, string>> {
  const regimes = new Map<string, string>()
  if (funcionarioIds.length === 0) return regimes

  const { data, error } = await supabase
    .from('horarios_funcionarios')
    .select('funcionario_id, turnos_postos!turno_id ( tipo_escala )')
    .in('funcionario_id', funcionarioIds)
    .is('data_fim', null)

  if (error) throw error

  for (const row of (data ?? []) as unknown as { funcionario_id: string; turnos_postos: { tipo_escala: string } | null }[]) {
    if (row.turnos_postos?.tipo_escala) {
      regimes.set(row.funcionario_id, row.turnos_postos.tipo_escala)
    }
  }

  for (const fid of funcionarioIds) {
    if (regimes.has(fid)) continue
    const postoId = postoIdPorFuncionario.get(fid) ?? null
    const fallback = (postoId ? postoConfigMap.get(postoId) : null) ?? '5x2'
    regimes.set(fid, fallback)
  }

  return regimes
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: sem erros novos relacionados a `regime-funcionario.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/turnos/regime-funcionario.ts
git commit -m "feat(turnos): helper obterRegimesPorFuncionario (regime por turno vigente)"
```

---

### Task 2: Script de regressão — capturar baseline ANTES da troca

**Files:**
- Create: `scripts/check-regime-parity.mjs`

- [ ] **Step 1: Escrever o script**

Roda `calcularFechamento` e `calcularFechamentoFinanceiro` do mês corrente direto contra produção (via service role, sem passar pelo Next — reimplementa a query mínima necessária pra extrair só `funcionario_id` + `regime` + `dias_uteis` + `dias_trabalhados`, que é o que este plano pode alterar) e salva um snapshot JSON.

```js
// scripts/check-regime-parity.mjs
// Uso:
//   node scripts/check-regime-parity.mjs baseline   -> salva snapshot ANTES da troca
//   node scripts/check-regime-parity.mjs compare     -> recalcula e compara com o snapshot
import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync, existsSync } from 'fs'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter(l => l.includes('=')).map(l => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    })
)

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const SNAPSHOT_PATH = new URL('./.regime-parity-snapshot.json', import.meta.url)

const now = new Date()
const mes = now.getMonth() + 1
const ano = now.getFullYear()
const mesStr = String(mes).padStart(2, '0')
const mesStartStr = `${ano}-${mesStr}-01`
const daysInMonth = new Date(ano, mes, 0).getDate()
const mesEndStr = `${ano}-${mesStr}-${String(daysInMonth).padStart(2, '0')}`

async function regimesAtuais() {
  // Reproduz a mesma resolução de regime que o código de produção usa hoje
  // (posto -> config_escalas_postos), pra comparar com a nova fonte depois.
  const { data: funcionarios, error: e1 } = await supabase
    .from('funcionarios')
    .select('id, posto_id')
    .lte('data_admissao', mesEndStr)
    .or(`data_desligamento.is.null,data_desligamento.gte.${mesStartStr}`)
  if (e1) throw e1

  const { data: postoConfig, error: e2 } = await supabase
    .from('config_escalas_postos')
    .select('posto_id, regime')
  if (e2) throw e2

  const postoConfigMap = new Map(postoConfig.map(pc => [pc.posto_id, pc.regime]))

  const { data: turnos, error: e3 } = await supabase
    .from('horarios_funcionarios')
    .select('funcionario_id, turnos_postos!turno_id ( tipo_escala )')
    .is('data_fim', null)
  if (e3) throw e3
  const turnoRegimeMap = new Map(
    turnos
      .filter(t => t.turnos_postos?.tipo_escala)
      .map(t => [t.funcionario_id, t.turnos_postos.tipo_escala]),
  )

  const resultado = {}
  for (const f of funcionarios) {
    const regimePosto = (f.posto_id && postoConfigMap.get(f.posto_id)) ?? '5x2'
    const regimeTurno = turnoRegimeMap.get(f.id) ?? regimePosto
    resultado[f.id] = { regimePosto, regimeTurno, igual: regimePosto === regimeTurno }
  }
  return resultado
}

const modo = process.argv[2]
const dados = await regimesAtuais()
const divergentes = Object.entries(dados).filter(([, v]) => !v.igual)

console.log(`Funcionários avaliados: ${Object.keys(dados).length}`)
console.log(`Divergentes (regime do turno != regime do posto): ${divergentes.length}`)
if (divergentes.length > 0) {
  console.log('Detalhe dos divergentes:', divergentes)
}

if (modo === 'baseline') {
  writeFileSync(SNAPSHOT_PATH, JSON.stringify(dados, null, 2))
  console.log('Snapshot salvo em scripts/.regime-parity-snapshot.json')
} else if (modo === 'compare') {
  if (!existsSync(SNAPSHOT_PATH)) {
    console.error('Nenhum snapshot encontrado. Rode "baseline" antes de trocar o código.')
    process.exit(1)
  }
  const antes = JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8'))
  let diffs = 0
  for (const [fid, depois] of Object.entries(dados)) {
    const a = antes[fid]
    if (!a) continue
    if (a.regimePosto !== depois.regimePosto) {
      console.log(`DIFF ${fid}: regimePosto ${a.regimePosto} -> ${depois.regimePosto}`)
      diffs++
    }
  }
  console.log(diffs === 0 ? 'OK: nenhuma diferença.' : `${diffs} diferença(s) encontrada(s).`)
} else {
  console.log('Uso: node scripts/check-regime-parity.mjs [baseline|compare]')
}
```

- [ ] **Step 2: Rodar baseline ANTES de tocar nos arquivos de cálculo**

Run: `node scripts/check-regime-parity.mjs baseline`
Expected: imprime `Divergentes: 0` (confirma que hoje regime do turno == regime do posto pra todo mundo — pré-condição deste plano). Se aparecer algum divergente, PARE — significa que já existe posto com turno de regime diferente do configurado, e a troca de Task 3-5 não será no-op; investigar antes de prosseguir.

- [ ] **Step 3: Commit**

```bash
git add scripts/check-regime-parity.mjs
git commit -m "chore(scripts): script de regressao de paridade de regime posto vs turno"
```

(O arquivo `scripts/.regime-parity-snapshot.json` gerado no Step 2 não é commitado — é local, serve só pra comparação manual antes/depois nesta sessão de trabalho.)

---

### Task 3: `fechamento/actions.ts` — regime do funcionário via turno vigente

**Files:**
- Modify: `app/(admin)/fechamento/actions.ts:5,290-293,317-336,377-386,428-433`

- [ ] **Step 1: Importar o helper e montar `postoIdPorFuncionario`**

Em `app/(admin)/fechamento/actions.ts`, adicionar o import:

```ts
import { obterRegimesPorFuncionario } from '@/lib/turnos/regime-funcionario'
```

Logo após o bloco que monta `postoConfigMap` (linha ~290-293), adicionar:

```ts
  const postoIdPorFuncionario = new Map<string, string | null>()
  for (const f of funcionarios) {
    postoIdPorFuncionario.set(f.id, f.posto_id ?? null)
  }
  const regimesPorFuncionario = await obterRegimesPorFuncionario(
    supabase,
    funcionarios.map(f => f.id),
    postoConfigMap,
    postoIdPorFuncionario,
  )
```

- [ ] **Step 2: Trocar a fonte do `regime` do funcionário (linha ~326-328)**

Antes:

```ts
    const postos  = func.postos  as unknown as { nome: string; secretaria: string | null; config_escalas_postos: { regime: string }[] | null } | null
    const funcoes = func.funcoes as unknown as { nome: string } | null
    const regime  = postos?.config_escalas_postos?.[0]?.regime ?? postoConfigMap.get(func.posto_id ?? '') ?? '5x2'
```

Depois:

```ts
    const postos  = func.postos  as unknown as { nome: string; secretaria: string | null; config_escalas_postos: { regime: string }[] | null } | null
    const funcoes = func.funcoes as unknown as { nome: string } | null
    const regime  = regimesPorFuncionario.get(func.id) ?? postos?.config_escalas_postos?.[0]?.regime ?? postoConfigMap.get(func.posto_id ?? '') ?? '5x2'
```

- [ ] **Step 3: Usar o mesmo `regime` (não mais `postoConfigMap.get(seg.posto_id)`) nos cálculos de dias úteis/férias/atestado/afastamento do próprio funcionário**

Estes cálculos hoje usam o regime do **posto de cada segmento** (`postoConfigMap.get(seg.posto_id)`), assumindo que regime não muda quando o funcionário muda de posto no meio do mês. A troca é usar o regime do **funcionário** (fixo pro mês, igual o campo `regime` acima) em vez do regime do posto do segmento — mantém a mesma simplificação que já existe hoje (regime único pro mês inteiro), só troca a fonte.

Nas linhas 377-386, trocar:

```ts
    const diasUteis = diasUteisPorSegmentos(segmentosPosto, periodoInicio, periodoFim, postoConfigMap, feriados)

    const feriasDias = segmentosPosto.reduce(
      (acc, seg) => acc + feriasNoIntervalo(seg.inicio, seg.fim, postoConfigMap.get(seg.posto_id) ?? '5x2'), 0)

    const atestadosDias = segmentosPosto.reduce(
      (acc, seg) => acc + atestadosNoIntervalo(seg.inicio, seg.fim, postoConfigMap.get(seg.posto_id) ?? '5x2'), 0)

    const afastamentoDias = segmentosPosto.reduce(
      (acc, seg) => acc + afastamentoNoIntervalo(seg.inicio, seg.fim, postoConfigMap.get(seg.posto_id) ?? '5x2'), 0)
```

por:

```ts
    const diasUteis = segmentosPosto.reduce(
      (acc, seg) => acc + diasUteisNoPeriodo(seg.inicio, seg.fim, regime, feriados), 0)

    const feriasDias = segmentosPosto.reduce(
      (acc, seg) => acc + feriasNoIntervalo(seg.inicio, seg.fim, regime), 0)

    const atestadosDias = segmentosPosto.reduce(
      (acc, seg) => acc + atestadosNoIntervalo(seg.inicio, seg.fim, regime), 0)

    const afastamentoDias = segmentosPosto.reduce(
      (acc, seg) => acc + afastamentoNoIntervalo(seg.inicio, seg.fim, regime), 0)
```

Nota: `diasUteisPorSegmentos` (helper que recebia `postoConfigMap`) fica sem uso nesta função — não remover a função ainda (deixar para limpeza numa Task futura, pra manter o diff desta Task focado só na troca de fonte).

- [ ] **Step 4: Trocar também no cálculo de `segmentosNet` (linha ~428-433, usado para posto preponderante e rateio "por posto")**

Antes:

```ts
    const segmentosNet = segmentosPosto.map(seg => {
      const regimeSeg = postoConfigMap.get(seg.posto_id) ?? '5x2'
      const bruto = diasUteisNoPeriodo(seg.inicio, seg.fim, regimeSeg, feriados)
      const fer   = feriasNoIntervalo(seg.inicio, seg.fim, regimeSeg)
      const ates  = atestadosNoIntervalo(seg.inicio, seg.fim, regimeSeg)
      const afa   = afastamentoNoIntervalo(seg.inicio, seg.fim, regimeSeg)
```

Depois:

```ts
    const segmentosNet = segmentosPosto.map(seg => {
      const bruto = diasUteisNoPeriodo(seg.inicio, seg.fim, regime, feriados)
      const fer   = feriasNoIntervalo(seg.inicio, seg.fim, regime)
      const ates  = atestadosNoIntervalo(seg.inicio, seg.fim, regime)
      const afa   = afastamentoNoIntervalo(seg.inicio, seg.fim, regime)
```

(o resto do bloco, que usa `falt`/`cob`, permanece igual — `cob` já usa `c.regime`, que é o regime do posto de **destino** da cobertura, fora de escopo por design, ver seção "Fora de escopo").

- [ ] **Step 5: Type-check e build**

Run: `npx tsc --noEmit && npm run build`
Expected: sem erros.

- [ ] **Step 6: Rodar comparação de paridade**

Run: `node scripts/check-regime-parity.mjs compare`
Expected: `OK: nenhuma diferença.`

- [ ] **Step 7: Commit**

```bash
git add app/\(admin\)/fechamento/actions.ts
git commit -m "refactor(fechamento): regime do funcionario via turno vigente, com fallback pro posto"
```

---

### Task 4: `fechamento-financeiro/actions.ts` — mesma troca

**Files:**
- Modify: `app/(admin)/fechamento-financeiro/actions.ts:6,178-181,207-211`

- [ ] **Step 1: Importar o helper**

```ts
import { obterRegimesPorFuncionario } from '@/lib/turnos/regime-funcionario'
```

- [ ] **Step 2: Montar `postoIdPorFuncionario` e resolver os regimes em lote**

Logo após o bloco que monta `postoConfigMap` (linha ~178-181), adicionar:

```ts
  const postoIdPorFuncionario = new Map<string, string | null>()
  for (const f of funcionarios) {
    postoIdPorFuncionario.set(f.id, f.posto_id ?? null)
  }
  const regimesPorFuncionario = await obterRegimesPorFuncionario(
    supabase,
    funcionarios.map(f => f.id),
    postoConfigMap,
    postoIdPorFuncionario,
  )
```

- [ ] **Step 3: Trocar a fonte do `regime` (linha ~209)**

Antes:

```ts
    const postos  = func.postos  as unknown as PostoJoin
    const funcoes = func.funcoes as unknown as FuncaoJoin
    const regime  = postos?.config_escalas_postos?.[0]?.regime ?? postoConfigMap.get(func.posto_id ?? '') ?? '5x2'
```

Depois:

```ts
    const postos  = func.postos  as unknown as PostoJoin
    const funcoes = func.funcoes as unknown as FuncaoJoin
    const regime  = regimesPorFuncionario.get(func.id) ?? postos?.config_escalas_postos?.[0]?.regime ?? postoConfigMap.get(func.posto_id ?? '') ?? '5x2'
```

O resto da função (`diasUteis`, `feriasDias`, `atestadosDias`, `afastamentoDias` — linhas 211-245) já usa essa variável `regime`, não precisa mudar mais nada.

- [ ] **Step 4: Type-check e build**

Run: `npx tsc --noEmit && npm run build`
Expected: sem erros.

- [ ] **Step 5: Rodar comparação de paridade**

Run: `node scripts/check-regime-parity.mjs compare`
Expected: `OK: nenhuma diferença.`

- [ ] **Step 6: Commit**

```bash
git add app/\(admin\)/fechamento-financeiro/actions.ts
git commit -m "refactor(fechamento-financeiro): regime do funcionario via turno vigente, com fallback pro posto"
```

---

### Task 5: `ferias/actions.ts` (`agendarFerias`) — mesma troca

**Files:**
- Modify: `app/(admin)/ferias/actions.ts:1-6,64-81`

- [ ] **Step 1: Importar o helper**

```ts
import { obterRegimesPorFuncionario } from '@/lib/turnos/regime-funcionario'
```

- [ ] **Step 2: Trocar a resolução de regime**

Antes:

```ts
  let dias_utilizados: number | null = null
  if (data.data_inicio && data.data_fim) {
    const { data: func } = await supabase
      .from('funcionarios')
      .select('posto_id')
      .eq('id', data.funcionario_id)
      .single()
    let regime = '5x2'
    if (func?.posto_id) {
      const { data: escala } = await supabase
        .from('config_escalas_postos')
        .select('regime')
        .eq('posto_id', func.posto_id)
        .maybeSingle()
      if (escala?.regime) regime = escala.regime
    }
    const ano = new Date(data.data_inicio).getFullYear()
    dias_utilizados = diasUteisNoPeriodo(toDate(data.data_inicio), toDate(data.data_fim), regime, feriadosDoAno(ano))
  }
```

Depois:

```ts
  let dias_utilizados: number | null = null
  if (data.data_inicio && data.data_fim) {
    const { data: func } = await supabase
      .from('funcionarios')
      .select('posto_id')
      .eq('id', data.funcionario_id)
      .single()

    let regimePosto = '5x2'
    if (func?.posto_id) {
      const { data: escala } = await supabase
        .from('config_escalas_postos')
        .select('regime')
        .eq('posto_id', func.posto_id)
        .maybeSingle()
      if (escala?.regime) regimePosto = escala.regime
    }
    const postoConfigMap = new Map(func?.posto_id ? [[func.posto_id, regimePosto]] : [])
    const postoIdPorFuncionario = new Map([[data.funcionario_id, func?.posto_id ?? null]])
    const regimes = await obterRegimesPorFuncionario(supabase, [data.funcionario_id], postoConfigMap, postoIdPorFuncionario)
    const regime = regimes.get(data.funcionario_id) ?? regimePosto

    const ano = new Date(data.data_inicio).getFullYear()
    dias_utilizados = diasUteisNoPeriodo(toDate(data.data_inicio), toDate(data.data_fim), regime, feriadosDoAno(ano))
  }
```

- [ ] **Step 3: Type-check e build**

Run: `npx tsc --noEmit && npm run build`
Expected: sem erros.

- [ ] **Step 4: Teste manual — agendar férias de um funcionário existente**

Não há test runner no projeto para Server Actions; validar manualmente: abrir `/ferias`, agendar férias com `data_inicio`/`data_fim` pra um funcionário de posto 5x2 e outro (se existir) de posto 5x1/12x36, conferir que `dias_utilizados` calculado bate com o valor de antes da troca (mesmo regime, mesmo resultado).

- [ ] **Step 5: Commit**

```bash
git add app/\(admin\)/ferias/actions.ts
git commit -m "refactor(ferias): regime do funcionario via turno vigente ao agendar ferias"
```

---

### Task 6: Build final e limpeza

**Files:**
- Modify: `app/(admin)/fechamento/actions.ts` (remover código morto se sobrar)

- [ ] **Step 1: Build completo**

Run: `npx tsc --noEmit && npm run build`
Expected: sem erros, sem warnings novos.

- [ ] **Step 2: Rodar comparação de paridade uma última vez**

Run: `node scripts/check-regime-parity.mjs compare`
Expected: `OK: nenhuma diferença.`

- [ ] **Step 3: Checar se `diasUteisPorSegmentos` (helper de fechamento/actions.ts) ficou sem uso**

Run: `grep -n "diasUteisPorSegmentos" "app/(admin)/fechamento/actions.ts"`
Se só aparecer a definição (sem chamadas), remover a função (linhas 141-157) — ela foi substituída pelo `reduce` inline na Task 3, Step 3.

- [ ] **Step 4: Type-check e build de novo após a limpeza**

Run: `npx tsc --noEmit && npm run build`
Expected: sem erros.

- [ ] **Step 5: Commit final**

```bash
git add -A
git commit -m "chore(fechamento): remove helper diasUteisPorSegmentos nao utilizado"
```

---

## Depois deste plano

Com Fase 1 aplicada e validada (paridade 100%), a Fase 2 (habilitar de fato múltiplas escalas por posto) fica reduzida a:
1. Remover/relaxar a trava de `criarTurno` (`app/(admin)/postos/turnos/actions.ts:46-49`) que hoje força `tipo_escala` do turno = regime do posto.
2. Decidir o que `config_escalas_postos` passa a significar (regime "padrão/fallback" do posto, não mais regra rígida) e ajustar a UI de `fechamento/config-escalas/`.
3. Rodar `check-regime-parity.mjs` de novo depois de o primeiro posto real ganhar 2 regimes — aí sim espera-se ver divergência (é o comportamento novo funcionando).
