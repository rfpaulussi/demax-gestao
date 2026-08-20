# Agrupamento de Atestados por Episódio (INSS) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O modal "Solicitar INSS" em `/atestados` calcula corretamente o período do episódio de doença (mesma CID ou "sem CID" como ponte, gap ≤60 dias) que contém o atestado que disparou o alerta, em vez de somar dias brutos de 30 dias e pegar a data do atestado mais antigo de toda a história do funcionário.

**Architecture:** Função pura nova (`lib/atestados/episodio-inss.ts`) faz o agrupamento cronológico a partir de um atestado-âncora; uma Server Action nova (`calcularEpisodioInssAction`) busca todos os atestados do funcionário no banco (não usa o array já filtrado no client) e chama a função pura; o client (`atestados-client.tsx`) chama a action ao clicar em "Solicitar INSS", pré-preenche o modal com o resultado e mostra a lista de atestados incluídos — todos os campos continuam editáveis.

**Tech Stack:** TypeScript, Next.js Server Actions, Supabase.

**Nota sobre testes:** projeto sem test runner configurado. Verificação de lógica pura via harness descartável (`npx tsx`, deletado antes do commit). Verificação de integração via `npx tsc --noEmit` e `npm run build` (que roda `next lint` — já causou falha de deploy antes por `no-unused-vars`, então rodar sempre antes de commitar).

---

## Arquivos

- Criar `lib/atestados/episodio-inss.ts` — função pura de agrupamento
- Modificar `app/(admin)/atestados/actions.ts` — nova Server Action `calcularEpisodioInssAction`
- Modificar `components/atestados/atestados-client.tsx` — chama a action, mostra loading, exibe lista de atestados do episódio no modal

---

### Task 1: Função pura de agrupamento por episódio

**Files:**
- Create: `lib/atestados/episodio-inss.ts`

- [ ] **Step 1: Criar o arquivo**

```typescript
// lib/atestados/episodio-inss.ts

export type AtestadoParaEpisodio = {
  id: string
  dataInicio: string  // ISO yyyy-mm-dd
  dataFim: string     // ISO yyyy-mm-dd
  cidCodigo: string | null
}

export type EpisodioInss = {
  dataInicio: string
  dataFim: string
  dias: number
  atestadosIncluidos: AtestadoParaEpisodio[]
}

const JANELA_MESMA_DOENCA_DIAS = 60

function calcDias(inicio: string, fim: string): number {
  const [ay, am, ad] = inicio.split('-').map(Number)
  const [by, bm, bd] = fim.split('-').map(Number)
  const a = new Date(ay, am - 1, ad)
  const b = new Date(by, bm - 1, bd)
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24)) + 1
}

/** Dias corridos ENTRE o fim de um atestado e o início do próximo (exclusive dos dois extremos).
 *  0 quando o próximo começa no dia seguinte ao fim do anterior (emendados). */
function gapDias(fimAnterior: string, inicioProximo: string): number {
  return calcDias(fimAnterior, inicioProximo) - 2
}

/** CID igual conta como mesma doença; "sem CID" (null) funciona como ponte — não quebra o
 *  encadeamento mesmo que o CID do lado oposto seja diferente. */
function cidCompativel(a: AtestadoParaEpisodio, b: AtestadoParaEpisodio): boolean {
  return a.cidCodigo === null || b.cidCodigo === null || a.cidCodigo === b.cidCodigo
}

function seEncadeiam(anterior: AtestadoParaEpisodio, proximo: AtestadoParaEpisodio): boolean {
  return cidCompativel(anterior, proximo) && gapDias(anterior.dataFim, proximo.dataInicio) <= JANELA_MESMA_DOENCA_DIAS
}

/**
 * Calcula o "episódio de doença" (regra do INSS: mesma doença dentro de 60 dias corridos soma
 * pra contagem dos 15 dias pagos pela empresa) que contém o atestado-âncora — caminha
 * cronologicamente pra trás e pra frente a partir dele, encadeando enquanto CID compatível e
 * gap ≤60 dias.
 *
 * `dias` do episódio é o SPAN de calendário entre o início do primeiro atestado e o fim do
 * último — não a soma dos dias individuais de cada atestado — porque a regra trata gaps dentro
 * da janela de 60 dias como parte do mesmo benefício.
 */
export function calcularEpisodioInss(
  atestadoAncoraId: string,
  atestados: AtestadoParaEpisodio[],
): EpisodioInss {
  const ordenados = [...atestados].sort((a, b) =>
    a.dataInicio < b.dataInicio ? -1 : a.dataInicio > b.dataInicio ? 1 : 0,
  )
  const indiceAncora = ordenados.findIndex(a => a.id === atestadoAncoraId)
  if (indiceAncora === -1) {
    throw new Error(`Atestado âncora ${atestadoAncoraId} não encontrado na lista de atestados do funcionário`)
  }

  let inicio = indiceAncora
  while (inicio > 0 && seEncadeiam(ordenados[inicio - 1], ordenados[inicio])) {
    inicio -= 1
  }

  let fim = indiceAncora
  while (fim < ordenados.length - 1 && seEncadeiam(ordenados[fim], ordenados[fim + 1])) {
    fim += 1
  }

  const grupo = ordenados.slice(inicio, fim + 1)
  const dataInicio = grupo[0].dataInicio
  const dataFim = grupo[grupo.length - 1].dataFim

  return {
    dataInicio,
    dataFim,
    dias: calcDias(dataInicio, dataFim),
    atestadosIncluidos: grupo,
  }
}
```

- [ ] **Step 2: Verificar com harness descartável**

Crie `scratch-episodio-check.ts` na raiz (não commitar):

```typescript
import { calcularEpisodioInss } from './lib/atestados/episodio-inss'
import type { AtestadoParaEpisodio } from './lib/atestados/episodio-inss'

function a(over: Partial<AtestadoParaEpisodio>): AtestadoParaEpisodio {
  return { id: 'x', dataInicio: '2026-01-01', dataFim: '2026-01-05', cidCodigo: null, ...over }
}

// Caso 1: único atestado — episódio é ele mesmo
{
  const r = calcularEpisodioInss('a1', [a({ id: 'a1', dataInicio: '2026-01-01', dataFim: '2026-01-05' })])
  console.assert(r.dataInicio === '2026-01-01' && r.dataFim === '2026-01-05' && r.dias === 5, 'caso1: ' + JSON.stringify(r))
}

// Caso 2: dois atestados mesmo CID, gap 10 dias — agrupa, dias = span completo (cobre o gap)
{
  const lista = [
    a({ id: 'a1', dataInicio: '2026-01-01', dataFim: '2026-01-05', cidCodigo: 'M54' }),
    a({ id: 'a2', dataInicio: '2026-01-16', dataFim: '2026-01-20', cidCodigo: 'M54' }), // gap = 10 (06..15)
  ]
  const r = calcularEpisodioInss('a2', lista)
  console.assert(r.dataInicio === '2026-01-01' && r.dataFim === '2026-01-20', 'caso2 datas: ' + JSON.stringify(r))
  console.assert(r.dias === 20, 'caso2 dias (span, nao soma 5+5=10): ' + r.dias)
  console.assert(r.atestadosIncluidos.length === 2, 'caso2 incluidos')
}

// Caso 3: CID diferente, gap 5 dias — nao agrupa
{
  const lista = [
    a({ id: 'a1', dataInicio: '2026-01-01', dataFim: '2026-01-05', cidCodigo: 'M54' }),
    a({ id: 'a2', dataInicio: '2026-01-11', dataFim: '2026-01-15', cidCodigo: 'S82' }),
  ]
  const r = calcularEpisodioInss('a2', lista)
  console.assert(r.dataInicio === '2026-01-11' && r.dataFim === '2026-01-15', 'caso3: ' + JSON.stringify(r))
  console.assert(r.atestadosIncluidos.length === 1, 'caso3 incluidos')
}

// Caso 4: um "sem CID" — funciona como ponte, gap 30 dias
{
  const lista = [
    a({ id: 'a1', dataInicio: '2026-01-01', dataFim: '2026-01-05', cidCodigo: 'M54' }),
    a({ id: 'a2', dataInicio: '2026-02-04', dataFim: '2026-02-08', cidCodigo: null }), // gap = 29
  ]
  const r = calcularEpisodioInss('a2', lista)
  console.assert(r.atestadosIncluidos.length === 2, 'caso4 incluidos: ' + r.atestadosIncluidos.length)
}

// Caso 5: mesmo CID, gap 61 dias — nao agrupa (passou de 60)
{
  const lista = [
    a({ id: 'a1', dataInicio: '2026-01-01', dataFim: '2026-01-05', cidCodigo: 'M54' }),
    a({ id: 'a2', dataInicio: '2026-03-08', dataFim: '2026-03-12', cidCodigo: 'M54' }), // gap = 61 (06/01..07/03)
  ]
  const r = calcularEpisodioInss('a2', lista)
  console.assert(r.atestadosIncluidos.length === 1, 'caso5 incluidos: ' + r.atestadosIncluidos.length)
}

// Caso 6: cadeia A-B mesmo CID gap 10, B-C CID diferente gap 5, ancora em B — inclui A e B, nao C
{
  const lista = [
    a({ id: 'A', dataInicio: '2026-01-01', dataFim: '2026-01-05', cidCodigo: 'M54' }),
    a({ id: 'B', dataInicio: '2026-01-16', dataFim: '2026-01-20', cidCodigo: 'M54' }),
    a({ id: 'C', dataInicio: '2026-01-26', dataFim: '2026-01-30', cidCodigo: 'S82' }),
  ]
  const r = calcularEpisodioInss('B', lista)
  const ids = r.atestadosIncluidos.map(x => x.id).sort()
  console.assert(JSON.stringify(ids) === JSON.stringify(['A', 'B']), 'caso6: ' + JSON.stringify(ids))
}

// Caso 7: ancora nao encontrado — lanca erro
{
  let lancou = false
  try {
    calcularEpisodioInss('naoexiste', [a({ id: 'a1' })])
  } catch {
    lancou = true
  }
  console.assert(lancou, 'caso7: deveria lancar erro')
}

console.log('OK — todas as asserções passaram')
```

Run: `npx --yes tsx scratch-episodio-check.ts`
Expected: `OK — todas as asserções passaram`

- [ ] **Step 3: Apagar o harness**

```bash
rm scratch-episodio-check.ts
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: sem erros novos em `lib/atestados/episodio-inss.ts`

- [ ] **Step 5: Commit**

```bash
git add lib/atestados/episodio-inss.ts
git commit -m "feat(atestados): funcao pura de agrupamento de atestados por episodio inss

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Server Action

**Files:**
- Modify: `app/(admin)/atestados/actions.ts`

- [ ] **Step 1: Adicionar import e a action**

No topo do arquivo, junto aos imports existentes (após a linha `import { logSupervisorAcao } from '@/lib/log-supervisor'`):

```typescript
import { calcularEpisodioInss, type AtestadoParaEpisodio, type EpisodioInss } from '@/lib/atestados/episodio-inss'
```

No final do arquivo (após a função `deleteAtestado`, antes do fim do arquivo), adicionar:

```typescript

export async function calcularEpisodioInssAction(
  funcionarioId: string,
  atestadoAncoraId: string,
): Promise<EpisodioInss | { erro: string }> {
  const auth = await getUser()
  if (!auth) return { erro: 'Não autenticado' }
  if (auth.perfil.role !== 'admin' && auth.perfil.role !== 'coordenador') return { erro: 'Sem permissão' }

  const supabase = createClient()
  const { data, error } = await supabase
    .from('atestados')
    .select('id, data_inicio, data_fim, cid_codigo')
    .eq('funcionario_id', funcionarioId)

  if (error) return { erro: error.message }

  const atestados: AtestadoParaEpisodio[] = (data ?? []).map(a => ({
    id: a.id,
    dataInicio: a.data_inicio,
    dataFim: a.data_fim,
    cidCodigo: a.cid_codigo,
  }))

  try {
    return calcularEpisodioInss(atestadoAncoraId, atestados)
  } catch (e) {
    return { erro: e instanceof Error ? e.message : 'Erro ao calcular episódio' }
  }
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: sem erros novos em `app/(admin)/atestados/actions.ts`

- [ ] **Step 3: Commit**

```bash
git add "app/(admin)/atestados/actions.ts"
git commit -m "feat(atestados): server action calcularEpisodioInssAction

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Integrar no client — chamar a action, mostrar loading, exibir episódio no modal

**Files:**
- Modify: `components/atestados/atestados-client.tsx`

- [ ] **Step 1: Adicionar imports**

Modificar o bloco de imports no topo do arquivo (linhas 1-10):

```typescript
'use client'

import { useState, useMemo, useTransition } from 'react'
import { AlertTriangle, Download } from 'lucide-react'
import * as XLSX from 'xlsx-js-style'
import { cn } from '@/lib/utils'
import { deleteAtestado, calcularEpisodioInssAction } from '@/app/(admin)/atestados/actions'
import { solicitarAfastamento } from '@/app/(admin)/efetivo/actions'
import { ModalEditarAtestado } from './modal-editar-atestado'
import { ConfirmarExclusaoDialog } from '@/components/ui/confirmar-exclusao-dialog'
import type { AtestadoParaEpisodio } from '@/lib/atestados/episodio-inss'
```

- [ ] **Step 2: Adicionar campo opcional em `InssModalState`**

Localizar (por volta da linha 75):

```typescript
type InssModalState = {
  funcionario_id: string
  funcionario_nome: string
  data_inicio: string
  dias: number
  motivo: string
}
```

Substituir por:

```typescript
type InssModalState = {
  funcionario_id: string
  funcionario_nome: string
  data_inicio: string
  dias: number
  motivo: string
  // Presente quando o episódio foi calculado com sucesso pela action — lista os atestados
  // que entraram no agrupamento, exibida no modal só pra conferência visual.
  atestadosIncluidos?: AtestadoParaEpisodio[]
  // Mensagem de aviso quando o cálculo do episódio falhou e caiu no fallback antigo
  // (soma bruta de 30 dias) — mostrada no modal.
  avisoFallback?: string
}
```

- [ ] **Step 3: Exibir a lista de atestados do episódio no modal**

Em `ModalSolicitarInss`, localizar o bloco (por volta da linha 186-189):

```typescript
        <div className="mb-4 rounded border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          💡 Isso gera um novo atestado “guarda-chuva” pro período do afastamento — sem CID, só pra
          cobrir o intervalo. Não duplica os atestados já lançados, que continuam valendo no histórico.
        </div>
```

Adicionar logo depois desse bloco (ainda antes do `<form onSubmit={handleSubmit}...`):

```typescript
        {state.avisoFallback && (
          <div className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            ⚠ {state.avisoFallback} — usando estimativa antiga (soma bruta de 30 dias). Revise as datas
            manualmente antes de enviar.
          </div>
        )}

        {state.atestadosIncluidos && state.atestadosIncluidos.length > 0 && (
          <div className="mb-4 rounded border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
            <p className="mb-1 font-semibold text-gray-700">Atestados considerados neste episódio:</p>
            <ul className="space-y-0.5">
              {state.atestadosIncluidos.map(a => (
                <li key={a.id}>
                  {a.dataInicio.split('-').reverse().join('/')} – {a.dataFim.split('-').reverse().join('/')}
                  {a.cidCodigo ? ` (${a.cidCodigo})` : ' (sem CID)'}
                </li>
              ))}
            </ul>
          </div>
        )}
```

- [ ] **Step 4: Adicionar estado de loading**

Localizar o estado da tela principal (por volta da linha 315-316):

```typescript
  const [janelaRanking, setJanelaRanking] = useState<30 | 60 | 90 | 180>(90)
  const [inssModal, setInssModal] = useState<InssModalState | null>(null)
```

Substituir por:

```typescript
  const [janelaRanking, setJanelaRanking] = useState<30 | 60 | 90 | 180>(90)
  const [inssModal, setInssModal] = useState<InssModalState | null>(null)
  const [calculandoEpisodioId, setCalculandoEpisodioId] = useState<string | null>(null)
```

- [ ] **Step 5: Adicionar a função `abrirModalInss` logo após `primeiroAtestadoMap`/`ultimoAlertaIds`**

`abrirModalInss` usa `primeiroAtestadoMap` (pro fallback), então precisa ser declarada **depois** desse `useMemo` na ordem do componente. Localizar o bloco existente (por volta das linhas 318-334):

```typescript
  // Data do atestado mais antigo por funcionário (para pré-preencher o modal INSS)
  const primeiroAtestadoMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const a of atestados) {
      const cur = map.get(a.funcionario_id)
      if (!cur || a.data_inicio < cur) map.set(a.funcionario_id, a.data_inicio)
    }
    return map
  }, [atestados])

  // Apenas o atestado mais recente de cada funcionário com alerta exibe o badge INSS
  const ultimoAlertaIds = useMemo(() => {
    const map = new Map<string, { id: string; data: string }>()
    for (const a of atestados) {
      if (!a.alerta) continue
      const cur = map.get(a.funcionario_id)
      if (!cur || a.data_inicio > cur.data) map.set(a.funcionario_id, { id: a.id, data: a.data_inicio })
    }
    return new Set(Array.from(map.values()).map(v => v.id))
  }, [atestados])
```

Adicionar logo depois desse bloco (antes de `function handleSort`):

```typescript
  async function abrirModalInss(a: AtestadoRow) {
    setCalculandoEpisodioId(a.id)
    const baseFallback: InssModalState = {
      funcionario_id: a.funcionario_id,
      funcionario_nome: a.funcionario_nome,
      data_inicio: primeiroAtestadoMap.get(a.funcionario_id) ?? a.data_inicio,
      dias: a.acumulado,
      motivo: 'INSS - Doença',
    }
    try {
      const res = await calcularEpisodioInssAction(a.funcionario_id, a.id)
      if ('erro' in res) {
        setInssModal({ ...baseFallback, avisoFallback: res.erro })
      } else {
        setInssModal({
          ...baseFallback,
          data_inicio: res.dataInicio,
          dias: res.dias,
          atestadosIncluidos: res.atestadosIncluidos,
        })
      }
    } catch {
      setInssModal({ ...baseFallback, avisoFallback: 'Erro ao calcular episódio' })
    } finally {
      setCalculandoEpisodioId(null)
    }
  }
```

Resultado final esperado nessa região do arquivo (por volta das linhas 315-347):

```typescript
  const [janelaRanking, setJanelaRanking] = useState<30 | 60 | 90 | 180>(90)
  const [inssModal, setInssModal] = useState<InssModalState | null>(null)
  const [calculandoEpisodioId, setCalculandoEpisodioId] = useState<string | null>(null)

  // Data do atestado mais antigo por funcionário (para pré-preencher o modal INSS)
  const primeiroAtestadoMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const a of atestados) {
      const cur = map.get(a.funcionario_id)
      if (!cur || a.data_inicio < cur) map.set(a.funcionario_id, a.data_inicio)
    }
    return map
  }, [atestados])

  // Apenas o atestado mais recente de cada funcionário com alerta exibe o badge INSS
  const ultimoAlertaIds = useMemo(() => {
    const map = new Map<string, { id: string; data: string }>()
    for (const a of atestados) {
      if (!a.alerta) continue
      const cur = map.get(a.funcionario_id)
      if (!cur || a.data_inicio > cur.data) map.set(a.funcionario_id, { id: a.id, data: a.data_inicio })
    }
    return new Set(Array.from(map.values()).map(v => v.id))
  }, [atestados])

  async function abrirModalInss(a: AtestadoRow) {
    setCalculandoEpisodioId(a.id)
    const baseFallback: InssModalState = {
      funcionario_id: a.funcionario_id,
      funcionario_nome: a.funcionario_nome,
      data_inicio: primeiroAtestadoMap.get(a.funcionario_id) ?? a.data_inicio,
      dias: a.acumulado,
      motivo: 'INSS - Doença',
    }
    try {
      const res = await calcularEpisodioInssAction(a.funcionario_id, a.id)
      if ('erro' in res) {
        setInssModal({ ...baseFallback, avisoFallback: res.erro })
      } else {
        setInssModal({
          ...baseFallback,
          data_inicio: res.dataInicio,
          dias: res.dias,
          atestadosIncluidos: res.atestadosIncluidos,
        })
      }
    } catch {
      setInssModal({ ...baseFallback, avisoFallback: 'Erro ao calcular episódio' })
    } finally {
      setCalculandoEpisodioId(null)
    }
  }
```

(ou seja: declare `calculandoEpisodioId` junto aos outros `useState` no topo do componente, mas mova a função `abrirModalInss` pra depois de `primeiroAtestadoMap` e `ultimoAlertaIds`, já que ela depende de `primeiroAtestadoMap`)

- [ ] **Step 6: Trocar o `onClick` do botão "Solicitar INSS" pra usar `abrirModalInss`**

Localizar (por volta da linha 631-644):

```typescript
                        {isAdmin && ultimoAlertaIds.has(a.id) && (
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
```

Substituir por:

```typescript
                        {isAdmin && ultimoAlertaIds.has(a.id) && (
                          <button
                            type="button"
                            disabled={calculandoEpisodioId === a.id}
                            onClick={() => abrirModalInss(a)}
                            className="rounded border border-red-300 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
                          >
                            {calculandoEpisodioId === a.id ? 'Calculando...' : 'Solicitar INSS'}
                          </button>
                        )}
```

- [ ] **Step 7: Type-check**

Run: `npx tsc --noEmit`
Expected: sem erros novos em `components/atestados/atestados-client.tsx`

- [ ] **Step 8: Build completo (inclui lint — já causou falha de deploy antes)**

Run: `npm run build`
Expected: `✓ Compiled successfully`, sem erros de lint, rota `/atestados` presente na listagem final

- [ ] **Step 9: Commit**

```bash
git add components/atestados/atestados-client.tsx
git commit -m "feat(atestados): modal solicitar inss usa episodio calculado pela action

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Verificação manual (checkpoint, sem commit)

**Files:** nenhum

- [ ] **Step 1:** Rodar `npm run dev`, logar como admin, ir em `/atestados`.
- [ ] **Step 2:** Achar um funcionário com badge "⚠️ Avaliar INSS" (ex: ELICA FERNANDES DE SIQUEIRA, se os dados de teste ainda tiverem esse caso) e clicar "Solicitar INSS".
- [ ] **Step 3:** Confirmar que o botão mostra "Calculando..." brevemente, o modal abre com a lista "Atestados considerados neste episódio" preenchida, e que `Data de Início`/`Dias de Atestado` refletem só o(s) atestado(s) da mesma doença (CID igual ou ponte "sem CID") dentro de 60 dias — não a soma bruta de tudo.
- [ ] **Step 4:** Confirmar que todos os campos do modal continuam editáveis (testar mudar `Dias de Atestado` e ver `Retorno Previsto` recalcular).
- [ ] **Step 5:** Reportar o resultado ao usuário — sem commit nesta task.
