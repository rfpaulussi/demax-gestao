# Prorrogar Afastamento Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Botão "Prorrogar" na tela Efetivo (visível pra admin/coordenador em funcionários `status = 'afastado'`) abre um modal que mostra a data prevista de retorno do afastamento aberto e permite atualizá-la — edição direta, sem fluxo de aprovação.

**Architecture:** Duas Server Actions novas em `app/(admin)/efetivo/actions.ts` (buscar o afastamento aberto do funcionário; atualizar sua `data_fim_prevista` com log em `movimentacoes`). Um componente de modal novo (`components/efetivo/modal-prorrogar-afastamento.tsx`). Um botão novo na tabela de funcionários já existente.

**Tech Stack:** Next.js 14 Server Actions, Supabase, TypeScript, `@base-ui/react/dialog` (mesma lib de modal já usada no projeto).

**Nota sobre testes:** projeto sem test runner configurado. Verificação via `npx tsc --noEmit` e `npm run build` (roda `next lint`).

---

## Arquivos

- Modificar `app/(admin)/efetivo/actions.ts` — 2 Server Actions novas
- Criar `components/efetivo/modal-prorrogar-afastamento.tsx` — modal
- Modificar `components/efetivo/funcionarios-table.tsx` — botão + wiring do modal

---

### Task 1: Server Actions

**Files:**
- Modify: `app/(admin)/efetivo/actions.ts`

- [ ] **Step 1: Adicionar as duas actions no final do arquivo**

```typescript

export type AfastamentoAberto = {
  id: string
  dataInicio: string
  dataFimPrevista: string | null
}

/**
 * Busca o afastamento aberto (data_fim_real IS NULL) mais recente do funcionário.
 * Retorna null se não houver nenhum (ex.: funcionário com status='afastado' definido
 * fora do fluxo normal, sem registro em `afastamentos`).
 */
export async function buscarAfastamentoAberto(funcionarioId: string): Promise<AfastamentoAberto | null> {
  const auth = await getUser()
  if (!auth) return null
  if (auth.perfil.role !== 'admin' && auth.perfil.role !== 'coordenador') return null

  const supabase = createClient()
  const { data } = await supabase
    .from('afastamentos')
    .select('id, data_inicio, data_fim_prevista')
    .eq('funcionario_id', funcionarioId)
    .is('data_fim_real', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data) return null
  return {
    id: data.id,
    dataInicio: data.data_inicio,
    dataFimPrevista: data.data_fim_prevista,
  }
}

export async function prorrogarAfastamento(
  afastamentoId: string,
  novaDataFimPrevista: string,
): Promise<{ success: boolean; error?: string }> {
  const auth = await getUser()
  if (!auth) return { success: false, error: 'Não autenticado' }
  if (auth.perfil.role !== 'admin' && auth.perfil.role !== 'coordenador') {
    return { success: false, error: 'Apenas admin/coordenador podem prorrogar afastamento' }
  }

  const supabase = createClient()
  const { data: atual, error: errBusca } = await supabase
    .from('afastamentos')
    .select('id, funcionario_id, data_inicio, data_fim_prevista')
    .eq('id', afastamentoId)
    .single()

  if (errBusca || !atual) return { success: false, error: 'Afastamento não encontrado' }
  if (novaDataFimPrevista < atual.data_inicio) {
    return { success: false, error: 'Nova data não pode ser anterior à data de início do afastamento' }
  }

  const { error: errUpdate } = await supabase
    .from('afastamentos')
    .update({ data_fim_prevista: novaDataFimPrevista })
    .eq('id', afastamentoId)

  if (errUpdate) return { success: false, error: errUpdate.message }

  await supabase.from('movimentacoes').insert({
    funcionario_id: atual.funcionario_id,
    tipo: 'afastamento',
    campo_alterado: 'data_fim_prevista',
    valor_antes: atual.data_fim_prevista,
    valor_depois: novaDataFimPrevista,
    executado_por: auth.user.id,
  })

  revalidatePath('/efetivo')
  revalidatePath('/dashboard')

  return { success: true }
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: sem erros novos em `app/(admin)/efetivo/actions.ts`

- [ ] **Step 3: Commit**

```bash
git add "app/(admin)/efetivo/actions.ts"
git commit -m "feat(efetivo): server actions para prorrogar afastamento

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Modal

**Files:**
- Create: `components/efetivo/modal-prorrogar-afastamento.tsx`

- [ ] **Step 1: Criar o componente**

```typescript
'use client'

import { useEffect, useState } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { buscarAfastamentoAberto, prorrogarAfastamento } from '@/app/(admin)/efetivo/actions'
import type { FuncionarioRow } from './funcionarios-table'

interface Props {
  funcionario: FuncionarioRow
  open: boolean
  onClose: () => void
}

const labelClass = 'mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-600'
const inputClass = 'w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-600'

export function ModalProrrogarAfastamento({ funcionario, open, onClose }: Props) {
  const [carregando, setCarregando] = useState(true)
  const [afastamentoId, setAfastamentoId] = useState<string | null>(null)
  const [dataAtual, setDataAtual] = useState<string | null>(null)
  const [novaData, setNovaData] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (!open) return
    setCarregando(true)
    setErro(null)
    buscarAfastamentoAberto(funcionario.id).then(res => {
      if (!res) {
        setAfastamentoId(null)
        setDataAtual(null)
      } else {
        setAfastamentoId(res.id)
        setDataAtual(res.dataFimPrevista)
        setNovaData(res.dataFimPrevista ?? '')
      }
      setCarregando(false)
    })
  }, [open, funcionario.id])

  function resetState() {
    setNovaData('')
    setErro(null)
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!afastamentoId) return
    setErro(null)
    setPending(true)
    const res = await prorrogarAfastamento(afastamentoId, novaData)
    setPending(false)
    if (!res.success) {
      setErro(res.error ?? 'Erro ao prorrogar')
      return
    }
    resetState()
    onClose()
  }

  return (
    <Dialog.Root open={open} onOpenChange={isOpen => { if (!isOpen) { resetState(); onClose() } }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/50" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-xl">
          <Dialog.Title className="mb-1 text-lg font-semibold">Prorrogar Afastamento</Dialog.Title>
          <p className="mb-4 text-sm text-gray-500">{funcionario.nome}</p>

          {carregando ? (
            <p className="py-6 text-center text-sm text-gray-400">Carregando...</p>
          ) : !afastamentoId ? (
            <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
              Nenhum afastamento rastreado pra esse funcionário — não é possível prorrogar por aqui.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className={labelClass}>Data prevista atual</label>
                <p className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
                  {dataAtual ? dataAtual.split('-').reverse().join('/') : 'Não informada'}
                </p>
              </div>
              <div>
                <label className={labelClass}>Nova data prevista de retorno</label>
                <input
                  type="date"
                  required
                  value={novaData}
                  onChange={e => setNovaData(e.target.value)}
                  className={inputClass}
                />
              </div>
              {erro && (
                <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{erro}</p>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { resetState(); onClose() }}
                  className="rounded px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
                >
                  {pending ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: sem erros novos em `components/efetivo/modal-prorrogar-afastamento.tsx`

- [ ] **Step 3: Commit**

```bash
git add components/efetivo/modal-prorrogar-afastamento.tsx
git commit -m "feat(efetivo): modal prorrogar afastamento

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Botão na tabela + wiring

**Files:**
- Modify: `components/efetivo/funcionarios-table.tsx`

- [ ] **Step 1: Import e estado**

Localizar (linha 13):

```typescript
import { ModalEditarFuncionario } from './modal-editar-funcionario'
```

Substituir por:

```typescript
import { ModalEditarFuncionario } from './modal-editar-funcionario'
import { ModalProrrogarAfastamento } from './modal-prorrogar-afastamento'
```

Localizar (linha 126):

```typescript
  const [excluindoFuncionario, setExcluindoFuncionario]   = useState<FuncionarioRow | null>(null)
```

Substituir por:

```typescript
  const [excluindoFuncionario, setExcluindoFuncionario]   = useState<FuncionarioRow | null>(null)
  const [prorrogarFuncionario, setProrrogarFuncionario]   = useState<FuncionarioRow | null>(null)
```

- [ ] **Step 2: Botão "Prorrogar"**

Localizar o bloco do botão "Afastar" (por volta da linha 278-289):

```typescript
                          {f.status === 'ativo' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-amber-400 text-amber-700 hover:bg-amber-50"
                              onClick={() => setAfastarFuncionario(f)}
                            >
                              <UserMinus className="h-3.5 w-3.5" />
                              Afastar
                            </Button>
                          )}
```

Adicionar logo depois:

```typescript
                          {f.status === 'afastado' && isAdmin && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-amber-400 text-amber-700 hover:bg-amber-50"
                              onClick={() => setProrrogarFuncionario(f)}
                            >
                              <Clock className="h-3.5 w-3.5" />
                              Prorrogar
                            </Button>
                          )}
```

- [ ] **Step 3: Renderizar o modal**

Localizar o bloco `{afastarFuncionario && (...)}` (por volta da linha 363-370):

```typescript
      {afastarFuncionario && (
        <ModalAfastar
          open
          onClose={() => setAfastarFuncionario(null)}
          funcionario={afastarFuncionario}
          isAdmin={isAdmin}
        />
      )}
```

Adicionar logo depois:

```typescript

      {prorrogarFuncionario && (
        <ModalProrrogarAfastamento
          open
          onClose={() => setProrrogarFuncionario(null)}
          funcionario={prorrogarFuncionario}
        />
      )}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: sem erros novos em `components/efetivo/funcionarios-table.tsx`

- [ ] **Step 5: Build completo (inclui lint)**

Run: `npm run build`
Expected: `✓ Compiled successfully`, sem erros de lint

- [ ] **Step 6: Commit**

```bash
git add components/efetivo/funcionarios-table.tsx
git commit -m "feat(efetivo): botao prorrogar afastamento na tabela

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Verificação manual (checkpoint, sem commit)

**Files:** nenhum

- [ ] **Step 1:** Rodar `npm run dev`, logar como admin, ir em `/efetivo`.
- [ ] **Step 2:** Achar um funcionário `status = 'afastado'` (ex: SONIA REGINA DA SILVA ou EMILY LAUREN DE ALMEIDA MOREIRA, corrigidas em sessão anterior) e clicar "Prorrogar".
- [ ] **Step 3:** Confirmar que o modal mostra a data prevista atual, permite escolher uma nova, e salva sem erro.
- [ ] **Step 4:** Confirmar em `/dashboard` ou no sino que a mudança refletiu (se a nova data for no passado, o alerta deve considerar; se for no futuro, o alerta não deve mais aparecer pra esse funcionário).
- [ ] **Step 5:** Testar o caso "sem afastamento rastreado": se possível, achar um funcionário `afastado` sem linha em `afastamentos` e confirmar que o modal mostra o aviso em vez de formulário.
- [ ] **Step 6:** Reportar o resultado ao usuário — sem commit nesta task.
