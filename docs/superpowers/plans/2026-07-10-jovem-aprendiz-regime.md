# Regime de Trabalho do Jovem Aprendiz — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Funcionários com função `JOVEM APRENDIZ` passam a ter um regime de trabalho próprio (4h/dia, turno fixo manhã ou tarde, dia de curso individual) através de dois turnos "globais" (sem posto fixo), resolvendo o caso de um posto ter pessoas em regimes diferentes ao mesmo tempo.

**Architecture:** `turnos_postos.posto_id` passa a aceitar `NULL` para identificar turnos globais (reutilizáveis por qualquer posto). Dois turnos globais fixos (`tipo_escala='jovem_aprendiz'`) são semeados uma única vez via migração — sem tela de gerenciamento, já que são constantes. `horarios_funcionarios` ganha um campo `dia_curso` (dia da semana individual). A tela "Alterar Turno" do perfil do funcionário passa a saber a função da pessoa: se for jovem aprendiz, mostra só os dois turnos globais + um seletor de dia de curso, em vez dos turnos do posto.

**Tech Stack:** Next.js 14 App Router, Supabase (Postgres + RLS), TypeScript, Tailwind. Sem framework de testes — verificação via `npx tsc --noEmit`, `npm run build`, e teste manual.

## Global Constraints

- `createClient()` do Supabase é **síncrono** — nunca `await createClient()`.
- Rodar `npm run build` e corrigir todos os erros antes de finalizar.
- Turnos globais são fixos: **Jovem Aprendiz Manhã** (07:00–11:00) e **Jovem Aprendiz Tarde** (13:00–17:00), sem almoço, sem distinção de sexta. Sem UI de gerenciamento — semeados via migração.
- `dia_curso`: 1=segunda … 5=sexta (mesma convenção de índice usada em `DIAS_SEMANA` — `['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']`, onde índice 1='Seg' … 5='Sex').
- `'jovem_aprendiz'` é um valor de `tipo_escala` válido para turnos, mas **nunca** um regime de posto válido — o seletor de regime do posto (`config_escalas_postos`) continua limitado a 5x2/5x1/12x36.
- Cor do badge jovem aprendiz: **teal** (`bg-teal-50 text-teal-700 ring-teal-200`, borda `border-teal-500`) — distinta de 5x2 (azul), 5x1 (roxo), 12x36 (laranja).
- Fechamento, férias e cálculo de dias úteis **não mudam** — continuam lendo `config_escalas_postos.regime` do posto normalmente; jovem aprendiz também só trabalha seg-sex, o cálculo já é compatível.
- Spec de referência: `docs/superpowers/specs/2026-07-10-jovem-aprendiz-regime-design.md`.

---

### Task 1: Migração de banco — turnos globais e dia de curso

**Files:**
- Create: `supabase/migrations/20260711_jovem_aprendiz_regime.sql`

**Interfaces:**
- Produces: `turnos_postos.posto_id` nullable; `horarios_funcionarios.dia_curso SMALLINT` (nullable, 1-5); dois turnos globais semeados com `tipo_escala='jovem_aprendiz'`.

- [ ] **Step 1: Escrever a migração**

```sql
-- supabase/migrations/20260711_jovem_aprendiz_regime.sql
ALTER TABLE turnos_postos ALTER COLUMN posto_id DROP NOT NULL;

ALTER TABLE horarios_funcionarios ADD COLUMN IF NOT EXISTS dia_curso SMALLINT;
ALTER TABLE horarios_funcionarios ADD CONSTRAINT dia_curso_range CHECK (dia_curso IS NULL OR dia_curso BETWEEN 1 AND 5);

INSERT INTO turnos_postos (posto_id, nome, tipo_escala, hora_entrada, hora_saida_seg_qui, hora_saida_sex, hora_inicio_almoco, hora_fim_almoco, ativo)
SELECT NULL, 'Jovem Aprendiz Manhã', 'jovem_aprendiz', '07:00', '11:00', NULL, NULL, NULL, true
WHERE NOT EXISTS (SELECT 1 FROM turnos_postos WHERE posto_id IS NULL AND nome = 'Jovem Aprendiz Manhã');

INSERT INTO turnos_postos (posto_id, nome, tipo_escala, hora_entrada, hora_saida_seg_qui, hora_saida_sex, hora_inicio_almoco, hora_fim_almoco, ativo)
SELECT NULL, 'Jovem Aprendiz Tarde', 'jovem_aprendiz', '13:00', '17:00', NULL, NULL, NULL, true
WHERE NOT EXISTS (SELECT 1 FROM turnos_postos WHERE posto_id IS NULL AND nome = 'Jovem Aprendiz Tarde');
```

- [ ] **Step 2: Aplicar a migração no projeto Supabase**

Use `mcp__supabase__apply_migration` com `name: "jovem_aprendiz_regime"` e o SQL acima (schema `public`).

- [ ] **Step 3: Verificar o schema e o seed**

Rode `mcp__supabase__list_tables` (verbose) e confirme que `turnos_postos.posto_id` é nullable e `horarios_funcionarios.dia_curso` existe (smallint, nullable). Rode `mcp__supabase__execute_sql` com:
```sql
select id, nome, tipo_escala, hora_entrada, hora_saida_seg_qui from turnos_postos where posto_id is null;
```
Confirme que retorna exatamente 2 linhas: "Jovem Aprendiz Manhã" (07:00→11:00) e "Jovem Aprendiz Tarde" (13:00→17:00).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260711_jovem_aprendiz_regime.sql
git commit -m "feat(turnos): turnos globais e dia de curso para regime de jovem aprendiz"
```

---

### Task 2: Atualizar `types/database.ts`

**Files:**
- Modify: `types/database.ts:1349-1399` (bloco `horarios_funcionarios`)
- Modify: `types/database.ts:1968-2017` (bloco `turnos_postos`)

**Interfaces:**
- Consumes: schema aplicado na Task 1.
- Produces: `Tables<'turnos_postos'>.posto_id: string | null`; `Tables<'horarios_funcionarios'>.dia_curso: number | null`.

- [ ] **Step 1: Editar `horarios_funcionarios`**

Em `types/database.ts:1349-1399`, dentro do bloco `horarios_funcionarios`, adicionar `dia_curso` aos três sub-objetos `Row`/`Insert`/`Update`. O bloco `Row` (linhas 1350-1358) passa a:

```ts
        Row: {
          created_at: string | null
          criado_por: string | null
          data_fim: string | null
          data_inicio: string
          dia_curso: number | null
          funcionario_id: string
          id: string
          turno_id: string
        }
```

O bloco `Insert` (linhas 1359-1367) passa a:

```ts
        Insert: {
          created_at?: string | null
          criado_por?: string | null
          data_fim?: string | null
          data_inicio: string
          dia_curso?: number | null
          funcionario_id: string
          id?: string
          turno_id: string
        }
```

O bloco `Update` (linhas 1368-1376) passa a:

```ts
        Update: {
          created_at?: string | null
          criado_por?: string | null
          data_fim?: string | null
          data_inicio?: string
          dia_curso?: number | null
          funcionario_id?: string
          id?: string
          turno_id?: string
        }
```

- [ ] **Step 2: Editar `turnos_postos`**

Em `types/database.ts:1968-2017`, trocar `posto_id: string` por `posto_id: string | null` no `Row` (linha 1979) e `posto_id: string` por `posto_id?: string | null` no `Insert` (linha 1992) — no `Update` (linha 2005) já é opcional (`posto_id?: string`), só precisa aceitar `null`: `posto_id?: string | null`.

O bloco completo `turnos_postos` (linhas 1968-2017) passa a:

```ts
      turnos_postos: {
        Row: {
          ativo: boolean
          created_at: string | null
          hora_entrada: string
          hora_fim_almoco: string | null
          hora_inicio_almoco: string | null
          hora_saida_seg_qui: string
          hora_saida_sex: string | null
          id: string
          nome: string
          posto_id: string | null
          tipo_escala: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string | null
          hora_entrada: string
          hora_fim_almoco?: string | null
          hora_inicio_almoco?: string | null
          hora_saida_seg_qui: string
          hora_saida_sex?: string | null
          id?: string
          nome: string
          posto_id?: string | null
          tipo_escala?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string | null
          hora_entrada?: string
          hora_fim_almoco?: string | null
          hora_inicio_almoco?: string | null
          hora_saida_seg_qui?: string
          hora_saida_sex?: string | null
          id?: string
          nome?: string
          posto_id?: string | null
          tipo_escala?: string
        }
        Relationships: [
          {
            foreignKeyName: "turnos_postos_posto_id_fkey"
            columns: ["posto_id"]
            isOneToOne: false
            referencedRelation: "postos"
            referencedColumns: ["id"]
          },
        ]
      }
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: novos erros em `app/(admin)/postos/turnos/actions.ts`, `components/postos/modal-turnos-posto.tsx`, `app/(admin)/efetivo/[id]/page.tsx` (esperado — corrigidos nas próximas tasks). Nenhum erro dentro do próprio `types/database.ts`.

- [ ] **Step 4: Commit**

```bash
git add types/database.ts
git commit -m "chore(types): posto_id opcional em turnos_postos e dia_curso em horarios_funcionarios"
```

---

### Task 3: `lib/turnos/escala.ts` — quarto tipo de escala e distinção posto/turno

**Files:**
- Modify: `lib/turnos/escala.ts` (arquivo inteiro)

**Interfaces:**
- Produces (novo/alterado): `TIPOS_ESCALA` (agora 4 valores), `TIPOS_ESCALA_POSTO` (3 valores, só os regimes atribuíveis a um posto), `TipoEscalaPosto`, `isTipoEscalaPosto()`, `resolverTipoEscalaPosto()`, `FUNCAO_JOVEM_APRENDIZ`, `TurnoHorarios` (novo campo `tipo_escala`), `formatarResumoTurno` (assinatura inalterada, comportamento novo para jovem_aprendiz).
- Consumido por: Tasks 4, 5, 9.

- [ ] **Step 1: Substituir o conteúdo do arquivo**

```ts
// lib/turnos/escala.ts

/** Regimes atribuíveis a um posto (config_escalas_postos / seletor de regime do posto). */
export const TIPOS_ESCALA_POSTO = ['5x2', '5x1', '12x36'] as const
export type TipoEscalaPosto = (typeof TIPOS_ESCALA_POSTO)[number]

export function isTipoEscalaPosto(value: string | null | undefined): value is TipoEscalaPosto {
  return !!value && (TIPOS_ESCALA_POSTO as readonly string[]).includes(value)
}

/** Todos os tipos de escala possíveis para um turno — inclui 'jovem_aprendiz', que nunca é um regime de posto. */
export const TIPOS_ESCALA = [...TIPOS_ESCALA_POSTO, 'jovem_aprendiz'] as const
export type TipoEscala = (typeof TIPOS_ESCALA)[number]

/** Função cuja escala de trabalho é sempre a de jovem aprendiz (turnos globais), independente do posto. */
export const FUNCAO_JOVEM_APRENDIZ = 'JOVEM APRENDIZ'

export function isTipoEscala(value: string | null | undefined): value is TipoEscala {
  return !!value && (TIPOS_ESCALA as readonly string[]).includes(value)
}

/** Normaliza um valor de regime vindo do banco (sem CHECK constraint) para um TipoEscala válido, caindo em '5x2' se ausente ou inválido. */
export function resolverTipoEscala(value: string | null | undefined): TipoEscala {
  return isTipoEscala(value) ? value : '5x2'
}

/** Como resolverTipoEscala, mas restrito aos regimes atribuíveis a um posto — cai em '5x2' também para 'jovem_aprendiz' (nunca um regime de posto válido). Usar sempre que o valor resolvido alimentar calcularHorariosDerivados. */
export function resolverTipoEscalaPosto(value: string | null | undefined): TipoEscalaPosto {
  return isTipoEscalaPosto(value) ? value : '5x2'
}

export const ESCALA_LABEL: Record<TipoEscala, string> = {
  '5x2': '5×2 · 44h/sem',
  '5x1': '5×1 · 44h/sem',
  '12x36': '12×36',
  'jovem_aprendiz': 'Jovem Aprendiz',
}

export const ESCALA_BADGE_CLASS: Record<TipoEscala, string> = {
  '5x2': 'bg-blue-50 text-blue-700 ring-blue-200',
  '5x1': 'bg-purple-50 text-purple-700 ring-purple-200',
  '12x36': 'bg-orange-50 text-orange-700 ring-orange-200',
  'jovem_aprendiz': 'bg-teal-50 text-teal-700 ring-teal-200',
}

export const ESCALA_BORDER_CLASS: Record<TipoEscala, string> = {
  '5x2': 'border-blue-500',
  '5x1': 'border-purple-500',
  '12x36': 'border-orange-500',
  'jovem_aprendiz': 'border-teal-500',
}

export interface HorariosDerivados {
  hora_inicio_almoco: string | null
  hora_fim_almoco: string | null
  hora_saida_seg_qui: string
  hora_saida_sex: string | null
}

export interface TurnoHorarios {
  tipo_escala: string
  hora_entrada: string
  hora_saida_seg_qui: string
  hora_saida_sex: string | null
  hora_inicio_almoco: string | null
  hora_fim_almoco: string | null
}

function minutosParaHora(min: number): string {
  const h = Math.floor(min / 60) % 24
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function horaParaMinutos(hora: string): number {
  const [h, m] = hora.split(':').map(Number)
  return h * 60 + m
}

// 5x2 — base 07:00, almoço 12:00–13:12 (72min), saída 17:00 (seg-qui) / 16:00 (sex). 44h/semana.
const BASE_5X2_ENTRADA_MIN = 7 * 60
const BASE_5X2_ALMOCO_INICIO_MIN = 12 * 60
const BASE_5X2_ALMOCO_FIM_MIN = 13 * 60 + 12
const BASE_5X2_SAIDA_SEGQUI_MIN = 17 * 60
const BASE_5X2_SAIDA_SEX_MIN = 16 * 60

// 5x1 — 7h20 de trabalho/dia (44h ÷ 6 dias) + 1h de almoço, com o almoço começando 4h após a entrada.
const CARGA_DIARIA_5X1_MIN = 7 * 60 + 20
const ALMOCO_DURACAO_5X1_MIN = 60
const ALMOCO_OFFSET_5X1_MIN = 4 * 60

// 12x36 — 12h de trabalho + 1h de intervalo descontado da duração total (sem horário de almoço fixo).
const DURACAO_12X36_MIN = 13 * 60

/**
 * Calcula almoço/saída a partir da hora de entrada, seguindo a regra do regime informado.
 * Nunca é chamado com 'jovem_aprendiz': os dois turnos desse tipo são globais e fixos
 * (semeados via migração, sem fluxo de criação/edição), não derivados de uma hora de entrada.
 */
export function calcularHorariosDerivados(horaEntrada: string, tipoEscala: TipoEscalaPosto): HorariosDerivados {
  const entradaMin = horaParaMinutos(horaEntrada)

  if (tipoEscala === '5x1') {
    const almocoInicio = entradaMin + ALMOCO_OFFSET_5X1_MIN
    const almocoFim = almocoInicio + ALMOCO_DURACAO_5X1_MIN
    const saida = entradaMin + CARGA_DIARIA_5X1_MIN + ALMOCO_DURACAO_5X1_MIN
    return {
      hora_inicio_almoco: minutosParaHora(almocoInicio),
      hora_fim_almoco: minutosParaHora(almocoFim),
      hora_saida_seg_qui: minutosParaHora(saida),
      hora_saida_sex: null,
    }
  }

  if (tipoEscala === '12x36') {
    return {
      hora_inicio_almoco: null,
      hora_fim_almoco: null,
      hora_saida_seg_qui: minutosParaHora(entradaMin + DURACAO_12X36_MIN),
      hora_saida_sex: null,
    }
  }

  // 5x2 (default)
  const delta = entradaMin - BASE_5X2_ENTRADA_MIN
  return {
    hora_inicio_almoco: minutosParaHora(BASE_5X2_ALMOCO_INICIO_MIN + delta),
    hora_fim_almoco: minutosParaHora(BASE_5X2_ALMOCO_FIM_MIN + delta),
    hora_saida_seg_qui: minutosParaHora(BASE_5X2_SAIDA_SEGQUI_MIN + delta),
    hora_saida_sex: minutosParaHora(BASE_5X2_SAIDA_SEX_MIN + delta),
  }
}

/** Formata "HH:MM:SS" (ou já "HH:MM") vindo do banco; retorna "—" para null/undefined. */
export function fmtHora(h: string | null | undefined): string {
  return h ? h.slice(0, 5) : '—'
}

/** Duração do almoço em minutos, ou null se o turno não tiver horário de almoço fixo. */
export function duracaoAlmocoMin(inicio: string | null, fim: string | null): number | null {
  if (!inicio || !fim) return null
  return horaParaMinutos(fim.slice(0, 5)) - horaParaMinutos(inicio.slice(0, 5))
}

/** Resumo textual de um turno, adaptado ao regime. */
export function formatarResumoTurno(t: TurnoHorarios): string {
  const entrada = fmtHora(t.hora_entrada)
  const saida = fmtHora(t.hora_saida_seg_qui)

  if (t.tipo_escala === 'jovem_aprendiz') {
    return `Seg–Sex ${entrada}–${saida} (4h)`
  }
  if (t.hora_saida_sex !== null) {
    return `Seg–Qui ${entrada}–${saida} (almoço ${fmtHora(t.hora_inicio_almoco)}–${fmtHora(t.hora_fim_almoco)}) · Sex até ${fmtHora(t.hora_saida_sex)}`
  }
  if (t.hora_inicio_almoco !== null && t.hora_fim_almoco !== null) {
    return `Todos os dias ${entrada}–${saida} (almoço ${fmtHora(t.hora_inicio_almoco)}–${fmtHora(t.hora_fim_almoco)})`
  }
  return `${entrada}–${saida} (12h + intervalo)`
}
```

Note: `calcularHorariosDerivados` agora tem o parâmetro `tipoEscala` tipado como `TipoEscalaPosto` (3 valores) em vez do antigo `TipoEscala` (agora 4 valores) — isso é intencional: a função só é chamada por `criarTurno`/`editarTurno` (Task 4), que só lidam com turnos de posto.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: novos erros em `app/(admin)/postos/turnos/actions.ts` (chamadas a `calcularHorariosDerivados` com um `regime`/`TipoEscala` ainda largo — corrigido na Task 4) e em `components/postos/modal-turnos-posto.tsx` (`tipoEscalaForm` ainda largo — corrigido na Task 5). Nenhum erro dentro de `lib/turnos/escala.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/turnos/escala.ts
git commit -m "feat(turnos): adiciona tipo_escala jovem_aprendiz e separa regimes de posto vs turno"
```

---

### Task 4: `app/(admin)/postos/turnos/actions.ts` — regime do posto usa o tipo restrito

**Files:**
- Modify: `app/(admin)/postos/turnos/actions.ts` (linhas 6, 25-34, 72-74)

**Interfaces:**
- Consumes: `isTipoEscalaPosto`, `type TipoEscalaPosto` de `@/lib/turnos/escala` (Task 3).
- Produces: `obterRegimePosto(postoId): Promise<TipoEscalaPosto | null>` (assinatura mais restrita que antes).

- [ ] **Step 1: Editar o import**

Em `app/(admin)/postos/turnos/actions.ts:6`, trocar:

```ts
import { calcularHorariosDerivados, isTipoEscala, type TipoEscala } from '@/lib/turnos/escala'
```

por:

```ts
import { calcularHorariosDerivados, isTipoEscalaPosto, type TipoEscalaPosto } from '@/lib/turnos/escala'
```

`isTipoEscala`/`TipoEscala` (o tipo largo, 4 valores) deixam de ser usados neste arquivo — a Task 3 restringiu `calcularHorariosDerivados` para aceitar só `TipoEscalaPosto` (3 valores) como segundo argumento, então **todo** valor de regime manipulado aqui (tanto em `obterRegimePosto` quanto em `editarTurno`, Step 3 abaixo) precisa ser do tipo restrito — nunca o largo.

- [ ] **Step 2: Editar `obterRegimePosto`**

Em `app/(admin)/postos/turnos/actions.ts:24-34`, trocar:

```ts
/** Regime de trabalho configurado para o posto em Config Escalas, ou null se ainda não configurado / valor inválido. */
export async function obterRegimePosto(postoId: string): Promise<TipoEscala | null> {
  const supabase = createClient()
  const { data } = await supabase
    .from('config_escalas_postos')
    .select('regime')
    .eq('posto_id', postoId)
    .maybeSingle()
  const regime = data?.regime
  return isTipoEscala(regime) ? regime : null
}
```

por:

```ts
/** Regime de trabalho configurado para o posto em Config Escalas, ou null se ainda não configurado / valor inválido. */
export async function obterRegimePosto(postoId: string): Promise<TipoEscalaPosto | null> {
  const supabase = createClient()
  const { data } = await supabase
    .from('config_escalas_postos')
    .select('regime')
    .eq('posto_id', postoId)
    .maybeSingle()
  const regime = data?.regime
  return isTipoEscalaPosto(regime) ? regime : null
}
```

- [ ] **Step 3: Editar `editarTurno`**

Em `app/(admin)/postos/turnos/actions.ts:72-74`, trocar:

```ts
  const tipoEscalaAtual = turnoAtual.tipo_escala
  const regime = isTipoEscala(tipoEscalaAtual) ? tipoEscalaAtual : '5x2'
  const derivados = calcularHorariosDerivados(dados.hora_entrada, regime)
```

por:

```ts
  const tipoEscalaAtual = turnoAtual.tipo_escala
  const regime = isTipoEscalaPosto(tipoEscalaAtual) ? tipoEscalaAtual : '5x2'
  const derivados = calcularHorariosDerivados(dados.hora_entrada, regime)
```

Este arquivo só opera sobre turnos com `posto_id` preenchido (nunca os dois globais de jovem aprendiz, que ficam fora do catálogo de qualquer posto — `listarTurnosPosto` sempre filtra `.eq('posto_id', postoId)`), então `tipoEscalaAtual` nunca é `'jovem_aprendiz'` na prática — mas agora o próprio tipo (`TipoEscalaPosto`) reforça isso em vez de depender só da convenção, e bate com a assinatura restrita de `calcularHorariosDerivados` (Task 3).

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: erros restantes só em `components/postos/modal-turnos-posto.tsx` (corrigido na Task 5).

- [ ] **Step 5: Commit**

```bash
git add "app/(admin)/postos/turnos/actions.ts"
git commit -m "fix(postos): obterRegimePosto e editarTurno restringem regime aos tipos atribuiveis a posto"
```

---

### Task 5: `components/postos/modal-turnos-posto.tsx` — seletor de regime do posto usa o tipo restrito

**Files:**
- Modify: `components/postos/modal-turnos-posto.tsx` (linhas 14-23, 37, 112, 123-124, 160)

**Interfaces:**
- Consumes: `TIPOS_ESCALA_POSTO`, `type TipoEscalaPosto`, `resolverTipoEscalaPosto` de `@/lib/turnos/escala` (Task 3), além dos já usados (`calcularHorariosDerivados`, `resolverTipoEscala`, `ESCALA_LABEL`, `ESCALA_BADGE_CLASS`, `ESCALA_BORDER_CLASS`, `formatarResumoTurno`).

- [ ] **Step 1: Editar o import**

Em `components/postos/modal-turnos-posto.tsx:14-23`, trocar:

```tsx
import {
  TIPOS_ESCALA,
  type TipoEscala,
  calcularHorariosDerivados,
  resolverTipoEscala,
  ESCALA_LABEL,
  ESCALA_BADGE_CLASS,
  ESCALA_BORDER_CLASS,
  formatarResumoTurno,
} from '@/lib/turnos/escala'
```

por:

```tsx
import {
  TIPOS_ESCALA_POSTO,
  type TipoEscalaPosto,
  calcularHorariosDerivados,
  resolverTipoEscala,
  resolverTipoEscalaPosto,
  ESCALA_LABEL,
  ESCALA_BADGE_CLASS,
  ESCALA_BORDER_CLASS,
  formatarResumoTurno,
} from '@/lib/turnos/escala'
```

`type TipoEscala` (o tipo largo) sai do import — não é mais usado neste arquivo depois do próximo passo.

- [ ] **Step 2: Editar o estado `regime`**

Em `components/postos/modal-turnos-posto.tsx:37`, trocar:

```tsx
  const [regime, setRegime]         = useState<TipoEscala | null | undefined>(undefined) // undefined = carregando
```

por:

```tsx
  const [regime, setRegime]         = useState<TipoEscalaPosto | null | undefined>(undefined) // undefined = carregando
```

- [ ] **Step 3: Editar `handleDefinirRegime`**

Em `components/postos/modal-turnos-posto.tsx:112`, trocar:

```tsx
  async function handleDefinirRegime(tipo: TipoEscala) {
```

por:

```tsx
  async function handleDefinirRegime(tipo: TipoEscalaPosto) {
```

- [ ] **Step 4: Editar o picker de regime**

Em `components/postos/modal-turnos-posto.tsx:160`, trocar:

```tsx
                {TIPOS_ESCALA.map(tipo => (
```

por:

```tsx
                {TIPOS_ESCALA_POSTO.map(tipo => (
```

Isso garante que o aviso "posto sem regime" só ofereça 5x2/5x1/12x36 como opção — nunca "Jovem Aprendiz" (que não é um regime de posto).

- [ ] **Step 5: Editar `tipoEscalaForm`**

A Task 3 restringiu `calcularHorariosDerivados` para aceitar só `TipoEscalaPosto` como segundo argumento. `tipoEscalaForm` (usado para chamar essa função no preview do formulário) precisa ser desse mesmo tipo restrito — hoje é resolvido com `resolverTipoEscala` (o tipo largo, que aceitaria `'jovem_aprendiz'`). Em `components/postos/modal-turnos-posto.tsx:123-124`, trocar:

```tsx
  const tipoEscalaForm: TipoEscala | null =
    form === 'novo' ? (regime ?? null) : form ? resolverTipoEscala(form.tipo_escala) : null
```

por:

```tsx
  const tipoEscalaForm: TipoEscalaPosto | null =
    form === 'novo' ? (regime ?? null) : form ? resolverTipoEscalaPosto(form.tipo_escala) : null
```

`ESCALA_LABEL[tipoEscalaForm]`, `ESCALA_BADGE_CLASS[tipoEscalaForm]` e `ESCALA_BORDER_CLASS[tipoEscalaForm]` (usados mais abaixo, no formulário) continuam funcionando sem mudança — são `Record<TipoEscala, string>` (4 chaves), e indexar com uma chave de `TipoEscalaPosto` (subconjunto de 3) é válido. A lista de turnos do posto (linha 196, `resolverTipoEscala(t.tipo_escala)`) continua usando o tipo largo — ela só exibe badges de turnos já existentes, sem alimentar nenhum cálculo, então não precisa da restrição.

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: sem erros em `components/postos/modal-turnos-posto.tsx`. Erros restantes em `app/(admin)/efetivo/horario/actions.ts`, `app/(admin)/efetivo/[id]/page.tsx`, `components/efetivo/tab-horario.tsx`, `components/efetivo/perfil-tabs.tsx` (corrigidos nas próximas tasks).

- [ ] **Step 7: Commit**

```bash
git add components/postos/modal-turnos-posto.tsx
git commit -m "fix(postos): seletor de regime do posto nao oferece jovem_aprendiz"
```

---

### Task 6: `app/(admin)/efetivo/horario/actions.ts` — turnos globais e dia de curso

**Files:**
- Modify: `app/(admin)/efetivo/horario/actions.ts` (arquivo inteiro, 105 linhas)

**Interfaces:**
- Consumes: `resolverTipoEscala` de `@/lib/turnos/escala` (Task 3).
- Produces: `listarTurnosJovemAprendiz(): Promise<TurnoOpcao[]>` (mesmo shape de `listarTurnosDoPosto`, mas só os 2 turnos globais); `alterarTurno(funcionarioId, turnoId, dataInicio, diaCurso?): Promise<{success, error?}>` (novo 4º parâmetro opcional).
- Consumido por: `components/efetivo/tab-horario.tsx` (Task 9).

- [ ] **Step 1: Substituir o conteúdo do arquivo**

```ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/auth/get-user'
import { revalidatePath } from 'next/cache'
import { resolverTipoEscala } from '@/lib/turnos/escala'

export async function listarTurnosDoPosto(postoId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('turnos_postos')
    .select('id, nome, hora_entrada, hora_saida_seg_qui, hora_saida_sex, hora_inicio_almoco, hora_fim_almoco, tipo_escala')
    .eq('posto_id', postoId)
    .eq('ativo', true)
    .order('hora_entrada')
  if (error) throw new Error(error.message)
  return data ?? []
}

/** Os dois turnos globais de jovem aprendiz (Manhã/Tarde) — sem posto_id, fixos, semeados via migração. */
export async function listarTurnosJovemAprendiz() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('turnos_postos')
    .select('id, nome, hora_entrada, hora_saida_seg_qui, hora_saida_sex, hora_inicio_almoco, hora_fim_almoco, tipo_escala')
    .is('posto_id', null)
    .eq('tipo_escala', 'jovem_aprendiz')
    .eq('ativo', true)
    .order('hora_entrada')
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function alterarTurno(
  funcionarioId: string,
  turnoId: string,
  dataInicio: string,
  diaCurso?: number,
) {
  const auth = await getUser()
  if (!auth || !['admin', 'coordenador'].includes(auth.perfil.role ?? '')) {
    return { success: false, error: 'Acesso negado' }
  }
  const supabase = createClient()

  const { data: turnoNovo, error: errTurnoNovo } = await supabase
    .from('turnos_postos')
    .select('tipo_escala')
    .eq('id', turnoId)
    .single()
  if (errTurnoNovo || !turnoNovo) return { success: false, error: 'Turno não encontrado' }

  const ehJovemAprendiz = resolverTipoEscala(turnoNovo.tipo_escala) === 'jovem_aprendiz'
  if (ehJovemAprendiz && !diaCurso) {
    return { success: false, error: 'Informe o dia de curso' }
  }

  // Fechar horário vigente, se houver
  const { data: vigente } = await supabase
    .from('horarios_funcionarios')
    .select('id, turno_id, data_inicio')
    .eq('funcionario_id', funcionarioId)
    .is('data_fim', null)
    .maybeSingle()

  if (vigente && dataInicio <= vigente.data_inicio) {
    const [y, m, d] = vigente.data_inicio.split('-')
    return {
      success: false,
      error: `A data de início deve ser posterior a ${d}/${m}/${y} (início do turno vigente).`,
    }
  }

  if (vigente) {
    const d = new Date(dataInicio + 'T12:00:00')
    d.setDate(d.getDate() - 1)
    const dataFim = d.toISOString().split('T')[0]
    const { error: errClose } = await supabase
      .from('horarios_funcionarios')
      .update({ data_fim: dataFim })
      .eq('id', vigente.id)
    if (errClose) return { success: false, error: errClose.message }
  }

  // Inserir novo registro
  const { error } = await supabase.from('horarios_funcionarios').insert({
    funcionario_id: funcionarioId,
    turno_id: turnoId,
    data_inicio: dataInicio,
    dia_curso: ehJovemAprendiz ? diaCurso : null,
    criado_por: auth.user.id,
  })
  if (error) return { success: false, error: error.message }

  // Registrar movimentação
  await supabase.from('movimentacoes').insert({
    funcionario_id: funcionarioId,
    tipo: 'mudanca_horario',
    campo_alterado: 'turno_id',
    valor_antes: vigente?.turno_id ?? null,
    valor_depois: turnoId,
    executado_por: auth.user.id,
  })

  revalidatePath(`/efetivo/${funcionarioId}`)
  return { success: true }
}

export async function deletarHorarioFuncionario(id: string) {
  const auth = await getUser()
  if (!auth || !['admin', 'coordenador'].includes(auth.perfil.role ?? '')) {
    return { success: false, error: 'Acesso negado' }
  }
  const supabase = createClient()

  const { data: registro, error: errFetch } = await supabase
    .from('horarios_funcionarios')
    .select('id, data_fim, funcionario_id')
    .eq('id', id)
    .single()

  if (errFetch || !registro) return { success: false, error: 'Registro não encontrado' }
  if (!registro.data_fim) return { success: false, error: 'Não é possível excluir o horário vigente' }

  const { error } = await supabase
    .from('horarios_funcionarios')
    .delete()
    .eq('id', id)

  if (error) return { success: false, error: error.message }

  revalidatePath(`/efetivo/${registro.funcionario_id}`)
  return { success: true }
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: erros restantes em `app/(admin)/efetivo/[id]/page.tsx`, `components/efetivo/tab-horario.tsx`, `components/efetivo/perfil-tabs.tsx` (corrigidos nas próximas tasks).

- [ ] **Step 3: Commit**

```bash
git add "app/(admin)/efetivo/horario/actions.ts"
git commit -m "feat(efetivo): listarTurnosJovemAprendiz e dia_curso em alterarTurno"
```

---

### Task 7: `app/(admin)/efetivo/[id]/page.tsx` — buscar dia_curso e tipo_escala

**Files:**
- Modify: `app/(admin)/efetivo/[id]/page.tsx` (linhas 101-131, 194-219)

**Interfaces:**
- Consumes: schema atualizado (Tasks 1/2).
- Produces: `RawTurno` com `tipo_escala: string`; `RawHorario` com `dia_curso: number | null`; `horarioVigente`/`historicoHorario` (via `HorarioVigenteShape`/`HistoricoHorarioShape`, atualizados na Task 9) carregando esses campos.

- [ ] **Step 1: Incluir `dia_curso` e `tipo_escala` nos selects de horário**

Em `app/(admin)/efetivo/[id]/page.tsx:101-127`, trocar:

```ts
    // horário vigente
    supabase
      .from('horarios_funcionarios')
      .select(`
        id, data_inicio, data_fim,
        turnos_postos!turno_id(
          id, posto_id, nome,
          hora_entrada, hora_saida_seg_qui, hora_saida_sex,
          hora_inicio_almoco, hora_fim_almoco, ativo
        )
      `)
      .eq('funcionario_id', id)
      .is('data_fim', null)
      .maybeSingle(),
    // histórico de horários (excl. vigente)
    supabase
      .from('horarios_funcionarios')
      .select(`
        id, data_inicio, data_fim,
        turnos_postos!turno_id(
          nome, hora_entrada, hora_saida_seg_qui, hora_saida_sex,
          hora_inicio_almoco, hora_fim_almoco
        )
      `)
      .eq('funcionario_id', id)
      .not('data_fim', 'is', null)
      .order('data_inicio', { ascending: false }),
```

por:

```ts
    // horário vigente
    supabase
      .from('horarios_funcionarios')
      .select(`
        id, data_inicio, data_fim, dia_curso,
        turnos_postos!turno_id(
          id, posto_id, nome, tipo_escala,
          hora_entrada, hora_saida_seg_qui, hora_saida_sex,
          hora_inicio_almoco, hora_fim_almoco, ativo
        )
      `)
      .eq('funcionario_id', id)
      .is('data_fim', null)
      .maybeSingle(),
    // histórico de horários (excl. vigente)
    supabase
      .from('horarios_funcionarios')
      .select(`
        id, data_inicio, data_fim, dia_curso,
        turnos_postos!turno_id(
          nome, tipo_escala, hora_entrada, hora_saida_seg_qui, hora_saida_sex,
          hora_inicio_almoco, hora_fim_almoco
        )
      `)
      .eq('funcionario_id', id)
      .not('data_fim', 'is', null)
      .order('data_inicio', { ascending: false }),
```

- [ ] **Step 2: Atualizar `RawTurno`/`RawHorario` e o mapeamento**

Em `app/(admin)/efetivo/[id]/page.tsx:194-219`, trocar:

```ts
  type RawTurno = {
    id: string; posto_id: string; nome: string; ativo: boolean
    hora_entrada: string; hora_saida_seg_qui: string; hora_saida_sex: string | null
    hora_inicio_almoco: string | null; hora_fim_almoco: string | null
  }
  type RawHorario = { id: string; data_inicio: string; data_fim: string | null; turnos_postos: RawTurno | null }

  const horarioVigente: HorarioVigenteShape = (() => {
    if (!horarioVigenteRaw) return null
    const raw = horarioVigenteRaw as unknown as RawHorario
    if (!raw.turnos_postos) return null
    return { id: raw.id, data_inicio: raw.data_inicio, data_fim: raw.data_fim, turno: raw.turnos_postos }
  })()

  const historicoHorario: HistoricoHorarioShape = (historicoRaw ?? []).map((h) => {
    const raw = h as unknown as RawHorario
    return {
      id: raw.id,
      data_inicio: raw.data_inicio,
      data_fim: raw.data_fim,
      turno: raw.turnos_postos ?? {
        nome: '—', hora_entrada: '00:00:00', hora_saida_seg_qui: '00:00:00',
        hora_saida_sex: '00:00:00', hora_inicio_almoco: '00:00:00', hora_fim_almoco: '00:00:00',
      },
    }
  })
```

por:

```ts
  type RawTurno = {
    id: string; posto_id: string | null; nome: string; ativo: boolean; tipo_escala: string
    hora_entrada: string; hora_saida_seg_qui: string; hora_saida_sex: string | null
    hora_inicio_almoco: string | null; hora_fim_almoco: string | null
  }
  type RawHorario = {
    id: string; data_inicio: string; data_fim: string | null; dia_curso: number | null
    turnos_postos: RawTurno | null
  }

  const horarioVigente: HorarioVigenteShape = (() => {
    if (!horarioVigenteRaw) return null
    const raw = horarioVigenteRaw as unknown as RawHorario
    if (!raw.turnos_postos) return null
    return {
      id: raw.id, data_inicio: raw.data_inicio, data_fim: raw.data_fim,
      dia_curso: raw.dia_curso, turno: raw.turnos_postos,
    }
  })()

  const historicoHorario: HistoricoHorarioShape = (historicoRaw ?? []).map((h) => {
    const raw = h as unknown as RawHorario
    return {
      id: raw.id,
      data_inicio: raw.data_inicio,
      data_fim: raw.data_fim,
      turno: raw.turnos_postos ?? {
        nome: '—', tipo_escala: '5x2', hora_entrada: '00:00:00', hora_saida_seg_qui: '00:00:00',
        hora_saida_sex: '00:00:00', hora_inicio_almoco: '00:00:00', hora_fim_almoco: '00:00:00',
      },
    }
  })
```

Note: `posto_id` em `RawTurno` vira `string | null` (turnos globais têm `posto_id = null`). `dia_curso` fica no nível do registro de `horarios_funcionarios` (raiz de `RawHorario`), não dentro do turno — é uma propriedade da atribuição específica àquele funcionário, não do turno em si.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: erros restantes só em `components/efetivo/tab-horario.tsx` e `components/efetivo/perfil-tabs.tsx` (corrigidos nas próximas tasks).

- [ ] **Step 4: Commit**

```bash
git add "app/(admin)/efetivo/[id]/page.tsx"
git commit -m "feat(efetivo): busca dia_curso e tipo_escala do turno no perfil do funcionario"
```

---

### Task 8: `components/efetivo/perfil-tabs.tsx` — propagar a função do funcionário

**Files:**
- Modify: `components/efetivo/perfil-tabs.tsx:409`

**Interfaces:**
- Consumes: `funcionario.funcao` (já existe em `FuncionarioParaPDF`, sem mudança de tipo necessária).
- Produces: `TabHorario` passa a receber `funcaoNome`.

- [ ] **Step 1: Passar `funcao` para `TabHorario`**

Em `components/efetivo/perfil-tabs.tsx:409`, trocar:

```tsx
        {tab === 'horario'       && <TabHorario horarioVigente={horarioVigente} historicoHorario={historicoHorario} regimePosto={regimePosto} postoId={postoId} funcionarioId={funcionario.id} role={role} />}
```

por:

```tsx
        {tab === 'horario'       && <TabHorario horarioVigente={horarioVigente} historicoHorario={historicoHorario} regimePosto={regimePosto} postoId={postoId} funcionarioId={funcionario.id} role={role} funcaoNome={funcionario.funcao} />}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: erro aponta para `components/efetivo/tab-horario.tsx` (ainda não aceita a prop `funcaoNome` — corrigido na Task 9).

- [ ] **Step 3: Commit**

```bash
git add components/efetivo/perfil-tabs.tsx
git commit -m "feat(efetivo): propaga funcao do funcionario para TabHorario"
```

---

### Task 9: `components/efetivo/tab-horario.tsx` — regime de jovem aprendiz na UI

**Files:**
- Modify: `components/efetivo/tab-horario.tsx` (múltiplos trechos: linhas 1-51, 79-109, 113-292, 296-332, 417-442, 557-569)

**Interfaces:**
- Consumes: `FUNCAO_JOVEM_APRENDIZ`, `resolverTipoEscala`, `ESCALA_LABEL`, `ESCALA_BADGE_CLASS`, `formatarResumoTurno`, `duracaoAlmocoMin` de `@/lib/turnos/escala` (Task 3); `listarTurnosJovemAprendiz`, `alterarTurno` (nova assinatura com `diaCurso`) de `@/app/(admin)/efetivo/horario/actions` (Task 6); `funcaoNome` prop vinda de `PerfilTabs` (Task 8).

- [ ] **Step 1: Imports e tipos de entrada**

Em `components/efetivo/tab-horario.tsx:1-7`, trocar:

```tsx
'use client'

import { useState, useCallback } from 'react'
import { Clock, CalendarDays, ChevronDown, ChevronUp, X, Plus, AlertCircle, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { listarTurnosDoPosto, alterarTurno, deletarHorarioFuncionario } from '@/app/(admin)/efetivo/horario/actions'
import { resolverTipoEscala, ESCALA_LABEL, ESCALA_BADGE_CLASS, formatarResumoTurno, duracaoAlmocoMin } from '@/lib/turnos/escala'
```

por:

```tsx
'use client'

import { useState, useCallback } from 'react'
import { Clock, CalendarDays, ChevronDown, ChevronUp, X, Plus, AlertCircle, Trash2, GraduationCap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { listarTurnosDoPosto, listarTurnosJovemAprendiz, alterarTurno, deletarHorarioFuncionario } from '@/app/(admin)/efetivo/horario/actions'
import { resolverTipoEscala, ESCALA_LABEL, ESCALA_BADGE_CLASS, formatarResumoTurno, duracaoAlmocoMin, FUNCAO_JOVEM_APRENDIZ } from '@/lib/turnos/escala'
```

Em `components/efetivo/tab-horario.tsx:11-51` (tipos `HorarioVigenteShape`, `HistoricoHorarioShape`, `TurnoOpcao`), trocar:

```ts
export type HorarioVigenteShape = {
  id: string
  data_inicio: string
  data_fim: string | null
  turno: {
    id: string
    posto_id: string
    nome: string
    hora_entrada: string
    hora_saida_seg_qui: string
    hora_saida_sex: string | null
    hora_inicio_almoco: string | null
    hora_fim_almoco: string | null
    ativo: boolean
  }
} | null

export type HistoricoHorarioShape = {
  id: string
  data_inicio: string
  data_fim: string | null
  turno: {
    nome: string
    hora_entrada: string
    hora_saida_seg_qui: string
    hora_saida_sex: string | null
    hora_inicio_almoco: string | null
    hora_fim_almoco: string | null
  }
}[]

type TurnoOpcao = {
  id: string
  nome: string
  hora_entrada: string
  hora_saida_seg_qui: string
  hora_saida_sex: string | null
  hora_inicio_almoco: string | null
  hora_fim_almoco: string | null
  tipo_escala: string
}
```

por:

```ts
export type HorarioVigenteShape = {
  id: string
  data_inicio: string
  data_fim: string | null
  dia_curso: number | null
  turno: {
    id: string
    posto_id: string | null
    nome: string
    tipo_escala: string
    hora_entrada: string
    hora_saida_seg_qui: string
    hora_saida_sex: string | null
    hora_inicio_almoco: string | null
    hora_fim_almoco: string | null
    ativo: boolean
  }
} | null

export type HistoricoHorarioShape = {
  id: string
  data_inicio: string
  data_fim: string | null
  turno: {
    nome: string
    tipo_escala: string
    hora_entrada: string
    hora_saida_seg_qui: string
    hora_saida_sex: string | null
    hora_inicio_almoco: string | null
    hora_fim_almoco: string | null
  }
}[]

type TurnoOpcao = {
  id: string
  nome: string
  hora_entrada: string
  hora_saida_seg_qui: string
  hora_saida_sex: string | null
  hora_inicio_almoco: string | null
  hora_fim_almoco: string | null
  tipo_escala: string
}

const DIAS_CURSO_OPCOES = [
  { valor: 1, label: 'Segunda' },
  { valor: 2, label: 'Terça' },
  { valor: 3, label: 'Quarta' },
  { valor: 4, label: 'Quinta' },
  { valor: 5, label: 'Sexta' },
]
```

- [ ] **Step 2: `REGIME_CONFIG` ganha a entrada de jovem aprendiz**

Em `components/efetivo/tab-horario.tsx:79-107`, trocar:

```ts
const REGIME_CONFIG: Record<string, {
  badge: string
  badgeClass: string
  diasLabel: string
  diasAtivos: boolean[] // Dom=0 Seg=1 ... Sab=6
  dotClass: string
}> = {
  '5x2': {
    badge: '5×2 · 44h/sem',
    badgeClass: 'bg-blue-50 text-blue-700 ring-blue-200',
    diasLabel: 'Segunda a Sexta',
    diasAtivos: [false, true, true, true, true, true, false],
    dotClass: 'bg-blue-500',
  },
  '5x1': {
    badge: '5×1 · 44h/sem',
    badgeClass: 'bg-purple-50 text-purple-700 ring-purple-200',
    diasLabel: 'Segunda a Sábado',
    diasAtivos: [false, true, true, true, true, true, true],
    dotClass: 'bg-purple-500',
  },
  '12x36': {
    badge: '12×36',
    badgeClass: 'bg-orange-50 text-orange-700 ring-orange-200',
    diasLabel: 'Escala rodízio',
    diasAtivos: [true, true, true, true, true, true, true],
    dotClass: 'bg-orange-500',
  },
}
```

por:

```ts
const REGIME_CONFIG: Record<string, {
  badge: string
  badgeClass: string
  diasLabel: string
  diasAtivos: boolean[] // Dom=0 Seg=1 ... Sab=6
  dotClass: string
}> = {
  '5x2': {
    badge: '5×2 · 44h/sem',
    badgeClass: 'bg-blue-50 text-blue-700 ring-blue-200',
    diasLabel: 'Segunda a Sexta',
    diasAtivos: [false, true, true, true, true, true, false],
    dotClass: 'bg-blue-500',
  },
  '5x1': {
    badge: '5×1 · 44h/sem',
    badgeClass: 'bg-purple-50 text-purple-700 ring-purple-200',
    diasLabel: 'Segunda a Sábado',
    diasAtivos: [false, true, true, true, true, true, true],
    dotClass: 'bg-purple-500',
  },
  '12x36': {
    badge: '12×36',
    badgeClass: 'bg-orange-50 text-orange-700 ring-orange-200',
    diasLabel: 'Escala rodízio',
    diasAtivos: [true, true, true, true, true, true, true],
    dotClass: 'bg-orange-500',
  },
  'jovem_aprendiz': {
    badge: 'Jovem Aprendiz',
    badgeClass: 'bg-teal-50 text-teal-700 ring-teal-200',
    diasLabel: 'Segunda a Sexta',
    diasAtivos: [false, true, true, true, true, true, false],
    dotClass: 'bg-teal-500',
  },
}
```

- [ ] **Step 3: `ModalAlterarTurno` — turnos globais e dia de curso**

Em `components/efetivo/tab-horario.tsx:113-292`, substituir toda a função `ModalAlterarTurno` por:

```tsx
function ModalAlterarTurno({
  open,
  onClose,
  postoId,
  funcionarioId,
  isJovemAprendiz,
  dataInicioVigente,
  onSucesso,
}: {
  open: boolean
  onClose: () => void
  postoId: string
  funcionarioId: string
  isJovemAprendiz: boolean
  dataInicioVigente?: string
  onSucesso: () => void
}) {
  const [turnos, setTurnos]         = useState<TurnoOpcao[]>([])
  const [loading, setLoading]       = useState(false)
  const [turnoId, setTurnoId]       = useState('')
  const [dataInicio, setDataInicio] = useState('')
  const [diaCurso, setDiaCurso]     = useState<number | ''>('')
  const [saving, setSaving]         = useState(false)
  const [erro, setErro]             = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const data = isJovemAprendiz
        ? await listarTurnosJovemAprendiz()
        : await listarTurnosDoPosto(postoId)
      setTurnos(data as TurnoOpcao[])
    } finally {
      setLoading(false)
    }
  }, [postoId, isJovemAprendiz])

  // Carregar ao abrir
  const [carregou, setCarregou] = useState(false)
  if (open && !carregou) {
    setCarregou(true)
    carregar()
  }
  if (!open) {
    if (carregou) setCarregou(false)
    return null
  }

  const turnoSelecionado = turnos.find(t => t.id === turnoId)
  const precisaDiaCurso = turnoSelecionado ? resolverTipoEscala(turnoSelecionado.tipo_escala) === 'jovem_aprendiz' : false

  const dataInicioInvalida = !!dataInicio && !!dataInicioVigente && dataInicio <= dataInicioVigente

  async function handleSalvar() {
    if (!turnoId)          { setErro('Selecione um turno'); return }
    if (!dataInicio)       { setErro('Informe a data de início'); return }
    if (dataInicioInvalida) { setErro('A data de início deve ser posterior à do turno vigente'); return }
    if (precisaDiaCurso && !diaCurso) { setErro('Selecione o dia de curso'); return }
    setSaving(true)
    setErro(null)
    const res = await alterarTurno(funcionarioId, turnoId, dataInicio, precisaDiaCurso ? Number(diaCurso) : undefined)
    setSaving(false)
    if (!res.success) { setErro(res.error ?? 'Erro ao salvar'); return }
    onSucesso()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        {/* header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h2 className="text-base font-bold text-gray-900">Alterar Turno de Trabalho</h2>
            <p className="text-xs text-gray-400">Selecione o novo turno e a data de início</p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-4">
          {loading ? (
            <p className="text-sm text-gray-400">Carregando turnos...</p>
          ) : turnos.length === 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-sm text-amber-700">
                {isJovemAprendiz
                  ? 'Nenhum turno de jovem aprendiz cadastrado.'
                  : <>Nenhum turno cadastrado para este posto. Acesse <strong>Postos → Turnos</strong> para criar.</>}
              </p>
            </div>
          ) : (
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-gray-500">
                Turno
              </label>
              <div className="space-y-2">
                {turnos.map(t => {
                  const tipoTurno = resolverTipoEscala(t.tipo_escala)
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTurnoId(t.id)}
                      className={cn(
                        'w-full rounded-lg border px-4 py-3 text-left transition-colors',
                        turnoId === t.id
                          ? 'border-blue-400 bg-blue-50 ring-1 ring-blue-400'
                          : 'border-gray-200 bg-gray-50 hover:border-gray-300 hover:bg-white',
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <p className={cn('text-sm font-semibold', turnoId === t.id ? 'text-blue-800' : 'text-gray-800')}>
                          {t.nome}
                        </p>
                        <span className={cn(
                          'inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-bold ring-1 ring-inset',
                          ESCALA_BADGE_CLASS[tipoTurno],
                        )}>
                          {ESCALA_LABEL[tipoTurno]}
                        </span>
                      </div>
                      <p className={cn('text-xs mt-0.5', turnoId === t.id ? 'text-blue-600' : 'text-gray-500')}>
                        {formatarResumoTurno(t)}
                      </p>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {precisaDiaCurso && (
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-gray-500">
                Dia de curso
              </label>
              <select
                value={diaCurso}
                onChange={e => setDiaCurso(e.target.value ? Number(e.target.value) : '')}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
              >
                <option value="">Selecione…</option>
                {DIAS_CURSO_OPCOES.map(d => (
                  <option key={d.valor} value={d.valor}>{d.label}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-gray-500">
              Data de Início
            </label>
            <input
              type="date"
              value={dataInicio}
              onChange={e => setDataInicio(e.target.value)}
              className={cn(
                'w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1',
                dataInicioInvalida
                  ? 'border-amber-400 focus:ring-amber-400'
                  : 'border-gray-200 focus:ring-blue-400',
              )}
            />
            {dataInicioInvalida && dataInicioVigente && (() => {
              const [y, m, d] = dataInicioVigente.split('-')
              return (
                <p className="mt-1.5 flex items-center gap-1 text-xs text-amber-700">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  Deve ser posterior a {d}/{m}/{y} (início do turno vigente)
                </p>
              )
            })()}
          </div>

          {turnoSelecionado && dataInicio && (
            <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-xs text-green-700">
              <p className="font-semibold mb-0.5">Resumo da alteração</p>
              <p>A partir de <strong>{fmtData(dataInicio)}</strong>, o funcionário passará para o <strong>{turnoSelecionado.nome}</strong>.</p>
              <p className="mt-0.5 text-green-600">O horário anterior será encerrado automaticamente no dia anterior.</p>
            </div>
          )}

          {erro && (
            <p className="flex items-center gap-1.5 text-xs text-red-600">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {erro}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-100 px-6 py-3">
          <button type="button" onClick={onClose}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
            Cancelar
          </button>
          <button type="button" onClick={handleSalvar} disabled={saving}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50">
            {saving ? 'Salvando…' : 'Salvar Alteração'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

Nota: o botão "Salvar Alteração" perdeu o `turnos.length === 0` do `disabled` original — isso já era coberto pela validação `if (!turnoId)` dentro de `handleSalvar` (se não há turnos, não há como selecionar um `turnoId`, então o clique sempre cai nesse erro). Mantido assim para não divergir do comportamento observável.

- [ ] **Step 4: `TabHorario` — nova prop `funcaoNome` e uso em `regime`/modal**

Em `components/efetivo/tab-horario.tsx:296-332`, trocar a assinatura de `TabHorario`:

```tsx
export function TabHorario({
  horarioVigente,
  historicoHorario,
  regimePosto,
  postoId,
  funcionarioId,
  role,
}: {
  horarioVigente: HorarioVigenteShape
  historicoHorario: HistoricoHorarioShape
  regimePosto: string | null
  postoId: string | null
  funcionarioId: string
  role: string | null
}) {
```

por:

```tsx
export function TabHorario({
  horarioVigente,
  historicoHorario,
  regimePosto,
  postoId,
  funcionarioId,
  role,
  funcaoNome = null,
}: {
  horarioVigente: HorarioVigenteShape
  historicoHorario: HistoricoHorarioShape
  regimePosto: string | null
  postoId: string | null
  funcionarioId: string
  role: string | null
  funcaoNome?: string | null
}) {
```

Logo abaixo, dentro do corpo de `TabHorario`, trocar:

```tsx
  const regime   = regimePosto ?? '5x2'
  const regimeCfg = REGIME_CONFIG[regime] ?? REGIME_CONFIG['5x2']
```

por:

```tsx
  const isJovemAprendiz = funcaoNome === FUNCAO_JOVEM_APRENDIZ
  const regime    = isJovemAprendiz ? 'jovem_aprendiz' : (regimePosto ?? '5x2')
  const regimeCfg = REGIME_CONFIG[regime] ?? REGIME_CONFIG['5x2']
  const diaCursoAtual = horarioVigente?.dia_curso ?? null
```

- [ ] **Step 5: Grade "Dias de trabalho" — marcar o dia de curso**

Em `components/efetivo/tab-horario.tsx:417-442` (bloco "dias da semana"), trocar:

```tsx
            {/* dias da semana */}
            <div className="border-t border-blue-100 px-5 py-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-blue-400">
                Dias de trabalho · {regimeCfg.diasLabel}
              </p>
              <div className="flex gap-2">
                {DIAS_SEMANA.map((dia, i) => {
                  const ativo = regimeCfg.diasAtivos[i]
                  return (
                    <div key={dia} className="flex flex-col items-center gap-1">
                      <div className={cn(
                        'h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors',
                        ativo
                          ? cn(regimeCfg.dotClass, 'text-white')
                          : 'bg-gray-100 text-gray-400',
                      )}>
                        {dia.slice(0, 1)}
                      </div>
                      <span className={cn('text-xs', ativo ? 'text-gray-600 font-medium' : 'text-gray-300')}>
                        {dia}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
```

por:

```tsx
            {/* dias da semana */}
            <div className="border-t border-blue-100 px-5 py-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-blue-400">
                Dias de trabalho · {regimeCfg.diasLabel}
              </p>
              <div className="flex gap-2">
                {DIAS_SEMANA.map((dia, i) => {
                  const ehCurso = isJovemAprendiz && diaCursoAtual === i
                  const ativo = ehCurso ? false : regimeCfg.diasAtivos[i]
                  return (
                    <div key={dia} className="flex flex-col items-center gap-1">
                      <div className={cn(
                        'h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors',
                        ehCurso
                          ? 'bg-teal-500 text-white'
                          : ativo
                            ? cn(regimeCfg.dotClass, 'text-white')
                            : 'bg-gray-100 text-gray-400',
                      )}>
                        {ehCurso ? <GraduationCap className="h-3.5 w-3.5" /> : dia.slice(0, 1)}
                      </div>
                      <span className={cn('text-xs', (ativo || ehCurso) ? 'text-gray-600 font-medium' : 'text-gray-300')}>
                        {dia}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
```

- [ ] **Step 6: Passar `isJovemAprendiz` para o `ModalAlterarTurno`**

Em `components/efetivo/tab-horario.tsx`, no bloco final do componente (`{/* ── Modal ── */}`), trocar:

```tsx
      {postoId && (
        <ModalAlterarTurno
          open={modalAberto}
          onClose={() => setModalAberto(false)}
          postoId={postoId}
          funcionarioId={funcionarioId}
          dataInicioVigente={horarioVigente?.data_inicio}
          onSucesso={() => {
            // revalidatePath no server action vai atualizar os dados via RSC
          }}
        />
      )}
```

por:

```tsx
      {postoId && (
        <ModalAlterarTurno
          open={modalAberto}
          onClose={() => setModalAberto(false)}
          postoId={postoId}
          funcionarioId={funcionarioId}
          isJovemAprendiz={isJovemAprendiz}
          dataInicioVigente={horarioVigente?.data_inicio}
          onSucesso={() => {
            // revalidatePath no server action vai atualizar os dados via RSC
          }}
        />
      )}
```

- [ ] **Step 7: Type-check**

Run: `npx tsc --noEmit`
Expected: nenhum erro em nenhum arquivo do projeto.

- [ ] **Step 8: Commit**

```bash
git add components/efetivo/tab-horario.tsx
git commit -m "feat(efetivo): regime de jovem aprendiz no card Horario Vigente e no Alterar Turno"
```

---

### Task 10: Verificação final — build e teste manual

**Files:** nenhum (apenas verificação)

- [ ] **Step 1: Build de produção**

Run: `npm run build`
Expected: build conclui sem erros.

- [ ] **Step 2: Testar atribuição de turno a um jovem aprendiz**

Suba o dev server (`preview_start` com o launch.json existente) e, logado como admin/coordenador, abra o perfil de um funcionário com função **JOVEM APRENDIZ** (ex: qualquer um dos aprendizes lotados em postos SME). Na aba "Horário", clique em "Atribuir Turno"/"Alterar Turno". Confirme: a lista mostra só "Jovem Aprendiz Manhã" e "Jovem Aprendiz Tarde" (badge teal), não os turnos do posto. Selecione um turno — confirme que aparece o campo "Dia de curso" (Segunda a Sexta). Tente salvar sem escolher o dia de curso — confirme o erro "Selecione o dia de curso". Escolha "Quarta" e uma data de início, salve.

- [ ] **Step 3: Testar o card "Horário Vigente"**

Confirme: badge teal "Jovem Aprendiz" no topo; 2 blocos (Entrada/Saída, sem Almoço) com os horários corretos (07:00–11:00 ou 13:00–17:00, conforme o turno escolhido); na grade "Dias de trabalho", o dia escolhido como curso (ex: Quarta) aparece com um ícone de formatura e cor teal, diferente dos outros dias úteis (que ficam na cor do regime) e do fim de semana (cinza, "folga").

- [ ] **Step 4: Testar regressão nos outros regimes**

Repita a atribuição de turno para um funcionário comum (não jovem aprendiz) em posto 5x2/5x1/12x36 — confirme que a lista de turnos continua mostrando os turnos do posto (não os globais de jovem aprendiz), sem o campo "Dia de curso", e que o comportamento é idêntico ao de antes desta mudança.

- [ ] **Step 5: Testar o modal de Turnos do Posto (regressão)**

Abra Postos → Gerenciar → Turnos de um posto sem regime configurado. Confirme que o aviso "posto sem regime" mostra só 3 botões (5x2/5x1/12x36) — **sem** um quarto botão "Jovem Aprendiz".

- [ ] **Step 6: Screenshot de evidência**

Capture o card "Horário Vigente" de um jovem aprendiz (badge teal, grade com o dia de curso marcado) para registro.

- [ ] **Step 7: Commit final (se necessário)**

Se algum ajuste foi feito durante a verificação manual, commitar separadamente. Caso contrário, este task não gera commit.
