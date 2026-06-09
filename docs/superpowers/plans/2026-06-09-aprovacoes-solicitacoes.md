# Aprovações + Solicitações Supervisor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reformar o módulo de aprovações do admin com KPIs/filtros/cards completos e criar o fluxo de solicitações no painel supervisor.

**Architecture:** A tabela `solicitacoes` existente é estendida com `vigencia` e `motivo_rejeicao`; o tipo `mudanca_supervisor` é removido e `alteracao_salario` é adicionado. A tabela `funcionarios` recebe coluna `salario`. O admin aprova/rejeita via cards ricos com PDF disponível pós-aprovação. O supervisor cria solicitações via modal com snapshot automático.

**Tech Stack:** Next.js 14 App Router, Supabase (client síncrono), TypeScript, Tailwind, shadcn/ui, @react-pdf/renderer

---

## File Map

| Arquivo | Ação |
|---|---|
| `supabase/migrations/20260609_solicitacoes_reforma.sql` | Criar |
| `types/database.ts` | Modificar — adicionar colunas novas em `solicitacoes` + `funcionarios` |
| `types/index.ts` | Modificar — `TipoSolicitacao` |
| `app/(admin)/aprovacoes/actions.ts` | Reescrever |
| `app/(admin)/aprovacoes/page.tsx` | Reescrever |
| `components/aprovacoes/aprovacoes-list.tsx` | Reescrever |
| `components/aprovacoes/movimentacao-pdf.tsx` | Criar |
| `app/supervisor/solicitacoes/actions.ts` | Criar |
| `app/supervisor/solicitacoes/page.tsx` | Criar |
| `components/supervisor/modal-nova-solicitacao.tsx` | Criar |
| `components/supervisor/supervisor-nav.tsx` | Modificar — adicionar tab |

---

## Task 1: Migração do banco

**Files:**
- Create: `supabase/migrations/20260609_solicitacoes_reforma.sql`

- [ ] **Step 1: Criar o arquivo de migração**

```sql
-- supabase/migrations/20260609_solicitacoes_reforma.sql

-- 1. Adicionar salário individual em funcionarios
ALTER TABLE funcionarios ADD COLUMN IF NOT EXISTS salario NUMERIC(10,2);

-- 2. Adicionar campos de controle em solicitacoes
ALTER TABLE solicitacoes
  ADD COLUMN IF NOT EXISTS vigencia DATE,
  ADD COLUMN IF NOT EXISTS motivo_rejeicao TEXT;

-- 3. Deprecar solicitações pendentes do tipo removido
UPDATE solicitacoes
SET status = 'rejeitada',
    observacao_admin = 'Tipo removido do sistema'
WHERE tipo = 'mudanca_supervisor'
  AND status = 'pendente';

-- 4. Recriar CHECK de tipo (remover mudanca_supervisor, adicionar alteracao_salario)
ALTER TABLE solicitacoes DROP CONSTRAINT IF EXISTS solicitacoes_tipo_check;
ALTER TABLE solicitacoes ADD CONSTRAINT solicitacoes_tipo_check
  CHECK (tipo IN (
    'transferencia',
    'mudanca_funcao',
    'promocao',
    'desligamento',
    'alteracao_salario'
  ));
```

- [ ] **Step 2: Executar no Supabase**

Acesse o Supabase SQL Editor do projeto `fwdhnipekbmeqozkpfyh` e execute o conteúdo do arquivo acima. Confirme que não há erros.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260609_solicitacoes_reforma.sql
git commit -m "feat: migração solicitacoes reforma + funcionarios.salario"
```

---

## Task 2: Tipos TypeScript

**Files:**
- Modify: `types/database.ts`
- Modify: `types/index.ts`

- [ ] **Step 1: Atualizar `types/database.ts` — tabela `funcionarios`**

Localizar o bloco `funcionarios` e adicionar `salario` nos três sub-tipos:

```ts
// em funcionarios.Row (após updated_at)
salario: number | null

// em funcionarios.Insert (após updated_at)
salario?: number | null

// em funcionarios.Update (após updated_at)
salario?: number | null
```

- [ ] **Step 2: Atualizar `types/database.ts` — tabela `solicitacoes`**

Substituir o bloco `solicitacoes` inteiro pelo abaixo (atualiza o union de `tipo`, adiciona `vigencia` e `motivo_rejeicao`):

```ts
// ----------------------------------------------------------
// solicitacoes
// ----------------------------------------------------------
solicitacoes: {
  Row: {
    id: string
    tipo: 'desligamento' | 'transferencia' | 'mudanca_funcao' | 'promocao' | 'alteracao_salario'
    status: 'pendente' | 'aprovada' | 'rejeitada'
    funcionario_id: string
    supervisor_id: string | null
    dados_antes: Json | null
    dados_depois: Json | null
    motivo: string | null
    motivo_rejeicao: string | null
    observacao_admin: string | null
    vigencia: string | null
    aprovado_por: string | null
    aprovado_em: string | null
    created_at: string | null
  }
  Insert: {
    id?: string
    tipo: 'desligamento' | 'transferencia' | 'mudanca_funcao' | 'promocao' | 'alteracao_salario'
    status?: 'pendente' | 'aprovada' | 'rejeitada'
    funcionario_id: string
    supervisor_id?: string | null
    dados_antes?: Json | null
    dados_depois?: Json | null
    motivo?: string | null
    motivo_rejeicao?: string | null
    observacao_admin?: string | null
    vigencia?: string | null
    aprovado_por?: string | null
    aprovado_em?: string | null
    created_at?: string | null
  }
  Update: {
    id?: string
    tipo?: 'desligamento' | 'transferencia' | 'mudanca_funcao' | 'promocao' | 'alteracao_salario'
    status?: 'pendente' | 'aprovada' | 'rejeitada'
    funcionario_id?: string
    supervisor_id?: string | null
    dados_antes?: Json | null
    dados_depois?: Json | null
    motivo?: string | null
    motivo_rejeicao?: string | null
    observacao_admin?: string | null
    vigencia?: string | null
    aprovado_por?: string | null
    aprovado_em?: string | null
  }
  Relationships: []
}
```

- [ ] **Step 3: Atualizar `types/index.ts` — `TipoSolicitacao`**

Substituir:
```ts
/** Tipos de solicitação que requerem aprovação */
export type TipoSolicitacao =
  | 'desligamento'
  | 'transferencia'
  | 'mudanca_funcao'
  | 'promocao'
  | 'mudanca_supervisor'
```

Por:
```ts
/** Tipos de solicitação que requerem aprovação */
export type TipoSolicitacao =
  | 'desligamento'
  | 'transferencia'
  | 'mudanca_funcao'
  | 'promocao'
  | 'alteracao_salario'
```

- [ ] **Step 4: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: sem erros (pode haver erros em arquivos downstream — anotar e corrigir nos próximos tasks).

- [ ] **Step 5: Commit**

```bash
git add types/database.ts types/index.ts
git commit -m "feat: tipos solicitacoes reforma + funcionarios.salario"
```

---

## Task 3: Admin Server Actions

**Files:**
- Rewrite: `app/(admin)/aprovacoes/actions.ts`

- [ ] **Step 1: Reescrever `app/(admin)/aprovacoes/actions.ts` completamente**

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/auth/get-user'

// ── tipos exportados ──────────────────────────────────────────────────────────

export type SolicitacaoCompleta = {
  id: string
  tipo: string
  status: string
  motivo: string | null
  motivo_rejeicao: string | null
  observacao_admin: string | null
  vigencia: string | null
  dados_antes: Record<string, unknown> | null
  dados_depois: Record<string, unknown> | null
  created_at: string | null
  aprovado_por: string | null
  aprovado_em: string | null
  funcionario: { id: string; nome: string } | null
  solicitante: { id: string; nome: string | null; email: string | null } | null
}

export type DadosPDF = {
  funcionario: { nome: string; id: string; salario: number | null }
  funcao_atual: { nome: string; insalubridade_perc: number | null } | null
  posto_atual: { nome: string; secretaria: string | null } | null
  supervisor_nome: string | null
}

// ── queries ───────────────────────────────────────────────────────────────────

export async function buscarSolicitacoes(): Promise<SolicitacaoCompleta[]> {
  const supabase = createClient()

  const { data } = await supabase
    .from('solicitacoes')
    .select(`
      id, tipo, status, motivo, motivo_rejeicao, observacao_admin, vigencia,
      dados_antes, dados_depois, created_at, aprovado_por, aprovado_em,
      funcionarios!funcionario_id ( id, nome ),
      perfis!supervisor_id ( id, nome, email )
    `)
    .order('created_at', { ascending: false })

  return (data ?? []).map(row => {
    const r = row as Record<string, unknown>
    return {
      id: r.id as string,
      tipo: r.tipo as string,
      status: r.status as string,
      motivo: r.motivo as string | null,
      motivo_rejeicao: r.motivo_rejeicao as string | null,
      observacao_admin: r.observacao_admin as string | null,
      vigencia: r.vigencia as string | null,
      dados_antes: r.dados_antes as Record<string, unknown> | null,
      dados_depois: r.dados_depois as Record<string, unknown> | null,
      created_at: r.created_at as string | null,
      aprovado_por: r.aprovado_por as string | null,
      aprovado_em: r.aprovado_em as string | null,
      funcionario: r.funcionarios as { id: string; nome: string } | null,
      solicitante: r.perfis as { id: string; nome: string | null; email: string | null } | null,
    }
  })
}

export async function buscarSupervisores(): Promise<
  Array<{ id: string; nome: string | null; email: string | null }>
> {
  const supabase = createClient()
  const { data } = await supabase
    .from('perfis')
    .select('id, nome, email')
    .eq('role', 'supervisor')
    .eq('ativo', true)
    .order('nome')
  return data ?? []
}

// ── mutations ─────────────────────────────────────────────────────────────────

export async function aprovarSolicitacao(id: string): Promise<void> {
  const supabase = createClient()
  const auth = await getUser()
  if (!auth) throw new Error('Não autenticado')
  if (auth.perfil.role !== 'admin') throw new Error('Acesso negado')

  const { data: sol } = await supabase
    .from('solicitacoes')
    .select('*')
    .eq('id', id)
    .single()

  if (!sol) throw new Error('Solicitação não encontrada')
  if (sol.status !== 'pendente') throw new Error('Solicitação já processada')

  const { data: func } = await supabase
    .from('funcionarios')
    .select('status, posto_id, funcao_id, salario')
    .eq('id', sol.funcionario_id)
    .single()

  const dadosDepois = (sol.dados_depois ?? {}) as Record<string, unknown>
  const now = new Date().toISOString()

  switch (sol.tipo) {
    case 'desligamento': {
      await supabase
        .from('funcionarios')
        .update({
          status: 'desligado',
          data_desligamento: sol.vigencia ?? now.split('T')[0],
        })
        .eq('id', sol.funcionario_id)
      break
    }
    case 'transferencia': {
      await supabase
        .from('funcionarios')
        .update({ posto_id: dadosDepois.posto_destino_id as string })
        .eq('id', sol.funcionario_id)
      break
    }
    case 'mudanca_funcao': {
      await supabase
        .from('funcionarios')
        .update({ funcao_id: dadosDepois.funcao_destino_id as string })
        .eq('id', sol.funcionario_id)
      break
    }
    case 'promocao': {
      const updates: Record<string, unknown> = {
        funcao_id: dadosDepois.funcao_destino_id as string,
      }
      if (dadosDepois.salario_proposto != null) {
        updates.salario = dadosDepois.salario_proposto
      }
      await supabase.from('funcionarios').update(updates).eq('id', sol.funcionario_id)
      break
    }
    case 'alteracao_salario': {
      await supabase
        .from('funcionarios')
        .update({ salario: dadosDepois.salario_proposto as number })
        .eq('id', sol.funcionario_id)
      break
    }
  }

  const campoAntes: Record<string, string> = {
    desligamento:      String(func?.status ?? ''),
    transferencia:     String(func?.posto_id ?? ''),
    mudanca_funcao:    String(func?.funcao_id ?? ''),
    promocao:          String(func?.funcao_id ?? ''),
    alteracao_salario: String(func?.salario ?? ''),
  }
  const campoDepois: Record<string, string> = {
    desligamento:      'desligado',
    transferencia:     String(dadosDepois.posto_destino_id ?? ''),
    mudanca_funcao:    String(dadosDepois.funcao_destino_id ?? ''),
    promocao:          String(dadosDepois.funcao_destino_id ?? ''),
    alteracao_salario: String(dadosDepois.salario_proposto ?? ''),
  }
  const campoAlterado: Record<string, string> = {
    desligamento:      'status',
    transferencia:     'posto_id',
    mudanca_funcao:    'funcao_id',
    promocao:          'funcao_id',
    alteracao_salario: 'salario',
  }

  await supabase.from('movimentacoes').insert({
    funcionario_id:  sol.funcionario_id,
    tipo:            sol.tipo,
    campo_alterado:  campoAlterado[sol.tipo] ?? null,
    valor_antes:     campoAntes[sol.tipo] ?? null,
    valor_depois:    campoDepois[sol.tipo] ?? null,
    executado_por:   auth.user.id,
    solicitacao_id:  id,
  })

  await supabase
    .from('solicitacoes')
    .update({ status: 'aprovada', aprovado_por: auth.user.id, aprovado_em: now })
    .eq('id', id)

  revalidatePath('/aprovacoes')
  revalidatePath('/efetivo')
  revalidatePath('/dashboard')
}

export async function rejeitarSolicitacao(id: string, motivo: string): Promise<void> {
  const supabase = createClient()
  const auth = await getUser()
  if (!auth) throw new Error('Não autenticado')
  if (auth.perfil.role !== 'admin') throw new Error('Acesso negado')

  if (!motivo.trim()) throw new Error('Motivo obrigatório')

  await supabase
    .from('solicitacoes')
    .update({
      status:           'rejeitada',
      motivo_rejeicao:  motivo,
      aprovado_por:     auth.user.id,
      aprovado_em:      new Date().toISOString(),
    })
    .eq('id', id)

  revalidatePath('/aprovacoes')
}

export async function buscarDadosFuncionarioParaPDF(funcId: string): Promise<DadosPDF | null> {
  const supabase = createClient()

  const { data: func } = await supabase
    .from('funcionarios')
    .select('id, nome, salario, funcao_id, posto_id')
    .eq('id', funcId)
    .single()

  if (!func) return null

  const funcaoPromise = func.funcao_id
    ? supabase.from('funcoes').select('nome, insalubridade_perc').eq('id', func.funcao_id).single()
    : Promise.resolve({ data: null, error: null })
  const postoPromise = func.posto_id
    ? supabase.from('postos').select('nome, secretaria').eq('id', func.posto_id).single()
    : Promise.resolve({ data: null, error: null })

  const [{ data: funcao }, { data: posto }] = await Promise.all([funcaoPromise, postoPromise])

  let supervisorNome: string | null = null
  if (func.posto_id) {
    const { data: csp } = await supabase
      .from('config_supervisores_postos')
      .select('perfis!supervisor_id (nome)')
      .eq('posto_id', func.posto_id)
      .eq('ativo', true)
      .limit(1)
      .single()
    supervisorNome =
      (csp?.perfis as { nome: string | null } | null)?.nome ?? null
  }

  return {
    funcionario: { nome: func.nome, id: func.id, salario: func.salario },
    funcao_atual: funcao ?? null,
    posto_atual:  posto  ?? null,
    supervisor_nome: supervisorNome,
  }
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: sem erros neste arquivo. Erros em `components/aprovacoes/aprovacoes-list.tsx` são esperados (será reescrito no próximo task) — ignorar por enquanto.

- [ ] **Step 3: Commit**

```bash
git add app/(admin)/aprovacoes/actions.ts
git commit -m "feat: reescrever admin aprovacoes actions com alteracao_salario"
```

---

## Task 4: Admin Page + AprovacoesList Component

**Files:**
- Rewrite: `app/(admin)/aprovacoes/page.tsx`
- Rewrite: `components/aprovacoes/aprovacoes-list.tsx`

- [ ] **Step 1: Reescrever `app/(admin)/aprovacoes/page.tsx`**

```tsx
import { buscarSolicitacoes, buscarSupervisores } from './actions'
import { AprovacoesList } from '@/components/aprovacoes/aprovacoes-list'

export default async function AprovacoesPage() {
  const [solicitacoes, supervisores] = await Promise.all([
    buscarSolicitacoes(),
    buscarSupervisores(),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-slate-900">Aprovações</h1>
        <p className="text-xs uppercase tracking-widest text-slate-500">
          Solicitações de movimentação de colaboradores
        </p>
      </div>
      <AprovacoesList solicitacoes={solicitacoes} supervisores={supervisores} />
    </div>
  )
}
```

- [ ] **Step 2: Reescrever `components/aprovacoes/aprovacoes-list.tsx` completamente**

```tsx
'use client'

import { useState, useTransition, useMemo } from 'react'
import { cn } from '@/lib/utils'
import {
  aprovarSolicitacao,
  rejeitarSolicitacao,
  buscarDadosFuncionarioParaPDF,
} from '@/app/(admin)/aprovacoes/actions'
import type { SolicitacaoCompleta } from '@/app/(admin)/aprovacoes/actions'

// ── helpers ────────────────────────────────────────────────────────────────────

function fmt(iso: string | null): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('T')[0].split('-')
  return `${d}/${m}/${y}`
}

function fmtBRL(v: unknown): string {
  if (v == null || v === '') return '—'
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtInsalubridade(v: unknown): string {
  if (v == null || Number(v) === 0) return 'Não'
  return `${Number(v)}%`
}

// ── badge configs ─────────────────────────────────────────────────────────────

const TIPO_BADGE: Record<string, { label: string; cls: string }> = {
  transferencia:     { label: 'Transferência',     cls: 'bg-blue-100 text-blue-700'    },
  mudanca_funcao:    { label: 'Mudança de Função', cls: 'bg-purple-100 text-purple-700'},
  promocao:          { label: 'Promoção',           cls: 'bg-green-100 text-green-700'  },
  desligamento:      { label: 'Desligamento',       cls: 'bg-red-100 text-red-700'      },
  alteracao_salario: { label: 'Alt. Salário',       cls: 'bg-amber-100 text-amber-700'  },
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  pendente:  { label: 'Pendente',  cls: 'bg-yellow-100 text-yellow-700' },
  aprovada:  { label: 'Aprovado',  cls: 'bg-green-100 text-green-700'   },
  rejeitada: { label: 'Rejeitado', cls: 'bg-red-100 text-red-700'       },
}

const TIPOS_PDF = new Set(['transferencia', 'mudanca_funcao', 'promocao'])

// ── KpiCard ───────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  borderColor,
}: {
  label: string
  value: number
  borderColor: string
}) {
  return (
    <div className={cn('rounded-xl bg-white shadow-sm border-t-4 p-4', borderColor)}>
      <p className="text-xs uppercase tracking-widest text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
    </div>
  )
}

// ── SolicitacaoCard ───────────────────────────────────────────────────────────

function SolicitacaoCard({ sol }: { sol: SolicitacaoCompleta }) {
  const [isPending, startTransition] = useTransition()
  const [rejeitando, setRejeitando]     = useState(false)
  const [motivoRej, setMotivoRej]       = useState('')
  const [downloadingPDF, setDownloadingPDF] = useState(false)

  const tipoBadge   = TIPO_BADGE[sol.tipo]   ?? { label: sol.tipo,   cls: 'bg-gray-100 text-gray-700' }
  const statusBadge = STATUS_BADGE[sol.status] ?? { label: sol.status, cls: 'bg-gray-100 text-gray-700' }
  const isPendente  = sol.status === 'pendente'
  const hasPDF      = sol.status === 'aprovada' && TIPOS_PDF.has(sol.tipo)

  const antes  = (sol.dados_antes  ?? {}) as Record<string, unknown>
  const depois = (sol.dados_depois ?? {}) as Record<string, unknown>

  function handleAprovar() {
    startTransition(async () => { await aprovarSolicitacao(sol.id) })
  }

  function handleRejeitar() {
    if (!motivoRej.trim()) return
    startTransition(async () => {
      await rejeitarSolicitacao(sol.id, motivoRej)
      setRejeitando(false)
      setMotivoRej('')
    })
  }

  async function handleDownloadPDF() {
    if (!sol.funcionario) return
    setDownloadingPDF(true)
    try {
      const dados = await buscarDadosFuncionarioParaPDF(sol.funcionario.id)
      if (!dados) return

      const [{ pdf }, { MovimentacaoPDF }] = await Promise.all([
        import('@react-pdf/renderer'),
        import('@/components/aprovacoes/movimentacao-pdf'),
      ])

      const pdfData = {
        tipo: sol.tipo as 'transferencia' | 'mudanca_funcao' | 'promocao',
        vigencia: sol.vigencia ?? sol.created_at ?? '',
        funcionario_nome: sol.funcionario.nome,
        supervisor_nome: dados.supervisor_nome ?? sol.solicitante?.nome ?? '',
        secretaria_atual: dados.posto_atual?.secretaria ?? '',
        posto_atual_nome: String(antes.posto_nome ?? dados.posto_atual?.nome ?? ''),
        funcao_atual_nome: String(antes.funcao_nome ?? dados.funcao_atual?.nome ?? ''),
        salario_atual: dados.funcionario.salario ?? (antes.salario as number | null) ?? null,
        insalubridade_atual: dados.funcao_atual?.insalubridade_perc ?? (antes.insalubridade_perc as number | null) ?? null,
        posto_proposto_nome: depois.posto_destino_nome as string | null ?? null,
        funcao_proposta_nome: depois.funcao_destino_nome as string | null ?? null,
        salario_proposto: depois.salario_proposto as number | null ?? null,
        insalubridade_proposta: depois.insalubridade_perc as number | null ?? null,
      }

      const blob = await pdf(<MovimentacaoPDF dados={pdfData} />).toBlob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      const slug = sol.funcionario.nome.toUpperCase().replace(/\s+/g, '_')
      const dt   = new Date().toISOString().split('T')[0]
      a.href     = url
      a.download = `Movimentacao_${slug}_${dt}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setDownloadingPDF(false)
    }
  }

  return (
    <div className={cn(
      'rounded-xl bg-white shadow-sm border border-slate-100 p-5 transition-opacity',
      !isPendente && 'opacity-60',
    )}>
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex flex-wrap gap-2">
          <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold', tipoBadge.cls)}>
            {tipoBadge.label}
          </span>
          <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold', statusBadge.cls)}>
            {statusBadge.label}
          </span>
        </div>
        <span className="text-xs text-slate-400 shrink-0">{fmt(sol.created_at)}</span>
      </div>

      <p className="font-bold text-slate-900">{sol.funcionario?.nome ?? '—'}</p>
      <p className="text-xs text-slate-500 mb-3">
        Supervisor: {sol.solicitante?.nome ?? sol.solicitante?.email ?? '—'}
        {antes.secretaria_nome ? ` · Secretaria: ${String(antes.secretaria_nome)}` : ''}
      </p>

      {/* Situação atual | proposta */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        {[
          { label: 'Situação Atual',    bg: 'bg-slate-50',  d: antes  },
          { label: 'Situação Proposta', bg: 'bg-green-50',  d: depois },
        ].map(({ label, bg, d }) => (
          <div key={label} className={cn('rounded-lg p-3 text-xs space-y-1', bg)}>
            <p className="uppercase tracking-widest text-slate-400 font-semibold mb-1">{label}</p>
            {(d.posto_nome || d.posto_destino_nome) && (
              <p>
                <span className="text-slate-500">Posto:</span>{' '}
                {String(d.posto_nome ?? d.posto_destino_nome ?? '')}
              </p>
            )}
            {(d.funcao_nome || d.funcao_destino_nome) && (
              <p>
                <span className="text-slate-500">Função:</span>{' '}
                {String(d.funcao_nome ?? d.funcao_destino_nome ?? '')}
              </p>
            )}
            {(d.salario != null || d.salario_proposto != null) && (
              <p>
                <span className="text-slate-500">Salário:</span>{' '}
                {fmtBRL(d.salario ?? d.salario_proposto)}
              </p>
            )}
            {(d.insalubridade_perc != null) && (
              <p>
                <span className="text-slate-500">Insalubridade:</span>{' '}
                {fmtInsalubridade(d.insalubridade_perc)}
              </p>
            )}
            {d.motivo_desligamento && (
              <p>
                <span className="text-slate-500">Motivo:</span>{' '}
                {String(d.motivo_desligamento).replace(/_/g, ' ')}
              </p>
            )}
          </div>
        ))}
      </div>

      {sol.vigencia && (
        <p className="text-xs text-slate-600 mb-1">
          <span className="font-medium">Vigência:</span> {fmt(sol.vigencia)}
        </p>
      )}
      {sol.motivo && (
        <p className="text-xs text-slate-600 mb-3">
          <span className="font-medium">Motivo:</span> {sol.motivo}
        </p>
      )}
      {sol.motivo_rejeicao && (
        <p className="text-xs text-red-600 mb-3">
          <span className="font-medium">Motivo da rejeição:</span> {sol.motivo_rejeicao}
        </p>
      )}

      {/* Ações pendente */}
      {isPendente && !rejeitando && (
        <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-100">
          <button
            onClick={() => setRejeitando(true)}
            disabled={isPending}
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-red-700 hover:bg-red-100 disabled:opacity-50 transition-colors"
          >
            Rejeitar
          </button>
          <button
            onClick={handleAprovar}
            disabled={isPending}
            className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-white hover:bg-slate-700 disabled:opacity-50 transition-colors"
          >
            {isPending ? 'Processando...' : 'Aprovar'}
          </button>
        </div>
      )}

      {isPendente && rejeitando && (
        <div className="space-y-2 pt-3 border-t border-slate-100">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            Motivo da rejeição (obrigatório)
          </p>
          <textarea
            value={motivoRej}
            onChange={e => setMotivoRej(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
            placeholder="Informe o motivo..."
          />
          <div className="flex gap-2">
            <button
              onClick={() => { setRejeitando(false); setMotivoRej('') }}
              className="rounded-lg px-4 py-2 text-xs font-semibold uppercase tracking-widest text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleRejeitar}
              disabled={!motivoRej.trim() || isPending}
              className="rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {isPending ? 'Processando...' : 'Confirmar Rejeição'}
            </button>
          </div>
        </div>
      )}

      {/* Botão PDF — visível apenas após aprovação dos tipos que geram documento */}
      {hasPDF && (
        <div className="pt-3 border-t border-slate-100">
          <button
            onClick={handleDownloadPDF}
            disabled={downloadingPDF}
            className="rounded-lg bg-amber-500 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-slate-900 hover:bg-amber-400 disabled:opacity-50 transition-colors"
          >
            {downloadingPDF ? 'Gerando PDF...' : 'PDF Movimentação'}
          </button>
        </div>
      )}
    </div>
  )
}

// ── AprovacoesList ─────────────────────────────────────────────────────────────

export function AprovacoesList({
  solicitacoes,
  supervisores,
}: {
  solicitacoes: SolicitacaoCompleta[]
  supervisores: Array<{ id: string; nome: string | null; email: string | null }>
}) {
  const [q, setQ]                         = useState('')
  const [filtroTipo, setFiltroTipo]       = useState('')
  const [filtroStatus, setFiltroStatus]   = useState('')
  const [filtroSup, setFiltroSup]         = useState('')

  const now      = new Date()
  const mesAtual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const kpis = useMemo(() => ({
    pendentes:   solicitacoes.filter(s => s.status === 'pendente').length,
    aprovadas:   solicitacoes.filter(s => s.status === 'aprovada'  && s.aprovado_em?.startsWith(mesAtual)).length,
    rejeitadas:  solicitacoes.filter(s => s.status === 'rejeitada' && s.aprovado_em?.startsWith(mesAtual)).length,
    totalMes:    solicitacoes.filter(s => s.created_at?.startsWith(mesAtual)).length,
  }), [solicitacoes, mesAtual])

  const filtradas = useMemo(() =>
    solicitacoes.filter(s => {
      if (q           && !s.funcionario?.nome.toLowerCase().includes(q.toLowerCase())) return false
      if (filtroTipo  && s.tipo !== filtroTipo)           return false
      if (filtroStatus && s.status !== filtroStatus)      return false
      if (filtroSup   && s.solicitante?.id !== filtroSup) return false
      return true
    }),
    [solicitacoes, q, filtroTipo, filtroStatus, filtroSup],
  )

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Pendentes"        value={kpis.pendentes}  borderColor="border-amber-400" />
        <KpiCard label="Aprovadas no mês" value={kpis.aprovadas}  borderColor="border-green-400" />
        <KpiCard label="Rejeitadas no mês" value={kpis.rejeitadas} borderColor="border-red-400"   />
        <KpiCard label="Total do mês"     value={kpis.totalMes}   borderColor="border-slate-400" />
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Buscar funcionário..."
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 min-w-44"
        />
        <select
          value={filtroTipo}
          onChange={e => setFiltroTipo(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
        >
          <option value="">Todos os tipos</option>
          <option value="transferencia">Transferência</option>
          <option value="mudanca_funcao">Mudança de função</option>
          <option value="promocao">Promoção</option>
          <option value="desligamento">Desligamento</option>
          <option value="alteracao_salario">Alteração de salário</option>
        </select>
        <select
          value={filtroStatus}
          onChange={e => setFiltroStatus(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
        >
          <option value="">Todos os status</option>
          <option value="pendente">Pendente</option>
          <option value="aprovada">Aprovado</option>
          <option value="rejeitada">Rejeitado</option>
        </select>
        <select
          value={filtroSup}
          onChange={e => setFiltroSup(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
        >
          <option value="">Todos os supervisores</option>
          {supervisores.map(s => (
            <option key={s.id} value={s.id}>{s.nome ?? s.email}</option>
          ))}
        </select>
      </div>

      {/* Lista */}
      {filtradas.length === 0 ? (
        <div className="rounded-xl bg-white border border-slate-100 px-6 py-12 text-center shadow-sm">
          <p className="text-sm text-slate-400">Nenhuma solicitação encontrada.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtradas.map(sol => (
            <SolicitacaoCard key={sol.id} sol={sol} />
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: erros apenas em `movimentacao-pdf.tsx` (ainda não existe) — esse erro específico é aceitável agora e será resolvido no Task 5.

- [ ] **Step 4: Commit**

```bash
git add app/(admin)/aprovacoes/page.tsx components/aprovacoes/aprovacoes-list.tsx
git commit -m "feat: admin aprovacoes page e list com KPIs, filtros e cards completos"
```

---

## Task 5: PDF de Movimentação

**Files:**
- Create: `components/aprovacoes/movimentacao-pdf.tsx`

- [ ] **Step 1: Criar `components/aprovacoes/movimentacao-pdf.tsx`**

```tsx
'use client'

import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

// ── tipos ─────────────────────────────────────────────────────────────────────

export type DadosMovimentacaoPDF = {
  tipo: 'transferencia' | 'mudanca_funcao' | 'promocao'
  vigencia: string
  funcionario_nome: string
  supervisor_nome: string
  secretaria_atual: string
  posto_atual_nome: string
  funcao_atual_nome: string
  salario_atual: number | null
  insalubridade_atual: number | null
  posto_proposto_nome: string | null
  funcao_proposta_nome: string | null
  salario_proposto: number | null
  insalubridade_proposta: number | null
}

// ── helpers ───────────────────────────────────────────────────────────────────

function fmtBRL(v: number | null): string {
  if (v == null) return '—'
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
}

function fmtData(iso: string): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('T')[0].split('-')
  return `${d}/${m}/${y}`
}

const TIPO_LABELS: Record<DadosMovimentacaoPDF['tipo'], string> = {
  transferencia:  'Transferência',
  mudanca_funcao: 'Mudança de função',
  promocao:       'Promoção',
}

// ── estilos ───────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 8,
    padding: 24,
    backgroundColor: '#fff',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  logo: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#0f172a' },
  titulo: { fontSize: 11, fontFamily: 'Helvetica-Bold', textAlign: 'center', flex: 1 },
  vigencia: { fontSize: 8, color: '#64748b', textAlign: 'right' },
  checkboxRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 10,
    borderBottom: '1px solid #e2e8f0',
    paddingBottom: 6,
  },
  checkboxItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  checkbox: {
    width: 10,
    height: 10,
    border: '1px solid #334155',
    borderRadius: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: '#0f172a' },
  checkboxX: { color: '#fff', fontSize: 7, fontFamily: 'Helvetica-Bold' },
  columnsContainer: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  column: { flex: 1, border: '1px solid #e2e8f0', borderRadius: 4, padding: 8 },
  columnHeader: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
    borderBottom: '1px solid #e2e8f0',
    paddingBottom: 4,
  },
  row: { flexDirection: 'row', marginBottom: 4 },
  rowLabel: { color: '#64748b', width: 80 },
  rowValue: { flex: 1, color: '#0f172a' },
  highlightRow: {
    backgroundColor: '#fef08a',
    borderRadius: 2,
    padding: 3,
    marginBottom: 6,
  },
  highlightText: { fontFamily: 'Helvetica-Bold', fontSize: 9, color: '#0f172a' },
  beneficiosLabel: { color: '#64748b', marginBottom: 3 },
  beneficiosRow: { flexDirection: 'row', gap: 10, marginBottom: 6 },
  obsLine: { borderBottom: '1px solid #cbd5e1', height: 16, marginBottom: 4 },
  footer: {
    flexDirection: 'row',
    borderTop: '1px solid #e2e8f0',
    paddingTop: 8,
    marginTop: 8,
  },
  footerItem: { flex: 1, alignItems: 'center' },
  footerLabel: { fontSize: 7, color: '#64748b', marginBottom: 16 },
  footerLine: { width: '80%', borderBottom: '1px solid #0f172a' },
})

// ── subcomponentes ────────────────────────────────────────────────────────────

function Checkbox({ checked }: { checked: boolean }) {
  return (
    <View style={[S.checkbox, checked ? S.checkboxChecked : {}]}>
      {checked && <Text style={S.checkboxX}>X</Text>}
    </View>
  )
}

function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={S.row}>
      <Text style={S.rowLabel}>{label}</Text>
      <Text style={S.rowValue}>{value}</Text>
    </View>
  )
}

function ColunaSituacao({
  title,
  supervisorNome,
  postoNome,
  funcaoNome,
  salario,
  insalubridade,
}: {
  title: string
  supervisorNome: string
  postoNome: string
  funcaoNome: string
  salario: number | null
  insalubridade: number | null
}) {
  const insalubNao = insalubridade == null || insalubridade === 0
  const insalub20  = insalubridade === 20
  const insalub40  = insalubridade === 40

  return (
    <View style={S.column}>
      <Text style={S.columnHeader}>{title}</Text>

      <FieldRow label="Contrato:" value="MOGI LIMPEZA - 706" />
      <FieldRow label="Supervisor:" value={supervisorNome || '—'} />

      <View style={S.highlightRow}>
        <Text style={S.highlightText}>{postoNome || '—'}</Text>
      </View>

      <FieldRow label="Função:" value={funcaoNome || '—'} />
      <FieldRow label="Salário:" value={fmtBRL(salario)} />
      <FieldRow label="Local:" value={postoNome || '—'} />

      <View style={[S.row, { marginTop: 4 }]}>
        <Text style={S.rowLabel}>Insalubridade:</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={S.checkboxItem}>
            <Checkbox checked={insalubNao} />
            <Text>Não</Text>
          </View>
          <View style={S.checkboxItem}>
            <Checkbox checked={insalub20} />
            <Text>20%</Text>
          </View>
          <View style={S.checkboxItem}>
            <Checkbox checked={insalub40} />
            <Text>40%</Text>
          </View>
        </View>
      </View>

      <View style={{ marginTop: 6 }}>
        <Text style={S.beneficiosLabel}>Benefícios:</Text>
        <View style={S.beneficiosRow}>
          {['VT', 'VR', 'VA', 'Prêmio', 'Sindicato'].map(b => (
            <View key={b} style={S.checkboxItem}>
              <Checkbox checked={false} />
              <Text>{b}</Text>
            </View>
          ))}
        </View>
      </View>

      <View>
        <Text style={S.beneficiosLabel}>Observações:</Text>
        <View style={S.obsLine} />
        <View style={S.obsLine} />
      </View>
    </View>
  )
}

// ── componente principal ──────────────────────────────────────────────────────

export function MovimentacaoPDF({ dados }: { dados: DadosMovimentacaoPDF }) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={S.page}>
        {/* Cabeçalho */}
        <View style={S.headerRow}>
          <Text style={S.logo}>DEMAX</Text>
          <Text style={S.titulo}>MOVIMENTAÇÃO DE COLABORADOR</Text>
          <View>
            <Text style={S.vigencia}>Vigência: {fmtData(dados.vigencia)}</Text>
          </View>
        </View>

        {/* Linha de checkboxes de tipo */}
        <View style={S.checkboxRow}>
          {(['transferencia', 'mudanca_funcao', 'promocao'] as const).map(t => (
            <View key={t} style={S.checkboxItem}>
              <Checkbox checked={dados.tipo === t} />
              <Text>{TIPO_LABELS[t]}</Text>
            </View>
          ))}
          <View style={{ flex: 1 }} />
          <Text style={{ color: '#64748b' }}>Funcionário: {dados.funcionario_nome}</Text>
        </View>

        {/* Duas colunas */}
        <View style={S.columnsContainer}>
          <ColunaSituacao
            title="SITUAÇÃO ATUAL"
            supervisorNome={dados.supervisor_nome}
            postoNome={dados.posto_atual_nome}
            funcaoNome={dados.funcao_atual_nome}
            salario={dados.salario_atual}
            insalubridade={dados.insalubridade_atual}
          />
          <ColunaSituacao
            title="SITUAÇÃO PROPOSTA"
            supervisorNome={dados.supervisor_nome}
            postoNome={dados.posto_proposto_nome ?? ''}
            funcaoNome={dados.funcao_proposta_nome ?? ''}
            salario={dados.salario_proposto}
            insalubridade={dados.insalubridade_proposta}
          />
        </View>

        {/* Rodapé assinaturas */}
        <View style={S.footer}>
          {['Data', 'Coord./Sup.', 'Seg. do Trabalho', 'Ger. Operacional', 'Coord. RH'].map(label => (
            <View key={label} style={S.footerItem}>
              <View style={S.footerLine} />
              <Text style={[S.footerLabel, { marginTop: 3 }]}>{label}</Text>
            </View>
          ))}
        </View>
      </Page>
    </Document>
  )
}
```

- [ ] **Step 2: Verificar build completo do módulo admin**

```bash
npx tsc --noEmit
```

Esperado: sem erros nos arquivos de aprovações.

- [ ] **Step 3: Commit**

```bash
git add components/aprovacoes/movimentacao-pdf.tsx
git commit -m "feat: componente PDF movimentacao de colaborador"
```

---

## Task 6: Supervisor Server Actions

**Files:**
- Create: `app/supervisor/solicitacoes/actions.ts`

- [ ] **Step 1: Criar o diretório e o arquivo**

```bash
# PowerShell
New-Item -ItemType Directory -Force "app/supervisor/solicitacoes"
```

- [ ] **Step 2: Criar `app/supervisor/solicitacoes/actions.ts`**

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/auth/get-user'

// ── tipos exportados ──────────────────────────────────────────────────────────

export type MinhasSolicitacao = {
  id: string
  tipo: string
  status: string
  vigencia: string | null
  created_at: string | null
  motivo: string | null
  motivo_rejeicao: string | null
  funcionario: { id: string; nome: string } | null
}

export type FuncionarioDoSupervisor = {
  id: string
  nome: string
  funcao_id: string | null
  posto_id: string | null
  salario: number | null
  funcao: { id: string; nome: string; insalubridade_perc: number | null; salario_base: number | null } | null
  posto: { id: string; nome: string; secretaria: string | null } | null
}

export type PostoDisponivel = {
  id: string
  nome: string
  secretaria: string | null
}

export type FuncaoDisponivel = {
  id: string
  nome: string
  insalubridade_perc: number | null
  salario_base: number | null
}

// ── queries ───────────────────────────────────────────────────────────────────

export async function buscarMinhasSolicitacoes(supervisorId: string): Promise<MinhasSolicitacao[]> {
  const supabase = createClient()

  const { data } = await supabase
    .from('solicitacoes')
    .select(`
      id, tipo, status, vigencia, created_at, motivo, motivo_rejeicao,
      funcionarios!funcionario_id ( id, nome )
    `)
    .eq('supervisor_id', supervisorId)
    .order('created_at', { ascending: false })

  return (data ?? []).map(row => {
    const r = row as Record<string, unknown>
    return {
      id:              r.id as string,
      tipo:            r.tipo as string,
      status:          r.status as string,
      vigencia:        r.vigencia as string | null,
      created_at:      r.created_at as string | null,
      motivo:          r.motivo as string | null,
      motivo_rejeicao: r.motivo_rejeicao as string | null,
      funcionario:     r.funcionarios as { id: string; nome: string } | null,
    }
  })
}

export async function buscarFuncionariosDoSupervisor(supervisorId: string): Promise<FuncionarioDoSupervisor[]> {
  const supabase = createClient()

  const { data: csps } = await supabase
    .from('config_supervisores_postos')
    .select('posto_id')
    .eq('supervisor_id', supervisorId)
    .eq('ativo', true)

  if (!csps || csps.length === 0) return []

  const postoIds = csps.map(c => c.posto_id)

  const { data: funcionarios } = await supabase
    .from('funcionarios')
    .select(`
      id, nome, funcao_id, posto_id, salario,
      funcoes!funcao_id ( id, nome, insalubridade_perc, salario_base ),
      postos!posto_id ( id, nome, secretaria )
    `)
    .in('posto_id', postoIds)
    .eq('status', 'ativo')
    .order('nome')

  return (funcionarios ?? []).map(f => {
    const r = f as Record<string, unknown>
    return {
      id:       r.id as string,
      nome:     r.nome as string,
      funcao_id: r.funcao_id as string | null,
      posto_id:  r.posto_id as string | null,
      salario:   r.salario as number | null,
      funcao:    r.funcoes as FuncionarioDoSupervisor['funcao'],
      posto:     r.postos  as FuncionarioDoSupervisor['posto'],
    }
  })
}

export async function buscarPostosDisponiveis(): Promise<PostoDisponivel[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('postos')
    .select('id, nome, secretaria')
    .eq('ativo', true)
    .order('nome')
  return (data ?? []) as PostoDisponivel[]
}

export async function buscarFuncoesDisponiveis(): Promise<FuncaoDisponivel[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('funcoes')
    .select('id, nome, insalubridade_perc, salario_base')
    .eq('ativo', true)
    .order('nome')
  return (data ?? []) as FuncaoDisponivel[]
}

// ── mutation ──────────────────────────────────────────────────────────────────

export async function criarSolicitacao(input: {
  funcionario_id: string
  tipo: string
  vigencia: string
  motivo: string
  dados_antes: Record<string, unknown>
  dados_depois: Record<string, unknown>
}): Promise<void> {
  const supabase = createClient()
  const auth = await getUser()
  if (!auth) throw new Error('Não autenticado')
  if (auth.perfil.role !== 'supervisor') throw new Error('Acesso negado')

  await supabase.from('solicitacoes').insert({
    tipo:          input.tipo,
    funcionario_id: input.funcionario_id,
    supervisor_id: auth.user.id,
    vigencia:      input.vigencia,
    motivo:        input.motivo,
    dados_antes:   input.dados_antes,
    dados_depois:  input.dados_depois,
    status:        'pendente',
  })

  revalidatePath('/supervisor/solicitacoes')
}
```

- [ ] **Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: sem erros neste arquivo.

- [ ] **Step 4: Commit**

```bash
git add app/supervisor/solicitacoes/actions.ts
git commit -m "feat: supervisor solicitacoes server actions"
```

---

## Task 7: Modal Nova Solicitação (Supervisor)

**Files:**
- Create: `components/supervisor/modal-nova-solicitacao.tsx`

- [ ] **Step 1: Criar `components/supervisor/modal-nova-solicitacao.tsx`**

```tsx
'use client'

import { useState, useTransition, useEffect } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  criarSolicitacao,
  buscarFuncionariosDoSupervisor,
  buscarPostosDisponiveis,
  buscarFuncoesDisponiveis,
} from '@/app/supervisor/solicitacoes/actions'
import type {
  FuncionarioDoSupervisor,
  PostoDisponivel,
  FuncaoDisponivel,
} from '@/app/supervisor/solicitacoes/actions'

// ── tipos locais ──────────────────────────────────────────────────────────────

type Tipo =
  | 'transferencia'
  | 'mudanca_funcao'
  | 'promocao'
  | 'desligamento'
  | 'alteracao_salario'

const TIPOS: Array<{ value: Tipo; label: string }> = [
  { value: 'transferencia',     label: 'Transferência'       },
  { value: 'mudanca_funcao',    label: 'Mudança de Função'   },
  { value: 'promocao',          label: 'Promoção'            },
  { value: 'desligamento',      label: 'Desligamento'        },
  { value: 'alteracao_salario', label: 'Alteração de Salário'},
]

const MOTIVOS_DESLIGAMENTO = [
  { value: 'pedido_demissao',      label: 'Pedido de Demissão'        },
  { value: 'demissao_sem_justa',   label: 'Demissão sem Justa Causa'  },
  { value: 'demissao_justa',       label: 'Demissão por Justa Causa'  },
  { value: 'aposentadoria',        label: 'Aposentadoria'             },
  { value: 'outros',               label: 'Outros'                    },
]

// ── props ─────────────────────────────────────────────────────────────────────

type Props = {
  supervisorId: string
  onClose: () => void
  onSuccess: () => void
}

// ── componente ────────────────────────────────────────────────────────────────

export function ModalNovaSolicitacao({ supervisorId, onClose, onSuccess }: Props) {
  const [isPending, startTransition] = useTransition()

  // listas de opções (carregadas no mount)
  const [funcionarios, setFuncionarios] = useState<FuncionarioDoSupervisor[]>([])
  const [postos,       setPostos]       = useState<PostoDisponivel[]>([])
  const [funcoes,      setFuncoes]      = useState<FuncaoDisponivel[]>([])
  const [carregando,   setCarregando]   = useState(true)

  // campos do formulário
  const [busca,         setBusca]          = useState('')
  const [funcSelecionado, setFuncSelecionado] = useState<FuncionarioDoSupervisor | null>(null)
  const [tipo,          setTipo]           = useState<Tipo | ''>('')
  const [vigencia,      setVigencia]       = useState('')
  const [motivo,        setMotivo]         = useState('')
  const [erro,          setErro]           = useState('')

  // campos condicionais
  const [postoDestinoId,    setPostoDestinoId]    = useState('')
  const [funcaoDestinoId,   setFuncaoDestinoId]   = useState('')
  const [salarioProposto,   setSalarioProposto]   = useState('')
  const [motivoDesligamento, setMotivoDesligamento] = useState('')

  // carrega listas ao abrir
  useEffect(() => {
    Promise.all([
      buscarFuncionariosDoSupervisor(supervisorId),
      buscarPostosDisponiveis(),
      buscarFuncoesDisponiveis(),
    ]).then(([funcs, pts, fns]) => {
      setFuncionarios(funcs)
      setPostos(pts)
      setFuncoes(fns)
      setCarregando(false)
    })
  }, [supervisorId])

  // funcionários filtrados pelo campo de busca
  const funcsFiltrados = busca.length >= 2
    ? funcionarios.filter(f => f.nome.toLowerCase().includes(busca.toLowerCase()))
    : []

  // funcao selecionada no campo de função destino
  const funcaoDestinoObj = funcoes.find(f => f.id === funcaoDestinoId) ?? null

  function resetCamposCondicionais() {
    setPostoDestinoId('')
    setFuncaoDestinoId('')
    setSalarioProposto('')
    setMotivoDesligamento('')
  }

  function handleSalvar() {
    setErro('')

    if (!funcSelecionado)     { setErro('Selecione um funcionário.'); return }
    if (!tipo)                { setErro('Selecione o tipo de solicitação.'); return }
    if (!vigencia)            { setErro('Informe a data de vigência.'); return }
    if (!motivo.trim())       { setErro('Informe o motivo.'); return }

    if (tipo === 'transferencia'     && !postoDestinoId)     { setErro('Selecione o posto destino.'); return }
    if (tipo === 'mudanca_funcao'    && !funcaoDestinoId)    { setErro('Selecione a função proposta.'); return }
    if (tipo === 'promocao'          && !funcaoDestinoId)    { setErro('Selecione a função proposta.'); return }
    if (tipo === 'desligamento'      && !motivoDesligamento) { setErro('Selecione o motivo do desligamento.'); return }
    if (tipo === 'alteracao_salario' && !salarioProposto)    { setErro('Informe o salário proposto.'); return }

    const dadosAntes: Record<string, unknown> = {
      posto_id:           funcSelecionado.posto_id,
      posto_nome:         funcSelecionado.posto?.nome ?? null,
      funcao_id:          funcSelecionado.funcao_id,
      funcao_nome:        funcSelecionado.funcao?.nome ?? null,
      salario:            funcSelecionado.salario ?? funcSelecionado.funcao?.salario_base ?? null,
      insalubridade_perc: funcSelecionado.funcao?.insalubridade_perc ?? null,
      secretaria_nome:    funcSelecionado.posto?.secretaria ?? null,
    }

    const dadosDepois: Record<string, unknown> = {}
    const postoDestino = postos.find(p => p.id === postoDestinoId)

    switch (tipo) {
      case 'transferencia':
        dadosDepois.posto_destino_id   = postoDestinoId
        dadosDepois.posto_destino_nome = postoDestino?.nome ?? null
        break
      case 'mudanca_funcao':
        dadosDepois.funcao_destino_id   = funcaoDestinoId
        dadosDepois.funcao_destino_nome = funcaoDestinoObj?.nome ?? null
        dadosDepois.insalubridade_perc  = funcaoDestinoObj?.insalubridade_perc ?? null
        break
      case 'promocao':
        dadosDepois.funcao_destino_id   = funcaoDestinoId
        dadosDepois.funcao_destino_nome = funcaoDestinoObj?.nome ?? null
        dadosDepois.insalubridade_perc  = funcaoDestinoObj?.insalubridade_perc ?? null
        if (salarioProposto) dadosDepois.salario_proposto = parseFloat(salarioProposto)
        break
      case 'desligamento':
        dadosDepois.motivo_desligamento = motivoDesligamento
        break
      case 'alteracao_salario':
        dadosDepois.salario_proposto = parseFloat(salarioProposto)
        break
    }

    startTransition(async () => {
      try {
        await criarSolicitacao({
          funcionario_id: funcSelecionado.id,
          tipo,
          vigencia,
          motivo,
          dados_antes:  dadosAntes,
          dados_depois: dadosDepois,
        })
        onSuccess()
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'Erro ao salvar.')
      }
    })
  }

  const labelCls = 'block text-xs uppercase tracking-widest text-slate-500 mb-1'
  const inputCls = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-slate-900">
            Nova Solicitação
          </h2>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-slate-100">
            <X className="h-4 w-4 text-slate-500" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          {carregando ? (
            <p className="text-sm text-slate-400 text-center py-8">Carregando...</p>
          ) : (
            <>
              {/* Busca de funcionário */}
              <div>
                <label className={labelCls}>Funcionário</label>
                {funcSelecionado ? (
                  <div className="rounded-lg border border-slate-200 px-3 py-2 flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-900">{funcSelecionado.nome}</span>
                    <button
                      onClick={() => { setFuncSelecionado(null); setBusca('') }}
                      className="text-xs text-slate-400 hover:text-red-500"
                    >
                      Trocar
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      value={busca}
                      onChange={e => setBusca(e.target.value)}
                      placeholder="Digite o nome para buscar..."
                      className={inputCls}
                    />
                    {funcsFiltrados.length > 0 && (
                      <ul className="absolute z-10 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg max-h-48 overflow-y-auto">
                        {funcsFiltrados.map(f => (
                          <li key={f.id}>
                            <button
                              onClick={() => { setFuncSelecionado(f); setBusca('') }}
                              className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                            >
                              <p className="font-medium text-slate-900">{f.nome}</p>
                              <p className="text-xs text-slate-400">
                                {f.posto?.nome ?? '—'} · {f.funcao?.nome ?? '—'}
                              </p>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    {busca.length >= 2 && funcsFiltrados.length === 0 && (
                      <p className="mt-1 text-xs text-slate-400">Nenhum funcionário encontrado.</p>
                    )}
                  </div>
                )}
              </div>

              {/* Card situação atual */}
              {funcSelecionado && (
                <div className="rounded-lg bg-slate-50 p-3 text-xs space-y-1">
                  <p className="uppercase tracking-widest text-slate-400 font-semibold mb-1">
                    Situação Atual
                  </p>
                  <p><span className="text-slate-500">Posto:</span> {funcSelecionado.posto?.nome ?? '—'}</p>
                  <p><span className="text-slate-500">Função:</span> {funcSelecionado.funcao?.nome ?? '—'}</p>
                  <p>
                    <span className="text-slate-500">Salário:</span>{' '}
                    {(funcSelecionado.salario ?? funcSelecionado.funcao?.salario_base)
                      ? `R$ ${(funcSelecionado.salario ?? funcSelecionado.funcao?.salario_base)!.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                      : '—'
                    }
                  </p>
                  {funcSelecionado.funcao?.insalubridade_perc != null && funcSelecionado.funcao.insalubridade_perc > 0 && (
                    <p><span className="text-slate-500">Insalubridade:</span> {funcSelecionado.funcao.insalubridade_perc}%</p>
                  )}
                </div>
              )}

              {/* Tipo */}
              <div>
                <label className={labelCls}>Tipo de solicitação</label>
                <select
                  value={tipo}
                  onChange={e => { setTipo(e.target.value as Tipo | ''); resetCamposCondicionais() }}
                  className={inputCls}
                >
                  <option value="">Selecione...</option>
                  {TIPOS.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              {/* Campos condicionais */}
              {tipo === 'transferencia' && (
                <div>
                  <label className={labelCls}>Posto destino</label>
                  <select value={postoDestinoId} onChange={e => setPostoDestinoId(e.target.value)} className={inputCls}>
                    <option value="">Selecione o posto...</option>
                    {postos.map(p => (
                      <option key={p.id} value={p.id}>{p.nome}{p.secretaria ? ` — ${p.secretaria}` : ''}</option>
                    ))}
                  </select>
                </div>
              )}

              {(tipo === 'mudanca_funcao' || tipo === 'promocao') && (
                <div>
                  <label className={labelCls}>Função proposta</label>
                  <select value={funcaoDestinoId} onChange={e => setFuncaoDestinoId(e.target.value)} className={inputCls}>
                    <option value="">Selecione a função...</option>
                    {funcoes.map(f => (
                      <option key={f.id} value={f.id}>{f.nome}</option>
                    ))}
                  </select>
                  {funcaoDestinoObj?.insalubridade_perc != null && funcaoDestinoObj.insalubridade_perc > 0 && (
                    <p className="mt-1 text-xs text-amber-600">
                      Insalubridade: {funcaoDestinoObj.insalubridade_perc}%
                    </p>
                  )}
                </div>
              )}

              {tipo === 'promocao' && (
                <div>
                  <label className={labelCls}>Salário proposto (opcional)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={salarioProposto}
                    onChange={e => setSalarioProposto(e.target.value)}
                    placeholder="0,00"
                    className={inputCls}
                  />
                </div>
              )}

              {tipo === 'desligamento' && (
                <div>
                  <label className={labelCls}>Motivo do desligamento</label>
                  <select
                    value={motivoDesligamento}
                    onChange={e => setMotivoDesligamento(e.target.value)}
                    className={inputCls}
                  >
                    <option value="">Selecione...</option>
                    {MOTIVOS_DESLIGAMENTO.map(m => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>
              )}

              {tipo === 'alteracao_salario' && (
                <div>
                  <label className={labelCls}>Salário proposto</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={salarioProposto}
                    onChange={e => setSalarioProposto(e.target.value)}
                    placeholder="0,00"
                    className={cn(inputCls, !salarioProposto && tipo === 'alteracao_salario' && 'border-red-200')}
                  />
                </div>
              )}

              {/* Vigência */}
              <div>
                <label className={labelCls}>Vigência</label>
                <input
                  type="date"
                  value={vigencia}
                  onChange={e => setVigencia(e.target.value)}
                  className={inputCls}
                />
              </div>

              {/* Motivo */}
              <div>
                <label className={labelCls}>Motivo</label>
                <textarea
                  value={motivo}
                  onChange={e => setMotivo(e.target.value)}
                  rows={3}
                  className={inputCls}
                  placeholder="Descreva o motivo da solicitação..."
                />
              </div>

              {erro && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{erro}</p>
              )}
            </>
          )}
        </div>

        {/* Rodapé */}
        {!carregando && (
          <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">
            <button
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-xs font-semibold uppercase tracking-widest text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSalvar}
              disabled={isPending}
              className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-white hover:bg-slate-700 disabled:opacity-50 transition-colors"
            >
              {isPending ? 'Salvando...' : 'Enviar solicitação'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: sem erros neste arquivo.

- [ ] **Step 3: Commit**

```bash
git add components/supervisor/modal-nova-solicitacao.tsx
git commit -m "feat: modal nova solicitacao supervisor com campos condicionais"
```

---

## Task 8: Supervisor Page + Nav

**Files:**
- Create: `app/supervisor/solicitacoes/page.tsx`
- Modify: `components/supervisor/supervisor-nav.tsx`

- [ ] **Step 1: Criar `app/supervisor/solicitacoes/page.tsx`**

```tsx
import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth/get-user'
import { buscarMinhasSolicitacoes } from './actions'
import { SolicitacoesClient } from './solicitacoes-client'

export default async function SolicitacoesPage() {
  const auth = await getUser()
  if (!auth) redirect('/login')

  const solicitacoes = await buscarMinhasSolicitacoes(auth.user.id)

  return (
    <SolicitacoesClient
      solicitacoes={solicitacoes}
      supervisorId={auth.user.id}
    />
  )
}
```

- [ ] **Step 2: Criar `app/supervisor/solicitacoes/solicitacoes-client.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ModalNovaSolicitacao } from '@/components/supervisor/modal-nova-solicitacao'
import type { MinhasSolicitacao } from './actions'

type Props = {
  solicitacoes: MinhasSolicitacao[]
  supervisorId: string
}

const TIPO_LABELS: Record<string, string> = {
  transferencia:     'Transferência',
  mudanca_funcao:    'Mudança de Função',
  promocao:          'Promoção',
  desligamento:      'Desligamento',
  alteracao_salario: 'Alt. Salário',
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  pendente:  { label: 'Aguardando aprovação', cls: 'bg-yellow-100 text-yellow-700' },
  aprovada:  { label: 'Aprovado',             cls: 'bg-green-100 text-green-700'   },
  rejeitada: { label: 'Rejeitado',            cls: 'bg-red-100 text-red-700'       },
}

function fmt(iso: string | null): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('T')[0].split('-')
  return `${d}/${m}/${y}`
}

export function SolicitacoesClient({ solicitacoes: inicial, supervisorId }: Props) {
  const [modalAberto, setModalAberto] = useState(false)
  // Ao criar nova solicitação com sucesso, o revalidatePath vai recarregar o server component.
  // O modal fecha e a página refresca automaticamente via Next.js.

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-900">Minhas Solicitações</h1>
          <p className="text-xs uppercase tracking-widest text-slate-500">
            Solicitações enviadas para aprovação
          </p>
        </div>
        <button
          onClick={() => setModalAberto(true)}
          className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-white hover:bg-slate-700 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Nova Solicitação
        </button>
      </div>

      {inicial.length === 0 ? (
        <div className="rounded-xl bg-white border border-slate-100 px-6 py-12 text-center shadow-sm">
          <p className="text-sm text-slate-400">Nenhuma solicitação enviada ainda.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                {['Funcionário', 'Tipo', 'Status', 'Vigência', 'Data'].map(h => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-slate-500"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {inicial.map(s => {
                const badge = STATUS_BADGE[s.status] ?? { label: s.status, cls: 'bg-gray-100 text-gray-700' }
                return (
                  <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {s.funcionario?.nome ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {TIPO_LABELS[s.tipo] ?? s.tipo}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold', badge.cls)}>
                        {badge.label}
                      </span>
                      {s.status === 'rejeitada' && s.motivo_rejeicao && (
                        <p className="mt-0.5 text-xs text-red-600 max-w-xs truncate">
                          {s.motivo_rejeicao}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{fmt(s.vigencia)}</td>
                    <td className="px-4 py-3 text-slate-500">{fmt(s.created_at)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {modalAberto && (
        <ModalNovaSolicitacao
          supervisorId={supervisorId}
          onClose={() => setModalAberto(false)}
          onSuccess={() => setModalAberto(false)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 3: Atualizar `components/supervisor/supervisor-nav.tsx`**

Substituir o array `TABS`:

```ts
const TABS = [
  { href: '/supervisor/meu-posto',    label: 'Meu Posto'    },
  { href: '/supervisor/coberturas',   label: 'Coberturas'   },
  { href: '/supervisor/ocorrencias',  label: 'Ocorrências'  },
  { href: '/supervisor/solicitacoes', label: 'Solicitações' },
]
```

- [ ] **Step 4: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Step 5: Commit**

```bash
git add app/supervisor/solicitacoes/ components/supervisor/supervisor-nav.tsx
git commit -m "feat: painel supervisor solicitacoes com listagem e modal"
```

---

## Task 9: Build Final + Correção de Erros

**Files:** quaisquer com erros TypeScript

- [ ] **Step 1: Rodar build completo**

```bash
npm run build
```

Anotar todos os erros TypeScript. Se não houver erros: ir direto ao Step 3.

- [ ] **Step 2: Corrigir cada erro TypeScript**

Erros comuns esperados:

**`components/aprovacoes/aprovacoes-list.tsx` — import de `MovimentacaoPDF`**
Se o TypeScript reclamar que o módulo não tem `MovimentacaoPDF`, verificar se o export nomeado está correto em `movimentacao-pdf.tsx`. O arquivo deve ter `export function MovimentacaoPDF(...)`.

**`app/(admin)/aprovacoes/actions.ts` — `func?.salario` não existe no tipo**
Isso ocorre se o Task 2 não foi executado. Confirmar que `types/database.ts` tem `salario` em `funcionarios.Row`.

**`solicitacoes.vigencia` como campo desconhecido no insert**
Confirmar que `types/database.ts` `solicitacoes.Insert` inclui `vigencia?: string | null`.

Após cada correção, rodar `npx tsc --noEmit` para confirmar.

- [ ] **Step 3: Build deve passar sem erros**

```bash
npm run build
```

Esperado: `✓ Compiled successfully` sem erros de tipo.

- [ ] **Step 4: Commit final**

```bash
git add -A
git commit -m "fix: erros TypeScript pos-build do modulo aprovacoes e solicitacoes"
```

---

## Checklist de Cobertura do Spec

| Requisito | Task |
|---|---|
| Migração: `funcionarios.salario` | Task 1 |
| Migração: `solicitacoes.vigencia` + `motivo_rejeicao` | Task 1 |
| Migração: CHECK constraint atualizado | Task 1 |
| Tipos TS atualizados | Task 2 |
| Admin actions: `buscarSolicitacoes`, `aprovarSolicitacao`, `rejeitarSolicitacao`, `buscarDadosFuncionarioParaPDF`, `buscarSupervisores` | Task 3 |
| Admin page: 4 KPI cards | Task 4 |
| Admin page: 4 filtros client-side | Task 4 |
| Admin page: cards dois-colunas com situação atual/proposta | Task 4 |
| Admin page: botão PDF disponível pós-aprovação (tipos corretos) | Task 4 + 5 |
| Admin page: modal rejeição inline com motivo obrigatório | Task 4 |
| Admin page: cards aprovados/rejeitados com opacity-60 sem botões | Task 4 |
| PDF A4 landscape com cabeçalho, checkboxes de tipo, dois colunas, rodapé assinaturas | Task 5 |
| Supervisor actions: `buscarMinhasSolicitacoes`, `criarSolicitacao`, `buscarFuncionariosDoSupervisor`, `buscarPostosDisponiveis`, `buscarFuncoesDisponiveis` | Task 6 |
| Supervisor modal: autocomplete de funcionários (apenas do supervisor) | Task 7 |
| Supervisor modal: card situação atual após seleção | Task 7 |
| Supervisor modal: campos condicionais por tipo | Task 7 |
| Supervisor modal: snapshot `dados_antes` automático | Task 7 |
| Supervisor page: listagem próprias solicitações + badge motivo rejeição | Task 8 |
| Supervisor nav: tab "Solicitações" | Task 8 |
| Build sem erros TypeScript | Task 9 |
