# Tipo de escala no cadastro de Turnos do Posto — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O modal "Turnos de trabalho" (Postos → Gerenciar → Turnos) passa a herdar o tipo de escala (5x2/5x1/12x36) já configurado para o posto em Config Escalas, calcular os horários corretos para cada regime, e exibir tudo com badges coloridos consistentes com o resto do sistema.

**Architecture:** Nova coluna `tipo_escala` em `turnos_postos` (snapshot do regime no momento da criação). Um módulo de domínio novo (`lib/turnos/escala.ts`) centraliza os tipos, o cálculo de horários derivados por regime e a paleta de cores/labels — reutilizado pelo modal de Turnos do Posto, pelo modal "Alterar Turno" do funcionário e pelo card "Horário Vigente" do perfil do funcionário. `criarTurno`/`editarTurno` passam a calcular os horários no servidor (fonte única da verdade), em vez de confiar em campos derivados enviados pelo cliente.

**Tech Stack:** Next.js 14 App Router, Supabase (Postgres + RLS), TypeScript, Tailwind. Sem framework de testes no projeto — verificação via `npx tsc --noEmit`, `npm run build`, e teste manual no navegador (dev server) para as telas.

## Global Constraints

- `createClient()` do Supabase é **síncrono** — nunca `await createClient()`.
- CPF sempre mascarado; não se aplica aqui (sem CPF envolvido).
- Rodar `npm run build` e corrigir todos os erros antes de finalizar (regra do CLAUDE.md do projeto).
- Este projeto não tem suite de testes automatizados — cada task substitui "rodar teste" por "rodar `npx tsc --noEmit`" e, para tasks de UI, verificação manual via dev server.
- Cores por regime (já estabelecidas em `components/efetivo/tab-horario.tsx`, reaproveitar exatamente): `5x2` → azul (`bg-blue-50 text-blue-700 ring-blue-200`), `5x1` → roxo (`bg-purple-50 text-purple-700 ring-purple-200`), `12x36` → laranja (`bg-orange-50 text-orange-700 ring-orange-200`).
- Spec de referência: `docs/superpowers/specs/2026-07-10-turnos-postos-tipo-escala-design.md`.

---

### Task 1: Migração de banco — `tipo_escala` e colunas nullable em `turnos_postos`

**Files:**
- Create: `supabase/migrations/20260710_turnos_postos_tipo_escala.sql`

**Interfaces:**
- Produces: coluna `turnos_postos.tipo_escala TEXT NOT NULL DEFAULT '5x2'`; `turnos_postos.hora_saida_sex`, `hora_inicio_almoco`, `hora_fim_almoco` passam a aceitar `NULL`.

- [ ] **Step 1: Escrever a migração**

```sql
-- supabase/migrations/20260710_turnos_postos_tipo_escala.sql
ALTER TABLE turnos_postos ADD COLUMN IF NOT EXISTS tipo_escala TEXT;

ALTER TABLE turnos_postos ALTER COLUMN hora_saida_sex DROP NOT NULL;
ALTER TABLE turnos_postos ALTER COLUMN hora_inicio_almoco DROP NOT NULL;
ALTER TABLE turnos_postos ALTER COLUMN hora_fim_almoco DROP NOT NULL;

UPDATE turnos_postos SET tipo_escala = '5x2' WHERE tipo_escala IS NULL;

ALTER TABLE turnos_postos ALTER COLUMN tipo_escala SET NOT NULL;
ALTER TABLE turnos_postos ALTER COLUMN tipo_escala SET DEFAULT '5x2';
```

- [ ] **Step 2: Aplicar a migração no projeto Supabase**

Use a ferramenta MCP `mcp__supabase__apply_migration` com `name: "turnos_postos_tipo_escala"` e o SQL acima (schema alvo: `public`), OU rode via Supabase CLI se o ambiente local estiver configurado. Confirme que não houve erro.

- [ ] **Step 3: Verificar o schema aplicado**

Rode `mcp__supabase__list_tables` (verbose) e confirme que `public.turnos_postos` agora tem `tipo_escala` (`text`, `NOT NULL`, default `'5x2'::text`) e que `hora_saida_sex`, `hora_inicio_almoco`, `hora_fim_almoco` aceitam `NULL` (nullable = true).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260710_turnos_postos_tipo_escala.sql
git commit -m "feat(turnos): adiciona tipo_escala e permite horarios nulos em turnos_postos"
```

---

### Task 2: Atualizar tipos gerados (`types/database.ts`)

**Files:**
- Modify: `types/database.ts:1968-2014`

**Interfaces:**
- Consumes: schema aplicado na Task 1.
- Produces: `Tables<'turnos_postos'>` (reexportado como `TurnoPosto` em `types/index.ts:39`) com `tipo_escala: string`, `hora_saida_sex: string | null`, `hora_inicio_almoco: string | null`, `hora_fim_almoco: string | null`.

- [ ] **Step 1: Editar a definição da tabela**

Substituir o bloco `turnos_postos` (linhas 1968-2014) por:

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
          posto_id: string
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
          posto_id: string
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
          posto_id?: string
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

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: novos erros vão aparecer em `components/postos/modal-turnos-posto.tsx`, `app/(admin)/postos/turnos/actions.ts`, `components/efetivo/tab-horario.tsx` e `app/(admin)/efetivo/[id]/page.tsx` (esperado — serão corrigidos nas próximas tasks). Confirme que o erro é sobre esses arquivos e não sobre `types/database.ts` em si.

- [ ] **Step 3: Commit**

```bash
git add types/database.ts
git commit -m "chore(types): atualiza TurnoPosto com tipo_escala e campos nullable"
```

---

### Task 3: Módulo de domínio `lib/turnos/escala.ts`

**Files:**
- Create: `lib/turnos/escala.ts`

**Interfaces:**
- Produces: `TIPOS_ESCALA`, `TipoEscala`, `isTipoEscala()`, `resolverTipoEscala()`, `ESCALA_LABEL`, `ESCALA_BADGE_CLASS`, `ESCALA_BORDER_CLASS`, `HorariosDerivados`, `TurnoHorarios`, `calcularHorariosDerivados(horaEntrada: string, tipoEscala: TipoEscala): HorariosDerivados`, `fmtHora(h: string | null | undefined): string`, `formatarResumoTurno(t: TurnoHorarios): string`, `duracaoAlmocoMin(inicio: string | null, fim: string | null): number | null`.
- Consumido por: Tasks 4, 5, 8.

- [ ] **Step 1: Criar o arquivo**

```ts
// lib/turnos/escala.ts

export const TIPOS_ESCALA = ['5x2', '5x1', '12x36'] as const
export type TipoEscala = (typeof TIPOS_ESCALA)[number]

export function isTipoEscala(value: string | null | undefined): value is TipoEscala {
  return !!value && (TIPOS_ESCALA as readonly string[]).includes(value)
}

/** Normaliza um valor de regime vindo do banco (sem CHECK constraint) para um TipoEscala válido, caindo em '5x2' se ausente ou inválido. */
export function resolverTipoEscala(value: string | null | undefined): TipoEscala {
  return isTipoEscala(value) ? value : '5x2'
}

export const ESCALA_LABEL: Record<TipoEscala, string> = {
  '5x2': '5×2 · 44h/sem',
  '5x1': '5×1 · 44h/sem',
  '12x36': '12×36',
}

export const ESCALA_BADGE_CLASS: Record<TipoEscala, string> = {
  '5x2': 'bg-blue-50 text-blue-700 ring-blue-200',
  '5x1': 'bg-purple-50 text-purple-700 ring-purple-200',
  '12x36': 'bg-orange-50 text-orange-700 ring-orange-200',
}

export const ESCALA_BORDER_CLASS: Record<TipoEscala, string> = {
  '5x2': 'border-blue-500',
  '5x1': 'border-purple-500',
  '12x36': 'border-orange-500',
}

export interface HorariosDerivados {
  hora_inicio_almoco: string | null
  hora_fim_almoco: string | null
  hora_saida_seg_qui: string
  hora_saida_sex: string | null
}

export interface TurnoHorarios {
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

/** Calcula almoço/saída a partir da hora de entrada, seguindo a regra do regime informado. */
export function calcularHorariosDerivados(horaEntrada: string, tipoEscala: TipoEscala): HorariosDerivados {
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

/** Resumo textual de um turno, adaptado ao regime (detectado pela presença dos campos). */
export function formatarResumoTurno(t: TurnoHorarios): string {
  const entrada = fmtHora(t.hora_entrada)
  const saida = fmtHora(t.hora_saida_seg_qui)

  if (t.hora_saida_sex !== null) {
    return `Seg–Qui ${entrada}–${saida} (almoço ${fmtHora(t.hora_inicio_almoco)}–${fmtHora(t.hora_fim_almoco)}) · Sex até ${fmtHora(t.hora_saida_sex)}`
  }
  if (t.hora_inicio_almoco !== null && t.hora_fim_almoco !== null) {
    return `Todos os dias ${entrada}–${saida} (almoço ${fmtHora(t.hora_inicio_almoco)}–${fmtHora(t.hora_fim_almoco)})`
  }
  return `${entrada}–${saida} (12h + intervalo)`
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: nenhum erro novo vindo de `lib/turnos/escala.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/turnos/escala.ts
git commit -m "feat(turnos): modulo de dominio para calculo e exibicao de escalas (5x2/5x1/12x36)"
```

---

### Task 4: Reescrever `app/(admin)/postos/turnos/actions.ts`

**Files:**
- Modify: `app/(admin)/postos/turnos/actions.ts` (arquivo inteiro, 65 linhas)

**Interfaces:**
- Consumes: `TipoEscala`, `calcularHorariosDerivados`, `resolverTipoEscala` de `@/lib/turnos/escala` (Task 3).
- Produces: `TurnoData` (agora só `{ nome, hora_entrada }`), `listarTurnosPosto(postoId): Promise<TurnoPosto[]>` (inalterado na assinatura), `obterRegimePosto(postoId: string): Promise<TipoEscala | null>`, `criarTurno(postoId, dados: TurnoData): Promise<{success: boolean; error?: string}>`, `editarTurno(id, dados: TurnoData): Promise<{success: boolean; error?: string}>`, `desativarTurno` (inalterado).
- Consumido por: `components/postos/modal-turnos-posto.tsx` (Task 5).

- [ ] **Step 1: Substituir o conteúdo do arquivo**

```ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/auth/get-user'
import { revalidatePath } from 'next/cache'
import { calcularHorariosDerivados, isTipoEscala, type TipoEscala } from '@/lib/turnos/escala'

export interface TurnoData {
  nome: string
  hora_entrada: string
}

export async function listarTurnosPosto(postoId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('turnos_postos')
    .select('*')
    .eq('posto_id', postoId)
    .order('hora_entrada')
  if (error) throw new Error(error.message)
  return data ?? []
}

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

export async function criarTurno(postoId: string, dados: TurnoData) {
  const auth = await getUser()
  if (!auth || !['admin', 'coordenador'].includes(auth.perfil.role ?? '')) {
    return { success: false, error: 'Acesso negado' }
  }
  const regime = await obterRegimePosto(postoId)
  if (!regime) {
    return { success: false, error: 'Configure o regime de trabalho deste posto antes de cadastrar turnos.' }
  }
  const derivados = calcularHorariosDerivados(dados.hora_entrada, regime)
  const supabase = createClient()
  const { error } = await supabase.from('turnos_postos').insert({
    posto_id: postoId,
    nome: dados.nome,
    hora_entrada: dados.hora_entrada,
    tipo_escala: regime,
    ...derivados,
  })
  if (error) return { success: false, error: error.message }
  revalidatePath('/postos')
  return { success: true }
}

export async function editarTurno(id: string, dados: TurnoData) {
  const auth = await getUser()
  if (!auth || !['admin', 'coordenador'].includes(auth.perfil.role ?? '')) {
    return { success: false, error: 'Acesso negado' }
  }
  const supabase = createClient()
  const { data: turnoAtual, error: errBusca } = await supabase
    .from('turnos_postos')
    .select('tipo_escala')
    .eq('id', id)
    .single()
  if (errBusca || !turnoAtual) return { success: false, error: 'Turno não encontrado' }

  const tipoEscalaAtual = turnoAtual.tipo_escala
  const regime = isTipoEscala(tipoEscalaAtual) ? tipoEscalaAtual : '5x2'
  const derivados = calcularHorariosDerivados(dados.hora_entrada, regime)
  const { error } = await supabase
    .from('turnos_postos')
    .update({ nome: dados.nome, hora_entrada: dados.hora_entrada, ...derivados })
    .eq('id', id)
  if (error) return { success: false, error: error.message }
  revalidatePath('/postos')
  return { success: true }
}

export async function desativarTurno(id: string) {
  const auth = await getUser()
  if (!auth || !['admin', 'coordenador'].includes(auth.perfil.role ?? '')) {
    return { success: false, error: 'Acesso negado' }
  }
  const supabase = createClient()
  const { error } = await supabase.from('turnos_postos').update({ ativo: false }).eq('id', id)
  if (error) return { success: false, error: error.message }
  revalidatePath('/postos')
  return { success: true }
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: erros restantes só em `components/postos/modal-turnos-posto.tsx` (ainda usa a assinatura antiga de `TurnoData` — corrigido na Task 5).

- [ ] **Step 3: Commit**

```bash
git add "app/(admin)/postos/turnos/actions.ts"
git commit -m "feat(turnos): criarTurno/editarTurno calculam horarios no servidor por tipo de escala"
```

---

### Task 5: Reescrever `components/postos/modal-turnos-posto.tsx`

**Files:**
- Modify: `components/postos/modal-turnos-posto.tsx` (arquivo inteiro, 252 linhas)

**Interfaces:**
- Consumes: `criarTurno`, `editarTurno`, `desativarTurno`, `listarTurnosPosto`, `obterRegimePosto`, `type TurnoData` de `@/app/(admin)/postos/turnos/actions` (Task 4); `saveEscala` de `@/app/(admin)/fechamento/config-escalas/actions` (já existe, inalterado); `TIPOS_ESCALA`, `TipoEscala`, `calcularHorariosDerivados`, `resolverTipoEscala`, `ESCALA_LABEL`, `ESCALA_BADGE_CLASS`, `ESCALA_BORDER_CLASS`, `formatarResumoTurno` de `@/lib/turnos/escala` (Task 3); `TurnoPosto` de `@/types`.

- [ ] **Step 1: Substituir o conteúdo do arquivo**

```tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { Clock, Plus, Pencil, X } from 'lucide-react'
import {
  listarTurnosPosto,
  criarTurno,
  editarTurno,
  desativarTurno,
  obterRegimePosto,
  type TurnoData,
} from '@/app/(admin)/postos/turnos/actions'
import { saveEscala } from '@/app/(admin)/fechamento/config-escalas/actions'
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
import { cn } from '@/lib/utils'
import type { TurnoPosto } from '@/types'

interface Props {
  postoId: string
  postoNome: string
  open: boolean
  onClose: () => void
  role?: string
}

export function ModalTurnosPosto({ postoId, postoNome, open, onClose, role }: Props) {
  const [turnos, setTurnos]         = useState<TurnoPosto[]>([])
  const [regime, setRegime]         = useState<TipoEscala | null | undefined>(undefined) // undefined = carregando
  const [loading, setLoading]       = useState(false)
  const [form, setForm]             = useState<'novo' | TurnoPosto | null>(null)
  const [saving, setSaving]         = useState(false)
  const [erro, setErro]             = useState<string | null>(null)

  const [salvandoRegime, setSalvandoRegime] = useState(false)
  const [erroRegime, setErroRegime]         = useState<string | null>(null)

  // form fields
  const [nome, setNome]                 = useState('')
  const [horaEntrada, setHoraEntrada]   = useState('07:00')

  const canWrite = role === 'admin' || role === 'coordenador'

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const [turnosData, regimeData] = await Promise.all([
        listarTurnosPosto(postoId),
        obterRegimePosto(postoId),
      ])
      setTurnos(turnosData)
      setRegime(regimeData)
    } finally {
      setLoading(false)
    }
  }, [postoId])

  useEffect(() => {
    if (open) carregar()
  }, [open, carregar])

  function abrirNovo() {
    if (!regime) return
    setForm('novo')
    setNome('')
    setHoraEntrada('07:00')
    setErro(null)
  }

  function abrirEditar(t: TurnoPosto) {
    setForm(t)
    setNome(t.nome)
    setHoraEntrada(t.hora_entrada.slice(0, 5))
    setErro(null)
  }

  function fecharForm() {
    setForm(null)
    setErro(null)
  }

  async function handleSalvar() {
    if (!nome.trim()) { setErro('Informe o nome do turno'); return }
    setSaving(true)
    setErro(null)
    const dados: TurnoData = { nome: nome.trim(), hora_entrada: horaEntrada }
    const res = form === 'novo'
      ? await criarTurno(postoId, dados)
      : await editarTurno((form as TurnoPosto).id, dados)
    setSaving(false)
    if (!res.success) { setErro(res.error ?? 'Erro ao salvar'); return }
    fecharForm()
    carregar()
  }

  async function handleDesativar(t: TurnoPosto) {
    if (!confirm(`Desativar turno "${t.nome}"?`)) return
    setSaving(true)
    await desativarTurno(t.id)
    setSaving(false)
    carregar()
  }

  async function handleDefinirRegime(tipo: TipoEscala) {
    setSalvandoRegime(true)
    setErroRegime(null)
    const res = await saveEscala(postoId, tipo)
    setSalvandoRegime(false)
    if (!res.ok) { setErroRegime(res.error ?? 'Erro ao salvar regime'); return }
    setRegime(tipo)
  }

  if (!open) return null

  const tipoEscalaForm: TipoEscala | null =
    form === 'novo' ? (regime ?? null) : form ? resolverTipoEscala(form.tipo_escala) : null

  const derivados = tipoEscalaForm ? calcularHorariosDerivados(horaEntrada, tipoEscalaForm) : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
        {/* header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h2 className="text-base font-bold text-gray-900">Turnos de trabalho</h2>
            <div className="mt-0.5 flex items-center gap-2">
              <p className="text-xs text-gray-400">{postoNome}</p>
              {regime && (
                <span className={cn(
                  'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ring-inset',
                  ESCALA_BADGE_CLASS[regime],
                )}>
                  {ESCALA_LABEL[regime]}
                </span>
              )}
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          {/* aviso: posto sem regime configurado */}
          {regime === null && (
            <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-sm text-amber-800">
                Este posto ainda não tem um regime de trabalho definido. Selecione um regime para poder cadastrar turnos.
              </p>
              <div className="flex flex-wrap gap-2">
                {TIPOS_ESCALA.map(tipo => (
                  <button
                    key={tipo}
                    type="button"
                    disabled={salvandoRegime}
                    onClick={() => handleDefinirRegime(tipo)}
                    className={cn(
                      'rounded-lg px-3 py-1.5 text-xs font-semibold ring-1 ring-inset transition-opacity hover:opacity-80 disabled:opacity-50',
                      ESCALA_BADGE_CLASS[tipo],
                    )}
                  >
                    {ESCALA_LABEL[tipo]}
                  </button>
                ))}
              </div>
              {erroRegime && <p className="text-xs text-red-600">{erroRegime}</p>}
            </div>
          )}

          {regime && (
            <p className="text-xs text-gray-400">
              Regime definido em{' '}
              <a href="/fechamento/config-escalas" className="underline hover:text-gray-600">
                Config Escalas
              </a>.
            </p>
          )}

          {/* lista de turnos */}
          {loading ? (
            <p className="text-sm text-gray-400">Carregando...</p>
          ) : turnos.length === 0 ? (
            <p className="text-sm text-gray-400">Nenhum turno cadastrado para este posto.</p>
          ) : (
            <div className="space-y-2">
              {turnos.map(t => {
                const tipoTurno = resolverTipoEscala(t.tipo_escala)
                return (
                  <div key={t.id} className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <Clock className="h-4 w-4 text-gray-400" />
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-gray-900">{t.nome}</p>
                          <span className={cn(
                            'inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-bold ring-1 ring-inset',
                            ESCALA_BADGE_CLASS[tipoTurno],
                          )}>
                            {ESCALA_LABEL[tipoTurno]}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500">{formatarResumoTurno(t)}</p>
                      </div>
                    </div>
                    {canWrite && (
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => abrirEditar(t)}
                          className="text-gray-400 hover:text-gray-700" title="Editar">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button type="button" onClick={() => handleDesativar(t)} disabled={saving}
                          className="text-gray-400 hover:text-red-600 disabled:opacity-40" title="Desativar">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* form de novo/editar turno */}
          {form !== null && canWrite && tipoEscalaForm && derivados && (
            <div className={cn('space-y-3 rounded-lg border border-l-4 bg-white p-4', ESCALA_BORDER_CLASS[tipoEscalaForm])}>
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-700">
                  {form === 'novo' ? 'Novo turno' : 'Editar turno'}
                </p>
                <span className={cn(
                  'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ring-inset',
                  ESCALA_BADGE_CLASS[tipoEscalaForm],
                )}>
                  {ESCALA_LABEL[tipoEscalaForm]}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-500">Nome</label>
                  <input value={nome} onChange={e => setNome(e.target.value)}
                    placeholder="Ex: Turno 7h"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-500">Horário de entrada</label>
                  <input
                    type="time"
                    value={horaEntrada}
                    onChange={e => setHoraEntrada(e.target.value)}
                    min={tipoEscalaForm === '5x1' ? '05:00' : undefined}
                    max={tipoEscalaForm === '5x1' ? '16:00' : undefined}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400" />
                </div>
              </div>

              {/* preview calculado */}
              <div className="space-y-0.5 rounded-lg bg-slate-50 px-3 py-2 text-xs text-gray-500">
                <p className="mb-1 font-medium text-gray-700">Horários calculados automaticamente:</p>
                {derivados.hora_inicio_almoco && derivados.hora_fim_almoco && (
                  <p>Almoço: {derivados.hora_inicio_almoco} às {derivados.hora_fim_almoco}</p>
                )}
                {derivados.hora_saida_sex !== null ? (
                  <>
                    <p>Saída Seg–Qui: {derivados.hora_saida_seg_qui}</p>
                    <p>Saída Sex: {derivados.hora_saida_sex}</p>
                  </>
                ) : (
                  <p>Saída: {derivados.hora_saida_seg_qui}</p>
                )}
              </div>

              {erro && <p className="text-xs text-red-600">{erro}</p>}

              <div className="flex justify-end gap-2">
                <button type="button" onClick={fecharForm}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50">
                  Cancelar
                </button>
                <button type="button" onClick={handleSalvar} disabled={saving}
                  className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50">
                  {saving ? 'Salvando…' : 'Salvar'}
                </button>
              </div>
            </div>
          )}

          {/* botão novo turno */}
          {canWrite && form === null && regime && (
            <button type="button" onClick={abrirNovo}
              className="flex items-center gap-1.5 text-sm font-medium text-slate-700 hover:text-slate-900">
              <Plus className="h-4 w-4" />
              Novo turno
            </button>
          )}
        </div>

        <div className="border-t border-gray-100 px-6 py-3 flex justify-end">
          <button type="button" onClick={onClose}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: sem erros em `components/postos/modal-turnos-posto.tsx`. Erros restantes só em `app/(admin)/efetivo/[id]/page.tsx` e `components/efetivo/tab-horario.tsx` (corrigidos nas próximas tasks).

- [ ] **Step 3: Commit**

```bash
git add components/postos/modal-turnos-posto.tsx
git commit -m "feat(postos): modal de turnos herda regime do posto e calcula horarios por escala"
```

---

### Task 6: Atualizar `app/(admin)/efetivo/[id]/page.tsx` para campos nullable

**Files:**
- Modify: `app/(admin)/efetivo/[id]/page.tsx:182-186`

**Interfaces:**
- Consumes: schema atualizado (Task 1/2).
- Produces: `RawTurno` compatível com o novo shape nullable, consumido por `HorarioVigenteShape`/`HistoricoHorarioShape` (Task 8).

- [ ] **Step 1: Editar o tipo `RawTurno`**

Em `app/(admin)/efetivo/[id]/page.tsx:182-186`, substituir:

```ts
  type RawTurno = {
    id: string; posto_id: string; nome: string; ativo: boolean
    hora_entrada: string; hora_saida_seg_qui: string; hora_saida_sex: string
    hora_inicio_almoco: string; hora_fim_almoco: string
  }
```

por:

```ts
  type RawTurno = {
    id: string; posto_id: string; nome: string; ativo: boolean
    hora_entrada: string; hora_saida_seg_qui: string; hora_saida_sex: string | null
    hora_inicio_almoco: string | null; hora_fim_almoco: string | null
  }
```

Não é necessário alterar as queries `select(...)` (linhas 104-127) — os nomes de coluna já batem; só o tipo TypeScript estava incorreto (não refletia que o banco já podia retornar `null` nesses campos).

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: erro aponta agora para `components/efetivo/tab-horario.tsx` (props `HorarioVigenteShape`/`HistoricoHorarioShape` ainda não aceitam `null` nesses campos — corrigido na Task 8).

- [ ] **Step 3: Commit**

```bash
git add "app/(admin)/efetivo/[id]/page.tsx"
git commit -m "fix(efetivo): RawTurno reflete horarios nullable de turnos_postos"
```

---

### Task 7: Incluir `tipo_escala` em `listarTurnosDoPosto`

**Files:**
- Modify: `app/(admin)/efetivo/horario/actions.ts:7-17`

**Interfaces:**
- Produces: `listarTurnosDoPosto(postoId)` agora retorna também `tipo_escala` por turno.
- Consumido por: `components/efetivo/tab-horario.tsx` (Task 8), para exibir o badge de regime no seletor "Alterar Turno".

- [ ] **Step 1: Editar o select**

Em `app/(admin)/efetivo/horario/actions.ts:7-17`, trocar:

```ts
export async function listarTurnosDoPosto(postoId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('turnos_postos')
    .select('id, nome, hora_entrada, hora_saida_seg_qui, hora_saida_sex, hora_inicio_almoco, hora_fim_almoco')
    .eq('posto_id', postoId)
    .eq('ativo', true)
    .order('hora_entrada')
  if (error) throw new Error(error.message)
  return data ?? []
}
```

por:

```ts
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
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: sem novos erros vindos deste arquivo.

- [ ] **Step 3: Commit**

```bash
git add "app/(admin)/efetivo/horario/actions.ts"
git commit -m "feat(efetivo): listarTurnosDoPosto retorna tipo_escala do turno"
```

---

### Task 8: `components/efetivo/tab-horario.tsx` — null-safety, labels adaptados e badges de regime

**Files:**
- Modify: `components/efetivo/tab-horario.tsx` (múltiplos trechos: linhas 1-49, 53, 41-49, 200-218, 345-415, 505-509)

**Interfaces:**
- Consumes: `resolverTipoEscala`, `ESCALA_LABEL`, `ESCALA_BADGE_CLASS`, `formatarResumoTurno` de `@/lib/turnos/escala` (Task 3).

- [ ] **Step 1: Import do módulo de escala e ajuste dos tipos de entrada**

Em `components/efetivo/tab-horario.tsx:1-6`, adicionar o import (após o import de `cn`):

```ts
import { resolverTipoEscala, ESCALA_LABEL, ESCALA_BADGE_CLASS, formatarResumoTurno, duracaoAlmocoMin } from '@/lib/turnos/escala'
```

Substituir o bloco de tipos (linhas 10-49):

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

- [ ] **Step 2: `fmtH` null-safe**

Em `components/efetivo/tab-horario.tsx:53`, trocar:

```ts
function fmtH(h: string) { return h.slice(0, 5) }
```

por:

```ts
function fmtH(h: string | null) { return h ? h.slice(0, 5) : '—' }
```

- [ ] **Step 3: Badge de regime + resumo no seletor "Alterar Turno"**

Em `components/efetivo/tab-horario.tsx:200-218`, trocar o bloco do `<button>` de cada turno:

```tsx
                {turnos.map(t => (
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
                    <p className={cn('text-sm font-semibold', turnoId === t.id ? 'text-blue-800' : 'text-gray-800')}>
                      {t.nome}
                    </p>
                    <p className={cn('text-xs mt-0.5', turnoId === t.id ? 'text-blue-600' : 'text-gray-500')}>
                      Entrada {fmtH(t.hora_entrada)} · Almoço {fmtH(t.hora_inicio_almoco)}–{fmtH(t.hora_fim_almoco)} · Saída Seg–Qui {fmtH(t.hora_saida_seg_qui)} · Sex {fmtH(t.hora_saida_sex)}
                    </p>
                  </button>
                ))}
```

por:

```tsx
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
```

- [ ] **Step 4: Grid do "Horário Vigente" null-safe e adaptado por regime**

Em `components/efetivo/tab-horario.tsx:367-387`, trocar:

```tsx
            {/* grade de horários */}
            <div className="grid grid-cols-2 gap-2 px-5 pb-3 sm:grid-cols-4">
              <div className="rounded-lg bg-green-50 px-3 py-2.5 ring-1 ring-green-200">
                <p className="text-xs font-semibold uppercase tracking-widest text-green-600">Entrada</p>
                <p className="mt-0.5 text-xl font-bold text-green-800">{fmtH(horarioVigente.turno.hora_entrada)}</p>
              </div>
              <div className="rounded-lg bg-amber-50 px-3 py-2.5 ring-1 ring-amber-200">
                <p className="text-xs font-semibold uppercase tracking-widest text-amber-600">Almoço</p>
                <p className="mt-0.5 text-sm font-bold text-amber-800">
                  {fmtH(horarioVigente.turno.hora_inicio_almoco)} – {fmtH(horarioVigente.turno.hora_fim_almoco)}
                </p>
                <p className="text-xs text-amber-500">72 min</p>
              </div>
              <div className="rounded-lg bg-blue-50 px-3 py-2.5 ring-1 ring-blue-200">
                <p className="text-xs font-semibold uppercase tracking-widest text-blue-600">Saída Seg–Qui</p>
                <p className="mt-0.5 text-xl font-bold text-blue-800">{fmtH(horarioVigente.turno.hora_saida_seg_qui)}</p>
              </div>
              <div className="rounded-lg bg-indigo-50 px-3 py-2.5 ring-1 ring-indigo-200">
                <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">Saída Sex</p>
                <p className="mt-0.5 text-xl font-bold text-indigo-800">{fmtH(horarioVigente.turno.hora_saida_sex)}</p>
              </div>
            </div>
```

por:

```tsx
            {/* grade de horários */}
            {(() => {
              const turnoAtual = horarioVigente.turno
              const temAlmoco = turnoAtual.hora_inicio_almoco !== null && turnoAtual.hora_fim_almoco !== null
              const temSaidaSex = turnoAtual.hora_saida_sex !== null
              const almocoMin = duracaoAlmocoMin(turnoAtual.hora_inicio_almoco, turnoAtual.hora_fim_almoco)
              const cols = temSaidaSex ? 'sm:grid-cols-4' : temAlmoco ? 'sm:grid-cols-3' : 'sm:grid-cols-2'
              return (
                <div className={cn('grid grid-cols-2 gap-2 px-5 pb-3', cols)}>
                  <div className="rounded-lg bg-green-50 px-3 py-2.5 ring-1 ring-green-200">
                    <p className="text-xs font-semibold uppercase tracking-widest text-green-600">Entrada</p>
                    <p className="mt-0.5 text-xl font-bold text-green-800">{fmtH(turnoAtual.hora_entrada)}</p>
                  </div>
                  {temAlmoco && (
                    <div className="rounded-lg bg-amber-50 px-3 py-2.5 ring-1 ring-amber-200">
                      <p className="text-xs font-semibold uppercase tracking-widest text-amber-600">Almoço</p>
                      <p className="mt-0.5 text-sm font-bold text-amber-800">
                        {fmtH(turnoAtual.hora_inicio_almoco)} – {fmtH(turnoAtual.hora_fim_almoco)}
                      </p>
                      {almocoMin !== null && <p className="text-xs text-amber-500">{almocoMin} min</p>}
                    </div>
                  )}
                  <div className="rounded-lg bg-blue-50 px-3 py-2.5 ring-1 ring-blue-200">
                    <p className="text-xs font-semibold uppercase tracking-widest text-blue-600">
                      {temSaidaSex ? 'Saída Seg–Qui' : 'Saída'}
                    </p>
                    <p className="mt-0.5 text-xl font-bold text-blue-800">{fmtH(turnoAtual.hora_saida_seg_qui)}</p>
                  </div>
                  {temSaidaSex && (
                    <div className="rounded-lg bg-indigo-50 px-3 py-2.5 ring-1 ring-indigo-200">
                      <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">Saída Sex</p>
                      <p className="mt-0.5 text-xl font-bold text-indigo-800">{fmtH(turnoAtual.hora_saida_sex)}</p>
                    </div>
                  )}
                </div>
              )
            })()}
```

- [ ] **Step 5: Histórico usa `formatarResumoTurno`**

Em `components/efetivo/tab-horario.tsx:507-509`, trocar:

```tsx
                      <p className="text-xs text-gray-400">
                        Entrada {fmtH(h.turno.hora_entrada)} · Saída Seg–Qui {fmtH(h.turno.hora_saida_seg_qui)} · Sex {fmtH(h.turno.hora_saida_sex)}
                      </p>
```

por:

```tsx
                      <p className="text-xs text-gray-400">
                        {formatarResumoTurno(h.turno)}
                      </p>
```

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: nenhum erro em nenhum arquivo do projeto.

- [ ] **Step 7: Commit**

```bash
git add components/efetivo/tab-horario.tsx
git commit -m "fix(efetivo): horario vigente e historico tratam campos nulos por tipo de escala"
```

---

### Task 9: Verificação final — build e teste manual no navegador

**Files:** nenhum (apenas verificação)

- [ ] **Step 1: Build de produção**

Run: `npm run build`
Expected: build conclui sem erros.

- [ ] **Step 2: Subir o dev server e abrir Postos → Gerenciar**

Use `mcp__Claude_Browser__preview_start` (ou equivalente configurado em `.claude/launch.json` para `npm run dev`), navegue até `/postos`, aba "Gerenciar".

- [ ] **Step 3: Testar posto sem regime configurado**

Escolha um posto que nunca teve regime definido (ex: um posto novo, ou confirme via `mcp__supabase__execute_sql` com `select posto_id from config_escalas_postos` quais postos já têm linha, e escolha um `id` de `postos` que não apareça nessa lista). Clique em "Turnos". Confirme visualmente (`preview_screenshot` ou `preview_snapshot`) que aparece o aviso âmbar com os 3 botões de regime, e que o botão "+ Novo turno" NÃO aparece. Clique em "5x1", confirme que o aviso some, o badge "5×1 · 44h/sem" (roxo) aparece no cabeçalho, e o botão "+ Novo turno" aparece.

- [ ] **Step 4: Testar cadastro de turno 5x1**

Clique em "+ Novo turno", preencha nome "Turno 6h" e horário de entrada "06:00". Confirme no preview: "Almoço: 10:00 às 11:00", "Saída: 14:20". Salve. Confirme (`preview_snapshot`) que o turno aparece na lista com o badge roxo "5×1 · 44h/sem" e o resumo "Todos os dias 06:00–14:20 (almoço 10:00–11:00)".

- [ ] **Step 5: Testar posto com regime 12x36**

Escolha (ou defina via o próprio fluxo) um posto com regime `12x36`. Abra "Turnos", cadastre um turno com entrada "07:00". Confirme no preview que aparece só "Saída: 20:00" (sem linha de Almoço). Salve e confirme o badge laranja "12×36" na lista, com resumo "07:00–20:00 (12h + intervalo)".

- [ ] **Step 6: Testar posto com regime 5x2 (regressão)**

Abra "Turnos" de um posto já existente com regime 5x2 (a maioria). Confirme que o comportamento é idêntico ao anterior: badge azul "5×2 · 44h/sem", preview com Almoço + Saída Seg-Qui + Saída Sex, turnos antigos continuam listados e editáveis normalmente.

- [ ] **Step 7: Testar perfil do funcionário**

Abra `/efetivo/[id]` de um funcionário lotado no posto 5x1 testado na Step 4 (ou atribua o turno a ele via "Atribuir Turno"). Confirme na aba "Horário": o card "Horário Vigente" mostra 3 tiles (Entrada / Almoço / Saída — sem "Saída Sex"), sem crash, sem "—" inesperado. Repita para um funcionário em posto 12x36: confirme 2 tiles (Entrada / Saída), sem tile de Almoço. Confirme no console do navegador (`preview_console_logs`, level "error") que não há erros de runtime.

- [ ] **Step 8: Screenshot final de evidência**

Use `preview_screenshot` no modal de Turnos (com um turno 5x1 e um 12x36 visíveis) e no card "Horário Vigente" de um funcionário 5x1, para registrar evidência visual do resultado.

- [ ] **Step 9: Commit final (se necessário)**

Se qualquer ajuste foi feito durante a verificação manual, commitar separadamente com mensagem descrevendo o ajuste. Caso contrário, este task não gera commit (é só verificação).
