# Visibilidade de Afastamentos Sem Data Rastreada Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Funcionários `afastado` sem nenhum registro em `afastamentos` (invisíveis pros alertas de INSS) passam a poder ser cadastrados direto pelo modal "Prorrogar", e a tabela Efetivo ganha uma coluna mostrando a data prevista de retorno de todo mundo afastado — com ou sem data.

**Architecture:** Nova Server Action `cadastrarAfastamentoRastreado` cria o registro que falta; o modal existente passa a oferecer esse formulário quando não há afastamento aberto. A página Efetivo ganha uma query nova (mesmo padrão já usado pra `origem_ocupacional` dos afastados) que popula `data_fim_prevista` em cada `FuncionarioRow`, renderizada numa coluna nova na tabela.

**Tech Stack:** Next.js 14 Server Actions, Supabase, TypeScript.

**Nota sobre testes:** projeto sem test runner configurado. Verificação via `npx tsc --noEmit` e `npm run build` (roda `next lint`).

---

## Arquivos

- Modificar `app/(admin)/efetivo/actions.ts` — Server Action nova `cadastrarAfastamentoRastreado`
- Modificar `components/efetivo/modal-prorrogar-afastamento.tsx` — reescrita completa (adiciona modo "cadastrar")
- Modificar `components/efetivo/funcionarios-table.tsx` — campo novo em `FuncionarioRow`, coluna nova
- Modificar `app/(admin)/efetivo/page.tsx` — query nova + merge de `data_fim_prevista`

---

### Task 1: Server Action `cadastrarAfastamentoRastreado`

**Files:**
- Modify: `app/(admin)/efetivo/actions.ts`

- [ ] **Step 1: Adicionar a action no final do arquivo**

```typescript

export async function cadastrarAfastamentoRastreado(
  funcionarioId: string,
  dataInicio: string,
  dataFimPrevista: string,
): Promise<ActionResult> {
  const auth = await getUser()
  if (!auth) return { success: false, error: 'Não autenticado' }
  if (auth.perfil.role !== 'admin' && auth.perfil.role !== 'coordenador') {
    return { success: false, error: 'Apenas admin/coordenador podem cadastrar afastamento' }
  }
  if (dataFimPrevista < dataInicio) {
    return { success: false, error: 'Data prevista não pode ser anterior à data de início' }
  }

  const supabase = createClient()
  const { data: func, error: errFunc } = await supabase
    .from('funcionarios')
    .select('id, status')
    .eq('id', funcionarioId)
    .single()

  if (errFunc || !func) return { success: false, error: 'Funcionário não encontrado' }
  if (func.status !== 'afastado') {
    return { success: false, error: 'Funcionário não está com status afastado' }
  }

  const { error: errInsert } = await supabase.from('afastamentos').insert({
    funcionario_id: funcionarioId,
    data_inicio: dataInicio,
    data_fim_prevista: dataFimPrevista,
    motivo: null,
    solicitacao_id: null,
  })

  if (errInsert) return { success: false, error: errInsert.message }

  const { error: errMov } = await supabase.from('movimentacoes').insert({
    funcionario_id: funcionarioId,
    tipo: 'afastamento',
    campo_alterado: 'cadastro_manual',
    valor_antes: null,
    valor_depois: JSON.stringify({ data_inicio: dataInicio, data_fim_prevista: dataFimPrevista }),
    executado_por: auth.user.id,
  })
  if (errMov) console.error('[movimentacoes] cadastrarAfastamentoRastreado:', errMov.message)

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
git commit -m "feat(efetivo): server action para cadastrar afastamento sem registro previo

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Modal ganha modo "cadastrar"

**Files:**
- Modify: `components/efetivo/modal-prorrogar-afastamento.tsx`

Este arquivo é pequeno (132 linhas) e a mudança toca a maior parte do JSX — reescrever o arquivo inteiro em vez de fazer edições pontuais.

- [ ] **Step 1: Substituir o conteúdo inteiro do arquivo**

```typescript
'use client'

import { useEffect, useState } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { buscarAfastamentoAberto, prorrogarAfastamento, cadastrarAfastamentoRastreado } from '@/app/(admin)/efetivo/actions'
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
  const [novaDataInicio, setNovaDataInicio] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelado = false
    setCarregando(true)
    setErro(null)
    buscarAfastamentoAberto(funcionario.id).then(res => {
      if (cancelado) return
      if (!res) {
        setAfastamentoId(null)
        setDataAtual(null)
      } else {
        setAfastamentoId(res.id)
        setDataAtual(res.dataFimPrevista)
        setNovaData(res.dataFimPrevista ?? '')
      }
      setCarregando(false)
    }).catch(err => {
      if (cancelado) return
      setErro(err instanceof Error ? err.message : 'Erro ao buscar afastamento')
      setCarregando(false)
    })
    return () => { cancelado = true }
  }, [open, funcionario.id])

  function resetState() {
    setNovaData('')
    setNovaDataInicio('')
    setErro(null)
  }

  async function handleSubmitEdicao(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!afastamentoId) return
    setErro(null)
    setPending(true)
    try {
      const res = await prorrogarAfastamento(afastamentoId, novaData)
      if (!res.success) {
        setErro(res.error ?? 'Erro ao prorrogar')
        return
      }
      resetState()
      onClose()
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao prorrogar afastamento')
    } finally {
      setPending(false)
    }
  }

  async function handleSubmitCadastro(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErro(null)
    setPending(true)
    try {
      const res = await cadastrarAfastamentoRastreado(funcionario.id, novaDataInicio, novaData)
      if (!res.success) {
        setErro(res.error ?? 'Erro ao cadastrar')
        return
      }
      resetState()
      onClose()
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao cadastrar afastamento')
    } finally {
      setPending(false)
    }
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
            <>
              <div className="mb-4 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                Nenhum afastamento rastreado pra esse funcionário. Cadastre a data pra ele passar a entrar
                nos alertas de retorno vencido.
              </div>
              <form onSubmit={handleSubmitCadastro} className="space-y-4">
                <div>
                  <label className={labelClass}>Data de início</label>
                  <input
                    type="date"
                    required
                    value={novaDataInicio}
                    onChange={e => setNovaDataInicio(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Data prevista de retorno</label>
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
                    {pending ? 'Salvando...' : 'Cadastrar'}
                  </button>
                </div>
              </form>
            </>
          ) : (
            <form onSubmit={handleSubmitEdicao} className="space-y-4">
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
git commit -m "feat(efetivo): modal prorrogar tambem cadastra quando nao ha afastamento rastreado

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: `data_fim_prevista` em `FuncionarioRow` + query em `page.tsx`

**Files:**
- Modify: `components/efetivo/funcionarios-table.tsx`
- Modify: `app/(admin)/efetivo/page.tsx`

- [ ] **Step 1: Campo novo no tipo `FuncionarioRow`**

Localizar (por volta da linha 17-44):

```typescript
export type FuncionarioRow = {
  id: string
  nome: string
  registro: string | null
  cpf: string | null
  pcd: boolean | null
  pcd_tipo: string | null
  pcd_tipo_outro: string | null
  status: 'ativo' | 'atestado' | 'afastado' | 'ferias' | 'desligado' | 'faltante' | 'rescisao_indireta' | null
  motivo_afastamento: 'ausencia_temporaria' | 'inss' | null
  origem_ocupacional_cat: string | null
```

Substituir por:

```typescript
export type FuncionarioRow = {
  id: string
  nome: string
  registro: string | null
  cpf: string | null
  pcd: boolean | null
  pcd_tipo: string | null
  pcd_tipo_outro: string | null
  status: 'ativo' | 'atestado' | 'afastado' | 'ferias' | 'desligado' | 'faltante' | 'rescisao_indireta' | null
  motivo_afastamento: 'ausencia_temporaria' | 'inss' | null
  origem_ocupacional_cat: string | null
  data_fim_prevista_afastamento?: string | null
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: sem erros novos em `components/efetivo/funcionarios-table.tsx` (o campo é opcional, então não quebra nenhum lugar que já monta `FuncionarioRow` sem ele)

- [ ] **Step 3: Commit**

```bash
git add components/efetivo/funcionarios-table.tsx
git commit -m "feat(efetivo): campo data_fim_prevista_afastamento em FuncionarioRow

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

- [ ] **Step 4: Adicionar a query e o merge em `page.tsx`**

Localizar o bloco que busca `catOrigemMap` (por volta das linhas 131-146):

```typescript
  // Para cada afastado, buscar o atestado mais recente (sem filtro data_fim)
  // e usar a origem_ocupacional dele — o status 'afastado' já garante que
  // esse é o motivo atual; o que importa é a origem, não se a data_fim passou.
  const rawFuncs = (raw ?? []) as unknown as FuncionarioRow[]
  const afastadoIds = rawFuncs.filter(f => f.status === 'afastado' || f.status === 'atestado').map(f => f.id)
  const catOrigemMap = new Map<string, string | null>()
  if (afastadoIds.length > 0) {
    const { data: catData } = await supabase
      .from('atestados')
      .select('funcionario_id, origem_ocupacional')
      .in('funcionario_id', afastadoIds)
      .order('data_inicio', { ascending: false })
    for (const c of (catData ?? []) as unknown as { funcionario_id: string; origem_ocupacional: string | null }[]) {
      if (!catOrigemMap.has(c.funcionario_id)) {
        catOrigemMap.set(c.funcionario_id, c.origem_ocupacional)
      }
    }
  }
```

Adicionar logo depois:

```typescript

  // Data prevista de retorno do afastamento aberto (data_fim_real IS NULL) de cada
  // funcionário afastado — o mais recente, quando há mais de um aberto.
  const afastamentoPrevistoMap = new Map<string, string | null>()
  const soAfastadoIds = rawFuncs.filter(f => f.status === 'afastado').map(f => f.id)
  if (soAfastadoIds.length > 0) {
    const { data: afastData } = await supabase
      .from('afastamentos')
      .select('funcionario_id, data_fim_prevista')
      .in('funcionario_id', soAfastadoIds)
      .is('data_fim_real', null)
      .order('created_at', { ascending: false })
    for (const a of (afastData ?? []) as unknown as { funcionario_id: string; data_fim_prevista: string | null }[]) {
      if (!afastamentoPrevistoMap.has(a.funcionario_id)) {
        afastamentoPrevistoMap.set(a.funcionario_id, a.data_fim_prevista)
      }
    }
  }
```

Localizar o `.map()` que enriquece `funcionarios` (por volta das linhas 210-222):

```typescript
  // Enrich ALL funcionarios with supervisor_nome + supervisor_id + origem_ocupacional_cat + turno_atual
  const funcionarios = rawFuncs.map(f => {
    const sup = f.posto_id ? postoSupervisorMap.get(f.posto_id) : undefined
    const horario = horarioMap.get(f.id)
    return {
      ...f,
      supervisor_nome:        sup?.nomeCompleto ?? null,
      supervisor_id:          sup?.id ?? null,
      origem_ocupacional_cat: catOrigemMap.get(f.id) ?? null,
      turno_atual_nome:       horario?.nome ?? null,
      turno_atual_regime:     horario?.regime ?? null,
      turno_atual_resumo:     horario?.resumo ?? null,
    }
  })
```

Substituir por:

```typescript
  // Enrich ALL funcionarios with supervisor_nome + supervisor_id + origem_ocupacional_cat + turno_atual
  const funcionarios = rawFuncs.map(f => {
    const sup = f.posto_id ? postoSupervisorMap.get(f.posto_id) : undefined
    const horario = horarioMap.get(f.id)
    return {
      ...f,
      supervisor_nome:        sup?.nomeCompleto ?? null,
      supervisor_id:          sup?.id ?? null,
      origem_ocupacional_cat: catOrigemMap.get(f.id) ?? null,
      turno_atual_nome:       horario?.nome ?? null,
      turno_atual_regime:     horario?.regime ?? null,
      turno_atual_resumo:     horario?.resumo ?? null,
      data_fim_prevista_afastamento: f.status === 'afastado' ? (afastamentoPrevistoMap.get(f.id) ?? null) : null,
    }
  })
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: sem erros novos em `app/(admin)/efetivo/page.tsx`

- [ ] **Step 6: Commit**

```bash
git add "app/(admin)/efetivo/page.tsx"
git commit -m "feat(efetivo): busca data prevista de retorno pra tabela

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Coluna "Retorno Previsto" na tabela

**Files:**
- Modify: `components/efetivo/funcionarios-table.tsx`

- [ ] **Step 1: Adicionar a coluna em `COLS`**

Localizar (por volta da linha 84-93):

```typescript
const COLS: { label: string; sortKey?: string }[] = [
  { label: 'Registro'                           },
  { label: 'Nome',       sortKey: 'nome'       },
  { label: 'Função',     sortKey: 'funcao'     },
  { label: 'Posto',      sortKey: 'posto'      },
  { label: 'Secretaria', sortKey: 'secretaria' },
  { label: 'Supervisor'                         },
  { label: 'Status',     sortKey: 'status'     },
  { label: 'Ações'                              },
]
```

Substituir por:

```typescript
const COLS: { label: string; sortKey?: string }[] = [
  { label: 'Registro'                           },
  { label: 'Nome',       sortKey: 'nome'       },
  { label: 'Função',     sortKey: 'funcao'     },
  { label: 'Posto',      sortKey: 'posto'      },
  { label: 'Secretaria', sortKey: 'secretaria' },
  { label: 'Supervisor'                         },
  { label: 'Status',     sortKey: 'status'     },
  { label: 'Retorno Previsto'                   },
  { label: 'Ações'                              },
]
```

- [ ] **Step 2: Adicionar helper de formatação e a célula da coluna**

Localizar `fmtSupervisor` (por volta da linha 51-56):

```typescript
function fmtSupervisor(nome: string | null | undefined): string | null {
  if (!nome) return null
  const parts = nome.trim().split(/\s+/)
  if (parts.length === 1) return parts[0]
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`
}
```

Adicionar logo depois:

```typescript

function fmtRetornoPrevisto(data: string | null | undefined): { texto: string; vencido: boolean; semData: boolean } {
  if (!data) return { texto: 'sem data', vencido: false, semData: true }
  const hoje = new Date().toISOString().split('T')[0]
  const formatada = data.split('-').reverse().join('/')
  return { texto: formatada, vencido: data < hoje, semData: false }
}
```

Localizar a célula de Status (o `<td>` que termina o bloco do badge, por volta da linha 218-251, procure pelo fechamento `) : '—'}\n                      </td>` logo antes do `<td className="px-5 py-3.5">` das Ações). Adicionar uma nova `<td>` entre essas duas, ou seja logo depois do fechamento da célula de Status e antes da célula de Ações:

```typescript
                      <td className="px-5 py-3.5">
                        {f.status === 'afastado' ? (() => {
                          const r = fmtRetornoPrevisto(f.data_fim_prevista_afastamento)
                          return (
                            <span className={cn(
                              'text-xs',
                              r.semData ? 'text-gray-400 italic' : r.vencido ? 'font-semibold text-red-600' : 'text-gray-600',
                            )}>
                              {r.texto}{r.vencido && !r.semData ? ' (vencido)' : ''}
                            </span>
                          )
                        })() : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: sem erros novos em `components/efetivo/funcionarios-table.tsx`

- [ ] **Step 4: Build completo (inclui lint)**

Run: `npm run build`
Expected: `✓ Compiled successfully`, sem erros de lint

- [ ] **Step 5: Commit**

```bash
git add components/efetivo/funcionarios-table.tsx
git commit -m "feat(efetivo): coluna retorno previsto na tabela

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Verificação manual (checkpoint, sem commit)

**Files:** nenhum

- [ ] **Step 1:** Rodar `npm run dev`, logar como admin, ir em `/efetivo`.
- [ ] **Step 2:** Confirmar a coluna "Retorno Previsto" aparece — funcionários não-afastados mostram "—", afastados sem data mostram "sem data" em itálico cinza, afastados com data futura mostram a data normal, afastados com data passada mostram vermelho + "(vencido)".
- [ ] **Step 3:** Clicar "Prorrogar" na ADRIANA APARECIDA ALVES (ou outro funcionário afastado sem afastamento rastreado) — confirmar que agora aparece o formulário de cadastro (Data de Início + Data Prevista), não só o aviso.
- [ ] **Step 4:** Cadastrar uma data, confirmar que salva sem erro e que a coluna "Retorno Previsto" da linha dela atualiza.
- [ ] **Step 5:** Clicar "Prorrogar" de novo nela — confirmar que agora mostra o formulário de edição normal (já tem afastamento rastreado).
- [ ] **Step 6:** Reportar o resultado ao usuário — sem commit nesta task.
