# Absenteísmo — Plano 1: Motor de Cálculo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir o motor puro e testado (`lib/absenteismo/`) que calcula taxa de absenteísmo, jornadas, episódios, disponibilidade e série mensal, mais o carregador de dados do Supabase e um script que valida o quadro contra `snapshots_diarios`.

**Architecture:** Funções puras em `lib/absenteismo/` (datas ISO em UTC, sem `Date` local), cada uma com `*.test.ts` em `vitest`. Um carregador (`carregar.ts`) recebe um client Supabase, usa `fetchAllRows` e devolve entradas tipadas. Nenhuma migração de banco e nenhuma mudança na tela atual: o motor só é plugado na UI nos planos seguintes.

**Tech Stack:** TypeScript, vitest (`npm test`, só roda `lib/**/*.test.ts`), Supabase JS, utilitários existentes `lib/utils/dias-uteis.ts`, `lib/supabase/fetch-all.ts`, `lib/turnos/regime-funcionario.ts`.

**Spec:** `docs/superpowers/specs/2026-11-19-absenteismo-inteligencia-design.md` (seções 4, 5 e 8).

**Escopo deste plano (fase 1 do spec):** motor + carregador + validação. Planos seguintes, escritos depois que este estiver pronto e com o formato real do resultado: (2) Visão Executiva, (3) abas Ocorrências/Saúde/Disponibilidade, (4) Qualidade dos dados + recomendações, (5) PDF/Excel.

**Regras do projeto que valem aqui:**
- `createClient()` é síncrono (nunca `await createClient()`); aqui o carregador recebe o client por parâmetro.
- Nunca iterar `Set`/`Map` com spread ou `for...of`; usar `Array.from(...)` (restrição de compilação do projeto).
- Nunca `git push`. Os commits abaixo são locais.
- CPF nunca entra nestas estruturas (só `nome` e `registro`).

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `lib/absenteismo/datas.ts` | Aritmética de datas ISO (`yyyy-mm-dd`) em UTC |
| `lib/absenteismo/classificar.ts` | Mapeia `faltas.tipo` e `afastamentos.motivo` para classes gerenciais; constante dos 15 dias |
| `lib/absenteismo/jornadas.ts` | Dias programados por escala (espelha `diasUteisNoPeriodo`) e feriados do período |
| `lib/absenteismo/quadro.ts` | Quadro do dia, quadro médio e janela de cada funcionário |
| `lib/absenteismo/episodios.ts` | Agrupa atestados contíguos em episódios |
| `lib/absenteismo/tipos.ts` | Tipos de entrada e saída do motor |
| `lib/absenteismo/calculo.ts` | `calcularPeriodo`: precedência por dia, jornadas, episódios, disponibilidade |
| `lib/absenteismo/filtros.ts` | Filtra funcionários por secretaria, posto e supervisor |
| `lib/absenteismo/kpis.ts` | Taxa, IF, IG, duração média, reincidência, variações |
| `lib/absenteismo/series.ts` | Período efetivo (mês parcial) e série mensal |
| `lib/absenteismo/carregar.ts` | Lê o Supabase e monta `DadosAbsenteismo` |
| `scripts/validar-absenteismo.ts` | Compara o quadro reconstruído com `snapshots_diarios` e imprime os KPIs do mês |

Cada `*.ts` acima tem um `*.test.ts` ao lado, exceto `tipos.ts`, `carregar.ts` e o script (validados pelo compilador e pela execução do script).

---

### Task 1: Datas ISO em UTC

**Files:**
- Create: `lib/absenteismo/datas.ts`
- Test: `lib/absenteismo/datas.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

```ts
// lib/absenteismo/datas.test.ts
import { describe, it, expect } from 'vitest'
import { addDias, diffDias, listarDias, diaSemana, periodoDoMes, mesAnterior, maxData, minData } from './datas'

describe('datas', () => {
  it('addDias atravessa mês e ano', () => {
    expect(addDias('2026-11-30', 1)).toBe('2026-12-01')
    expect(addDias('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDias('2026-11-01', -1)).toBe('2026-10-31')
  })
  it('diffDias é fim menos início', () => {
    expect(diffDias('2026-11-01', '2026-11-30')).toBe(29)
    expect(diffDias('2026-11-05', '2026-11-05')).toBe(0)
  })
  it('listarDias inclui os dois extremos', () => {
    expect(listarDias('2026-11-28', '2026-12-01')).toEqual(['2026-11-28', '2026-11-29', '2026-11-30', '2026-12-01'])
    expect(listarDias('2026-11-05', '2026-11-04')).toEqual([])
  })
  it('diaSemana: 2026-11-02 é segunda (1) e 2026-11-01 é domingo (0)', () => {
    expect(diaSemana('2026-11-02')).toBe(1)
    expect(diaSemana('2026-11-01')).toBe(0)
  })
  it('periodoDoMes e mesAnterior', () => {
    expect(periodoDoMes(2026, 11)).toEqual({ inicio: '2026-11-01', fim: '2026-11-30' })
    expect(periodoDoMes(2026, 2)).toEqual({ inicio: '2026-02-01', fim: '2026-02-28' })
    expect(mesAnterior(2026, 1)).toEqual({ ano: 2025, mes: 12 })
    expect(mesAnterior(2026, 11)).toEqual({ ano: 2026, mes: 10 })
  })
  it('maxData e minData', () => {
    expect(maxData('2026-11-01', '2026-11-02')).toBe('2026-11-02')
    expect(minData('2026-11-01', '2026-11-02')).toBe('2026-11-01')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run lib/absenteismo/datas.test.ts`
Expected: FAIL com "Failed to resolve import './datas'".

- [ ] **Step 3: Implementar**

```ts
// lib/absenteismo/datas.ts
// Datas ISO (yyyy-mm-dd) tratadas sempre em UTC: sem fuso, sem horário de verão, determinístico em teste.

const MS_DIA = 86400000
const pad = (n: number) => String(n).padStart(2, '0')

export function utc(isoDate: string): number {
  const [y, m, d] = isoDate.slice(0, 10).split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

export function paraIso(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

export function addDias(isoDate: string, n: number): string {
  return paraIso(utc(isoDate) + n * MS_DIA)
}

/** `ate - de`, em dias corridos. */
export function diffDias(de: string, ate: string): number {
  return Math.round((utc(ate) - utc(de)) / MS_DIA)
}

/** Todos os dias de `inicio` a `fim`, inclusive. Vazio se `inicio > fim`. */
export function listarDias(inicio: string, fim: string): string[] {
  const out: string[] = []
  for (let t = utc(inicio); t <= utc(fim); t += MS_DIA) out.push(paraIso(t))
  return out
}

/** 0 = domingo ... 6 = sábado. */
export function diaSemana(isoDate: string): number {
  return new Date(utc(isoDate)).getUTCDay()
}

export function maxData(a: string, b: string): string {
  return a > b ? a : b
}

export function minData(a: string, b: string): string {
  return a < b ? a : b
}

export function periodoDoMes(ano: number, mes: number): { inicio: string; fim: string } {
  const ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate()
  return { inicio: `${ano}-${pad(mes)}-01`, fim: `${ano}-${pad(mes)}-${pad(ultimo)}` }
}

export function mesAnterior(ano: number, mes: number): { ano: number; mes: number } {
  return mes === 1 ? { ano: ano - 1, mes: 12 } : { ano, mes: mes - 1 }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run lib/absenteismo/datas.test.ts`
Expected: PASS (6 testes).

- [ ] **Step 5: Commit**

```bash
git add lib/absenteismo/datas.ts lib/absenteismo/datas.test.ts
git commit -m "feat(absenteismo): utilitarios de data ISO em UTC

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Classificação gerencial

**Files:**
- Create: `lib/absenteismo/classificar.ts`
- Test: `lib/absenteismo/classificar.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

```ts
// lib/absenteismo/classificar.test.ts
import { describe, it, expect } from 'vitest'
import { classificarFalta, classificarAfastamento, LIMITE_DIAS_ATESTADO_EMPRESA } from './classificar'

describe('classificarFalta', () => {
  it('mapeia os tipos reais do banco', () => {
    expect(classificarFalta('sem_justificativa')).toBe('falta_injustificada')
    expect(classificarFalta('falta_injustificada')).toBe('falta_injustificada')
    expect(classificarFalta('sem_atestado')).toBe('falta_injustificada')
    expect(classificarFalta('justificada')).toBe('falta_justificada')
    expect(classificarFalta('falta_justificada')).toBe('falta_justificada')
    expect(classificarFalta('declaracao')).toBe('falta_justificada')
    expect(classificarFalta('com_atestado')).toBe('falta_justificada')
    expect(classificarFalta('atraso')).toBe('outras')
    expect(classificarFalta('suspensao')).toBe('suspensao')
  })
  it('tipo desconhecido cai em outras', () => {
    expect(classificarFalta('qualquer_coisa')).toBe('outras')
  })
})

describe('classificarAfastamento', () => {
  it('INSS (doença e acidente)', () => {
    expect(classificarAfastamento('INSS - Doença')).toBe('afastamento_inss')
    expect(classificarAfastamento('INSS - Acidente de Trabalho')).toBe('afastamento_inss')
  })
  it('licenças legais, com ou sem acento e caixa', () => {
    expect(classificarAfastamento('Licença Maternidade')).toBe('licenca_legal')
    expect(classificarAfastamento('Licença Paternidade')).toBe('licenca_legal')
    expect(classificarAfastamento('licenca maternidade')).toBe('licenca_legal')
  })
  it('o resto, inclusive nulo e texto solto, é outros', () => {
    expect(classificarAfastamento('Outros')).toBe('afastamento_outros')
    expect(classificarAfastamento('NA')).toBe('afastamento_outros')
    expect(classificarAfastamento(null)).toBe('afastamento_outros')
    expect(classificarAfastamento('Cirurgia odontologia ')).toBe('afastamento_outros')
  })
  it('"inss" só casa como palavra inteira', () => {
    expect(classificarAfastamento('Princípio da insssuficiência')).toBe('afastamento_outros')
  })
})

describe('constantes', () => {
  it('limite de dias pagos pela empresa é 15 (igual ao fechamento)', () => {
    expect(LIMITE_DIAS_ATESTADO_EMPRESA).toBe(15)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run lib/absenteismo/classificar.test.ts`
Expected: FAIL com "Failed to resolve import './classificar'".

- [ ] **Step 3: Implementar**

```ts
// lib/absenteismo/classificar.ts
// Camada de mapeamento gerencial. Não altera nenhum registro de origem.

/** Classes que entram na taxa de absenteísmo (ausência não programada). */
export type ClasseTaxa = 'falta_injustificada' | 'falta_justificada' | 'atestado' | 'outras'

/** Classes de disponibilidade: ficam FORA da taxa (aba Disponibilidade). */
export type ClasseDisponibilidade =
  | 'afastamento_inss'
  | 'licenca_legal'
  | 'afastamento_outros'
  | 'atestado_prolongado'
  | 'ferias'

export type ClasseFalta = ClasseTaxa | 'suspensao'

/** Dias de atestado pagos pela empresa; do 16º dia em diante é previdenciário. Igual a DIAS_COBERTURA_ATESTADO do fechamento. */
export const LIMITE_DIAS_ATESTADO_EMPRESA = 15

const FALTA_MAP: Record<string, ClasseFalta> = {
  sem_justificativa: 'falta_injustificada',
  falta_injustificada: 'falta_injustificada',
  sem_atestado: 'falta_injustificada',
  justificada: 'falta_justificada',
  falta_justificada: 'falta_justificada',
  declaracao: 'falta_justificada',
  com_atestado: 'falta_justificada',
  atraso: 'outras',
  suspensao: 'suspensao',
}

export function classificarFalta(tipo: string): ClasseFalta {
  return FALTA_MAP[tipo] ?? 'outras'
}

function normalizar(texto: string | null): string {
  return (texto ?? '')
    .normalize('NFD')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '') // NFD separa o acento da letra; tudo que não é a-z, 0-9 ou espaço sai
    .trim()
}

export function classificarAfastamento(
  motivo: string | null,
): 'afastamento_inss' | 'licenca_legal' | 'afastamento_outros' {
  const m = normalizar(motivo)
  if (/\binss\b/.test(m)) return 'afastamento_inss'
  if (/maternidade|paternidade/.test(m)) return 'licenca_legal'
  return 'afastamento_outros'
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run lib/absenteismo/classificar.test.ts`
Expected: PASS (7 testes).

- [ ] **Step 5: Commit**

```bash
git add lib/absenteismo/classificar.ts lib/absenteismo/classificar.test.ts
git commit -m "feat(absenteismo): classificacao gerencial de faltas e afastamentos

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Jornadas programadas por escala

**Files:**
- Create: `lib/absenteismo/jornadas.ts`
- Test: `lib/absenteismo/jornadas.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

O teste de paridade garante que `diasProgramados` conta o mesmo que `diasUteisNoPeriodo` (a função que o fechamento já usa).

```ts
// lib/absenteismo/jornadas.test.ts
import { describe, it, expect } from 'vitest'
import { diasUteisNoPeriodo, toDate } from '@/lib/utils/dias-uteis'
import { diasProgramados, feriadosDoPeriodo } from './jornadas'

const feriados = feriadosDoPeriodo('2026-01-01', '2026-12-31')

describe('feriadosDoPeriodo', () => {
  it('inclui os feriados de Mogi e os nacionais de novembro', () => {
    expect(feriados.has('2026-11-02')).toBe(true)
    expect(feriados.has('2026-11-15')).toBe(true)
    expect(feriados.has('2026-11-20')).toBe(true)
    expect(feriados.has('2026-11-03')).toBe(false)
  })
  it('junta os anos quando o período atravessa a virada', () => {
    const f = feriadosDoPeriodo('2026-12-20', '2027-01-10')
    expect(f.has('2026-12-25')).toBe(true)
    expect(f.has('2027-01-01')).toBe(true)
  })
})

describe('diasProgramados', () => {
  it('5x2 em novembro/2026 tem 19 dias (igual à tela antiga: 19 d.úteis)', () => {
    expect(diasProgramados('5x2', '2026-11-01', '2026-11-30', feriados)).toHaveLength(19)
  })
  it('5x2 ignora sábado, domingo e feriado', () => {
    const d = diasProgramados('5x2', '2026-11-01', '2026-11-30', feriados)
    expect(d).not.toContain('2026-11-02') // feriado (Finados)
    expect(d).not.toContain('2026-11-07') // sábado
    expect(d).not.toContain('2026-11-20') // feriado (Consciência Negra)
    expect(d).toContain('2026-11-03')
  })
  it('período invertido devolve vazio', () => {
    expect(diasProgramados('5x2', '2026-11-10', '2026-11-01', feriados)).toEqual([])
  })

  for (const regime of ['5x2', '5x1', '6x1', '12x36', 'jovem_aprendiz']) {
    it(`paridade com diasUteisNoPeriodo (${regime})`, () => {
      for (const [ini, fim] of [
        ['2026-11-01', '2026-11-30'],
        ['2026-11-16', '2026-11-30'],
        ['2026-10-15', '2026-11-19'],
        ['2026-12-20', '2026-12-31'],
      ]) {
        const esperado = diasUteisNoPeriodo(toDate(ini), toDate(fim), regime, feriados)
        expect(diasProgramados(regime, ini, fim, feriados)).toHaveLength(esperado)
      }
    })
  }
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run lib/absenteismo/jornadas.test.ts`
Expected: FAIL com "Failed to resolve import './jornadas'".

- [ ] **Step 3: Implementar**

```ts
// lib/absenteismo/jornadas.ts
import { feriadosDoAno } from '@/lib/utils/dias-uteis'
import { diaSemana, listarDias } from './datas'

/** Feriados (nacionais + Mogi das Cruzes) de todos os anos que o período toca. */
export function feriadosDoPeriodo(inicio: string, fim: string): Set<string> {
  const out = new Set<string>()
  const de = Number(inicio.slice(0, 4))
  const ate = Number(fim.slice(0, 4))
  for (let ano = de; ano <= ate; ano++) {
    Array.from(feriadosDoAno(ano)).forEach(d => out.add(d))
  }
  return out
}

/**
 * Dias em que o funcionário deveria trabalhar entre `inicio` e `fim`, pela escala.
 * Mesma regra de `diasUteisNoPeriodo` (lib/utils/dias-uteis.ts), mas devolve as datas,
 * não só a contagem, para permitir interseção com os dias de ausência.
 *  - 5x1: ciclo de 6 dias contado a partir de `inicio` (o 6º é folga), pula feriado
 *  - 6x1: segunda a sábado, pula feriado
 *  - 12x36: todos os dias, pula feriado
 *  - demais (5x2, jovem_aprendiz): segunda a sexta, pula feriado
 */
export function diasProgramados(regime: string, inicio: string, fim: string, feriados: Set<string>): string[] {
  const out: string[] = []
  let indice = 0
  for (const dia of listarDias(inicio, fim)) {
    const dow = diaSemana(dia)
    const feriado = feriados.has(dia)
    let programado: boolean
    if (regime === '5x1') programado = indice % 6 !== 5 && !feriado
    else if (regime === '6x1') programado = dow !== 0 && !feriado
    else if (regime === '12x36') programado = !feriado
    else programado = dow !== 0 && dow !== 6 && !feriado
    if (programado) out.push(dia)
    indice++
  }
  return out
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run lib/absenteismo/jornadas.test.ts`
Expected: PASS (todos os testes do arquivo). Se a paridade falhar em 5x1, o índice do ciclo não está partindo de `inicio`; conferir o `indice++` ao fim de cada iteração.

- [ ] **Step 5: Commit**

```bash
git add lib/absenteismo/jornadas.ts lib/absenteismo/jornadas.test.ts
git commit -m "feat(absenteismo): dias programados por escala com paridade ao fechamento

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Quadro (headcount)

**Files:**
- Create: `lib/absenteismo/quadro.ts`
- Test: `lib/absenteismo/quadro.test.ts`

Regra: o funcionário está no quadro de `admissao` até o dia anterior a `desligamento` (no dia do desligamento já não conta). `fora_do_quadro` exclui sempre.

- [ ] **Step 1: Escrever o teste que falha**

```ts
// lib/absenteismo/quadro.test.ts
import { describe, it, expect } from 'vitest'
import { janelaDoFuncionario, quadroNoDia, quadroMedio, type FuncQuadro } from './quadro'

const f = (over: Partial<FuncQuadro> = {}): FuncQuadro => ({
  id: 'f1', admissao: '2020-01-01', desligamento: null, fora_do_quadro: false, ...over,
})

describe('janelaDoFuncionario', () => {
  it('funcionário antigo cobre o período todo', () => {
    expect(janelaDoFuncionario(f(), '2026-11-01', '2026-11-30')).toEqual({ inicio: '2026-11-01', fim: '2026-11-30' })
  })
  it('admissão no meio do período corta o início', () => {
    expect(janelaDoFuncionario(f({ admissao: '2026-11-16' }), '2026-11-01', '2026-11-30')).toEqual({ inicio: '2026-11-16', fim: '2026-11-30' })
  })
  it('desligamento: o último dia no quadro é o anterior', () => {
    expect(janelaDoFuncionario(f({ desligamento: '2026-11-10' }), '2026-11-01', '2026-11-30')).toEqual({ inicio: '2026-11-01', fim: '2026-11-09' })
  })
  it('desligado antes do período ou admitido depois: fora', () => {
    expect(janelaDoFuncionario(f({ desligamento: '2026-10-31' }), '2026-11-01', '2026-11-30')).toBeNull()
    expect(janelaDoFuncionario(f({ admissao: '2026-12-01' }), '2026-11-01', '2026-11-30')).toBeNull()
  })
  it('fora_do_quadro sempre exclui', () => {
    expect(janelaDoFuncionario(f({ fora_do_quadro: true }), '2026-11-01', '2026-11-30')).toBeNull()
  })
  it('admissão nula vale desde sempre', () => {
    expect(janelaDoFuncionario(f({ admissao: null }), '2026-11-01', '2026-11-30')).toEqual({ inicio: '2026-11-01', fim: '2026-11-30' })
  })
})

describe('quadroNoDia', () => {
  it('conta só quem está no quadro naquele dia', () => {
    const funcs = [f({ id: 'a' }), f({ id: 'b', admissao: '2026-11-16' }), f({ id: 'c', desligamento: '2026-11-10' })]
    expect(quadroNoDia(funcs, '2026-11-09')).toBe(2) // a, c
    expect(quadroNoDia(funcs, '2026-11-10')).toBe(1) // só a
    expect(quadroNoDia(funcs, '2026-11-16')).toBe(2) // a, b
  })
})

describe('quadroMedio', () => {
  it('um funcionário o mês todo vale 1', () => {
    expect(quadroMedio([f()], '2026-11-01', '2026-11-30')).toBe(1)
  })
  it('admitido dia 16 vale 15/30', () => {
    expect(quadroMedio([f({ admissao: '2026-11-16' })], '2026-11-01', '2026-11-30')).toBe(0.5)
  })
  it('desligado dia 10 vale 9/30', () => {
    expect(quadroMedio([f({ desligamento: '2026-11-10' })], '2026-11-01', '2026-11-30')).toBeCloseTo(0.3, 10)
  })
  it('lista vazia vale 0', () => {
    expect(quadroMedio([], '2026-11-01', '2026-11-30')).toBe(0)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run lib/absenteismo/quadro.test.ts`
Expected: FAIL com "Failed to resolve import './quadro'".

- [ ] **Step 3: Implementar**

```ts
// lib/absenteismo/quadro.ts
import { addDias, diffDias, listarDias, maxData, minData } from './datas'

/** Campos mínimos para decidir se alguém está no quadro. `FuncionarioCalc` satisfaz este tipo. */
export interface FuncQuadro {
  id: string
  admissao: string | null
  desligamento: string | null
  /** true quando o status é desligado/rescisão indireta e não há data de desligamento. */
  fora_do_quadro: boolean
}

/** Intervalo [inicio, fim] em que o funcionário está no quadro dentro do período; null se nunca esteve. */
export function janelaDoFuncionario(
  f: FuncQuadro,
  inicio: string,
  fim: string,
): { inicio: string; fim: string } | null {
  if (f.fora_do_quadro) return null
  const ini = f.admissao ? maxData(f.admissao, inicio) : inicio
  const ultimo = f.desligamento ? minData(addDias(f.desligamento, -1), fim) : fim
  return ini <= ultimo ? { inicio: ini, fim: ultimo } : null
}

export function quadroNoDia(funcs: FuncQuadro[], dia: string): number {
  return funcs.filter(f => janelaDoFuncionario(f, dia, dia) !== null).length
}

/** Média diária do quadro no período: soma de dias-pessoa ÷ dias corridos do período. */
export function quadroMedio(funcs: FuncQuadro[], inicio: string, fim: string): number {
  const totalDias = listarDias(inicio, fim).length
  if (totalDias === 0) return 0
  let diasPessoa = 0
  for (const f of funcs) {
    const j = janelaDoFuncionario(f, inicio, fim)
    if (j) diasPessoa += diffDias(j.inicio, j.fim) + 1
  }
  return diasPessoa / totalDias
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run lib/absenteismo/quadro.test.ts`
Expected: PASS (todos os testes do arquivo).

- [ ] **Step 5: Commit**

```bash
git add lib/absenteismo/quadro.ts lib/absenteismo/quadro.test.ts
git commit -m "feat(absenteismo): quadro do dia, quadro medio e janela por funcionario

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Episódios de atestado (contíguos)

**Files:**
- Create: `lib/absenteismo/episodios.ts`
- Test: `lib/absenteismo/episodios.test.ts`

Atestados do mesmo funcionário que se tocam (inclusive no dia seguinte ou passagem de bastão de 1 dia) formam um único episódio.

- [ ] **Step 1: Escrever o teste que falha**

```ts
// lib/absenteismo/episodios.test.ts
import { describe, it, expect } from 'vitest'
import { agruparAtestadosContiguos } from './episodios'

const a = (id: string, data_inicio: string, data_fim: string) => ({ id, data_inicio, data_fim })
const ids = (grupos: { id: string }[][]) => grupos.map(g => g.map(x => x.id))

describe('agruparAtestadosContiguos', () => {
  it('atestados separados por lacuna viram episódios diferentes', () => {
    expect(ids(agruparAtestadosContiguos([a('1', '2026-11-03', '2026-11-04'), a('2', '2026-11-10', '2026-11-11')]))).toEqual([['1'], ['2']])
  })
  it('o seguinte começa no dia seguinte: mesmo episódio', () => {
    expect(ids(agruparAtestadosContiguos([a('1', '2026-11-03', '2026-11-04'), a('2', '2026-11-05', '2026-11-06')]))).toEqual([['1', '2']])
  })
  it('passagem de bastão (mesmo dia): mesmo episódio', () => {
    expect(ids(agruparAtestadosContiguos([a('1', '2026-09-02', '2026-09-04'), a('2', '2026-09-04', '2026-09-13')]))).toEqual([['1', '2']])
  })
  it('atestado dentro de outro: mesmo episódio', () => {
    expect(ids(agruparAtestadosContiguos([a('1', '2026-11-01', '2026-11-20'), a('2', '2026-11-05', '2026-11-06')]))).toEqual([['1', '2']])
  })
  it('ordena entradas fora de ordem', () => {
    expect(ids(agruparAtestadosContiguos([a('2', '2026-11-05', '2026-11-06'), a('1', '2026-11-03', '2026-11-04')]))).toEqual([['1', '2']])
  })
  it('lista vazia', () => {
    expect(agruparAtestadosContiguos([])).toEqual([])
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run lib/absenteismo/episodios.test.ts`
Expected: FAIL com "Failed to resolve import './episodios'".

- [ ] **Step 3: Implementar**

```ts
// lib/absenteismo/episodios.ts
import { addDias } from './datas'

export interface PeriodoComId {
  id: string
  data_inicio: string
  data_fim: string
}

/**
 * Agrupa atestados de UM funcionário em episódios: o seguinte entra no grupo quando começa
 * até o dia seguinte ao fim mais tardio do grupo (cobre emendados, passagem de bastão e aninhados).
 * O primeiro elemento de cada grupo (por início) identifica o episódio.
 */
export function agruparAtestadosContiguos<T extends PeriodoComId>(atestados: T[]): T[][] {
  const ordenados = [...atestados].sort(
    (a, b) => a.data_inicio.localeCompare(b.data_inicio) || a.data_fim.localeCompare(b.data_fim),
  )
  const grupos: T[][] = []
  let fimDoGrupo = ''
  for (const a of ordenados) {
    if (grupos.length > 0 && a.data_inicio <= addDias(fimDoGrupo, 1)) {
      grupos[grupos.length - 1].push(a)
      if (a.data_fim > fimDoGrupo) fimDoGrupo = a.data_fim
    } else {
      grupos.push([a])
      fimDoGrupo = a.data_fim
    }
  }
  return grupos
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run lib/absenteismo/episodios.test.ts`
Expected: PASS (6 testes).

- [ ] **Step 5: Commit**

```bash
git add lib/absenteismo/episodios.ts lib/absenteismo/episodios.test.ts
git commit -m "feat(absenteismo): agrupa atestados contiguos em episodios

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Tipos do motor

**Files:**
- Create: `lib/absenteismo/tipos.ts`

Sem teste próprio (só tipos); o compilador valida no Task 7.

- [ ] **Step 1: Criar os tipos**

```ts
// lib/absenteismo/tipos.ts
import type { ClasseDisponibilidade, ClasseTaxa } from './classificar'

export interface FuncionarioCalc {
  id: string
  nome: string
  registro: string | null
  admissao: string | null
  desligamento: string | null
  /** status desligado/rescisão indireta sem data de desligamento: fora do quadro. */
  fora_do_quadro: boolean
  regime: string
  posto_id: string | null
  posto_nome: string
  secretaria: string
  supervisor_id: string | null
  supervisor: string
}

export interface FaltaIn {
  id: string
  funcionario_id: string
  data_falta: string
  data_fim: string | null
  dias: number
  tipo: string
  /** true quando `faltas.confirmada_em` está preenchido (confirmada pelo supervisor). */
  confirmada: boolean
  observacao: string | null
}

export interface AtestadoIn {
  id: string
  funcionario_id: string
  data_inicio: string
  data_fim: string
  cid_codigo: string | null
  sem_cid: boolean
  motivo: string | null
}

export interface AfastamentoIn {
  id: string
  funcionario_id: string
  data_inicio: string
  data_fim_prevista: string | null
  data_fim_real: string | null
  motivo: string | null
}

export interface FeriasIn {
  id: string
  funcionario_id: string
  data_inicio: string
  data_fim: string
}

/** Advertência de grau suspensão: `dias` jornadas programadas a partir de `data_inicio`. */
export interface SuspensaoIn {
  id: string
  funcionario_id: string
  data_inicio: string
  dias: number
}

export interface DadosAbsenteismo {
  funcionarios: FuncionarioCalc[]
  faltas: FaltaIn[]
  atestados: AtestadoIn[]
  afastamentos: AfastamentoIn[]
  ferias: FeriasIn[]
  suspensoes: SuspensaoIn[]
}

export interface EntradaCalculo extends DadosAbsenteismo {
  inicio: string
  fim: string
}

export interface Episodio {
  /** id do registro de origem (falta) ou do primeiro atestado do episódio. */
  id: string
  funcionario_id: string
  classe: ClasseTaxa
  /** primeiro e último dia do episódio dentro do período. */
  inicio: string
  fim: string
  /** jornadas programadas perdidas por este episódio (pode ser 0 se cair em dia fora da escala). */
  jornadas: number
  /** só faltas: confirmada pelo supervisor. null para atestado. */
  confirmada: boolean | null
  origem_ids: string[]
}

export interface PorFuncionario {
  programadas: number
  perdidas: number
  episodios: number
}

export interface ResultadoCalculo {
  inicio: string
  fim: string
  dias_corridos: number
  quadro_medio: number
  jornadas_programadas: number
  jornadas_perdidas: number
  perdidas_por_classe: Record<ClasseTaxa, number>
  episodios: Episodio[]
  episodios_por_classe: Record<ClasseTaxa, number>
  funcionarios_afetados: number
  funcionarios_reincidentes: number
  /** dias CORRIDOS-pessoa indisponíveis por classe (fora da taxa). */
  disponibilidade_dias: Record<ClasseDisponibilidade, number>
  /** soma de `disponibilidade_dias`. */
  indisponiveis_dias_pessoa: number
  /** jornadas programadas em suspensão disciplinar (fora da taxa). */
  suspensao_jornadas: number
  por_funcionario: Record<string, PorFuncionario>
}
```

- [ ] **Step 2: Compilar**

Run: `npx tsc --noEmit`
Expected: sem erros novos (o arquivo só declara tipos).

- [ ] **Step 3: Commit**

```bash
git add lib/absenteismo/tipos.ts
git commit -m "feat(absenteismo): tipos de entrada e saida do motor

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: `calcularPeriodo` (núcleo)

**Files:**
- Create: `lib/absenteismo/calculo.ts`
- Test: `lib/absenteismo/calculo.test.ts`

Calendário de referência (novembro/2026): 1/11 é domingo; feriados em 2/11 (seg), 15/11 (dom) e 20/11 (sex). Dias úteis 5x2 do mês: 3,4,5,6 · 9–13 · 16–19 · 23–27 · 30 = **19**.

- [ ] **Step 1: Escrever o teste que falha**

```ts
// lib/absenteismo/calculo.test.ts
import { describe, it, expect } from 'vitest'
import { calcularPeriodo } from './calculo'
import type { EntradaCalculo, FaltaIn, FuncionarioCalc } from './tipos'

const F = (over: Partial<FuncionarioCalc> = {}): FuncionarioCalc => ({
  id: 'f1', nome: 'Fulano', registro: '1', admissao: '2020-01-01', desligamento: null,
  fora_do_quadro: false, regime: '5x2', posto_id: 'p1', posto_nome: 'Posto 1', secretaria: 'SME',
  supervisor_id: null, supervisor: '—', ...over,
})
const base = (over: Partial<EntradaCalculo> = {}): EntradaCalculo => ({
  inicio: '2026-11-01', fim: '2026-11-30', funcionarios: [F()],
  faltas: [], atestados: [], afastamentos: [], ferias: [], suspensoes: [], ...over,
})
const falta = (over: Partial<FaltaIn> = {}): FaltaIn => ({
  id: 'fa1', funcionario_id: 'f1', data_falta: '2026-11-03', data_fim: null, dias: 1,
  tipo: 'sem_justificativa', confirmada: true, observacao: null, ...over,
})
const atestado = (over: Partial<{ id: string; data_inicio: string; data_fim: string }> = {}) => ({
  id: 'at1', funcionario_id: 'f1', data_inicio: '2026-11-03', data_fim: '2026-11-09',
  cid_codigo: null, sem_cid: false, motivo: null, ...over,
})
const afast = (over: Partial<{ id: string; data_inicio: string; data_fim_real: string | null; data_fim_prevista: string | null; motivo: string | null }> = {}) => ({
  id: 'af1', funcionario_id: 'f1', data_inicio: '2026-11-10', data_fim_prevista: null,
  data_fim_real: null, motivo: 'INSS - Doença', ...over,
})

describe('calcularPeriodo — base', () => {
  it('sem ausências: 19 jornadas programadas, 0 perdidas', () => {
    const r = calcularPeriodo(base())
    expect(r.jornadas_programadas).toBe(19)
    expect(r.jornadas_perdidas).toBe(0)
    expect(r.episodios).toEqual([])
    expect(r.quadro_medio).toBe(1)
    expect(r.dias_corridos).toBe(30)
  })
  it('sem funcionários: tudo zero', () => {
    const r = calcularPeriodo(base({ funcionarios: [] }))
    expect(r.jornadas_programadas).toBe(0)
    expect(r.quadro_medio).toBe(0)
  })
  it('eventos de funcionário que não está na lista são ignorados', () => {
    const r = calcularPeriodo(base({ faltas: [falta({ funcionario_id: 'outro' })] }))
    expect(r.jornadas_perdidas).toBe(0)
  })
})

describe('calcularPeriodo — faltas', () => {
  it('falta de 1 dia: 1 jornada, 1 episódio injustificado', () => {
    const r = calcularPeriodo(base({ faltas: [falta()] }))
    expect(r.jornadas_perdidas).toBe(1)
    expect(r.perdidas_por_classe.falta_injustificada).toBe(1)
    expect(r.episodios).toHaveLength(1)
    expect(r.episodios[0]).toMatchObject({ id: 'fa1', classe: 'falta_injustificada', jornadas: 1, confirmada: true })
    expect(r.funcionarios_afetados).toBe(1)
    expect(r.funcionarios_reincidentes).toBe(0)
  })
  it('falta que atravessa o fim de semana conta só os dias programados', () => {
    // 12/11 (qui) a 17/11 (ter): programados 12, 13, 16, 17
    const r = calcularPeriodo(base({ faltas: [falta({ data_falta: '2026-11-12', data_fim: '2026-11-17', dias: 6 })] }))
    expect(r.jornadas_perdidas).toBe(4)
    expect(r.episodios).toHaveLength(1)
    expect(r.episodios[0]).toMatchObject({ inicio: '2026-11-12', fim: '2026-11-17', jornadas: 4 })
  })
  it('falta é cortada no limite do período', () => {
    // 27/11 a 03/12 dentro de novembro: 27 e 30 (27 sex, 30 seg)
    const r = calcularPeriodo(base({ faltas: [falta({ data_falta: '2026-11-27', data_fim: '2026-12-03', dias: 7 })] }))
    expect(r.jornadas_perdidas).toBe(2)
  })
  it('sem data_fim usa data_falta + dias - 1', () => {
    const r = calcularPeriodo(base({ faltas: [falta({ data_falta: '2026-11-09', dias: 5 })] }))
    expect(r.jornadas_perdidas).toBe(5)
  })
  it('classes: justificada, declaração e atraso', () => {
    const r = calcularPeriodo(base({
      faltas: [
        falta({ id: 'a', data_falta: '2026-11-03', tipo: 'justificada' }),
        falta({ id: 'b', data_falta: '2026-11-04', tipo: 'declaracao' }),
        falta({ id: 'c', data_falta: '2026-11-05', tipo: 'atraso' }),
      ],
    }))
    expect(r.perdidas_por_classe.falta_justificada).toBe(2)
    expect(r.perdidas_por_classe.outras).toBe(1)
    expect(r.perdidas_por_classe.falta_injustificada).toBe(0)
  })
  it('falta pendente de confirmação carrega a marca', () => {
    const r = calcularPeriodo(base({ faltas: [falta({ confirmada: false })] }))
    expect(r.episodios[0].confirmada).toBe(false)
  })
  it('duas faltas em dias diferentes: 2 episódios, 1 afetado, 1 reincidente', () => {
    const r = calcularPeriodo(base({ faltas: [falta({ id: 'a' }), falta({ id: 'b', data_falta: '2026-11-05' })] }))
    expect(r.episodios).toHaveLength(2)
    expect(r.funcionarios_afetados).toBe(1)
    expect(r.funcionarios_reincidentes).toBe(1)
    expect(r.por_funcionario['f1']).toEqual({ programadas: 19, perdidas: 2, episodios: 2 })
  })
})

describe('calcularPeriodo — atestados', () => {
  it('atestado de 7 dias (3 a 9/11): 5 jornadas, 1 episódio', () => {
    const r = calcularPeriodo(base({ atestados: [atestado()] }))
    expect(r.jornadas_perdidas).toBe(5)
    expect(r.perdidas_por_classe.atestado).toBe(5)
    expect(r.episodios).toHaveLength(1)
  })
  it('atestado de 20 dias: 15 primeiros dias na taxa, o resto vira prolongado fora da taxa', () => {
    // 3 a 22/11: dias 3..17 na taxa (11 programados); 18..22 prolongado (5 corridos, 2 programados: 18 e 19)
    const r = calcularPeriodo(base({ atestados: [atestado({ data_fim: '2026-11-22' })] }))
    expect(r.jornadas_perdidas).toBe(11)
    expect(r.disponibilidade_dias.atestado_prolongado).toBe(5)
    expect(r.jornadas_programadas).toBe(17)
  })
  it('atestados emendados são 1 episódio só', () => {
    const r = calcularPeriodo(base({
      atestados: [atestado({ id: 'a', data_inicio: '2026-11-03', data_fim: '2026-11-04' }), atestado({ id: 'b', data_inicio: '2026-11-05', data_fim: '2026-11-06' })],
    }))
    expect(r.episodios).toHaveLength(1)
    expect(r.episodios[0].origem_ids).toEqual(['a', 'b'])
    expect(r.jornadas_perdidas).toBe(4)
  })
  it('falta no mesmo dia de atestado: o dia fica com o atestado, sem episódio de falta', () => {
    const r = calcularPeriodo(base({
      atestados: [atestado({ data_inicio: '2026-11-03', data_fim: '2026-11-05' })],
      faltas: [falta({ data_falta: '2026-11-04' })],
    }))
    expect(r.jornadas_perdidas).toBe(3)
    expect(r.perdidas_por_classe.falta_injustificada).toBe(0)
    expect(r.episodios).toHaveLength(1)
    expect(r.episodios[0].classe).toBe('atestado')
  })
})

describe('calcularPeriodo — disponibilidade (fora da taxa)', () => {
  it('afastamento INSS aberto desde 10/11: 21 dias corridos, 5 jornadas programadas', () => {
    const r = calcularPeriodo(base({ afastamentos: [afast()] }))
    expect(r.disponibilidade_dias.afastamento_inss).toBe(21)
    expect(r.jornadas_programadas).toBe(5)
    expect(r.jornadas_perdidas).toBe(0)
    expect(r.episodios).toEqual([])
    expect(r.indisponiveis_dias_pessoa).toBe(21)
  })
  it('afastamento vence atestado no mesmo dia', () => {
    const r = calcularPeriodo(base({
      afastamentos: [afast({ data_inicio: '2026-11-03', data_fim_real: '2026-11-10' })],
      atestados: [atestado({ data_inicio: '2026-11-03', data_fim: '2026-11-05' })],
    }))
    expect(r.jornadas_perdidas).toBe(0)
    expect(r.episodios).toEqual([])
    expect(r.disponibilidade_dias.afastamento_inss).toBe(8)
  })
  it('afastamento fechado termina em data_fim_real', () => {
    const r = calcularPeriodo(base({ afastamentos: [afast({ data_inicio: '2026-11-03', data_fim_real: '2026-11-05' })] }))
    expect(r.disponibilidade_dias.afastamento_inss).toBe(3)
  })
  it('classes de afastamento: licença legal e outros', () => {
    const r = calcularPeriodo(base({
      funcionarios: [F({ id: 'f1' }), F({ id: 'f2' })],
      afastamentos: [
        afast({ id: 'x', motivo: 'Licença Maternidade', data_inicio: '2026-11-01', data_fim_real: '2026-11-03' }),
        { ...afast({ id: 'y', motivo: 'Outros', data_inicio: '2026-11-01', data_fim_real: '2026-11-02' }), funcionario_id: 'f2' },
      ],
    }))
    expect(r.disponibilidade_dias.licenca_legal).toBe(3)
    expect(r.disponibilidade_dias.afastamento_outros).toBe(2)
  })
  it('férias de 9 a 20/11: 12 dias corridos, 9 jornadas fora da base', () => {
    const r = calcularPeriodo(base({ ferias: [{ id: 'fe1', funcionario_id: 'f1', data_inicio: '2026-11-09', data_fim: '2026-11-20' }] }))
    expect(r.disponibilidade_dias.ferias).toBe(12)
    expect(r.jornadas_programadas).toBe(10)
    expect(r.jornadas_perdidas).toBe(0)
  })
})

describe('calcularPeriodo — suspensão (fora da taxa)', () => {
  it('falta tipo suspensao não é perdida nem programada', () => {
    const r = calcularPeriodo(base({ faltas: [falta({ tipo: 'suspensao', data_falta: '2026-11-24', data_fim: '2026-11-25', dias: 2 })] }))
    expect(r.suspensao_jornadas).toBe(2)
    expect(r.jornadas_perdidas).toBe(0)
    expect(r.jornadas_programadas).toBe(17)
    expect(r.episodios).toEqual([])
  })
  it('advertência de suspensão: primeiros N dias programados a partir da data', () => {
    const r = calcularPeriodo(base({ suspensoes: [{ id: 's1', funcionario_id: 'f1', data_inicio: '2026-11-24', dias: 2 }] }))
    expect(r.suspensao_jornadas).toBe(2)
    expect(r.jornadas_programadas).toBe(17)
  })
})

describe('calcularPeriodo — janela do funcionário', () => {
  it('admitido em 16/11: 10 jornadas e quadro médio 0,5', () => {
    const r = calcularPeriodo(base({ funcionarios: [F({ admissao: '2026-11-16' })] }))
    expect(r.jornadas_programadas).toBe(10)
    expect(r.quadro_medio).toBe(0.5)
  })
  it('desligado em 10/11: 5 jornadas (3,4,5,6,9)', () => {
    const r = calcularPeriodo(base({ funcionarios: [F({ desligamento: '2026-11-10' })] }))
    expect(r.jornadas_programadas).toBe(5)
  })
  it('fora_do_quadro é ignorado inclusive nas ausências', () => {
    const r = calcularPeriodo(base({ funcionarios: [F({ fora_do_quadro: true })], faltas: [falta()] }))
    expect(r.jornadas_programadas).toBe(0)
    expect(r.episodios).toEqual([])
  })
  it('período parcial (1 a 19/11): programadas só até o dia 19 = 13', () => {
    const r = calcularPeriodo(base({ fim: '2026-11-19' }))
    expect(r.jornadas_programadas).toBe(13)
  })
})

describe('calcularPeriodo — escalas', () => {
  it('12x36 conta todos os dias menos feriados (27 em novembro)', () => {
    const r = calcularPeriodo(base({ funcionarios: [F({ regime: '12x36' })] }))
    expect(r.jornadas_programadas).toBe(27)
  })
  it('falta em fim de semana na 5x2: 0 jornadas, mas o episódio existe', () => {
    const r = calcularPeriodo(base({ faltas: [falta({ data_falta: '2026-11-07' })] }))
    expect(r.jornadas_perdidas).toBe(0)
    expect(r.episodios).toHaveLength(1)
    expect(r.episodios[0].jornadas).toBe(0)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run lib/absenteismo/calculo.test.ts`
Expected: FAIL com "Failed to resolve import './calculo'".

- [ ] **Step 3: Implementar**

```ts
// lib/absenteismo/calculo.ts
import { addDias, diffDias, listarDias, maxData, minData } from './datas'
import {
  LIMITE_DIAS_ATESTADO_EMPRESA,
  classificarAfastamento,
  classificarFalta,
  type ClasseDisponibilidade,
  type ClasseTaxa,
} from './classificar'
import { agruparAtestadosContiguos } from './episodios'
import { diasProgramados, feriadosDoPeriodo } from './jornadas'
import { janelaDoFuncionario, quadroMedio } from './quadro'
import type { EntradaCalculo, Episodio, PorFuncionario, ResultadoCalculo } from './tipos'

type EstadoDia =
  | { tipo: 'taxa'; classe: ClasseTaxa; dono: string }
  | { tipo: 'disp'; classe: ClasseDisponibilidade }
  | { tipo: 'susp' }

const zeroTaxa = (): Record<ClasseTaxa, number> => ({
  falta_injustificada: 0, falta_justificada: 0, atestado: 0, outras: 0,
})
const zeroDisp = (): Record<ClasseDisponibilidade, number> => ({
  afastamento_inss: 0, licenca_legal: 0, afastamento_outros: 0, atestado_prolongado: 0, ferias: 0,
})

/** Faltas são pintadas nesta ordem; a última pintada vence no mesmo dia. */
const ORDEM_FALTAS: ClasseTaxa[] = ['outras', 'falta_injustificada', 'falta_justificada']

function agruparPorFuncionario<T extends { funcionario_id: string }>(lista: T[]): Map<string, T[]> {
  const m = new Map<string, T[]>()
  for (const x of lista) {
    const atual = m.get(x.funcionario_id)
    if (atual) atual.push(x)
    else m.set(x.funcionario_id, [x])
  }
  return m
}

const fimDaFalta = (f: { data_falta: string; data_fim: string | null; dias: number }): string =>
  f.data_fim ?? addDias(f.data_falta, Math.max(f.dias, 1) - 1)

/**
 * Calcula o período [inicio, fim] para o conjunto de funcionários recebido.
 *
 * Precedência por dia (último pintado vence): falta outras < falta injustificada < falta justificada
 * < suspensão < atestado (até o 15º dia) < atestado prolongado < férias < afastamento.
 * Cada dia pertence a UMA classe. Classes de disponibilidade e suspensão saem da base
 * (jornadas programadas); classes da taxa contam como perdidas quando o dia é programado.
 */
export function calcularPeriodo(entrada: EntradaCalculo): ResultadoCalculo {
  const { inicio, fim } = entrada
  // folga de 45 dias nos dois lados: suspensões que começam antes do período e terminam dentro dele
  const feriados = feriadosDoPeriodo(addDias(inicio, -45), addDias(fim, 45))

  const faltasPor = agruparPorFuncionario(entrada.faltas)
  const atestadosPor = agruparPorFuncionario(entrada.atestados)
  const afastPor = agruparPorFuncionario(entrada.afastamentos)
  const feriasPor = agruparPorFuncionario(entrada.ferias)
  const suspPor = agruparPorFuncionario(entrada.suspensoes)

  let programadas = 0
  let perdidas = 0
  let suspensaoJornadas = 0
  let afetados = 0
  let reincidentes = 0
  const perdidasPorClasse = zeroTaxa()
  const dispDias = zeroDisp()
  const episodios: Episodio[] = []
  const porFuncionario: Record<string, PorFuncionario> = {}

  for (const f of entrada.funcionarios) {
    const janela = janelaDoFuncionario(f, inicio, fim)
    if (!janela) continue

    const prog = diasProgramados(f.regime, janela.inicio, janela.fim, feriados)
    const progSet = new Set(prog)
    const estado = new Map<string, EstadoDia>()
    const origem = new Map<string, { classe: ClasseTaxa; ids: string[]; confirmada: boolean | null }>()

    const pintar = (de: string, ate: string, e: EstadoDia) => {
      const a = maxData(de, janela.inicio)
      const b = minData(ate, janela.fim)
      if (a > b) return
      for (const d of listarDias(a, b)) estado.set(d, e)
    }

    // 1) faltas (injustificada/justificada/outras) e suspensão
    const faltasF = faltasPor.get(f.id) ?? []
    for (const classe of ORDEM_FALTAS) {
      for (const x of faltasF) {
        if (classificarFalta(x.tipo) !== classe) continue
        origem.set(x.id, { classe, ids: [x.id], confirmada: x.confirmada })
        pintar(x.data_falta, fimDaFalta(x), { tipo: 'taxa', classe, dono: x.id })
      }
    }
    for (const x of faltasF) {
      if (classificarFalta(x.tipo) === 'suspensao') pintar(x.data_falta, fimDaFalta(x), { tipo: 'susp' })
    }
    for (const s of suspPor.get(f.id) ?? []) {
      const dias = diasProgramados(f.regime, s.data_inicio, addDias(s.data_inicio, s.dias * 2 + 14), feriados).slice(0, s.dias)
      for (const d of dias) pintar(d, d, { tipo: 'susp' })
    }

    // 2) atestados: até o 15º dia na taxa; do 16º em diante, prolongado (disponibilidade)
    const atestadosF = atestadosPor.get(f.id) ?? []
    const donoDoAtestado = new Map<string, string>()
    for (const grupo of agruparAtestadosContiguos(atestadosF)) {
      origem.set(grupo[0].id, { classe: 'atestado', ids: grupo.map(a => a.id), confirmada: null })
      for (const a of grupo) donoDoAtestado.set(a.id, grupo[0].id)
    }
    for (const a of atestadosF) {
      const corte = addDias(a.data_inicio, LIMITE_DIAS_ATESTADO_EMPRESA - 1)
      pintar(a.data_inicio, minData(a.data_fim, corte), {
        tipo: 'taxa', classe: 'atestado', dono: donoDoAtestado.get(a.id) ?? a.id,
      })
    }
    for (const a of atestadosF) {
      const corte = addDias(a.data_inicio, LIMITE_DIAS_ATESTADO_EMPRESA - 1)
      if (a.data_fim > corte) pintar(addDias(corte, 1), a.data_fim, { tipo: 'disp', classe: 'atestado_prolongado' })
    }

    // 3) férias e afastamentos (maior precedência)
    for (const x of feriasPor.get(f.id) ?? []) {
      pintar(x.data_inicio, x.data_fim, { tipo: 'disp', classe: 'ferias' })
    }
    for (const a of afastPor.get(f.id) ?? []) {
      pintar(a.data_inicio, a.data_fim_real ?? a.data_fim_prevista ?? fim, {
        tipo: 'disp', classe: classificarAfastamento(a.motivo),
      })
    }

    // 4) contabilizar dia a dia
    let progF = 0
    let perdF = 0
    const creditados = new Map<string, string[]>()
    for (const d of listarDias(janela.inicio, janela.fim)) {
      const e = estado.get(d)
      const programado = progSet.has(d)
      if (!e) {
        if (programado) progF++
        continue
      }
      if (e.tipo === 'disp') {
        dispDias[e.classe]++
        continue
      }
      if (e.tipo === 'susp') {
        if (programado) suspensaoJornadas++
        continue
      }
      const lista = creditados.get(e.dono)
      if (lista) lista.push(d)
      else creditados.set(e.dono, [d])
      if (programado) {
        progF++
        perdF++
        perdidasPorClasse[e.classe]++
      }
    }

    // 5) episódios (só os que ficaram com pelo menos um dia depois da precedência)
    let nEpisodios = 0
    Array.from(creditados.entries()).forEach(([dono, dias]) => {
      const o = origem.get(dono)
      if (!o) return
      episodios.push({
        id: dono,
        funcionario_id: f.id,
        classe: o.classe,
        inicio: dias[0],
        fim: dias[dias.length - 1],
        jornadas: dias.filter(d => progSet.has(d)).length,
        confirmada: o.confirmada,
        origem_ids: o.ids,
      })
      nEpisodios++
    })

    programadas += progF
    perdidas += perdF
    if (nEpisodios >= 1) afetados++
    if (nEpisodios >= 2) reincidentes++
    porFuncionario[f.id] = { programadas: progF, perdidas: perdF, episodios: nEpisodios }
  }

  const episodiosPorClasse = zeroTaxa()
  for (const ep of episodios) episodiosPorClasse[ep.classe]++

  const indisponiveis =
    dispDias.afastamento_inss + dispDias.licenca_legal + dispDias.afastamento_outros +
    dispDias.atestado_prolongado + dispDias.ferias

  return {
    inicio,
    fim,
    dias_corridos: diffDias(inicio, fim) + 1,
    quadro_medio: quadroMedio(entrada.funcionarios, inicio, fim),
    jornadas_programadas: programadas,
    jornadas_perdidas: perdidas,
    perdidas_por_classe: perdidasPorClasse,
    episodios,
    episodios_por_classe: episodiosPorClasse,
    funcionarios_afetados: afetados,
    funcionarios_reincidentes: reincidentes,
    disponibilidade_dias: dispDias,
    indisponiveis_dias_pessoa: indisponiveis,
    suspensao_jornadas: suspensaoJornadas,
    por_funcionario: porFuncionario,
  }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run lib/absenteismo/calculo.test.ts`
Expected: PASS (todos os testes do arquivo). Se algum número divergir, conferir primeiro o calendário de referência acima antes de mexer no código.

- [ ] **Step 5: Commit**

```bash
git add lib/absenteismo/calculo.ts lib/absenteismo/calculo.test.ts
git commit -m "feat(absenteismo): calcularPeriodo com precedencia por dia, episodios e disponibilidade

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Filtros de funcionários

**Files:**
- Create: `lib/absenteismo/filtros.ts`
- Test: `lib/absenteismo/filtros.test.ts`

Os filtros se aplicam à lista de funcionários antes do cálculo; assim quadro, base e ausências ficam todos no mesmo recorte.

- [ ] **Step 1: Escrever o teste que falha**

```ts
// lib/absenteismo/filtros.test.ts
import { describe, it, expect } from 'vitest'
import { filtrarFuncionarios } from './filtros'
import type { FuncionarioCalc } from './tipos'

const F = (over: Partial<FuncionarioCalc>): FuncionarioCalc => ({
  id: 'x', nome: 'N', registro: null, admissao: null, desligamento: null, fora_do_quadro: false,
  regime: '5x2', posto_id: 'p1', posto_nome: 'P1', secretaria: 'SME', supervisor_id: 's1', supervisor: 'Sup 1', ...over,
})
const lista = [
  F({ id: 'a' }),
  F({ id: 'b', secretaria: 'SMEL', posto_id: 'p2', supervisor_id: 's2' }),
  F({ id: 'c', secretaria: 'SME', posto_id: 'p3', supervisor_id: 's1' }),
]
const ids = (l: FuncionarioCalc[]) => l.map(f => f.id)

describe('filtrarFuncionarios', () => {
  it('sem filtros devolve todos', () => {
    expect(ids(filtrarFuncionarios(lista, {}))).toEqual(['a', 'b', 'c'])
  })
  it('por secretaria', () => {
    expect(ids(filtrarFuncionarios(lista, { secretaria: 'SME' }))).toEqual(['a', 'c'])
  })
  it('por posto', () => {
    expect(ids(filtrarFuncionarios(lista, { posto_id: 'p2' }))).toEqual(['b'])
  })
  it('por supervisor', () => {
    expect(ids(filtrarFuncionarios(lista, { supervisor_id: 's1' }))).toEqual(['a', 'c'])
  })
  it('filtros combinam (E)', () => {
    expect(ids(filtrarFuncionarios(lista, { secretaria: 'SME', posto_id: 'p3' }))).toEqual(['c'])
  })
  it('valor nulo ou vazio é "todos"', () => {
    expect(ids(filtrarFuncionarios(lista, { secretaria: null, posto_id: '' }))).toEqual(['a', 'b', 'c'])
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run lib/absenteismo/filtros.test.ts`
Expected: FAIL com "Failed to resolve import './filtros'".

- [ ] **Step 3: Implementar**

```ts
// lib/absenteismo/filtros.ts
import type { FuncionarioCalc } from './tipos'

export interface FiltrosAbsenteismo {
  secretaria?: string | null
  posto_id?: string | null
  supervisor_id?: string | null
}

/** Secretaria, posto e supervisor são os ATUAIS do funcionário (não há histórico de posto por dia). */
export function filtrarFuncionarios(funcs: FuncionarioCalc[], filtros: FiltrosAbsenteismo): FuncionarioCalc[] {
  return funcs.filter(f =>
    (!filtros.secretaria || f.secretaria === filtros.secretaria) &&
    (!filtros.posto_id || f.posto_id === filtros.posto_id) &&
    (!filtros.supervisor_id || f.supervisor_id === filtros.supervisor_id),
  )
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run lib/absenteismo/filtros.test.ts`
Expected: PASS (6 testes).

- [ ] **Step 5: Commit**

```bash
git add lib/absenteismo/filtros.ts lib/absenteismo/filtros.test.ts
git commit -m "feat(absenteismo): filtro de funcionarios por secretaria, posto e supervisor

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 9: KPIs e variações

**Files:**
- Create: `lib/absenteismo/kpis.ts`
- Test: `lib/absenteismo/kpis.test.ts`

Fórmulas (spec seção 5): taxa = perdidas ÷ programadas × 100; IF = episódios ÷ quadro médio × 100; IG = perdidas ÷ quadro médio × 100; duração média = perdidas ÷ episódios; % afetados = afetados ÷ quadro médio × 100; reincidência = reincidentes ÷ afetados × 100.

- [ ] **Step 1: Escrever o teste que falha**

```ts
// lib/absenteismo/kpis.test.ts
import { describe, it, expect } from 'vitest'
import { calcularPeriodo } from './calculo'
import { calcularKpis, variacaoPercentual, variacaoPontos } from './kpis'
import type { EntradaCalculo, FuncionarioCalc } from './tipos'

const F = (id: string): FuncionarioCalc => ({
  id, nome: id, registro: null, admissao: '2020-01-01', desligamento: null, fora_do_quadro: false,
  regime: '5x2', posto_id: null, posto_nome: '—', secretaria: 'SME', supervisor_id: null, supervisor: '—',
})
const entrada = (over: Partial<EntradaCalculo>): EntradaCalculo => ({
  inicio: '2026-11-01', fim: '2026-11-30', funcionarios: [F('f1')],
  faltas: [], atestados: [], afastamentos: [], ferias: [], suspensoes: [], ...over,
})
const falta = (id: string, funcionario_id: string, data_falta: string) => ({
  id, funcionario_id, data_falta, data_fim: null, dias: 1, tipo: 'sem_justificativa', confirmada: true, observacao: null,
})

describe('calcularKpis', () => {
  it('1 falta, 1 funcionário: 1/19 de taxa, IF 100, IG 100, duração 1', () => {
    const k = calcularKpis(calcularPeriodo(entrada({ faltas: [falta('a', 'f1', '2026-11-03')] })))
    expect(k.taxa).toBeCloseTo((1 / 19) * 100, 6)
    expect(k.indice_frequencia).toBeCloseTo(100, 6)
    expect(k.indice_gravidade).toBeCloseTo(100, 6)
    expect(k.duracao_media).toBe(1)
    expect(k.funcionarios_afetados).toBe(1)
    expect(k.pct_afetados).toBeCloseTo(100, 6)
    expect(k.taxa_reincidencia).toBe(0)
  })
  it('2 funcionários, 1 afetado com 2 episódios', () => {
    const k = calcularPeriodo(entrada({
      funcionarios: [F('f1'), F('f2')],
      faltas: [falta('a', 'f1', '2026-11-03'), falta('b', 'f1', '2026-11-05')],
    }))
    const r = calcularKpis(k)
    expect(r.episodios).toBe(2)
    expect(r.indice_frequencia).toBeCloseTo(100, 6) // 2 episódios / 2 quadro * 100
    expect(r.pct_afetados).toBeCloseTo(50, 6)
    expect(r.taxa_reincidencia).toBeCloseTo(100, 6)
    expect(r.duracao_media).toBe(1)
    expect(r.taxa).toBeCloseTo((2 / 38) * 100, 6)
  })
  it('sem dados: tudo zero, sem NaN', () => {
    const r = calcularKpis(calcularPeriodo(entrada({ funcionarios: [] })))
    expect(r).toMatchObject({ taxa: 0, indice_frequencia: 0, indice_gravidade: 0, duracao_media: 0, pct_afetados: 0, taxa_reincidencia: 0 })
  })
})

describe('variações', () => {
  it('percentual relativo; null quando o anterior é zero', () => {
    expect(variacaoPercentual(90, 100)).toBeCloseTo(-10, 6)
    expect(variacaoPercentual(5, 0)).toBeNull()
  })
  it('pontos percentuais para taxas', () => {
    expect(variacaoPontos(2.9, 3.3)).toBeCloseTo(-0.4, 6)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run lib/absenteismo/kpis.test.ts`
Expected: FAIL com "Failed to resolve import './kpis'".

- [ ] **Step 3: Implementar**

```ts
// lib/absenteismo/kpis.ts
import type { ResultadoCalculo } from './tipos'

export interface Kpis {
  /** jornadas perdidas ÷ jornadas programadas × 100 */
  taxa: number
  jornadas_perdidas: number
  episodios: number
  funcionarios_afetados: number
  quadro_medio: number
  /** episódios ÷ quadro médio × 100 (IF) */
  indice_frequencia: number
  /** jornadas perdidas ÷ quadro médio × 100 (IG) */
  indice_gravidade: number
  /** jornadas perdidas ÷ episódios */
  duracao_media: number
  /** afetados ÷ quadro médio × 100 */
  pct_afetados: number
  /** afetados com 2+ episódios ÷ afetados × 100 */
  taxa_reincidencia: number
}

const razao = (num: number, den: number): number => (den > 0 ? num / den : 0)

export function calcularKpis(r: ResultadoCalculo): Kpis {
  const episodios = r.episodios.length
  return {
    taxa: razao(r.jornadas_perdidas, r.jornadas_programadas) * 100,
    jornadas_perdidas: r.jornadas_perdidas,
    episodios,
    funcionarios_afetados: r.funcionarios_afetados,
    quadro_medio: r.quadro_medio,
    indice_frequencia: razao(episodios, r.quadro_medio) * 100,
    indice_gravidade: razao(r.jornadas_perdidas, r.quadro_medio) * 100,
    duracao_media: razao(r.jornadas_perdidas, episodios),
    pct_afetados: razao(r.funcionarios_afetados, r.quadro_medio) * 100,
    taxa_reincidencia: razao(r.funcionarios_reincidentes, r.funcionarios_afetados) * 100,
  }
}

/** Variação relativa em %, para contagens. null quando não há base (anterior = 0). */
export function variacaoPercentual(atual: number, anterior: number): number | null {
  return anterior === 0 ? null : ((atual - anterior) / anterior) * 100
}

/** Diferença em pontos percentuais, para taxas. */
export function variacaoPontos(atual: number, anterior: number): number {
  return atual - anterior
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run lib/absenteismo/kpis.test.ts`
Expected: PASS (5 testes).

- [ ] **Step 5: Commit**

```bash
git add lib/absenteismo/kpis.ts lib/absenteismo/kpis.test.ts
git commit -m "feat(absenteismo): KPIs (taxa, IF, IG, duracao, reincidencia) e variacoes

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Período efetivo e série mensal

**Files:**
- Create: `lib/absenteismo/series.ts`
- Test: `lib/absenteismo/series.test.ts`

`periodoEfetivo` aplica as duas regras de mês parcial do spec: não calcular antes de `dadosDesde` (2026-06-18) e não calcular depois de `hoje`.

- [ ] **Step 1: Escrever o teste que falha**

```ts
// lib/absenteismo/series.test.ts
import { describe, it, expect } from 'vitest'
import { mesesAte, periodoEfetivo, calcularSerieMensal } from './series'
import type { DadosAbsenteismo } from './tipos'

describe('mesesAte', () => {
  it('devolve n meses em ordem crescente terminando no informado', () => {
    expect(mesesAte(2026, 11, 3)).toEqual([{ ano: 2026, mes: 9 }, { ano: 2026, mes: 10 }, { ano: 2026, mes: 11 }])
  })
  it('atravessa a virada de ano', () => {
    expect(mesesAte(2026, 2, 3)).toEqual([{ ano: 2025, mes: 12 }, { ano: 2026, mes: 1 }, { ano: 2026, mes: 2 }])
  })
})

describe('periodoEfetivo', () => {
  const desde = '2026-06-18'
  const hoje = '2026-11-19'
  it('mês cheio no meio do histórico não é parcial', () => {
    expect(periodoEfetivo('2026-08-01', '2026-08-31', desde, hoje)).toEqual({ inicio: '2026-08-01', fim: '2026-08-31', parcial: false })
  })
  it('mês que contém dadosDesde começa nele e é parcial', () => {
    expect(periodoEfetivo('2026-06-01', '2026-06-30', desde, hoje)).toEqual({ inicio: '2026-06-18', fim: '2026-06-30', parcial: true })
  })
  it('mês corrente vai só até hoje e é parcial', () => {
    expect(periodoEfetivo('2026-11-01', '2026-11-30', desde, hoje)).toEqual({ inicio: '2026-11-01', fim: '2026-11-19', parcial: true })
  })
  it('mês inteiro antes de dadosDesde ou depois de hoje: null', () => {
    expect(periodoEfetivo('2026-05-01', '2026-05-31', desde, hoje)).toBeNull()
    expect(periodoEfetivo('2026-12-01', '2026-12-31', desde, hoje)).toBeNull()
  })
})

describe('calcularSerieMensal', () => {
  const dados: DadosAbsenteismo = {
    funcionarios: [{
      id: 'f1', nome: 'F', registro: null, admissao: '2020-01-01', desligamento: null, fora_do_quadro: false,
      regime: '5x2', posto_id: null, posto_nome: '—', secretaria: 'SME', supervisor_id: null, supervisor: '—',
    }],
    faltas: [{ id: 'a', funcionario_id: 'f1', data_falta: '2026-11-03', data_fim: null, dias: 1, tipo: 'sem_justificativa', confirmada: true, observacao: null }],
    atestados: [], afastamentos: [], ferias: [], suspensoes: [],
  }
  const serie = calcularSerieMensal(dados, mesesAte(2026, 11, 3), '2026-10-10', '2026-11-19')

  it('mês sem dados vem com taxa null', () => {
    expect(serie[0]).toMatchObject({ mes: '2026-09', taxa: null, parcial: false, episodios: 0 })
  })
  it('mês que começa no meio do histórico é parcial e usa só o recorte', () => {
    expect(serie[1]).toMatchObject({ mes: '2026-10', taxa: 0, parcial: true })
  })
  it('mês corrente: base só até hoje (13 jornadas até 19/11), 1 falta', () => {
    expect(serie[2].mes).toBe('2026-11')
    expect(serie[2].parcial).toBe(true)
    expect(serie[2].taxa).toBeCloseTo((1 / 13) * 100, 6)
    expect(serie[2].episodios).toBe(1)
    expect(serie[2].jornadas_perdidas).toBe(1)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run lib/absenteismo/series.test.ts`
Expected: FAIL com "Failed to resolve import './series'".

- [ ] **Step 3: Implementar**

```ts
// lib/absenteismo/series.ts
import { maxData, mesAnterior, minData, periodoDoMes } from './datas'
import { calcularPeriodo } from './calculo'
import { calcularKpis } from './kpis'
import type { DadosAbsenteismo } from './tipos'

export interface PontoSerie {
  /** yyyy-mm */
  mes: string
  /** null quando não há dados (mês antes de `dadosDesde` ou depois de hoje) */
  taxa: number | null
  jornadas_perdidas: number
  episodios: number
  parcial: boolean
}

/** `n` meses em ordem crescente, terminando em (ano, mes). */
export function mesesAte(ano: number, mes: number, n: number): { ano: number; mes: number }[] {
  const out: { ano: number; mes: number }[] = []
  let a = ano
  let m = mes
  for (let i = 0; i < n; i++) {
    out.unshift({ ano: a, mes: m })
    const p = mesAnterior(a, m)
    a = p.ano
    m = p.mes
  }
  return out
}

/**
 * Recorta o mês ao intervalo em que há dados: começa em `dadosDesde` e termina em `hoje`.
 * `parcial` é true quando algum recorte foi aplicado. null se o recorte fica vazio.
 */
export function periodoEfetivo(
  inicioMes: string,
  fimMes: string,
  dadosDesde: string,
  hoje: string,
): { inicio: string; fim: string; parcial: boolean } | null {
  const inicio = maxData(inicioMes, dadosDesde)
  const fim = minData(fimMes, hoje)
  if (inicio > fim) return null
  return { inicio, fim, parcial: inicio !== inicioMes || fim !== fimMes }
}

/**
 * Série mensal da taxa. Usa um único mapa de regimes (o que vier em `dados.funcionarios`),
 * aproximação assumida na primeira versão (ver spec, seção 5).
 */
export function calcularSerieMensal(
  dados: DadosAbsenteismo,
  meses: { ano: number; mes: number }[],
  dadosDesde: string,
  hoje: string,
): PontoSerie[] {
  return meses.map(({ ano, mes }) => {
    const rotulo = `${ano}-${String(mes).padStart(2, '0')}`
    const mesCheio = periodoDoMes(ano, mes)
    const p = periodoEfetivo(mesCheio.inicio, mesCheio.fim, dadosDesde, hoje)
    if (!p) return { mes: rotulo, taxa: null, jornadas_perdidas: 0, episodios: 0, parcial: false }
    const k = calcularKpis(calcularPeriodo({ ...dados, inicio: p.inicio, fim: p.fim }))
    return { mes: rotulo, taxa: k.taxa, jornadas_perdidas: k.jornadas_perdidas, episodios: k.episodios, parcial: p.parcial }
  })
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run lib/absenteismo/series.test.ts`
Expected: PASS (9 testes).

- [ ] **Step 5: Commit**

```bash
git add lib/absenteismo/series.ts lib/absenteismo/series.test.ts
git commit -m "feat(absenteismo): periodo efetivo (mes parcial) e serie mensal

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Carregador de dados (Supabase)

**Files:**
- Create: `lib/absenteismo/carregar.ts`

Sem teste unitário (depende do banco): é validado pelo compilador aqui e pela execução real no Task 12. Recebe o client por parâmetro (`createClient()` do servidor é síncrono; o script usa service role).

- [ ] **Step 1: Criar o carregador**

```ts
// lib/absenteismo/carregar.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import { obterRegimesPorFuncionario } from '@/lib/turnos/regime-funcionario'
import { addDias } from './datas'
import type {
  AfastamentoIn, AtestadoIn, DadosAbsenteismo, FaltaIn, FeriasIn, FuncionarioCalc, SuspensaoIn,
} from './tipos'

type Pagina<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>

type FuncRow = {
  id: string
  nome: string
  registro: string | null
  status: string | null
  posto_id: string | null
  data_admissao: string | null
  data_desligamento: string | null
  postos: { nome: string; secretaria: string | null } | null
}
type FaltaRow = {
  id: string; funcionario_id: string; data_falta: string; data_fim: string | null
  dias: number; tipo: string; observacao: string | null; confirmada_em: string | null
}
type AtestadoRow = {
  id: string; funcionario_id: string; data_inicio: string; data_fim: string
  cid_codigo: string | null; sem_cid: boolean | null; motivo: string | null
}
type AfastRow = {
  id: string; funcionario_id: string; data_inicio: string
  data_fim_prevista: string | null; data_fim_real: string | null; motivo: string | null
}
type FeriasRow = { id: string; funcionario_id: string; data_inicio: string | null; data_fim: string | null }
type AdvRow = { id: string; funcionario_id: string; data_ocorrencia: string | null; dias_suspensao: number | null }
type SupRow = { posto_id: string; supervisor_id: string; perfis: { nome: string } | null }

const STATUS_FORA = ['desligado', 'rescisao_indireta']

/**
 * Carrega tudo que o motor precisa para o intervalo [inicio, fim] (pode ser vários meses, para a série).
 * Regra de quadro: status desligado/rescisão indireta SEM data de desligamento fica fora (`fora_do_quadro`).
 * Regime de cada funcionário resolvido no fim do intervalo (obterRegimesPorFuncionario).
 */
export async function carregarDados(
  supabase: SupabaseClient<Database>,
  janela: { inicio: string; fim: string },
): Promise<DadosAbsenteismo> {
  const { inicio, fim } = janela
  const folgaIni = addDias(inicio, -1)
  const folgaFim = addDias(fim, 1)

  const [funcRows, faltaRows, atestadoRows, afastRows, feriasRows, advRows, supRes, escalaRes] = await Promise.all([
    fetchAllRows<FuncRow>((from, to) =>
      supabase
        .from('funcionarios')
        .select('id, nome, registro, status, posto_id, data_admissao, data_desligamento, postos!posto_id ( nome, secretaria )')
        .or(`data_desligamento.is.null,data_desligamento.gte.${inicio}`)
        .order('id')
        .range(from, to) as unknown as Pagina<FuncRow>,
    ),
    fetchAllRows<FaltaRow>((from, to) =>
      supabase
        .from('faltas')
        .select('id, funcionario_id, data_falta, data_fim, dias, tipo, observacao, confirmada_em')
        .lte('data_falta', fim)
        .or(`data_fim.gte.${inicio},and(data_fim.is.null,data_falta.gte.${inicio})`)
        .order('id')
        .range(from, to) as unknown as Pagina<FaltaRow>,
    ),
    fetchAllRows<AtestadoRow>((from, to) =>
      supabase
        .from('atestados')
        .select('id, funcionario_id, data_inicio, data_fim, cid_codigo, sem_cid, motivo')
        .lte('data_inicio', folgaFim)
        .gte('data_fim', folgaIni)
        .order('id')
        .range(from, to) as unknown as Pagina<AtestadoRow>,
    ),
    fetchAllRows<AfastRow>((from, to) =>
      supabase
        .from('afastamentos')
        .select('id, funcionario_id, data_inicio, data_fim_prevista, data_fim_real, motivo')
        .lte('data_inicio', fim)
        .or(`data_fim_real.is.null,data_fim_real.gte.${inicio}`)
        .order('id')
        .range(from, to) as unknown as Pagina<AfastRow>,
    ),
    fetchAllRows<FeriasRow>((from, to) =>
      supabase
        .from('ferias')
        .select('id, funcionario_id, data_inicio, data_fim')
        .not('data_inicio', 'is', null)
        .not('data_fim', 'is', null)
        .not('status', 'in', '(cancelado,disponivel)')
        .lte('data_inicio', fim)
        .gte('data_fim', inicio)
        .order('id')
        .range(from, to) as unknown as Pagina<FeriasRow>,
    ),
    fetchAllRows<AdvRow>((from, to) =>
      supabase
        .from('advertencias')
        .select('id, funcionario_id, data_ocorrencia, dias_suspensao')
        .eq('grau', 'suspensao')
        .gt('dias_suspensao', 0)
        .gte('data_ocorrencia', addDias(inicio, -30))
        .lte('data_ocorrencia', fim)
        .order('id')
        .range(from, to) as unknown as Pagina<AdvRow>,
    ),
    supabase
      .from('config_supervisores_postos')
      .select('posto_id, supervisor_id, perfis!supervisor_id ( nome )')
      .eq('ativo', true),
    supabase.from('config_escalas_postos').select('posto_id, regime'),
  ])

  const supPorPosto = new Map<string, { id: string; nome: string }>()
  for (const s of (supRes.data ?? []) as unknown as SupRow[]) {
    if (!supPorPosto.has(s.posto_id)) supPorPosto.set(s.posto_id, { id: s.supervisor_id, nome: s.perfis?.nome ?? '—' })
  }
  const postoConfig = new Map<string, string>()
  for (const e of escalaRes.data ?? []) postoConfig.set(e.posto_id, e.regime)

  const postoPorFunc = new Map<string, string | null>()
  for (const f of funcRows) postoPorFunc.set(f.id, f.posto_id)
  const regimes = await obterRegimesPorFuncionario(supabase, funcRows.map(f => f.id), postoConfig, postoPorFunc, fim)

  const funcionarios: FuncionarioCalc[] = funcRows.map(f => {
    const sup = f.posto_id ? supPorPosto.get(f.posto_id) : undefined
    return {
      id: f.id,
      nome: f.nome,
      registro: f.registro,
      admissao: f.data_admissao,
      desligamento: f.data_desligamento,
      fora_do_quadro: STATUS_FORA.includes(f.status ?? '') && !f.data_desligamento,
      regime: regimes.get(f.id) ?? '5x2',
      posto_id: f.posto_id,
      posto_nome: f.postos?.nome ?? '—',
      secretaria: f.postos?.secretaria ?? '—',
      supervisor_id: sup?.id ?? null,
      supervisor: sup?.nome ?? '—',
    }
  })

  const faltas: FaltaIn[] = faltaRows.map(f => ({
    id: f.id, funcionario_id: f.funcionario_id, data_falta: f.data_falta, data_fim: f.data_fim,
    dias: f.dias, tipo: f.tipo, confirmada: f.confirmada_em !== null, observacao: f.observacao,
  }))
  const atestados: AtestadoIn[] = atestadoRows.map(a => ({
    id: a.id, funcionario_id: a.funcionario_id, data_inicio: a.data_inicio, data_fim: a.data_fim,
    cid_codigo: a.cid_codigo, sem_cid: a.sem_cid === true, motivo: a.motivo,
  }))
  const afastamentos: AfastamentoIn[] = afastRows.map(a => ({
    id: a.id, funcionario_id: a.funcionario_id, data_inicio: a.data_inicio,
    data_fim_prevista: a.data_fim_prevista, data_fim_real: a.data_fim_real, motivo: a.motivo,
  }))
  const ferias: FeriasIn[] = feriasRows.flatMap(x =>
    x.data_inicio && x.data_fim
      ? [{ id: x.id, funcionario_id: x.funcionario_id, data_inicio: x.data_inicio, data_fim: x.data_fim }]
      : [],
  )
  const suspensoes: SuspensaoIn[] = advRows.flatMap(a =>
    a.data_ocorrencia && a.dias_suspensao
      ? [{ id: a.id, funcionario_id: a.funcionario_id, data_inicio: a.data_ocorrencia, dias: a.dias_suspensao }]
      : [],
  )

  return { funcionarios, faltas, atestados, afastamentos, ferias, suspensoes }
}
```

- [ ] **Step 2: Compilar**

Run: `npx tsc --noEmit`
Expected: sem erros. Se o tipo de `.select(...)` com junção reclamar, o `as unknown as Pagina<...>` já cobre; se reclamar de `supRes.data`/`escalaRes.data`, conferir que as colunas `posto_id`, `supervisor_id` e `regime` existem em `types/database.ts` (existem: `config_escalas_postos.regime`).

- [ ] **Step 3: Commit**

```bash
git add lib/absenteismo/carregar.ts
git commit -m "feat(absenteismo): carregador de dados do Supabase para o motor

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Script de validação contra dados reais

**Files:**
- Create: `scripts/validar-absenteismo.ts`

O script é somente leitura. Usa a service role (como os outros scripts de `scripts/`), imprime agregados e **nenhum dado pessoal**. Roda com `tsx` via `npx --yes` (não altera o `package.json`).

- [ ] **Step 1: Criar o script**

```ts
// scripts/validar-absenteismo.ts
// Somente leitura. Uso (na raiz do projeto): npx --yes tsx scripts/validar-absenteismo.ts
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'
import { carregarDados } from '../lib/absenteismo/carregar'
import { calcularPeriodo } from '../lib/absenteismo/calculo'
import { calcularKpis } from '../lib/absenteismo/kpis'
import { periodoDoMes } from '../lib/absenteismo/datas'
import { quadroNoDia } from '../lib/absenteismo/quadro'
import { calcularSerieMensal, mesesAte, periodoEfetivo } from '../lib/absenteismo/series'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter(l => l.includes('='))
    .map(l => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    }),
)
const supabase = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

const DADOS_DESDE = '2026-06-18'
const LIMITE_QUADRO = 0.02 // 2%, medido em 2026-11-19 (máx. 1,63%)

async function main() {
  const hoje = new Date().toISOString().slice(0, 10)
  const [ano, mes] = [Number(hoje.slice(0, 4)), Number(hoje.slice(5, 7))]
  const meses = mesesAte(ano, mes, 6)
  const primeiro = periodoDoMes(meses[0].ano, meses[0].mes).inicio
  const janelaIni = primeiro < DADOS_DESDE ? primeiro : DADOS_DESDE

  const dados = await carregarDados(supabase, { inicio: janelaIni, fim: hoje })
  console.log(`\nFuncionários carregados: ${dados.funcionarios.length} | faltas ${dados.faltas.length} | atestados ${dados.atestados.length} | afastamentos ${dados.afastamentos.length} | férias ${dados.ferias.length} | suspensões ${dados.suspensoes.length}`)

  // 1) quadro reconstruído x snapshots_diarios
  const { data: snaps, error } = await supabase
    .from('snapshots_diarios')
    .select('data, ativos, afastados, em_ferias')
    .order('data')
  if (error) throw new Error(error.message)
  let maxRel = 0
  let pior = ''
  for (const s of snaps ?? []) {
    const esperado = s.ativos + s.afastados + s.em_ferias
    const calc = quadroNoDia(dados.funcionarios, s.data)
    const rel = esperado > 0 ? Math.abs(calc - esperado) / esperado : 0
    if (rel > maxRel) { maxRel = rel; pior = `${s.data}: motor ${calc} x snapshot ${esperado}` }
  }
  console.log(`\nQuadro x snapshots (${snaps?.length ?? 0} dias): diferença relativa máxima ${(maxRel * 100).toFixed(2)}% (${pior}) — limite ${(LIMITE_QUADRO * 100).toFixed(0)}%`)

  // 2) mês corrente (até hoje) e mês anterior
  const cheio = periodoDoMes(ano, mes)
  const atual = periodoEfetivo(cheio.inicio, cheio.fim, DADOS_DESDE, hoje)
  if (atual) {
    const r = calcularPeriodo({ ...dados, inicio: atual.inicio, fim: atual.fim })
    const k = calcularKpis(r)
    console.log(`\nPeríodo ${atual.inicio} a ${atual.fim}${atual.parcial ? ' (parcial)' : ''}`)
    console.log(`  quadro médio ${k.quadro_medio.toFixed(1)} | jornadas programadas ${r.jornadas_programadas} | perdidas ${r.jornadas_perdidas}`)
    console.log(`  taxa ${k.taxa.toFixed(2)}% | episódios ${k.episodios} | afetados ${k.funcionarios_afetados} | IF ${k.indice_frequencia.toFixed(1)} | IG ${k.indice_gravidade.toFixed(1)} | duração média ${k.duracao_media.toFixed(1)} | reincidência ${k.taxa_reincidencia.toFixed(1)}%`)
    console.log('  perdidas por classe', r.perdidas_por_classe, '| episódios por classe', r.episodios_por_classe)
    console.log('  disponibilidade (dias corridos-pessoa)', r.disponibilidade_dias, '| suspensão (jornadas)', r.suspensao_jornadas)
    console.log(`  episódios com 0 jornadas (dia fora da escala): ${r.episodios.filter(e => e.jornadas === 0).length} | faltas pendentes de confirmação: ${r.episodios.filter(e => e.confirmada === false).length}`)
  }

  // 3) série dos últimos 6 meses
  console.log('\nSérie mensal:')
  for (const p of calcularSerieMensal(dados, meses, DADOS_DESDE, hoje)) {
    console.log(`  ${p.mes}  taxa ${p.taxa === null ? '—' : p.taxa.toFixed(2) + '%'}  perdidas ${p.jornadas_perdidas}  episódios ${p.episodios}${p.parcial ? '  (parcial)' : ''}`)
  }

  if (maxRel > LIMITE_QUADRO) {
    console.error(`\nFALHA: quadro reconstruído excede ${(LIMITE_QUADRO * 100).toFixed(0)}% — investigar antes de seguir.`)
    process.exit(1)
  }
  console.log('\nOK: quadro dentro do limite.')
}

main().catch(e => { console.error(e); process.exit(1) })
```

- [ ] **Step 2: Executar contra o banco real**

Run: `npx --yes tsx scripts/validar-absenteismo.ts`
Expected: imprime contagens, "Quadro x snapshots ... máxima ≤ 2%", KPIs do mês corrente, a série (maio sem dados não aparece; junho/novembro marcados parcial) e termina com `OK: quadro dentro do limite.` Exit code 0.

- [ ] **Step 3: Conferir a sanidade dos números**

Olhar a saída e checar:
- quadro médio do mês corrente perto de 870 (o snapshot de 19/11 tem 873);
- taxa do mês corrente **diferente** dos 2,9% da tela antiga (esperado: a conta mudou) e com ordem de grandeza plausível (alguns por cento, não dezenas);
- `episódios` próximo da soma de faltas + grupos de atestados do mês, bem abaixo das 115 "ocorrências" antigas só se os atestados emendados estiverem sendo agrupados (isso é esperado);
- disponibilidade com INSS na casa de dezenas de funcionários-dia por dia, não zero.

Se algum número destoar muito, **parar e reportar ao usuário** com a saída, em vez de ajustar o motor por tentativa.

- [ ] **Step 4: Commit**

```bash
git add scripts/validar-absenteismo.ts
git commit -m "chore(absenteismo): script de validacao do quadro e KPIs contra dados reais

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Verificação final do plano 1

- [ ] **Step 1: Suíte completa de testes**

Run: `npm test`
Expected: todos os testes passam, incluindo os 9 arquivos novos de `lib/absenteismo/` e os já existentes.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Build de produção**

Run: `npm run build`
Expected: build conclui sem erros. A tela de Absenteísmo continua a antiga (nada a plugou ainda), então o comportamento do sistema não muda.

- [ ] **Step 4: Conferir o estado do git**

Run: `git status --short && git log --oneline -14`
Expected: só os 4 arquivos untracked pré-existentes (`docs/contexto-compactado-*.md`, `scripts/apply-turnos-unique-ativos.mjs`, `supabase/migrations/20261116_turnos_unique_nome_apenas_ativos.sql`) e os commits deste plano. **Não fazer push.**

---

## Auto-revisão contra o spec

| Requisito do spec | Onde |
|---|---|
| Classificação gerencial sem alterar dados (seção 4) | Task 2, 7 |
| Taxa, IF, IG, duração média, afetados, reincidência (seção 5) | Task 9 |
| Jornadas por escala do funcionário, união de dias sem dupla contagem (seção 5) | Task 3, 7 |
| Quadro histórico e quadro médio; aceite de 2% contra snapshots (seção 5) | Task 4, 12 |
| Precedência afastamento > atestado > falta e demais camadas (seção 5) | Task 7 |
| Atestado: 15 dias na taxa, resto prolongado fora (seção 4) | Task 7 |
| Suspensão fora da taxa; advertência de suspensão (seção 5) | Task 7 |
| Disponibilidade em dias corridos-pessoa (seção 5) | Task 7 (`disponibilidade_dias`, `indisponiveis_dias_pessoa`) |
| Episódio: falta = 1; atestados contíguos = 1 (seção 5) | Task 5, 7 |
| Faltas pendentes de confirmação com marca (seção 5) | Task 6, 7 (`confirmada`) |
| Variação vs mês anterior (seção 5) | Task 9 (`variacaoPercentual`, `variacaoPontos`) |
| Mês parcial e sem dados antes de 18/06/2026 (seção 5) | Task 10 |
| Filtros secretaria/posto/supervisor (seção 6) | Task 8 |
| Carregamento paginado com `fetchAllRows` (seção 8) | Task 11 |
| Sem migração de banco (seção 3) | todo o plano |

**Fica para os planos seguintes (não é lacuna deste):** interface, abas, gráficos, ranking por secretaria/posto/supervisor, mapa de calor, recomendações, painel de qualidade, exportação PDF/Excel, gating de rota e revisão RLS/PII das telas.

**Consistência de nomes:** `ClasseTaxa`/`ClasseDisponibilidade` (Task 2) → `tipos.ts` (Task 6) → `calculo.ts` (Task 7); `FuncionarioCalc` satisfaz `FuncQuadro` (Task 4) por estrutura; `DadosAbsenteismo` (Task 6) é o retorno de `carregarDados` (Task 11) e a entrada de `calcularSerieMensal` (Task 10); `periodoEfetivo` (Task 10) é usado pelo script (Task 12).
