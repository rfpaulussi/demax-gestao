# Confirmação de Exclusão — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Todo ponto de exclusão **definitiva** (dado apagado do banco pra sempre) no sistema passa a exigir que o usuário digite a palavra "deletar" antes de confirmar, através de um componente único reutilizável que substitui os 5 padrões de confirmação diferentes que coexistem hoje.

**Architecture:** Um novo componente `ConfirmarExclusaoDialog` (`components/ui/confirmar-exclusao-dialog.tsx`), construído sobre o `AlertDialog` já existente no projeto, encapsula o campo de texto, a validação, o estado de carregamento e a exibição de erro. Cada uma das 10 telas com exclusão definitiva passa a acionar esse componente único em vez do seu mecanismo atual (`window.confirm()`, modal bespoke, toggle inline, ou nenhuma confirmação).

**Tech Stack:** Next.js 14 App Router, React, TypeScript, Tailwind, `@base-ui/react/alert-dialog` (já usado via `components/ui/alert-dialog.tsx`). Sem framework de testes — verificação via `npx tsc --noEmit`, `npm run build`, e teste manual.

## Global Constraints

- Palavra de confirmação: `"deletar"`, comparação **case-insensitive** (`texto.trim().toLowerCase() === 'deletar'`).
- Escopo: **apenas exclusões definitivas** (DELETE SQL, irreversível). Desativações/soft-delete (postos, turnos, usuários, supervisores) **não mudam**. O sino de notificações **não muda**.
- O componente aceita `onConfirmar: () => Promise<{ success: boolean; error?: string }>` — todo call site precisa adaptar o retorno da sua Server Action para esse formato exato (sem alterar a Server Action em si), já que hoje há pelo menos 4 formatos de retorno diferentes entre as 10 actions envolvidas.
- `descricao` do diálogo é opcional (`React.ReactNode`); quando omitida, usa um texto padrão fixo de aviso de irreversibilidade.
- `createClient()` do Supabase é síncrono — não se aplica a este trabalho (nenhuma Server Action é criada ou alterada, só os call sites client-side).
- Rodar `npm run build` e corrigir todos os erros antes de finalizar.
- Spec de referência: `docs/superpowers/specs/2026-07-21-confirmacao-exclusao-design.md`.

---

### Task 1: Componente `ConfirmarExclusaoDialog`

**Files:**
- Create: `components/ui/confirmar-exclusao-dialog.tsx`

**Interfaces:**
- Produces: `ConfirmarExclusaoDialog` — componente React exportado, props `{ open: boolean; onOpenChange: (open: boolean) => void; titulo: string; descricao?: React.ReactNode; onConfirmar: () => Promise<{ success: boolean; error?: string }> }`.
- Consumido por: Tasks 2-10.

- [ ] **Step 1: Criar o arquivo**

```tsx
'use client'

import { useState } from 'react'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'

const PALAVRA_CONFIRMACAO = 'deletar'
const DESCRICAO_PADRAO = 'Esta ação é irreversível. O registro será apagado permanentemente.'

interface ConfirmarExclusaoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  titulo: string
  descricao?: React.ReactNode
  onConfirmar: () => Promise<{ success: boolean; error?: string }>
}

export function ConfirmarExclusaoDialog({
  open,
  onOpenChange,
  titulo,
  descricao = DESCRICAO_PADRAO,
  onConfirmar,
}: ConfirmarExclusaoDialogProps) {
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const habilitado = texto.trim().toLowerCase() === PALAVRA_CONFIRMACAO

  function limparEFechar(novoOpen: boolean) {
    if (!novoOpen) {
      setTexto('')
      setErro(null)
    }
    onOpenChange(novoOpen)
  }

  async function handleConfirmar() {
    if (!habilitado || enviando) return
    setEnviando(true)
    setErro(null)
    const res = await onConfirmar()
    setEnviando(false)
    if (!res.success) {
      setErro(res.error ?? 'Erro ao excluir. Tente novamente.')
      return
    }
    limparEFechar(false)
  }

  return (
    <AlertDialog open={open} onOpenChange={limparEFechar}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{titulo}</AlertDialogTitle>
          <AlertDialogDescription>{descricao}</AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-widest text-gray-500">
            Digite &quot;deletar&quot; para confirmar
          </label>
          <input
            type="text"
            value={texto}
            onChange={e => setTexto(e.target.value)}
            autoComplete="off"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400"
          />
        </div>

        {erro && <p className="px-1 text-sm text-red-600">{erro}</p>}

        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => limparEFechar(false)}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirmar}
            disabled={!habilitado || enviando}
            className="bg-red-600 text-white hover:bg-red-700 focus:ring-red-600 disabled:opacity-40"
          >
            {enviando ? 'Excluindo…' : 'Excluir'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: nenhum erro novo vindo de `components/ui/confirmar-exclusao-dialog.tsx`.

- [ ] **Step 3: Commit**

```bash
git add components/ui/confirmar-exclusao-dialog.tsx
git commit -m "feat(ui): componente ConfirmarExclusaoDialog com exigencia de digitar deletar"
```

---

### Task 2: Efetivo — exclusão completa de funcionário

**Files:**
- Modify: `components/efetivo/funcionarios-table.tsx`

**Interfaces:**
- Consumes: `ConfirmarExclusaoDialog` de `@/components/ui/confirmar-exclusao-dialog` (Task 1); `excluirFuncionarioCompleto` já importado (retorna `{ success: boolean; error?: string }`, bate direto com o contrato — sem wrapper necessário).

- [ ] **Step 1: Adicionar o import**

Em `components/efetivo/funcionarios-table.tsx`, junto aos demais imports de componentes locais (perto de `import { ModalEditarFuncionario } from './modal-editar-funcionario'`), adicionar:

```tsx
import { ConfirmarExclusaoDialog } from '@/components/ui/confirmar-exclusao-dialog'
```

- [ ] **Step 2: Adicionar estado**

Junto aos demais `useState` do componente (perto de `const [editarFuncionario, setEditarFuncionario] = useState<FuncionarioRow | null>(null)`), adicionar:

```tsx
  const [excluindoFuncionario, setExcluindoFuncionario] = useState<FuncionarioRow | null>(null)
```

- [ ] **Step 3: Trocar o botão de exclusão**

Trocar:

```tsx
                          {isAdmin && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-red-300 text-red-600 hover:bg-red-50"
                              title="Excluir cadastro permanentemente"
                              onClick={async () => {
                                if (!confirm(`Excluir PERMANENTEMENTE ${f.nome}?\n\nTodos os registros (férias, faltas, afastamentos, atestados) serão deletados. Esta ação é IRREVERSÍVEL.`)) return
                                const res = await excluirFuncionarioCompleto(f.id)
                                if (!res.success) alert('Erro: ' + res.error)
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
```

por:

```tsx
                          {isAdmin && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-red-300 text-red-600 hover:bg-red-50"
                              title="Excluir cadastro permanentemente"
                              onClick={() => setExcluindoFuncionario(f)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
```

- [ ] **Step 4: Adicionar o diálogo**

Junto aos demais modais renderizados no fim do componente (após o bloco `{editarFuncionario && (<ModalEditarFuncionario .../>)}`), adicionar:

```tsx
      {excluindoFuncionario && (
        <ConfirmarExclusaoDialog
          open
          onOpenChange={(open) => { if (!open) setExcluindoFuncionario(null) }}
          titulo={`Excluir cadastro de ${excluindoFuncionario.nome}?`}
          descricao="Todos os registros (férias, faltas, afastamentos, atestados) serão apagados junto. Esta ação é irreversível."
          onConfirmar={() => excluirFuncionarioCompleto(excluindoFuncionario.id)}
        />
      )}
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: nenhum erro em `components/efetivo/funcionarios-table.tsx`.

- [ ] **Step 6: Commit**

```bash
git add components/efetivo/funcionarios-table.tsx
git commit -m "feat(efetivo): exclusao de funcionario exige digitar deletar"
```

---

### Task 3: Horário do funcionário — exclusão de registro histórico

**Files:**
- Modify: `components/efetivo/tab-horario.tsx`

**Interfaces:**
- Consumes: `ConfirmarExclusaoDialog` de `@/components/ui/confirmar-exclusao-dialog` (Task 1); `deletarHorarioFuncionario` já importado (retorna `{ success: boolean; error?: string }`, sem wrapper necessário).

- [ ] **Step 1: Adicionar o import**

Junto aos imports do topo do arquivo (perto de `import { resolverTipoEscala, ... } from '@/lib/turnos/escala'`), adicionar:

```tsx
import { ConfirmarExclusaoDialog } from '@/components/ui/confirmar-exclusao-dialog'
```

- [ ] **Step 2: Simplificar o estado de exclusão**

Trocar:

```tsx
  const [confirmDelete, setConfirmDelete]     = useState<string | null>(null)
  const [deleting, setDeleting]               = useState(false)
  const [deleteErro, setDeleteErro]           = useState<string | null>(null)

  const canWrite = role === 'admin' || role === 'coordenador'

  async function handleDeletar(id: string) {
    setDeleting(true)
    setDeleteErro(null)
    const res = await deletarHorarioFuncionario(id)
    setDeleting(false)
    if (!res.success) {
      setDeleteErro(res.error ?? 'Erro ao excluir')
      setConfirmDelete(null)
      return
    }
    setConfirmDelete(null)
  }
```

por:

```tsx
  const [confirmDelete, setConfirmDelete]     = useState<string | null>(null)

  const canWrite = role === 'admin' || role === 'coordenador'
```

`ConfirmarExclusaoDialog` passa a gerenciar o próprio estado de carregamento e erro — não precisa mais de `deleting`/`deleteErro`/`handleDeletar` neste componente.

- [ ] **Step 3: Simplificar a lista do histórico**

Trocar:

```tsx
          {historicoAberto && (
            <div className="divide-y divide-gray-50 border-t border-gray-100">
              {deleteErro && (
                <p className="flex items-center gap-1.5 px-5 py-2 text-xs text-red-600">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  {deleteErro}
                </p>
              )}
              {historicoHorario.map((h) => (
                <div key={h.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-700">{h.turno.nome}</p>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                        {calcDuracao(h.data_inicio, h.data_fim)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-gray-400">
                      {fmtMes(h.data_inicio)} – {h.data_fim ? fmtMes(h.data_fim) : 'presente'}
                    </p>
                  </div>

                  {confirmDelete === h.id ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-red-600 font-medium">Excluir este registro?</span>
                      <button
                        type="button"
                        disabled={deleting}
                        onClick={() => handleDeletar(h.id)}
                        className="rounded-md bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        {deleting ? '…' : 'Sim'}
                      </button>
                      <button
                        type="button"
                        disabled={deleting}
                        onClick={() => setConfirmDelete(null)}
                        className="rounded-md border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Não
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-4">
                      <p className="text-xs text-gray-400">
                        {formatarResumoTurno(h.turno)}
                      </p>
                      {canWrite && (
                        <button
                          type="button"
                          onClick={() => { setConfirmDelete(h.id); setDeleteErro(null) }}
                          title="Excluir registro"
                          className="rounded-md p-1 text-gray-300 hover:bg-red-50 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
```

por:

```tsx
          {historicoAberto && (
            <div className="divide-y divide-gray-50 border-t border-gray-100">
              {historicoHorario.map((h) => (
                <div key={h.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-700">{h.turno.nome}</p>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                        {calcDuracao(h.data_inicio, h.data_fim)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-gray-400">
                      {fmtMes(h.data_inicio)} – {h.data_fim ? fmtMes(h.data_fim) : 'presente'}
                    </p>
                  </div>

                  <div className="flex items-center gap-4">
                    <p className="text-xs text-gray-400">
                      {formatarResumoTurno(h.turno)}
                    </p>
                    {canWrite && (
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(h.id)}
                        title="Excluir registro"
                        className="rounded-md p-1 text-gray-300 hover:bg-red-50 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
```

Nota: `AlertCircle` continua importado e usado em outros pontos deste arquivo (ex: aviso de data inválida no `ModalAlterarTurno`) — não remover esse import.

- [ ] **Step 4: Adicionar o diálogo**

No bloco final do componente (`{/* ── Modal ── */}`), logo após o `<ModalAlterarTurno .../>`, adicionar:

```tsx
      {confirmDelete && (
        <ConfirmarExclusaoDialog
          open
          onOpenChange={(open) => { if (!open) setConfirmDelete(null) }}
          titulo={`Excluir registro "${historicoHorario.find(h => h.id === confirmDelete)?.turno.nome ?? ''}"?`}
          onConfirmar={() => deletarHorarioFuncionario(confirmDelete)}
        />
      )}
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: nenhum erro em `components/efetivo/tab-horario.tsx`.

- [ ] **Step 6: Commit**

```bash
git add components/efetivo/tab-horario.tsx
git commit -m "feat(efetivo): exclusao de horario historico exige digitar deletar"
```

---

### Task 4: Férias

**Files:**
- Modify: `app/(admin)/ferias/page.tsx`

**Interfaces:**
- Consumes: `ConfirmarExclusaoDialog` de `@/components/ui/confirmar-exclusao-dialog` (Task 1). `excluirFerias` já importado — **retorna `{ ok: true }` e lança exceção em caso de erro** (não bate com o contrato do diálogo), precisa de wrapper local no `onConfirmar`.

- [ ] **Step 1: Adicionar o import**

Junto aos imports de componentes (perto de `import { ModalEditarFerias } from '@/components/ferias/modal-editar-ferias'`), adicionar:

```tsx
import { ConfirmarExclusaoDialog } from '@/components/ui/confirmar-exclusao-dialog'
```

- [ ] **Step 2: Adicionar estado**

Junto aos demais `useState` de `FeriasPageInner` (perto de `const [itemEditando, setItemEditando] = useState<FeriasListaItem | null>(null)`), adicionar:

```tsx
  const [itemExcluindo, setItemExcluindo] = useState<FeriasListaItem | null>(null)
```

- [ ] **Step 3: Trocar o botão de exclusão**

Trocar:

```tsx
                      <button
                        onClick={async () => {
                          if (!confirm(`Excluir registro de férias de ${item.funcionario_nome}? Esta ação não pode ser desfeita.`)) return
                          await excluirFerias(item.id)
                          buscarFeriasLista().then(setFerias)
                        }}
                        className="text-xs text-red-400 hover:text-red-600 underline"
                      >
                        Excluir
                      </button>
```

por:

```tsx
                      <button
                        onClick={() => setItemExcluindo(item)}
                        className="text-xs text-red-400 hover:text-red-600 underline"
                      >
                        Excluir
                      </button>
```

- [ ] **Step 4: Adicionar o diálogo**

Junto aos demais modais renderizados no fim de `FeriasPageInner` (logo após `<ModalEditarFerias .../>`, antes do `</div>` de fechamento), adicionar:

```tsx
      {itemExcluindo && (
        <ConfirmarExclusaoDialog
          open
          onOpenChange={(open) => { if (!open) setItemExcluindo(null) }}
          titulo={`Excluir férias de ${itemExcluindo.funcionario_nome}?`}
          onConfirmar={async () => {
            try {
              await excluirFerias(itemExcluindo.id)
              buscarFeriasLista().then(setFerias)
              return { success: true }
            } catch (err) {
              return { success: false, error: err instanceof Error ? err.message : 'Erro ao excluir' }
            }
          }}
        />
      )}
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: nenhum erro em `app/(admin)/ferias/page.tsx`.

- [ ] **Step 6: Commit**

```bash
git add "app/(admin)/ferias/page.tsx"
git commit -m "feat(ferias): exclusao de registro de ferias exige digitar deletar"
```

---

### Task 5: Faltas

**Files:**
- Modify: `components/faltas/faltas-client.tsx`

**Interfaces:**
- Consumes: `ConfirmarExclusaoDialog` de `@/components/ui/confirmar-exclusao-dialog` (Task 1). `removerFalta` já importado (retorna `{ success: boolean; error?: string }`, sem wrapper necessário).

- [ ] **Step 1: Adicionar o import**

Junto aos imports do topo do arquivo (perto de `import { ModalEditarFalta } from './modal-editar-falta'`), adicionar:

```tsx
import { ConfirmarExclusaoDialog } from '@/components/ui/confirmar-exclusao-dialog'
```

- [ ] **Step 2: Reescrever `RemoverBtn`**

Trocar:

```tsx
function RemoverBtn({ id }: { id: string }) {
  const [pending, start] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (!confirm('Remover esta falta? Esta ação não pode ser desfeita.')) return
          setErro(null)
          start(async () => {
            const res = await removerFalta(id)
            if (!res.success) setErro(res.error ?? 'Erro ao remover')
          })
        }}
        disabled={pending}
        className="text-xs text-red-500 hover:text-red-700 disabled:opacity-40"
      >
        {pending ? '...' : 'Remover'}
      </button>
      {erro && <span className="text-xs text-red-500">{erro}</span>}
    </>
  )
}
```

por:

```tsx
function RemoverBtn({ id, nome }: { id: string; nome?: string | null }) {
  const [confirmando, setConfirmando] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setConfirmando(true)}
        className="text-xs text-red-500 hover:text-red-700"
      >
        Remover
      </button>
      {confirmando && (
        <ConfirmarExclusaoDialog
          open
          onOpenChange={setConfirmando}
          titulo={`Remover falta${nome ? ` de ${nome}` : ''}?`}
          onConfirmar={() => removerFalta(id)}
        />
      )}
    </>
  )
}
```

`useTransition` deixa de ser usado por `RemoverBtn` especificamente, mas continua importado/usado em outras partes deste arquivo — não remover o import.

- [ ] **Step 3: Passar o nome do funcionário ao `RemoverBtn`**

Trocar:

```tsx
                        <RemoverBtn id={f.id} />
```

por:

```tsx
                        <RemoverBtn id={f.id} nome={f.funcionarios?.nome} />
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: nenhum erro em `components/faltas/faltas-client.tsx`.

- [ ] **Step 5: Commit**

```bash
git add components/faltas/faltas-client.tsx
git commit -m "feat(faltas): remocao de falta exige digitar deletar"
```

---

### Task 6: Atestados

**Files:**
- Modify: `components/atestados/atestados-client.tsx`

**Interfaces:**
- Consumes: `ConfirmarExclusaoDialog` de `@/components/ui/confirmar-exclusao-dialog` (Task 1). `deleteAtestado` já importado — **retorna `{ error?: string }` (sem campo `success`)**, precisa de wrapper local no `onConfirmar`.

- [ ] **Step 1: Adicionar o import**

Junto aos imports de componentes locais no topo do arquivo, adicionar:

```tsx
import { ConfirmarExclusaoDialog } from '@/components/ui/confirmar-exclusao-dialog'
```

- [ ] **Step 2: Simplificar o estado de exclusão**

Trocar:

```tsx
  const [excluindoId, setExcluindoId] = useState<string | null>(null)
  const [erroExcluir, setErroExcluir] = useState('')
  const [pendingDelete, setPendingDelete] = useState(false)
```

por:

```tsx
  const [excluindoId, setExcluindoId] = useState<string | null>(null)
```

- [ ] **Step 3: Remover `confirmarExclusao`**

Remover a função inteira (ela não é mais necessária — o `ConfirmarExclusaoDialog` chama `deleteAtestado` diretamente):

```tsx
  async function confirmarExclusao() {
    if (!excluindoId) return
    setPendingDelete(true)
    setErroExcluir('')
    const res = await deleteAtestado(excluindoId)
    setPendingDelete(false)
    if (res.error) { setErroExcluir(res.error); return }
    setExcluindoId(null)
  }
```

- [ ] **Step 4: Simplificar a célula de ações**

Trocar:

```tsx
                    <td className="px-3 py-2">
                      {excluindoId === a.id ? (
                        <div className="flex flex-col gap-1">
                          <p className="text-xs text-gray-600">Tem certeza? Esta ação não pode ser desfeita.</p>
                          {erroExcluir && <p className="text-xs text-red-600">{erroExcluir}</p>}
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={confirmarExclusao}
                              disabled={pendingDelete}
                              className="rounded bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                            >
                              {pendingDelete ? '...' : 'Confirmar'}
                            </button>
                            <button
                              type="button"
                              onClick={() => { setExcluindoId(null); setErroExcluir('') }}
                              className="rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {ultimoAlertaIds.has(a.id) && (
                            <button
                              type="button"
                              onClick={() => setInssModal({
                                funcionario_id: a.funcionario_id,
                                funcionario_nome: a.funcionario_nome,
                                data_inicio: primeiroAtestadoMap.get(a.funcionario_id) ?? a.data_inicio,
                                dias: a.acumulado,
                                motivo: 'INSS - Doença',
                              })}
                              className="rounded border border-red-300 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-100"
                            >
                              Solicitar INSS
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setEditando(a)}
                            className="rounded border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => setExcluindoId(a.id)}
                            className="rounded border border-red-200 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                          >
                            Excluir
                          </button>
                        </div>
                      )}
                    </td>
```

por:

```tsx
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1.5">
                        {ultimoAlertaIds.has(a.id) && (
                          <button
                            type="button"
                            onClick={() => setInssModal({
                              funcionario_id: a.funcionario_id,
                              funcionario_nome: a.funcionario_nome,
                              data_inicio: primeiroAtestadoMap.get(a.funcionario_id) ?? a.data_inicio,
                              dias: a.acumulado,
                              motivo: 'INSS - Doença',
                            })}
                            className="rounded border border-red-300 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-100"
                          >
                            Solicitar INSS
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setEditando(a)}
                          className="rounded border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => setExcluindoId(a.id)}
                          className="rounded border border-red-200 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                        >
                          Excluir
                        </button>
                      </div>
                    </td>
```

- [ ] **Step 5: Adicionar o diálogo**

Logo após `<ModalEditarAtestado .../>` (antes do bloco `{inssModal && (...)}`), adicionar:

```tsx
      {excluindoId && (
        <ConfirmarExclusaoDialog
          open
          onOpenChange={(open) => { if (!open) setExcluindoId(null) }}
          titulo={`Excluir atestado de ${atestados.find(x => x.id === excluindoId)?.funcionario_nome ?? ''}?`}
          onConfirmar={async () => {
            const res = await deleteAtestado(excluindoId)
            return { success: !res.error, error: res.error }
          }}
        />
      )}
```

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: nenhum erro em `components/atestados/atestados-client.tsx`.

- [ ] **Step 7: Commit**

```bash
git add components/atestados/atestados-client.tsx
git commit -m "feat(atestados): exclusao de atestado exige digitar deletar"
```

---

### Task 7: Advertências

**Files:**
- Modify: `components/advertencias/advertencias-table.tsx`

**Interfaces:**
- Consumes: `ConfirmarExclusaoDialog` de `@/components/ui/confirmar-exclusao-dialog` (Task 1). `excluirAdvertencia` já importado — **não retorna nada (`void`) e lança exceção em caso de erro**, precisa de wrapper local no `onConfirmar`.

- [ ] **Step 1: Adicionar o import**

Junto aos imports de componentes locais no topo do arquivo, adicionar:

```tsx
import { ConfirmarExclusaoDialog } from '@/components/ui/confirmar-exclusao-dialog'
```

- [ ] **Step 2: Remover `excluindo`/`handleExcluir`, manter `confirmandoExclusao`**

Trocar:

```tsx
  const [confirmandoExclusao, setConfirmandoExclusao] = useState<string | null>(null)
  const [excluindo,           setExcluindo]           = useState(false)
```

por:

```tsx
  const [confirmandoExclusao, setConfirmandoExclusao] = useState<string | null>(null)
```

Remover a função `handleExcluir` inteira:

```tsx
  async function handleExcluir(id: string) {
    setExcluindo(true)
    try {
      await excluirAdvertencia(id)
      setLista(prev => prev.filter(a => a.id !== id))
      setConfirmandoExclusao(null)
    } catch (err: unknown) {
      alert('Erro ao excluir: ' + (err instanceof Error ? err.message : 'Erro desconhecido'))
    } finally {
      setExcluindo(false)
    }
  }
```

- [ ] **Step 3: Trocar o modal de confirmação bespoke**

Trocar:

```tsx
      {/* Confirmação de exclusão */}
      {confirmandoExclusao && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-2">Excluir Advertência</h3>
            <p className="text-sm text-gray-500 mb-6">
              Tem certeza que deseja excluir esta advertência? Esta ação não pode ser desfeita.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmandoExclusao(null)}
                className="flex h-9 items-center rounded-lg border border-gray-200 px-4 text-sm font-medium text-gray-500 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleExcluir(confirmandoExclusao)}
                disabled={excluindo}
                className="flex h-9 items-center rounded-lg bg-red-600 px-4 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {excluindo ? 'Excluindo...' : 'Confirmar Exclusão'}
              </button>
            </div>
          </div>
        </div>
      )}
```

por:

```tsx
      {confirmandoExclusao && (
        <ConfirmarExclusaoDialog
          open
          onOpenChange={(open) => { if (!open) setConfirmandoExclusao(null) }}
          titulo="Excluir advertência?"
          onConfirmar={async () => {
            try {
              await excluirAdvertencia(confirmandoExclusao)
              setLista(prev => prev.filter(a => a.id !== confirmandoExclusao))
              return { success: true }
            } catch (err) {
              return { success: false, error: err instanceof Error ? err.message : 'Erro ao excluir' }
            }
          }}
        />
      )}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: nenhum erro em `components/advertencias/advertencias-table.tsx`.

- [ ] **Step 5: Commit**

```bash
git add components/advertencias/advertencias-table.tsx
git commit -m "feat(advertencias): exclusao de advertencia exige digitar deletar"
```

---

### Task 8: Acordos de compensação

**Files:**
- Modify: `components/acordos/acordos-client.tsx`

**Interfaces:**
- Consumes: `ConfirmarExclusaoDialog` de `@/components/ui/confirmar-exclusao-dialog` (Task 1). `excluirAcordo` já importado — **retorna `{ error?: string }` (sem campo `success`)**, precisa de wrapper local no `onConfirmar`.

- [ ] **Step 1: Adicionar o import**

Junto aos imports de componentes locais no topo do arquivo, adicionar:

```tsx
import { ConfirmarExclusaoDialog } from '@/components/ui/confirmar-exclusao-dialog'
```

- [ ] **Step 2: Trocar `deletando` por `excluindo` (objeto completo)**

Trocar:

```tsx
  const [deletando, setDeletando]   = useState<string | null>(null)
```

por:

```tsx
  const [excluindo, setExcluindo]   = useState<AcordoCompensacao | null>(null)
```

(confirme o tipo `AcordoCompensacao` já importado neste arquivo — é o mesmo tipo usado em `handlePdf(acordo: AcordoCompensacao)`.)

- [ ] **Step 3: Remover `handleDelete`**

Remover a função inteira:

```tsx
  async function handleDelete(id: string) {
    if (!confirm('Excluir este acordo? Esta ação não pode ser desfeita.')) return
    setDeletando(id)
    await excluirAcordo(id)
    setDeletando(null)
    router.refresh()
  }
```

- [ ] **Step 4: Trocar o botão de exclusão**

Trocar:

```tsx
                  <button
                    onClick={() => handleDelete(a.id)}
                    disabled={deletando === a.id}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-40"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
```

por:

```tsx
                  <button
                    onClick={() => setExcluindo(a)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
```

- [ ] **Step 5: Adicionar o diálogo**

Em `components/acordos/acordos-client.tsx`, logo após o bloco `{editando && (<ModalEditarAcordo .../>)}` (antes do `</>` de fechamento do componente), adicionar:

```tsx
      {excluindo && (
        <ConfirmarExclusaoDialog
          open
          onOpenChange={(open) => { if (!open) setExcluindo(null) }}
          titulo={`Excluir acordo "${excluindo.titulo}"?`}
          onConfirmar={async () => {
            const res = await excluirAcordo(excluindo.id)
            if (!res.error) router.refresh()
            return { success: !res.error, error: res.error }
          }}
        />
      )}
```

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: nenhum erro em `components/acordos/acordos-client.tsx`.

- [ ] **Step 7: Commit**

```bash
git add components/acordos/acordos-client.tsx
git commit -m "feat(acordos): exclusao de acordo exige digitar deletar"
```

---

### Task 9: Insalubridade — remoção de dia e exclusão de cobertura

**Files:**
- Modify: `components/insalubridade/insalubridade-table.tsx`

**Interfaces:**
- Consumes: `ConfirmarExclusaoDialog` de `@/components/ui/confirmar-exclusao-dialog` (Task 1). `removerDia` já importado — **não retorna nada e nunca propaga erro pro chamador** (só `console.error` no servidor); o wrapper sempre reporta sucesso, é uma limitação pré-existente que este trabalho não resolve (não altera a Server Action). `excluirCobertura` já importado — **retorna `{ error?: string }`**, precisa de wrapper.

Este arquivo tem **dois pontos de exclusão** independentes: `RemoverBtn` (usuários não-admin, sem confirmação hoje) e o fluxo admin via `handleExcluir` (`window.confirm` hoje).

- [ ] **Step 1: Adicionar o import**

Junto aos imports de componentes locais no topo do arquivo, adicionar:

```tsx
import { ConfirmarExclusaoDialog } from '@/components/ui/confirmar-exclusao-dialog'
```

- [ ] **Step 2: Reescrever `RemoverBtn`**

Trocar:

```tsx
function RemoverBtn({ id }: { id: string }) {
  const [pending, start] = useTransition()
  return (
    <button
      onClick={() => start(() => removerDia(id))}
      disabled={pending}
      className="text-xs text-red-500 hover:text-red-700 disabled:opacity-40"
    >
      {pending ? '...' : 'Remover'}
    </button>
  )
}
```

por:

```tsx
function RemoverBtn({ id, agenteAusente, data }: { id: string; agenteAusente: string | null; data: string }) {
  const [confirmando, setConfirmando] = useState(false)
  return (
    <>
      <button
        onClick={() => setConfirmando(true)}
        className="text-xs text-red-500 hover:text-red-700"
      >
        Remover
      </button>
      {confirmando && (
        <ConfirmarExclusaoDialog
          open
          onOpenChange={setConfirmando}
          titulo={`Remover cobertura de ${agenteAusente ?? 'agente ausente'} em ${data}?`}
          onConfirmar={async () => {
            await removerDia(id)
            return { success: true }
          }}
        />
      )}
    </>
  )
}
```

- [ ] **Step 3: Passar contexto ao `RemoverBtn`**

Trocar:

```tsx
                                      {r.origem === 'manual' && !isAdmin && <RemoverBtn id={r.id} />}
```

por:

```tsx
                                      {r.origem === 'manual' && !isAdmin && (
                                        <RemoverBtn id={r.id} agenteAusente={r.agente_ausente_nome} data={fmt(r.data_cobertura)} />
                                      )}
```

- [ ] **Step 4: Remover `handleExcluir`, adicionar estado**

Remover esta função inteira (sem substituição — o `ConfirmarExclusaoDialog` chama `excluirCobertura` diretamente no `onConfirmar`, adicionado no Step 6):

```tsx
  async function handleExcluir(id: string) {
    if (!window.confirm('Excluir esta cobertura? Esta ação não pode ser desfeita.')) return
    const result = await excluirCobertura(id)
    if (result.error) alert(result.error)
    else router.refresh()
  }
```

Junto aos demais `useState` do componente (perto de `const [editandoId, setEditandoId] = useState<string | null>(null)`), adicionar:

```tsx
  const [excluindoCobertura, setExcluindoCobertura] = useState<InsalubridadeCobertura | null>(null)
```

- [ ] **Step 5: Trocar o botão de exclusão (fluxo admin)**

Trocar:

```tsx
                                          <button
                                            onClick={() => handleExcluir(r.id)}
                                            className="text-xs text-red-500 hover:text-red-700"
                                          >
                                            Excluir
                                          </button>
```

por:

```tsx
                                          <button
                                            onClick={() => setExcluindoCobertura(r)}
                                            className="text-xs text-red-500 hover:text-red-700"
                                          >
                                            Excluir
                                          </button>
```

- [ ] **Step 6: Adicionar o diálogo**

Logo após `<ModalNovaInsalubridade .../>` (antes do `</>` de fechamento do componente), adicionar:

```tsx
      {excluindoCobertura && (
        <ConfirmarExclusaoDialog
          open
          onOpenChange={(open) => { if (!open) setExcluindoCobertura(null) }}
          titulo={`Excluir cobertura de ${excluindoCobertura.agente_ausente_nome ?? 'agente ausente'} em ${fmt(excluindoCobertura.data_cobertura)}?`}
          onConfirmar={async () => {
            const res = await excluirCobertura(excluindoCobertura.id)
            if (!res.error) router.refresh()
            return { success: !res.error, error: res.error }
          }}
        />
      )}
```

- [ ] **Step 7: Type-check**

Run: `npx tsc --noEmit`
Expected: nenhum erro em `components/insalubridade/insalubridade-table.tsx`.

- [ ] **Step 8: Commit**

```bash
git add components/insalubridade/insalubridade-table.tsx
git commit -m "feat(insalubridade): remocao de dia e exclusao de cobertura exigem digitar deletar"
```

---

### Task 10: Mudanças de Função

**Files:**
- Modify: `components/mudancas-funcao/mudancas-funcao-client.tsx`

**Interfaces:**
- Consumes: `ConfirmarExclusaoDialog` de `@/components/ui/confirmar-exclusao-dialog` (Task 1). `excluirMudancaFuncao` já importado (retorna `{ success: boolean; error: string }` — já bate com o contrato, sem wrapper de shape, só precisa embrulhar a montagem do `FormData`).

Este arquivo já usa o `AlertDialog` genérico (é o único caso do sistema que já reaproveita esse componente) — mas ainda não exige a palavra "deletar". Substituir pelo `ConfirmarExclusaoDialog` unifica com os outros 9 pontos e adiciona a exigência.

- [ ] **Step 1: Trocar o import do AlertDialog pelo novo componente**

Trocar:

```tsx
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
```

por:

```tsx
import { ConfirmarExclusaoDialog } from '@/components/ui/confirmar-exclusao-dialog'
```

- [ ] **Step 2: Reescrever `DialogExcluir`**

Trocar:

```tsx
function DialogExcluir({ row, onClose }: DialogExcluirProps) {
  const [erro,    setErro]    = useState('')
  const [pending, startTransition] = useTransition()

  function handleConfirmar() {
    const fd = new FormData()
    fd.set('movimentacao_id', row.id)
    if (row.solicitacao_id)   fd.set('solicitacao_id', row.solicitacao_id)
    fd.set('funcionario_id',  row.funcionario_id)
    if (row.funcao_anterior_id) fd.set('funcao_anterior_id', row.funcao_anterior_id)
    startTransition(async () => {
      const res = await excluirMudancaFuncao(fd)
      if (!res.success) { setErro(res.error); return }
      onClose()
    })
  }

  return (
    <AlertDialog open onOpenChange={open => { if (!open) onClose() }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirmar exclusão?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta ação irá reverter a função de <strong>{row.nome}</strong> para{' '}
            <strong>{row.funcao_anterior}</strong>. O registro de mudança será removido permanentemente.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {erro && <p className="text-sm text-red-600 px-1">{erro}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirmar}
            disabled={pending}
            className="bg-red-600 text-white hover:bg-red-700 focus:ring-red-600 disabled:opacity-40"
          >
            {pending ? 'Excluindo…' : 'Confirmar Exclusão'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
```

por:

```tsx
function DialogExcluir({ row, onClose }: DialogExcluirProps) {
  return (
    <ConfirmarExclusaoDialog
      open
      onOpenChange={(open) => { if (!open) onClose() }}
      titulo="Confirmar exclusão?"
      descricao={
        <>
          Esta ação irá reverter a função de <strong>{row.nome}</strong> para{' '}
          <strong>{row.funcao_anterior}</strong>. O registro de mudança será removido permanentemente.
        </>
      }
      onConfirmar={async () => {
        const fd = new FormData()
        fd.set('movimentacao_id', row.id)
        if (row.solicitacao_id)   fd.set('solicitacao_id', row.solicitacao_id)
        fd.set('funcionario_id',  row.funcionario_id)
        if (row.funcao_anterior_id) fd.set('funcao_anterior_id', row.funcao_anterior_id)
        const res = await excluirMudancaFuncao(fd)
        if (res.success) onClose()
        return res
      }}
    />
  )
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: nenhum erro em `components/mudancas-funcao/mudancas-funcao-client.tsx`.

- [ ] **Step 4: Commit**

```bash
git add components/mudancas-funcao/mudancas-funcao-client.tsx
git commit -m "feat(mudancas-funcao): exclusao de mudanca de funcao passa a exigir digitar deletar"
```

---

### Task 11: Verificação final — build e teste manual

**Files:** nenhum (apenas verificação)

- [ ] **Step 1: Build de produção**

Run: `npm run build`
Expected: build conclui sem erros.

- [ ] **Step 2: Verificação estática — nenhum ponto esquecido**

Rode:
```bash
grep -rn "window.confirm\|confirm(\`\|confirm('" app components --include="*.tsx" | grep -iv "desativar\|toggleAtivo\|desvincular\|Marcar como entregue\|Marcar como enviado"
```
Expected: nenhum resultado relacionado a exclusão definitiva (os 10 pontos deste plano). Resultados relacionados a desativação/soft-delete (postos, turnos, usuários, supervisores) são esperados e ficam de fora do escopo.

- [ ] **Step 3: Teste manual — cada um dos 10 pontos**

Suba o dev server (`preview_start`) e, logado como admin, teste cada ponto:

1. **Efetivo**: tentar excluir um funcionário de teste. Confirme: modal exige digitar "deletar" (teste com "DELETAR" maiúsculo também — deve funcionar), botão "Excluir" fica desabilitado até bater a palavra, exclusão funciona ao confirmar.
2. **Horário do funcionário**: aba Horário → histórico → excluir um registro antigo (não o vigente). Mesma verificação.
3. **Férias**: excluir um registro de férias.
4. **Faltas**: remover uma falta.
5. **Atestados**: excluir um atestado.
6. **Advertências**: excluir uma advertência.
7. **Acordos de compensação**: excluir um acordo.
8. **Insalubridade**: testar os dois fluxos — remoção de dia (usuário comum) e exclusão de cobertura (admin).
9. **Mudanças de função**: excluir um registro.

Para cada um: confirme que cancelar fecha o diálogo sem excluir nada, que um erro do servidor (se conseguir simular) aparece dentro do diálogo sem fechá-lo, e que o item realmente some da lista após a exclusão confirmada.

- [ ] **Step 4: Teste manual — exceções permanecem intocadas**

Confirme que **não mudou nada** em: desativar um posto, desativar um turno, ativar/desativar um usuário, desvincular um supervisor de um posto, excluir notificações do sino (admin) — todos continuam com o comportamento de antes (sem a exigência de digitar "deletar").

- [ ] **Step 5: Screenshot de evidência**

Capture o diálogo de confirmação aberto em pelo menos 2 pontos diferentes (ex: Efetivo e Advertências) para registro.

- [ ] **Step 6: Commit final (se necessário)**

Se qualquer ajuste foi feito durante a verificação manual, commitar separadamente. Caso contrário, este task não gera commit.
