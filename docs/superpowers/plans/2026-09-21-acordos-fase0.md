# Acordos de Compensação — Fase 0 (base estruturada) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o formulário manual de acordos por um fluxo estruturado: horário puxado do turno real, elegibilidade por escala (só 5x2 e 5x1), templates T1–T5 gerados por código, livro de movimentos com validação (soma zero, limites CLT) e calendário de Mogi das Cruzes.

**Architecture:** Toda regra de negócio fica em funções puras em `lib/acordos/` e `lib/calendario/`, testadas com vitest. Server Actions só buscam dados, chamam as funções puras e gravam. O modal vira um formulário guiado por template; o texto do PDF (`descricao_acordo`) passa a ser gerado no servidor a partir dos campos estruturados. Migration aditiva (colunas nulas + 2 tabelas novas).

**Tech Stack:** Next.js 14 App Router, Supabase (client sync `createClient()`), TypeScript strict, Tailwind, vitest (novo, só devDependency).

**Spec:** `docs/superpowers/specs/2026-09-21-acordos-ia-design.md` e `docs/superpowers/specs/2026-09-21-acordos-templates-rascunho.md`.

**Fora deste plano (planos próprios depois):** emenda em 1 clique (1a), IA + voz (1b), aba Controle e status assinado (2), tela de manutenção do calendário.

---

## Convenções deste plano

- Branch: `feat/acordos-ia` (já criada). Commits locais frequentes. **Nunca `git push`, nunca aplicar migration no Supabase, nunca mexer em variáveis do Vercel sem confirmação do usuário** (regra do `CLAUDE.md`).
- Datas sempre como string `YYYY-MM-DD`; aritmética de datas via `Date.UTC` (nunca `new Date(str)` local nem `toISOString()` de data local — evita erro de fuso).
- Minutos com sinal: `+` = trabalhou a mais / acréscimo; `−` = dispensa / redução / folga.
- Imports em `lib/**` usam caminho relativo (`./tempo`), para o vitest rodar sem depender de alias; código em `app/` e `components/` usa `@/`.
- O projeto não tinha suíte de testes. Adicionamos vitest **somente para `lib/**`** porque a lógica tem efeito jurídico/financeiro.
- `createClient()` é síncrono — nunca `await createClient()`.

## Estrutura de arquivos

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `vitest.config.ts`, `package.json` | criar/modificar | runner de testes |
| `lib/acordos/tipos.ts` | criar | tipos e constantes compartilhados |
| `lib/acordos/tempo.ts` | criar | minutos, datas, formatação pt-BR |
| `lib/acordos/regras.ts` | criar | limites CLT e regimes elegíveis (constantes) |
| `lib/acordos/horario-do-turno.ts` | criar | linha de `turnos_postos` → semana de 7 dias |
| `lib/calendario/pascoa.ts` | criar | data da Páscoa |
| `lib/calendario/feriados-mogi.ts` | criar | feriados fixos/móveis + facultativos 2026 |
| `lib/calendario/mapa.ts` | criar | tipo e mapa do calendário (puro, usável no client) |
| `lib/calendario/mogi.ts` | criar | leitura/semeadura do calendário no Supabase |
| `lib/acordos/movimentos.ts` | criar | cálculo do livro de movimentos e resumo |
| `lib/acordos/templates.ts` | criar | texto T1–T5 |
| `lib/acordos/validar.ts` | criar | achados (erro/aviso) |
| `lib/acordos/dias.ts` | criar | sugestão de quantidade e datas de compensação |
| `lib/acordos/__fixtures__.ts` | criar | turnos/funcionários de exemplo para testes |
| `supabase/migrations/20260922_acordos_movimentos_calendario.sql` | criar | schema novo |
| `app/(admin)/acordos/actions.ts` | modificar | busca elegível, `criarAcordo` novo, `criado_por` |
| `components/acordos/campos-template.tsx` | criar | campos do formulário por template |
| `components/acordos/modal-novo-acordo.tsx` | reescrever | formulário guiado |
| `components/acordos/acordos-client.tsx` | modificar | repassa o calendário ao modal |
| `app/(admin)/acordos/page.tsx` | modificar | exemplo do banner com a direção correta |

---

### Task 1: Infra de testes (vitest)

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `lib/acordos/sanity.test.ts` (removido no fim da task)

- [ ] **Step 1: Instalar vitest**

Run: `npm install -D vitest`
Expected: `added ... packages`, sem erro.

- [ ] **Step 2: Criar `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: { include: ['lib/**/*.test.ts'] },
  resolve: { alias: { '@': path.resolve('.') } },
})
```

- [ ] **Step 3: Adicionar script em `package.json`**

Em `"scripts"`, depois de `"lint": "next lint"`, adicionar (com vírgula na linha anterior):

```json
    "lint": "next lint",
    "test": "vitest run"
```

- [ ] **Step 4: Teste de sanidade**

Criar `lib/acordos/sanity.test.ts`:

```ts
import { describe, it, expect } from 'vitest'

describe('vitest', () => {
  it('roda', () => {
    expect(1 + 1).toBe(2)
  })
})
```

Run: `npm test`
Expected: `1 passed`.

- [ ] **Step 5: Remover sanidade e commitar**

```bash
rm lib/acordos/sanity.test.ts
git add package.json package-lock.json vitest.config.ts docs/superpowers
git commit -m "chore(acordos): adiciona vitest para logica pura de lib/ e docs da spec"
```

(Mensagem deve terminar com a linha `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.)

---

### Task 2: Tipos, tempo e regras

**Files:**
- Create: `lib/acordos/tipos.ts`
- Create: `lib/acordos/tempo.ts`
- Create: `lib/acordos/regras.ts`
- Test: `lib/acordos/tempo.test.ts`

- [ ] **Step 1: Criar `lib/acordos/tipos.ts`**

```ts
export const DIAS_SEMANA = [
  'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira',
  'Sexta-feira', 'Sábado', 'Domingo',
] as const
export type DiaSemana = (typeof DIAS_SEMANA)[number]

/** Um dia da semana de um turno. Horários 'HH:MM' ou '' quando não se aplica. */
export interface DiaTurno { folga: boolean; e1: string; s1: string; e2: string; s2: string }
export type SemanaTurno = Record<DiaSemana, DiaTurno>

export type TemplateId = 'T1' | 'T2' | 'T3' | 'T4' | 'T5'
export type PapelMovimento = 'origem' | 'quitacao'

/** `minutos` com sinal: + trabalhou a mais/acréscimo; − dispensa/redução/folga. */
export interface Movimento {
  funcionarioId: string
  data: string
  minutos: number
  papel: PapelMovimento
}

export interface CamposAcordo {
  template: TemplateId
  dataEvento?: string
  nomeEvento?: string
  periodoInicio?: string        // 'HH:MM' (opcional, T1/T5)
  periodoFim?: string
  minutosOrigem?: number        // T1/T5: minutos trabalhados no evento
  horaNormal?: string           // T2: horário normal de saída
  horaDispensa?: string         // T2: horário em que foram dispensados
  motivo?: string               // T2/T3/T4
  dataFolga?: string            // T3/T4/T5
  datasAjuste: string[]         // T1 redução; T2/T3/T4 acréscimo; T5 vazio
  prazoLimite?: string          // T4 obrigatório; demais quando cruza o mês
}

export interface FuncionarioCalc {
  id: string
  nome: string
  status: string
  regime: string
  semana: SemanaTurno
  semTurno: boolean
}

export type NivelAchado = 'erro' | 'aviso'
export interface Achado {
  nivel: NivelAchado
  codigo: string
  mensagem: string
  funcionarioId?: string
}
```

- [ ] **Step 2: Criar `lib/acordos/regras.ts`**

```ts
/** Limites revisáveis pelo RH/jurídico. Convenção coletiva pode alterá-los. */
export const MAX_ACRESCIMO_DIA_MIN = 2 * 60
export const MAX_JORNADA_DIA_MIN = 10 * 60
export const JORNADA_SEMANAL_MIN = 44 * 60
export const PRAZO_MAXIMO_MESES = 6
export const REGIMES_ELEGIVEIS = ['5x2', '5x1'] as const

export function regimeElegivel(regime: string): boolean {
  return (REGIMES_ELEGIVEIS as readonly string[]).includes(regime)
}
```

- [ ] **Step 3: Escrever o teste `lib/acordos/tempo.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import {
  hhmmParaMin, minParaHHMM, fmtDataBR, fmtAcrescimo, fmtHoraCurta,
  fmtHorasTotal, fmtDatasComPrefixo, diaSemanaDe, addDias, mesDe, addMeses,
} from './tempo'

describe('tempo', () => {
  it('converte HH:MM <-> minutos (aceita HH:MM:SS)', () => {
    expect(hhmmParaMin('07:00:00')).toBe(420)
    expect(hhmmParaMin('13:12')).toBe(792)
    expect(minParaHHMM(528)).toBe('08:48')
    expect(minParaHHMM(60)).toBe('01:00')
  })

  it('formata datas e horas', () => {
    expect(fmtDataBR('2026-06-28')).toBe('28/06/2026')
    expect(fmtAcrescimo(60)).toBe('01:00h')
    expect(fmtHoraCurta('15:00')).toBe('15h')
    expect(fmtHoraCurta('15:30')).toBe('15h30')
    expect(fmtHorasTotal(120)).toBe('02 hora(s)')
    expect(fmtHorasTotal(150)).toBe('02h30min')
  })

  it('lista datas com prefixo e ordena', () => {
    expect(fmtDatasComPrefixo(['2026-06-30'])).toBe('no dia 30/06/2026')
    expect(fmtDatasComPrefixo(['2026-07-01', '2026-06-30'])).toBe('nos dias 30/06/2026 e 01/07/2026')
    expect(fmtDatasComPrefixo(['2026-06-30', '2026-07-01', '2026-07-02']))
      .toBe('nos dias 30/06/2026, 01/07/2026 e 02/07/2026')
  })

  it('calcula dia da semana sem depender do fuso', () => {
    expect(diaSemanaDe('2026-09-21')).toBe('Segunda-feira')
    expect(diaSemanaDe('2026-06-28')).toBe('Domingo')
    expect(diaSemanaDe('2026-06-27')).toBe('Sábado')
  })

  it('soma dias e meses', () => {
    expect(addDias('2026-06-30', 1)).toBe('2026-07-01')
    expect(addDias('2026-03-01', -1)).toBe('2026-02-28')
    expect(mesDe('2026-06-30')).toBe('2026-06')
    expect(addMeses('2026-08-31', 6)).toBe('2027-02-28')
    expect(addMeses('2026-06-05', 6)).toBe('2026-12-05')
  })
})
```

- [ ] **Step 4: Rodar e ver falhar**

Run: `npx vitest run lib/acordos/tempo.test.ts`
Expected: FAIL (`Cannot find module './tempo'`).

- [ ] **Step 5: Implementar `lib/acordos/tempo.ts`**

```ts
import { DIAS_SEMANA, type DiaSemana } from './tipos'

const p2 = (n: number) => String(n).padStart(2, '0')

export function hhmmParaMin(hhmm: string): number {
  const [h, m] = hhmm.slice(0, 5).split(':').map(Number)
  return h * 60 + m
}

export function minParaHHMM(min: number): string {
  return `${p2(Math.floor(min / 60))}:${p2(min % 60)}`
}

export function fmtDataBR(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

/** 60 -> '01:00h' */
export function fmtAcrescimo(min: number): string {
  return `${minParaHHMM(min)}h`
}

/** '15:00' -> '15h'; '15:30' -> '15h30' */
export function fmtHoraCurta(hhmm: string): string {
  const [h, m] = hhmm.slice(0, 5).split(':')
  return m === '00' ? `${h}h` : `${h}h${m}`
}

/** 120 -> '02 hora(s)'; 150 -> '02h30min' */
export function fmtHorasTotal(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return m === 0 ? `${p2(h)} hora(s)` : `${p2(h)}h${p2(m)}min`
}

/** ['2026-06-30'] -> 'no dia 30/06/2026'; várias -> 'nos dias A, B e C' (ordenadas). */
export function fmtDatasComPrefixo(isos: string[]): string {
  const ord = [...isos].sort().map(fmtDataBR)
  if (ord.length === 1) return `no dia ${ord[0]}`
  return `nos dias ${ord.slice(0, -1).join(', ')} e ${ord[ord.length - 1]}`
}

export function diaSemanaDe(iso: string): DiaSemana {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay() // 0 = domingo
  return DIAS_SEMANA[(dow + 6) % 7]
}

export function addDias(iso: string, n: number): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

/** 'YYYY-MM' */
export function mesDe(iso: string): string {
  return iso.slice(0, 7)
}

/** Soma meses ajustando o dia ao último dia do mês de destino. */
export function addMeses(iso: string, n: number): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  const total = (m - 1) + n
  const ny = y + Math.floor(total / 12)
  const nm = ((total % 12) + 12) % 12
  const ultimo = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate()
  return `${ny}-${p2(nm + 1)}-${p2(Math.min(d, ultimo))}`
}
```

- [ ] **Step 6: Rodar e ver passar**

Run: `npx vitest run lib/acordos/tempo.test.ts`
Expected: `5 passed`.

- [ ] **Step 7: Commit**

```bash
git add lib/acordos/tipos.ts lib/acordos/tempo.ts lib/acordos/regras.ts lib/acordos/tempo.test.ts
git commit -m "feat(acordos): tipos, helpers de tempo e regras de limite"
```

### Task 3: Horário do turno real → semana de 7 dias

**Files:**
- Create: `lib/acordos/horario-do-turno.ts`
- Test: `lib/acordos/horario-do-turno.test.ts`

Regras (baseadas em `lib/turnos/escala.ts`): Seg–Qui usam `hora_entrada`/almoço/`hora_saida_seg_qui`. Sexta usa `hora_entrada_sex ?? hora_entrada` e `hora_saida_sex ?? hora_saida_seg_qui`. Sábado usa os campos `*_sabado` quando existem; senão, em 5x1 repete o dia de semana; em 5x2 é folga. Domingo é sempre folga. **Premissa a confirmar com o RH:** em 5x1 o domingo é a folga da semana modelo (6 dias × 7h20 = 44h).

- [ ] **Step 1: Escrever o teste**

```ts
import { describe, it, expect } from 'vitest'
import {
  montarSemana, jornadaDiaMin, totalSemanalMin, semanaParaTexto, assinaturaSemana,
  TURNO_PADRAO, type TurnoRow,
} from './horario-do-turno'

const turno5x2c: TurnoRow = {
  tipo_escala: '5x2', hora_entrada: '07:00:00', hora_saida_seg_qui: '17:00:00', hora_saida_sex: null,
  hora_inicio_almoco: '12:00:00', hora_fim_almoco: '13:12:00',
}

describe('montarSemana', () => {
  it('5x2 com almoço 12:00-13:12 fecha 44h e folga no fim de semana', () => {
    const s = montarSemana(turno5x2c)
    expect(jornadaDiaMin(s['Segunda-feira'])).toBe(528)
    expect(totalSemanalMin(s)).toBe(2640)
    expect(s['Sábado'].folga).toBe(true)
    expect(s['Domingo'].folga).toBe(true)
    expect(semanaParaTexto(s)['Segunda-feira']).toBe('07:00 às 12:00 / 13:12 às 17:00')
    expect(semanaParaTexto(s)['Sábado']).toBe('FOLGA')
  })

  it('5x2 com sexta mais curta', () => {
    const s = montarSemana({
      ...turno5x2c, hora_inicio_almoco: '12:00', hora_fim_almoco: '13:00', hora_saida_sex: '16:00',
    })
    expect(jornadaDiaMin(s['Quinta-feira'])).toBe(540)
    expect(jornadaDiaMin(s['Sexta-feira'])).toBe(480)
    expect(totalSemanalMin(s)).toBe(2640)
  })

  it('5x1 trabalha de segunda a sábado e folga no domingo', () => {
    const s = montarSemana({
      tipo_escala: '5x1', hora_entrada: '07:00', hora_saida_seg_qui: '15:20', hora_saida_sex: null,
      hora_inicio_almoco: '11:00', hora_fim_almoco: '12:00',
    })
    expect(jornadaDiaMin(s['Sábado'])).toBe(440)
    expect(s['Domingo'].folga).toBe(true)
    expect(totalSemanalMin(s)).toBe(2640)
  })

  it('usa horário próprio de sábado quando existe', () => {
    const s = montarSemana({
      ...turno5x2c, hora_entrada_sabado: '07:00', hora_saida_sabado: '11:00',
      hora_inicio_almoco_sabado: null, hora_fim_almoco_sabado: null,
    })
    expect(s['Sábado'].folga).toBe(false)
    expect(jornadaDiaMin(s['Sábado'])).toBe(240)
    expect(semanaParaTexto(s)['Sábado']).toBe('07:00 às 11:00')
  })

  it('turno sem almoço vira um período só', () => {
    const s = montarSemana({
      tipo_escala: '5x2', hora_entrada: '07:00', hora_saida_seg_qui: '13:00', hora_saida_sex: null,
      hora_inicio_almoco: null, hora_fim_almoco: null,
    })
    expect(s['Segunda-feira']).toMatchObject({ e1: '07:00', s1: '13:00', e2: '', s2: '' })
    expect(jornadaDiaMin(s['Segunda-feira'])).toBe(360)
  })

  it('TURNO_PADRAO fecha 44h e assinatura é estável', () => {
    expect(totalSemanalMin(montarSemana(TURNO_PADRAO))).toBe(2640)
    expect(assinaturaSemana(montarSemana(TURNO_PADRAO))).toBe(assinaturaSemana(montarSemana({ ...TURNO_PADRAO })))
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run lib/acordos/horario-do-turno.test.ts`
Expected: FAIL (`Cannot find module './horario-do-turno'`).

- [ ] **Step 3: Implementar `lib/acordos/horario-do-turno.ts`**

```ts
import { DIAS_SEMANA, type DiaSemana, type DiaTurno, type SemanaTurno } from './tipos'
import { hhmmParaMin } from './tempo'

/** Colunas de `turnos_postos` usadas aqui (horas podem vir como 'HH:MM:SS'). */
export interface TurnoRow {
  tipo_escala: string
  hora_entrada: string
  hora_saida_seg_qui: string
  hora_saida_sex: string | null
  hora_inicio_almoco: string | null
  hora_fim_almoco: string | null
  hora_entrada_sex?: string | null
  hora_entrada_sabado?: string | null
  hora_inicio_almoco_sabado?: string | null
  hora_fim_almoco_sabado?: string | null
  hora_saida_sabado?: string | null
}

/** Usado quando o funcionário não tem turno vigente cadastrado: 5x2, 07:00–17:00, almoço 12:00–13:12 (44h). */
export const TURNO_PADRAO: TurnoRow = {
  tipo_escala: '5x2',
  hora_entrada: '07:00',
  hora_saida_seg_qui: '17:00',
  hora_saida_sex: '17:00',
  hora_inicio_almoco: '12:00',
  hora_fim_almoco: '13:12',
}

const hh = (v: string | null | undefined) => (v ? v.slice(0, 5) : '')
const FOLGA: DiaTurno = { folga: true, e1: '', s1: '', e2: '', s2: '' }

function dia(entrada: string, inicioAlmoco: string, fimAlmoco: string, saida: string): DiaTurno {
  if (inicioAlmoco && fimAlmoco) return { folga: false, e1: entrada, s1: inicioAlmoco, e2: fimAlmoco, s2: saida }
  return { folga: false, e1: entrada, s1: saida, e2: '', s2: '' }
}

export function montarSemana(t: TurnoRow): SemanaTurno {
  const almI = hh(t.hora_inicio_almoco)
  const almF = hh(t.hora_fim_almoco)
  const segQui = dia(hh(t.hora_entrada), almI, almF, hh(t.hora_saida_seg_qui))
  const sex = dia(
    hh(t.hora_entrada_sex) || hh(t.hora_entrada),
    almI, almF,
    hh(t.hora_saida_sex) || hh(t.hora_saida_seg_qui),
  )
  const sabadoDistinto = !!t.hora_entrada_sabado && !!t.hora_saida_sabado
  let sab: DiaTurno
  if (sabadoDistinto) {
    sab = dia(hh(t.hora_entrada_sabado), hh(t.hora_inicio_almoco_sabado), hh(t.hora_fim_almoco_sabado), hh(t.hora_saida_sabado))
  } else if (t.tipo_escala === '5x1') {
    sab = { ...segQui }
  } else {
    sab = { ...FOLGA }
  }
  return {
    'Segunda-feira': { ...segQui },
    'Terça-feira': { ...segQui },
    'Quarta-feira': { ...segQui },
    'Quinta-feira': { ...segQui },
    'Sexta-feira': sex,
    'Sábado': sab,
    'Domingo': { ...FOLGA },
  }
}

export function jornadaDiaMin(d: DiaTurno): number {
  if (d.folga) return 0
  const p1 = d.e1 && d.s1 ? hhmmParaMin(d.s1) - hhmmParaMin(d.e1) : 0
  const p2 = d.e2 && d.s2 ? hhmmParaMin(d.s2) - hhmmParaMin(d.e2) : 0
  return Math.max(0, p1) + Math.max(0, p2)
}

export function totalSemanalMin(s: SemanaTurno): number {
  return DIAS_SEMANA.reduce((acc, d) => acc + jornadaDiaMin(s[d]), 0)
}

/** Texto por dia, no formato já usado em `TurnoHorario.horario` e no PDF. */
export function semanaParaTexto(s: SemanaTurno): Record<DiaSemana, string> {
  const out = {} as Record<DiaSemana, string>
  for (const d of DIAS_SEMANA) {
    const t = s[d]
    if (t.folga) { out[d] = 'FOLGA'; continue }
    const p1 = t.e1 && t.s1 ? `${t.e1} às ${t.s1}` : ''
    const p2 = t.e2 && t.s2 ? `${t.e2} às ${t.s2}` : ''
    out[d] = [p1, p2].filter(Boolean).join(' / ')
  }
  return out
}

/** Chave para agrupar funcionários com semana idêntica (mesmo turno). */
export function assinaturaSemana(s: SemanaTurno): string {
  return JSON.stringify(DIAS_SEMANA.map(d => s[d]))
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run lib/acordos/horario-do-turno.test.ts`
Expected: `6 passed`.

- [ ] **Step 5: Commit**

```bash
git add lib/acordos/horario-do-turno.ts lib/acordos/horario-do-turno.test.ts
git commit -m "feat(acordos): monta semana de 7 dias a partir do turno real"
```

---

### Task 4: Calendário de Mogi (funções puras)

**Files:**
- Create: `lib/calendario/pascoa.ts`
- Create: `lib/calendario/feriados-mogi.ts`
- Test: `lib/calendario/feriados-mogi.test.ts`

Fonte: calendário administrativo da Prefeitura (Decreto 24.034/2025) e Lei Municipal 3.433/89. **Os facultativos de 2026 foram lidos por resumo de página — conferir no decreto original antes de aplicar em produção.** Não usar nem alterar `lib/utils/dias-uteis.ts`.

- [ ] **Step 1: Escrever o teste `lib/calendario/feriados-mogi.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { pascoa } from './pascoa'
import { gerarFeriadosDoAno, feriadosParaAno, FACULTATIVOS_2026 } from './feriados-mogi'

describe('pascoa', () => {
  it('calcula a Páscoa', () => {
    expect(pascoa(2025)).toBe('2025-04-20')
    expect(pascoa(2026)).toBe('2026-04-05')
    expect(pascoa(2027)).toBe('2027-03-28')
    expect(pascoa(2028)).toBe('2028-04-16')
  })
})

describe('feriados de Mogi', () => {
  const f2026 = gerarFeriadosDoAno(2026)

  it('inclui feriados nacionais, estadual e os 3 municipais', () => {
    expect(f2026).toHaveLength(13)
    const por = (d: string) => f2026.find(f => f.data === d)
    expect(por('2026-04-03')?.tipo).toBe('municipal')
    expect(por('2026-07-26')?.tipo).toBe('municipal')
    expect(por('2026-09-01')?.tipo).toBe('municipal')
    expect(por('2026-07-09')?.tipo).toBe('estadual')
    expect(por('2026-11-20')?.tipo).toBe('nacional')
    expect(por('2026-12-25')?.tipo).toBe('nacional')
  })

  it('não trata Carnaval, Corpus Christi, 25/01 nem 26/06 como feriado', () => {
    const datas = new Set(f2026.map(f => f.data))
    for (const d of ['2026-02-16', '2026-02-17', '2026-06-04', '2026-01-25', '2026-06-26']) {
      expect(datas.has(d)).toBe(false)
    }
  })

  it('facultativos 2026 só entram em 2026', () => {
    expect(FACULTATIVOS_2026).toHaveLength(10)
    expect(feriadosParaAno(2026)).toHaveLength(23)
    expect(feriadosParaAno(2027)).toHaveLength(13)
    const cinzas = FACULTATIVOS_2026.find(f => f.data === '2026-02-18')
    expect(cinzas?.ate_hora).toBe('13:00')
    expect(cinzas?.tipo).toBe('facultativo')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run lib/calendario`
Expected: FAIL (módulos inexistentes).

- [ ] **Step 3: Implementar `lib/calendario/pascoa.ts`**

```ts
const p2 = (n: number) => String(n).padStart(2, '0')

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher). Retorna 'YYYY-MM-DD'. */
export function pascoa(ano: number): string {
  const a = ano % 19
  const b = Math.floor(ano / 100)
  const c = ano % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const mes = Math.floor((h + l - 7 * m + 114) / 31)
  const dia = ((h + l - 7 * m + 114) % 31) + 1
  return `${ano}-${p2(mes)}-${p2(dia)}`
}
```

- [ ] **Step 4: Implementar `lib/calendario/feriados-mogi.ts`**

```ts
import { addDias } from '../acordos/tempo'
import { pascoa } from './pascoa'

export type TipoFeriado = 'nacional' | 'estadual' | 'municipal' | 'facultativo'

export interface FeriadoItem {
  data: string
  nome: string
  tipo: TipoFeriado
  ate_hora: string | null
  base_legal: string | null
}

const item = (
  data: string, nome: string, tipo: TipoFeriado, base_legal: string | null = null, ate_hora: string | null = null,
): FeriadoItem => ({ data, nome, tipo, ate_hora, base_legal })

/** Feriados de lei (nacionais, estadual, municipais). Não inclui pontos facultativos. */
export function gerarFeriadosDoAno(ano: number): FeriadoItem[] {
  const y = String(ano)
  return [
    item(`${y}-01-01`, 'Confraternização Universal', 'nacional', 'Lei Federal 662/49'),
    item(addDias(pascoa(ano), -2), 'Paixão de Cristo (Sexta-feira Santa)', 'municipal', 'Lei Municipal 3.433/89'),
    item(`${y}-04-21`, 'Tiradentes', 'nacional', 'Lei Federal 662/49'),
    item(`${y}-05-01`, 'Dia do Trabalho', 'nacional', 'Lei Federal 662/49'),
    item(`${y}-07-09`, 'Revolução Constitucionalista', 'estadual', 'Lei Estadual SP'),
    item(`${y}-07-26`, "N. Sra. de Sant'Ana (padroeira)", 'municipal', 'Lei Municipal 3.433/89'),
    item(`${y}-09-01`, 'Aniversário da Cidade', 'municipal', 'Lei Municipal 3.433/89'),
    item(`${y}-09-07`, 'Independência do Brasil', 'nacional', 'Lei Federal 662/49'),
    item(`${y}-10-12`, 'Nossa Senhora Aparecida', 'nacional', 'Lei Federal 6.802/80'),
    item(`${y}-11-02`, 'Finados', 'nacional', 'Lei Federal 662/49'),
    item(`${y}-11-15`, 'Proclamação da República', 'nacional', 'Lei Federal 662/49'),
    item(`${y}-11-20`, 'Dia da Consciência Negra', 'nacional', 'Lei Federal 14.759/2023 e Lei Municipal 3.433/89'),
    item(`${y}-12-25`, 'Natal', 'nacional', 'Lei Federal 662/49'),
  ]
}

const DEC = 'Decreto Municipal 24.034/2025'

/** Pontos facultativos da Prefeitura em 2026. CONFERIR NO DECRETO ORIGINAL antes de aplicar em produção. */
export const FACULTATIVOS_2026: FeriadoItem[] = [
  item('2026-01-02', 'Ponto facultativo', 'facultativo', DEC),
  item('2026-02-16', 'Ponto facultativo (Carnaval)', 'facultativo', DEC),
  item('2026-02-17', 'Ponto facultativo (Carnaval)', 'facultativo', DEC),
  item('2026-02-18', 'Ponto facultativo (Quarta-feira de Cinzas)', 'facultativo', DEC, '13:00'),
  item('2026-04-20', 'Ponto facultativo', 'facultativo', DEC),
  item('2026-06-05', 'Ponto facultativo', 'facultativo', DEC),
  item('2026-07-10', 'Ponto facultativo', 'facultativo', DEC),
  item('2026-08-31', 'Ponto facultativo', 'facultativo', DEC),
  item('2026-12-24', 'Ponto facultativo', 'facultativo', DEC),
  item('2026-12-31', 'Ponto facultativo', 'facultativo', DEC),
]

/** Feriados de lei do ano + facultativos conhecidos desse ano (hoje só 2026). */
export function feriadosParaAno(ano: number): FeriadoItem[] {
  return [...gerarFeriadosDoAno(ano), ...(ano === 2026 ? FACULTATIVOS_2026 : [])]
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run lib/calendario`
Expected: `4 passed`.

- [ ] **Step 6: Commit**

```bash
git add lib/calendario
git commit -m "feat(calendario): feriados e pontos facultativos de Mogi das Cruzes (funcoes puras)"
```

### Task 5: Livro de movimentos

**Files:**
- Create: `lib/acordos/__fixtures__.ts` (helpers só para testes)
- Create: `lib/acordos/movimentos.ts`
- Test: `lib/acordos/movimentos.test.ts`

Convenção de sinais e papéis (ver spec §3-A): T1 origem `+` / quitação `−` (redução); T2 e T3 origem `−` / quitação `+` (acréscimo); T4 origem `+` (acréscimos) / quitação `−` (folga); T5 origem `+` / quitação `−` (folga). A soma por funcionário deve ser zero.

- [ ] **Step 1: Criar `lib/acordos/__fixtures__.ts`**

```ts
import type { FuncionarioCalc } from './tipos'
import { montarSemana, type TurnoRow } from './horario-do-turno'

/** 5x2, 07:00–17:00, almoço 12:00–13:12 → 528 min por dia útil (44h). */
export const T_5X2_528: TurnoRow = {
  tipo_escala: '5x2', hora_entrada: '07:00', hora_saida_seg_qui: '17:00', hora_saida_sex: null,
  hora_inicio_almoco: '12:00', hora_fim_almoco: '13:12',
}

/** 5x2, seg–qui 540 min, sexta 480 min (44h). */
export const T_5X2_540: TurnoRow = {
  tipo_escala: '5x2', hora_entrada: '07:00', hora_saida_seg_qui: '17:00', hora_saida_sex: '16:00',
  hora_inicio_almoco: '12:00', hora_fim_almoco: '13:00',
}

export function func(id: string, turno: TurnoRow = T_5X2_528, extra: Partial<FuncionarioCalc> = {}): FuncionarioCalc {
  return {
    id, nome: `Func ${id}`, status: 'ativo', regime: turno.tipo_escala,
    semana: montarSemana(turno), semTurno: false, ...extra,
  }
}
```

- [ ] **Step 2: Escrever `lib/acordos/movimentos.test.ts`**

Datas de referência (2026): 13/06 sáb, 15/06 seg, 16/06 ter, 05/06 sex, 08–11/06 seg–qui, 27/06 sáb, 30/06 ter, 01/07 qua.

```ts
import { describe, it, expect } from 'vitest'
import { construirMovimentos, resumoCalculo, saldoMin, agruparPorJornada } from './movimentos'
import { func, T_5X2_540 } from './__fixtures__'
import type { CamposAcordo } from './tipos'

const f1 = func('a')
const soma = (movs: { minutos: number }[]) => saldoMin(movs)

describe('construirMovimentos', () => {
  it('T1: evento trabalhado, quitação por redução', () => {
    const c: CamposAcordo = {
      template: 'T1', dataEvento: '2026-06-27', nomeEvento: 'Festa Junina',
      minutosOrigem: 120, datasAjuste: ['2026-06-30', '2026-07-01'],
    }
    const m = construirMovimentos(c, [f1])
    expect(m.map(x => [x.data, x.minutos, x.papel])).toEqual([
      ['2026-06-27', 120, 'origem'], ['2026-06-30', -60, 'quitacao'], ['2026-07-01', -60, 'quitacao'],
    ])
    expect(soma(m)).toBe(0)
  })

  it('T2: dispensa parcial, quitação por acréscimo', () => {
    const c: CamposAcordo = {
      template: 'T2', dataEvento: '2026-06-05', nomeEvento: 'Emenda',
      horaNormal: '15:00', horaDispensa: '12:00', datasAjuste: ['2026-06-08', '2026-06-09', '2026-06-10'],
    }
    const m = construirMovimentos(c, [f1])
    expect(m[0]).toMatchObject({ data: '2026-06-05', minutos: -180, papel: 'origem' })
    expect(m.slice(1).every(x => x.minutos === 60 && x.papel === 'quitacao')).toBe(true)
    expect(soma(m)).toBe(0)
  })

  it('T3: dia inteiro usa a jornada real do dia (sexta = 528)', () => {
    const c: CamposAcordo = {
      template: 'T3', dataFolga: '2026-06-05', motivo: 'ponto facultativo',
      datasAjuste: ['2026-06-08', '2026-06-09', '2026-06-10', '2026-06-11'],
    }
    const m = construirMovimentos(c, [f1])
    expect(m[0]).toMatchObject({ data: '2026-06-05', minutos: -528, papel: 'origem' })
    expect(m.slice(1).map(x => x.minutos)).toEqual([132, 132, 132, 132])
    expect(soma(m)).toBe(0)
  })

  it('T4: acréscimos antes (origem) e folga depois (quitação)', () => {
    const c: CamposAcordo = {
      template: 'T4', dataFolga: '2026-06-12', motivo: 'ponto facultativo', prazoLimite: '2026-11-30',
      datasAjuste: ['2026-06-08', '2026-06-09', '2026-06-10', '2026-06-11'],
    }
    const m = construirMovimentos(c, [f1])
    expect(m.filter(x => x.papel === 'origem').map(x => x.minutos)).toEqual([132, 132, 132, 132])
    expect(m.find(x => x.papel === 'quitacao')).toMatchObject({ data: '2026-06-12', minutos: -528 })
    expect(soma(m)).toBe(0)
  })

  it('T5: dia de descanso trabalhado, folga do mesmo tamanho', () => {
    const c: CamposAcordo = {
      template: 'T5', dataEvento: '2026-06-27', nomeEvento: 'Mutirão',
      minutosOrigem: 240, dataFolga: '2026-06-29', datasAjuste: [],
    }
    const m = construirMovimentos(c, [f1])
    expect(m.map(x => x.minutos)).toEqual([240, -240])
    expect(soma(m)).toBe(0)
  })

  it('gera movimentos por funcionário', () => {
    const c: CamposAcordo = { template: 'T5', dataEvento: '2026-06-27', nomeEvento: 'X', minutosOrigem: 60, dataFolga: '2026-06-29', datasAjuste: [] }
    expect(construirMovimentos(c, [func('a'), func('b')])).toHaveLength(4)
  })
})

describe('resumoCalculo e agrupamento', () => {
  const c: CamposAcordo = {
    template: 'T3', dataFolga: '2026-06-08', motivo: 'x', datasAjuste: ['2026-06-09', '2026-06-10', '2026-06-11', '2026-06-12'],
  }

  it('resume total e minutos por dia', () => {
    expect(resumoCalculo(c, [f1])).toEqual({ horasTotalMin: 528, minutosPorDia: 132, jornadaFolgaMin: 528 })
  })

  it('separa funcionários com jornadas diferentes no dia da folga', () => {
    const grupos = agruparPorJornada(c, [func('a'), func('b', T_5X2_540), func('c')])
    expect(grupos.map(g => g.map(f => f.id))).toEqual([['a', 'c'], ['b']])
  })

  it('templates sem dia de folga ficam em um grupo só', () => {
    const t1: CamposAcordo = { template: 'T1', dataEvento: '2026-06-13', nomeEvento: 'x', minutosOrigem: 60, datasAjuste: ['2026-06-15'] }
    expect(agruparPorJornada(t1, [func('a'), func('b', T_5X2_540)])).toHaveLength(1)
  })
})
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx vitest run lib/acordos/movimentos.test.ts`
Expected: FAIL (`Cannot find module './movimentos'`).

- [ ] **Step 4: Implementar `lib/acordos/movimentos.ts`**

```ts
import type { CamposAcordo, FuncionarioCalc, Movimento, PapelMovimento } from './tipos'
import { diaSemanaDe, hhmmParaMin } from './tempo'
import { jornadaDiaMin } from './horario-do-turno'

export interface ResumoCalculo {
  /** Minutos "devidos" por funcionário (movimento de origem). */
  horasTotalMin: number
  /** Acréscimo ou redução por dia de ajuste (0 se não há dias ou no T5). */
  minutosPorDia: number
  /** Jornada do dia da folga do primeiro funcionário (0 se não há dia de folga). */
  jornadaFolgaMin: number
}

export function saldoMin(movs: { minutos: number }[]): number {
  return movs.reduce((acc, m) => acc + m.minutos, 0)
}

export function jornadaDoDia(f: FuncionarioCalc, iso: string): number {
  return jornadaDiaMin(f.semana[diaSemanaDe(iso)])
}

function totalOrigem(c: CamposAcordo, f: FuncionarioCalc): number {
  let total = 0
  switch (c.template) {
    case 'T1':
    case 'T5':
      total = c.minutosOrigem ?? 0
      break
    case 'T2':
      total = c.horaNormal && c.horaDispensa ? hhmmParaMin(c.horaNormal) - hhmmParaMin(c.horaDispensa) : 0
      break
    case 'T3':
    case 'T4':
      total = c.dataFolga ? jornadaDoDia(f, c.dataFolga) : 0
      break
  }
  return Math.max(0, total)
}

export function resumoCalculo(c: CamposAcordo, funcs: FuncionarioCalc[]): ResumoCalculo {
  const f = funcs[0]
  if (!f) return { horasTotalMin: 0, minutosPorDia: 0, jornadaFolgaMin: 0 }
  const horasTotalMin = totalOrigem(c, f)
  const n = c.datasAjuste.length
  return {
    horasTotalMin,
    minutosPorDia: c.template === 'T5' || n === 0 ? 0 : Math.floor(horasTotalMin / n),
    jornadaFolgaMin: c.dataFolga ? jornadaDoDia(f, c.dataFolga) : 0,
  }
}

export function construirMovimentos(c: CamposAcordo, funcs: FuncionarioCalc[]): Movimento[] {
  const out: Movimento[] = []
  const n = c.datasAjuste.length
  for (const f of funcs) {
    const total = totalOrigem(c, f)
    const porDia = n > 0 ? Math.floor(total / n) : 0
    const mov = (data: string, minutos: number, papel: PapelMovimento) =>
      out.push({ funcionarioId: f.id, data, minutos, papel })
    switch (c.template) {
      case 'T1':
        if (c.dataEvento) mov(c.dataEvento, total, 'origem')
        for (const d of c.datasAjuste) mov(d, -porDia, 'quitacao')
        break
      case 'T2':
        if (c.dataEvento) mov(c.dataEvento, -total, 'origem')
        for (const d of c.datasAjuste) mov(d, porDia, 'quitacao')
        break
      case 'T3':
        if (c.dataFolga) mov(c.dataFolga, -total, 'origem')
        for (const d of c.datasAjuste) mov(d, porDia, 'quitacao')
        break
      case 'T4':
        for (const d of c.datasAjuste) mov(d, porDia, 'origem')
        if (c.dataFolga) mov(c.dataFolga, -total, 'quitacao')
        break
      case 'T5':
        if (c.dataEvento) mov(c.dataEvento, total, 'origem')
        if (c.dataFolga) mov(c.dataFolga, -total, 'quitacao')
        break
    }
  }
  return out
}

/**
 * Nos templates com dia de folga (T3/T4/T5) a jornada daquele dia muda de pessoa para pessoa.
 * Um único texto não descreve jornadas diferentes, então separamos em grupos (um acordo por grupo).
 */
export function agruparPorJornada(c: CamposAcordo, funcs: FuncionarioCalc[]): FuncionarioCalc[][] {
  const usaFolga = c.template === 'T3' || c.template === 'T4' || c.template === 'T5'
  if (!usaFolga || !c.dataFolga) return funcs.length ? [funcs] : []
  const grupos = new Map<number, FuncionarioCalc[]>()
  for (const f of funcs) {
    const chave = jornadaDoDia(f, c.dataFolga)
    grupos.set(chave, [...(grupos.get(chave) ?? []), f])
  }
  return Array.from(grupos.values())
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run lib/acordos/movimentos.test.ts`
Expected: `9 passed`.

- [ ] **Step 6: Commit**

```bash
git add lib/acordos/__fixtures__.ts lib/acordos/movimentos.ts lib/acordos/movimentos.test.ts
git commit -m "feat(acordos): livro de movimentos com sinal e agrupamento por jornada"
```

---

### Task 6: Templates de texto (T1–T5)

**Files:**
- Create: `lib/acordos/templates.ts`
- Test: `lib/acordos/templates.test.ts`

O texto só substitui o parágrafo do objeto; cláusulas fixas do PDF não mudam. Wording de T2 mantém o original ("trabalharem normalmente até as … sendo dispensados às …"): **pedir ao RH para conferir essa redação**, pois lida literalmente parece contraditória — `horaNormal` deve ser o horário normal de saída.

- [ ] **Step 1: Escrever `lib/acordos/templates.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { gerarObjeto, contemPlaceholder, TEMPLATES } from './templates'
import type { CamposAcordo } from './tipos'

const r = (horasTotalMin: number, minutosPorDia: number, jornadaFolgaMin = 0) => ({ horasTotalMin, minutosPorDia, jornadaFolgaMin })

describe('gerarObjeto', () => {
  it('T1', () => {
    const c: CamposAcordo = {
      template: 'T1', dataEvento: '2026-06-27', nomeEvento: 'Festa Junina',
      periodoInicio: '08:00', periodoFim: '10:00', datasAjuste: ['2026-06-30', '2026-07-01'],
    }
    expect(gerarObjeto(c, r(120, 60))).toEqual({
      ok: true,
      texto: 'trabalharem no dia 27/06/2026 (Festa Junina), das 08h às 10h, com redução de 01:00h diária no horário normal nos dias 30/06/2026 e 01/07/2026, compensando assim 02 hora(s) laborada(s) no referido evento.',
    })
  })

  it('T2 usa "decreto municipal" quando não há motivo', () => {
    const c: CamposAcordo = {
      template: 'T2', dataEvento: '2026-06-05', nomeEvento: 'Corpus Christi', horaNormal: '15:00', horaDispensa: '12:00',
      datasAjuste: ['2026-06-08', '2026-06-09', '2026-06-10'],
    }
    expect(gerarObjeto(c, r(180, 60))).toEqual({
      ok: true,
      texto: 'trabalharem normalmente até as 15h no dia 05/06/2026 (Corpus Christi), sendo dispensados às 12h conforme decreto municipal, compensando as 03 hora(s) não laboradas com acréscimo de 01:00h diária no horário normal nos dias 08/06/2026, 09/06/2026 e 10/06/2026.',
    })
  })

  it('T3', () => {
    const c: CamposAcordo = {
      template: 'T3', dataFolga: '2026-06-05', motivo: 'ponto facultativo municipal',
      datasAjuste: ['2026-06-08', '2026-06-09', '2026-06-10', '2026-06-11'],
    }
    expect(gerarObjeto(c, r(528, 132))).toEqual({
      ok: true,
      texto: 'serem dispensados do trabalho no dia 05/06/2026 (ponto facultativo municipal), compensando as 08h48min não laboradas com acréscimo de 02:12h diária no horário normal nos dias 08/06/2026, 09/06/2026, 10/06/2026 e 11/06/2026.',
    })
  })

  it('T4 sempre traz o prazo', () => {
    const c: CamposAcordo = {
      template: 'T4', dataFolga: '2026-06-12', motivo: 'ponto facultativo', prazoLimite: '2026-11-30',
      datasAjuste: ['2026-06-08', '2026-06-09'],
    }
    const res = gerarObjeto(c, r(480, 240))
    expect(res).toEqual({
      ok: true,
      texto: 'trabalharem com acréscimo de 04:00h diária no horário normal nos dias 08/06/2026 e 09/06/2026, formando um saldo de 08 hora(s) a ser compensado com a dispensa do trabalho no dia 12/06/2026 (ponto facultativo), com prazo máximo de compensação até 30/11/2026.',
    })
  })

  it('T5 diferencia folga de dia inteiro e parcial', () => {
    const base: CamposAcordo = { template: 'T5', dataEvento: '2026-06-27', nomeEvento: 'Mutirão', dataFolga: '2026-06-29', datasAjuste: [] }
    const cheia = gerarObjeto(base, r(528, 0, 528))
    const parcial = gerarObjeto(base, r(240, 0, 528))
    expect(cheia.ok && cheia.texto).toBe('trabalharem no dia 27/06/2026 (Mutirão), compensando as 08h48min laboradas com a dispensa do trabalho no dia 29/06/2026.')
    expect(parcial.ok && parcial.texto).toBe('trabalharem no dia 27/06/2026 (Mutirão), compensando as 04 hora(s) laboradas com a dispensa de 04 hora(s) do horário de trabalho no dia 29/06/2026.')
  })

  it('acrescenta cláusula de prazo nos templates T1–T3 quando informado', () => {
    const c: CamposAcordo = {
      template: 'T3', dataFolga: '2026-06-26', motivo: 'ponto facultativo', prazoLimite: '2026-12-20',
      datasAjuste: ['2026-06-29', '2026-06-30'],
    }
    const res = gerarObjeto(c, r(480, 240))
    expect(res.ok && res.texto.endsWith(' O prazo máximo para a compensação é 20/12/2026.')).toBe(true)
  })

  it('rejeita campo faltando e colchetes no texto', () => {
    expect(gerarObjeto({ template: 'T3', datasAjuste: [] }, r(0, 0)).ok).toBe(false)
    const c: CamposAcordo = { template: 'T1', dataEvento: '2026-06-27', nomeEvento: 'Festa [X]', datasAjuste: ['2026-06-30'] }
    expect(gerarObjeto(c, r(60, 60))).toEqual({ ok: false, erro: 'O texto gerado contém colchetes ou campo em branco.' })
  })

  it('detecta placeholder e expõe catálogo', () => {
    expect(contemPlaceholder('dia [DATA DO EVENTO]')).toBe(true)
    expect(contemPlaceholder('dia 27/06/2026')).toBe(false)
    expect(Object.keys(TEMPLATES)).toEqual(['T1', 'T2', 'T3', 'T4', 'T5'])
    expect(TEMPLATES.T4.subtipo).toBe('antecipado')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run lib/acordos/templates.test.ts`
Expected: FAIL (`Cannot find module './templates'`).

- [ ] **Step 3: Implementar `lib/acordos/templates.ts`**

```ts
import type { CamposAcordo, TemplateId } from './tipos'
import type { ResumoCalculo } from './movimentos'
import { fmtAcrescimo, fmtDataBR, fmtDatasComPrefixo, fmtHoraCurta, fmtHorasTotal } from './tempo'

export const TEMPLATES: Record<TemplateId, { titulo: string; resumo: string; subtipo: 'evento' | 'antecipado' }> = {
  T1: { titulo: 'Evento trabalhado', resumo: 'Trabalharam num evento; compensam com redução de jornada nos dias seguintes.', subtipo: 'evento' },
  T2: { titulo: 'Dispensa antecipada', resumo: 'Saíram antes do horário; compensam com acréscimo de jornada depois.', subtipo: 'evento' },
  T3: { titulo: 'Dia inteiro de folga', resumo: 'Dispensados o dia todo (emenda/ponto facultativo); compensam com acréscimo depois.', subtipo: 'evento' },
  T4: { titulo: 'Banco de horas', resumo: 'Trabalham a mais antes e folgam depois, com prazo máximo.', subtipo: 'antecipado' },
  T5: { titulo: 'Dia de descanso trabalhado', resumo: 'Trabalharam num dia de descanso; compensam com folga.', subtipo: 'evento' },
}

export type ResultadoTexto = { ok: true; texto: string } | { ok: false; erro: string }

export function contemPlaceholder(texto: string): boolean {
  return /\[[^\]]*\]/.test(texto)
}

const limpa = (s?: string) => (s ?? '').replace(/\s+/g, ' ').trim().slice(0, 80)
const falta = (): ResultadoTexto => ({ ok: false, erro: 'O texto gerado contém colchetes ou campo em branco.' })

/** Gera o parágrafo do objeto (depois de "…com a finalidade de que os funcionários "). */
export function gerarObjeto(c: CamposAcordo, r: ResumoCalculo): ResultadoTexto {
  const nome = limpa(c.nomeEvento)
  const motivo = limpa(c.motivo)
  const datas = c.datasAjuste.length ? fmtDatasComPrefixo(c.datasAjuste) : ''
  const periodo = c.periodoInicio && c.periodoFim
    ? `, das ${fmtHoraCurta(c.periodoInicio)} às ${fmtHoraCurta(c.periodoFim)}`
    : ''
  const sufixoPrazo = c.template !== 'T4' && c.prazoLimite
    ? ` O prazo máximo para a compensação é ${fmtDataBR(c.prazoLimite)}.`
    : ''
  const horas = fmtHorasTotal(r.horasTotalMin)
  const porDia = fmtAcrescimo(r.minutosPorDia)

  let texto = ''
  switch (c.template) {
    case 'T1':
      if (!c.dataEvento || !nome || !datas || r.minutosPorDia <= 0) return falta()
      texto = `trabalharem no dia ${fmtDataBR(c.dataEvento)} (${nome})${periodo}, com redução de ${porDia} diária no horário normal ${datas}, compensando assim ${horas} laborada(s) no referido evento.${sufixoPrazo}`
      break
    case 'T2':
      if (!c.dataEvento || !nome || !c.horaNormal || !c.horaDispensa || !datas || r.minutosPorDia <= 0) return falta()
      texto = `trabalharem normalmente até as ${fmtHoraCurta(c.horaNormal)} no dia ${fmtDataBR(c.dataEvento)} (${nome}), sendo dispensados às ${fmtHoraCurta(c.horaDispensa)} conforme ${motivo || 'decreto municipal'}, compensando as ${horas} não laboradas com acréscimo de ${porDia} diária no horário normal ${datas}.${sufixoPrazo}`
      break
    case 'T3':
      if (!c.dataFolga || !motivo || !datas || r.minutosPorDia <= 0) return falta()
      texto = `serem dispensados do trabalho no dia ${fmtDataBR(c.dataFolga)} (${motivo}), compensando as ${horas} não laboradas com acréscimo de ${porDia} diária no horário normal ${datas}.${sufixoPrazo}`
      break
    case 'T4':
      if (!c.dataFolga || !motivo || !datas || !c.prazoLimite || r.minutosPorDia <= 0) return falta()
      texto = `trabalharem com acréscimo de ${porDia} diária no horário normal ${datas}, formando um saldo de ${horas} a ser compensado com a dispensa do trabalho no dia ${fmtDataBR(c.dataFolga)} (${motivo}), com prazo máximo de compensação até ${fmtDataBR(c.prazoLimite)}.`
      break
    case 'T5': {
      if (!c.dataEvento || !nome || !c.dataFolga || r.horasTotalMin <= 0) return falta()
      const folga = fmtDataBR(c.dataFolga)
      const dispensa = r.horasTotalMin === r.jornadaFolgaMin
        ? `com a dispensa do trabalho no dia ${folga}`
        : `com a dispensa de ${horas} do horário de trabalho no dia ${folga}`
      texto = `trabalharem no dia ${fmtDataBR(c.dataEvento)} (${nome})${periodo}, compensando as ${horas} laboradas ${dispensa}.${sufixoPrazo}`
      break
    }
  }
  return contemPlaceholder(texto) ? falta() : { ok: true, texto }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run lib/acordos/templates.test.ts`
Expected: `8 passed`.

- [ ] **Step 5: Commit**

```bash
git add lib/acordos/templates.ts lib/acordos/templates.test.ts
git commit -m "feat(acordos): templates T1-T5 do paragrafo do objeto"
```

### Task 7: Validador

**Files:**
- Create: `lib/acordos/validar.ts`
- Test: `lib/acordos/validar.test.ts`

Achado `erro` bloqueia o salvamento; `aviso` só informa. Consequência importante dos limites: a jornada do dia não pode passar de 10h e o acréscimo diário de 2h. Para compensar uma folga de 8h48 numa jornada de 8h48, o acréscimo por dia fica em no máximo 72 min, então são necessários **8 dias úteis** (8h48 ÷ 8 = 66 min/dia). Os testes usam esse cenário.

- [ ] **Step 1: Escrever `lib/acordos/validar.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { validarAcordo, camposFaltando, temErro, type MapaFeriados } from './validar'
import { func, T_5X2_540 } from './__fixtures__'
import type { Achado, CamposAcordo } from './tipos'

const codigos = (a: Achado[]) => a.map(x => x.codigo)

// Folga na sexta 05/06 (528 min) compensada em 8 dias úteis seguidos (66 min/dia), tudo em junho.
const OITO_DIAS = ['2026-06-08', '2026-06-09', '2026-06-10', '2026-06-11', '2026-06-12', '2026-06-15', '2026-06-16', '2026-06-17']
const t3: CamposAcordo = { template: 'T3', dataFolga: '2026-06-05', motivo: 'ponto facultativo municipal', datasAjuste: OITO_DIAS }
const f1 = func('a')

describe('validarAcordo', () => {
  it('T3 válido não gera achados', () => {
    expect(validarAcordo(t3, [f1], new Map())).toEqual([])
  })

  it('T1 válido não gera achados', () => {
    const c: CamposAcordo = {
      template: 'T1', dataEvento: '2026-06-13', nomeEvento: 'Festa', minutosOrigem: 120,
      datasAjuste: ['2026-06-15', '2026-06-16'],
    }
    expect(validarAcordo(c, [f1], new Map())).toEqual([])
  })

  it('exige funcionário', () => {
    expect(codigos(validarAcordo(t3, [], new Map()))).toContain('SEM_FUNCIONARIOS')
  })

  it('bloqueia escala não elegível (12x36) e avisa status/sem turno', () => {
    const a = validarAcordo(t3, [func('x', undefined, { regime: '12x36', status: 'afastado', semTurno: true })], new Map())
    expect(codigos(a)).toEqual(expect.arrayContaining(['REGIME_NAO_ELEGIVEL', 'STATUS', 'SEM_TURNO']))
    expect(a.find(x => x.codigo === 'REGIME_NAO_ELEGIVEL')?.nivel).toBe('erro')
    expect(a.find(x => x.codigo === 'STATUS')?.nivel).toBe('aviso')
  })

  it('bloqueia dia de ajuste em folga da escala', () => {
    const c = { ...t3, datasAjuste: [...OITO_DIAS.slice(0, 7), '2026-06-13'] } // 13/06 = sábado
    expect(codigos(validarAcordo(c, [f1], new Map()))).toContain('DIA_DE_FOLGA')
  })

  it('bloqueia acréscimo diário acima de 2h e jornada acima de 10h', () => {
    const c = { ...t3, datasAjuste: ['2026-06-08', '2026-06-09'] } // 264 min/dia
    expect(codigos(validarAcordo(c, [f1], new Map()))).toEqual(expect.arrayContaining(['LIMITE_ACRESCIMO', 'LIMITE_JORNADA']))
  })

  it('bloqueia quando as horas não dividem igualmente pelos dias', () => {
    const c = { ...t3, datasAjuste: [...OITO_DIAS.slice(0, 4), '2026-06-15'] } // 528 / 5
    expect(codigos(validarAcordo(c, [f1], new Map()))).toContain('DIVISAO')
  })

  it('exige campos por template', () => {
    expect(camposFaltando({ template: 'T4', datasAjuste: [] })).toEqual(['data da folga', 'motivo', 'dias de acréscimo', 'prazo limite'])
    const a = validarAcordo({ template: 'T4', datasAjuste: [] }, [f1], new Map())
    expect(a.find(x => x.codigo === 'CAMPO_OBRIGATORIO')?.mensagem).toContain('prazo limite')
  })

  it('bloqueia horário de dispensa não anterior ao horário normal (T2)', () => {
    const c: CamposAcordo = {
      template: 'T2', dataEvento: '2026-06-05', nomeEvento: 'Emenda', horaNormal: '12:00', horaDispensa: '15:00',
      datasAjuste: ['2026-06-08', '2026-06-09'],
    }
    expect(codigos(validarAcordo(c, [f1], new Map()))).toContain('HORARIO_INVALIDO')
  })

  it('avisa quando a saída normal do turno difere da informada (T2)', () => {
    const c: CamposAcordo = {
      template: 'T2', dataEvento: '2026-06-05', nomeEvento: 'Emenda', horaNormal: '16:00', horaDispensa: '13:00',
      datasAjuste: ['2026-06-08', '2026-06-09', '2026-06-10'],
    }
    expect(codigos(validarAcordo(c, [f1], new Map()))).toContain('SAIDA_DIFERENTE')
  })

  it('separa jornadas diferentes no dia da folga', () => {
    const c: CamposAcordo = {
      template: 'T3', dataFolga: '2026-06-08', motivo: 'x',
      datasAjuste: ['2026-06-09', '2026-06-10', '2026-06-11', '2026-06-12', '2026-06-15', '2026-06-16', '2026-06-17', '2026-06-18'],
    }
    expect(codigos(validarAcordo(c, [f1, func('b', T_5X2_540)], new Map()))).toContain('JORNADAS_DIFERENTES')
  })

  it('avisa feriado e ponto facultativo nos dias de ajuste', () => {
    const feriados: MapaFeriados = new Map([['2026-06-09', { nome: 'Ponto facultativo', tipo: 'facultativo' }]])
    const a = validarAcordo(t3, [f1], feriados)
    expect(codigos(a)).toContain('FERIADO')
    expect(temErro(a)).toBe(false)
  })

  describe('mês cruzado (banco de horas)', () => {
    const cruza: CamposAcordo = {
      template: 'T3', dataFolga: '2026-06-26', motivo: 'ponto facultativo',
      datasAjuste: ['2026-06-29', '2026-06-30', '2026-07-01', '2026-07-02', '2026-07-03', '2026-07-06', '2026-07-07', '2026-07-08'],
    }

    it('avisa e exige prazo', () => {
      const a = validarAcordo(cruza, [f1], new Map())
      expect(codigos(a)).toEqual(expect.arrayContaining(['BANCO_HORAS', 'PRAZO_OBRIGATORIO']))
    })

    it('aceita prazo dentro de 6 meses', () => {
      const a = validarAcordo({ ...cruza, prazoLimite: '2026-12-20' }, [f1], new Map())
      expect(temErro(a)).toBe(false)
      expect(codigos(a)).toContain('BANCO_HORAS')
    })

    it('recusa prazo além de 6 meses ou antes da última data', () => {
      expect(codigos(validarAcordo({ ...cruza, prazoLimite: '2027-01-20' }, [f1], new Map()))).toContain('PRAZO_LONGO')
      expect(codigos(validarAcordo({ ...cruza, prazoLimite: '2026-07-03' }, [f1], new Map()))).toContain('PRAZO_ANTES')
    })
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run lib/acordos/validar.test.ts`
Expected: FAIL (`Cannot find module './validar'`).

- [ ] **Step 3: Implementar `lib/acordos/validar.ts`**

```ts
import type { Achado, CamposAcordo, FuncionarioCalc, NivelAchado } from './tipos'
import { addMeses, diaSemanaDe, fmtDataBR, hhmmParaMin, mesDe } from './tempo'
import { MAX_ACRESCIMO_DIA_MIN, MAX_JORNADA_DIA_MIN, PRAZO_MAXIMO_MESES, regimeElegivel } from './regras'
import { agruparPorJornada, construirMovimentos, jornadaDoDia, resumoCalculo, saldoMin } from './movimentos'

export type MapaFeriados = Map<string, { nome: string; tipo: string }>

export function temErro(achados: Achado[]): boolean {
  return achados.some(a => a.nivel === 'erro')
}

export function camposFaltando(c: CamposAcordo): string[] {
  const faltas: string[] = []
  const t = c.template
  if (t === 'T1' || t === 'T2' || t === 'T5') {
    if (!c.dataEvento) faltas.push('data do evento')
    if (!(c.nomeEvento ?? '').trim()) faltas.push('nome do evento')
  }
  if ((t === 'T1' || t === 'T5') && !(c.minutosOrigem && c.minutosOrigem > 0)) faltas.push('horas trabalhadas no evento')
  if (t === 'T2') {
    if (!c.horaNormal) faltas.push('horário normal de saída')
    if (!c.horaDispensa) faltas.push('horário de dispensa')
  }
  if (t === 'T3' || t === 'T4' || t === 'T5') {
    if (!c.dataFolga) faltas.push('data da folga')
  }
  if ((t === 'T3' || t === 'T4') && !(c.motivo ?? '').trim()) faltas.push('motivo')
  if (t !== 'T5' && c.datasAjuste.length === 0) faltas.push(t === 'T4' ? 'dias de acréscimo' : 'dias de compensação')
  if (t === 'T4' && !c.prazoLimite) faltas.push('prazo limite')
  return faltas
}

export function validarAcordo(c: CamposAcordo, funcs: FuncionarioCalc[], feriados: MapaFeriados = new Map()): Achado[] {
  const out: Achado[] = []
  const add = (nivel: NivelAchado, codigo: string, mensagem: string, funcionarioId?: string) =>
    out.push({ nivel, codigo, mensagem, funcionarioId })

  if (funcs.length === 0) add('erro', 'SEM_FUNCIONARIOS', 'Selecione ao menos um funcionário.')
  for (const f of funcs) {
    if (!regimeElegivel(f.regime)) {
      add('erro', 'REGIME_NAO_ELEGIVEL', `${f.nome}: a escala ${f.regime} não é elegível a acordo de compensação.`, f.id)
    }
    if (f.status !== 'ativo') add('aviso', 'STATUS', `${f.nome} está com status "${f.status}".`, f.id)
    if (f.semTurno) add('aviso', 'SEM_TURNO', `${f.nome}: sem horário cadastrado; usando o padrão 5x2 de 44h.`, f.id)
  }

  const faltando = camposFaltando(c)
  if (faltando.length) {
    add('erro', 'CAMPO_OBRIGATORIO', `Preencha: ${faltando.join(', ')}.`)
    return out
  }
  if (funcs.length === 0) return out

  const ajuste = c.datasAjuste
  if (new Set(ajuste).size !== ajuste.length) add('erro', 'DATAS_REPETIDAS', 'Há datas repetidas nos dias de compensação.')
  if (c.template === 'T2' && hhmmParaMin(c.horaDispensa!) >= hhmmParaMin(c.horaNormal!)) {
    add('erro', 'HORARIO_INVALIDO', 'O horário de dispensa deve ser anterior ao horário normal de saída.')
  }

  if (agruparPorJornada(c, funcs).length > 1) {
    add('erro', 'JORNADAS_DIFERENTES', 'Os funcionários têm jornadas diferentes no dia da folga. Gere um acordo por grupo de jornada.')
  }

  const r = resumoCalculo(c, funcs)
  const n = ajuste.length
  const dividiu = n === 0 || c.template === 'T5' || r.horasTotalMin % n === 0
  if (!dividiu) {
    add('erro', 'DIVISAO', `As ${r.horasTotalMin} min a compensar não dividem igualmente por ${n} dias. Ajuste a quantidade de dias.`)
  }

  const acrescimo = c.template === 'T2' || c.template === 'T3' || c.template === 'T4'
  if (acrescimo && r.minutosPorDia > MAX_ACRESCIMO_DIA_MIN) {
    add('erro', 'LIMITE_ACRESCIMO', `Acréscimo de ${r.minutosPorDia} min por dia excede o limite de ${MAX_ACRESCIMO_DIA_MIN} min (2h).`)
  }

  const feriadoAvisado = new Set<string>()
  for (const d of ajuste) {
    const fer = feriados.get(d)
    if (fer && !feriadoAvisado.has(d)) {
      feriadoAvisado.add(d)
      add('aviso', 'FERIADO', `${fmtDataBR(d)} cai em ${fer.nome} (${fer.tipo}).`)
    }
  }
  for (const f of funcs) {
    for (const d of ajuste) {
      const jd = jornadaDoDia(f, d)
      if (jd === 0) {
        add('erro', 'DIA_DE_FOLGA', `${f.nome}: ${fmtDataBR(d)} é dia de folga na escala dele.`, f.id)
      } else if (acrescimo && jd + r.minutosPorDia > MAX_JORNADA_DIA_MIN) {
        add('erro', 'LIMITE_JORNADA', `${f.nome}: em ${fmtDataBR(d)} a jornada passaria de 10h (${jd} + ${r.minutosPorDia} min).`, f.id)
      } else if (c.template === 'T1' && r.minutosPorDia > jd) {
        add('erro', 'REDUCAO_MAIOR', `${f.nome}: a redução de ${r.minutosPorDia} min é maior que a jornada de ${fmtDataBR(d)}.`, f.id)
      }
    }
    if (c.dataFolga && (c.template === 'T3' || c.template === 'T4' || c.template === 'T5')) {
      const jf = jornadaDoDia(f, c.dataFolga)
      if (jf === 0) {
        add('erro', 'DIA_DE_FOLGA', `${f.nome}: ${fmtDataBR(c.dataFolga)} já é dia de folga na escala dele.`, f.id)
      } else if (c.template === 'T5' && r.horasTotalMin > jf) {
        add('erro', 'FOLGA_MAIOR', `${f.nome}: as horas trabalhadas superam a jornada do dia da folga.`, f.id)
      }
    }
    if (c.template === 'T2' && c.dataEvento) {
      const dia = f.semana[diaSemanaDe(c.dataEvento)]
      const saida = dia.s2 || dia.s1
      if (saida && saida !== c.horaNormal) {
        add('aviso', 'SAIDA_DIFERENTE', `${f.nome}: a saída normal em ${fmtDataBR(c.dataEvento)} é ${saida}, diferente de ${c.horaNormal}.`, f.id)
      }
    }
  }
  if (c.dataFolga && (c.template === 'T3' || c.template === 'T4' || c.template === 'T5')) {
    const fer = feriados.get(c.dataFolga)
    if (fer && fer.tipo !== 'facultativo') {
      add('aviso', 'FERIADO', `${fmtDataBR(c.dataFolga)} já é feriado (${fer.nome}); a dispensa não gera compensação.`)
    }
  }

  if (dividiu) {
    for (const f of funcs) {
      const saldo = saldoMin(construirMovimentos(c, [f]))
      if (saldo !== 0) add('erro', 'SALDO', `${f.nome}: o saldo do acordo é ${saldo} min (deve ser zero).`, f.id)
    }
  }

  const datas = [c.dataEvento, c.dataFolga, ...ajuste].filter((d): d is string => !!d).sort()
  const cruza = new Set(datas.map(mesDe)).size > 1
  if (cruza && c.template !== 'T4') {
    add('aviso', 'BANCO_HORAS', 'Compensação em mês diferente do evento: tratada como banco de horas (prazo máximo de 6 meses). Confirmar com o RH.')
    if (!c.prazoLimite) add('erro', 'PRAZO_OBRIGATORIO', 'As datas cruzam o mês: informe o prazo limite (até 6 meses).')
  }
  if (c.prazoLimite && datas.length) {
    if (datas[datas.length - 1] > c.prazoLimite) add('erro', 'PRAZO_ANTES', 'O prazo limite é anterior à última data do acordo.')
    if (c.prazoLimite > addMeses(datas[0], PRAZO_MAXIMO_MESES)) {
      add('erro', 'PRAZO_LONGO', `O prazo limite passa de ${PRAZO_MAXIMO_MESES} meses da primeira data.`)
    }
  }
  return out
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run lib/acordos/validar.test.ts`
Expected: `15 passed`. Se algum caso falhar, corrigir a regra correspondente (não o teste), exceto se a data de exemplo estiver errada (conferir dia da semana com `diaSemanaDe`).

- [ ] **Step 5: Rodar toda a suíte e commitar**

Run: `npm test`
Expected: todos os arquivos passam.

```bash
git add lib/acordos/validar.ts lib/acordos/validar.test.ts
git commit -m "feat(acordos): validador de regras (limites, escala, saldo, mes cruzado)"
```

---

### Task 8: Migration e acesso ao calendário

**Files:**
- Create: `supabase/migrations/20260922_acordos_movimentos_calendario.sql`
- Create: `lib/calendario/mapa.ts`
- Create: `lib/calendario/mogi.ts`

**NÃO aplicar a migration no Supabase neste plano.** O usuário aplica no Supabase Studio (SQL Editor) depois de revisar. Até lá, o carregamento do calendário devolve lista vazia e `criarAcordo` falha com mensagem clara.

- [ ] **Step 1: Criar a migration**

```sql
-- Acordos de compensação: campos estruturados, livro de movimentos e calendário de feriados de Mogi.
-- Aditiva: nenhuma coluna ou dado existente é alterado. Aplicar no Supabase Studio (SQL Editor).

ALTER TABLE acordos_compensacao
  ADD COLUMN IF NOT EXISTS evento_data date,
  ADD COLUMN IF NOT EXISTS evento_nome text,
  ADD COLUMN IF NOT EXISTS template_id text CHECK (template_id IN ('T1','T2','T3','T4','T5')),
  ADD COLUMN IF NOT EXISTS prazo_limite date,
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'manual' CHECK (origem IN ('manual','ia')),
  ADD COLUMN IF NOT EXISTS pedido_original text;

CREATE TABLE IF NOT EXISTS acordo_movimentos (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  acordo_id      uuid NOT NULL REFERENCES acordos_compensacao(id) ON DELETE CASCADE,
  funcionario_id uuid NOT NULL REFERENCES funcionarios(id),
  data           date NOT NULL,
  minutos        integer NOT NULL,
  papel          text NOT NULL CHECK (papel IN ('origem','quitacao')),
  status         text NOT NULL DEFAULT 'previsto'
                 CHECK (status IN ('previsto','cumprido','nao_cumprido','dispensado_ajuste')),
  observacao     text,
  verificado_em  timestamptz,
  created_at     timestamptz DEFAULT now(),
  UNIQUE (acordo_id, funcionario_id, data, papel)
);
CREATE INDEX IF NOT EXISTS idx_acordo_movimentos_acordo ON acordo_movimentos (acordo_id);
CREATE INDEX IF NOT EXISTS idx_acordo_movimentos_func_data ON acordo_movimentos (funcionario_id, data);

ALTER TABLE acordo_movimentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS acordo_movimentos_select ON acordo_movimentos;
CREATE POLICY acordo_movimentos_select ON acordo_movimentos
  FOR SELECT TO authenticated
  USING (
    is_admin_or_coord() OR is_viewer()
    OR funcionario_id IN (
      SELECT id FROM funcionarios WHERE posto_id IN (SELECT get_supervisor_posto_ids())
    )
  );
-- Escrita somente via service role (Server Actions com createAdminClient).

CREATE TABLE IF NOT EXISTS calendario_feriados (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data       date NOT NULL,
  nome       text NOT NULL,
  tipo       text NOT NULL CHECK (tipo IN ('nacional','estadual','municipal','facultativo')),
  ate_hora   time,
  base_legal text,
  ativo      boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE (data, nome)
);

ALTER TABLE calendario_feriados ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS calendario_feriados_select ON calendario_feriados;
CREATE POLICY calendario_feriados_select ON calendario_feriados
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS calendario_feriados_write ON calendario_feriados;
CREATE POLICY calendario_feriados_write ON calendario_feriados
  FOR ALL TO authenticated
  USING (is_admin_or_coord()) WITH CHECK (is_admin_or_coord());
```

- [ ] **Step 2: Criar `lib/calendario/mapa.ts` (puro, pode ser importado por componentes client)**

```ts
import type { TipoFeriado } from './feriados-mogi'

export interface CalendarioLinha {
  data: string
  nome: string
  tipo: TipoFeriado
  ate_hora: string | null
}

export function calendarioParaMapa(linhas: CalendarioLinha[]): Map<string, { nome: string; tipo: string }> {
  return new Map(linhas.map(l => [l.data, { nome: l.nome, tipo: l.tipo }]))
}
```

- [ ] **Step 3: Criar `lib/calendario/mogi.ts` (só servidor)**

```ts
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { feriadosParaAno } from './feriados-mogi'
import type { CalendarioLinha } from './mapa'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any

/** Semeia o ano com os feriados de lei (e facultativos conhecidos) se ainda não houver nenhuma linha nele. */
async function garantirAno(ano: number): Promise<void> {
  const admin = createAdminClient() as AnyClient
  const { data } = await admin
    .from('calendario_feriados')
    .select('id')
    .gte('data', `${ano}-01-01`)
    .lte('data', `${ano}-12-31`)
    .limit(1)
  if (data && data.length > 0) return
  await admin
    .from('calendario_feriados')
    .upsert(feriadosParaAno(ano).map(f => ({ ...f, ativo: true })), { onConflict: 'data,nome', ignoreDuplicates: true })
}

/** Linhas ativas do calendário nos anos pedidos. Devolve [] se a tabela ainda não existir. */
export async function carregarCalendario(anos: number[]): Promise<CalendarioLinha[]> {
  if (anos.length === 0) return []
  await Promise.all(anos.map(garantirAno))
  const { data } = await (createClient() as AnyClient)
    .from('calendario_feriados')
    .select('data, nome, tipo, ate_hora')
    .eq('ativo', true)
    .gte('data', `${Math.min(...anos)}-01-01`)
    .lte('data', `${Math.max(...anos)}-12-31`)
    .order('data')
  return ((data ?? []) as CalendarioLinha[]).map(l => ({ ...l, ate_hora: l.ate_hora ? l.ate_hora.slice(0, 5) : null }))
}
```

- [ ] **Step 4: Type-check e commit**

Run: `npx tsc --noEmit`
Expected: sem erros novos (se houver erros pré-existentes em outros arquivos, apenas garantir que nenhum aponta para arquivos criados neste plano).

```bash
git add supabase/migrations/20260922_acordos_movimentos_calendario.sql lib/calendario/mapa.ts lib/calendario/mogi.ts
git commit -m "feat(acordos): migration de movimentos/calendario e leitura do calendario"
```

### Task 9: Sugestão de dias de compensação

**Files:**
- Create: `lib/acordos/dias.ts`
- Test: `lib/acordos/dias.test.ts`

Ajuda o supervisor a não escolher 8 datas na mão: sugere quantos dias são necessários e quais (próximos dias úteis de todos os funcionários, pulando feriados e pontos facultativos do calendário).

- [ ] **Step 1: Escrever `lib/acordos/dias.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { sugerirQuantidadeDias, proximosDiasUteis } from './dias'
import { func } from './__fixtures__'

describe('sugerirQuantidadeDias', () => {
  it('escolhe o menor número de dias que divide exato e respeita o máximo por dia', () => {
    expect(sugerirQuantidadeDias(528, 72)).toBe(8)   // 66 min/dia
    expect(sugerirQuantidadeDias(120, 60)).toBe(2)   // 60 min/dia
  })

  it('devolve null quando não existe divisão possível', () => {
    expect(sugerirQuantidadeDias(100, 3)).toBeNull()
  })
})

describe('proximosDiasUteis', () => {
  const f1 = func('a')

  it('pula fim de semana', () => {
    expect(proximosDiasUteis('2026-06-05', 3, [f1], new Map())).toEqual(['2026-06-08', '2026-06-09', '2026-06-10'])
  })

  it('pula feriados e pontos facultativos do calendário', () => {
    const feriados = new Map([['2026-06-09', { nome: 'Ponto facultativo', tipo: 'facultativo' }]])
    expect(proximosDiasUteis('2026-06-05', 3, [f1], feriados)).toEqual(['2026-06-08', '2026-06-10', '2026-06-11'])
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run lib/acordos/dias.test.ts`
Expected: FAIL (`Cannot find module './dias'`).

- [ ] **Step 3: Implementar `lib/acordos/dias.ts`**

```ts
import type { FuncionarioCalc } from './tipos'
import { addDias } from './tempo'
import { jornadaDoDia } from './movimentos'
import type { MapaFeriados } from './validar'

/** Menor quantidade de dias (até `maxDias`) que divide `totalMin` exatamente sem passar de `maxPorDiaMin` por dia. */
export function sugerirQuantidadeDias(totalMin: number, maxPorDiaMin: number, maxDias = 31): number | null {
  for (let n = 1; n <= maxDias; n++) {
    if (totalMin % n === 0 && totalMin / n <= maxPorDiaMin) return n
  }
  return null
}

/** Próximos `quantidade` dias (depois de `inicio`) em que todos trabalham e que não constam no calendário. */
export function proximosDiasUteis(
  inicio: string,
  quantidade: number,
  funcs: FuncionarioCalc[],
  feriados: MapaFeriados,
): string[] {
  const out: string[] = []
  let d = inicio
  for (let i = 0; i < 400 && out.length < quantidade; i++) {
    d = addDias(d, 1)
    if (feriados.has(d)) continue
    if (funcs.length > 0 && funcs.every(f => jornadaDoDia(f, d) > 0)) out.push(d)
  }
  return out
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run lib/acordos/dias.test.ts`
Expected: `4 passed`.

- [ ] **Step 5: Commit**

```bash
git add lib/acordos/dias.ts lib/acordos/dias.test.ts
git commit -m "feat(acordos): sugestao de quantidade e datas de compensacao"
```

---

### Task 10: Server Actions (busca elegível + `criarAcordo` novo)

**Files:**
- Modify: `app/(admin)/acordos/actions.ts`

Depois desta task o `modal-novo-acordo.tsx` antigo deixa de compilar (assinaturas mudam). Isso é esperado; a Task 11 o reescreve. Não rodar `npm run build` antes da Task 11.

Segurança: leituras usam `createClient()` (RLS do usuário), então supervisor só enxerga funcionários dos postos dele; `criarAcordo` recusa ids que não voltarem da consulta. O servidor **revalida tudo** (elegibilidade, validador, texto) e nunca confia no texto vindo do navegador.

- [ ] **Step 1: Ampliar os imports (topo do arquivo, depois de `requireRole`)**

```ts
import {
  montarSemana, semanaParaTexto, assinaturaSemana, TURNO_PADRAO, type TurnoRow,
} from '@/lib/acordos/horario-do-turno'
import { regimeElegivel } from '@/lib/acordos/regras'
import { resolverTipoEscala, FUNCAO_JOVEM_APRENDIZ } from '@/lib/turnos/escala'
import { construirMovimentos, resumoCalculo } from '@/lib/acordos/movimentos'
import { gerarObjeto, TEMPLATES } from '@/lib/acordos/templates'
import { temErro, validarAcordo } from '@/lib/acordos/validar'
import type { CamposAcordo, FuncionarioCalc, SemanaTurno } from '@/lib/acordos/tipos'
import { carregarCalendario } from '@/lib/calendario/mogi'
import { calendarioParaMapa } from '@/lib/calendario/mapa'
```

- [ ] **Step 2: Adicionar a interface `FuncionarioParaAcordo` (logo depois de `AcordoFuncionarioItem`)**

```ts
export interface FuncionarioParaAcordo extends AcordoFuncionarioItem {
  regime: string
  elegivel: boolean
  motivo_inelegivel: string | null
  semana: SemanaTurno
  sem_turno: boolean
}
```

- [ ] **Step 3: Substituir `buscarFuncionariosPorPostos` (e adicionar os helpers logo acima dela)**

Apagar a função `buscarFuncionariosPorPostos` inteira (do `export async function buscarFuncionariosPorPostos(` até o `}` que a fecha, antes de `marcarEntregueRH`) e colocar no lugar:

```ts
const TAM_LOTE = 100 // evita URL gigante no PostgREST com centenas de ids

async function emLotes<T>(valores: string[], fn: (lote: string[]) => Promise<T[]>): Promise<T[]> {
  const out: T[] = []
  for (let i = 0; i < valores.length; i += TAM_LOTE) out.push(...(await fn(valores.slice(i, i + TAM_LOTE))))
  return out
}

async function carregarFuncionarios(filtro: { postoIds?: string[]; ids?: string[] }): Promise<FuncionarioParaAcordo[]> {
  const supabase = createClient() as AnyClient
  const valores = filtro.ids ?? filtro.postoIds ?? []
  const coluna = filtro.ids ? 'id' : 'posto_id'
  if (!valores.length) return []

  type Row = { id: string; nome: string; status: string; posto_id: string | null; funcoes: { nome: string } | null }
  const rows = await emLotes<Row>(valores, async lote => {
    const { data } = await supabase
      .from('funcionarios')
      .select('id, nome, status, posto_id, funcoes!funcao_id(nome)')
      .in(coluna, lote)
      .not('status', 'eq', 'desligado')
      .order('nome')
    return (data ?? []) as Row[]
  })
  if (!rows.length) return []

  type TurnoJoin = { funcionario_id: string; turnos_postos: (TurnoRow & { nome: string }) | null }
  const horarios = await emLotes<TurnoJoin>(rows.map(r => r.id), async lote => {
    const { data } = await supabase
      .from('horarios_funcionarios')
      .select('funcionario_id, turnos_postos!turno_id(*)')
      .in('funcionario_id', lote)
      .is('data_fim', null)
    return (data ?? []) as TurnoJoin[]
  })
  const turnoPorFunc = new Map<string, TurnoRow & { nome: string }>()
  for (const h of horarios) if (h.turnos_postos) turnoPorFunc.set(h.funcionario_id, h.turnos_postos)

  const postoIds = Array.from(new Set(rows.map(r => r.posto_id).filter((p): p is string => !!p)))
  const escalas = await emLotes<{ posto_id: string; regime: string }>(postoIds, async lote => {
    const { data } = await supabase.from('config_escalas_postos').select('posto_id, regime').in('posto_id', lote)
    return (data ?? []) as { posto_id: string; regime: string }[]
  })
  const regimePosto = new Map(escalas.map(e => [e.posto_id, e.regime]))

  return rows.map(r => {
    const turno = turnoPorFunc.get(r.id) ?? null
    const funcao = r.funcoes?.nome ?? null
    const jovem = (funcao ?? '').toUpperCase() === FUNCAO_JOVEM_APRENDIZ
    const regime = jovem
      ? 'jovem_aprendiz'
      : turno?.tipo_escala ?? resolverTipoEscala(r.posto_id ? regimePosto.get(r.posto_id) : null)
    const elegivel = regimeElegivel(regime)
    return {
      id: r.id,
      nome: r.nome,
      funcao,
      status: r.status,
      turno_nome: turno?.nome ?? null,
      regime,
      elegivel,
      motivo_inelegivel: elegivel
        ? null
        : jovem
          ? 'Jovem aprendiz: compensação de jornada vedada (art. 432 CLT).'
          : `Escala ${regime} não é elegível a acordo de compensação.`,
      semana: montarSemana(turno ?? TURNO_PADRAO),
      sem_turno: !turno,
    }
  })
}

function paraCalc(funcs: FuncionarioParaAcordo[]): FuncionarioCalc[] {
  return funcs.map(f => ({
    id: f.id, nome: f.nome, status: f.status, regime: f.regime, semana: f.semana, semTurno: f.sem_turno,
  }))
}

export async function buscarFuncionariosPorPostos(postoIds: string[]): Promise<FuncionarioParaAcordo[]> {
  return carregarFuncionarios({ postoIds })
}
```

- [ ] **Step 4: Substituir `criarAcordo`**

Apagar a função `criarAcordo` antiga (do `export async function criarAcordo(` até o `}` antes de `excluirAcordo`) e colocar:

```ts
function anosDoAcordo(c: CamposAcordo): number[] {
  const datas = [c.dataEvento, c.dataFolga, c.prazoLimite, ...c.datasAjuste].filter((d): d is string => !!d)
  return Array.from(new Set(datas.map(d => Number(d.slice(0, 4)))))
}

export async function criarAcordo(dados: {
  titulo: string
  tipo: 'individual' | 'coletivo'
  postos: AcordoPostoItem[]
  funcionarioIds: string[]
  data_documento: string
  campos: CamposAcordo
}): Promise<{ id: string } | { error: string }> {
  const guard = await requireRole(['admin', 'coordenador', 'supervisor'])
  if (!guard.success) return { error: guard.error }
  if (!dados.titulo.trim()) return { error: 'Informe o título do acordo.' }
  if (!dados.postos.length) return { error: 'Selecione ao menos um posto.' }

  const ids = Array.from(new Set(dados.funcionarioIds))
  const funcs = await carregarFuncionarios({ ids })
  if (ids.length === 0 || funcs.length !== ids.length) {
    return { error: 'Algum funcionário não foi encontrado ou você não tem acesso a ele.' }
  }
  const inelegivel = funcs.find(f => !f.elegivel)
  if (inelegivel) return { error: `${inelegivel.nome}: ${inelegivel.motivo_inelegivel}` }

  const calc = paraCalc(funcs)
  const feriados = calendarioParaMapa(await carregarCalendario(anosDoAcordo(dados.campos)))
  const achados = validarAcordo(dados.campos, calc, feriados)
  if (temErro(achados)) {
    return { error: achados.filter(a => a.nivel === 'erro').map(a => a.mensagem).join(' ') }
  }
  const texto = gerarObjeto(dados.campos, resumoCalculo(dados.campos, calc))
  if (!texto.ok) return { error: texto.erro }

  const porSemana = new Map<string, FuncionarioParaAcordo[]>()
  for (const f of funcs) {
    const chave = assinaturaSemana(f.semana)
    porSemana.set(chave, [...(porSemana.get(chave) ?? []), f])
  }
  const grupos = Array.from(porSemana.values())
  const horarios: TurnoHorario[] = grupos.map((g, i) => ({
    label: grupos.length === 1 ? 'Turno Único' : `Turno ${String.fromCharCode(65 + i)}`,
    horario: semanaParaTexto(g[0].semana),
    funcionario_ids: g.map(f => f.id),
  }))

  const admin = createAdminClient() as AnyClient
  const { data, error } = await admin
    .from('acordos_compensacao')
    .insert({
      titulo: dados.titulo.trim(),
      tipo: dados.tipo,
      subtipo: TEMPLATES[dados.campos.template].subtipo,
      postos: dados.postos,
      funcionarios: funcs.map(f => ({ id: f.id, nome: f.nome, funcao: f.funcao, status: f.status })),
      horario_semana: { _v: 2, turnos: horarios },
      descricao_acordo: texto.texto,
      data_documento: dados.data_documento,
      criado_por: guard.auth.user.id,
      evento_data: dados.campos.dataEvento ?? null,
      evento_nome: dados.campos.nomeEvento?.trim() || null,
      template_id: dados.campos.template,
      prazo_limite: dados.campos.prazoLimite ?? null,
      origem: 'manual',
    })
    .select('id')
    .single()
  if (error) return { error: error.message }

  const movimentos = construirMovimentos(dados.campos, calc).map(m => ({
    acordo_id: data.id,
    funcionario_id: m.funcionarioId,
    data: m.data,
    minutos: m.minutos,
    papel: m.papel,
  }))
  const { error: errMov } = await admin.from('acordo_movimentos').insert(movimentos)
  if (errMov) {
    await admin.from('acordos_compensacao').delete().eq('id', data.id)
    return { error: `Não foi possível gravar os movimentos do acordo: ${errMov.message}` }
  }

  revalidatePath('/acordos')
  return { id: data.id }
}
```

- [ ] **Step 5: Type-check apenas deste arquivo**

Run: `npx tsc --noEmit 2>&1 | grep "acordos/actions"`
Expected: nenhuma linha (sem erros em `actions.ts`). Erros em `modal-novo-acordo.tsx` são esperados até a Task 11.

- [ ] **Step 6: Commit**

```bash
git add "app/(admin)/acordos/actions.ts"
git commit -m "feat(acordos): actions com elegibilidade por escala, validacao no servidor e criado_por"
```

### Task 11: Modal guiado (campos por template)

**Files:**
- Create: `components/acordos/campos-template.tsx`
- Rewrite: `components/acordos/modal-novo-acordo.tsx`

Sem teste automatizado (UI); a lógica testável já está em `lib/acordos/`. Visual segue o design system do `CLAUDE.md` (fundo `slate-50`, botão primário `bg-slate-900`, labels `uppercase tracking-widest text-xs text-slate-500`).

- [ ] **Step 1: Criar `components/acordos/campos-template.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import type { CamposAcordo, TemplateId } from '@/lib/acordos/tipos'
import { fmtDataBR, hhmmParaMin } from '@/lib/acordos/tempo'
import type { MapaFeriados } from '@/lib/acordos/validar'

export interface FormState {
  dataEvento: string
  nomeEvento: string
  periodoInicio: string
  periodoFim: string
  duracao: string          // 'HH:MM' — usado quando não há período
  horaNormal: string
  horaDispensa: string
  motivo: string
  dataFolga: string
  datasAjuste: string[]
  prazoLimite: string
}

export const FORM_VAZIO: FormState = {
  dataEvento: '', nomeEvento: '', periodoInicio: '', periodoFim: '', duracao: '',
  horaNormal: '', horaDispensa: '', motivo: '', dataFolga: '', datasAjuste: [], prazoLimite: '',
}

export function montarCampos(template: TemplateId, f: FormState): CamposAcordo {
  const doPeriodo = f.periodoInicio && f.periodoFim ? hhmmParaMin(f.periodoFim) - hhmmParaMin(f.periodoInicio) : 0
  const daDuracao = f.duracao ? hhmmParaMin(f.duracao) : 0
  return {
    template,
    dataEvento: f.dataEvento || undefined,
    nomeEvento: f.nomeEvento || undefined,
    periodoInicio: f.periodoInicio || undefined,
    periodoFim: f.periodoFim || undefined,
    minutosOrigem: doPeriodo > 0 ? doPeriodo : daDuracao,
    horaNormal: f.horaNormal || undefined,
    horaDispensa: f.horaDispensa || undefined,
    motivo: f.motivo || undefined,
    dataFolga: f.dataFolga || undefined,
    datasAjuste: f.datasAjuste,
    prazoLimite: f.prazoLimite || undefined,
  }
}

const input = 'w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300'
const label = 'mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-500'

function Campo({ titulo, dica, children }: { titulo: string; dica?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className={label}>{titulo}</label>
      {children}
      {dica && <p className="mt-1 text-xs text-gray-400">{dica}</p>}
    </div>
  )
}

function ListaDatas({ datas, onChange }: { datas: string[]; onChange: (d: string[]) => void }) {
  const [nova, setNova] = useState('')
  function adicionar() {
    if (!nova || datas.includes(nova)) return
    onChange([...datas, nova].sort())
    setNova('')
  }
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input type="date" value={nova} onChange={e => setNova(e.target.value)} className={input} />
        <button
          type="button"
          onClick={adicionar}
          className="flex h-10 shrink-0 items-center gap-1 rounded-lg border border-gray-200 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50"
        >
          <Plus className="h-3.5 w-3.5" /> Adicionar
        </button>
      </div>
      {datas.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {datas.map(d => (
            <span key={d} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
              {fmtDataBR(d)}
              <button type="button" onClick={() => onChange(datas.filter(x => x !== d))} aria-label={`Remover ${fmtDataBR(d)}`}>
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

interface Props {
  template: TemplateId
  f: FormState
  set: <K extends keyof FormState>(k: K, v: FormState[K]) => void
  feriados: MapaFeriados
  onSugerirDias: (() => void) | null
}

export function CamposTemplate({ template: t, f, set, feriados, onSugerirDias }: Props) {
  const usaEvento = t === 'T1' || t === 'T2' || t === 'T5'
  const usaPeriodo = t === 'T1' || t === 'T5'
  const usaFolga = t === 'T3' || t === 'T4' || t === 'T5'
  const usaMotivo = t === 'T2' || t === 'T3' || t === 'T4'
  const usaAjuste = t !== 'T5'
  const rotuloAjuste = t === 'T1' ? 'Dias de redução da jornada' : 'Dias de acréscimo da jornada'
  const dica = feriados.get(f.dataFolga || f.dataEvento)

  return (
    <div className="space-y-4">
      {usaEvento && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Campo titulo="Data do evento">
            <input type="date" value={f.dataEvento} onChange={e => set('dataEvento', e.target.value)} className={input} />
          </Campo>
          <Campo titulo="Nome do evento">
            <input value={f.nomeEvento} onChange={e => set('nomeEvento', e.target.value)} placeholder="ex: Festa Junina" className={input} />
          </Campo>
        </div>
      )}

      {usaPeriodo && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Campo titulo="Das (opcional)">
            <input type="time" value={f.periodoInicio} onChange={e => set('periodoInicio', e.target.value)} className={input} />
          </Campo>
          <Campo titulo="Às (opcional)">
            <input type="time" value={f.periodoFim} onChange={e => set('periodoFim', e.target.value)} className={input} />
          </Campo>
          <Campo titulo="Horas trabalhadas" dica="Usado quando não há período.">
            <input type="time" value={f.duracao} onChange={e => set('duracao', e.target.value)} className={input} />
          </Campo>
        </div>
      )}

      {t === 'T2' && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Campo titulo="Horário normal de saída">
            <input type="time" value={f.horaNormal} onChange={e => set('horaNormal', e.target.value)} className={input} />
          </Campo>
          <Campo titulo="Horário de dispensa">
            <input type="time" value={f.horaDispensa} onChange={e => set('horaDispensa', e.target.value)} className={input} />
          </Campo>
        </div>
      )}

      {usaFolga && (
        <Campo titulo={t === 'T4' ? 'Dia da folga (quitação)' : 'Data da folga'}>
          <input type="date" value={f.dataFolga} onChange={e => set('dataFolga', e.target.value)} className={input} />
        </Campo>
      )}

      {dica && (
        <p className="text-xs text-amber-700">
          {dica.nome} ({dica.tipo}) no calendário de Mogi.{' '}
          {usaMotivo && (
            <button
              type="button"
              className="font-semibold underline"
              onClick={() => set('motivo', dica.tipo === 'facultativo' ? 'ponto facultativo municipal' : dica.nome)}
            >
              Usar como motivo
            </button>
          )}
        </p>
      )}

      {usaMotivo && (
        <Campo titulo="Motivo" dica={t === 'T2' ? 'Se ficar em branco, o texto usa "decreto municipal".' : undefined}>
          <input value={f.motivo} onChange={e => set('motivo', e.target.value)} placeholder="ex: ponto facultativo municipal" className={input} />
        </Campo>
      )}

      {usaAjuste && (
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-widest text-slate-500">{rotuloAjuste}</label>
            {onSugerirDias && (
              <button type="button" onClick={onSugerirDias} className="text-xs font-semibold text-slate-600 underline hover:text-slate-900">
                Sugerir dias
              </button>
            )}
          </div>
          <ListaDatas datas={f.datasAjuste} onChange={d => set('datasAjuste', d)} />
        </div>
      )}

      <Campo
        titulo={t === 'T4' ? 'Prazo limite' : 'Prazo limite (se cruzar o mês)'}
        dica="Máximo de 6 meses. Obrigatório no banco de horas e quando os dias passam para o mês seguinte."
      >
        <input type="date" value={f.prazoLimite} onChange={e => set('prazoLimite', e.target.value)} className={input} />
      </Campo>
    </div>
  )
}
```

- [ ] **Step 2: Reescrever `components/acordos/modal-novo-acordo.tsx` por completo**

```tsx
'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Calendar, Clock, FileText, MapPin, Users, XCircle } from 'lucide-react'
import { buscarFuncionariosPorPostos, criarAcordo } from '@/app/(admin)/acordos/actions'
import type { AcordoPostoItem, FuncionarioParaAcordo } from '@/app/(admin)/acordos/actions'
import { calendarioParaMapa, type CalendarioLinha } from '@/lib/calendario/mapa'
import { DIAS_SEMANA, type Achado, type FuncionarioCalc, type TemplateId } from '@/lib/acordos/tipos'
import { agruparPorJornada, resumoCalculo } from '@/lib/acordos/movimentos'
import { gerarObjeto, TEMPLATES } from '@/lib/acordos/templates'
import { temErro, validarAcordo } from '@/lib/acordos/validar'
import { jornadaDiaMin, semanaParaTexto, totalSemanalMin } from '@/lib/acordos/horario-do-turno'
import { proximosDiasUteis, sugerirQuantidadeDias } from '@/lib/acordos/dias'
import { MAX_ACRESCIMO_DIA_MIN, MAX_JORNADA_DIA_MIN } from '@/lib/acordos/regras'
import { minParaHHMM } from '@/lib/acordos/tempo'
import { CamposTemplate, FORM_VAZIO, montarCampos, type FormState } from './campos-template'

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  ativo:    { label: 'Ativo',    cls: 'bg-green-100 text-green-700' },
  ferias:   { label: 'Férias',   cls: 'bg-orange-100 text-orange-700' },
  afastado: { label: 'Afastado', cls: 'bg-red-100 text-red-700' },
  atestado: { label: 'Atestado', cls: 'bg-amber-100 text-amber-700' },
  faltante: { label: 'Faltante', cls: 'bg-yellow-100 text-yellow-700' },
}

function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 border-b border-slate-100 pb-1">
      <div className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-900">
        <Icon className="h-3.5 w-3.5 text-white" />
      </div>
      <span className="text-xs font-bold uppercase tracking-widest text-slate-700">{title}</span>
    </div>
  )
}

interface Props {
  postos: AcordoPostoItem[]
  calendario: CalendarioLinha[]
  onClose: () => void
}

export function ModalNovoAcordo({ postos, calendario, onClose }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const [titulo, setTitulo] = useState('')
  const [tipo, setTipo] = useState<'individual' | 'coletivo'>('individual')
  const [postosSel, setPostosSel] = useState<string[]>([])
  const [dataDoc, setDataDoc] = useState(new Date().toLocaleDateString('sv-SE'))
  const [template, setTemplate] = useState<TemplateId>('T3')
  const [f, setF] = useState<FormState>(FORM_VAZIO)
  const [funcs, setFuncs] = useState<FuncionarioParaAcordo[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [loadingFuncs, setLoadingFuncs] = useState(false)
  const [erro, setErro] = useState('')

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setF(prev => ({ ...prev, [k]: v }))
  }

  // Carrega funcionários automaticamente ao escolher o(s) posto(s)
  useEffect(() => {
    let ativo = true
    if (postosSel.length === 0) {
      setFuncs([])
      setSelectedIds(new Set())
      return
    }
    setLoadingFuncs(true)
    buscarFuncionariosPorPostos(postosSel).then(res => {
      if (!ativo) return
      setFuncs(res)
      setSelectedIds(new Set(res.filter(x => x.elegivel && (x.status === 'ativo' || x.status === 'ferias')).map(x => x.id)))
      setLoadingFuncs(false)
    })
    return () => { ativo = false }
  }, [postosSel])

  function togglePosto(id: string) {
    setPostosSel(prev => (tipo === 'individual' ? [id] : prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]))
  }

  function toggleFunc(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selecionados = useMemo(() => funcs.filter(x => selectedIds.has(x.id)), [funcs, selectedIds])
  const calc: FuncionarioCalc[] = useMemo(
    () => selecionados.map(x => ({ id: x.id, nome: x.nome, status: x.status, regime: x.regime, semana: x.semana, semTurno: x.sem_turno })),
    [selecionados],
  )
  const feriados = useMemo(() => calendarioParaMapa(calendario), [calendario])
  const campos = useMemo(() => montarCampos(template, f), [template, f])
  const grupos = useMemo(() => agruparPorJornada(campos, calc), [campos, calc])

  const achados: Achado[] = useMemo(() => {
    if (grupos.length === 0) return validarAcordo(campos, [], feriados)
    const vistos = new Set<string>()
    const out: Achado[] = []
    for (const g of grupos) {
      for (const a of validarAcordo(campos, g, feriados)) {
        const chave = `${a.codigo}|${a.funcionarioId ?? ''}|${a.mensagem}`
        if (!vistos.has(chave)) { vistos.add(chave); out.push(a) }
      }
    }
    return out
  }, [campos, grupos, feriados])

  const texto = useMemo(
    () => (grupos.length ? gerarObjeto(campos, resumoCalculo(campos, grupos[0])) : null),
    [campos, grupos],
  )

  function sugerirDias() {
    if (!calc.length) { setErro('Selecione os funcionários antes de sugerir os dias.'); return }
    const r = resumoCalculo(campos, grupos[0] ?? calc)
    const jornadaMax = Math.max(...calc.flatMap(x => DIAS_SEMANA.map(d => jornadaDiaMin(x.semana[d]))))
    const maxPorDia = template === 'T1' ? 60 : Math.min(MAX_ACRESCIMO_DIA_MIN, MAX_JORNADA_DIA_MIN - jornadaMax)
    const n = sugerirQuantidadeDias(r.horasTotalMin, maxPorDia)
    const base = template === 'T3' ? f.dataFolga : f.dataEvento
    if (!n || !base || r.horasTotalMin <= 0) {
      setErro('Preencha a data e as horas antes de sugerir os dias (ou não existe divisão possível).')
      return
    }
    setErro('')
    set('datasAjuste', proximosDiasUteis(base, n, calc, feriados))
  }

  function handleSalvar() {
    if (!titulo.trim()) { setErro('Informe o título do acordo.'); return }
    if (!postosSel.length) { setErro('Selecione ao menos um posto.'); return }
    if (temErro(achados)) { setErro('Corrija os itens em vermelho antes de salvar.'); return }
    setErro('')
    startTransition(async () => {
      const postosObj = postos.filter(p => postosSel.includes(p.id))
      for (let i = 0; i < grupos.length; i++) {
        const res = await criarAcordo({
          titulo: grupos.length > 1 ? `${titulo.trim()} — grupo ${i + 1}` : titulo.trim(),
          tipo,
          postos: postosObj,
          funcionarioIds: grupos[i].map(x => x.id),
          data_documento: dataDoc,
          campos,
        })
        if ('error' in res) {
          setErro(grupos.length > 1 ? `Grupo ${i + 1}: ${res.error}` : res.error)
          router.refresh()
          return
        }
      }
      router.refresh()
      onClose()
    })
  }

  const inputCls = 'w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300'
  const labelCls = 'mb-2 block text-xs font-bold uppercase tracking-widest text-slate-500'

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overflow-x-hidden bg-black/50 px-4 py-8">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
        <div className="rounded-t-2xl bg-slate-900 px-6 py-5">
          <h2 className="text-base font-bold text-white">Novo Acordo de Compensação</h2>
          <p className="mt-0.5 text-xs text-slate-400">O texto é gerado a partir dos campos; o PDF sai após salvar</p>
        </div>

        <div className="space-y-6 px-6 py-6">
          <div>
            <label className={labelCls}>Título do Acordo</label>
            <input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="ex: Emenda 05/06 — Junho 2026" className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>Abrangência</label>
            <div className="flex gap-3">
              {([['individual', 'Individual', 'Uma unidade'], ['coletivo', 'Coletivo', 'Múltiplas unidades']] as const).map(([val, nome, sub]) => (
                <label key={val} className={`flex flex-1 cursor-pointer items-center gap-3 rounded-xl border-2 px-4 py-3 ${tipo === val ? 'border-slate-900 bg-slate-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <input type="radio" checked={tipo === val} onChange={() => { setTipo(val); setPostosSel([]) }} className="accent-slate-900" />
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{nome}</p>
                    <p className="text-xs text-gray-400">{sub}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className={labelCls}>Situação</label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {(Object.keys(TEMPLATES) as TemplateId[]).map(id => (
                <label key={id} className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 px-3 py-2.5 ${template === id ? 'border-slate-900 bg-slate-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <input type="radio" checked={template === id} onChange={() => setTemplate(id)} className="mt-1 accent-slate-900" />
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{TEMPLATES[id].titulo}</p>
                    <p className="text-xs text-gray-400">{TEMPLATES[id].resumo}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div>
            <SectionHeader icon={MapPin} title="Posto(s)" />
            <div className="mt-3 max-h-40 divide-y divide-gray-50 overflow-y-auto rounded-xl border border-gray-200">
              {postos.filter(p => !p.nome.startsWith('AFASTADO')).map(p => (
                <label key={p.id} className="flex cursor-pointer items-center gap-3 px-4 py-2.5 hover:bg-slate-50">
                  <input
                    type={tipo === 'individual' ? 'radio' : 'checkbox'}
                    checked={postosSel.includes(p.id)}
                    onChange={() => togglePosto(p.id)}
                    className="shrink-0 accent-slate-900"
                  />
                  <span className="text-sm text-gray-800">{p.nome}</span>
                  {p.secretaria && <span className="ml-auto shrink-0 text-xs text-gray-400">{p.secretaria}</span>}
                </label>
              ))}
            </div>
          </div>

          <div>
            <SectionHeader icon={Users} title="Funcionários" />
            <div className="mt-3">
              {postosSel.length === 0 && <p className="text-sm text-gray-400">Selecione um posto acima.</p>}
              {loadingFuncs && <p className="text-sm text-gray-400">Carregando…</p>}
              {funcs.length > 0 && (
                <div className="overflow-hidden rounded-xl border border-gray-200">
                  <div className="bg-gray-50 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-gray-400">
                    {selectedIds.size} de {funcs.length} selecionados
                  </div>
                  <div className="max-h-56 divide-y divide-gray-50 overflow-y-auto">
                    {funcs.map(x => {
                      const badge = STATUS_BADGE[x.status]
                      return (
                        <label key={x.id} className={`flex items-center gap-3 px-4 py-2.5 ${x.elegivel ? 'cursor-pointer hover:bg-slate-50' : 'bg-gray-50 opacity-60'}`}>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(x.id)}
                            disabled={!x.elegivel}
                            onChange={() => toggleFunc(x.id)}
                            className="shrink-0 accent-slate-900"
                          />
                          <span className="flex-1 text-sm text-gray-800">
                            {x.nome}
                            {!x.elegivel && <span className="block text-xs text-red-600">{x.motivo_inelegivel}</span>}
                            {x.elegivel && x.sem_turno && <span className="block text-xs text-amber-700">Sem horário cadastrado — usando o padrão 5x2 de 44h</span>}
                          </span>
                          {x.funcao && <span className="shrink-0 text-xs text-gray-400">{x.funcao}</span>}
                          {badge && <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-xs font-medium ${badge.cls}`}>{badge.label}</span>}
                        </label>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div>
            <SectionHeader icon={FileText} title="Dados do acordo" />
            <div className="mt-3">
              <CamposTemplate
                template={template}
                f={f}
                set={set}
                feriados={feriados}
                onSugerirDias={template === 'T4' || template === 'T5' ? null : sugerirDias}
              />
            </div>
          </div>

          {grupos.length > 0 && (
            <div>
              <SectionHeader icon={Clock} title="Horário (do turno cadastrado)" />
              <div className="mt-3 space-y-3">
                {grupos.map((g, gi) => {
                  const s = g[0].semana
                  const txt = semanaParaTexto(s)
                  return (
                    <div key={gi} className="overflow-hidden rounded-xl border border-gray-200">
                      <div className="flex items-center justify-between bg-slate-50 px-4 py-2 text-xs font-bold uppercase tracking-widest text-slate-600">
                        <span>{grupos.length > 1 ? `Grupo ${gi + 1} · ` : ''}{g.length} funcionário(s)</span>
                        <span className="font-normal text-gray-400">{minParaHHMM(totalSemanalMin(s))}h/semana · ref. {g[0].nome}</span>
                      </div>
                      {DIAS_SEMANA.map(d => (
                        <div key={d} className="flex gap-3 border-t border-gray-100 px-4 py-1.5 text-xs">
                          <span className="w-28 shrink-0 font-semibold text-slate-600">{d}</span>
                          <span className={txt[d] === 'FOLGA' ? 'font-bold uppercase text-gray-400' : 'font-mono text-gray-700'}>{txt[d]}</span>
                        </div>
                      ))}
                    </div>
                  )
                })}
                {grupos.length > 1 && (
                  <p className="text-xs text-amber-700">
                    Os funcionários têm jornadas diferentes nesse dia: serão gerados {grupos.length} acordos, um por grupo.
                  </p>
                )}
              </div>
            </div>
          )}

          {achados.length > 0 && (
            <div className="space-y-1.5">
              {achados.map((a, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-sm ${a.nivel === 'erro' ? 'border-red-100 bg-red-50 text-red-700' : 'border-amber-100 bg-amber-50 text-amber-800'}`}
                >
                  {a.nivel === 'erro' ? <XCircle className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
                  <span>{a.mensagem}</span>
                </div>
              ))}
            </div>
          )}

          <div>
            <SectionHeader icon={FileText} title="Texto do acordo (gerado)" />
            <div className="mt-3 rounded-xl bg-slate-900 px-4 py-3">
              <p className="font-mono text-[11px] leading-relaxed text-slate-300">
                <span className="text-slate-500">…com a finalidade de que os funcionários </span>
                {texto?.ok
                  ? <span className="text-amber-300">{texto.texto}</span>
                  : <span className="italic text-slate-500">preencha os dados acima para gerar o texto</span>}
              </p>
            </div>
          </div>

          <div>
            <SectionHeader icon={Calendar} title="Data do Documento" />
            <input type="date" value={dataDoc} onChange={e => setDataDoc(e.target.value)} className={`mt-3 ${inputCls}`} />
          </div>

          {erro && <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">{erro}</div>}
        </div>

        <div className="flex justify-end gap-2 rounded-b-2xl border-t border-gray-100 bg-gray-50 px-6 py-4">
          <button onClick={onClose} className="flex h-9 items-center rounded-lg border border-gray-200 bg-white px-4 text-sm font-medium text-gray-600 hover:bg-gray-100">
            Cancelar
          </button>
          <button
            onClick={handleSalvar}
            disabled={pending}
            className="flex h-9 items-center rounded-lg bg-slate-900 px-6 text-sm font-bold text-white hover:bg-slate-700 disabled:opacity-40"
          >
            {pending ? 'Salvando…' : grupos.length > 1 ? `Salvar ${grupos.length} acordos` : 'Salvar Acordo'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit 2>&1 | grep -E "acordos/(campos-template|modal-novo-acordo)"`
Expected: nenhuma linha. (`acordos-client.tsx` ainda passa props antigas ao modal até a Task 12; o erro dele é esperado.)

- [ ] **Step 4: Commit**

```bash
git add components/acordos/campos-template.tsx components/acordos/modal-novo-acordo.tsx
git commit -m "feat(acordos): modal guiado por template com horario do turno e validacao ao vivo"
```

---

### Task 12: Página, calendário no cliente e banner

**Files:**
- Modify: `app/(admin)/acordos/page.tsx`
- Modify: `components/acordos/acordos-client.tsx`

- [ ] **Step 1: `page.tsx` — carregar o calendário**

No topo, junto aos imports:

```ts
import { carregarCalendario } from '@/lib/calendario/mogi'
```

Trocar o `Promise.all` por:

```ts
  const [acordos, postos, calendario] = await Promise.all([
    listarAcordos({ mes, ano }),
    buscarPostosParaAcordo(),
    carregarCalendario([agora.getFullYear(), agora.getFullYear() + 1]),
  ])
```

E passar a prop: `<AcordosClient acordos={acordos} postos={postos} calendario={calendario} mes={mes} ano={ano} anos={anos} />`.

- [ ] **Step 2: `page.tsx` — corrigir o texto do banner (a direção estava invertida)**

Trocar o parágrafo do passo ② por:

```tsx
            <p className="text-xs text-gray-600">
              Quem trabalhou a mais descansa (redução de jornada ou folga); quem deixou de trabalhar compensa com
              acréscimo nos dias úteis seguintes. Ex: 2h trabalhadas = −1h/dia em 2 dias.
            </p>
```

E o exemplo de preenchimento (`<p className="font-mono ...">`) por:

```tsx
          <p className="font-mono text-xs text-amber-700">
            &ldquo;…trabalharem no dia <strong>27/06/2026 (Festa Junina)</strong>, com redução de <strong>01:00h</strong> diária no horário normal nos dias <strong>30/06 e 01/07</strong>, compensando assim <strong>02 hora(s)</strong> laborada(s) no referido evento.&rdquo;
          </p>
```

- [ ] **Step 3: `acordos-client.tsx` — repassar o calendário ao modal**

Adicionar import (junto aos outros): `import type { CalendarioLinha } from '@/lib/calendario/mapa'`.

Na `interface Props` (linha ~129), depois de `postos: AcordoPostoItem[]`, adicionar `calendario: CalendarioLinha[]`.

Na assinatura (linha ~137): `export function AcordosClient({ acordos, postos, calendario, mes, ano, anos }: Props) {`

No JSX do modal (linha ~388):

```tsx
        <ModalNovoAcordo
          postos={postos}
          calendario={calendario}
          onClose={() => setShowModal(false)}
        />
```

- [ ] **Step 4: Type-check completo**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 5: Commit**

```bash
git add "app/(admin)/acordos/page.tsx" components/acordos/acordos-client.tsx
git commit -m "feat(acordos): passa calendario de Mogi ao modal e corrige direcao no banner"
```

---

### Task 13: Verificação final e entrega para teste

**Files:** nenhum novo.

- [ ] **Step 1: Suíte de testes**

Run: `npm test`
Expected: todos os arquivos `lib/**/*.test.ts` passam (tempo, horario-do-turno, feriados-mogi, movimentos, templates, validar, dias).

- [ ] **Step 2: Build (exigido pelo CLAUDE.md)**

Run: `npm run build`
Expected: build conclui sem erros. Corrigir qualquer erro de tipo/lint antes de seguir.

- [ ] **Step 3: Pedir ao usuário para aplicar a migration**

Não aplicar por conta própria. Mostrar o caminho `supabase/migrations/20260922_acordos_movimentos_calendario.sql` e pedir que o usuário rode no Supabase Studio (o banco é o mesmo de produção; a migration é aditiva e não altera dados existentes). Antes disso, o usuário confere os pontos facultativos de 2026 em `lib/calendario/feriados-mogi.ts` contra o Decreto 24.034/2025.

- [ ] **Step 4: Teste manual no dev server (só após a migration)**

Subir o dev server pelas ferramentas de preview, abrir `/acordos` → **Novo Acordo** e conferir:

1. Escolher um posto carrega os funcionários sozinho; 12x36 e Jovem Aprendiz aparecem desabilitados com o motivo.
2. O horário exibido é o do turno cadastrado (não mais 07:00–17:00 fixo); funcionário sem turno mostra o aviso do padrão.
3. **T3 (dia inteiro de folga):** data da folga numa sexta, "Sugerir dias" preenche os dias úteis; erros/avisos aparecem em tempo real; o texto gerado aparece sem colchetes.
4. Com dias insuficientes (ex.: 2 dias) o botão Salvar é bloqueado com erros de limite (2h/dia e 10h/dia).
5. Compensação cruzando o mês exige prazo limite e mostra o aviso de banco de horas.
6. Salvar cria o acordo; na lista, a coluna **Criado por** mostra o nome; baixar o PDF confere horário por turno e o parágrafo do objeto.
7. Conferir no Supabase (SQL de leitura) que `acordo_movimentos` recebeu os movimentos com soma zero por funcionário:

```sql
SELECT funcionario_id, sum(minutos) AS saldo, count(*) AS movimentos
FROM acordo_movimentos GROUP BY funcionario_id HAVING sum(minutos) <> 0;
```

Expected: nenhuma linha.

- [ ] **Step 5: Handoff**

Reportar ao usuário o resultado dos passos 1–4, o que ficou pendente (migration, decreto, revisão do RH sobre a redação do T2 e sobre acordos antigos com o T1 invertido) e perguntar se autoriza `git push` da branch `feat/acordos-ia` para gerar o Preview no Vercel. **Não fazer push sem essa resposta.**

---

## Self-review (spec × plano)

| Requisito da spec | Onde está |
|---|---|
| Horário puxado do turno real | Tasks 3, 10, 11 |
| 12x36 e aprendiz fora do acordo | Tasks 2 (`regras`), 7, 10, 11 |
| Templates T1–T5 com direção correta | Tasks 5, 6 |
| Validador (2h/10h/soma zero/mês cruzado/prazo 6 meses) | Task 7 |
| Livro de movimentos (`acordo_movimentos`) | Tasks 5, 8, 10 |
| Bloqueio de placeholder | Task 6 (`contemPlaceholder`) |
| Calendário de Mogi | Tasks 4, 8, 12 |
| `criado_por` gravado | Task 10 |
| Banner com direção corrigida | Task 12 |
| Dias de compensação sugeridos | Task 9 |
| Emenda em 1 clique, IA/voz, aba Controle, tela do calendário | fora do plano (planos 1a, 1b, 2) |

Consistência de nomes conferida: `CamposAcordo`, `FuncionarioCalc`, `ResumoCalculo`, `agruparPorJornada`, `resumoCalculo`, `construirMovimentos`, `gerarObjeto`, `validarAcordo`, `carregarCalendario`, `calendarioParaMapa`, `FuncionarioParaAcordo` usados com a mesma assinatura em todas as tasks.
