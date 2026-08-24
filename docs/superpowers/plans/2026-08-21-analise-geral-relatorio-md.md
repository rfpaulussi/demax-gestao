# Análise Geral — Relatório Consolidado MD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nova página `relatorios/analise-geral` que gera, com um clique, um arquivo `.md` consolidando atestados, faltas, mudanças de função, coberturas insalubres, efetivo x postos e advertências dos últimos 30/60/90 dias, com um prompt de análise (especialista RH/Gestão de Pessoas/Medicina do Trabalho) já embutido no topo do arquivo.

**Architecture:** Server Component (`page.tsx`) com gate `admin`/`coordenador` renderiza um Client Component com select de período + checkboxes de seção. O Client Component chama uma Server Action (`gerarAnaliseGeral`) que consulta as tabelas do Supabase (paginando via `fetchAllRows`), monta uma string Markdown com um prompt fixo no topo e uma tabela por seção marcada, e devolve a string pro client, que dispara o download via Blob. Nenhuma chamada a API externa.

**Tech Stack:** Next.js 14 App Router, Server Actions, Supabase (`@/lib/supabase/server`, `@/lib/supabase/fetch-all`), TypeScript. Sem framework de testes no projeto — verificação é via `npx tsc --noEmit` / `npm run build` + checagem manual no browser, seguindo a convenção do `CLAUDE.md`.

---

## Nota sobre testes

Este projeto não tem Jest/Vitest configurado (`package.json` sem script `test`, sem pasta `__tests__`). Os passos de verificação aqui usam `npx tsc --noEmit` (rápido, a cada task) e `npm run build` (completo, na task final), que é o fluxo já documentado em `CLAUDE.md`.

---

### Task 1: Server Action — helpers, Atestados e Faltas

**Files:**
- Create: `app/(admin)/relatorios/analise-geral/actions.ts`

- [ ] **Step 1: Criar o arquivo com tipos, helpers e as seções Atestados/Faltas**

```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import { getUser } from '@/lib/auth/get-user'

export interface AnaliseGeralSecoes {
  atestados: boolean
  faltas: boolean
  mudancasFuncao: boolean
  coberturasInsalubres: boolean
  efetivoPostos: boolean
  advertencias: boolean
}

export interface AnaliseGeralParams {
  periodoDias: number
  secoes: AnaliseGeralSecoes
}

type FuncJoin = {
  nome: string
  registro: string | null
  posto_id: string | null
  postos: { nome: string; secretaria: string | null } | null
}

function fmtData(iso: string | null): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function esc(v: string | number | null | undefined): string {
  return String(v ?? '—').replace(/\|/g, '\\|').replace(/\n/g, ' ')
}

function mdTable(headers: string[], rows: (string | number)[][]): string {
  if (rows.length === 0) return 'Nenhum registro no período.\n'
  const head = `| ${headers.join(' | ')} |`
  const sep = `| ${headers.map(() => '---').join(' | ')} |`
  const body = rows.map(r => `| ${r.map(esc).join(' | ')} |`).join('\n')
  return `${head}\n${sep}\n${body}\n`
}

function diasEntre(inicio: string, fim: string): number {
  const ms = new Date(fim).getTime() - new Date(inicio).getTime()
  return Math.round(ms / 86400000) + 1
}

type AtestadoRaw = {
  id: string
  data_inicio: string
  data_fim: string
  motivo: string | null
  sem_cid: boolean | null
  cid_codigo: string | null
  funcionarios: FuncJoin | null
}

async function secaoAtestados(inicio: string, fim: string): Promise<string> {
  const supabase = createClient()

  const [atestados, { data: cids }] = await Promise.all([
    fetchAllRows<AtestadoRaw>((from, to) =>
      supabase
        .from('atestados')
        .select(`
          id, data_inicio, data_fim, motivo, sem_cid, cid_codigo,
          funcionarios!funcionario_id ( nome, registro, posto_id, postos!posto_id ( nome, secretaria ) )
        `)
        .gte('data_inicio', inicio)
        .lte('data_inicio', fim)
        .order('data_inicio', { ascending: true })
        .range(from, to) as unknown as PromiseLike<{ data: AtestadoRaw[] | null; error: { message: string } | null }>,
    ),
    supabase.from('cid_referencia').select('codigo, descricao'),
  ])

  const cidByCodigo = new Map<string, string>((cids ?? []).map(c => [c.codigo, c.descricao]))

  const rows = atestados.map(a => {
    const func = a.funcionarios
    const cid = a.cid_codigo
      ? `${a.cid_codigo} - ${cidByCodigo.get(a.cid_codigo) ?? ''}`
      : a.sem_cid ? 'Sem CID' : '—'
    return [
      func?.nome ?? '—',
      func?.postos?.nome ?? '—',
      func?.postos?.secretaria ?? '—',
      `${fmtData(a.data_inicio)}–${fmtData(a.data_fim)}`,
      diasEntre(a.data_inicio, a.data_fim),
      cid,
      a.motivo ?? '—',
    ]
  })

  return `## Atestados\n\n${mdTable(
    ['Funcionário', 'Posto', 'Secretaria', 'Período', 'Dias', 'CID', 'Motivo'],
    rows,
  )}`
}

type FaltaRaw = {
  id: string
  data_falta: string
  tipo: string
  dias: number
  observacao: string | null
  funcionarios: FuncJoin | null
}

const TIPO_FALTA_LABEL: Record<string, string> = {
  com_atestado: 'Com atestado',
  sem_atestado: 'Sem atestado',
}

async function secaoFaltas(inicio: string, fim: string): Promise<string> {
  const supabase = createClient()

  const faltas = await fetchAllRows<FaltaRaw>((from, to) =>
    supabase
      .from('faltas')
      .select(`
        id, data_falta, tipo, dias, observacao,
        funcionarios!funcionario_id ( nome, registro, posto_id, postos!posto_id ( nome, secretaria ) )
      `)
      .gte('data_falta', inicio)
      .lte('data_falta', fim)
      .order('data_falta', { ascending: true })
      .range(from, to) as unknown as PromiseLike<{ data: FaltaRaw[] | null; error: { message: string } | null }>,
  )

  const rows = faltas.map(f => {
    const func = f.funcionarios
    return [
      fmtData(f.data_falta),
      func?.nome ?? '—',
      func?.postos?.nome ?? '—',
      func?.postos?.secretaria ?? '—',
      TIPO_FALTA_LABEL[f.tipo] ?? f.tipo,
      f.dias,
      f.observacao ?? '—',
    ]
  })

  return `## Faltas\n\n${mdTable(
    ['Data', 'Funcionário', 'Posto', 'Secretaria', 'Tipo', 'Dias', 'Observação'],
    rows,
  )}`
}
```

- [ ] **Step 2: Checar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros novos relacionados a `app/(admin)/relatorios/analise-geral/actions.ts` (o arquivo ainda não exporta a função principal, então `gerarAnaliseGeral` ainda não é usado em lugar nenhum — isso é esperado nesta task).

- [ ] **Step 3: Commit**

```bash
git add "app/(admin)/relatorios/analise-geral/actions.ts"
git commit -m "feat(relatorios): base da action de análise geral (atestados, faltas)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Server Action — Mudanças de Função e Advertências

**Files:**
- Modify: `app/(admin)/relatorios/analise-geral/actions.ts` (adicionar ao final, antes de nenhuma função existente ser removida)

- [ ] **Step 1: Adicionar as seções Mudanças de Função e Advertências**

Adicionar ao final de `app/(admin)/relatorios/analise-geral/actions.ts`:

```typescript
type HistoricoRaw = {
  id: string
  data_evento: string
  dados_anteriores: { funcao_id?: string } | null
  dados_novos: { funcao_id?: string } | null
  funcionarios: FuncJoin | null
}

async function secaoMudancasFuncao(inicio: string, fim: string): Promise<string> {
  const supabase = createClient()

  const [historico, { data: funcoes }] = await Promise.all([
    fetchAllRows<HistoricoRaw>((from, to) =>
      supabase
        .from('historico_funcionarios')
        .select(`
          id, data_evento, dados_anteriores, dados_novos,
          funcionarios!funcionario_id ( nome, registro, posto_id, postos!posto_id ( nome, secretaria ) )
        `)
        .eq('tipo', 'mudanca_funcao')
        .gte('data_evento', inicio)
        .lte('data_evento', fim)
        .order('data_evento', { ascending: true })
        .range(from, to) as unknown as PromiseLike<{ data: HistoricoRaw[] | null; error: { message: string } | null }>,
    ),
    supabase.from('funcoes').select('id, nome'),
  ])

  const funcaoById = new Map<string, string>((funcoes ?? []).map(f => [f.id, f.nome]))

  const rows = historico.map(h => {
    const func = h.funcionarios
    const funcaoAnteriorId = h.dados_anteriores?.funcao_id ?? ''
    const funcaoNovaId = h.dados_novos?.funcao_id ?? ''
    return [
      fmtData(h.data_evento),
      func?.nome ?? '—',
      func?.postos?.nome ?? '—',
      func?.postos?.secretaria ?? '—',
      funcaoById.get(funcaoAnteriorId) ?? '—',
      funcaoById.get(funcaoNovaId) ?? '—',
    ]
  })

  return `## Mudanças de Função\n\n${mdTable(
    ['Data', 'Funcionário', 'Posto', 'Secretaria', 'Função Anterior', 'Função Nova'],
    rows,
  )}`
}

type AdvertenciaRaw = {
  id: string
  data_ocorrencia: string | null
  grau: string | null
  tipo: string | null
  descricao: string | null
  dias_suspensao: number | null
  status: string | null
  funcionarios: FuncJoin | null
}

async function secaoAdvertencias(inicio: string, fim: string): Promise<string> {
  const supabase = createClient()

  const advertencias = await fetchAllRows<AdvertenciaRaw>((from, to) =>
    supabase
      .from('advertencias')
      .select(`
        id, data_ocorrencia, grau, tipo, descricao, dias_suspensao, status,
        funcionarios!funcionario_id ( nome, registro, posto_id, postos!posto_id ( nome, secretaria ) )
      `)
      .gte('data_ocorrencia', inicio)
      .lte('data_ocorrencia', fim)
      .order('data_ocorrencia', { ascending: true })
      .range(from, to) as unknown as PromiseLike<{ data: AdvertenciaRaw[] | null; error: { message: string } | null }>,
  )

  const rows = advertencias.map(a => {
    const func = a.funcionarios
    return [
      fmtData(a.data_ocorrencia),
      func?.nome ?? '—',
      func?.postos?.nome ?? '—',
      func?.postos?.secretaria ?? '—',
      a.grau ?? a.tipo ?? '—',
      a.status ?? '—',
      a.dias_suspensao ?? '—',
      a.descricao ?? '—',
    ]
  })

  return `## Advertências\n\n${mdTable(
    ['Data', 'Funcionário', 'Posto', 'Secretaria', 'Grau', 'Status', 'Dias Suspensão', 'Descrição'],
    rows,
  )}`
}
```

- [ ] **Step 2: Checar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros novos no arquivo.

- [ ] **Step 3: Commit**

```bash
git add "app/(admin)/relatorios/analise-geral/actions.ts"
git commit -m "feat(relatorios): seções mudanças de função e advertências na análise geral

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Server Action — Coberturas Insalubres, Efetivo x Postos, prompt e função principal

**Files:**
- Modify: `app/(admin)/relatorios/analise-geral/actions.ts`

- [ ] **Step 1: Adicionar as seções restantes, o prompt e `gerarAnaliseGeral`**

Adicionar ao final de `app/(admin)/relatorios/analise-geral/actions.ts`:

```typescript
type CoberturaRaw = {
  id: string
  data_cobertura: string
  agente_ausente_nome: string | null
  observacao: string | null
  periodo_dias: number
  funcionarios: { nome: string } | null
  postos: { nome: string; secretaria: string | null } | null
}

async function secaoCoberturasInsalubres(inicio: string, fim: string): Promise<string> {
  const supabase = createClient()

  const coberturas = await fetchAllRows<CoberturaRaw>((from, to) =>
    supabase
      .from('insalubridade_coberturas')
      .select(`
        id, data_cobertura, agente_ausente_nome, observacao, periodo_dias,
        funcionarios!funcionario_id ( nome ),
        postos!posto_id ( nome, secretaria )
      `)
      .gte('data_cobertura', inicio)
      .lte('data_cobertura', fim)
      .order('data_cobertura', { ascending: true })
      .range(from, to) as unknown as PromiseLike<{ data: CoberturaRaw[] | null; error: { message: string } | null }>,
  )

  const rows = coberturas.map(c => [
    fmtData(c.data_cobertura),
    c.funcionarios?.nome ?? '—',
    c.agente_ausente_nome ?? '—',
    c.postos?.nome ?? '—',
    c.postos?.secretaria ?? '—',
    c.periodo_dias,
    c.observacao ?? '—',
  ])

  return `## Coberturas Insalubres\n\n${mdTable(
    ['Data', 'Cobridor', 'Ausente (coberto)', 'Posto', 'Secretaria', 'Dias', 'Motivo'],
    rows,
  )}`
}

type PostoRaw = { id: string; nome: string; secretaria: string | null; efetivo_previsto: number | null }

async function secaoEfetivoPostos(): Promise<string> {
  const supabase = createClient()

  const [{ data: postos }, funcionarios] = await Promise.all([
    supabase
      .from('postos')
      .select('id, nome, secretaria, efetivo_previsto')
      .eq('ativo', true)
      .order('secretaria', { ascending: true })
      .order('nome', { ascending: true }),
    fetchAllRows<{ posto_id: string | null }>((from, to) =>
      supabase
        .from('funcionarios')
        .select('posto_id')
        .eq('status', 'ativo')
        .not('posto_id', 'is', null)
        .range(from, to) as unknown as PromiseLike<{ data: { posto_id: string | null }[] | null; error: { message: string } | null }>,
    ),
  ])

  const atualPorPosto = new Map<string, number>()
  for (const f of funcionarios) {
    if (!f.posto_id) continue
    atualPorPosto.set(f.posto_id, (atualPorPosto.get(f.posto_id) ?? 0) + 1)
  }

  const rows = ((postos ?? []) as PostoRaw[])
    .map(p => {
      const previsto = p.efetivo_previsto ?? 0
      const atual = atualPorPosto.get(p.id) ?? 0
      return { p, previsto, atual, gap: previsto - atual }
    })
    .sort((a, b) => b.gap - a.gap)
    .map(({ p, previsto, atual, gap }) => [
      p.nome,
      p.secretaria ?? '—',
      previsto,
      atual,
      gap > 0 ? `-${gap} (déficit)` : gap < 0 ? `+${-gap} (superávit)` : '0',
    ])

  return `## Efetivo x Postos\n\n_Situação atual — não depende do período selecionado._\n\n${mdTable(
    ['Posto', 'Secretaria', 'Efetivo Previsto', 'Efetivo Atual', 'Déficit/Superávit'],
    rows,
  )}`
}

function construirPrompt(inicio: string, fim: string): string {
  const geradoEm = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
  return `# Prompt para análise

Você é um especialista em RH, Gestão de Pessoas e Medicina do Trabalho.
Analise os dados abaixo (relatório consolidado do período de ${fmtData(inicio)} a ${fmtData(fim)}, gerado em ${geradoEm}) e produza um diagnóstico apontando:
- Problemas, falhas e situações graves ou fora do padrão
- Riscos (saúde ocupacional, rotatividade, conformidade, operacional)
- Padrões preocupantes (ex.: funcionários com atestados recorrentes, postos com déficit crônico de efetivo, concentração de advertências)
- Recomendações práticas e priorizadas

---
`
}

export async function gerarAnaliseGeral(
  params: AnaliseGeralParams,
): Promise<{ markdown: string } | { error: string }> {
  try {
    const userCtx = await getUser()
    if (!userCtx || !['admin', 'coordenador'].includes(userCtx.perfil.role ?? '')) {
      return { error: 'Acesso não autorizado.' }
    }

    const hoje = new Date()
    const inicioDate = new Date(hoje)
    inicioDate.setDate(inicioDate.getDate() - params.periodoDias)
    const inicio = inicioDate.toISOString().slice(0, 10)
    const fim = hoje.toISOString().slice(0, 10)

    const partes: string[] = [construirPrompt(inicio, fim)]

    if (params.secoes.atestados) partes.push(await secaoAtestados(inicio, fim))
    if (params.secoes.faltas) partes.push(await secaoFaltas(inicio, fim))
    if (params.secoes.mudancasFuncao) partes.push(await secaoMudancasFuncao(inicio, fim))
    if (params.secoes.coberturasInsalubres) partes.push(await secaoCoberturasInsalubres(inicio, fim))
    if (params.secoes.efetivoPostos) partes.push(await secaoEfetivoPostos())
    if (params.secoes.advertencias) partes.push(await secaoAdvertencias(inicio, fim))

    return { markdown: partes.join('\n') }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erro ao gerar relatório.' }
  }
}
```

- [ ] **Step 2: Checar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros no arquivo `app/(admin)/relatorios/analise-geral/actions.ts`.

- [ ] **Step 3: Commit**

```bash
git add "app/(admin)/relatorios/analise-geral/actions.ts"
git commit -m "feat(relatorios): completa action gerarAnaliseGeral com todas as seções

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Client Component — formulário e download

**Files:**
- Create: `components/relatorios/analise-geral-client.tsx`

- [ ] **Step 1: Criar o componente**

```typescript
'use client'

import { useState } from 'react'
import { Loader2, FileDown } from 'lucide-react'
import { gerarAnaliseGeral, type AnaliseGeralSecoes } from '@/app/(admin)/relatorios/analise-geral/actions'

const sel = 'h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400'

const SECOES_LABELS: { key: keyof AnaliseGeralSecoes; label: string }[] = [
  { key: 'atestados', label: 'Atestados' },
  { key: 'faltas', label: 'Faltas' },
  { key: 'mudancasFuncao', label: 'Mudanças de Função' },
  { key: 'coberturasInsalubres', label: 'Coberturas Insalubres' },
  { key: 'efetivoPostos', label: 'Efetivo x Postos' },
  { key: 'advertencias', label: 'Advertências' },
]

const SECOES_PADRAO: AnaliseGeralSecoes = {
  atestados: true,
  faltas: true,
  mudancasFuncao: true,
  coberturasInsalubres: true,
  efetivoPostos: true,
  advertencias: true,
}

export function AnaliseGeralClient() {
  const [periodoDias, setPeriodoDias] = useState(90)
  const [secoes, setSecoes] = useState<AnaliseGeralSecoes>(SECOES_PADRAO)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggleSecao(key: keyof AnaliseGeralSecoes) {
    setSecoes(prev => ({ ...prev, [key]: !prev[key] }))
  }

  async function handleGerar() {
    setLoading(true)
    setError(null)
    try {
      const resultado = await gerarAnaliseGeral({ periodoDias, secoes })
      if ('error' in resultado) {
        setError(resultado.error)
        return
      }
      const blob = new Blob([resultado.markdown], { type: 'text/markdown;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const hoje = new Date().toISOString().slice(0, 10)
      const a = document.createElement('a')
      a.href = url
      a.download = `analise-geral-${periodoDias}dias-${hoje}.md`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao gerar relatório.')
    } finally {
      setLoading(false)
    }
  }

  const nenhumaSecaoMarcada = Object.values(secoes).every(v => !v)

  return (
    <div className="space-y-5 rounded-xl border border-gray-100 border-t-4 border-t-emerald-500 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <label className="text-xs font-semibold uppercase tracking-widest text-gray-500">Período</label>
        <select
          className={sel}
          value={periodoDias}
          onChange={e => setPeriodoDias(Number(e.target.value))}
        >
          <option value={30}>Últimos 30 dias</option>
          <option value={60}>Últimos 60 dias</option>
          <option value={90}>Últimos 90 dias</option>
        </select>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-500">Seções</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {SECOES_LABELS.map(({ key, label }) => (
            <label key={key} className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={secoes[key]}
                onChange={() => toggleSecao(key)}
                className="h-4 w-4 rounded border-gray-300"
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="button"
        onClick={handleGerar}
        disabled={loading || nenhumaSecaoMarcada}
        className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
        {loading ? 'Gerando...' : 'Gerar relatório MD'}
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Checar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros no componente.

- [ ] **Step 3: Commit**

```bash
git add components/relatorios/analise-geral-client.tsx
git commit -m "feat(relatorios): client component da análise geral com download MD

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Página com gate de acesso e link no índice de Relatórios

**Files:**
- Create: `app/(admin)/relatorios/analise-geral/page.tsx`
- Modify: `app/(admin)/relatorios/page.tsx`

- [ ] **Step 1: Criar a página**

```typescript
import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth/get-user'
import { BackButton } from '@/components/ui/back-button'
import { AnaliseGeralClient } from '@/components/relatorios/analise-geral-client'

export default async function AnaliseGeralPage() {
  const userCtx = await getUser()
  if (!userCtx || !['admin', 'coordenador'].includes(userCtx.perfil.role ?? '')) {
    redirect('/dashboard')
  }

  return (
    <div className="space-y-6">
      <BackButton href="/relatorios" label="Voltar aos Relatórios" />
      <div>
        <h1 className="text-lg font-bold text-gray-900">Análise Geral</h1>
        <p className="text-sm text-gray-400">
          Relatório consolidado em Markdown — atestados, faltas, mudanças de função, coberturas
          insalubres, efetivo x postos e advertências, com prompt de análise já embutido.
        </p>
      </div>

      <AnaliseGeralClient />
    </div>
  )
}
```

- [ ] **Step 2: Adicionar o card no índice de Relatórios**

Em `app/(admin)/relatorios/page.tsx`, trocar o import de ícones (linha 2):

```typescript
import { Users, ArrowLeftRight, RefreshCw, CalendarX, AlertTriangle, UserX, LogOut, FileSearch } from 'lucide-react'
```

E adicionar este objeto como primeiro item do array `RELATORIOS` (antes de `coberturas-insalubres`):

```typescript
  {
    href: '/relatorios/analise-geral',
    icon: FileSearch,
    label: 'Análise Geral',
    desc: 'Relatório consolidado em Markdown com prompt de análise pronto pra IA',
    color: 'border-t-emerald-500',
    iconColor: 'text-emerald-500',
  },
```

- [ ] **Step 3: Checar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add "app/(admin)/relatorios/analise-geral/page.tsx" "app/(admin)/relatorios/page.tsx"
git commit -m "feat(relatorios): página de análise geral com gate admin/coordenador

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Build completo e verificação manual

**Files:** nenhum (apenas verificação)

- [ ] **Step 1: Build de produção**

Run: `npm run build`
Expected: build conclui sem erros. Corrigir qualquer erro de tipo/lint antes de prosseguir.

- [ ] **Step 2: Verificação manual no browser (dev server)**

Run: `npm run dev`, logar como `admin` ou `coordenador`, navegar até `/relatorios/analise-geral`.

Checklist:
- Página carrega com select de período (30/60/90) e 6 checkboxes marcados.
- Clicar "Gerar relatório MD" com as 6 seções marcadas baixa um arquivo `analise-geral-90dias-{data}.md`.
- Abrir o arquivo baixado: primeiro conteúdo é o prompt (com o intervalo de datas correto, não "90 dias" solto), seguido de `## Atestados`, `## Faltas`, `## Mudanças de Função`, `## Coberturas Insalubres`, `## Efetivo x Postos`, `## Advertências`, nessa ordem.
- Desmarcar algumas seções (ex.: deixar só Atestados e Efetivo x Postos) e gerar de novo — arquivo só traz as seções marcadas.
- Escolher um período (ex.: 30 dias) sem nenhum registro numa seção — a seção aparece com "Nenhum registro no período." em vez de tabela vazia ou seção ausente.
- Botão "Gerar relatório MD" fica desabilitado se todas as seções forem desmarcadas.
- Logar como `supervisor` ou `viewer` e tentar acessar `/relatorios/analise-geral` diretamente pela URL — deve redirecionar pra `/dashboard`.
- Card "Análise Geral" aparece na página `/relatorios` (para admin/coordenador).

- [ ] **Step 3: Reportar resultado**

Se tudo passar, relatar ao usuário que a feature está pronta e funcionando, com prints/trecho do `.md` gerado se fizer sentido. Se algo falhar, voltar à task correspondente, corrigir e repetir o build.
