# Auditoria SESMT × Atestados Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nova página `/auditoria-atestados` que recebe planilha Excel do SESMT, cruza com a tabela `atestados` do sistema por matrícula+período, e mostra relatório de divergências (datas, CID, dias, origem ocupacional).

**Architecture:** Segue o padrão já existente em `conferencia-rh`: parse do `.xlsx` no client (`xlsx-js-style`), Server Action busca dados do Supabase e roda a comparação em lib pura (`lib/auditoria-atestados/`), client component renderiza o resultado em seções.

**Tech Stack:** Next.js 14 App Router, TypeScript, Supabase, `xlsx-js-style` (já instalado), Tailwind.

**Nota sobre testes:** este projeto não tem test runner configurado (`npm test` inexistente, sem jest/vitest). A verificação de cada task é `npx tsc --noEmit` + `npm run build`, seguindo o padrão do CLAUDE.md. Onde a lógica é pura (parsing, comparação), a Task inclui um mini-harness descartável rodado via `npx tsx` para conferir o comportamento antes de seguir — não é um teste permanente do repositório.

---

## Arquivos

- Criar `lib/auditoria-atestados/tipos.ts` — tipos compartilhados
- Criar `lib/auditoria-atestados/parse.ts` — funções puras de parsing (matrícula, CID, dias)
- Criar `lib/auditoria-atestados/comparar.ts` — algoritmo de cruzamento/comparação
- Criar `app/(admin)/auditoria-atestados/actions.ts` — Server Action que busca dados e chama `comparar.ts`
- Criar `app/(admin)/auditoria-atestados/page.tsx` — página com guard de role
- Criar `components/auditoria-atestados/upload-form.tsx` — client component, parse do xlsx e chamada da action
- Criar `components/auditoria-atestados/tabela-resultado.tsx` — renderização do relatório em 4 seções
- Modificar `components/admin/nav-config.ts` — adiciona item de menu
- Modificar `components/layout/nav-config.ts` — adiciona item de menu (mesma entrada, arquivo duplicado existente no projeto)
- Modificar `components/admin/sidebar-nav.tsx` — adiciona ícone no mapa `ICONS`

---

### Task 1: Tipos compartilhados

**Files:**
- Create: `lib/auditoria-atestados/tipos.ts`

- [ ] **Step 1: Criar o arquivo de tipos**

```typescript
// lib/auditoria-atestados/tipos.ts

export type LinhaSesmt = {
  matriculaRaw: string      // valor bruto da coluna "Matrícula", ex "001-000-107622"
  nome: string               // coluna "Empregado"
  dataInicio: string         // ISO yyyy-mm-dd, da coluna "Data"
  diasTexto: string          // valor bruto da coluna "Afastamento", ex "15 dias"
  motivo: string             // coluna "Motivo"
  cidTexto: string           // coluna "CID Abonado", ex "A09 - Diarréia..." ou "Sem CID"
  dataRetorno: string        // ISO yyyy-mm-dd, da coluna "Data Retorno"
}

export type AtestadoSistema = {
  id: string
  funcionarioId: string
  funcionarioNome: string
  registro: string
  dataInicio: string
  dataFim: string
  cidCodigo: string | null
  cidDescricao: string | null
  origemOcupacional: string | null
}

export type CampoDivergente = 'data_inicio' | 'data_fim' | 'cid' | 'origem_ocupacional'

export type LinhaResultado =
  | {
      status: 'confere'
      sesmt: LinhaSesmt
      sistema: AtestadoSistema
    }
  | {
      status: 'divergencia'
      sesmt: LinhaSesmt
      sistema: AtestadoSistema
      camposDivergentes: CampoDivergente[]
    }
  | {
      status: 'nao_lancado'
      sesmt: LinhaSesmt
    }
  | {
      status: 'matricula_nao_encontrada'
      sesmt: LinhaSesmt
    }
  | {
      status: 'ambiguo'
      sesmt: LinhaSesmt
      candidatos: AtestadoSistema[]
    }
  | {
      status: 'sem_sesmt'
      sistema: AtestadoSistema
    }

export type ResultadoAuditoria = {
  linhas: LinhaResultado[]
  contadores: {
    confere: number
    divergencia: number
    naoLancado: number
    matriculaNaoEncontrada: number
    ambiguo: number
    semSesmt: number
  }
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: sem erros novos relacionados a `lib/auditoria-atestados/tipos.ts` (o comando pode reportar erros pré-existentes em outros arquivos — ignore-os, só confirme que este arquivo novo não introduz nenhum).

- [ ] **Step 3: Commit**

```bash
git add lib/auditoria-atestados/tipos.ts
git commit -m "feat(auditoria-atestados): tipos compartilhados

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Funções puras de parsing

**Files:**
- Create: `lib/auditoria-atestados/parse.ts`

- [ ] **Step 1: Criar as funções de parsing**

```typescript
// lib/auditoria-atestados/parse.ts

/**
 * Extrai o registro (RE) do funcionário a partir da matrícula do SESMT.
 * Formato SESMT: "001-000-107622" → registro no sistema: "107622" (sem zeros à esquerda,
 * espelhando o formato salvo em funcionarios.registro).
 * Retorna null se não conseguir extrair um número válido.
 */
export function extrairRegistroDeMatricula(matriculaRaw: string): string | null {
  const partes = matriculaRaw.trim().split('-')
  const ultima = partes[partes.length - 1]?.trim()
  if (!ultima) return null
  const n = parseInt(ultima, 10)
  if (Number.isNaN(n)) return null
  return String(n)
}

/**
 * Extrai o código CID do texto da coluna "CID Abonado".
 * "A09 - Diarréia e gastroenterite..." → "A09"
 * "Sem CID" → null
 */
export function extrairCodigoCid(cidTexto: string): string | null {
  const t = cidTexto.trim()
  if (t === '' || t.toLowerCase() === 'sem cid') return null
  const idx = t.indexOf(' - ')
  return idx === -1 ? t : t.slice(0, idx).trim()
}

/**
 * Interpreta o texto da coluna "Afastamento" (ex: "15 dias", "999 dias", "9999 dias").
 * 999 e 9999 dias são convenções do SESMT pra "benefício em aberto / sem previsão real
 * de retorno" — a Data Retorno associada é só um placeholder, não uma data confiável.
 */
export function ehAfastamentoIndeterminado(diasTexto: string): boolean {
  const n = parseInt(diasTexto.trim(), 10)
  return n === 999 || n === 9999
}

/**
 * Converte data no formato dd/mm/aaaa (como vem do Excel via célula formatada como texto
 * ou já normalizada pelo parser do client) para ISO yyyy-mm-dd.
 */
export function dataBrParaIso(dataBr: string): string | null {
  const m = dataBr.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!m) return null
  const [, d, mo, y] = m
  return `${y}-${mo}-${d}`
}

/**
 * Determina se o Motivo do SESMT indica origem ocupacional (acidente/doença do trabalho).
 */
export function motivoIndicaOcupacional(motivo: string): boolean {
  return motivo.trim().toLowerCase() === 'acidente/doença do trabalho'
}
```

- [ ] **Step 2: Conferir manualmente com um mini-harness descartável**

Crie um arquivo temporário `scratch-parse-check.ts` na raiz (fora do controle de versão — não commitar):

```typescript
import {
  extrairRegistroDeMatricula,
  extrairCodigoCid,
  ehAfastamentoIndeterminado,
  dataBrParaIso,
  motivoIndicaOcupacional,
} from './lib/auditoria-atestados/parse'

console.assert(extrairRegistroDeMatricula('001-000-107622') === '107622', 'matricula 1')
console.assert(extrairRegistroDeMatricula('001-000-097682') === '97682', 'matricula 2 (zero à esquerda)')
console.assert(extrairCodigoCid('Sem CID') === null, 'cid vazio')
console.assert(extrairCodigoCid('A09 - Diarréia e gastroenterite de origem infecciosa presumível') === 'A09', 'cid A09')
console.assert(extrairCodigoCid('I83.9 - Varizes dos membros inferiores sem úlcera ou inflamação') === 'I83.9', 'cid I83.9')
console.assert(ehAfastamentoIndeterminado('999 dias') === true, 'indeterminado 999')
console.assert(ehAfastamentoIndeterminado('9999 dias') === true, 'indeterminado 9999')
console.assert(ehAfastamentoIndeterminado('15 dias') === false, 'determinado 15')
console.assert(dataBrParaIso('13/08/2026') === '2026-08-13', 'data br')
console.assert(motivoIndicaOcupacional('Acidente/Doença do trabalho') === true, 'motivo ocupacional')
console.assert(motivoIndicaOcupacional('Acidente/Doença não relacionada ao trabalho') === false, 'motivo não ocupacional')
console.log('OK — todas as asserções passaram')
```

Run: `npx tsx scratch-parse-check.ts`
Expected: `OK — todas as asserções passaram` (sem nenhuma linha "Assertion failed")

- [ ] **Step 3: Apagar o arquivo de harness**

```bash
rm scratch-parse-check.ts
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: sem erros novos em `lib/auditoria-atestados/parse.ts`

- [ ] **Step 5: Commit**

```bash
git add lib/auditoria-atestados/parse.ts
git commit -m "feat(auditoria-atestados): funcoes de parsing da planilha SESMT

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Algoritmo de comparação

**Files:**
- Create: `lib/auditoria-atestados/comparar.ts`

- [ ] **Step 1: Criar o algoritmo**

```typescript
// lib/auditoria-atestados/comparar.ts

import { extrairCodigoCid, ehAfastamentoIndeterminado, motivoIndicaOcupacional } from './parse'
import type { LinhaSesmt, AtestadoSistema, LinhaResultado, ResultadoAuditoria, CampoDivergente } from './tipos'

function periodosSeSobrepoem(aInicio: string, aFim: string, bInicio: string, bFim: string): boolean {
  return aInicio <= bFim && bInicio <= aFim
}

function compararCampos(sesmt: LinhaSesmt, sistema: AtestadoSistema): CampoDivergente[] {
  const divergentes: CampoDivergente[] = []
  const indeterminado = ehAfastamentoIndeterminado(sesmt.diasTexto)

  if (sesmt.dataInicio !== sistema.dataInicio) divergentes.push('data_inicio')
  if (!indeterminado && sesmt.dataRetorno !== sistema.dataFim) divergentes.push('data_fim')

  const cidSesmt = extrairCodigoCid(sesmt.cidTexto)
  if (cidSesmt !== sistema.cidCodigo) divergentes.push('cid')

  const esperaOcupacional = motivoIndicaOcupacional(sesmt.motivo)
  const temOcupacional = sistema.origemOcupacional != null
  if (esperaOcupacional !== temOcupacional) divergentes.push('origem_ocupacional')

  return divergentes
}

/**
 * Cruza as linhas do SESMT com os atestados do sistema já filtrados por registro
 * (um funcionário pode ter 0, 1 ou N atestados candidatos por linha SESMT).
 *
 * @param linhasSesmt linhas parseadas da planilha SESMT
 * @param atestadosPorRegistro atestados do sistema agrupados por registro do funcionário
 */
export function compararAuditoria(
  linhasSesmt: Array<{ linha: LinhaSesmt; registro: string | null }>,
  atestadosPorRegistro: Map<string, AtestadoSistema[]>,
): ResultadoAuditoria {
  const linhas: LinhaResultado[] = []
  const atestadosUsados = new Set<string>()

  for (const { linha, registro } of linhasSesmt) {
    if (registro === null) {
      linhas.push({ status: 'matricula_nao_encontrada', sesmt: linha })
      continue
    }

    const candidatosTodos = atestadosPorRegistro.get(registro) ?? []
    if (candidatosTodos.length === 0) {
      linhas.push({ status: 'matricula_nao_encontrada', sesmt: linha })
      continue
    }

    const indeterminado = ehAfastamentoIndeterminado(linha.diasTexto)
    const candidatos = candidatosTodos.filter(a =>
      indeterminado
        ? a.dataInicio <= linha.dataInicio && a.dataFim >= linha.dataInicio
        : periodosSeSobrepoem(linha.dataInicio, linha.dataRetorno, a.dataInicio, a.dataFim),
    )

    if (candidatos.length === 0) {
      linhas.push({ status: 'nao_lancado', sesmt: linha })
    } else if (candidatos.length === 1) {
      const sistema = candidatos[0]
      atestadosUsados.add(sistema.id)
      const camposDivergentes = compararCampos(linha, sistema)
      linhas.push(
        camposDivergentes.length === 0
          ? { status: 'confere', sesmt: linha, sistema }
          : { status: 'divergencia', sesmt: linha, sistema, camposDivergentes },
      )
    } else {
      for (const c of candidatos) atestadosUsados.add(c.id)
      linhas.push({ status: 'ambiguo', sesmt: linha, candidatos })
    }
  }

  // Segunda passada: atestados do sistema não usados em nenhum pareamento
  for (const candidatos of atestadosPorRegistro.values()) {
    for (const a of candidatos) {
      if (!atestadosUsados.has(a.id)) {
        linhas.push({ status: 'sem_sesmt', sistema: a })
      }
    }
  }

  const contadores = {
    confere: linhas.filter(l => l.status === 'confere').length,
    divergencia: linhas.filter(l => l.status === 'divergencia').length,
    naoLancado: linhas.filter(l => l.status === 'nao_lancado').length,
    matriculaNaoEncontrada: linhas.filter(l => l.status === 'matricula_nao_encontrada').length,
    ambiguo: linhas.filter(l => l.status === 'ambiguo').length,
    semSesmt: linhas.filter(l => l.status === 'sem_sesmt').length,
  }

  return { linhas, contadores }
}
```

- [ ] **Step 2: Conferir manualmente com um mini-harness descartável**

Crie `scratch-comparar-check.ts` na raiz (não commitar):

```typescript
import { compararAuditoria } from './lib/auditoria-atestados/comparar'
import type { LinhaSesmt, AtestadoSistema } from './lib/auditoria-atestados/tipos'

function linha(over: Partial<LinhaSesmt>): LinhaSesmt {
  return {
    matriculaRaw: '001-000-100000',
    nome: 'FULANA DE TAL',
    dataInicio: '2026-06-01',
    diasTexto: '3 dias',
    motivo: 'Acidente/Doença não relacionada ao trabalho',
    cidTexto: 'Sem CID',
    dataRetorno: '2026-06-03',
    ...over,
  }
}

function atestado(over: Partial<AtestadoSistema>): AtestadoSistema {
  return {
    id: 'a1',
    funcionarioId: 'f1',
    funcionarioNome: 'FULANA DE TAL',
    registro: '100000',
    dataInicio: '2026-06-01',
    dataFim: '2026-06-03',
    cidCodigo: null,
    cidDescricao: null,
    origemOcupacional: null,
    ...over,
  }
}

// Caso 1: confere exatamente
const r1 = compararAuditoria(
  [{ linha: linha({}), registro: '100000' }],
  new Map([['100000', [atestado({})]]]),
)
console.assert(r1.linhas.length === 1 && r1.linhas[0].status === 'confere', 'caso 1 confere')

// Caso 2: matrícula não encontrada
const r2 = compararAuditoria([{ linha: linha({}), registro: null }], new Map())
console.assert(r2.linhas[0].status === 'matricula_nao_encontrada', 'caso 2 matricula nao encontrada')

// Caso 3: não lançado (registro existe mas sem atestado no período)
const r3 = compararAuditoria(
  [{ linha: linha({}), registro: '100000' }],
  new Map([['100000', [atestado({ dataInicio: '2026-01-01', dataFim: '2026-01-05' })]]]),
)
console.assert(r3.linhas.some(l => l.status === 'nao_lancado'), 'caso 3 nao lancado')
console.assert(r3.linhas.some(l => l.status === 'sem_sesmt'), 'caso 3 tambem gera sem_sesmt pro atestado sobrando')

// Caso 4: divergência de CID
const r4 = compararAuditoria(
  [{ linha: linha({ cidTexto: 'A09 - Diarréia e gastroenterite de origem infecciosa presumível' }), registro: '100000' }],
  new Map([['100000', [atestado({ cidCodigo: null })]]]),
)
const l4 = r4.linhas[0]
console.assert(l4.status === 'divergencia' && 'camposDivergentes' in l4 && l4.camposDivergentes.includes('cid'), 'caso 4 diverge cid')

// Caso 5: ambíguo (2 candidatos se sobrepondo)
const r5 = compararAuditoria(
  [{ linha: linha({}), registro: '100000' }],
  new Map([['100000', [atestado({ id: 'a1' }), atestado({ id: 'a2' })]]]),
)
console.assert(r5.linhas[0].status === 'ambiguo', 'caso 5 ambiguo')

// Caso 6: 999 dias ignora data_fim na comparação
const r6 = compararAuditoria(
  [{ linha: linha({ diasTexto: '999 dias', dataRetorno: '2029-03-01' }), registro: '100000' }],
  new Map([['100000', [atestado({ dataFim: '2099-01-01' })]]]),
)
console.assert(r6.linhas[0].status === 'confere', 'caso 6 indeterminado ignora data_fim')

console.log('OK — todas as asserções passaram')
```

Run: `npx tsx scratch-comparar-check.ts`
Expected: `OK — todas as asserções passaram`

- [ ] **Step 3: Apagar o arquivo de harness**

```bash
rm scratch-comparar-check.ts
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: sem erros novos em `lib/auditoria-atestados/comparar.ts`

- [ ] **Step 5: Commit**

```bash
git add lib/auditoria-atestados/comparar.ts
git commit -m "feat(auditoria-atestados): algoritmo de cruzamento sesmt x sistema

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Server Action

**Files:**
- Create: `app/(admin)/auditoria-atestados/actions.ts`

- [ ] **Step 1: Criar a action**

Antes de escrever, confirme o padrão de import de `fetchAllRows`:

```typescript
// app/(admin)/auditoria-atestados/actions.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import { getUser } from '@/lib/auth/get-user'
import { isAdminOrCoord, type Role } from '@/types'
import { extrairRegistroDeMatricula } from '@/lib/auditoria-atestados/parse'
import { compararAuditoria } from '@/lib/auditoria-atestados/comparar'
import type { LinhaSesmt, AtestadoSistema, ResultadoAuditoria } from '@/lib/auditoria-atestados/tipos'

type FuncionarioRaw = { id: string; registro: string | null; nome: string }
type AtestadoRaw = {
  id: string
  funcionario_id: string
  data_inicio: string
  data_fim: string
  cid_codigo: string | null
  origem_ocupacional: string | null
}
type CidRaw = { codigo: string; descricao: string }

export async function auditarSesmt(linhasSesmt: LinhaSesmt[]): Promise<ResultadoAuditoria | { erro: string }> {
  const auth = await getUser()
  if (!auth) return { erro: 'Não autenticado' }
  if (!isAdminOrCoord(auth.perfil.role as Role)) return { erro: 'Sem permissão' }

  if (linhasSesmt.length === 0) return { erro: 'Nenhuma linha para auditar' }

  const supabase = createClient()

  const registrosNoArquivo = new Set<string>()
  const linhasComRegistro: Array<{ linha: LinhaSesmt; registro: string | null }> = linhasSesmt.map(linha => {
    const registro = extrairRegistroDeMatricula(linha.matriculaRaw)
    if (registro) registrosNoArquivo.add(registro)
    return { linha, registro }
  })

  const [{ data: funcRaw, error: errFunc }, { data: cidRaw, error: errCid }] = await Promise.all([
    supabase.from('funcionarios').select('id, registro, nome').not('registro', 'is', null),
    supabase.from('cid_referencia').select('codigo, descricao'),
  ])

  if (errFunc) return { erro: `Erro ao buscar funcionários: ${errFunc.message}` }
  if (errCid) return { erro: `Erro ao buscar CIDs: ${errCid.message}` }

  const funcionarios = (funcRaw ?? []) as FuncionarioRaw[]
  const registroParaFuncionario = new Map<string, FuncionarioRaw>()
  for (const f of funcionarios) {
    if (f.registro) registroParaFuncionario.set(f.registro, f)
  }

  const funcionarioIdsRelevantes = funcionarios
    .filter(f => f.registro && registrosNoArquivo.has(f.registro))
    .map(f => f.id)

  const cidMap = new Map(((cidRaw ?? []) as CidRaw[]).map(c => [c.codigo, c.descricao] as [string, string]))

  let atestadosRaw: AtestadoRaw[] = []
  if (funcionarioIdsRelevantes.length > 0) {
    atestadosRaw = await fetchAllRows((from, to) =>
      supabase
        .from('atestados')
        .select('id, funcionario_id, data_inicio, data_fim, cid_codigo, origem_ocupacional')
        .in('funcionario_id', funcionarioIdsRelevantes)
        .range(from, to) as unknown as PromiseLike<{ data: AtestadoRaw[] | null; error: { message: string } | null }>,
    )
  }

  const atestadosPorRegistro = new Map<string, AtestadoSistema[]>()
  for (const a of atestadosRaw) {
    const func = funcionarios.find(f => f.id === a.funcionario_id)
    if (!func?.registro) continue
    const sistema: AtestadoSistema = {
      id: a.id,
      funcionarioId: a.funcionario_id,
      funcionarioNome: func.nome,
      registro: func.registro,
      dataInicio: a.data_inicio,
      dataFim: a.data_fim,
      cidCodigo: a.cid_codigo,
      cidDescricao: a.cid_codigo ? (cidMap.get(a.cid_codigo) ?? null) : null,
      origemOcupacional: a.origem_ocupacional,
    }
    const lista = atestadosPorRegistro.get(func.registro) ?? []
    lista.push(sistema)
    atestadosPorRegistro.set(func.registro, lista)
  }

  return compararAuditoria(linhasComRegistro, atestadosPorRegistro)
}
```

Nota: `registroParaFuncionario` é montado mas não usado diretamente no retorno — mantenha só se for útil para debug; caso o linter reclame de variável não usada, remova a declaração (ela é redundante já que `atestadosPorRegistro` é montado via `funcionarios.find` dentro do loop).

- [ ] **Step 2: Remover variável não usada se o build reclamar**

Se `npx tsc --noEmit` ou o lint apontar `registroParaFuncionario` como não usada, delete as 4 linhas que a declaram e populam (o `Map` não é referenciado em nenhum outro lugar do arquivo).

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: sem erros novos em `app/(admin)/auditoria-atestados/actions.ts`

- [ ] **Step 4: Commit**

```bash
git add "app/(admin)/auditoria-atestados/actions.ts"
git commit -m "feat(auditoria-atestados): server action de auditoria

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Componente de resultado (tabela)

**Files:**
- Create: `components/auditoria-atestados/tabela-resultado.tsx`

- [ ] **Step 1: Criar o componente**

```typescript
// components/auditoria-atestados/tabela-resultado.tsx
'use client'

import { cn } from '@/lib/utils'
import type { ResultadoAuditoria, LinhaResultado, CampoDivergente } from '@/lib/auditoria-atestados/tipos'

const LABEL_CAMPO: Record<CampoDivergente, string> = {
  data_inicio: 'Data início',
  data_fim: 'Data fim',
  cid: 'CID',
  origem_ocupacional: 'Origem ocupacional',
}

function CardContador({ label, valor, cor }: { label: string; valor: number; cor: string }) {
  return (
    <div className={cn('rounded-xl border border-t-4 border-gray-100 bg-white p-4 shadow-sm', cor)}>
      <p className="text-xl font-black tracking-tight text-gray-900">{valor}</p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-gray-400">{label}</p>
    </div>
  )
}

function LinhaConfereOuDivergencia({ l }: { l: Extract<LinhaResultado, { status: 'confere' | 'divergencia' }> }) {
  const divergentes = l.status === 'divergencia' ? l.camposDivergentes : []
  return (
    <tr className="border-t border-gray-100">
      <td className="px-3 py-2 text-sm text-gray-700">{l.sesmt.nome}</td>
      <td className={cn('px-3 py-2 text-sm', divergentes.includes('data_inicio') ? 'bg-red-50 font-medium text-red-700' : 'text-gray-600')}>
        {l.sesmt.dataInicio} / {l.sistema.dataInicio}
      </td>
      <td className={cn('px-3 py-2 text-sm', divergentes.includes('data_fim') ? 'bg-red-50 font-medium text-red-700' : 'text-gray-600')}>
        {l.sesmt.dataRetorno} / {l.sistema.dataFim}
      </td>
      <td className={cn('px-3 py-2 text-sm', divergentes.includes('cid') ? 'bg-red-50 font-medium text-red-700' : 'text-gray-600')}>
        {l.sesmt.cidTexto} / {l.sistema.cidCodigo ?? 'Sem CID'}
      </td>
      <td className={cn('px-3 py-2 text-sm', divergentes.includes('origem_ocupacional') ? 'bg-red-50 font-medium text-red-700' : 'text-gray-600')}>
        {l.sesmt.motivo}
      </td>
    </tr>
  )
}

export function TabelaResultado({ resultado }: { resultado: ResultadoAuditoria }) {
  const { linhas, contadores } = resultado

  const divergencias = linhas.filter((l): l is Extract<LinhaResultado, { status: 'divergencia' }> => l.status === 'divergencia')
  const conferem = linhas.filter((l): l is Extract<LinhaResultado, { status: 'confere' }> => l.status === 'confere')
  const naoLancados = linhas.filter((l): l is Extract<LinhaResultado, { status: 'nao_lancado' | 'matricula_nao_encontrada' }> =>
    l.status === 'nao_lancado' || l.status === 'matricula_nao_encontrada',
  )
  const ambiguosOuSemSesmt = linhas.filter(
    (l): l is Extract<LinhaResultado, { status: 'ambiguo' | 'sem_sesmt' }> => l.status === 'ambiguo' || l.status === 'sem_sesmt',
  )

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <CardContador label="Conferem" valor={contadores.confere} cor="border-t-green-500" />
        <CardContador label="Divergências" valor={contadores.divergencia} cor="border-t-red-500" />
        <CardContador label="Não lançados" valor={contadores.naoLancado + contadores.matriculaNaoEncontrada} cor="border-t-amber-500" />
        <CardContador label="Ambíguos / Sem SESMT" valor={contadores.ambiguo + contadores.semSesmt} cor="border-t-indigo-500" />
      </div>

      {divergencias.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-4 py-3">
            <h2 className="text-sm font-bold text-gray-900">⚠️ Divergências ({divergencias.length})</h2>
            <p className="text-xs text-gray-400">Cada célula mostra SESMT / Sistema — em vermelho quando diferem</p>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-widest text-gray-500">
                <th className="px-3 py-2">Funcionário</th>
                <th className="px-3 py-2">Início</th>
                <th className="px-3 py-2">Fim</th>
                <th className="px-3 py-2">CID</th>
                <th className="px-3 py-2">Motivo</th>
              </tr>
            </thead>
            <tbody>
              {divergencias.map((l, i) => (
                <LinhaConfereOuDivergencia key={i} l={l} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {naoLancados.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-4 py-3">
            <h2 className="text-sm font-bold text-gray-900">❌ Não lançados no sistema ({naoLancados.length})</h2>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-widest text-gray-500">
                <th className="px-3 py-2">Funcionário</th>
                <th className="px-3 py-2">Matrícula</th>
                <th className="px-3 py-2">Início</th>
                <th className="px-3 py-2">Retorno</th>
                <th className="px-3 py-2">CID</th>
                <th className="px-3 py-2">Motivo</th>
              </tr>
            </thead>
            <tbody>
              {naoLancados.map((l, i) => (
                <tr key={i} className="border-t border-gray-100">
                  <td className="px-3 py-2 text-sm text-gray-700">{l.sesmt.nome}</td>
                  <td className="px-3 py-2 text-sm text-gray-600">{l.sesmt.matriculaRaw}</td>
                  <td className="px-3 py-2 text-sm text-gray-600">{l.sesmt.dataInicio}</td>
                  <td className="px-3 py-2 text-sm text-gray-600">{l.sesmt.dataRetorno}</td>
                  <td className="px-3 py-2 text-sm text-gray-600">{l.sesmt.cidTexto}</td>
                  <td className="px-3 py-2 text-sm text-gray-600">{l.sesmt.motivo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {ambiguosOuSemSesmt.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-4 py-3">
            <h2 className="text-sm font-bold text-gray-900">ℹ️ Ambíguos / Sem registro no SESMT ({ambiguosOuSemSesmt.length})</h2>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-widest text-gray-500">
                <th className="px-3 py-2">Tipo</th>
                <th className="px-3 py-2">Funcionário</th>
                <th className="px-3 py-2">Detalhe</th>
              </tr>
            </thead>
            <tbody>
              {ambiguosOuSemSesmt.map((l, i) => (
                <tr key={i} className="border-t border-gray-100">
                  <td className="px-3 py-2 text-sm text-gray-600">{l.status === 'ambiguo' ? 'Ambíguo' : 'Sem SESMT'}</td>
                  <td className="px-3 py-2 text-sm text-gray-700">
                    {l.status === 'ambiguo' ? l.sesmt.nome : l.sistema.funcionarioNome}
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-600">
                    {l.status === 'ambiguo'
                      ? `${l.candidatos.length} atestados candidatos no sistema (${l.candidatos.map(c => `${c.dataInicio}→${c.dataFim}`).join(', ')})`
                      : `${l.sistema.dataInicio} → ${l.sistema.dataFim}${l.sistema.cidCodigo ? ` (${l.sistema.cidCodigo})` : ''}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {conferem.length > 0 && (
        <details className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
          <summary className="cursor-pointer border-b border-gray-100 px-4 py-3 text-sm font-bold text-gray-900">
            ✅ Conferem ({conferem.length}) — clique para expandir
          </summary>
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-widest text-gray-500">
                <th className="px-3 py-2">Funcionário</th>
                <th className="px-3 py-2">Início</th>
                <th className="px-3 py-2">Fim</th>
                <th className="px-3 py-2">CID</th>
              </tr>
            </thead>
            <tbody>
              {conferem.map((l, i) => (
                <tr key={i} className="border-t border-gray-100">
                  <td className="px-3 py-2 text-sm text-gray-700">{l.sesmt.nome}</td>
                  <td className="px-3 py-2 text-sm text-gray-600">{l.sistema.dataInicio}</td>
                  <td className="px-3 py-2 text-sm text-gray-600">{l.sistema.dataFim}</td>
                  <td className="px-3 py-2 text-sm text-gray-600">{l.sistema.cidCodigo ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: sem erros novos em `components/auditoria-atestados/tabela-resultado.tsx`

- [ ] **Step 3: Commit**

```bash
git add components/auditoria-atestados/tabela-resultado.tsx
git commit -m "feat(auditoria-atestados): tabela de resultado da auditoria

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Componente de upload (parse do xlsx no client)

**Files:**
- Create: `components/auditoria-atestados/upload-form.tsx`

- [ ] **Step 1: Criar o componente**

Colunas esperadas na planilha (cabeçalho na primeira linha, aba padrão/primeira aba do arquivo — o SESMT exporta sem nome de aba fixo, diferente da `conferencia-rh` que exige aba "LISTAGEM"): `Data`, `Matrícula`, `Empregado`, `Afastamento`, `Motivo`, `CID Abonado`, `Data Retorno`. As colunas `ID`, `Status`, `Status eSocial` são ignoradas.

```typescript
// components/auditoria-atestados/upload-form.tsx
'use client'

import { useState } from 'react'
import * as XLSX from 'xlsx-js-style'
import { auditarSesmt } from '@/app/(admin)/auditoria-atestados/actions'
import { dataBrParaIso } from '@/lib/auditoria-atestados/parse'
import { TabelaResultado } from './tabela-resultado'
import type { LinhaSesmt } from '@/lib/auditoria-atestados/tipos'
import type { ResultadoAuditoria } from '@/lib/auditoria-atestados/tipos'

const COLUNAS_ESPERADAS = ['Data', 'Matrícula', 'Empregado', 'Afastamento', 'Motivo', 'CID Abonado', 'Data Retorno']

function celulaParaDataIso(valor: unknown): string | null {
  if (valor == null || valor === '') return null
  if (valor instanceof Date) {
    const y = valor.getFullYear()
    const m = String(valor.getMonth() + 1).padStart(2, '0')
    const d = String(valor.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  return dataBrParaIso(String(valor))
}

function parseArquivoSesmt(file: File): Promise<{ linhas: LinhaSesmt[]; erro?: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => {
      try {
        const buffer = e.target?.result as ArrayBuffer
        const wb = XLSX.read(buffer, { type: 'array', cellDates: true })
        const ws = wb.Sheets[wb.SheetNames[0]]
        if (!ws) {
          resolve({ linhas: [], erro: 'Planilha vazia ou sem abas.' })
          return
        }
        const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null }) as unknown[][]
        const header = (raw[0] ?? []).map(h => String(h ?? '').trim())
        const indices = COLUNAS_ESPERADAS.map(c => header.indexOf(c))
        if (indices.some(i => i === -1)) {
          resolve({
            linhas: [],
            erro: `Cabeçalho inesperado. Colunas obrigatórias: ${COLUNAS_ESPERADAS.join(', ')}.`,
          })
          return
        }
        const [iData, iMatricula, iEmpregado, iAfastamento, iMotivo, iCid, iRetorno] = indices

        const linhas: LinhaSesmt[] = []
        for (const row of raw.slice(1)) {
          const matriculaRaw = row[iMatricula]
          if (matriculaRaw == null || String(matriculaRaw).trim() === '') continue
          const dataInicio = celulaParaDataIso(row[iData])
          const dataRetorno = celulaParaDataIso(row[iRetorno])
          if (!dataInicio || !dataRetorno) continue
          linhas.push({
            matriculaRaw: String(matriculaRaw).trim(),
            nome: String(row[iEmpregado] ?? '').trim(),
            dataInicio,
            diasTexto: String(row[iAfastamento] ?? '').trim(),
            motivo: String(row[iMotivo] ?? '').trim(),
            cidTexto: String(row[iCid] ?? '').trim(),
            dataRetorno,
          })
        }
        resolve({ linhas })
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

export function UploadForm() {
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [resultado, setResultado] = useState<ResultadoAuditoria | null>(null)
  const [nomeArquivo, setNomeArquivo] = useState<string | null>(null)

  async function onFile(file: File) {
    setCarregando(true)
    setErro(null)
    setResultado(null)
    setNomeArquivo(file.name)
    try {
      const { linhas, erro: erroParse } = await parseArquivoSesmt(file)
      if (erroParse) { setErro(erroParse); return }
      if (linhas.length === 0) { setErro('Nenhuma linha válida encontrada na planilha.'); return }

      const res = await auditarSesmt(linhas)
      if ('erro' in res) { setErro(res.erro); return }
      setResultado(res)
    } catch {
      setErro('Falha ao ler o arquivo. Confirme que é um .xlsx válido.')
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-gray-500">
          Planilha do SESMT (.xlsx)
        </label>
        <input
          type="file"
          accept=".xlsx"
          onChange={e => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (f) onFile(f)
          }}
          className="text-sm"
        />
        {nomeArquivo && <p className="mt-2 text-xs text-gray-400">Arquivo: {nomeArquivo}</p>}
        {carregando && <p className="mt-2 text-xs text-gray-500">Comparando...</p>}
        {erro && <p className="mt-2 text-xs font-medium text-red-600">{erro}</p>}
      </div>

      {resultado && <TabelaResultado resultado={resultado} />}
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: sem erros novos em `components/auditoria-atestados/upload-form.tsx`

- [ ] **Step 3: Commit**

```bash
git add components/auditoria-atestados/upload-form.tsx
git commit -m "feat(auditoria-atestados): upload e parse do xlsx do sesmt

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: Página

**Files:**
- Create: `app/(admin)/auditoria-atestados/page.tsx`

- [ ] **Step 1: Criar a página**

```typescript
// app/(admin)/auditoria-atestados/page.tsx
import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth/get-user'
import { isAdminOrCoord, type Role } from '@/types'
import { UploadForm } from '@/components/auditoria-atestados/upload-form'

export default async function AuditoriaAtestadosPage() {
  const auth = await getUser()
  if (!auth) redirect('/login')
  if (!isAdminOrCoord(auth.perfil.role as Role)) redirect('/dashboard')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Auditoria SESMT × Atestados</h1>
        <p className="text-sm text-gray-400">
          Envie a planilha exportada do sistema de segurança e medicina do trabalho pra comparar com os
          atestados lançados no sistema.
        </p>
      </div>
      <UploadForm />
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: sem erros novos em `app/(admin)/auditoria-atestados/page.tsx`

- [ ] **Step 3: Commit**

```bash
git add "app/(admin)/auditoria-atestados/page.tsx"
git commit -m "feat(auditoria-atestados): pagina com guard de role

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 8: Item de menu

**Files:**
- Modify: `components/admin/nav-config.ts`
- Modify: `components/layout/nav-config.ts`
- Modify: `components/admin/sidebar-nav.tsx`

- [ ] **Step 1: Adicionar entrada em `components/admin/nav-config.ts`**

Na seção `Administração`, logo após a linha do `/conferencia-rh`:

```typescript
      { href: '/conferencia-rh',   label: 'Conferência RH', allowedRoles: ROLES_GESTAO },
      { href: '/auditoria-atestados', label: 'Auditoria SESMT', allowedRoles: ROLES_GESTAO },
```

- [ ] **Step 2: Adicionar entrada em `components/layout/nav-config.ts`**

Este arquivo não tem `allowedRoles` (grupo inteiro já é `adminOnly: true`, e como `coordenador` também precisa acessar, siga o padrão já usado por `/fechamento` neste arquivo — que hoje já está sob `adminOnly` sem diferenciação por role, então a mesma limitação já existente se aplica). Adicione, na seção `Administração`, após `/importacao`:

```typescript
      { href: '/importacao',     label: 'Importação'    },
      { href: '/auditoria-atestados', label: 'Auditoria SESMT' },
```

- [ ] **Step 3: Adicionar ícone em `components/admin/sidebar-nav.tsx`**

Adicione `FileSearch` ao import de `lucide-react`:

```typescript
  SearchCheck,
  FileSearch,
} from 'lucide-react'
```

E adicione a entrada no mapa `ICONS`, após `/revisor-operacional`:

```typescript
  '/revisor-operacional':   SearchCheck,
  '/auditoria-atestados':   FileSearch,
```

- [ ] **Step 4: Type-check e build completo**

Run: `npx tsc --noEmit`
Expected: sem erros

Run: `npm run build`
Expected: build completo sem erros (pode haver warnings pré-existentes — confirme que nenhum erro novo referencia os arquivos criados/modificados nesta task)

- [ ] **Step 5: Commit**

```bash
git add components/admin/nav-config.ts components/layout/nav-config.ts components/admin/sidebar-nav.tsx
git commit -m "feat(auditoria-atestados): item de menu na sidebar

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 9: Verificação manual end-to-end

**Files:** nenhum (apenas verificação)

- [ ] **Step 1: Rodar o servidor de dev**

Run: `npm run dev`

- [ ] **Step 2: Logar como admin e navegar até `/auditoria-atestados`**

Confirme que a página carrega, o menu lateral mostra "Auditoria SESMT" no grupo Administração, e o campo de upload aparece.

- [ ] **Step 3: Fazer upload do arquivo real do SESMT (o `.xlsx` equivalente ao anexo original em Markdown)**

Se só houver a versão `.md` do anexo original, gere manualmente um `.xlsx` de teste com as mesmas colunas (`Data`, `Matrícula`, `Empregado`, `Afastamento`, `Motivo`, `CID Abonado`, `Data Retorno`, `ID`, `Status`, `Status eSocial`) usando uma amostra de 5-10 linhas da tabela original, pra validar o fluxo completo.

Expected: relatório renderiza com as 4 seções, contadores no topo batem com o total de linhas do arquivo, nenhum erro no console do navegador.

- [ ] **Step 4: Confirmar acesso negado pra supervisor/viewer**

Logue com um usuário `supervisor` ou `viewer` e acesse `/auditoria-atestados` diretamente pela URL — deve redirecionar para `/dashboard`.

- [ ] **Step 5: Reportar resultado ao usuário**

Sem commit nesta task — é só checkpoint de verificação manual antes de considerar a feature pronta.
