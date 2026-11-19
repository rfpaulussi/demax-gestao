# Absenteísmo — Plano 2: Visão Executiva — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir a tela `/relatorios/absenteismo` por uma Visão Executiva baseada no motor do plano 1: filtros globais, 5 KPIs com variação (mês anterior e mesmo mês do ano anterior), evolução mensal, composição por natureza, indicadores (IF, IG, duração média, reincidência), ranking por secretaria e mapa de calor por dia da semana.

**Architecture:** Toda a lógica nova é função pura em `lib/absenteismo/` (testada com `vitest`): parâmetros da URL, períodos comparáveis, composição, ranking, mapa de calor e `montarVisao`. Um orquestrador de servidor (`carregar-visao.ts`) chama `carregarDados` + `montarVisao`. A tela é um Server Component que passa o resultado a componentes de apresentação em `components/absenteismo/` (só os gráficos são `'use client'`, com `recharts`). A tela antiga vai para `/relatorios/absenteismo/legado` (continua com tabelas e exportação Excel/PDF até os planos 3 e 5).

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind, `recharts` 3.8, `lucide-react`, vitest (`npm test` só roda `lib/**/*.test.ts`).

**Spec:** `docs/superpowers/specs/2026-11-19-absenteismo-inteligencia-design.md` (seções 3, 5 e 6, aba "Visão Executiva"). **Plano anterior (já executado):** `docs/superpowers/plans/2026-11-19-absenteismo-motor-de-calculo.md`.

**Onde executar:** worktree `C:\Users\Rodolfo\projetos-claude\demax-gestao\.claude\worktrees\absenteismo-motor` (branch `feat/absenteismo-motor`, já contém o plano 1). Rodar tudo a partir desse diretório.

**Fora do escopo deste plano (planos 3 a 5):** abas Ocorrências/Saúde/Disponibilidade/Qualidade, card de "Tendências e Recomendações", PDF e Excel novos, filtro por natureza. A página mostra uma nota de rodapé dizendo o que não entra na taxa.

**Decisões deste plano (já alinhadas com o spec):**
- Acesso: só `admin` e `coordenador` (mesma regra do menu "Administração"); outros perfis vão para `/dashboard`.
- Filtros: mês, ano, secretaria, posto, supervisor, via `searchParams` (compartilháveis). O ranking por secretaria ignora o filtro de secretaria (para comparar com as demais) mas respeita posto e supervisor.
- Comparativo equivalente: quando o mês atual é parcial por "hoje" (ex.: 1 a 19/11), o mês anterior é cortado no mesmo dia (1 a 19/10), para que contagens sejam comparáveis. O spec é atualizado na Task 7.
- Mesmo mês do ano anterior: aparece como "sem base" enquanto não houver dados (hoje, até jun/2027).
- Mapa de calor conta episódios pelo dia da semana do **início real** do episódio (falta: `data_falta`; atestado: início do primeiro atestado do episódio). Para isso o `Episodio` ganha o campo `inicio_origem` (Task 2).

**Regras do projeto que valem aqui:**
- `createClient()` é síncrono (nunca `await createClient()`).
- Nunca iterar `Set`/`Map` com spread ou `for...of`; usar `Array.from(...)`.
- `tsconfig` sem `target` explícito (ES5 por padrão): nada de `\p{..}`, `Array.prototype.at`, `flatMap` fora do que já compila, etc. Se `tsc` reclamar, ajustar com a menor mudança.
- CPF nunca aparece na tela; aqui só `nome`/`registro`, e a Visão Executiva nem lista pessoas.
- Nunca `git push`; commits locais, um por tarefa.
- Design system: Inter, `bg-slate-50`, cards brancos com borda superior de 4px e `shadow-sm`, labels `uppercase tracking-widest text-xs`, botão primário `bg-slate-900 text-white hover:bg-slate-700`.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `lib/absenteismo/constantes.ts` | `DADOS_DESDE`, nomes de meses |
| `lib/absenteismo/hoje.ts` | Data de hoje no fuso de Brasília |
| `lib/absenteismo/parametros.ts` | Lê `searchParams`, monta query string, anos disponíveis |
| `lib/absenteismo/tipos.ts` + `calculo.ts` | (modificar) `Episodio.inicio_origem` |
| `lib/absenteismo/formatar.ts` | Formatação pt-BR (%, inteiros, variações, rótulos) |
| `lib/absenteismo/composicao.ts` | Fatias por natureza (jornadas, episódios, %) |
| `lib/absenteismo/ranking.ts` | Taxa por secretaria/posto/supervisor |
| `lib/absenteismo/calor.ts` | Episódios por dia da semana × natureza |
| `lib/absenteismo/periodos.ts` | Períodos comparáveis (mês anterior, ano anterior) |
| `lib/absenteismo/visao.ts` | `montarVisao`: junta tudo num objeto `VisaoExecutiva` |
| `lib/absenteismo/carregar-visao.ts` | Orquestrador de servidor (`carregarDados` + `montarVisao`) |
| `components/absenteismo/info-tip.tsx` | Tooltip ⓘ acessível (CSS puro) |
| `components/absenteismo/variacao-badge.tsx` | Seta/cor de variação (queda = bom) |
| `components/absenteismo/kpi-card.tsx` | Card de KPI |
| `components/absenteismo/grafico-evolucao.tsx` | Linha da taxa mensal (`'use client'`) |
| `components/absenteismo/grafico-composicao.tsx` | Rosca por natureza (`'use client'`) |
| `components/absenteismo/indicadores.tsx` | IF, IG, duração média, reincidência |
| `components/absenteismo/ranking-secretaria.tsx` | Tabela de ranking com link de filtro |
| `components/absenteismo/mapa-calor.tsx` | Grade dia da semana × natureza |
| `components/absenteismo/barra-filtros.tsx` | Formulário GET de filtros |
| `components/absenteismo/visao-executiva.tsx` | Composição da tela |
| `app/(admin)/relatorios/absenteismo/page.tsx` | (substituir) página nova |
| `app/(admin)/relatorios/absenteismo/legado/page.tsx` | (mover) página antiga |
| `app/(admin)/relatorios/absenteismo/loading.tsx` / `error.tsx` | Estados de carregamento e erro |

Cada módulo de `lib/` tem `*.test.ts` ao lado. Componentes React não têm teste unitário (o projeto só roda vitest em `lib/`); são validados por `tsc`, `build` e conferência visual na Task 14.

---

### Task 1: Constantes, hoje (Brasília) e parâmetros da tela

**Files:**
- Create: `lib/absenteismo/constantes.ts`, `lib/absenteismo/hoje.ts`, `lib/absenteismo/parametros.ts`
- Test: `lib/absenteismo/hoje.test.ts`, `lib/absenteismo/parametros.test.ts`
- Modify: `scripts/validar-absenteismo.ts` (usar a constante)

- [ ] **Step 1: Escrever os testes que falham**

```ts
// lib/absenteismo/hoje.test.ts
import { describe, it, expect } from 'vitest'
import { hojeBrasilia } from './hoje'

describe('hojeBrasilia', () => {
  it('meio-dia UTC é o mesmo dia em Brasília', () => {
    expect(hojeBrasilia(new Date('2026-11-19T12:00:00Z'))).toBe('2026-11-19')
  })
  it('01:30 UTC ainda é o dia anterior em Brasília (UTC-3)', () => {
    expect(hojeBrasilia(new Date('2026-11-20T01:30:00Z'))).toBe('2026-11-19')
  })
  it('03:00 UTC já é o dia seguinte em Brasília', () => {
    expect(hojeBrasilia(new Date('2026-11-20T03:00:00Z'))).toBe('2026-11-20')
  })
})
```

```ts
// lib/absenteismo/parametros.test.ts
import { describe, it, expect } from 'vitest'
import { anosDisponiveis, lerParametros, montarQuery } from './parametros'

const HOJE = '2026-11-19'

describe('lerParametros', () => {
  it('sem parâmetros: mês e ano de hoje, sem filtros', () => {
    expect(lerParametros({}, HOJE)).toEqual({
      ano: 2026, mes: 11, filtros: { secretaria: null, posto_id: null, supervisor_id: null },
    })
  })
  it('mês válido e ano válido são respeitados', () => {
    expect(lerParametros({ mes: '8', ano: '2026' }, HOJE)).toMatchObject({ ano: 2026, mes: 8 })
  })
  it('mês inválido cai no mês de hoje; mês futuro é limitado ao mês de hoje', () => {
    expect(lerParametros({ mes: '13' }, HOJE).mes).toBe(11)
    expect(lerParametros({ mes: 'abc' }, HOJE).mes).toBe(11)
    expect(lerParametros({ mes: '12' }, HOJE).mes).toBe(11)
  })
  it('ano fora de 2026..ano de hoje cai no ano de hoje', () => {
    expect(lerParametros({ ano: '2025' }, HOJE).ano).toBe(2026)
    expect(lerParametros({ ano: '2030' }, HOJE).ano).toBe(2026)
  })
  it('ano passado sem mês usa dezembro', () => {
    expect(lerParametros({ ano: '2026' }, '2027-02-10')).toMatchObject({ ano: 2026, mes: 12 })
  })
  it('filtros: aparam espaços, vazio vira null, array pega o primeiro', () => {
    expect(lerParametros({ secretaria: ' SME ', posto: '', supervisor: ['s1', 's2'] }, HOJE).filtros).toEqual({
      secretaria: 'SME', posto_id: null, supervisor_id: 's1',
    })
  })
})

describe('montarQuery', () => {
  const p = lerParametros({ secretaria: 'SME', posto: 'p1' }, HOJE)
  it('inclui só o que está preenchido', () => {
    expect(montarQuery(p)).toBe('mes=11&ano=2026&secretaria=SME&posto=p1')
  })
  it('sobrescrever troca ou remove um filtro', () => {
    expect(montarQuery(p, { secretaria: 'SMEL' })).toBe('mes=11&ano=2026&secretaria=SMEL&posto=p1')
    expect(montarQuery(p, { posto_id: null })).toBe('mes=11&ano=2026&secretaria=SME')
  })
})

describe('anosDisponiveis', () => {
  it('de 2026 até o ano de hoje', () => {
    expect(anosDisponiveis('2026-11-19')).toEqual([2026])
    expect(anosDisponiveis('2028-01-05')).toEqual([2026, 2027, 2028])
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run lib/absenteismo/hoje.test.ts lib/absenteismo/parametros.test.ts`
Expected: FAIL com "Failed to load url ./hoje" / "./parametros".

- [ ] **Step 3: Implementar**

```ts
// lib/absenteismo/constantes.ts

/** Primeiro dia com registros de ausência no sistema. Antes disso não há dados (ver spec, seção 2.3). */
export const DADOS_DESDE = '2026-06-18'

export const MESES_PT = [
  '', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

export const MESES_ABREV = ['', 'jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
```

```ts
// lib/absenteismo/hoje.ts

/** Data de hoje (yyyy-mm-dd) no fuso de Brasília. O formato `en-CA` já sai como ano-mês-dia. */
export function hojeBrasilia(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(agora)
}
```

```ts
// lib/absenteismo/parametros.ts
import type { FiltrosAbsenteismo } from './filtros'

export interface ParametrosTela {
  ano: number
  mes: number
  filtros: Required<{ [K in keyof FiltrosAbsenteismo]: string | null }>
}

type SearchParams = { [chave: string]: string | string[] | undefined }

const primeiro = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v)
const limpar = (v: string | undefined): string | null => (v && v.trim() !== '' ? v.trim() : null)

const PRIMEIRO_ANO = 2026

/** Lê e valida mês, ano e filtros da URL. Valores inválidos caem no padrão (mês de hoje). */
export function lerParametros(sp: SearchParams, hoje: string): ParametrosTela {
  const anoHoje = Number(hoje.slice(0, 4))
  const mesHoje = Number(hoje.slice(5, 7))

  let ano = Number(primeiro(sp.ano))
  if (!Number.isInteger(ano) || ano < PRIMEIRO_ANO || ano > anoHoje) ano = anoHoje

  let mes = Number(primeiro(sp.mes))
  if (!Number.isInteger(mes) || mes < 1 || mes > 12) mes = ano === anoHoje ? mesHoje : 12
  if (ano === anoHoje && mes > mesHoje) mes = mesHoje

  return {
    ano,
    mes,
    filtros: {
      secretaria: limpar(primeiro(sp.secretaria)),
      posto_id: limpar(primeiro(sp.posto)),
      supervisor_id: limpar(primeiro(sp.supervisor)),
    },
  }
}

/** Query string da tela (para links). `sobrescrever` troca ou remove (null) filtros. */
export function montarQuery(
  p: ParametrosTela,
  sobrescrever: Partial<ParametrosTela['filtros']> = {},
): string {
  const f = { ...p.filtros, ...sobrescrever }
  const q = new URLSearchParams()
  q.set('mes', String(p.mes))
  q.set('ano', String(p.ano))
  if (f.secretaria) q.set('secretaria', f.secretaria)
  if (f.posto_id) q.set('posto', f.posto_id)
  if (f.supervisor_id) q.set('supervisor', f.supervisor_id)
  return q.toString()
}

export function anosDisponiveis(hoje: string): number[] {
  const anoHoje = Number(hoje.slice(0, 4))
  const out: number[] = []
  for (let a = PRIMEIRO_ANO; a <= anoHoje; a++) out.push(a)
  return out
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run lib/absenteismo/hoje.test.ts lib/absenteismo/parametros.test.ts`
Expected: PASS (todos os testes dos dois arquivos).

- [ ] **Step 5: Usar a constante no script de validação**

Em `scripts/validar-absenteismo.ts`, trocar a linha `const DADOS_DESDE = '2026-06-18'` por nada (apagar) e adicionar, junto aos outros imports do topo, `import { DADOS_DESDE } from '../lib/absenteismo/constantes'`. Depois:

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
git add lib/absenteismo/constantes.ts lib/absenteismo/hoje.ts lib/absenteismo/hoje.test.ts lib/absenteismo/parametros.ts lib/absenteismo/parametros.test.ts scripts/validar-absenteismo.ts
git commit -m "feat(absenteismo): constantes, hoje em Brasilia e parametros da tela

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: `inicio_origem` no Episodio

**Files:**
- Modify: `lib/absenteismo/tipos.ts`, `lib/absenteismo/calculo.ts`
- Test: `lib/absenteismo/calculo.test.ts` (acrescentar no fim)

O episódio guarda `inicio` já cortado ao período. Para o mapa de calor precisamos também do início real do registro.

- [ ] **Step 1: Escrever o teste que falha**

Acrescentar ao final de `lib/absenteismo/calculo.test.ts` (os helpers `base`, `falta` e `atestado` já existem no arquivo):

```ts
describe('calcularPeriodo — inicio_origem', () => {
  it('falta que começou antes do período: inicio recortado, inicio_origem real', () => {
    const r = calcularPeriodo(base({
      inicio: '2026-11-13',
      fim: '2026-11-30',
      faltas: [falta({ data_falta: '2026-11-12', data_fim: '2026-11-16', dias: 5 })],
    }))
    expect(r.episodios[0]).toMatchObject({ inicio: '2026-11-13', inicio_origem: '2026-11-12' })
  })
  it('atestados emendados: inicio_origem é o início do primeiro', () => {
    const r = calcularPeriodo(base({
      atestados: [
        atestado({ id: 'b', data_inicio: '2026-11-05', data_fim: '2026-11-06' }),
        atestado({ id: 'a', data_inicio: '2026-11-03', data_fim: '2026-11-04' }),
      ],
    }))
    expect(r.episodios).toHaveLength(1)
    expect(r.episodios[0].inicio_origem).toBe('2026-11-03')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run lib/absenteismo/calculo.test.ts`
Expected: FAIL nos 2 testes novos (`inicio_origem` é `undefined`).

- [ ] **Step 3: Implementar**

Em `lib/absenteismo/tipos.ts`, na interface `Episodio`, logo depois da linha `fim: string`, acrescentar:

```ts
  /** início real do registro de origem (falta: data_falta; atestado: início do primeiro atestado do episódio), sem corte pelo período. */
  inicio_origem: string
```

Em `lib/absenteismo/calculo.ts` fazer 4 edições:

1. `const origem = new Map<string, { classe: ClasseTaxa; ids: string[]; confirmada: boolean | null }>()` passa a
```ts
    const origem = new Map<string, { classe: ClasseTaxa; ids: string[]; confirmada: boolean | null; inicio_origem: string }>()
```
2. `origem.set(x.id, { classe, ids: [x.id], confirmada: x.confirmada })` passa a
```ts
        origem.set(x.id, { classe, ids: [x.id], confirmada: x.confirmada, inicio_origem: x.data_falta })
```
3. `origem.set(grupo[0].id, { classe: 'atestado', ids: grupo.map(a => a.id), confirmada: null })` passa a
```ts
      origem.set(grupo[0].id, { classe: 'atestado', ids: grupo.map(a => a.id), confirmada: null, inicio_origem: grupo[0].data_inicio })
```
4. No `episodios.push({ ... })`, depois da linha `inicio: dias[0],` acrescentar a linha
```ts
        inicio_origem: o.inicio_origem,
```
(Os atestados do grupo já vêm ordenados por início, então `grupo[0]` é o mais antigo.)

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run lib/absenteismo && npx tsc --noEmit`
Expected: todos os testes de `lib/absenteismo` passam (os 72 anteriores + os 2 novos), tsc sem erros.

- [ ] **Step 5: Commit**

```bash
git add lib/absenteismo/tipos.ts lib/absenteismo/calculo.ts lib/absenteismo/calculo.test.ts
git commit -m "feat(absenteismo): episodio guarda o inicio real do registro de origem

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Formatação pt-BR

**Files:**
- Create: `lib/absenteismo/formatar.ts`
- Test: `lib/absenteismo/formatar.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

```ts
// lib/absenteismo/formatar.test.ts
import { describe, it, expect } from 'vitest'
import { fmtDataBR, fmtDec, fmtInt, fmtPct, fmtPeriodo, fmtVariacaoPct, fmtVariacaoPp, rotuloMes } from './formatar'

describe('formatar', () => {
  it('fmtPct usa vírgula e 2 casas por padrão', () => {
    expect(fmtPct(1.784)).toBe('1,78%')
    expect(fmtPct(0)).toBe('0,00%')
    expect(fmtPct(12.5, 1)).toBe('12,5%')
  })
  it('fmtInt usa ponto de milhar e arredonda', () => {
    expect(fmtInt(10613)).toBe('10.613')
    expect(fmtInt(870.8)).toBe('871')
  })
  it('fmtDec fixa as casas', () => {
    expect(fmtDec(1.94, 1)).toBe('1,9')
    expect(fmtDec(3, 1)).toBe('3,0')
  })
  it('fmtVariacaoPct: sinal, 1 casa, null vira traço', () => {
    expect(fmtVariacaoPct(-9.44)).toBe('−9,4%')
    expect(fmtVariacaoPct(12.25)).toBe('+12,3%')
    expect(fmtVariacaoPct(0)).toBe('0,0%')
    expect(fmtVariacaoPct(null)).toBe('—')
  })
  it('fmtVariacaoPp: pontos percentuais, 2 casas', () => {
    expect(fmtVariacaoPp(-0.4)).toBe('−0,40 p.p.')
    expect(fmtVariacaoPp(1.9)).toBe('+1,90 p.p.')
    expect(fmtVariacaoPp(null)).toBe('—')
  })
  it('rotuloMes e datas', () => {
    expect(rotuloMes('2026-11')).toBe('nov/26')
    expect(rotuloMes('2026-01')).toBe('jan/26')
    expect(fmtDataBR('2026-11-19')).toBe('19/11/2026')
    expect(fmtPeriodo('2026-11-01', '2026-11-19')).toBe('01/11/2026 a 19/11/2026')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run lib/absenteismo/formatar.test.ts`
Expected: FAIL com "Failed to load url ./formatar".

- [ ] **Step 3: Implementar**

```ts
// lib/absenteismo/formatar.ts
import { MESES_ABREV } from './constantes'

const nf = (casas: number) =>
  new Intl.NumberFormat('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })

export function fmtPct(v: number, casas = 2): string {
  return `${nf(casas).format(v)}%`
}

export function fmtInt(v: number): string {
  return nf(0).format(Math.round(v))
}

export function fmtDec(v: number, casas = 1): string {
  return nf(casas).format(v)
}

const sinal = (v: number): string => (v > 0 ? '+' : v < 0 ? '−' : '')

/** Variação relativa ("+12,3%"). null = sem base. */
export function fmtVariacaoPct(v: number | null): string {
  if (v === null) return '—'
  const arredondado = Math.round(v * 10) / 10
  return `${sinal(arredondado)}${fmtDec(Math.abs(arredondado), 1)}%`
}

/** Diferença em pontos percentuais ("−0,40 p.p."). null = sem base. */
export function fmtVariacaoPp(v: number | null): string {
  if (v === null) return '—'
  const arredondado = Math.round(v * 100) / 100
  return `${sinal(arredondado)}${fmtDec(Math.abs(arredondado), 2)} p.p.`
}

/** 'yyyy-mm' -> 'nov/26' */
export function rotuloMes(mes: string): string {
  const [ano, m] = mes.split('-')
  return `${MESES_ABREV[Number(m)]}/${ano.slice(2)}`
}

export function fmtDataBR(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

export function fmtPeriodo(inicio: string, fim: string): string {
  return `${fmtDataBR(inicio)} a ${fmtDataBR(fim)}`
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run lib/absenteismo/formatar.test.ts`
Expected: PASS. Se `fmtVariacaoPct(0)` falhar com `-0,0%`, é o arredondamento de `-0`: confirmar que `sinal(arredondado)` recebe `0` (em JS `-0 > 0` e `-0 < 0` são falsos, então sai vazio).

- [ ] **Step 5: Commit**

```bash
git add lib/absenteismo/formatar.ts lib/absenteismo/formatar.test.ts
git commit -m "feat(absenteismo): formatacao pt-BR de taxas, variacoes e datas

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Composição por natureza

**Files:**
- Create: `lib/absenteismo/composicao.ts`
- Test: `lib/absenteismo/composicao.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

```ts
// lib/absenteismo/composicao.test.ts
import { describe, it, expect } from 'vitest'
import { calcularPeriodo } from './calculo'
import { composicao, ORDEM_CLASSES, ROTULO_CLASSE } from './composicao'
import type { EntradaCalculo } from './tipos'

const entrada: EntradaCalculo = {
  inicio: '2026-11-01',
  fim: '2026-11-30',
  funcionarios: [{
    id: 'f1', nome: 'F', registro: null, admissao: '2020-01-01', desligamento: null, fora_do_quadro: false,
    regime: '5x2', posto_id: null, posto_nome: '—', secretaria: 'SME', supervisor_id: null, supervisor: '—',
  }],
  faltas: [
    { id: 'a', funcionario_id: 'f1', data_falta: '2026-11-03', data_fim: null, dias: 1, tipo: 'sem_justificativa', confirmada: true, observacao: null },
    { id: 'b', funcionario_id: 'f1', data_falta: '2026-11-04', data_fim: null, dias: 1, tipo: 'justificada', confirmada: true, observacao: null },
  ],
  atestados: [{ id: 'at', funcionario_id: 'f1', data_inicio: '2026-11-09', data_fim: '2026-11-10', cid_codigo: null, sem_cid: false, motivo: null }],
  afastamentos: [], ferias: [], suspensoes: [],
}

describe('composicao', () => {
  const fatias = composicao(calcularPeriodo(entrada))

  it('uma fatia por natureza, na ordem fixa', () => {
    expect(fatias.map(f => f.classe)).toEqual(ORDEM_CLASSES)
    expect(fatias.map(f => f.rotulo)).toEqual(ORDEM_CLASSES.map(c => ROTULO_CLASSE[c]))
  })
  it('jornadas, episódios e percentuais', () => {
    expect(fatias.map(f => f.jornadas)).toEqual([1, 1, 2, 0])
    expect(fatias.map(f => f.episodios)).toEqual([1, 1, 1, 0])
    expect(fatias.map(f => f.pct_jornadas)).toEqual([25, 25, 50, 0])
  })
  it('sem ausências: tudo zero, sem NaN', () => {
    const vazio = composicao(calcularPeriodo({ ...entrada, faltas: [], atestados: [] }))
    expect(vazio.map(f => f.pct_jornadas)).toEqual([0, 0, 0, 0])
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run lib/absenteismo/composicao.test.ts`
Expected: FAIL com "Failed to load url ./composicao".

- [ ] **Step 3: Implementar**

```ts
// lib/absenteismo/composicao.ts
import type { ClasseTaxa } from './classificar'
import type { ResultadoCalculo } from './tipos'

export const ORDEM_CLASSES: ClasseTaxa[] = ['falta_injustificada', 'falta_justificada', 'atestado', 'outras']

export const ROTULO_CLASSE: Record<ClasseTaxa, string> = {
  falta_injustificada: 'Faltas injustificadas',
  falta_justificada: 'Faltas justificadas',
  atestado: 'Atestados médicos',
  outras: 'Outras (atrasos etc.)',
}

export interface FatiaComposicao {
  classe: ClasseTaxa
  rotulo: string
  jornadas: number
  episodios: number
  /** participação nas jornadas perdidas, em % */
  pct_jornadas: number
}

export function composicao(r: ResultadoCalculo): FatiaComposicao[] {
  const total = r.jornadas_perdidas
  return ORDEM_CLASSES.map(classe => ({
    classe,
    rotulo: ROTULO_CLASSE[classe],
    jornadas: r.perdidas_por_classe[classe],
    episodios: r.episodios_por_classe[classe],
    pct_jornadas: total > 0 ? (r.perdidas_por_classe[classe] / total) * 100 : 0,
  }))
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run lib/absenteismo/composicao.test.ts`
Expected: PASS (3 testes).

- [ ] **Step 5: Commit**

```bash
git add lib/absenteismo/composicao.ts lib/absenteismo/composicao.test.ts
git commit -m "feat(absenteismo): composicao das ausencias por natureza

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Ranking por secretaria, posto ou supervisor

**Files:**
- Create: `lib/absenteismo/ranking.ts`
- Test: `lib/absenteismo/ranking.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

```ts
// lib/absenteismo/ranking.test.ts
import { describe, it, expect } from 'vitest'
import { rankingPor } from './ranking'
import type { EntradaCalculo, FuncionarioCalc } from './tipos'

const F = (id: string, secretaria: string, over: Partial<FuncionarioCalc> = {}): FuncionarioCalc => ({
  id, nome: id, registro: null, admissao: '2020-01-01', desligamento: null, fora_do_quadro: false,
  regime: '5x2', posto_id: `p-${id}`, posto_nome: `Posto ${id}`, secretaria, supervisor_id: null, supervisor: '—', ...over,
})

const entrada: EntradaCalculo = {
  inicio: '2026-11-01',
  fim: '2026-11-30',
  funcionarios: [F('a', 'SME'), F('b', 'SME'), F('c', 'SMEL'), F('d', 'SMS', { fora_do_quadro: true })],
  faltas: [{ id: 'x', funcionario_id: 'a', data_falta: '2026-11-03', data_fim: null, dias: 1, tipo: 'sem_justificativa', confirmada: true, observacao: null }],
  atestados: [], afastamentos: [], ferias: [], suspensoes: [],
}

describe('rankingPor', () => {
  const linhas = rankingPor('secretaria', entrada)

  it('ordena pela taxa, da maior para a menor', () => {
    expect(linhas.map(l => l.valor)).toEqual(['SME', 'SMEL'])
  })
  it('SME: quadro 2, 1 jornada perdida em 38 programadas', () => {
    expect(linhas[0]).toMatchObject({ valor: 'SME', quadro_medio: 2, jornadas_perdidas: 1, episodios: 1 })
    expect(linhas[0].taxa).toBeCloseTo(100 / 38, 6)
  })
  it('grupo sem ninguém no quadro (fora_do_quadro) não aparece', () => {
    expect(linhas.find(l => l.valor === 'SMS')).toBeUndefined()
  })
  it('agrupa por posto', () => {
    const porPosto = rankingPor('posto_nome', entrada)
    expect(porPosto[0]).toMatchObject({ valor: 'Posto a', jornadas_perdidas: 1 })
    expect(porPosto).toHaveLength(3)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run lib/absenteismo/ranking.test.ts`
Expected: FAIL com "Failed to load url ./ranking".

- [ ] **Step 3: Implementar**

```ts
// lib/absenteismo/ranking.ts
import { calcularPeriodo } from './calculo'
import { calcularKpis } from './kpis'
import type { EntradaCalculo, FuncionarioCalc } from './tipos'

export type ChaveRanking = 'secretaria' | 'posto_nome' | 'supervisor'

export interface LinhaRanking {
  valor: string
  quadro_medio: number
  jornadas_perdidas: number
  episodios: number
  taxa: number
}

/** Calcula o período separadamente para cada grupo de funcionários e ordena pela taxa (maior primeiro). */
export function rankingPor(chave: ChaveRanking, entrada: EntradaCalculo): LinhaRanking[] {
  const grupos = new Map<string, FuncionarioCalc[]>()
  for (const f of entrada.funcionarios) {
    const valor = f[chave]
    const lista = grupos.get(valor)
    if (lista) lista.push(f)
    else grupos.set(valor, [f])
  }

  const linhas: LinhaRanking[] = []
  Array.from(grupos.entries()).forEach(([valor, funcionarios]) => {
    const k = calcularKpis(calcularPeriodo({ ...entrada, funcionarios }))
    if (k.quadro_medio <= 0) return
    linhas.push({
      valor,
      quadro_medio: k.quadro_medio,
      jornadas_perdidas: k.jornadas_perdidas,
      episodios: k.episodios,
      taxa: k.taxa,
    })
  })

  return linhas.sort((a, b) => b.taxa - a.taxa || b.jornadas_perdidas - a.jornadas_perdidas || a.valor.localeCompare(b.valor))
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run lib/absenteismo/ranking.test.ts`
Expected: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
git add lib/absenteismo/ranking.ts lib/absenteismo/ranking.test.ts
git commit -m "feat(absenteismo): ranking de taxa por secretaria, posto ou supervisor

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Mapa de calor (dia da semana × natureza)

**Files:**
- Create: `lib/absenteismo/calor.ts`
- Test: `lib/absenteismo/calor.test.ts`

Conta **episódios** pelo dia da semana do `inicio_origem`, só dos que começaram dentro do período.

- [ ] **Step 1: Escrever o teste que falha**

```ts
// lib/absenteismo/calor.test.ts
import { describe, it, expect } from 'vitest'
import { calcularPeriodo } from './calculo'
import { DIAS_SEMANA, mapaCalor } from './calor'
import type { EntradaCalculo } from './tipos'

const base: EntradaCalculo = {
  inicio: '2026-11-01',
  fim: '2026-11-30',
  funcionarios: [{
    id: 'f1', nome: 'F', registro: null, admissao: '2020-01-01', desligamento: null, fora_do_quadro: false,
    regime: '5x2', posto_id: null, posto_nome: '—', secretaria: 'SME', supervisor_id: null, supervisor: '—',
  }],
  faltas: [], atestados: [], afastamentos: [], ferias: [], suspensoes: [],
}
const falta = (id: string, data: string, tipo = 'sem_justificativa') =>
  ({ id, funcionario_id: 'f1', data_falta: data, data_fim: null, dias: 1, tipo, confirmada: true, observacao: null })

describe('mapaCalor', () => {
  it('rótulos de segunda a domingo', () => {
    expect(DIAS_SEMANA).toEqual(['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'])
  })

  it('conta episódios no dia da semana do início (segunda = 0, domingo = 6)', () => {
    const r = calcularPeriodo({
      ...base,
      faltas: [falta('a', '2026-11-03'), falta('b', '2026-11-09'), falta('c', '2026-11-10')], // ter, seg, ter
      atestados: [{ id: 'at', funcionario_id: 'f1', data_inicio: '2026-11-07', data_fim: '2026-11-08', cid_codigo: null, sem_cid: false, motivo: null }], // sáb
    })
    const linhas = mapaCalor(r)
    const inj = linhas.find(l => l.classe === 'falta_injustificada')!
    const ate = linhas.find(l => l.classe === 'atestado')!
    expect(inj.porDia).toEqual([1, 2, 0, 0, 0, 0, 0])
    expect(inj.total).toBe(3)
    expect(ate.porDia).toEqual([0, 0, 0, 0, 0, 1, 0])
  })

  it('episódio que começou antes do período não entra', () => {
    const r = calcularPeriodo({
      ...base,
      inicio: '2026-11-13',
      faltas: [{ ...falta('a', '2026-11-12'), data_fim: '2026-11-16', dias: 5 }],
    })
    expect(r.episodios).toHaveLength(1)
    expect(mapaCalor(r).every(l => l.total === 0)).toBe(true)
  })

  it('devolve as 4 naturezas mesmo sem dados', () => {
    expect(mapaCalor(calcularPeriodo(base))).toHaveLength(4)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run lib/absenteismo/calor.test.ts`
Expected: FAIL com "Failed to load url ./calor".

- [ ] **Step 3: Implementar**

```ts
// lib/absenteismo/calor.ts
import type { ClasseTaxa } from './classificar'
import { ORDEM_CLASSES, ROTULO_CLASSE } from './composicao'
import { diaSemana } from './datas'
import type { ResultadoCalculo } from './tipos'

export const DIAS_SEMANA = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

export interface LinhaCalor {
  classe: ClasseTaxa
  rotulo: string
  /** índice 0 = segunda ... 6 = domingo */
  porDia: number[]
  total: number
}

export function mapaCalor(r: ResultadoCalculo): LinhaCalor[] {
  const linhas: LinhaCalor[] = ORDEM_CLASSES.map(classe => ({
    classe, rotulo: ROTULO_CLASSE[classe], porDia: [0, 0, 0, 0, 0, 0, 0], total: 0,
  }))
  for (const ep of r.episodios) {
    if (ep.inicio_origem < r.inicio || ep.inicio_origem > r.fim) continue
    const idx = (diaSemana(ep.inicio_origem) + 6) % 7 // getUTCDay: domingo = 0 -> 6; segunda = 1 -> 0
    const linha = linhas.find(l => l.classe === ep.classe)
    if (!linha) continue
    linha.porDia[idx]++
    linha.total++
  }
  return linhas
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run lib/absenteismo/calor.test.ts`
Expected: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
git add lib/absenteismo/calor.ts lib/absenteismo/calor.test.ts
git commit -m "feat(absenteismo): mapa de calor por dia da semana e natureza

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Períodos comparáveis

**Files:**
- Create: `lib/absenteismo/periodos.ts`
- Test: `lib/absenteismo/periodos.test.ts`
- Modify: `docs/superpowers/specs/2026-11-19-absenteismo-inteligencia-design.md` (uma frase)

Regra: o período de comparação começa no dia 1 do mês alvo e termina no mesmo "dia" que o atual (se o atual é parcial por hoje) ou no fim do mês alvo. Se o alvo cai (em parte) antes de `DADOS_DESDE`, não há base completa: devolve `null`.

- [ ] **Step 1: Escrever o teste que falha**

```ts
// lib/absenteismo/periodos.test.ts
import { describe, it, expect } from 'vitest'
import { periodoAnoAnterior, periodoAnterior } from './periodos'

const DESDE = '2026-06-18'

describe('periodoAnterior', () => {
  it('mês corrente parcial (1 a 19/11): compara com 1 a 19/10', () => {
    expect(periodoAnterior({ inicio: '2026-11-01', fim: '2026-11-19' }, 2026, 11, DESDE, '2026-11-19'))
      .toEqual({ inicio: '2026-10-01', fim: '2026-10-19' })
  })
  it('mês cheio: compara com o mês anterior inteiro', () => {
    expect(periodoAnterior({ inicio: '2026-10-01', fim: '2026-10-31' }, 2026, 10, DESDE, '2026-11-19'))
      .toEqual({ inicio: '2026-09-01', fim: '2026-09-30' })
  })
  it('mês anterior que começa antes de 18/06 não tem base completa', () => {
    expect(periodoAnterior({ inicio: '2026-07-01', fim: '2026-07-31' }, 2026, 7, DESDE, '2026-11-19')).toBeNull()
  })
  it('mês parcial por dadosDesde (junho) não tem anterior', () => {
    expect(periodoAnterior({ inicio: '2026-06-18', fim: '2026-06-30' }, 2026, 6, DESDE, '2026-11-19')).toBeNull()
  })
  it('atravessa a virada de ano', () => {
    expect(periodoAnterior({ inicio: '2027-01-01', fim: '2027-01-31' }, 2027, 1, DESDE, '2027-03-01'))
      .toEqual({ inicio: '2026-12-01', fim: '2026-12-31' })
  })
})

describe('periodoAnoAnterior', () => {
  it('sem dados do ano passado hoje: null', () => {
    expect(periodoAnoAnterior({ inicio: '2026-11-01', fim: '2026-11-19' }, 2026, 11, DESDE, '2026-11-19')).toBeNull()
  })
  it('quando existir base (jul/2027 comparado a jul/2026): corta no mesmo dia', () => {
    expect(periodoAnoAnterior({ inicio: '2027-07-01', fim: '2027-07-10' }, 2027, 7, DESDE, '2027-07-10'))
      .toEqual({ inicio: '2026-07-01', fim: '2026-07-10' })
  })
  it('mês cheio de 2027 com base completa em 2026', () => {
    expect(periodoAnoAnterior({ inicio: '2027-08-01', fim: '2027-08-31' }, 2027, 8, DESDE, '2027-09-05'))
      .toEqual({ inicio: '2026-08-01', fim: '2026-08-31' })
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run lib/absenteismo/periodos.test.ts`
Expected: FAIL com "Failed to load url ./periodos".

- [ ] **Step 3: Implementar**

```ts
// lib/absenteismo/periodos.ts
import { addDias, diffDias, mesAnterior, minData, periodoDoMes } from './datas'
import { periodoEfetivo } from './series'

export interface Intervalo {
  inicio: string
  fim: string
}

/**
 * Período equivalente no mês `alvo`: começa no dia 1 e, se o período atual é parcial por `hoje`
 * (termina antes do fim do mês), termina no mesmo dia relativo. Devolve null quando o alvo não tem
 * base completa (começa antes de `dadosDesde` ou termina depois de `hoje`).
 */
function equivalente(
  alvo: { ano: number; mes: number },
  ano: number,
  mes: number,
  atual: Intervalo,
  dadosDesde: string,
  hoje: string,
): Intervalo | null {
  const cheioAlvo = periodoDoMes(alvo.ano, alvo.mes)
  const cheioAtual = periodoDoMes(ano, mes)
  const truncado = atual.fim < cheioAtual.fim
  const fimAlvo = truncado
    ? minData(cheioAlvo.fim, addDias(cheioAlvo.inicio, diffDias(atual.inicio, atual.fim)))
    : cheioAlvo.fim
  const p = periodoEfetivo(cheioAlvo.inicio, fimAlvo, dadosDesde, hoje)
  if (!p || p.inicio !== cheioAlvo.inicio) return null
  return { inicio: p.inicio, fim: p.fim }
}

export function periodoAnterior(atual: Intervalo, ano: number, mes: number, dadosDesde: string, hoje: string): Intervalo | null {
  return equivalente(mesAnterior(ano, mes), ano, mes, atual, dadosDesde, hoje)
}

export function periodoAnoAnterior(atual: Intervalo, ano: number, mes: number, dadosDesde: string, hoje: string): Intervalo | null {
  return equivalente({ ano: ano - 1, mes }, ano, mes, atual, dadosDesde, hoje)
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run lib/absenteismo/periodos.test.ts`
Expected: PASS (8 testes).

- [ ] **Step 5: Registrar a regra no spec**

No arquivo do spec, na linha que começa com `- **Variação** =`, trocar o trecho `Período anterior = mês imediatamente anterior completo;` por `Período anterior = mês imediatamente anterior (cortado no mesmo dia do mês quando o mês atual é parcial por "hoje", para comparar períodos equivalentes);`.

- [ ] **Step 6: Commit**

```bash
git add lib/absenteismo/periodos.ts lib/absenteismo/periodos.test.ts docs/superpowers/specs/2026-11-19-absenteismo-inteligencia-design.md
git commit -m "feat(absenteismo): periodos comparaveis (mes anterior e ano anterior)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 8: `montarVisao`

**Files:**
- Create: `lib/absenteismo/visao.ts`
- Test: `lib/absenteismo/visao.test.ts`

Calendário de referência (usado nas expectativas): em **novembro/2026** (1 a 19/11) cada funcionário de 5x2 tem **13** dias programados. Em **outubro/2026** (1 a 19/10) tem **12** (feriado em 12/10).

- [ ] **Step 1: Escrever o teste que falha**

```ts
// lib/absenteismo/visao.test.ts
import { describe, it, expect } from 'vitest'
import { compararKpis, montarVisao } from './visao'
import { calcularKpis } from './kpis'
import { calcularPeriodo } from './calculo'
import type { DadosAbsenteismo, FuncionarioCalc } from './tipos'

const F = (id: string, secretaria: string, over: Partial<FuncionarioCalc> = {}): FuncionarioCalc => ({
  id, nome: id, registro: null, admissao: '2020-01-01', desligamento: null, fora_do_quadro: false,
  regime: '5x2', posto_id: `p-${id}`, posto_nome: `Posto ${id}`, secretaria, supervisor_id: null, supervisor: '—', ...over,
})
const falta = (id: string, funcionario_id: string, data: string) =>
  ({ id, funcionario_id, data_falta: data, data_fim: null, dias: 1, tipo: 'sem_justificativa', confirmada: true, observacao: null })

const dados: DadosAbsenteismo = {
  funcionarios: [F('f1', 'SME'), F('f2', 'SMEL')],
  faltas: [falta('n1', 'f1', '2026-11-03'), falta('o1', 'f1', '2026-10-06'), falta('o2', 'f1', '2026-10-07')],
  atestados: [], afastamentos: [], ferias: [], suspensoes: [],
}
const HOJE = '2026-11-19'

describe('montarVisao — novembro/2026 (parcial até 19/11)', () => {
  const v = montarVisao({ dados, filtros: { secretaria: null, posto_id: null, supervisor_id: null }, ano: 2026, mes: 11, hoje: HOJE })

  it('período parcial e sem "semDados"', () => {
    expect(v.periodo).toEqual({ inicio: '2026-11-01', fim: '2026-11-19', parcial: true })
    expect(v.semDados).toBe(false)
  })
  it('KPIs do mês: 1 falta em 26 jornadas programadas, quadro 2', () => {
    expect(v.kpis.jornadas_perdidas).toBe(1)
    expect(v.jornadas_programadas).toBe(26)
    expect(v.kpis.taxa).toBeCloseTo(100 / 26, 6)
    expect(v.kpis.quadro_medio).toBe(2)
    expect(v.kpis.indice_frequencia).toBeCloseTo(50, 6)
  })
  it('compara com 1 a 19/10 (2 faltas em 24 jornadas)', () => {
    expect(v.vsMesAnterior?.periodo).toEqual({ inicio: '2026-10-01', fim: '2026-10-19' })
    expect(v.vsMesAnterior?.kpis.taxa).toBeCloseTo(200 / 24, 6)
    expect(v.vsMesAnterior?.variacoes.taxa_pp).toBeCloseTo(100 / 26 - 200 / 24, 6)
    expect(v.vsMesAnterior?.variacoes.jornadas_perdidas_pct).toBeCloseTo(-50, 6)
    expect(v.vsMesAnterior?.variacoes.afetados_pct).toBeCloseTo(0, 6)
  })
  it('ano anterior sem base', () => {
    expect(v.vsAnoAnterior).toBeNull()
  })
  it('série de 12 meses: os 5 primeiros sem dados, junho parcial, novembro parcial', () => {
    expect(v.serie).toHaveLength(12)
    expect(v.serie[0]).toMatchObject({ mes: '2025-12', taxa: null })
    expect(v.serie[4]).toMatchObject({ mes: '2026-04', taxa: null })
    expect(v.serie[6]).toMatchObject({ mes: '2026-06', parcial: true })
    expect(v.serie[11]).toMatchObject({ mes: '2026-11', parcial: true })
  })
  it('composição, ranking e calor', () => {
    expect(v.composicao[0]).toMatchObject({ classe: 'falta_injustificada', jornadas: 1 })
    expect(v.ranking.map(l => l.valor)).toEqual(['SME', 'SMEL'])
    expect(v.calor.find(l => l.classe === 'falta_injustificada')?.porDia).toEqual([0, 1, 0, 0, 0, 0, 0]) // 03/11 é terça
  })
  it('opções de filtro vêm do quadro, ordenadas', () => {
    expect(v.opcoes.secretarias).toEqual(['SME', 'SMEL'])
    expect(v.opcoes.postos.map(p => p.nome)).toEqual(['Posto f1', 'Posto f2'])
    expect(v.opcoes.supervisores).toEqual([])
  })
})

describe('montarVisao — filtros e casos de borda', () => {
  it('filtro de secretaria restringe os KPIs, mas o ranking continua comparando as secretarias', () => {
    const v = montarVisao({ dados, filtros: { secretaria: 'SMEL', posto_id: null, supervisor_id: null }, ano: 2026, mes: 11, hoje: HOJE })
    expect(v.kpis.jornadas_perdidas).toBe(0)
    expect(v.kpis.quadro_medio).toBe(1)
    expect(v.ranking.map(l => l.valor)).toEqual(['SME', 'SMEL'])
  })
  it('mês antes de 18/06/2026: sem dados', () => {
    const v = montarVisao({ dados, filtros: { secretaria: null, posto_id: null, supervisor_id: null }, ano: 2026, mes: 5, hoje: HOJE })
    expect(v.semDados).toBe(true)
    expect(v.vsMesAnterior).toBeNull()
    expect(v.ranking).toEqual([])
    expect(v.kpis.taxa).toBe(0)
  })
})

describe('compararKpis', () => {
  const kpisDe = (faltasExtras: number) => {
    const r = calcularPeriodo({
      inicio: '2026-11-01', fim: '2026-11-30', funcionarios: [F('f1', 'SME')],
      faltas: Array.from({ length: faltasExtras }, (_, i) => falta(`x${i}`, 'f1', `2026-11-0${i + 3}`)),
      atestados: [], afastamentos: [], ferias: [], suspensoes: [],
    })
    return calcularKpis(r)
  }
  it('percentual relativo nas contagens, null sem base', () => {
    const v = compararKpis(kpisDe(2), kpisDe(1))
    expect(v.jornadas_perdidas_pct).toBeCloseTo(100, 6)
    expect(v.episodios_pct).toBeCloseTo(100, 6)
    expect(compararKpis(kpisDe(1), kpisDe(0)).jornadas_perdidas_pct).toBeNull()
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run lib/absenteismo/visao.test.ts`
Expected: FAIL com "Failed to load url ./visao".

- [ ] **Step 3: Implementar**

```ts
// lib/absenteismo/visao.ts
import { calcularPeriodo } from './calculo'
import { calcularKpis, variacaoPercentual, variacaoPontos, type Kpis } from './kpis'
import { composicao, type FatiaComposicao } from './composicao'
import { mapaCalor, type LinhaCalor } from './calor'
import { DADOS_DESDE } from './constantes'
import { periodoDoMes } from './datas'
import { filtrarFuncionarios, type FiltrosAbsenteismo } from './filtros'
import { periodoAnoAnterior, periodoAnterior, type Intervalo } from './periodos'
import { rankingPor, type LinhaRanking } from './ranking'
import { calcularSerieMensal, mesesAte, periodoEfetivo, type PontoSerie } from './series'
import type { DadosAbsenteismo } from './tipos'

export interface VariacoesKpis {
  /** diferença em pontos percentuais */
  taxa_pp: number
  jornadas_perdidas_pct: number | null
  episodios_pct: number | null
  afetados_pct: number | null
  indice_frequencia_pct: number | null
  indice_gravidade_pct: number | null
  duracao_media_pct: number | null
  /** diferença em pontos percentuais */
  reincidencia_pp: number
}

export interface Comparativo {
  periodo: Intervalo
  kpis: Kpis
  variacoes: VariacoesKpis
}

export interface OpcoesFiltro {
  secretarias: string[]
  postos: { id: string; nome: string }[]
  supervisores: { id: string; nome: string }[]
}

export interface VisaoExecutiva {
  mes: number
  ano: number
  periodo: Intervalo & { parcial: boolean }
  /** true quando o mês não tem dados (antes de 18/06/2026, no futuro) ou o recorte não tem quadro */
  semDados: boolean
  kpis: Kpis
  jornadas_programadas: number
  vsMesAnterior: Comparativo | null
  vsAnoAnterior: Comparativo | null
  serie: PontoSerie[]
  composicao: FatiaComposicao[]
  ranking: LinhaRanking[]
  calor: LinhaCalor[]
  opcoes: OpcoesFiltro
}

export function compararKpis(atual: Kpis, anterior: Kpis): VariacoesKpis {
  return {
    taxa_pp: variacaoPontos(atual.taxa, anterior.taxa),
    jornadas_perdidas_pct: variacaoPercentual(atual.jornadas_perdidas, anterior.jornadas_perdidas),
    episodios_pct: variacaoPercentual(atual.episodios, anterior.episodios),
    afetados_pct: variacaoPercentual(atual.funcionarios_afetados, anterior.funcionarios_afetados),
    indice_frequencia_pct: variacaoPercentual(atual.indice_frequencia, anterior.indice_frequencia),
    indice_gravidade_pct: variacaoPercentual(atual.indice_gravidade, anterior.indice_gravidade),
    duracao_media_pct: variacaoPercentual(atual.duracao_media, anterior.duracao_media),
    reincidencia_pp: variacaoPontos(atual.taxa_reincidencia, anterior.taxa_reincidencia),
  }
}

function montarOpcoes(dados: DadosAbsenteismo): OpcoesFiltro {
  const secretarias = new Set<string>()
  const postos = new Map<string, string>()
  const supervisores = new Map<string, string>()
  for (const f of dados.funcionarios) {
    if (f.fora_do_quadro) continue
    if (f.secretaria && f.secretaria !== '—') secretarias.add(f.secretaria)
    if (f.posto_id) postos.set(f.posto_id, f.posto_nome)
    if (f.supervisor_id) supervisores.set(f.supervisor_id, f.supervisor)
  }
  const porNome = (a: { nome: string }, b: { nome: string }) => a.nome.localeCompare(b.nome, 'pt-BR')
  return {
    secretarias: Array.from(secretarias).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    postos: Array.from(postos.entries()).map(([id, nome]) => ({ id, nome })).sort(porNome),
    supervisores: Array.from(supervisores.entries()).map(([id, nome]) => ({ id, nome })).sort(porNome),
  }
}

/**
 * Monta tudo que a Visão Executiva mostra, a partir dos dados já carregados.
 * `dados` deve cobrir ao menos 13 meses para trás do mês pedido (ou desde DADOS_DESDE) para a série e o ano anterior.
 */
export function montarVisao(entrada: {
  dados: DadosAbsenteismo
  filtros: FiltrosAbsenteismo
  ano: number
  mes: number
  hoje: string
}): VisaoExecutiva {
  const { dados, filtros, ano, mes, hoje } = entrada
  const dadosF: DadosAbsenteismo = { ...dados, funcionarios: filtrarFuncionarios(dados.funcionarios, filtros) }

  const cheio = periodoDoMes(ano, mes)
  const efetivo = periodoEfetivo(cheio.inicio, cheio.fim, DADOS_DESDE, hoje)
  const periodo = efetivo ?? { inicio: cheio.inicio, fim: cheio.fim, parcial: false }

  const calcular = (d: DadosAbsenteismo, i: Intervalo) => calcularPeriodo({ ...d, inicio: i.inicio, fim: i.fim })

  const atual = efetivo ? calcular(dadosF, periodo) : calcular({ ...dadosF, funcionarios: [] }, periodo)
  const kpis = calcularKpis(atual)

  const comparar = (i: Intervalo | null): Comparativo | null => {
    if (!i || !efetivo) return null
    const k = calcularKpis(calcular(dadosF, i))
    return { periodo: i, kpis: k, variacoes: compararKpis(kpis, k) }
  }

  const vsMesAnterior = comparar(efetivo ? periodoAnterior(periodo, ano, mes, DADOS_DESDE, hoje) : null)
  const vsAnoAnterior = comparar(efetivo ? periodoAnoAnterior(periodo, ano, mes, DADOS_DESDE, hoje) : null)

  // o ranking compara as secretarias entre si: ignora só o filtro de secretaria
  const paraRanking = { ...dados, funcionarios: filtrarFuncionarios(dados.funcionarios, { ...filtros, secretaria: null }) }

  return {
    mes,
    ano,
    periodo,
    semDados: !efetivo || atual.quadro_medio === 0,
    kpis,
    jornadas_programadas: atual.jornadas_programadas,
    vsMesAnterior,
    vsAnoAnterior,
    serie: calcularSerieMensal(dadosF, mesesAte(ano, mes, 12), DADOS_DESDE, hoje),
    composicao: composicao(atual),
    ranking: efetivo ? rankingPor('secretaria', { ...paraRanking, inicio: periodo.inicio, fim: periodo.fim }) : [],
    calor: mapaCalor(atual),
    opcoes: montarOpcoes(dados),
  }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run lib/absenteismo/visao.test.ts && npx tsc --noEmit`
Expected: PASS e tsc sem erros. Se a expectativa `serie[6]` (junho) falhar, conferir a posição: a série vai de 2025-12 (índice 0) a 2026-11 (índice 11); junho/2026 é o índice 6.

- [ ] **Step 5: Commit**

```bash
git add lib/absenteismo/visao.ts lib/absenteismo/visao.test.ts
git commit -m "feat(absenteismo): montarVisao agrega KPIs, comparativos, serie, ranking e calor

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Orquestrador de servidor

**Files:**
- Create: `lib/absenteismo/carregar-visao.ts`

Sem teste unitário (depende do banco); validado por `tsc` aqui e pela tela na Task 14.

- [ ] **Step 1: Criar o orquestrador**

```ts
// lib/absenteismo/carregar-visao.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { carregarDados } from './carregar'
import { DADOS_DESDE } from './constantes'
import { maxData, minData, periodoDoMes } from './datas'
import type { FiltrosAbsenteismo } from './filtros'
import { mesesAte } from './series'
import { montarVisao, type VisaoExecutiva } from './visao'

/**
 * Carrega os dados necessários (do mesmo mês do ano anterior até o mês pedido, nunca antes de DADOS_DESDE
 * e nunca depois de hoje) e monta a Visão Executiva.
 */
export async function carregarVisao(
  supabase: SupabaseClient<Database>,
  filtros: FiltrosAbsenteismo,
  ano: number,
  mes: number,
  hoje: string,
): Promise<VisaoExecutiva> {
  const maisAntigo = mesesAte(ano, mes, 13)[0]
  const fim = minData(periodoDoMes(ano, mes).fim, hoje)
  const inicio = minData(maxData(periodoDoMes(maisAntigo.ano, maisAntigo.mes).inicio, DADOS_DESDE), fim)
  const dados = await carregarDados(supabase, { inicio, fim })
  return montarVisao({ dados, filtros, ano, mes, hoje })
}
```

- [ ] **Step 2: Compilar**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add lib/absenteismo/carregar-visao.ts
git commit -m "feat(absenteismo): orquestrador que carrega os dados e monta a visao executiva

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Primitivos de UI (tooltip, variação, card de KPI)

**Files:**
- Create: `components/absenteismo/info-tip.tsx`, `components/absenteismo/variacao-badge.tsx`, `components/absenteismo/kpi-card.tsx`

Todos são Server Components (sem estado). O tooltip é CSS puro: aparece no hover e no foco do teclado.

- [ ] **Step 1: Criar `info-tip.tsx`**

```tsx
// components/absenteismo/info-tip.tsx
import { Info } from 'lucide-react'

/** Ícone ⓘ com explicação. Abre no hover e no foco (teclado); o texto também vai no aria-label. */
export function InfoTip({ texto }: { texto: string }) {
  return (
    <span className="group relative inline-flex align-middle">
      <button
        type="button"
        aria-label={texto}
        className="rounded text-gray-300 hover:text-gray-500 focus:outline-none focus-visible:ring-1 focus-visible:ring-gray-400"
      >
        <Info className="h-3.5 w-3.5" aria-hidden />
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-20 mt-1.5 hidden w-60 -translate-x-1/2 rounded-lg bg-slate-900 px-3 py-2 text-left text-xs font-normal normal-case leading-snug tracking-normal text-white shadow-lg group-focus-within:block group-hover:block"
      >
        {texto}
      </span>
    </span>
  )
}
```

- [ ] **Step 2: Criar `variacao-badge.tsx`**

Para ausências, queda é bom (verde) e alta é ruim (vermelho).

```tsx
// components/absenteismo/variacao-badge.tsx
import { ArrowDown, ArrowUp, Minus } from 'lucide-react'
import { fmtVariacaoPct, fmtVariacaoPp } from '@/lib/absenteismo/formatar'

interface Props {
  /** null = sem base de comparação */
  valor: number | null
  /** 'pct' = variação relativa; 'pp' = pontos percentuais (taxas) */
  tipo: 'pct' | 'pp'
  /** ex.: "vs out/26" */
  rotulo: string
}

export function VariacaoBadge({ valor, tipo, rotulo }: Props) {
  if (valor === null) {
    return <p className="mt-1 text-xs text-gray-300">sem base {rotulo}</p>
  }
  const direcao = Math.abs(valor) < 0.005 ? 0 : valor > 0 ? 1 : -1
  const cor = direcao < 0 ? 'text-emerald-600' : direcao > 0 ? 'text-red-600' : 'text-gray-400'
  const Icone = direcao < 0 ? ArrowDown : direcao > 0 ? ArrowUp : Minus
  const texto = tipo === 'pct' ? fmtVariacaoPct(valor) : fmtVariacaoPp(valor)
  return (
    <p className={`mt-1 flex flex-wrap items-center gap-1 text-xs ${cor}`}>
      <Icone className="h-3 w-3" aria-hidden />
      <span className="font-semibold">{texto}</span>
      <span className="text-gray-400">{rotulo}</span>
    </p>
  )
}
```

- [ ] **Step 3: Criar `kpi-card.tsx`**

```tsx
// components/absenteismo/kpi-card.tsx
import type { ReactNode } from 'react'
import { InfoTip } from './info-tip'

interface Props {
  titulo: string
  valor: string
  /** explicação da fórmula, mostrada no tooltip */
  dica: string
  /** classe completa da borda superior, ex.: "border-t-orange-500" */
  cor: string
  children?: ReactNode
}

export function KpiCard({ titulo, valor, dica, cor, children }: Props) {
  return (
    <div className={`rounded-xl border border-gray-100 border-t-4 ${cor} bg-white p-4 shadow-sm`}>
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-gray-500">
        {titulo}
        <InfoTip texto={dica} />
      </p>
      <p className="mt-1.5 text-2xl font-black tracking-tight text-gray-900">{valor}</p>
      {children}
    </div>
  )
}
```

- [ ] **Step 4: Compilar**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 5: Commit**

```bash
git add components/absenteismo/info-tip.tsx components/absenteismo/variacao-badge.tsx components/absenteismo/kpi-card.tsx
git commit -m "feat(absenteismo): componentes base de UI (tooltip, variacao, card de KPI)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Gráficos (evolução e composição)

**Files:**
- Create: `components/absenteismo/grafico-evolucao.tsx`, `components/absenteismo/grafico-composicao.tsx`

Os dois são `'use client'` (recharts). Seguem o padrão de `components/dashboard/evolucao-efetivo.tsx` (`ResponsiveContainer` com altura fixa).

- [ ] **Step 1: Criar `grafico-evolucao.tsx`**

Mostra só os meses com dados; marca meses parciais com `*`.

```tsx
// components/absenteismo/grafico-evolucao.tsx
'use client'

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { DADOS_DESDE } from '@/lib/absenteismo/constantes'
import { fmtDataBR, fmtPct, rotuloMes } from '@/lib/absenteismo/formatar'
import type { PontoSerie } from '@/lib/absenteismo/series'

export function GraficoEvolucao({ serie }: { serie: PontoSerie[] }) {
  const pontos = serie
    .filter(p => p.taxa !== null)
    .map(p => ({
      rotulo: rotuloMes(p.mes) + (p.parcial ? '*' : ''),
      taxa: Math.round((p.taxa as number) * 100) / 100,
    }))

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-gray-500">
        Evolução da taxa de absenteísmo
      </p>
      {pontos.length === 0 ? (
        <p className="py-10 text-center text-sm text-gray-400">Sem dados no período.</p>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={pontos} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="rotulo" fontSize={11} tickLine={false} />
            <YAxis fontSize={11} width={44} tickLine={false} tickFormatter={v => `${v}%`} domain={[0, 'auto']} />
            <Tooltip formatter={v => [fmtPct(Number(v)), 'Taxa']} />
            <Line type="monotone" dataKey="taxa" stroke="#ea580c" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      )}
      <p className="mt-3 text-xs text-gray-400">
        Histórico disponível a partir de {fmtDataBR(DADOS_DESDE)}. * mês parcial (começa em {fmtDataBR(DADOS_DESDE)} ou
        ainda está em andamento).
      </p>
    </div>
  )
}
```

- [ ] **Step 2: Criar `grafico-composicao.tsx`**

```tsx
// components/absenteismo/grafico-composicao.tsx
'use client'

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import type { ClasseTaxa } from '@/lib/absenteismo/classificar'
import type { FatiaComposicao } from '@/lib/absenteismo/composicao'
import { fmtInt, fmtPct } from '@/lib/absenteismo/formatar'

const COR: Record<ClasseTaxa, string> = {
  falta_injustificada: '#dc2626',
  falta_justificada: '#f59e0b',
  atestado: '#3b82f6',
  outras: '#94a3b8',
}

export function GraficoComposicao({ fatias, total }: { fatias: FatiaComposicao[]; total: number }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-gray-500">Composição das ausências</p>
      {total === 0 ? (
        <p className="py-10 text-center text-sm text-gray-400">Nenhuma jornada perdida no período.</p>
      ) : (
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <div className="relative h-40 w-40 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={fatias} dataKey="jornadas" nameKey="rotulo" innerRadius={50} outerRadius={72} paddingAngle={2} stroke="none">
                  {fatias.map(f => (
                    <Cell key={f.classe} fill={COR[f.classe]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v, nome) => [`${fmtInt(Number(v))} jornadas`, String(nome)]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-black text-gray-900">{fmtInt(total)}</span>
              <span className="text-[10px] uppercase tracking-widest text-gray-400">jornadas</span>
            </div>
          </div>
          <ul className="w-full space-y-2 text-sm">
            {fatias.map(f => (
              <li key={f.classe} className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-gray-600">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COR[f.classe] }} aria-hidden />
                  {f.rotulo}
                </span>
                <span className="whitespace-nowrap text-gray-900">
                  <strong>{fmtPct(f.pct_jornadas, 1)}</strong>{' '}
                  <span className="text-xs text-gray-400">({fmtInt(f.jornadas)} · {fmtInt(f.episodios)} ep.)</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Compilar**

Run: `npx tsc --noEmit`
Expected: sem erros. Se o `formatter` do recharts v3 reclamar de tipo, ajustar só a assinatura (por exemplo `(v: unknown) => [...]`), sem mudar o comportamento.

- [ ] **Step 4: Commit**

```bash
git add components/absenteismo/grafico-evolucao.tsx components/absenteismo/grafico-composicao.tsx
git commit -m "feat(absenteismo): graficos de evolucao mensal e composicao por natureza

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Indicadores, ranking e mapa de calor

**Files:**
- Create: `components/absenteismo/indicadores.tsx`, `components/absenteismo/ranking-secretaria.tsx`, `components/absenteismo/mapa-calor.tsx`

Server Components.

- [ ] **Step 1: Criar `indicadores.tsx`**

```tsx
// components/absenteismo/indicadores.tsx
import type { Kpis } from '@/lib/absenteismo/kpis'
import { fmtDec } from '@/lib/absenteismo/formatar'
import type { Comparativo } from '@/lib/absenteismo/visao'
import { InfoTip } from './info-tip'
import { VariacaoBadge } from './variacao-badge'

interface Props {
  kpis: Kpis
  vs: Comparativo | null
  rotuloVs: string
}

export function Indicadores({ kpis, vs, rotuloVs }: Props) {
  const v = vs?.variacoes
  const linhas = [
    {
      titulo: 'Índice de frequência (IF)',
      dica: 'Episódios ÷ quadro médio × 100. Quantas ausências ocorreram para cada 100 funcionários no período.',
      valor: fmtDec(kpis.indice_frequencia, 1),
      variacao: v?.indice_frequencia_pct ?? null,
      tipo: 'pct' as const,
    },
    {
      titulo: 'Índice de gravidade (IG)',
      dica: 'Jornadas perdidas ÷ quadro médio × 100. Quantas jornadas de trabalho foram perdidas para cada 100 funcionários.',
      valor: fmtDec(kpis.indice_gravidade, 1),
      variacao: v?.indice_gravidade_pct ?? null,
      tipo: 'pct' as const,
    },
    {
      titulo: 'Duração média por ocorrência',
      dica: 'Jornadas perdidas ÷ episódios. Quanto dura, em média, cada ausência.',
      valor: `${fmtDec(kpis.duracao_media, 1)} jornadas`,
      variacao: v?.duracao_media_pct ?? null,
      tipo: 'pct' as const,
    },
    {
      titulo: 'Taxa de reincidência',
      dica: 'Funcionários com 2 ou mais episódios no período ÷ funcionários afetados × 100.',
      valor: `${fmtDec(kpis.taxa_reincidencia, 1)}%`,
      variacao: v?.reincidencia_pp ?? null,
      tipo: 'pp' as const,
    },
  ]

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-gray-500">Principais indicadores</p>
      <dl className="divide-y divide-gray-100">
        {linhas.map(l => (
          <div key={l.titulo} className="py-2.5 first:pt-0 last:pb-0">
            <div className="flex items-center justify-between gap-3">
              <dt className="flex items-center gap-1.5 text-sm text-gray-600">
                {l.titulo}
                <InfoTip texto={l.dica} />
              </dt>
              <dd className="text-base font-bold text-gray-900">{l.valor}</dd>
            </div>
            <VariacaoBadge valor={l.variacao} tipo={l.tipo} rotulo={rotuloVs} />
          </div>
        ))}
      </dl>
    </div>
  )
}
```

- [ ] **Step 2: Criar `ranking-secretaria.tsx`**

Cada linha é um link que filtra a tela pela secretaria (mantendo mês, ano e demais filtros).

```tsx
// components/absenteismo/ranking-secretaria.tsx
import Link from 'next/link'
import { fmtInt, fmtPct } from '@/lib/absenteismo/formatar'
import { montarQuery, type ParametrosTela } from '@/lib/absenteismo/parametros'
import type { LinhaRanking } from '@/lib/absenteismo/ranking'
import { InfoTip } from './info-tip'

interface Props {
  linhas: LinhaRanking[]
  taxaGeral: number
  params: ParametrosTela
}

export function RankingSecretaria({ linhas, taxaGeral, params }: Props) {
  const maior = Math.max(...linhas.map(l => l.taxa), 0.0001)
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      <p className="mb-4 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-gray-500">
        Ranking por secretaria
        <InfoTip texto="Taxa de absenteísmo de cada secretaria no período, calculada sobre o quadro dela (não sobre o número bruto de faltas). Clique numa linha para filtrar a tela." />
      </p>
      {linhas.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-400">Sem dados no período.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: '420px' }}>
            <thead>
              <tr className="text-left text-xs uppercase tracking-widest text-gray-400">
                <th className="pb-2 pr-2 font-semibold">#</th>
                <th className="pb-2 pr-2 font-semibold">Secretaria</th>
                <th className="pb-2 pr-2 text-right font-semibold">Quadro</th>
                <th className="pb-2 pr-2 text-right font-semibold">Jornadas</th>
                <th className="pb-2 font-semibold">Taxa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {linhas.map((l, i) => {
                const ativa = params.filtros.secretaria === l.valor
                const acima = taxaGeral > 0 && l.taxa > taxaGeral * 1.5
                return (
                  <tr key={l.valor} className={ativa ? 'bg-slate-50' : 'hover:bg-gray-50/80'}>
                    <td className="py-2 pr-2 text-gray-400">{i + 1}</td>
                    <td className="py-2 pr-2 font-medium text-gray-900">
                      <Link href={`?${montarQuery(params, { secretaria: ativa ? null : l.valor })}`} className="hover:underline">
                        {l.valor}
                      </Link>
                    </td>
                    <td className="py-2 pr-2 text-right text-gray-600">{fmtInt(l.quadro_medio)}</td>
                    <td className="py-2 pr-2 text-right text-gray-600">{fmtInt(l.jornadas_perdidas)}</td>
                    <td className="py-2">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-gray-100">
                          <div
                            className={acima ? 'h-full bg-red-500' : 'h-full bg-slate-400'}
                            style={{ width: `${Math.max(2, (l.taxa / maior) * 100)}%` }}
                          />
                        </div>
                        <span className={acima ? 'font-semibold text-red-600' : 'text-gray-700'}>{fmtPct(l.taxa)}</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Criar `mapa-calor.tsx`**

A intensidade usa `rgba` inline (Tailwind não gera classes dinâmicas).

```tsx
// components/absenteismo/mapa-calor.tsx
import { DIAS_SEMANA, type LinhaCalor } from '@/lib/absenteismo/calor'
import { fmtInt } from '@/lib/absenteismo/formatar'
import { InfoTip } from './info-tip'

export function MapaCalor({ linhas }: { linhas: LinhaCalor[] }) {
  const maximo = Math.max(...linhas.flatMap(l => l.porDia), 0)
  const total = linhas.reduce((s, l) => s + l.total, 0)
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      <p className="mb-4 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-gray-500">
        Mapa de calor: ocorrências por dia da semana
        <InfoTip texto="Quantidade de episódios (ausências) que começaram em cada dia da semana. Falta: dia da falta. Atestado: primeiro dia do atestado (atestados emendados contam como um episódio). Só entram episódios que começaram dentro do período." />
      </p>
      {total === 0 ? (
        <p className="py-6 text-center text-sm text-gray-400">Nenhuma ocorrência começou no período.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: '460px' }}>
            <thead>
              <tr className="text-xs uppercase tracking-widest text-gray-400">
                <th className="pb-2 pr-3 text-left font-semibold" />
                {DIAS_SEMANA.map(d => (
                  <th key={d} className="pb-2 text-center font-semibold">{d}</th>
                ))}
                <th className="pb-2 pl-3 text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map(l => (
                <tr key={l.classe}>
                  <td className="whitespace-nowrap py-1 pr-3 text-gray-600">{l.rotulo}</td>
                  {l.porDia.map((n, i) => (
                    <td key={i} className="p-0.5 text-center">
                      <div
                        className="rounded py-1.5 text-xs font-semibold text-gray-800"
                        style={{ backgroundColor: n === 0 ? '#f8fafc' : `rgba(220, 38, 38, ${0.12 + 0.6 * (n / maximo)})` }}
                        title={`${l.rotulo} · ${DIAS_SEMANA[i]}: ${n}`}
                      >
                        {n === 0 ? '·' : fmtInt(n)}
                      </div>
                    </td>
                  ))}
                  <td className="py-1 pl-3 text-right font-semibold text-gray-900">{fmtInt(l.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Compilar**

Run: `npx tsc --noEmit`
Expected: sem erros. Se `Math.max(...array)` ou `flatMap` reclamarem do `lib` alvo, trocar por `reduce` equivalente, sem mudar o resultado.

- [ ] **Step 5: Commit**

```bash
git add components/absenteismo/indicadores.tsx components/absenteismo/ranking-secretaria.tsx components/absenteismo/mapa-calor.tsx
git commit -m "feat(absenteismo): indicadores, ranking por secretaria e mapa de calor

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Filtros, composição da tela, página nova e legado

**Files:**
- Create: `components/absenteismo/barra-filtros.tsx`, `components/absenteismo/visao-executiva.tsx`, `app/(admin)/relatorios/absenteismo/loading.tsx`, `app/(admin)/relatorios/absenteismo/error.tsx`
- Move: `app/(admin)/relatorios/absenteismo/page.tsx` → `app/(admin)/relatorios/absenteismo/legado/page.tsx` (editar 3 linhas)
- Create: `app/(admin)/relatorios/absenteismo/page.tsx` (nova)
- Modify: `components/relatorios/absenteismo-client.tsx` (link "Limpar"), `app/(admin)/relatorios/page.tsx` (descrição do card)

- [ ] **Step 1: Mover a página antiga para `/legado`**

```bash
mkdir -p "app/(admin)/relatorios/absenteismo/legado"
git mv "app/(admin)/relatorios/absenteismo/page.tsx" "app/(admin)/relatorios/absenteismo/legado/page.tsx"
```

Em `app/(admin)/relatorios/absenteismo/legado/page.tsx` editar 3 trechos:
- `import { buscarAbsenteismo } from './actions'` → `import { buscarAbsenteismo } from '../actions'`
- `<BackButton href="/relatorios" label="Voltar aos Relatórios" />` → `<BackButton href="/relatorios/absenteismo" label="Voltar ao Absenteísmo" />`
- `<h1 className="text-lg font-bold text-gray-900">Absenteísmo</h1>` → `<h1 className="text-lg font-bold text-gray-900">Absenteísmo — relatório antigo (tabelas e exportação)</h1>`

Em `components/relatorios/absenteismo-client.tsx`, trocar `href="/relatorios/absenteismo"` (o link "Limpar") por `href="/relatorios/absenteismo/legado"`.

- [ ] **Step 2: Criar `barra-filtros.tsx`**

Formulário GET puro (sem JS): mês, ano, secretaria, posto, supervisor.

```tsx
// components/absenteismo/barra-filtros.tsx
import Link from 'next/link'
import { MESES_PT } from '@/lib/absenteismo/constantes'
import type { ParametrosTela } from '@/lib/absenteismo/parametros'
import type { OpcoesFiltro } from '@/lib/absenteismo/visao'

const sel =
  'h-9 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400'
const lbl = 'text-xs font-semibold uppercase tracking-widest text-gray-500'

interface Props {
  params: ParametrosTela
  opcoes: OpcoesFiltro
  anos: number[]
}

export function BarraFiltros({ params, opcoes, anos }: Props) {
  return (
    <form method="get" className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <div className="space-y-1">
          <label htmlFor="f-mes" className={lbl}>Mês</label>
          <select id="f-mes" name="mes" defaultValue={params.mes} className={sel}>
            {MESES_PT.slice(1).map((m, i) => (
              <option key={m} value={i + 1}>{m}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="f-ano" className={lbl}>Ano</label>
          <select id="f-ano" name="ano" defaultValue={params.ano} className={sel}>
            {anos.map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="f-sec" className={lbl}>Secretaria</label>
          <select id="f-sec" name="secretaria" defaultValue={params.filtros.secretaria ?? ''} className={sel}>
            <option value="">Todas</option>
            {opcoes.secretarias.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="f-posto" className={lbl}>Posto</label>
          <select id="f-posto" name="posto" defaultValue={params.filtros.posto_id ?? ''} className={sel}>
            <option value="">Todos</option>
            {opcoes.postos.map(p => (
              <option key={p.id} value={p.id}>{p.nome}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="f-sup" className={lbl}>Supervisor</label>
          <select id="f-sup" name="supervisor" defaultValue={params.filtros.supervisor_id ?? ''} className={sel}>
            <option value="">Todos</option>
            {opcoes.supervisores.map(s => (
              <option key={s.id} value={s.id}>{s.nome}</option>
            ))}
          </select>
        </div>
        <div className="flex items-end gap-2">
          <button
            type="submit"
            className="flex h-9 flex-1 items-center justify-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-700"
          >
            Filtrar
          </button>
          <Link
            href="/relatorios/absenteismo"
            className="flex h-9 items-center rounded-lg border border-gray-200 px-3 text-sm font-medium text-gray-500 hover:bg-gray-50"
          >
            Limpar
          </Link>
        </div>
      </div>
    </form>
  )
}
```

- [ ] **Step 3: Criar `visao-executiva.tsx`**

```tsx
// components/absenteismo/visao-executiva.tsx
import { fmtDec, fmtInt, fmtPct, fmtPeriodo, rotuloMes } from '@/lib/absenteismo/formatar'
import type { ParametrosTela } from '@/lib/absenteismo/parametros'
import type { VisaoExecutiva } from '@/lib/absenteismo/visao'
import { GraficoComposicao } from './grafico-composicao'
import { GraficoEvolucao } from './grafico-evolucao'
import { Indicadores } from './indicadores'
import { KpiCard } from './kpi-card'
import { MapaCalor } from './mapa-calor'
import { RankingSecretaria } from './ranking-secretaria'
import { VariacaoBadge } from './variacao-badge'

export function VisaoExecutivaView({ visao, params }: { visao: VisaoExecutiva; params: ParametrosTela }) {
  const { kpis, vsMesAnterior, vsAnoAnterior } = visao
  const rotuloMesAnt = vsMesAnterior
    ? `vs ${rotuloMes(vsMesAnterior.periodo.inicio.slice(0, 7))}`
    : 'vs mês anterior'
  const rotuloAnoAnt = `vs mesmo mês de ${visao.ano - 1}`
  const v = vsMesAnterior?.variacoes

  if (visao.semDados) {
    return (
      <div className="rounded-xl border border-gray-100 bg-white py-12 text-center shadow-sm">
        <p className="text-sm font-medium text-gray-700">Sem dados para o período e os filtros selecionados.</p>
        <p className="mt-1 text-xs text-gray-400">
          Os registros de ausência começam em 18/06/2026. Verifique o mês, o ano e os filtros.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">
        Período: <strong className="text-gray-700">{fmtPeriodo(visao.periodo.inicio, visao.periodo.fim)}</strong>
        {visao.periodo.parcial ? ' (parcial)' : ''} · Quadro médio:{' '}
        <strong className="text-gray-700">{fmtInt(kpis.quadro_medio)}</strong> · Jornadas programadas:{' '}
        <strong className="text-gray-700">{fmtInt(visao.jornadas_programadas)}</strong>
      </p>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiCard
          titulo="Taxa de absenteísmo"
          valor={fmtPct(kpis.taxa)}
          cor="border-t-orange-500"
          dica="Jornadas perdidas ÷ jornadas programadas × 100. A base é a escala de cada funcionário (5x2, 5x1, 6x1, 12x36), sem férias e sem afastamentos. Só entram faltas e atestados (até o 15º dia)."
        >
          <VariacaoBadge valor={v?.taxa_pp ?? null} tipo="pp" rotulo={rotuloMesAnt} />
          <VariacaoBadge valor={vsAnoAnterior?.variacoes.taxa_pp ?? null} tipo="pp" rotulo={rotuloAnoAnt} />
        </KpiCard>
        <KpiCard
          titulo="Jornadas perdidas"
          valor={fmtInt(kpis.jornadas_perdidas)}
          cor="border-t-red-500"
          dica="Dias de trabalho previstos na escala em que o funcionário esteve ausente (falta ou atestado). Cada dia conta uma vez só, mesmo que haja dois registros no mesmo dia."
        >
          <VariacaoBadge valor={v?.jornadas_perdidas_pct ?? null} tipo="pct" rotulo={rotuloMesAnt} />
        </KpiCard>
        <KpiCard
          titulo="Episódios"
          valor={fmtInt(kpis.episodios)}
          cor="border-t-amber-500"
          dica="Quantidade de ausências distintas. Cada falta é um episódio; atestados em sequência (emendados) formam um só."
        >
          <VariacaoBadge valor={v?.episodios_pct ?? null} tipo="pct" rotulo={rotuloMesAnt} />
        </KpiCard>
        <KpiCard
          titulo="Funcionários afetados"
          valor={fmtInt(kpis.funcionarios_afetados)}
          cor="border-t-slate-500"
          dica="Funcionários distintos com pelo menos um episódio no período."
        >
          <p className="mt-1 text-xs text-gray-400">{fmtDec(kpis.pct_afetados, 1)}% do quadro</p>
          <VariacaoBadge valor={v?.afetados_pct ?? null} tipo="pct" rotulo={rotuloMesAnt} />
        </KpiCard>
        <KpiCard
          titulo="Índice de frequência"
          valor={fmtDec(kpis.indice_frequencia, 1)}
          cor="border-t-indigo-500"
          dica="Episódios ÷ quadro médio × 100. Quantas ausências ocorreram para cada 100 funcionários."
        >
          <VariacaoBadge valor={v?.indice_frequencia_pct ?? null} tipo="pct" rotulo={rotuloMesAnt} />
        </KpiCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <GraficoEvolucao serie={visao.serie} />
        </div>
        <GraficoComposicao fatias={visao.composicao} total={kpis.jornadas_perdidas} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Indicadores kpis={kpis} vs={vsMesAnterior} rotuloVs={rotuloMesAnt} />
        <div className="lg:col-span-2">
          <RankingSecretaria linhas={visao.ranking} taxaGeral={kpis.taxa} params={params} />
        </div>
      </div>

      <MapaCalor linhas={visao.calor} />

      <p className="text-xs text-gray-400">
        Não entram na taxa: afastamentos (INSS e licenças), atestados após o 15º dia, férias e suspensões disciplinares.
        O comparativo com o mês anterior usa o mesmo número de dias quando o mês atual ainda está em andamento.
      </p>
    </div>
  )
}
```

- [ ] **Step 4: Criar a página nova, `loading.tsx` e `error.tsx`**

```tsx
// app/(admin)/relatorios/absenteismo/page.tsx
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { BarraFiltros } from '@/components/absenteismo/barra-filtros'
import { VisaoExecutivaView } from '@/components/absenteismo/visao-executiva'
import { BackButton } from '@/components/ui/back-button'
import { MESES_PT } from '@/lib/absenteismo/constantes'
import { carregarVisao } from '@/lib/absenteismo/carregar-visao'
import { hojeBrasilia } from '@/lib/absenteismo/hoje'
import { anosDisponiveis, lerParametros } from '@/lib/absenteismo/parametros'
import { getUser } from '@/lib/auth/get-user'
import { createClient } from '@/lib/supabase/server'
import { isAdminOrCoord } from '@/types/roles'

export const dynamic = 'force-dynamic'

export default async function AbsenteismoPage({
  searchParams,
}: {
  searchParams: { [chave: string]: string | string[] | undefined }
}) {
  const auth = await getUser()
  if (!auth) redirect('/login')
  if (!isAdminOrCoord(auth.perfil.role)) redirect('/dashboard')

  const hoje = hojeBrasilia()
  const params = lerParametros(searchParams, hoje)
  const visao = await carregarVisao(createClient(), params.filtros, params.ano, params.mes, hoje)

  return (
    <div className="space-y-5">
      <BackButton href="/relatorios" label="Voltar aos Relatórios" />
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Absenteísmo</h1>
          <p className="text-sm text-gray-400">
            Ausências não programadas (faltas e atestados) — {MESES_PT[params.mes]} {params.ano}
          </p>
        </div>
        <Link href="/relatorios/absenteismo/legado" className="text-xs font-medium text-gray-400 underline hover:text-gray-700">
          Relatório antigo (tabelas e exportação)
        </Link>
      </div>

      <BarraFiltros params={params} opcoes={visao.opcoes} anos={anosDisponiveis(hoje)} />
      <VisaoExecutivaView visao={visao} params={params} />
    </div>
  )
}
```

```tsx
// app/(admin)/relatorios/absenteismo/loading.tsx
export default function Loading() {
  return (
    <div className="space-y-5 animate-pulse" aria-busy="true" aria-label="Carregando absenteísmo">
      <div className="h-5 w-40 rounded bg-gray-200" />
      <div className="h-20 rounded-xl bg-gray-100" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[0, 1, 2, 3, 4].map(i => (
          <div key={i} className="h-24 rounded-xl bg-gray-100" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="h-72 rounded-xl bg-gray-100 lg:col-span-2" />
        <div className="h-72 rounded-xl bg-gray-100" />
      </div>
    </div>
  )
}
```

```tsx
// app/(admin)/relatorios/absenteismo/error.tsx
'use client'

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="rounded-xl border border-red-100 bg-white p-8 text-center shadow-sm">
      <p className="text-sm font-semibold text-gray-900">Não foi possível carregar o absenteísmo.</p>
      <p className="mt-1 text-xs text-gray-400">{error.message || 'Erro inesperado.'}</p>
      <button
        type="button"
        onClick={reset}
        className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
      >
        Tentar de novo
      </button>
    </div>
  )
}
```

- [ ] **Step 5: Atualizar a descrição do card em `/relatorios`**

Rodar `grep -n "consolidados com KPIs" "app/(admin)/relatorios/page.tsx"` para ver a linha e trocar o texto da `desc` do card de absenteísmo por: `Taxa, tendência, composição por natureza, ranking por secretaria e mapa de calor`.

- [ ] **Step 6: Compilar**

Run: `npx tsc --noEmit`
Expected: sem erros. Pontos prováveis de ajuste: tipo de `searchParams` (usar o que o Next aceitar, mantendo o formato), e `isAdminOrCoord(auth.perfil.role)` (se `role` for `string | null`, conferir a assinatura em `types/roles.ts` e usar a comparação direta `perfil.role === 'admin' || perfil.role === 'coordenador'` como no layout).

- [ ] **Step 7: Commit**

```bash
git add components/absenteismo "app/(admin)/relatorios/absenteismo" "app/(admin)/relatorios/page.tsx" components/relatorios/absenteismo-client.tsx
git commit -m "feat(absenteismo): visao executiva em /relatorios/absenteismo e relatorio antigo em /legado

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 14: Verificação final

- [ ] **Step 1: Suíte completa e tipos**

Run: `npm test`
Expected: todos os testes passam (os do plano 1 + os novos desta fase).

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 2: Build de produção**

Run: `npm run build`
Expected: build conclui sem erros; a rota `/relatorios/absenteismo` e `/relatorios/absenteismo/legado` aparecem na lista de rotas (dinâmicas).

- [ ] **Step 3: Conferência visual**

Iniciar o servidor de desenvolvimento a partir do worktree (`preview_start` com a configuração `demax-gestao` de `.claude/launch.json`, ou `npm run dev -- -p 3100` em background) e abrir `/relatorios/absenteismo` no navegador do app. Se a tela redirecionar para `/login`, **parar e pedir ao usuário que faça login** no painel; não inserir credenciais.

Conferir:
- 5 KPIs com variação; "sem base vs mesmo mês de 2025" no card da taxa;
- taxa de novembro próxima de 1,8% e episódios próximos de 99 (valores do script do plano 1 em 19/11/2026; pequenas diferenças são esperadas conforme os dias passam);
- gráfico de evolução com jun/26* a nov/26*, rosca com as 3 naturezas principais, ranking com SME no topo, mapa de calor preenchido;
- trocar o mês para outubro, filtrar por uma secretaria clicando no ranking, e voltar com "Limpar";
- tooltips ⓘ abrem no hover e no foco por teclado;
- largura de celular (375px) sem rolagem horizontal da página (as tabelas rolam dentro do próprio card);
- `/relatorios/absenteismo/legado` ainda mostra as tabelas e exporta Excel e PDF.

- [ ] **Step 4: Revisões especializadas**

Despachar os agentes `rls-reviewer` (conferir que a rota só lê dados via cliente do usuário e que o acesso fica restrito a admin e coordenador) e `pii-masking-reviewer` (conferir que nenhuma tela ou componente novo expõe CPF ou salário). Corrigir qualquer achado Crítico ou Importante.

- [ ] **Step 5: Estado do git**

Run: `git status --short && git log --oneline dd503df..HEAD`
Expected: árvore limpa; commits do plano 1 e deste plano na branch `feat/absenteismo-motor`. **Não fazer push.**

---

## Auto-revisão contra o spec (seção 6, aba Visão Executiva)

| Requisito | Onde |
|---|---|
| 5 KPIs (taxa, jornadas perdidas, episódios, afetados, IF) com variação vs. mês anterior | Task 8 (`vsMesAnterior`), Task 10 e 13 |
| Comparativo com o mesmo mês do ano anterior, "sem base" quando não houver | Task 7 (`periodoAnoAnterior`), Task 8, Task 13 (`rotuloAnoAnt`) |
| Evolução mensal (12 meses; só os existentes aparecem) | Task 8 (`calcularSerieMensal` com 12 meses), Task 11 |
| Composição por natureza | Task 4 e 11 |
| Indicadores IF, IG, duração média, reincidência | Task 12 (`Indicadores`) |
| Ranking por secretaria normalizado pelo quadro | Task 5 e 12 |
| Mapa de calor por dia da semana (início do episódio) | Task 2, 6 e 12 |
| Filtros globais combináveis na URL (mês, ano, secretaria, posto, supervisor) | Task 1 e 13 |
| Tooltips ⓘ com a fórmula de cada métrica | Task 10 e 12/13 |
| Estados de carregamento, vazio e erro | Task 13 (`loading.tsx`, `error.tsx`, estado `semDados`) |
| Layout desktop/tablet/celular, sem rolagem horizontal da página | Tasks 12 e 13 (grid responsivo, tabelas com rolagem interna), conferido na Task 14 |
| Acesso admin/coordenador, sem CPF | Task 13 e revisões da Task 14 |
| Mês corrente até hoje, mês inicial parcial | planos 1 e 7 (`periodoEfetivo`, `equivalente`) |
| Taxas separadas de INSS, licenças, férias e suspensões | nota de rodapé na Task 13; as abas vêm no plano 3 |

**Fica para os planos seguintes:** card "Tendências e Recomendações" (plano 4), abas Ocorrências, Saúde, Disponibilidade e Qualidade (planos 3 e 4), PDF e Excel novos (plano 5), filtro por natureza (plano 3), `taxa: null` quando a base é zero e filtro "sem supervisor" (anotados na revisão do plano 1).

**Consistência de nomes:** `ParametrosTela` (Task 1) → `BarraFiltros`, `RankingSecretaria`, `VisaoExecutivaView`; `VisaoExecutiva`/`Comparativo`/`OpcoesFiltro` (Task 8) → componentes da Task 12/13; `FatiaComposicao` (Task 4) → `GraficoComposicao`; `LinhaCalor` (Task 6) → `MapaCalor`; `LinhaRanking` (Task 5) → `RankingSecretaria`; `PontoSerie` (plano 1) → `GraficoEvolucao`; `Intervalo` (Task 7) usado em `visao.ts`; `DADOS_DESDE` (Task 1) usado em `visao.ts`, `carregar-visao.ts`, `grafico-evolucao.tsx` e no script.
