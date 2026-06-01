# Reforma Demax Gestão Operacional — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduzir fluxo de solicitação + aprovação para operações estruturais (desligamento, transferência, mudança de função, promoção), adicionar rastreabilidade via `movimentacoes`, reformar dashboard, criar perfil de funcionário e adicionar badge de pendências na sidebar.

**Architecture:** Etapas sequenciais com dependência em cadeia: tipos → actions → aprovações → dashboard → perfil → sidebar. Cada etapa compila de forma independente antes de avançar. Server Actions para todas as mutações; nenhuma API route nova. Tabelas `solicitacoes` e `movimentacoes` já existem no Supabase — apenas os tipos TypeScript precisam ser adicionados.

**Tech Stack:** Next.js 14 App Router, TypeScript strict, Tailwind CSS, @base-ui/react/dialog, Supabase (PostgreSQL + RLS + Auth), Server Actions

---

## File Map

**Created:**
- `app/(admin)/aprovacoes/page.tsx`
- `app/(admin)/aprovacoes/actions.ts`
- `app/(admin)/efetivo/[id]/page.tsx`
- `components/aprovacoes/aprovacoes-list.tsx`
- `components/efetivo/perfil-tabs.tsx`

**Modified:**
- `types/database.ts` — add solicitacoes + movimentacoes
- `types/index.ts` — add aliases + domain types
- `app/(admin)/efetivo/actions.ts` — refactor + new actions
- `app/(admin)/dashboard/page.tsx` — full rewrite
- `app/(admin)/layout.tsx` — fetch pendingCount
- `components/admin/sidebar-nav.tsx` — add item + badge + redesign cores
- `components/efetivo/funcionarios-table.tsx` — simplify ações
- `components/efetivo/modal-desligar.tsx` — nova semântica (solicitação)
- `components/efetivo/modal-afastar.tsx` — corrigir props

---

## ETAPA 0 — Types

### Task 1: Add `solicitacoes` and `movimentacoes` to `types/database.ts`

**Files:**
- Modify: `types/database.ts`

- [ ] **Step 1: Adicionar as duas tabelas em `types/database.ts`**

Localizar a linha que fecha o bloco `Tables` (antes de `Views: { [_ in never]: never }`), que atualmente é após a tabela `transferencias`. Inserir antes do fechamento `}` do bloco Tables:

```ts
      // ----------------------------------------------------------
      // solicitacoes
      // ----------------------------------------------------------
      solicitacoes: {
        Row: {
          id: string
          tipo: 'desligamento' | 'transferencia' | 'mudanca_funcao' | 'promocao' | 'mudanca_supervisor'
          status: 'pendente' | 'aprovada' | 'rejeitada'
          funcionario_id: string
          supervisor_id: string | null
          dados_antes: Json | null
          dados_depois: Json | null
          motivo: string | null
          observacao_admin: string | null
          aprovado_por: string | null
          aprovado_em: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          tipo: 'desligamento' | 'transferencia' | 'mudanca_funcao' | 'promocao' | 'mudanca_supervisor'
          status?: 'pendente' | 'aprovada' | 'rejeitada'
          funcionario_id: string
          supervisor_id?: string | null
          dados_antes?: Json | null
          dados_depois?: Json | null
          motivo?: string | null
          observacao_admin?: string | null
          aprovado_por?: string | null
          aprovado_em?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          tipo?: 'desligamento' | 'transferencia' | 'mudanca_funcao' | 'promocao' | 'mudanca_supervisor'
          status?: 'pendente' | 'aprovada' | 'rejeitada'
          funcionario_id?: string
          supervisor_id?: string | null
          dados_antes?: Json | null
          dados_depois?: Json | null
          motivo?: string | null
          observacao_admin?: string | null
          aprovado_por?: string | null
          aprovado_em?: string | null
        }
      }

      // ----------------------------------------------------------
      // movimentacoes
      // ----------------------------------------------------------
      movimentacoes: {
        Row: {
          id: string
          funcionario_id: string
          tipo: string
          campo_alterado: string | null
          valor_antes: string | null
          valor_depois: string | null
          executado_por: string | null
          solicitacao_id: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          funcionario_id: string
          tipo: string
          campo_alterado?: string | null
          valor_antes?: string | null
          valor_depois?: string | null
          executado_por?: string | null
          solicitacao_id?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          funcionario_id?: string
          tipo?: string
          campo_alterado?: string | null
          valor_antes?: string | null
          valor_depois?: string | null
          executado_por?: string | null
          solicitacao_id?: string | null
        }
      }
```

### Task 2: Add type aliases to `types/index.ts`

**Files:**
- Modify: `types/index.ts`

- [ ] **Step 1: Adicionar aliases e tipos de domínio**

Após a linha `export type Atestado = Tables<'atestados'>`, adicionar:

```ts
export type Solicitacao     = Tables<'solicitacoes'>
export type Movimentacao    = Tables<'movimentacoes'>
```

Após a linha `export type StatusOcorrencia = 'aberta' | 'em_analise' | 'encerrada'`, adicionar:

```ts
/** Tipos de solicitação que requerem aprovação */
export type TipoSolicitacao =
  | 'desligamento'
  | 'transferencia'
  | 'mudanca_funcao'
  | 'promocao'
  | 'mudanca_supervisor'

/** Status de solicitação */
export type StatusSolicitacao = 'pendente' | 'aprovada' | 'rejeitada'
```

- [ ] **Step 2: Compilar — confirmar zero erros**

```bash
npx tsc --noEmit
```

Esperado: nenhum erro de tipo. Se houver erros relacionados a `solicitacoes` ou `movimentacoes`, revisar o bloco inserido em `database.ts` (verificar que fecha corretamente com `}`).

- [ ] **Step 3: Commit — Etapa 0**

```bash
git add types/database.ts types/index.ts
git commit -m "feat: add solicitacoes and movimentacoes types"
```

---

## ETAPA 1 — Refatorar `efetivo/actions.ts` + Modais

### Task 3: Rewrite `app/(admin)/efetivo/actions.ts`

**Files:**
- Modify: `app/(admin)/efetivo/actions.ts`

- [ ] **Step 1: Substituir o conteúdo completo do arquivo**

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/auth/get-user'

// ─── execução direta ──────────────────────────────────────────────────────────

export async function registrarAtestado(formData: FormData) {
  const supabase = createClient()
  const auth = await getUser()
  if (!auth) throw new Error('Não autenticado')

  const funcionarioId = formData.get('funcionario_id') as string
  const postoId       = formData.get('posto_id') as string
  const dataInicio    = formData.get('data_inicio') as string
  const dataFim       = formData.get('data_fim') as string
  const motivo        = (formData.get('motivo') as string) || null

  const { data: func } = await supabase
    .from('funcionarios')
    .select('status')
    .eq('id', funcionarioId)
    .single()

  await Promise.all([
    supabase.from('atestados').insert({
      funcionario_id: funcionarioId,
      posto_id: postoId,
      data_inicio: dataInicio,
      data_fim: dataFim,
      motivo,
      registrado_por: auth.user.id,
    }),
    supabase
      .from('funcionarios')
      .update({ status: 'afastado' })
      .eq('id', funcionarioId),
    supabase.from('movimentacoes').insert({
      funcionario_id: funcionarioId,
      tipo: 'atestado',
      campo_alterado: 'status',
      valor_antes: func?.status ?? null,
      valor_depois: 'afastado',
      executado_por: auth.user.id,
    }),
  ])

  revalidatePath('/efetivo')
  revalidatePath('/dashboard')
}

export async function registrarFerias(formData: FormData) {
  const supabase = createClient()
  const auth = await getUser()
  if (!auth) throw new Error('Não autenticado')

  const funcionarioId = formData.get('funcionario_id') as string
  const dataInicio    = formData.get('data_inicio') as string
  const dataFim       = formData.get('data_fim') as string
  const observacao    = (formData.get('observacao') as string) || null

  const { data: func } = await supabase
    .from('funcionarios')
    .select('status')
    .eq('id', funcionarioId)
    .single()

  await Promise.all([
    supabase.from('ferias').insert({
      funcionario_id: funcionarioId,
      data_inicio: dataInicio,
      data_fim: dataFim,
      observacao,
      status: 'agendada',
    }),
    supabase
      .from('funcionarios')
      .update({ status: 'ferias' })
      .eq('id', funcionarioId),
    supabase.from('movimentacoes').insert({
      funcionario_id: funcionarioId,
      tipo: 'ferias',
      campo_alterado: 'status',
      valor_antes: func?.status ?? null,
      valor_depois: 'ferias',
      executado_por: auth.user.id,
    }),
  ])

  revalidatePath('/efetivo')
  revalidatePath('/dashboard')
}

export async function afastarFuncionario(formData: FormData) {
  const supabase = createClient()
  const auth = await getUser()
  if (!auth) throw new Error('Não autenticado')

  const funcionarioId = formData.get('funcionario_id') as string

  const { data: func } = await supabase
    .from('funcionarios')
    .select('status')
    .eq('id', funcionarioId)
    .single()

  await Promise.all([
    supabase
      .from('funcionarios')
      .update({ status: 'afastado' })
      .eq('id', funcionarioId),
    supabase.from('movimentacoes').insert({
      funcionario_id: funcionarioId,
      tipo: 'afastamento',
      campo_alterado: 'status',
      valor_antes: func?.status ?? null,
      valor_depois: 'afastado',
      executado_por: auth.user.id,
    }),
  ])

  revalidatePath('/efetivo')
  revalidatePath('/dashboard')
}

// ─── solicitações (requerem aprovação do admin) ───────────────────────────────

export async function solicitarDesligamento(formData: FormData) {
  const supabase = createClient()
  const auth = await getUser()
  if (!auth) throw new Error('Não autenticado')

  const funcionarioId    = formData.get('funcionario_id') as string
  const dataDesligamento = formData.get('data_desligamento') as string
  const motivo           = formData.get('motivo') as string

  const { data: func } = await supabase
    .from('funcionarios')
    .select('status, posto_id, funcao_id')
    .eq('id', funcionarioId)
    .single()

  await supabase.from('solicitacoes').insert({
    tipo: 'desligamento',
    status: 'pendente',
    funcionario_id: funcionarioId,
    supervisor_id: auth.user.id,
    dados_antes: {
      status: func?.status ?? null,
      posto_id: func?.posto_id ?? null,
      funcao_id: func?.funcao_id ?? null,
    },
    dados_depois: { data_desligamento: dataDesligamento, motivo },
    motivo,
  })

  revalidatePath('/efetivo')
  revalidatePath('/aprovacoes')
}

export async function solicitarTransferencia(formData: FormData) {
  const supabase = createClient()
  const auth = await getUser()
  if (!auth) throw new Error('Não autenticado')

  const funcionarioId  = formData.get('funcionario_id') as string
  const postoDestinoId = formData.get('posto_destino_id') as string
  const motivo         = (formData.get('motivo') as string) || null

  const { data: func } = await supabase
    .from('funcionarios')
    .select('posto_id')
    .eq('id', funcionarioId)
    .single()

  const postoOrigemId = func?.posto_id ?? null

  const [{ data: postoDestino }, postoOrigemResult] = await Promise.all([
    supabase.from('postos').select('nome').eq('id', postoDestinoId).single(),
    postoOrigemId
      ? supabase.from('postos').select('nome').eq('id', postoOrigemId).single()
      : Promise.resolve({ data: null }),
  ])

  const postoOrigemNome  = (postoOrigemResult as { data: { nome: string } | null }).data?.nome ?? null
  const postoDestinoNome = postoDestino?.nome ?? null

  await supabase.from('solicitacoes').insert({
    tipo: 'transferencia',
    status: 'pendente',
    funcionario_id: funcionarioId,
    supervisor_id: auth.user.id,
    dados_antes: { posto_id: postoOrigemId, posto_nome: postoOrigemNome },
    dados_depois: { posto_destino_id: postoDestinoId, posto_destino_nome: postoDestinoNome, motivo },
    motivo,
  })

  revalidatePath('/efetivo')
  revalidatePath('/aprovacoes')
}

export async function solicitarMudancaFuncao(formData: FormData) {
  const supabase = createClient()
  const auth = await getUser()
  if (!auth) throw new Error('Não autenticado')

  const funcionarioId  = formData.get('funcionario_id') as string
  const funcaoDestinoId = formData.get('funcao_destino_id') as string
  const motivo          = (formData.get('motivo') as string) || null

  const { data: func } = await supabase
    .from('funcionarios')
    .select('funcao_id')
    .eq('id', funcionarioId)
    .single()

  const funcaoOrigemId = func?.funcao_id ?? null

  const [{ data: funcaoDestino }, funcaoOrigemResult] = await Promise.all([
    supabase.from('funcoes').select('nome').eq('id', funcaoDestinoId).single(),
    funcaoOrigemId
      ? supabase.from('funcoes').select('nome').eq('id', funcaoOrigemId).single()
      : Promise.resolve({ data: null }),
  ])

  const funcaoOrigemNome  = (funcaoOrigemResult as { data: { nome: string } | null }).data?.nome ?? null
  const funcaoDestinoNome = funcaoDestino?.nome ?? null

  await supabase.from('solicitacoes').insert({
    tipo: 'mudanca_funcao',
    status: 'pendente',
    funcionario_id: funcionarioId,
    supervisor_id: auth.user.id,
    dados_antes: { funcao_id: funcaoOrigemId, funcao_nome: funcaoOrigemNome },
    dados_depois: { funcao_destino_id: funcaoDestinoId, funcao_destino_nome: funcaoDestinoNome, motivo },
    motivo,
  })

  revalidatePath('/efetivo')
  revalidatePath('/aprovacoes')
}

export async function solicitarPromocao(formData: FormData) {
  const supabase = createClient()
  const auth = await getUser()
  if (!auth) throw new Error('Não autenticado')

  const funcionarioId   = formData.get('funcionario_id') as string
  const funcaoDestinoId = formData.get('funcao_destino_id') as string
  const motivo          = (formData.get('motivo') as string) || null

  const { data: func } = await supabase
    .from('funcionarios')
    .select('funcao_id')
    .eq('id', funcionarioId)
    .single()

  const funcaoOrigemId = func?.funcao_id ?? null

  const [{ data: funcaoDestino }, funcaoOrigemResult] = await Promise.all([
    supabase.from('funcoes').select('nome').eq('id', funcaoDestinoId).single(),
    funcaoOrigemId
      ? supabase.from('funcoes').select('nome').eq('id', funcaoOrigemId).single()
      : Promise.resolve({ data: null }),
  ])

  const funcaoOrigemNome  = (funcaoOrigemResult as { data: { nome: string } | null }).data?.nome ?? null
  const funcaoDestinoNome = funcaoDestino?.nome ?? null

  await supabase.from('solicitacoes').insert({
    tipo: 'promocao',
    status: 'pendente',
    funcionario_id: funcionarioId,
    supervisor_id: auth.user.id,
    dados_antes: { funcao_id: funcaoOrigemId, funcao_nome: funcaoOrigemNome },
    dados_depois: { funcao_destino_id: funcaoDestinoId, funcao_destino_nome: funcaoDestinoNome, motivo },
    motivo,
  })

  revalidatePath('/efetivo')
  revalidatePath('/aprovacoes')
}
```

### Task 4: Fix `components/efetivo/modal-desligar.tsx`

**Files:**
- Modify: `components/efetivo/modal-desligar.tsx`

- [ ] **Step 1: Substituir conteúdo completo**

```tsx
'use client'

import { useState } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { solicitarDesligamento } from '@/app/(admin)/efetivo/actions'
import type { FuncionarioRow } from './funcionarios-table'

interface Props {
  funcionario: FuncionarioRow
  open: boolean
  onClose: () => void
}

export function ModalDesligar({ funcionario, open, onClose }: Props) {
  const [pending, setPending] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const data = new FormData(form)
    data.set('funcionario_id', funcionario.id)
    setPending(true)
    try {
      await solicitarDesligamento(data)
      form.reset()
      onClose()
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 bg-black/50 z-40" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-xl">
          <Dialog.Title className="mb-1 text-lg font-semibold">Solicitar Desligamento</Dialog.Title>
          <p className="mb-4 text-sm text-gray-500">{funcionario.nome}</p>

          <div className="mb-4 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
            Esta solicitação será enviada para aprovação do administrador antes de ser efetivada.
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-600">
                Data de Desligamento
              </label>
              <input
                type="date"
                name="data_desligamento"
                required
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-600"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-600">
                Motivo
              </label>
              <select
                name="motivo"
                required
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-600"
              >
                <option value="">Selecione...</option>
                <option value="PESSOAL">PESSOAL</option>
                <option value="RESCISÃO INDIRETA">RESCISÃO INDIRETA</option>
                <option value="ADAPTAÇÃO">ADAPTAÇÃO</option>
                <option value="COMPORTAMENTAL">COMPORTAMENTAL</option>
                <option value="FALTAS EXCESSIVAS">FALTAS EXCESSIVAS</option>
                <option value="ABANDONO">ABANDONO</option>
                <option value="CORTE DE CUSTO">CORTE DE CUSTO</option>
                <option value="DEFICIÊNCIA TÉCNICA">DEFICIÊNCIA TÉCNICA</option>
                <option value="SALÁRIO">SALÁRIO</option>
                <option value="FALECIMENTO">FALECIMENTO</option>
                <option value="JUSTA CAUSA">JUSTA CAUSA</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={pending}
                className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
              >
                {pending ? 'Enviando...' : 'Enviar Solicitação'}
              </button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
```

### Task 5: Fix `components/efetivo/modal-afastar.tsx`

**Files:**
- Modify: `components/efetivo/modal-afastar.tsx`

- [ ] **Step 1: Substituir conteúdo completo**

```tsx
'use client'

import { useState } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { afastarFuncionario } from '@/app/(admin)/efetivo/actions'
import type { FuncionarioRow } from './funcionarios-table'

interface Props {
  funcionario: FuncionarioRow
  open: boolean
  onClose: () => void
}

export function ModalAfastar({ funcionario, open, onClose }: Props) {
  const [pending, setPending] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const data = new FormData(form)
    data.set('funcionario_id', funcionario.id)
    setPending(true)
    try {
      await afastarFuncionario(data)
      form.reset()
      onClose()
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 bg-black/50 z-40" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-xl">
          <Dialog.Title className="mb-1 text-lg font-semibold">Afastar Funcionário</Dialog.Title>
          <p className="mb-4 text-sm text-gray-500">{funcionario.nome}</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-600">
                Motivo
              </label>
              <select
                name="motivo"
                required
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-600"
              >
                <option value="">Selecione...</option>
                <option value="atestado">Atestado</option>
                <option value="suspensao">Suspensão</option>
                <option value="afastamento_inss">Afastamento INSS</option>
                <option value="outro">Outro</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-600">
                Observação
              </label>
              <textarea
                name="observacao"
                rows={3}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-600"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={pending}
                className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
              >
                {pending ? 'Salvando...' : 'Confirmar'}
              </button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
```

- [ ] **Step 2: Compilar — confirmar zero erros (Etapa 1)**

```bash
npx tsc --noEmit
```

Esperado: zero erros. Erros comuns a verificar:
- `solicitarDesligamento` não encontrado → verificar export em `actions.ts`
- `FuncionarioRow` not found → verificar que `funcionarios-table.tsx` exporta o tipo

- [ ] **Step 3: Commit — Etapa 1**

```bash
git add app/(admin)/efetivo/actions.ts components/efetivo/modal-desligar.tsx components/efetivo/modal-afastar.tsx
git commit -m "feat: refactor efetivo actions to solicitation flow + movimentacoes logging"
```

---

## ETAPA 2 — Página de Aprovações

### Task 6: Create `app/(admin)/aprovacoes/actions.ts`

**Files:**
- Create: `app/(admin)/aprovacoes/actions.ts`

- [ ] **Step 1: Criar o arquivo**

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/auth/get-user'

// Stub para geração de PDF — a implementar futuramente
async function gerarPDFMovimentacao(_solicitacaoId: string): Promise<null> {
  return null
}

export async function aprovarSolicitacao(id: string, observacao?: string) {
  const supabase = createClient()
  const auth = await getUser()
  if (!auth) throw new Error('Não autenticado')
  if (auth.perfil.role !== 'admin') throw new Error('Acesso negado')

  // Buscar solicitação + dados atuais do funcionário
  const { data: sol } = await supabase
    .from('solicitacoes')
    .select('*')
    .eq('id', id)
    .single()

  if (!sol) throw new Error('Solicitação não encontrada')
  if (sol.status !== 'pendente') throw new Error('Solicitação já processada')

  const { data: func } = await supabase
    .from('funcionarios')
    .select('status, posto_id, funcao_id')
    .eq('id', sol.funcionario_id)
    .single()

  const dadosDepois = (sol.dados_depois ?? {}) as Record<string, unknown>
  const now = new Date().toISOString()

  // Executar a mutação conforme o tipo
  switch (sol.tipo) {
    case 'desligamento': {
      const dataDesligamento = dadosDepois.data_desligamento as string | undefined
      await supabase
        .from('funcionarios')
        .update({ status: 'desligado', data_desligamento: dataDesligamento ?? null })
        .eq('id', sol.funcionario_id)
      break
    }

    case 'transferencia': {
      const postoDestinoId = dadosDepois.posto_destino_id as string
      await supabase
        .from('funcionarios')
        .update({ posto_id: postoDestinoId })
        .eq('id', sol.funcionario_id)
      break
    }

    case 'mudanca_funcao':
    case 'promocao': {
      const funcaoDestinoId = dadosDepois.funcao_destino_id as string
      await supabase
        .from('funcionarios')
        .update({ funcao_id: funcaoDestinoId })
        .eq('id', sol.funcionario_id)
      break
    }

    case 'mudanca_supervisor': {
      const novoSupervisorId = dadosDepois.novo_supervisor_id as string
      const postoId = func?.posto_id
      if (postoId) {
        await supabase
          .from('config_supervisores_postos')
          .update({ ativo: false })
          .eq('posto_id', postoId)
          .eq('ativo', true)
        await supabase
          .from('config_supervisores_postos')
          .insert({ supervisor_id: novoSupervisorId, posto_id: postoId, ativo: true })
      }
      break
    }
  }

  // Determinar campo_alterado e valores para movimentacoes
  const campoMap: Record<string, { campo: string; antes: string | null; depois: string | null }> = {
    desligamento:      { campo: 'status',    antes: func?.status ?? null,    depois: 'desligado' },
    transferencia:     { campo: 'posto_id',  antes: func?.posto_id ?? null,  depois: dadosDepois.posto_destino_id as string ?? null },
    mudanca_funcao:    { campo: 'funcao_id', antes: func?.funcao_id ?? null, depois: dadosDepois.funcao_destino_id as string ?? null },
    promocao:          { campo: 'funcao_id', antes: func?.funcao_id ?? null, depois: dadosDepois.funcao_destino_id as string ?? null },
    mudanca_supervisor:{ campo: 'supervisor_id', antes: null,               depois: dadosDepois.novo_supervisor_id as string ?? null },
  }
  const mov = campoMap[sol.tipo]

  await Promise.all([
    supabase.from('movimentacoes').insert({
      funcionario_id: sol.funcionario_id,
      tipo: sol.tipo,
      campo_alterado: mov?.campo ?? null,
      valor_antes: mov?.antes ?? null,
      valor_depois: mov?.depois ?? null,
      executado_por: auth.user.id,
      solicitacao_id: id,
    }),
    supabase.from('solicitacoes').update({
      status: 'aprovada',
      aprovado_por: auth.user.id,
      aprovado_em: now,
      observacao_admin: observacao ?? null,
    }).eq('id', id),
  ])

  // Stub PDF para mudança de função
  if (sol.tipo === 'mudanca_funcao') {
    await gerarPDFMovimentacao(id)
  }

  revalidatePath('/aprovacoes')
  revalidatePath('/efetivo')
  revalidatePath('/dashboard')
}

export async function rejeitarSolicitacao(id: string, motivo: string) {
  const supabase = createClient()
  const auth = await getUser()
  if (!auth) throw new Error('Não autenticado')
  if (auth.perfil.role !== 'admin') throw new Error('Acesso negado')

  if (!motivo.trim()) throw new Error('Motivo obrigatório')

  await supabase
    .from('solicitacoes')
    .update({
      status: 'rejeitada',
      aprovado_por: auth.user.id,
      aprovado_em: new Date().toISOString(),
      observacao_admin: motivo,
    })
    .eq('id', id)

  revalidatePath('/aprovacoes')
}
```

### Task 7: Create `components/aprovacoes/aprovacoes-list.tsx`

**Files:**
- Create: `components/aprovacoes/aprovacoes-list.tsx`

- [ ] **Step 1: Criar o diretório e arquivo**

```bash
mkdir -p components/aprovacoes
```

- [ ] **Step 2: Criar o arquivo**

```tsx
'use client'

import { useState, useTransition } from 'react'
import { cn } from '@/lib/utils'
import { aprovarSolicitacao, rejeitarSolicitacao } from '@/app/(admin)/aprovacoes/actions'
import type { TipoSolicitacao } from '@/types'

// ─── types ────────────────────────────────────────────────────────────────────

export type SolicitacaoPendente = {
  id: string
  tipo: TipoSolicitacao
  motivo: string | null
  dados_antes: Record<string, unknown> | null
  dados_depois: Record<string, unknown> | null
  created_at: string | null
  funcionarios: { nome: string; cpf: string | null } | null
  perfis: { nome: string | null; email: string | null } | null
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmt(iso: string) {
  const [y, m, d] = iso.split('T')[0].split('-')
  return `${d}/${m}/${y}`
}

function maskCPF(cpf: string | null): string {
  if (!cpf) return '—'
  return '***.***.***-**'
}

const TIPO_BADGE: Record<TipoSolicitacao, { label: string; className: string }> = {
  desligamento:       { label: 'Desligamento',       className: 'bg-red-50 text-red-700 ring-red-200'         },
  transferencia:      { label: 'Transferência',       className: 'bg-blue-50 text-blue-700 ring-blue-200'       },
  mudanca_funcao:     { label: 'Mudança de Função',  className: 'bg-indigo-50 text-indigo-700 ring-indigo-200' },
  promocao:           { label: 'Promoção',            className: 'bg-green-50 text-green-700 ring-green-200'    },
  mudanca_supervisor: { label: 'Mudança Supervisor',  className: 'bg-purple-50 text-purple-700 ring-purple-200' },
}

function renderDados(dados: Record<string, unknown> | null, label: string, side: 'antes' | 'depois') {
  if (!dados) return <p className="text-xs text-gray-400 italic">—</p>

  const bg = side === 'antes' ? 'bg-gray-50' : 'bg-green-50'
  const entries = Object.entries(dados).filter(([k]) => !k.endsWith('_id'))

  return (
    <div className={cn('rounded p-2 text-xs', bg)}>
      <p className="mb-1 font-semibold uppercase tracking-widest text-gray-400">{label}</p>
      {entries.length === 0 ? (
        <p className="text-gray-400 italic">sem dados</p>
      ) : (
        entries.map(([k, v]) => (
          <p key={k} className="text-gray-700">
            <span className="font-medium">{k.replace(/_/g, ' ')}:</span>{' '}
            {String(v ?? '—')}
          </p>
        ))
      )}
    </div>
  )
}

// ─── card de solicitação ──────────────────────────────────────────────────────

function SolicitacaoCard({ sol }: { sol: SolicitacaoPendente }) {
  const [isPending, startTransition] = useTransition()
  const [rejeitando, setRejeitando] = useState(false)
  const [motivo, setMotivo] = useState('')

  const badge = TIPO_BADGE[sol.tipo]

  function handleAprovar() {
    startTransition(async () => {
      await aprovarSolicitacao(sol.id)
    })
  }

  function handleRejeitar() {
    if (!motivo.trim()) return
    startTransition(async () => {
      await rejeitarSolicitacao(sol.id, motivo)
      setRejeitando(false)
      setMotivo('')
    })
  }

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      {/* Header */}
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <span
            className={cn(
              'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset',
              badge.className,
            )}
          >
            {badge.label}
          </span>
          <p className="mt-2 text-sm font-semibold text-gray-900">
            {sol.funcionarios?.nome ?? '—'}
            <span className="ml-2 font-normal text-gray-400">{maskCPF(sol.funcionarios?.cpf ?? null)}</span>
          </p>
          <p className="text-xs text-gray-400">
            Solicitado por {sol.perfis?.nome ?? sol.perfis?.email ?? 'supervisor'}{' '}
            {sol.created_at ? `· ${fmt(sol.created_at)}` : ''}
          </p>
          {sol.motivo && (
            <p className="mt-1 text-xs text-gray-500">Motivo: {sol.motivo}</p>
          )}
        </div>
      </div>

      {/* Antes / Depois */}
      <div className="mb-4 grid grid-cols-2 gap-3">
        {renderDados(sol.dados_antes, 'Situação atual', 'antes')}
        {renderDados(sol.dados_depois, 'Solicitado', 'depois')}
      </div>

      {/* Ações */}
      {!rejeitando ? (
        <div className="flex items-center gap-2">
          <button
            onClick={handleAprovar}
            disabled={isPending}
            className="rounded-lg bg-green-600 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-white transition-colors hover:bg-green-700 disabled:opacity-50"
          >
            {isPending ? 'Processando...' : 'Aprovar'}
          </button>
          <button
            onClick={() => setRejeitando(true)}
            disabled={isPending}
            className="rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-white transition-colors hover:bg-red-700 disabled:opacity-50"
          >
            Rejeitar
          </button>
        </div>
      ) : (
        <div className="space-y-2 border-t border-gray-100 pt-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">
            Motivo da rejeição (obrigatório)
          </p>
          <textarea
            value={motivo}
            onChange={e => setMotivo(e.target.value)}
            rows={2}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-600"
            placeholder="Informe o motivo..."
          />
          <div className="flex gap-2">
            <button
              onClick={() => { setRejeitando(false); setMotivo('') }}
              className="rounded-lg px-4 py-2 text-xs font-semibold uppercase tracking-widest text-gray-600 hover:bg-gray-100"
            >
              Cancelar
            </button>
            <button
              onClick={handleRejeitar}
              disabled={!motivo.trim() || isPending}
              className="rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-white hover:bg-red-700 disabled:opacity-50"
            >
              {isPending ? 'Processando...' : 'Confirmar Rejeição'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── lista principal ──────────────────────────────────────────────────────────

export function AprovacoesList({ solicitacoes }: { solicitacoes: SolicitacaoPendente[] }) {
  if (solicitacoes.length === 0) {
    return (
      <div className="rounded-xl border border-gray-100 bg-white px-6 py-12 text-center shadow-sm">
        <p className="text-sm font-medium text-gray-400">Nenhuma solicitação pendente.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {solicitacoes.map(sol => (
        <SolicitacaoCard key={sol.id} sol={sol} />
      ))}
    </div>
  )
}
```

### Task 8: Create `app/(admin)/aprovacoes/page.tsx`

**Files:**
- Create: `app/(admin)/aprovacoes/page.tsx`

- [ ] **Step 1: Criar o arquivo**

```tsx
import { createClient } from '@/lib/supabase/server'
import { AprovacoesList } from '@/components/aprovacoes/aprovacoes-list'
import type { SolicitacaoPendente } from '@/components/aprovacoes/aprovacoes-list'

export default async function AprovacoesPage() {
  const supabase = createClient()

  const { data: raw } = await supabase
    .from('solicitacoes')
    .select(`
      id, tipo, motivo, dados_antes, dados_depois, created_at,
      funcionarios!funcionario_id ( nome, cpf ),
      perfis!supervisor_id ( nome, email )
    `)
    .eq('status', 'pendente')
    .order('created_at', { ascending: true })

  const solicitacoes = (raw ?? []) as unknown as SolicitacaoPendente[]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Aprovações</h1>
        <p className="text-sm text-gray-400">
          {solicitacoes.length === 0
            ? 'Nenhuma solicitação pendente'
            : `${solicitacoes.length} solicitaç${solicitacoes.length === 1 ? 'ão' : 'ões'} aguardando aprovação`}
        </p>
      </div>

      <AprovacoesList solicitacoes={solicitacoes} />
    </div>
  )
}
```

- [ ] **Step 2: Compilar — confirmar zero erros (Etapa 2)**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit — Etapa 2**

```bash
git add app/(admin)/aprovacoes/ components/aprovacoes/
git commit -m "feat: add aprovacoes page with approve/reject flow"
```

---

## ETAPA 3 — Reformar Dashboard

### Task 9: Rewrite `app/(admin)/dashboard/page.tsx`

**Files:**
- Modify: `app/(admin)/dashboard/page.tsx`

- [ ] **Step 1: Substituir o conteúdo completo do arquivo**

```tsx
import Link from 'next/link'
import { Users, UserMinus, Umbrella, TrendingDown, ClipboardList, ArrowLeftRight, type LucideIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'
import type { TipoSolicitacao } from '@/types'

// ─── types ────────────────────────────────────────────────────────────────────

type SolicitacaoPendente = {
  id: string
  tipo: TipoSolicitacao
  created_at: string | null
  funcionarios: { nome: string; cpf: string | null } | null
  perfis: { nome: string | null } | null
}

type RetornoHoje = {
  id: string
  data_prev_retorno: string | null
  funcionarios: { nome: string } | null
  postos: { nome: string } | null
}

type InsalubreAberta = {
  id: string
  created_at: string | null
  funcionarios: { nome: string } | null
  postos: { nome: string } | null
}

type PostoItem = {
  id: string
  nome: string
  secretaria: string | null
  efetivo_previsto: number | null
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmt(iso: string) {
  const [y, m, d] = iso.split('T')[0].split('-')
  return `${d}/${m}/${y}`
}

const TIPO_BADGE: Record<TipoSolicitacao, { label: string; className: string }> = {
  desligamento:       { label: 'Desligamento',      className: 'bg-red-50 text-red-700 ring-red-200'         },
  transferencia:      { label: 'Transferência',      className: 'bg-blue-50 text-blue-700 ring-blue-200'       },
  mudanca_funcao:     { label: 'Mudança Função',     className: 'bg-indigo-50 text-indigo-700 ring-indigo-200' },
  promocao:           { label: 'Promoção',           className: 'bg-green-50 text-green-700 ring-green-200'    },
  mudanca_supervisor: { label: 'Mudança Supervisor', className: 'bg-purple-50 text-purple-700 ring-purple-200' },
}

// ─── sub-components ──────────────────────────────────────────────────────────

function KpiCard({
  label, value, icon: Icon, topColor, iconBg,
}: {
  label: string; value: number; icon: LucideIcon; topColor: string; iconBg: string
}) {
  return (
    <div className={cn('rounded-xl border border-gray-100 border-t-4 bg-white p-5 shadow-sm', topColor)}>
      <div className={cn('inline-flex rounded-lg p-2.5', iconBg.split(' ')[1])}>
        <Icon className={cn('h-5 w-5', iconBg.split(' ')[0])} />
      </div>
      <p className="mt-3 text-4xl font-black tracking-tight text-gray-900">{value}</p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-gray-400">{label}</p>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400">{children}</h2>
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const supabase = createClient()

  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const sevenDaysAgo = new Date(today.getTime() - 7 * 86_400_000).toISOString()

  const [
    { count: totalAtivos },
    { count: afastados },
    { count: emFerias },
    { count: coberturasAtivas },
    { count: solicitacoesPendentes },
    { data: postosData },
    { data: funcAtivosData },
    { data: solicitacoesPendentesData },
    { data: retornosHojeData },
    { data: insalubreAbertasData },
  ] = await Promise.all([
    supabase.from('funcionarios').select('*', { count: 'exact', head: true }).eq('status', 'ativo'),
    supabase.from('funcionarios').select('*', { count: 'exact', head: true }).eq('status', 'afastado'),
    supabase.from('funcionarios').select('*', { count: 'exact', head: true }).eq('status', 'ferias'),
    supabase.from('coberturas_temporarias').select('*', { count: 'exact', head: true }).eq('status', 'ativa'),
    supabase.from('solicitacoes').select('*', { count: 'exact', head: true }).eq('status', 'pendente'),
    supabase.from('postos').select('id, nome, secretaria, efetivo_previsto').eq('ativo', true).not('secretaria', 'is', null),
    supabase.from('funcionarios').select('posto_id').eq('status', 'ativo').not('posto_id', 'is', null),
    supabase
      .from('solicitacoes')
      .select(`id, tipo, created_at, funcionarios!funcionario_id(nome, cpf), perfis!supervisor_id(nome)`)
      .eq('status', 'pendente')
      .order('created_at', { ascending: true })
      .limit(5),
    supabase
      .from('coberturas_temporarias')
      .select(`id, data_prev_retorno, funcionarios!funcionario_id(nome), postos!posto_destino_id(nome)`)
      .eq('status', 'ativa')
      .eq('data_prev_retorno', todayStr),
    supabase
      .from('coberturas_insalubres')
      .select(`id, created_at, funcionarios!funcionario_id(nome), postos!posto_id(nome)`)
      .eq('status', 'pendente')
      .lte('created_at', sevenDaysAgo),
  ])

  const postos = (postosData ?? []) as PostoItem[]
  const solsPendentes = (solicitacoesPendentesData ?? []) as unknown as SolicitacaoPendente[]
  const retornosHoje = (retornosHojeData ?? []) as unknown as RetornoHoje[]
  const insalubreAbertas = (insalubreAbertasData ?? []) as unknown as InsalubreAberta[]

  // ─ postos por ID para lookup eficiente
  const postoById = new Map(postos.map(p => [p.id, p]))

  // ─ funcionários ativos por posto
  const funcPorPosto: Record<string, number> = {}
  for (const f of funcAtivosData ?? []) {
    if (f.posto_id) funcPorPosto[f.posto_id] = (funcPorPosto[f.posto_id] ?? 0) + 1
  }

  // ─ déficit (qualquer gap)
  const deficit = postos.filter(p => (funcPorPosto[p.id] ?? 0) < (p.efetivo_previsto ?? 0)).length

  // ─ postos em déficit crítico (gap >= 2) para alertas
  const deficitCritico = postos
    .map(p => ({ ...p, gap: (p.efetivo_previsto ?? 0) - (funcPorPosto[p.id] ?? 0) }))
    .filter(p => p.gap >= 2)
    .slice(0, 5)

  // ─ efetivo por secretaria
  const secAgg = new Map<string, { previsto: number; real: number }>()
  for (const p of postos) {
    if (!p.secretaria) continue
    const agg = secAgg.get(p.secretaria) ?? { previsto: 0, real: 0 }
    agg.previsto += p.efetivo_previsto ?? 0
    secAgg.set(p.secretaria, agg)
  }
  for (const f of funcAtivosData ?? []) {
    if (!f.posto_id) continue
    const posto = postoById.get(f.posto_id)
    if (!posto?.secretaria) continue
    const agg = secAgg.get(posto.secretaria) ?? { previsto: 0, real: 0 }
    agg.real += 1
    secAgg.set(posto.secretaria, agg)
  }
  const secretarias = Array.from(secAgg.entries())
    .map(([nome, { previsto, real }]) => ({ nome, previsto, real }))
    .sort((a, b) => a.nome.localeCompare(b.nome))

  const temAlertas = retornosHoje.length > 0 || deficitCritico.length > 0 || insalubreAbertas.length > 0

  // ─── render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">

      {/* KPIs */}
      <section className="space-y-3">
        <SectionTitle>Visão geral</SectionTitle>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
          <KpiCard label="Ativos"              value={totalAtivos ?? 0}         icon={Users}          topColor="border-t-blue-500"   iconBg="text-blue-600 bg-blue-50"   />
          <KpiCard label="Afastados"           value={afastados ?? 0}           icon={UserMinus}      topColor="border-t-orange-500" iconBg="text-orange-600 bg-orange-50" />
          <KpiCard label="Em Férias"           value={emFerias ?? 0}            icon={Umbrella}       topColor="border-t-amber-500"  iconBg="text-amber-600 bg-amber-50"  />
          <KpiCard label="Postos em Déficit"   value={deficit}                  icon={TrendingDown}   topColor="border-t-red-500"    iconBg="text-red-600 bg-red-50"     />
          <KpiCard label="Aprovações Pend."    value={solicitacoesPendentes ?? 0} icon={ClipboardList} topColor="border-t-violet-500" iconBg="text-violet-600 bg-violet-50" />
          <KpiCard label="Coberturas Ativas"   value={coberturasAtivas ?? 0}    icon={ArrowLeftRight} topColor="border-t-teal-500"   iconBg="text-teal-600 bg-teal-50"   />
        </div>
      </section>

      {/* Aprovações Pendentes */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <SectionTitle>Aprovações pendentes</SectionTitle>
          <Link
            href="/aprovacoes"
            className="text-xs font-semibold text-slate-600 hover:text-slate-900"
          >
            Ver todas →
          </Link>
        </div>
        <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
          {solsPendentes.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-gray-400">
              Nenhuma solicitação pendente.
            </p>
          ) : (
            <ul className="divide-y divide-gray-50">
              {solsPendentes.map(s => {
                const badge = TIPO_BADGE[s.tipo]
                return (
                  <li key={s.id} className="flex items-center justify-between px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset', badge.className)}>
                        {badge.label}
                      </span>
                      <p className="text-sm font-medium text-gray-900">{s.funcionarios?.nome ?? '—'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-400">{s.perfis?.nome ?? '—'}</p>
                      {s.created_at && <p className="text-xs text-gray-400">{fmt(s.created_at)}</p>}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </section>

      {/* Alertas do Dia */}
      <section className="space-y-3">
        <SectionTitle>Alertas do dia</SectionTitle>
        {!temAlertas ? (
          <div className="flex items-center gap-2 rounded-xl border border-green-100 bg-green-50 px-5 py-4 shadow-sm">
            <span className="h-2 w-2 rounded-full bg-green-500" />
            <p className="text-sm font-medium text-green-700">Nenhum alerta no momento.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {retornosHoje.length > 0 && (
              <div className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-blue-500">
                  Retornos previstos para hoje ({retornosHoje.length})
                </p>
                <ul className="space-y-1">
                  {retornosHoje.map(r => (
                    <li key={r.id} className="text-sm text-gray-700">
                      {r.funcionarios?.nome ?? '—'} — {r.postos?.nome ?? '—'}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {deficitCritico.length > 0 && (
              <div className="rounded-xl border border-red-100 bg-white p-4 shadow-sm">
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-red-500">
                  Postos em déficit crítico ({deficitCritico.length})
                </p>
                <ul className="space-y-1">
                  {deficitCritico.map(p => (
                    <li key={p.id} className="text-sm text-gray-700">
                      {p.nome} — faltam {p.gap} pessoa{p.gap > 1 ? 's' : ''}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {insalubreAbertas.length > 0 && (
              <div className="rounded-xl border border-amber-100 bg-white p-4 shadow-sm">
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-amber-500">
                  Coberturas insalubres abertas há mais de 7 dias ({insalubreAbertas.length})
                </p>
                <ul className="space-y-1">
                  {insalubreAbertas.map(c => (
                    <li key={c.id} className="text-sm text-gray-700">
                      {c.funcionarios?.nome ?? '—'} — {c.postos?.nome ?? '—'}
                      {c.created_at && <span className="ml-1 text-xs text-gray-400">(desde {fmt(c.created_at)})</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Efetivo por Secretaria */}
      <section className="space-y-3">
        <SectionTitle>Efetivo por secretaria</SectionTitle>
        <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
          {secretarias.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-gray-400">Sem dados de secretaria.</p>
          ) : (
            <ul className="divide-y divide-gray-50">
              {secretarias.map(({ nome, previsto, real }) => {
                const pct = previsto > 0 ? Math.min(100, Math.round((real / previsto) * 100)) : 0
                const barColor = pct >= 90 ? 'bg-green-500' : pct >= 70 ? 'bg-yellow-500' : 'bg-red-500'
                return (
                  <li key={nome} className="px-5 py-4">
                    <div className="mb-1.5 flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-widest text-gray-600">{nome}</p>
                      <p className="text-xs text-gray-400">
                        {real}/{previsto} <span className="font-semibold text-gray-600">{pct}%</span>
                      </p>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                      <div className={cn('h-full rounded-full', barColor)} style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </section>

    </div>
  )
}
```

- [ ] **Step 2: Compilar — confirmar zero erros (Etapa 3)**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit — Etapa 3**

```bash
git add app/(admin)/dashboard/page.tsx
git commit -m "feat: rewrite dashboard with 6 KPIs, alerts, pending approvals, secretaria breakdown"
```

---

## ETAPA 4 — Perfil do Funcionário

### Task 10: Create `components/efetivo/perfil-tabs.tsx`

**Files:**
- Create: `components/efetivo/perfil-tabs.tsx`

- [ ] **Step 1: Criar o arquivo**

```tsx
'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { TipoSolicitacao, StatusSolicitacao } from '@/types'

// ─── types ────────────────────────────────────────────────────────────────────

export type MovimentacaoItem = {
  id: string
  tipo: string
  campo_alterado: string | null
  valor_antes: string | null
  valor_depois: string | null
  created_at: string | null
  perfis: { nome: string | null } | null
}

export type AdvertenciaItem = {
  id: string
  tipo: string | null
  descricao: string | null
  data_ocorrencia: string | null
  status: 'pendente' | 'gerada' | 'entregue' | null
}

export type SolicitacaoItem = {
  id: string
  tipo: TipoSolicitacao
  status: StatusSolicitacao
  motivo: string | null
  created_at: string | null
  observacao_admin: string | null
  perfis: { nome: string | null } | null
}

type Tab = 'movimentacoes' | 'afastamentos' | 'advertencias' | 'solicitacoes'

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmt(iso: string) {
  const d = iso.split('T')[0].split('-').reverse().join('/')
  const t = iso.includes('T') ? ' ' + iso.split('T')[1].slice(0, 5) : ''
  return d + t
}

const STATUS_SOL: Record<StatusSolicitacao, { label: string; className: string }> = {
  pendente:  { label: 'Pendente',  className: 'bg-yellow-50 text-yellow-700 ring-yellow-200' },
  aprovada:  { label: 'Aprovada',  className: 'bg-green-50 text-green-700 ring-green-200'   },
  rejeitada: { label: 'Rejeitada', className: 'bg-red-50 text-red-700 ring-red-200'         },
}

const STATUS_ADV: Record<NonNullable<AdvertenciaItem['status']>, { label: string; className: string }> = {
  pendente: { label: 'Pendente', className: 'bg-yellow-50 text-yellow-700 ring-yellow-200' },
  gerada:   { label: 'Gerada',   className: 'bg-blue-50 text-blue-700 ring-blue-200'       },
  entregue: { label: 'Entregue', className: 'bg-green-50 text-green-700 ring-green-200'    },
}

// ─── sub-views ────────────────────────────────────────────────────────────────

function TabMovimentacoes({ items }: { items: MovimentacaoItem[] }) {
  if (items.length === 0) {
    return <p className="py-8 text-center text-sm text-gray-400">Nenhuma movimentação registrada.</p>
  }
  return (
    <ol className="relative ml-3 border-l border-gray-200">
      {items.map(m => (
        <li key={m.id} className="mb-6 ml-5">
          <span className="absolute -left-1.5 mt-1 h-3 w-3 rounded-full border-2 border-white bg-slate-400" />
          <p className="text-xs text-gray-400">
            {m.created_at ? fmt(m.created_at) : '—'}
            {m.perfis?.nome && <span> · {m.perfis.nome}</span>}
          </p>
          <p className="mt-0.5 text-sm font-semibold capitalize text-gray-900">{m.tipo.replace(/_/g, ' ')}</p>
          {m.campo_alterado && (
            <p className="text-xs text-gray-500">
              {m.campo_alterado}:{' '}
              <span className="line-through text-gray-400">{m.valor_antes ?? '—'}</span>
              {' → '}
              <span className="text-gray-700">{m.valor_depois ?? '—'}</span>
            </p>
          )}
        </li>
      ))}
    </ol>
  )
}

function TabAfastamentos({ items }: { items: MovimentacaoItem[] }) {
  const afastamentos = items.filter(m => m.tipo === 'afastamento' || m.tipo === 'atestado')
  if (afastamentos.length === 0) {
    return <p className="py-8 text-center text-sm text-gray-400">Nenhum afastamento registrado.</p>
  }
  return <TabMovimentacoes items={afastamentos} />
}

function TabAdvertencias({ items }: { items: AdvertenciaItem[] }) {
  if (items.length === 0) {
    return <p className="py-8 text-center text-sm text-gray-400">Nenhuma advertência registrada.</p>
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b border-gray-100">
          <tr>
            {['Data', 'Tipo', 'Descrição', 'Status'].map(h => (
              <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-gray-400">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {items.map(a => {
            const badge = a.status ? STATUS_ADV[a.status] : null
            return (
              <tr key={a.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-500">{a.data_ocorrencia ? fmt(a.data_ocorrencia) : '—'}</td>
                <td className="px-4 py-3 font-medium text-gray-900">{a.tipo ?? '—'}</td>
                <td className="max-w-52 truncate px-4 py-3 text-gray-500">{a.descricao ?? '—'}</td>
                <td className="px-4 py-3">
                  {badge && (
                    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset', badge.className)}>
                      {badge.label}
                    </span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function TabSolicitacoes({ items }: { items: SolicitacaoItem[] }) {
  if (items.length === 0) {
    return <p className="py-8 text-center text-sm text-gray-400">Nenhuma solicitação registrada.</p>
  }
  return (
    <div className="space-y-3">
      {items.map(s => {
        const badge = STATUS_SOL[s.status]
        return (
          <div key={s.id} className="rounded-lg border border-gray-100 p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold capitalize text-gray-900">{s.tipo.replace(/_/g, ' ')}</p>
                <p className="text-xs text-gray-400">
                  {s.created_at ? fmt(s.created_at) : '—'}
                  {s.perfis?.nome && <span> · por {s.perfis.nome}</span>}
                </p>
                {s.motivo && <p className="mt-1 text-xs text-gray-500">{s.motivo}</p>}
                {s.observacao_admin && (
                  <p className="mt-1 text-xs text-gray-500 italic">Admin: {s.observacao_admin}</p>
                )}
              </div>
              <span className={cn('inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset', badge.className)}>
                {badge.label}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── main component ───────────────────────────────────────────────────────────

const TABS: { key: Tab; label: string }[] = [
  { key: 'movimentacoes', label: 'Movimentações'  },
  { key: 'afastamentos',  label: 'Afastamentos'   },
  { key: 'advertencias',  label: 'Advertências'   },
  { key: 'solicitacoes',  label: 'Solicitações'   },
]

export function PerfilTabs({
  movimentacoes,
  advertencias,
  solicitacoes,
}: {
  movimentacoes: MovimentacaoItem[]
  advertencias: AdvertenciaItem[]
  solicitacoes: SolicitacaoItem[]
}) {
  const [tab, setTab] = useState<Tab>('movimentacoes')

  return (
    <div>
      {/* Tab bar */}
      <div className="flex gap-0 border-b border-gray-200">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'px-4 py-3 text-xs font-semibold uppercase tracking-widest transition-colors',
              tab === t.key
                ? 'border-b-2 border-slate-900 text-slate-900'
                : 'text-gray-400 hover:text-gray-700',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="pt-4">
        {tab === 'movimentacoes' && <TabMovimentacoes items={movimentacoes} />}
        {tab === 'afastamentos'  && <TabAfastamentos  items={movimentacoes} />}
        {tab === 'advertencias'  && <TabAdvertencias  items={advertencias} />}
        {tab === 'solicitacoes'  && <TabSolicitacoes  items={solicitacoes} />}
      </div>
    </div>
  )
}
```

### Task 11: Create `app/(admin)/efetivo/[id]/page.tsx`

**Files:**
- Create: `app/(admin)/efetivo/[id]/page.tsx`

- [ ] **Step 1: Criar o diretório e arquivo**

```bash
mkdir -p "app/(admin)/efetivo/[id]"
```

- [ ] **Step 2: Criar o arquivo**

```tsx
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'
import { PerfilTabs } from '@/components/efetivo/perfil-tabs'
import type { MovimentacaoItem, AdvertenciaItem, SolicitacaoItem } from '@/components/efetivo/perfil-tabs'

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmt(iso: string) {
  const [y, m, d] = iso.split('T')[0].split('-')
  return `${d}/${m}/${y}`
}

function maskCPF(cpf: string | null): string {
  if (!cpf) return '—'
  return '***.***.***-**'
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  ativo:     { label: 'Ativo',     className: 'bg-green-50 text-green-700 ring-green-200'   },
  afastado:  { label: 'Afastado',  className: 'bg-orange-50 text-orange-700 ring-orange-200' },
  ferias:    { label: 'Férias',    className: 'bg-amber-50 text-amber-700 ring-amber-200'   },
  desligado: { label: 'Desligado', className: 'bg-gray-100 text-gray-500 ring-gray-200'     },
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default async function PerfilFuncionarioPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = createClient()
  const { id } = params

  // Fase 1: buscar funcionário
  const { data: func } = await supabase
    .from('funcionarios')
    .select(`
      id, nome, cpf, status, data_admissao,
      funcoes!funcao_id ( nome ),
      postos!posto_id ( id, nome, secretaria )
    `)
    .eq('id', id)
    .single()

  if (!func) notFound()

  const postoId = (func as unknown as { postos?: { id: string } }).postos?.id ?? null

  // Fase 2: buscar tudo em paralelo
  const [
    { data: movRaw },
    { data: advRaw },
    { data: solRaw },
    supervisorResult,
  ] = await Promise.all([
    supabase
      .from('movimentacoes')
      .select('id, tipo, campo_alterado, valor_antes, valor_depois, created_at, perfis!executado_por(nome)')
      .eq('funcionario_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('advertencias')
      .select('id, tipo, descricao, data_ocorrencia, status')
      .eq('funcionario_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('solicitacoes')
      .select('id, tipo, status, motivo, created_at, observacao_admin, perfis!supervisor_id(nome)')
      .eq('funcionario_id', id)
      .order('created_at', { ascending: false }),
    postoId
      ? supabase
          .from('config_supervisores_postos')
          .select('perfis!supervisor_id(nome, email)')
          .eq('posto_id', postoId)
          .eq('ativo', true)
          .limit(1)
          .single()
      : Promise.resolve({ data: null }),
  ])

  const movimentacoes = (movRaw ?? []) as unknown as MovimentacaoItem[]
  const advertencias  = (advRaw ?? []) as unknown as AdvertenciaItem[]
  const solicitacoes  = (solRaw ?? []) as unknown as SolicitacaoItem[]

  const supervisorNome =
    (supervisorResult.data as unknown as { perfis?: { nome: string | null } } | null)?.perfis?.nome ?? null

  const f = func as unknown as {
    nome: string
    cpf: string | null
    status: string | null
    data_admissao: string | null
    funcoes: { nome: string } | null
    postos: { nome: string; secretaria: string | null } | null
  }

  const statusBadge = f.status ? STATUS_BADGE[f.status] : null

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{f.nome}</h1>
              {statusBadge && (
                <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset', statusBadge.className)}>
                  {statusBadge.label}
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-gray-500">CPF: {maskCPF(f.cpf)}</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-2 text-sm lg:grid-cols-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Função</p>
            <p className="text-gray-900">{f.funcoes?.nome ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Posto</p>
            <p className="text-gray-900">{f.postos?.nome ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Secretaria</p>
            <p className="text-gray-900">{f.postos?.secretaria ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Supervisor</p>
            <p className="text-gray-900">{supervisorNome ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Admissão</p>
            <p className="text-gray-900">{f.data_admissao ? fmt(f.data_admissao) : '—'}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <PerfilTabs
          movimentacoes={movimentacoes}
          advertencias={advertencias}
          solicitacoes={solicitacoes}
        />
      </div>

    </div>
  )
}
```

### Task 12: Simplify `components/efetivo/funcionarios-table.tsx`

**Files:**
- Modify: `components/efetivo/funcionarios-table.tsx`

- [ ] **Step 1: Substituir conteúdo completo**

```tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { FileMinus, ArrowUpRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ModalAtestado } from './modal-atestado'

export type FuncionarioRow = {
  id: string
  nome: string
  cpf: string | null
  status: 'ativo' | 'afastado' | 'ferias' | 'desligado' | null
  data_admissao: string | null
  posto_id: string | null
  funcoes: { id: string; nome: string } | null
  postos: { id: string; nome: string; secretaria: string | null } | null
}

const STATUS_BADGE: Record<
  NonNullable<FuncionarioRow['status']>,
  { label: string; className: string }
> = {
  ativo:     { label: 'Ativo',     className: 'bg-green-50 text-green-700 ring-green-200'    },
  afastado:  { label: 'Afastado',  className: 'bg-red-50 text-red-700 ring-red-200'          },
  ferias:    { label: 'Férias',    className: 'bg-orange-50 text-orange-700 ring-orange-200'  },
  desligado: { label: 'Desligado', className: 'bg-gray-100 text-gray-500 ring-gray-200'      },
}

const COLS = ['Nome', 'Função', 'Posto', 'Secretaria', 'Status', 'Ações']

export function FuncionariosTable({
  funcionarios,
}: {
  funcionarios: FuncionarioRow[]
}) {
  const [atestadoFuncionario, setAtestadoFuncionario] = useState<FuncionarioRow | null>(null)

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
        {funcionarios.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-gray-400">
            Nenhum funcionário encontrado.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100 bg-slate-50">
                <tr>
                  {COLS.map(h => (
                    <th
                      key={h}
                      className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-widest text-gray-400"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {funcionarios.map(f => {
                  const badge = f.status ? STATUS_BADGE[f.status] : null
                  return (
                    <tr key={f.id} className="transition-colors hover:bg-gray-50">
                      <td className="px-5 py-3.5 font-medium text-gray-900">
                        {f.nome}
                        {f.cpf && (
                          <span className="block text-xs font-normal text-gray-400">
                            {f.cpf}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-gray-500">{f.funcoes?.nome ?? '—'}</td>
                      <td className="px-5 py-3.5 text-gray-500">{f.postos?.nome ?? '—'}</td>
                      <td className="px-5 py-3.5 text-gray-500">{f.postos?.secretaria ?? '—'}</td>
                      <td className="px-5 py-3.5">
                        {badge ? (
                          <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset', badge.className)}>
                            {badge.label}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setAtestadoFuncionario(f)}
                            disabled={!f.posto_id}
                            title={!f.posto_id ? 'Sem posto vinculado' : undefined}
                          >
                            <FileMinus className="h-3.5 w-3.5" />
                            Atestado
                          </Button>
                          <Button size="sm" variant="outline" asChild>
                            <Link href={`/efetivo/${f.id}`}>
                              <ArrowUpRight className="h-3.5 w-3.5" />
                              Ver perfil
                            </Link>
                          </Button>
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

      {atestadoFuncionario && (
        <ModalAtestado
          open={true}
          onClose={() => setAtestadoFuncionario(null)}
          funcionario={atestadoFuncionario}
        />
      )}
    </>
  )
}
```

- [ ] **Step 2: Compilar — confirmar zero erros (Etapa 4)**

```bash
npx tsc --noEmit
```

Erros comuns a verificar:
- `PerfilTabs` props não batem — confirmar que `MovimentacaoItem`, `AdvertenciaItem`, `SolicitacaoItem` são compatíveis com os dados retornados pelo Supabase
- `notFound()` não importado — adicionar `import { notFound } from 'next/navigation'`

- [ ] **Step 3: Commit — Etapa 4**

```bash
git add "app/(admin)/efetivo/[id]/" components/efetivo/perfil-tabs.tsx components/efetivo/funcionarios-table.tsx
git commit -m "feat: add employee profile page with tabs and simplify efetivo table actions"
```

---

## ETAPA 5 — Sidebar + Badge

### Task 13: Update `components/admin/sidebar-nav.tsx`

**Files:**
- Modify: `components/admin/sidebar-nav.tsx`

- [ ] **Step 1: Substituir conteúdo completo**

```tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  ArrowLeftRight,
  Calendar,
  AlertTriangle,
  Shield,
  FileText,
  AlertCircle,
  UserCog,
  ClipboardCheck,
  Menu,
} from 'lucide-react'
import { Sheet, SheetContent, SheetClose } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import type { Role } from '@/types'

// ─── nav definition ───────────────────────────────────────────────────────────

const NAV = [
  { href: '/dashboard',     label: 'Dashboard',     icon: LayoutDashboard },
  { href: '/efetivo',       label: 'Efetivo',       icon: Users           },
  { href: '/coberturas',    label: 'Coberturas',    icon: ArrowLeftRight  },
  { href: '/ferias',        label: 'Férias',        icon: Calendar        },
  { href: '/advertencias',  label: 'Advertências',  icon: AlertTriangle   },
  { href: '/insalubridade', label: 'Insalubridade', icon: Shield          },
  { href: '/medicao',       label: 'Medição',       icon: FileText        },
  { href: '/ocorrencias',   label: 'Ocorrências',   icon: AlertCircle     },
] as const

const ADMIN_NAV = [
  { href: '/aprovacoes', label: 'Aprovações', icon: ClipboardCheck },
  { href: '/usuarios',   label: 'Usuários',   icon: UserCog        },
] as const

// ─── shared nav content ───────────────────────────────────────────────────────

function NavLinks({
  role,
  pendingCount,
  onNavigate,
}: {
  role: Role | null
  pendingCount: number
  onNavigate?: () => void
}) {
  const pathname = usePathname()
  const items = role === 'admin' ? [...NAV, ...ADMIN_NAV] : NAV

  return (
    <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-4">
      {items.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + '/')
        const showBadge = href === '/aprovacoes' && pendingCount > 0
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-semibold uppercase tracking-wide transition-colors',
              active
                ? 'bg-slate-700 text-white'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white',
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
            {showBadge && (
              <span className="ml-auto rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                {pendingCount}
              </span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}

function SidebarHeader() {
  return (
    <div className="flex h-16 shrink-0 items-center border-b border-slate-700 px-6">
      <span className="text-sm font-black uppercase tracking-widest text-white">
        DEMAX
      </span>
    </div>
  )
}

// ─── main component ───────────────────────────────────────────────────────────

export function SidebarNav({
  role,
  pendingCount = 0,
}: {
  role: Role | null
  pendingCount?: number
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Mobile: hamburger */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Abrir menu"
        className="fixed left-4 top-4 z-50 rounded-lg p-1.5 text-gray-600 transition-colors hover:bg-gray-100 md:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile: Sheet sidebar */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="bg-slate-900 pt-0">
          <SheetClose />
          <SidebarHeader />
          <NavLinks role={role} pendingCount={pendingCount} onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Desktop: fixed sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-700 bg-slate-900 md:flex">
        <SidebarHeader />
        <NavLinks role={role} pendingCount={pendingCount} />
      </aside>
    </>
  )
}
```

### Task 14: Update `app/(admin)/layout.tsx`

**Files:**
- Modify: `app/(admin)/layout.tsx`

- [ ] **Step 1: Adicionar query de pendingCount e passar para SidebarNav**

Substituir o conteúdo completo do arquivo:

```tsx
import { Inter } from 'next/font/google'
import { redirect } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { getUser } from '@/lib/auth/get-user'
import { createClient } from '@/lib/supabase/server'
import { SidebarNav } from '@/components/admin/sidebar-nav'
import { ROLE_LABELS } from '@/types'

const inter = Inter({ subsets: ['latin'] })

async function signOut() {
  'use server'
  const supabase = createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const auth = await getUser()
  if (!auth) redirect('/login')

  const { perfil } = auth
  const displayName = perfil.nome ?? perfil.email ?? 'Usuário'
  const roleLabel = perfil.role ? ROLE_LABELS[perfil.role] : ''

  const supabase = createClient()
  const { count: pendingCount } = await supabase
    .from('solicitacoes')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pendente')

  return (
    <div className={`${inter.className} min-h-screen bg-gray-50`}>
      <SidebarNav role={perfil.role} pendingCount={pendingCount ?? 0} />

      <div className="flex min-h-screen flex-col md:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center border-b border-gray-200 bg-white px-4 md:px-6">
          <div className="w-10 shrink-0 md:hidden" aria-hidden />

          <div className="ml-auto flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold text-gray-900">{displayName}</p>
              {roleLabel && (
                <p className="text-xs uppercase tracking-widest text-gray-400">{roleLabel}</p>
              )}
            </div>

            <div className="h-6 w-px bg-gray-200 hidden sm:block" aria-hidden />

            <form action={signOut}>
              <button
                type="submit"
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-widest text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600"
                title="Sair da conta"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Sair</span>
              </button>
            </form>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Compilar — confirmar zero erros (Etapa 5 — final)**

```bash
npx tsc --noEmit
```

Se houver erros:
- `pendingCount` type mismatch → verificar que `count` do Supabase é `number | null`, e `pendingCount ?? 0` resolve para `number`
- `SidebarNav` props → verificar que `pendingCount?: number` está na interface

- [ ] **Step 3: Commit final — Etapa 5**

```bash
git add components/admin/sidebar-nav.tsx "app/(admin)/layout.tsx"
git commit -m "feat: add aprovacoes menu item with pending badge and sidebar redesign to slate-900"
```

---

## Self-Review Checklist

### Spec coverage:
- ✅ Etapa 0 — types adicionados com schema exato do banco
- ✅ Etapa 1 — `registrarAtestado` + `registrarFerias` + `afastarFuncionario` com logging
- ✅ Etapa 1 — `desligarFuncionario` → `solicitarDesligamento` (sem tocar em funcionarios)
- ✅ Etapa 1 — `solicitarTransferencia`, `solicitarMudancaFuncao`, `solicitarPromocao`
- ✅ Etapa 1 — modais corrigidos (props FuncionarioRow, warning text)
- ✅ Etapa 2 — `aprovarSolicitacao` com verificação admin, mutação, movimentações, stub PDF
- ✅ Etapa 2 — `rejeitarSolicitacao` com motivo obrigatório
- ✅ Etapa 2 — página de aprovações com badges tipo, antes/depois, inline reject
- ✅ Etapa 3 — 6 KPIs (ativos, afastados, férias, déficit, pendentes, coberturas)
- ✅ Etapa 3 — "Aprovações Pendentes" (últimas 5 + link)
- ✅ Etapa 3 — "Alertas do Dia" (retornos, déficit crítico, insalubre > 7 dias)
- ✅ Etapa 3 — "Efetivo por Secretaria" com query dinâmica, só status='ativo'
- ✅ Etapa 4 — perfil com header (nome, CPF mascarado sempre, status, função, posto, secretaria, supervisor)
- ✅ Etapa 4 — 4 abas (movimentações timeline, afastamentos, advertências, solicitações)
- ✅ Etapa 4 — tabela simplificada (só Atestado + Ver perfil)
- ✅ Etapa 5 — item "Aprovações" com ClipboardCheck antes de Usuários
- ✅ Etapa 5 — badge vermelho com count visível quando > 0
- ✅ Etapa 5 — sidebar redesenhada para slate-900

### Invariantes verificados:
- CPF sempre mascarado em `maskCPF()` — retorna `'***.***.***-**'` para todos os perfis
- `aprovarSolicitacao` e `rejeitarSolicitacao` verificam `role === 'admin'` antes de qualquer operação
- Nenhum delete — apenas updates de status
- Toda aprovação insere em `movimentacoes` com referência à solicitação
