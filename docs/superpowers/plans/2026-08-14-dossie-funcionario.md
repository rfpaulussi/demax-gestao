# Dossiê do Funcionário Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir a página `/ocorrencias` (registro por posto) por um dossiê do funcionário: busca de funcionário → modal com timeline unificada de advertências, atestados, faltas e ocorrências de conduta, com registro de novas ocorrências preso ao funcionário.

**Architecture:** Uma migração adiciona `funcionario_id` à tabela `ocorrencias` e ajusta RLS. As Server Actions em `app/(admin)/ocorrencias/actions.ts` passam a expor busca de funcionários e um agregador `getDossieFuncionario` que junta as 4 tabelas numa timeline única no server. A UI vira 4 componentes pequenos (busca, alertas, modal do dossiê, modal de nova ocorrência) orquestrados por `ocorrencias-client.tsx`.

**Tech Stack:** Next.js 14 App Router, Server Actions, Supabase (RLS), TypeScript, Tailwind, `@base-ui/react/dialog`.

**Referência:** spec em `docs/superpowers/specs/2026-08-14-dossie-funcionario-design.md`.

---

## Task 1: Migração SQL — `funcionario_id` em `ocorrencias` + RLS

**Files:**
- Create: `supabase/migrations/20260814_ocorrencias_funcionario.sql`

- [ ] **Step 1: Escrever a migração**

```sql
-- ============================================================
-- Dossiê do funcionário: vincula ocorrencias a funcionario_id
-- e ajusta RLS de supervisor pra considerar o posto atual do
-- funcionário (além do posto_id direto, mantido por compat).
-- Também corrige um gap: supervisor nunca conseguia ver os
-- próprios alertas via RLS (posto_id é null em alertas e não
-- havia policy cobrindo esse caso).
-- ============================================================

ALTER TABLE ocorrencias ADD COLUMN IF NOT EXISTS funcionario_id UUID REFERENCES funcionarios(id);
CREATE INDEX IF NOT EXISTS idx_ocorrencias_funcionario_id ON ocorrencias(funcionario_id);

DROP POLICY IF EXISTS ocorrencias_supervisor_select ON ocorrencias;
CREATE POLICY ocorrencias_supervisor_select ON ocorrencias
  FOR SELECT TO authenticated
  USING (
    is_supervisor()
    AND (
      posto_id IN (SELECT get_supervisor_posto_ids())
      OR funcionario_id IN (
        SELECT id FROM funcionarios
        WHERE posto_id IN (SELECT get_supervisor_posto_ids())
      )
      OR (tipo = 'alerta' AND supervisor_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS ocorrencias_supervisor_insert ON ocorrencias;
CREATE POLICY ocorrencias_supervisor_insert ON ocorrencias
  FOR INSERT TO authenticated
  WITH CHECK (
    is_supervisor()
    AND (
      funcionario_id IN (
        SELECT id FROM funcionarios
        WHERE posto_id IN (SELECT get_supervisor_posto_ids())
      )
      OR tipo = 'alerta'
    )
  );
```

- [ ] **Step 2: Aplicar a migração no projeto Supabase**

Usar a ferramenta MCP do Supabase (`apply_migration`) com o `project_id` do projeto (`fwdhnipekbmeqozkpfyh`), passando o nome `20260814_ocorrencias_funcionario` e o SQL acima. Se a ferramenta MCP não estiver disponível na sessão de execução, aplicar manualmente via Supabase Studio → SQL Editor e avisar o usuário.

- [ ] **Step 3: Verificar**

Rodar (via MCP `execute_sql` ou Studio):

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'ocorrencias' AND column_name = 'funcionario_id';
```

Esperado: retorna 1 linha (`funcionario_id`).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260814_ocorrencias_funcionario.sql
git commit -m "feat(ocorrencias): adiciona funcionario_id + ajusta RLS de supervisor

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 2: Reescrever `app/(admin)/ocorrencias/actions.ts`

**Files:**
- Modify: `app/(admin)/ocorrencias/actions.ts` (reescrita completa)

- [ ] **Step 1: Substituir todo o conteúdo do arquivo**

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getUser } from '@/lib/auth/get-user'
import { FALTA_TIPO_LABELS, type FaltaTipo } from '@/components/faltas/faltas-config'

type ActionResult = { success: true } | { success: false; error: string }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = { from: (table: string) => any }

// ─── labels locais (mesmo padrão de duplicação já usado em advertencias/actions.ts) ──

const GRAU_LABEL: Record<string, string> = {
  verbal: 'Verbal', escrita: 'Escrita', suspensao: 'Suspensão',
}

const NATUREZA_LABEL: Record<string, string> = {
  comportamento:   'Comportamento Inadequado',
  falta:           'Falta Injustificada',
  atraso:          'Atraso Recorrente',
  negligencia:     'Negligência no Trabalho',
  descumprimento:  'Descumprimento de Normas',
  insubordinacao:  'Insubordinação',
  'desídia':       'Desídia',
  improbidade:     'Improbidade',
  ofensa_honra:    'Ofensa à Honra',
  ofensa_superior: 'Ofensa ao Empregador/Superior',
  uso_indevido:    'Uso Indevido de Equipamentos',
  embriaguez:      'Embriaguez em Serviço',
  abandono:        'Abandono de Posto',
  outro:           'Outro',
}

function diffDias(inicio: string, fim: string | null): number {
  if (!fim) return 1
  const d1 = new Date(inicio + 'T00:00:00')
  const d2 = new Date(fim + 'T00:00:00')
  return Math.ceil((d2.getTime() - d1.getTime()) / 86400000) + 1
}

async function getPostoIdsSupervisor(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<string[]> {
  const { data } = await supabase
    .from('config_supervisores_postos')
    .select('posto_id')
    .eq('supervisor_id', userId)
    .eq('ativo', true)
  return (data ?? []).map((r: { posto_id: string }) => r.posto_id)
}

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

  let query = supabase
    .from('funcionarios')
    .select('id, nome, cpf, registro, postos!posto_id(nome, secretaria)')
    .neq('status', 'desligado')
    .order('nome')

  if (auth?.perfil.role === 'supervisor') {
    const postoIds = await getPostoIdsSupervisor(supabase, auth.user.id)
    if (postoIds.length === 0) return []
    query = query.in('posto_id', postoIds)
  }

  const { data } = await query
  return ((data ?? []) as unknown as RawFuncBusca[]).map(f => ({
    id: f.id,
    nome: f.nome,
    cpf: f.cpf,
    registro: f.registro,
    posto_nome: f.postos?.nome ?? '—',
    secretaria: f.postos?.secretaria ?? '',
  }))
}

// ─── supervisores (usado no form de nova ocorrência) ──────────────────────────

export type SupervisorSimples = { id: string; nome: string }

export async function getSupervisoresSimples(): Promise<SupervisorSimples[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('perfis')
    .select('id, nome')
    .eq('role', 'supervisor')
    .eq('ativo', true)
    .order('nome')
  return (data ?? []).map(p => ({ id: p.id, nome: p.nome ?? '' }))
}

// ─── alertas (lembretes pessoais do supervisor, sem funcionário) ─────────────

export type AlertaRow = {
  id: string
  titulo: string | null
  descricao: string
  data_lembrete: string | null
  created_at: string
  supervisor_nome: string | null
}

export async function getAlertas(): Promise<AlertaRow[]> {
  const supabase = createClient()
  const auth = await getUser()
  if (!auth) return []

  let query = (supabase as unknown as AnyClient)
    .from('ocorrencias')
    .select('id, titulo, descricao, data_lembrete, created_at, supervisor_id')
    .eq('tipo', 'alerta')
    .eq('status', 'aberta')
    .order('created_at', { ascending: false })

  if (auth.perfil.role === 'supervisor') {
    query = query.eq('supervisor_id', auth.user.id)
  }

  const { data } = await query
  type RawAlerta = { id: string; titulo: string | null; descricao: string; data_lembrete: string | null; created_at: string; supervisor_id: string | null }
  const rows = (data ?? []) as RawAlerta[]

  const supervisorIds = Array.from(new Set(rows.map(a => a.supervisor_id).filter((s): s is string => Boolean(s))))
  const perfisMap = new Map<string, string>()
  if (supervisorIds.length > 0) {
    const { data: perfis } = await supabase.from('perfis').select('id, nome').in('id', supervisorIds)
    for (const p of perfis ?? []) if (p.nome) perfisMap.set(p.id, p.nome)
  }

  return rows.map(a => ({
    id: a.id,
    titulo: a.titulo,
    descricao: a.descricao,
    data_lembrete: a.data_lembrete,
    created_at: a.created_at,
    supervisor_nome: a.supervisor_id ? (perfisMap.get(a.supervisor_id) ?? null) : null,
  }))
}

export async function criarAlerta(
  titulo: string,
  descricao: string,
  data_lembrete: string | null,
): Promise<ActionResult> {
  const auth = await getUser()
  if (!auth) return { success: false, error: 'Não autenticado' }
  if (auth.perfil.role === 'viewer') return { success: false, error: 'Sem permissão' }

  const adminSupabase = createAdminClient()

  const { error } = await (adminSupabase as unknown as AnyClient).from('ocorrencias').insert({
    supervisor_id:   auth.user.id,
    titulo,
    descricao,
    data_ocorrencia: new Date().toISOString().split('T')[0],
    data_lembrete:   data_lembrete || null,
    gravidade:       'baixa',
    status:          'aberta',
    tipo:            'alerta',
    criado_por:      auth.user.id,
  })

  if (error) return { success: false, error: error.message }

  revalidatePath('/ocorrencias')
  return { success: true }
}

export async function resolverAlerta(id: string): Promise<ActionResult> {
  const auth = await getUser()
  if (!auth || auth.perfil.role === 'viewer') return { success: false, error: 'Sem permissão' }

  const adminSupabase = createAdminClient()

  if (auth.perfil.role === 'supervisor') {
    const { data: alerta } = await (adminSupabase as unknown as AnyClient)
      .from('ocorrencias')
      .select('supervisor_id')
      .eq('id', id)
      .single()
    if (alerta?.supervisor_id !== auth.user.id) return { success: false, error: 'Sem permissão' }
  }

  const { error } = await (adminSupabase as unknown as AnyClient)
    .from('ocorrencias')
    .update({ status: 'resolvido', atualizado_por: auth.user.id, atualizado_em: new Date().toISOString() })
    .eq('id', id)

  if (error) return { success: false, error: error.message }

  revalidatePath('/ocorrencias')
  return { success: true }
}

// ─── dossiê do funcionário ─────────────────────────────────────────────────────

export type TimelineTipo = 'advertencia' | 'atestado' | 'falta' | 'ocorrencia'

export type TimelineItem = {
  id: string
  tipo: TimelineTipo
  data: string
  titulo: string
  detalhe: string
  gravidade?: 'baixa' | 'media' | 'alta' | 'critica' | null
  status?: string | null
}

export type DossieFuncionario = {
  funcionario: {
    id: string
    nome: string
    cpf: string | null
    registro: string | null
    posto_nome: string
    secretaria: string
  }
  kpis: {
    advertencias: number
    diasAtestado12m: number
    faltas: number
    ocorrenciasAbertas: number
  }
  timeline: TimelineItem[]
}

type RawOcorrenciaDossie = {
  id: string
  titulo: string | null
  descricao: string | null
  data_ocorrencia: string | null
  gravidade: string | null
  status: string | null
}

export async function getDossieFuncionario(funcionarioId: string): Promise<DossieFuncionario | null> {
  const supabase = createClient()
  const auth = await getUser()
  if (!auth) return null

  if (auth.perfil.role === 'supervisor') {
    const postoIds = await getPostoIdsSupervisor(supabase, auth.user.id)
    const { data: func } = await supabase.from('funcionarios').select('posto_id').eq('id', funcionarioId).single()
    if (!func?.posto_id || !postoIds.includes(func.posto_id)) return null
  }

  const { data: funcRaw } = await supabase
    .from('funcionarios')
    .select('id, nome, cpf, registro, postos!posto_id(nome, secretaria)')
    .eq('id', funcionarioId)
    .single()
  if (!funcRaw) return null
  const func = funcRaw as unknown as {
    id: string; nome: string; cpf: string | null; registro: string | null
    postos: { nome: string; secretaria: string | null } | null
  }

  const umAnoAtras = new Date()
  umAnoAtras.setFullYear(umAnoAtras.getFullYear() - 1)
  const umAnoAtrasStr = umAnoAtras.toISOString().split('T')[0]

  const [
    { data: advertencias },
    { data: atestados },
    { data: faltas },
    { data: ocorrenciasRaw },
  ] = await Promise.all([
    supabase.from('advertencias')
      .select('id, grau, natureza, descricao, data_ocorrencia')
      .eq('funcionario_id', funcionarioId),
    supabase.from('atestados')
      .select('id, data_inicio, data_fim, motivo')
      .eq('funcionario_id', funcionarioId),
    supabase.from('faltas')
      .select('id, data_falta, tipo, dias, observacao')
      .eq('funcionario_id', funcionarioId),
    (supabase as unknown as AnyClient).from('ocorrencias')
      .select('id, titulo, descricao, data_ocorrencia, gravidade, status')
      .eq('funcionario_id', funcionarioId)
      .eq('tipo', 'ocorrencia'),
  ])

  const ocorrencias = (ocorrenciasRaw ?? []) as RawOcorrenciaDossie[]
  const timeline: TimelineItem[] = []

  for (const a of advertencias ?? []) {
    timeline.push({
      id: `advertencia-${a.id}`,
      tipo: 'advertencia',
      data: a.data_ocorrencia ?? '',
      titulo: `Advertência ${GRAU_LABEL[a.grau ?? ''] ?? a.grau ?? ''}`,
      detalhe: a.natureza ? (NATUREZA_LABEL[a.natureza] ?? a.natureza) : (a.descricao ?? '—'),
    })
  }

  for (const at of atestados ?? []) {
    timeline.push({
      id: `atestado-${at.id}`,
      tipo: 'atestado',
      data: at.data_inicio,
      titulo: `Atestado (${diffDias(at.data_inicio, at.data_fim)}d)`,
      detalhe: at.motivo ?? '—',
    })
  }

  for (const f of faltas ?? []) {
    timeline.push({
      id: `falta-${f.id}`,
      tipo: 'falta',
      data: f.data_falta,
      titulo: `Falta — ${FALTA_TIPO_LABELS[f.tipo as FaltaTipo] ?? f.tipo}`,
      detalhe: f.observacao ?? `${f.dias} dia(s)`,
    })
  }

  for (const o of ocorrencias) {
    timeline.push({
      id: `ocorrencia-${o.id}`,
      tipo: 'ocorrencia',
      data: o.data_ocorrencia ?? '',
      titulo: o.titulo ?? 'Ocorrência',
      detalhe: o.descricao ?? '—',
      gravidade: (o.gravidade ?? 'baixa') as TimelineItem['gravidade'],
      status: o.status ?? 'aberta',
    })
  }

  timeline.sort((a, b) => b.data.localeCompare(a.data))

  const diasAtestado12m = (atestados ?? [])
    .filter(at => at.data_inicio >= umAnoAtrasStr)
    .reduce((sum, at) => sum + diffDias(at.data_inicio, at.data_fim), 0)

  return {
    funcionario: {
      id: func.id,
      nome: func.nome,
      cpf: func.cpf,
      registro: func.registro,
      posto_nome: func.postos?.nome ?? '—',
      secretaria: func.postos?.secretaria ?? '',
    },
    kpis: {
      advertencias: (advertencias ?? []).length,
      diasAtestado12m,
      faltas: (faltas ?? []).length,
      ocorrenciasAbertas: ocorrencias.filter(o => o.status === 'aberta' || o.status === 'em_analise').length,
    },
    timeline,
  }
}

export async function createOcorrencia(formData: FormData): Promise<ActionResult> {
  const auth = await getUser()
  if (!auth || auth.perfil.role === 'viewer') return { success: false, error: 'Sem permissão' }

  const supabase = createClient()
  const adminSupabase = createAdminClient()

  const funcionario_id  = formData.get('funcionario_id') as string
  const supervisor_id   = (formData.get('supervisor_id') as string) || null
  const descricao       = formData.get('descricao') as string
  const data_ocorrencia = formData.get('data_ocorrencia') as string
  const gravidade       = formData.get('gravidade') as string

  if (!funcionario_id) return { success: false, error: 'Funcionário obrigatório' }

  const { data: func } = await supabase.from('funcionarios').select('posto_id').eq('id', funcionario_id).single()
  if (!func?.posto_id) return { success: false, error: 'Funcionário sem posto vinculado' }

  if (auth.perfil.role === 'supervisor') {
    const postoIds = await getPostoIdsSupervisor(supabase, auth.user.id)
    if (!postoIds.includes(func.posto_id)) return { success: false, error: 'Funcionário fora da sua área' }
  }

  const { error } = await (adminSupabase as unknown as AnyClient).from('ocorrencias').insert({
    funcionario_id,
    posto_id: func.posto_id,
    supervisor_id,
    descricao,
    data_ocorrencia,
    gravidade,
    status: 'aberta',
    tipo: 'ocorrencia',
    criado_por: auth.user.id,
  })

  if (error) return { success: false, error: error.message }

  revalidatePath('/ocorrencias')
  return { success: true }
}

export async function updateStatusOcorrencia(formData: FormData): Promise<ActionResult> {
  const auth = await getUser()
  if (!auth || auth.perfil.role === 'viewer') return { success: false, error: 'Sem permissão' }

  const supabase = createClient()
  const adminSupabase = createAdminClient()

  const id     = formData.get('id') as string
  const status = formData.get('status') as string

  if (auth.perfil.role === 'supervisor') {
    const { data: ocorrencia } = await (adminSupabase as unknown as AnyClient)
      .from('ocorrencias')
      .select('posto_id')
      .eq('id', id)
      .single()
    const postoIds = await getPostoIdsSupervisor(supabase, auth.user.id)
    if (!ocorrencia?.posto_id || !postoIds.includes(ocorrencia.posto_id)) {
      return { success: false, error: 'Sem permissão' }
    }
  }

  const { error } = await (adminSupabase as unknown as AnyClient)
    .from('ocorrencias')
    .update({ status, atualizado_por: auth.user.id, atualizado_em: new Date().toISOString() })
    .eq('id', id)

  if (error) return { success: false, error: error.message }

  revalidatePath('/ocorrencias')
  return { success: true }
}
```

- [ ] **Step 2: Rodar type-check**

Run: `npx tsc --noEmit`
Expected: sem erros novos vindos de `app/(admin)/ocorrencias/actions.ts` (erros em outros arquivos que ainda importam o formato antigo são esperados agora — serão corrigidos nas próximas tasks).

- [ ] **Step 3: Commit**

```bash
git add "app/(admin)/ocorrencias/actions.ts"
git commit -m "feat(ocorrencias): actions do dossiê do funcionário

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: Componente `busca-funcionario.tsx`

**Files:**
- Create: `components/ocorrencias/busca-funcionario.tsx`

- [ ] **Step 1: Criar o componente**

```tsx
'use client'

import { useMemo, useState } from 'react'
import type { FuncionarioBusca } from '@/app/(admin)/ocorrencias/actions'

function maskCPF(cpf: string | null): string {
  if (!cpf) return '—'
  return '***.***.***-**'
}

const inputClass =
  'h-9 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm shadow-sm text-gray-700 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400'

export function BuscaFuncionario({
  funcionarios,
  onSelect,
}: {
  funcionarios: FuncionarioBusca[]
  onSelect: (id: string) => void
}) {
  const [busca, setBusca] = useState('')
  const [secretaria, setSecretaria] = useState('')

  const secretarias = useMemo(
    () => Array.from(new Set(funcionarios.map(f => f.secretaria).filter(Boolean))).sort(),
    [funcionarios],
  )

  const filtrados = useMemo(() => {
    let list = funcionarios
    if (secretaria) list = list.filter(f => f.secretaria === secretaria)
    if (busca.trim()) {
      const termo = busca.trim().toLowerCase()
      list = list.filter(f => f.nome.toLowerCase().includes(termo))
    }
    return list.slice(0, 50)
  }, [funcionarios, busca, secretaria])

  return (
    <div className="space-y-3">
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
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
        {filtrados.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-gray-400">
            {busca || secretaria ? 'Nenhum funcionário encontrado' : 'Digite um nome ou escolha uma secretaria pra buscar'}
          </p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {filtrados.map(f => (
              <li key={f.id}>
                <button
                  type="button"
                  onClick={() => onSelect(f.id)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left text-sm hover:bg-gray-50"
                >
                  <span className="font-medium text-gray-900">{f.nome}</span>
                  <span className="flex items-center gap-3 text-xs text-gray-400">
                    <span>{f.posto_nome}{f.secretaria ? ` — ${f.secretaria}` : ''}</span>
                    <span>{maskCPF(f.cpf)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/ocorrencias/busca-funcionario.tsx
git commit -m "feat(ocorrencias): componente de busca de funcionário

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: Componente `alertas-section.tsx`

**Files:**
- Create: `components/ocorrencias/alertas-section.tsx`

- [ ] **Step 1: Criar o componente**

```tsx
'use client'

import { useState, useTransition } from 'react'
import type { AlertaRow } from '@/app/(admin)/ocorrencias/actions'
import { criarAlerta, resolverAlerta } from '@/app/(admin)/ocorrencias/actions'

const inputClass =
  'h-9 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm shadow-sm text-gray-700 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400'

export function AlertasSection({
  alertasIniciais,
  canWrite,
}: {
  alertasIniciais: AlertaRow[]
  canWrite: boolean
}) {
  const [alertas, setAlertas]           = useState(alertasIniciais)
  const [aberto, setAberto]             = useState(false)
  const [modalOpen, setModalOpen]       = useState(false)
  const [titulo, setTitulo]             = useState('')
  const [descricao, setDescricao]       = useState('')
  const [lembrete, setLembrete]         = useState('')
  const [erro, setErro]                 = useState<string | null>(null)
  const [isPending, startTransition]    = useTransition()

  function handleCriar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErro(null)
    startTransition(async () => {
      const result = await criarAlerta(titulo, descricao, lembrete || null)
      if (result.success) {
        setModalOpen(false)
        setTitulo(''); setDescricao(''); setLembrete('')
        // recarrega a lista via reload simples da rota (server action já revalida o path)
        window.location.reload()
      } else {
        setErro(result.error)
      }
    })
  }

  function handleResolver(id: string) {
    startTransition(async () => {
      const result = await resolverAlerta(id)
      if (result.success) setAlertas(prev => prev.filter(a => a.id !== id))
      else alert(result.error)
    })
  }

  return (
    <div className="rounded-xl border border-purple-100 bg-purple-50/50 p-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setAberto(o => !o)}
          className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-purple-700"
        >
          🔔 Meus Alertas {alertas.length > 0 && `(${alertas.length})`}
          <span className="text-purple-400">{aberto ? '▲' : '▼'}</span>
        </button>
        {canWrite && (
          <button
            type="button"
            onClick={() => { setErro(null); setModalOpen(true) }}
            className="h-8 rounded-lg border border-purple-200 bg-white px-3 text-xs font-semibold uppercase tracking-widest text-purple-700 hover:bg-purple-100"
          >
            Novo Alerta
          </button>
        )}
      </div>

      {aberto && (
        <div className="mt-3 space-y-1.5">
          {alertas.length === 0 ? (
            <p className="text-xs text-purple-400">Nenhum alerta aberto.</p>
          ) : (
            alertas.map(a => (
              <div key={a.id} className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-xs shadow-sm">
                <div>
                  <p className="font-medium text-gray-900">{a.titulo ?? a.descricao}</p>
                  <p className="text-gray-400">
                    {a.supervisor_nome ?? '—'}
                    {a.data_lembrete && ` · lembrete: ${new Date(a.data_lembrete + 'T12:00:00').toLocaleDateString('pt-BR')}`}
                  </p>
                </div>
                <button
                  disabled={isPending}
                  onClick={() => handleResolver(a.id)}
                  className="rounded-lg bg-purple-100 px-3 py-1 font-semibold text-purple-700 hover:bg-purple-200 disabled:opacity-50"
                >
                  Resolver
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-widest text-gray-900">🔔 Novo Alerta</h2>
              <button onClick={() => setModalOpen(false)} className="text-lg leading-none text-gray-400 hover:text-gray-600">✕</button>
            </div>

            <form onSubmit={handleCriar} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-widest text-gray-400">Título</label>
                <input type="text" required value={titulo} onChange={e => setTitulo(e.target.value)}
                  placeholder="Título do alerta…" className={inputClass} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-widest text-gray-400">Descrição</label>
                <textarea required value={descricao} onChange={e => setDescricao(e.target.value)} rows={3}
                  placeholder="Descreva o alerta…"
                  className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-widest text-gray-400">
                  Data Lembrete <span className="normal-case font-normal text-gray-400">(opcional)</span>
                </label>
                <input type="date" value={lembrete} onChange={e => setLembrete(e.target.value)} className={inputClass} />
              </div>

              {erro && <p className="text-xs text-red-500">{erro}</p>}

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setModalOpen(false)}
                  className="h-9 rounded-lg border border-gray-200 px-4 text-xs font-semibold uppercase tracking-widest text-gray-500 hover:bg-gray-50">
                  Cancelar
                </button>
                <button type="submit" disabled={isPending}
                  className="h-9 rounded-lg bg-purple-700 px-4 text-xs font-semibold uppercase tracking-widest text-white hover:bg-purple-800 disabled:opacity-50">
                  {isPending ? 'Salvando…' : 'Criar Alerta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/ocorrencias/alertas-section.tsx
git commit -m "feat(ocorrencias): extrai seção de alertas do supervisor

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 5: Componente `modal-nova-ocorrencia.tsx`

**Files:**
- Create: `components/ocorrencias/modal-nova-ocorrencia.tsx`

- [ ] **Step 1: Criar o componente**

```tsx
'use client'

import { useTransition } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import type { SupervisorSimples } from '@/app/(admin)/ocorrencias/actions'
import { createOcorrencia } from '@/app/(admin)/ocorrencias/actions'

const inputClass =
  'h-9 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm shadow-sm text-gray-700 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400'

export function ModalNovaOcorrencia({
  open,
  onClose,
  funcionarioId,
  funcionarioNome,
  supervisores,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  funcionarioId: string
  funcionarioNome: string
  supervisores: SupervisorSimples[]
  onCreated: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const today = new Date().toISOString().split('T')[0]

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    fd.set('funcionario_id', funcionarioId)
    startTransition(async () => {
      const result = await createOcorrencia(fd)
      if (result.success) {
        onCreated()
        onClose()
      } else {
        alert(result.error)
      }
    })
  }

  return (
    <Dialog.Root open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[60] bg-black/50" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-[61] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-2xl">
          <Dialog.Title className="mb-1 text-sm font-bold uppercase tracking-widest text-gray-900">
            Nova Ocorrência
          </Dialog.Title>
          <p className="mb-5 text-sm text-gray-400">{funcionarioNome}</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-widest text-gray-400">Supervisor</label>
              <select name="supervisor_id" className={inputClass}>
                <option value="">Sem supervisor</option>
                {supervisores.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-widest text-gray-400">Data</label>
                <input type="date" name="data_ocorrencia" defaultValue={today} required className={inputClass} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-widest text-gray-400">Gravidade</label>
                <select name="gravidade" required className={inputClass}>
                  <option value="">Selecionar…</option>
                  <option value="baixa">Baixa</option>
                  <option value="media">Média</option>
                  <option value="alta">Alta</option>
                  <option value="critica">Crítica</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-widest text-gray-400">Descrição</label>
              <textarea name="descricao" required rows={3} placeholder="Descreva a ocorrência…"
                className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400" />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={onClose}
                className="h-9 rounded-lg border border-gray-200 px-4 text-xs font-semibold uppercase tracking-widest text-gray-500 hover:bg-gray-50">
                Cancelar
              </button>
              <button type="submit" disabled={isPending}
                className="h-9 rounded-lg bg-slate-900 px-4 text-xs font-semibold uppercase tracking-widest text-white hover:bg-slate-700 disabled:opacity-50">
                {isPending ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/ocorrencias/modal-nova-ocorrencia.tsx
git commit -m "feat(ocorrencias): modal de nova ocorrência presa ao funcionário

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 6: Componente `modal-dossie.tsx`

**Files:**
- Create: `components/ocorrencias/modal-dossie.tsx`

- [ ] **Step 1: Criar o componente**

```tsx
'use client'

import { useEffect, useState, useTransition } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import type { DossieFuncionario, SupervisorSimples, TimelineTipo } from '@/app/(admin)/ocorrencias/actions'
import { getDossieFuncionario, updateStatusOcorrencia } from '@/app/(admin)/ocorrencias/actions'
import { ModalNovaOcorrencia } from './modal-nova-ocorrencia'

function maskCPF(cpf: string | null): string {
  if (!cpf) return '—'
  return '***.***.***-**'
}

const TIPO_LABEL: Record<TimelineTipo, string> = {
  advertencia: 'Advertência',
  atestado:    'Atestado',
  falta:       'Falta',
  ocorrencia:  'Ocorrência',
}

const TIPO_COLOR: Record<TimelineTipo, string> = {
  advertencia: 'bg-orange-100 text-orange-700',
  atestado:    'bg-blue-100 text-blue-700',
  falta:       'bg-red-100 text-red-700',
  ocorrencia:  'bg-purple-100 text-purple-700',
}

const GRAVIDADE_CHIP: Record<string, string> = {
  baixa:   'bg-gray-100 text-gray-600',
  media:   'bg-amber-100 text-amber-700',
  alta:    'bg-orange-100 text-orange-700',
  critica: 'bg-red-100 text-red-700 font-bold',
}

const STATUS_LABEL: Record<string, string> = {
  aberta: 'Aberta', em_analise: 'Em Análise', encerrada: 'Encerrada', resolvido: 'Resolvido',
}

function CounterCard({ label, value, topColor }: { label: string; value: number | string; topColor: string }) {
  return (
    <div className={`rounded-xl border border-gray-100 border-t-4 bg-white p-3 shadow-sm ${topColor}`}>
      <p className="text-2xl font-black tracking-tight text-gray-900">{value}</p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-gray-400">{label}</p>
    </div>
  )
}

export function ModalDossie({
  funcionarioId,
  supervisores,
  canWrite,
  onClose,
}: {
  funcionarioId: string
  supervisores: SupervisorSimples[]
  canWrite: boolean
  onClose: () => void
}) {
  const [dossie, setDossie]         = useState<DossieFuncionario | null>(null)
  const [loading, setLoading]       = useState(true)
  const [filtroTipo, setFiltroTipo] = useState<TimelineTipo | ''>('')
  const [novaOpen, setNovaOpen]     = useState(false)
  const [isPending, startTransition] = useTransition()

  async function carregar() {
    setLoading(true)
    const data = await getDossieFuncionario(funcionarioId)
    setDossie(data)
    setLoading(false)
  }

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [funcionarioId])

  function handleStatusUpdate(idComPrefixo: string, novoStatus: 'em_analise' | 'encerrada') {
    const id = idComPrefixo.replace('ocorrencia-', '')
    const fd = new FormData()
    fd.set('id', id)
    fd.set('status', novoStatus)
    startTransition(async () => {
      const result = await updateStatusOcorrencia(fd)
      if (result.success) carregar()
      else alert(result.error)
    })
  }

  const timelineFiltrada = dossie
    ? (filtroTipo ? dossie.timeline.filter(t => t.tipo === filtroTipo) : dossie.timeline)
    : []

  return (
    <Dialog.Root open onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/50" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-full max-w-3xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
          {loading || !dossie ? (
            <p className="py-12 text-center text-sm text-gray-400">Carregando dossiê…</p>
          ) : (
            <>
              <div className="mb-5 flex items-start justify-between">
                <div>
                  <Dialog.Title className="text-lg font-bold text-gray-900">{dossie.funcionario.nome}</Dialog.Title>
                  <p className="text-sm text-gray-400">
                    {dossie.funcionario.posto_nome} — {dossie.funcionario.secretaria || '—'}
                    {dossie.funcionario.registro && ` · RE ${dossie.funcionario.registro}`}
                    {' · CPF '}{maskCPF(dossie.funcionario.cpf)}
                  </p>
                </div>
                <button onClick={onClose} className="text-lg leading-none text-gray-400 hover:text-gray-600">✕</button>
              </div>

              <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <CounterCard label="Advertências"    value={dossie.kpis.advertencias}       topColor="border-t-orange-500" />
                <CounterCard label="Dias Atestado (12m)" value={dossie.kpis.diasAtestado12m} topColor="border-t-blue-500"   />
                <CounterCard label="Faltas"           value={dossie.kpis.faltas}             topColor="border-t-red-500"    />
                <CounterCard label="Ocorrências Abertas" value={dossie.kpis.ocorrenciasAbertas} topColor="border-t-purple-500" />
              </div>

              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setFiltroTipo('')}
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${filtroTipo === '' ? 'bg-slate-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                  >
                    Todos
                  </button>
                  {(Object.keys(TIPO_LABEL) as TimelineTipo[]).map(tipo => (
                    <button
                      key={tipo}
                      onClick={() => setFiltroTipo(tipo)}
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${filtroTipo === tipo ? 'bg-slate-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                    >
                      {TIPO_LABEL[tipo]}
                    </button>
                  ))}
                </div>
                {canWrite && (
                  <button
                    onClick={() => setNovaOpen(true)}
                    className="h-8 rounded-lg bg-slate-900 px-3 text-xs font-semibold uppercase tracking-widest text-white hover:bg-slate-700"
                  >
                    Nova Ocorrência
                  </button>
                )}
              </div>

              <div className="space-y-2">
                {timelineFiltrada.length === 0 ? (
                  <p className="py-8 text-center text-sm text-gray-400">Nenhum registro encontrado.</p>
                ) : (
                  timelineFiltrada.map(item => (
                    <div key={item.id} className="flex items-start justify-between gap-3 rounded-lg border border-gray-100 px-4 py-3">
                      <div className="flex items-start gap-3">
                        <span className={`mt-0.5 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${TIPO_COLOR[item.tipo]}`}>
                          {TIPO_LABEL[item.tipo]}
                        </span>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{item.titulo}</p>
                          <p className="text-xs text-gray-500">{item.detalhe}</p>
                        </div>
                      </div>
                      <div className="flex flex-shrink-0 flex-col items-end gap-1.5">
                        <span className="text-xs text-gray-400">
                          {item.data ? new Date(item.data + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}
                        </span>
                        {item.tipo === 'ocorrencia' && item.gravidade && (
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${GRAVIDADE_CHIP[item.gravidade] ?? ''}`}>
                            {item.gravidade}
                          </span>
                        )}
                        {item.tipo === 'ocorrencia' && item.status && (
                          <span className="text-xs font-medium text-gray-500">{STATUS_LABEL[item.status] ?? item.status}</span>
                        )}
                        {canWrite && item.tipo === 'ocorrencia' && item.status === 'aberta' && (
                          <button
                            disabled={isPending}
                            onClick={() => handleStatusUpdate(item.id, 'em_analise')}
                            className="rounded-lg bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700 hover:bg-amber-200 disabled:opacity-50"
                          >
                            Em Análise
                          </button>
                        )}
                        {canWrite && item.tipo === 'ocorrencia' && item.status === 'em_analise' && (
                          <button
                            disabled={isPending}
                            onClick={() => handleStatusUpdate(item.id, 'encerrada')}
                            className="rounded-lg bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700 hover:bg-green-200 disabled:opacity-50"
                          >
                            Encerrar
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {canWrite && (
                <ModalNovaOcorrencia
                  open={novaOpen}
                  onClose={() => setNovaOpen(false)}
                  funcionarioId={dossie.funcionario.id}
                  funcionarioNome={dossie.funcionario.nome}
                  supervisores={supervisores}
                  onCreated={carregar}
                />
              )}
            </>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/ocorrencias/modal-dossie.tsx
git commit -m "feat(ocorrencias): modal do dossiê com timeline unificada

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 7: Reescrever `ocorrencias-client.tsx` (orquestrador) e remover a tabela antiga

**Files:**
- Modify: `components/ocorrencias/ocorrencias-client.tsx` (reescrita completa)
- Delete: `components/ocorrencias/ocorrencias-table.tsx`

- [ ] **Step 1: Substituir todo o conteúdo de `ocorrencias-client.tsx`**

```tsx
'use client'

import { useState } from 'react'
import type { FuncionarioBusca, SupervisorSimples, AlertaRow } from '@/app/(admin)/ocorrencias/actions'
import { BuscaFuncionario } from './busca-funcionario'
import { AlertasSection } from './alertas-section'
import { ModalDossie } from './modal-dossie'

export function OcorrenciasClient({
  funcionarios,
  supervisores,
  alertasIniciais,
  canWrite,
}: {
  funcionarios: FuncionarioBusca[]
  supervisores: SupervisorSimples[]
  alertasIniciais: AlertaRow[]
  currentUserId: string | null
  canWrite: boolean
}) {
  const [selecionado, setSelecionado] = useState<string | null>(null)

  return (
    <div className="space-y-6">
      <AlertasSection alertasIniciais={alertasIniciais} canWrite={canWrite} />

      <BuscaFuncionario funcionarios={funcionarios} onSelect={setSelecionado} />

      {selecionado && (
        <ModalDossie
          funcionarioId={selecionado}
          supervisores={supervisores}
          canWrite={canWrite}
          onClose={() => setSelecionado(null)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Deletar o arquivo `ocorrencias-table.tsx`**

```bash
rm "components/ocorrencias/ocorrencias-table.tsx"
```

- [ ] **Step 3: Commit**

```bash
git add -A components/ocorrencias/
git commit -m "refactor(ocorrencias): orquestrador do dossiê, remove tabela antiga

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 8: Atualizar `app/(admin)/ocorrencias/page.tsx`

**Files:**
- Modify: `app/(admin)/ocorrencias/page.tsx`

- [ ] **Step 1: Substituir todo o conteúdo**

```tsx
import { getUser } from '@/lib/auth/get-user'
import { getFuncionariosParaBusca, getSupervisoresSimples, getAlertas } from './actions'
import { OcorrenciasClient } from '@/components/ocorrencias/ocorrencias-client'

export default async function OcorrenciasPage() {
  const [funcionarios, supervisores, alertas, auth] = await Promise.all([
    getFuncionariosParaBusca(),
    getSupervisoresSimples(),
    getAlertas(),
    getUser(),
  ])

  const canWrite = auth?.perfil.role === 'admin' || auth?.perfil.role === 'coordenador' || auth?.perfil.role === 'supervisor'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Ocorrências</h1>
        <p className="text-sm text-gray-400">Dossiê do funcionário: advertências, atestados, faltas e ocorrências num só lugar</p>
      </div>

      <OcorrenciasClient
        funcionarios={funcionarios}
        supervisores={supervisores}
        alertasIniciais={alertas}
        currentUserId={auth?.user.id ?? null}
        canWrite={canWrite}
      />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add "app/(admin)/ocorrencias/page.tsx"
git commit -m "feat(ocorrencias): página vira busca de funcionário + dossiê

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 9: Build e verificação manual

**Files:** nenhum (apenas verificação)

- [ ] **Step 1: Build de produção**

Run: `npm run build`
Expected: build conclui sem erros. Corrigir qualquer erro de tipo ou import antes de prosseguir (nenhum outro arquivo do projeto deveria importar de `app/(admin)/ocorrencias/actions.ts` além dos criados/modificados aqui — confirmar com a busca abaixo).

- [ ] **Step 2: Confirmar que nada mais depende das funções removidas**

Run: `grep -rn "getOcorrenciasData\|getPostosSimples" --include="*.ts" --include="*.tsx" .`
Expected: nenhum resultado (ambas as funções foram removidas de `actions.ts` e não devem ser referenciadas em nenhum outro arquivo).

- [ ] **Step 3: Type-check completo**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 4: QA manual (como admin)**

1. Abrir `/ocorrencias`.
2. Buscar um funcionário pelo nome, confirmar que a lista filtra.
3. Clicar no funcionário → modal do dossiê abre com KPIs e timeline.
4. Testar os filtros de chip (Todos/Advertência/Atestado/Falta/Ocorrência).
5. Clicar "Nova Ocorrência", preencher e salvar → item aparece na timeline sem fechar o modal do dossiê.
6. Mudar status da ocorrência criada (Em Análise → Encerrar) e confirmar que reflete na timeline.
7. Testar "Meus Alertas": criar um alerta, resolver, confirmar que some da lista.

- [ ] **Step 5: QA manual (como supervisor, se houver usuário de teste)**

1. Confirmar que a busca só lista funcionários dos postos do supervisor.
2. Confirmar que o dossiê de um funcionário fora da área retorna vazio/bloqueado (testar via URL direta não é possível pela UI — validar que `getDossieFuncionario` retorna `null` chamando a action com um id fora do escopo, se houver acesso a um console de teste).
3. Confirmar que alertas próprios aparecem em "Meus Alertas" (valida o fix de RLS da Task 1).

---

## Self-Review

**Cobertura da spec:**
- Migração `funcionario_id` + RLS → Task 1. ✅
- Busca de funcionário como entrada da página → Task 3 + Task 8. ✅
- Modal grande com dossiê (KPIs, timeline agregada, filtros) → Task 6. ✅
- Registro de ocorrência preso ao funcionário (sem campo de posto) → Task 5. ✅
- Alertas mantidos separados → Task 4. ✅
- Permissões (admin/coordenador/supervisor/viewer) → replicadas em todas as actions da Task 2 e checadas nos componentes via `canWrite`. ✅
- Remoção de `getOcorrenciasData`/`getPostosSimples` → Task 2 (removidas) + Task 9 Step 2 (confirma que nada mais referencia). ✅

**Consistência de tipos:** `FuncionarioBusca`, `SupervisorSimples`, `AlertaRow`, `TimelineTipo`, `TimelineItem`, `DossieFuncionario` são definidos uma vez em `actions.ts` (Task 2) e importados com os mesmos nomes em todos os componentes (Tasks 3–7) — conferido campo a campo.
