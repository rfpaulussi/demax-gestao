---
name: new-feature-module
description: Scaffold a new feature module following the project's conventions (page.tsx + actions.ts + role gating + CPF masking + supervisor scoping)
---

Invoked with `/new-feature-module nome-do-modulo` — creates the folder structure and boilerplate for a new feature in `app/(admin)/`.

## Files to create

### `app/(admin)/{modulo}/actions.ts`

```ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getUser } from '@/lib/auth/get-user'
import { revalidatePath } from 'next/cache'

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type {ModuloPascal}Item = {
  id: string
  // adicionar campos conforme a tabela
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function buscar{ModuloPascal}Lista(): Promise<{ModuloPascal}Item[]> {
  const { perfil } = await getUser() ?? {}
  const supabase = createClient()

  let query = supabase
    .from('{tabela}')
    .select(`id, ...`)
    .order('created_at', { ascending: false })

  // Supervisor vê apenas seus postos
  if (perfil?.role === 'supervisor') {
    const { data: postos } = await supabase
      .from('config_supervisores_postos')
      .select('posto_id')
      .eq('supervisor_id', perfil.id)
      .eq('ativo', true)
    const ids = (postos ?? []).map(p => p.posto_id)
    query = query.in('funcionarios.posto_id', ids)
  }

  const { data, error } = await query
  if (error) { console.error(error); return [] }
  return data ?? []
}

// ─── Mutações ─────────────────────────────────────────────────────────────────

export async function criar{ModuloPascal}(payload: { /* campos */ }) {
  const session = await getUser()
  if (!session) throw new Error('Não autenticado')

  // Somente admin e coordenador escrevem
  if (!['admin', 'coordenador'].includes(session.perfil.role)) {
    throw new Error('Sem permissão')
  }

  const adminSupabase = createAdminClient()
  const { error } = await adminSupabase.from('{tabela}').insert({
    ...payload,
    criado_por: session.user.id,
  })
  if (error) throw new Error(error.message)
  revalidatePath('/{modulo}')
  return { ok: true }
}
```

### `app/(admin)/{modulo}/page.tsx`

Se a página for Server Component (dados simples, sem interação client-side):

```tsx
import { getUser } from '@/lib/auth/get-user'
import { redirect } from 'next/navigation'
import { buscar{ModuloPascal}Lista } from './actions'

export default async function {ModuloPascal}Page() {
  const session = await getUser()
  if (!session) redirect('/login')

  const items = await buscar{ModuloPascal}Lista()

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{ModuloLabel}</h1>
        <p className="text-sm text-slate-500">{Descrição}</p>
      </div>
      {/* ... */}
    </div>
  )
}
```

Se a página for Client Component (filtros, modais, ordenação):

```tsx
'use client'

import { useEffect, useState } from 'react'
import { buscar{ModuloPascal}Lista, type {ModuloPascal}Item } from './actions'

export default function {ModuloPascal}Page() {
  const [items, setItems] = useState<{ModuloPascal}Item[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    buscar{ModuloPascal}Lista().then(data => {
      setItems(data)
      setLoading(false)
    })
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-slate-500">Carregando...</div>
    </div>
  )

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{ModuloLabel}</h1>
          <p className="text-sm text-slate-500">{Descrição}</p>
        </div>
        <button className="px-4 py-2 text-sm font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-700 transition">
          + Novo
        </button>
      </div>
      {/* KPI cards, filtros, tabela */}
    </div>
  )
}
```

## Checklist obrigatório

- [ ] `getUser()` chamado antes de qualquer mutação
- [ ] Role check (`['admin', 'coordenador'].includes(role)`) em todas as Server Actions de escrita
- [ ] CPF **nunca** retornado nas queries de lista (omitir do select ou mascarar com `***.***.***-**`)
- [ ] Supervisor scoping via `config_supervisores_postos` quando `role === 'supervisor'`
- [ ] Secretaria buscada do banco (`postos.secretaria`), nunca hardcoded
- [ ] `revalidatePath('/{modulo}')` após toda mutação
- [ ] Rota adicionada na sidebar (`components/admin/sidebar-nav.tsx`) com role adequado
- [ ] `npm run build` sem erros antes de finalizar

## Padrões de UI

- Fundo da página: `p-6 space-y-6` no container raiz
- Card KPI: `bg-white rounded-xl border border-slate-200 shadow-sm p-4 border-t-4 {color}`
- Label KPI: `text-xs uppercase tracking-widest text-slate-400 mt-1`
- Tabela: `bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm`
- Header de coluna: `px-3 py-3 text-left text-xs font-semibold uppercase tracking-widest text-slate-500`
- Botão primário: `px-4 py-2 text-sm font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-700 transition`
