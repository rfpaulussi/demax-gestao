# Visibilidade do Alerta de Retorno INSS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O alerta "Retorno INSS vencido" fica visível sem rolar a tela (aviso nos cards de KPI já existentes) e alcança quem não abre o dashboard, via sino de notificação — tanto admin (`NotificacoesBell`) quanto supervisor (`SupervisorBell`, que ganha um canal de alertas do sistema que hoje não existe).

**Architecture:** Reaproveita a infraestrutura já existente pro admin (`log_supervisor_acoes` + cron `snapshot-diario`, mesmo padrão do `alerta_ferias`). Pro supervisor, cria uma tabela nova genérica `alertas_supervisor` (não específica de INSS) com RLS por `supervisor_id`, populada pelo mesmo cron, lida pelo `SupervisorBell` estendido.

**Tech Stack:** Next.js 14 Server Components/Actions, Supabase (Postgres + RLS), TypeScript, Vercel Cron.

**Nota sobre testes:** projeto sem test runner configurado. Verificação via `npx tsc --noEmit` e `npm run build` (roda `next lint` — já causou falha de deploy antes por erro que `tsc` sozinho não pega).

---

## Arquivos

- Criar `supabase/migrations/20260821_alertas_supervisor.sql` — tabela nova
- Modificar `app/api/cron/snapshot-diario/route.ts` — 2 funções novas (alerta admin + alerta supervisor)
- Modificar `components/admin/notificacoes-bell.tsx` — novo tipo de alerta no sino do admin
- Modificar `app/(admin)/notificacoes/actions.ts` — nova action `marcarAlertasSupervisorLidos`
- Modificar `components/admin/supervisor-bell.tsx` — novo canal de alertas no sino do supervisor
- Modificar `app/(admin)/layout.tsx` — busca os alertas do supervisor logado
- Modificar `app/(admin)/dashboard/page.tsx` — aviso nos cards de KPI (admin + supervisor)

---

### Task 1: Tabela `alertas_supervisor`

**Files:**
- Create: `supabase/migrations/20260821_alertas_supervisor.sql`

- [ ] **Step 1: Criar a migration**

```sql
-- Canal de alertas do sistema direcionados a um supervisor específico — genérico,
-- não específico de INSS, serve de base pra outros tipos de alerta no futuro.
-- Diferente de log_supervisor_acoes (que registra ações QUE o supervisor fez, pro
-- admin acompanhar) — esta tabela é o oposto: alertas ENVIADOS ao supervisor.

CREATE TABLE alertas_supervisor (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  supervisor_id uuid        NOT NULL REFERENCES perfis(id) ON DELETE CASCADE,
  tipo          text        NOT NULL,
  titulo        text        NOT NULL,
  detalhes      text,
  lido          boolean     NOT NULL DEFAULT false
);

CREATE INDEX idx_alertas_supervisor_supervisor ON alertas_supervisor(supervisor_id, lido);
CREATE INDEX idx_alertas_supervisor_created_at ON alertas_supervisor(created_at DESC);

ALTER TABLE alertas_supervisor ENABLE ROW LEVEL SECURITY;

CREATE POLICY "supervisor le proprios alertas" ON alertas_supervisor
  FOR SELECT USING (supervisor_id = auth.uid());

CREATE POLICY "supervisor atualiza proprios alertas" ON alertas_supervisor
  FOR UPDATE USING (supervisor_id = auth.uid()) WITH CHECK (supervisor_id = auth.uid());
```

- [ ] **Step 2: Aplicar a migration no Supabase**

Abrir o Supabase Studio (SQL Editor) do projeto (`fwdhnipekbmeqozkpfyh`) e rodar o conteúdo do arquivo acima. Confirmar que a tabela `alertas_supervisor` aparece no schema (Table Editor) antes de prosseguir — as próximas tasks dependem dela existir.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260821_alertas_supervisor.sql
git commit -m "feat(db): tabela alertas_supervisor

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Cron — gera os alertas (admin + supervisor)

**Files:**
- Modify: `app/api/cron/snapshot-diario/route.ts`

- [ ] **Step 1: Adicionar as duas funções, logo após `alertarFeriasVencendo`**

Localizar o fim de `alertarFeriasVencendo` (a função termina com `return { notificado: true, vencidos, criticos }` seguido de `}`), logo antes de `export async function GET`. Adicionar as duas funções novas nesse ponto:

```typescript

async function alertarRetornosInssVencidos(supabase: ReturnType<typeof createAdminClient>, hoje: string) {
  type VencidoRow = {
    funcionario_id: string
    funcionarios: { nome: string; status: string } | null
  }
  const { data } = await supabase
    .from('afastamentos')
    .select('funcionario_id, funcionarios!inner(nome, status)')
    .is('data_fim_real', null)
    .not('data_fim_prevista', 'is', null)
    .lte('data_fim_prevista', hoje)
    .eq('funcionarios.status', 'afastado')

  const vistos = new Set<string>()
  const nomes: string[] = []
  for (const v of ((data ?? []) as unknown as VencidoRow[])) {
    if (vistos.has(v.funcionario_id)) continue
    vistos.add(v.funcionario_id)
    nomes.push(v.funcionarios?.nome ?? '—')
  }

  if (nomes.length === 0) return { notificado: false, total: 0 }

  const { data: existing } = await supabase
    .from('log_supervisor_acoes')
    .select('id')
    .eq('tipo', 'alerta_retorno_inss')
    .gte('created_at', `${hoje}T00:00:00`)
    .lte('created_at', `${hoje}T23:59:59`)
    .maybeSingle()

  const payload = {
    supervisor_nome: 'Sistema',
    tipo: 'alerta_retorno_inss',
    acao: 'alerta',
    funcionario_nome: `${nomes.length} funcionário${nomes.length > 1 ? 's' : ''}`,
    detalhes: JSON.stringify({ nomes, total: nomes.length, data: hoje }),
    lido: false,
  }

  if (existing) {
    await supabase.from('log_supervisor_acoes').update(payload).eq('id', existing.id)
  } else {
    await supabase.from('log_supervisor_acoes').insert(payload)
  }

  return { notificado: true, total: nomes.length }
}

async function alertarRetornosInssVencidosSupervisores(supabase: ReturnType<typeof createAdminClient>, hoje: string) {
  type VencidoRow = {
    funcionario_id: string
    funcionarios: { nome: string; status: string; posto_id: string | null } | null
  }
  const { data } = await supabase
    .from('afastamentos')
    .select('funcionario_id, funcionarios!inner(nome, status, posto_id)')
    .is('data_fim_real', null)
    .not('data_fim_prevista', 'is', null)
    .lte('data_fim_prevista', hoje)
    .eq('funcionarios.status', 'afastado')

  const vistos = new Set<string>()
  const vencidosUnicos: VencidoRow[] = []
  for (const v of ((data ?? []) as unknown as VencidoRow[])) {
    if (vistos.has(v.funcionario_id)) continue
    vistos.add(v.funcionario_id)
    vencidosUnicos.push(v)
  }

  if (vencidosUnicos.length === 0) return { supervisoresNotificados: 0 }

  const postoIds = Array.from(new Set(
    vencidosUnicos.map(v => v.funcionarios?.posto_id).filter((id): id is string => !!id),
  ))
  if (postoIds.length === 0) return { supervisoresNotificados: 0 }

  type CspRow = { posto_id: string; supervisor_id: string }
  const { data: cspData } = await supabase
    .from('config_supervisores_postos')
    .select('posto_id, supervisor_id')
    .in('posto_id', postoIds)
    .eq('ativo', true)

  const supervisoresPorPosto = new Map<string, string[]>()
  for (const c of ((cspData ?? []) as CspRow[])) {
    const lista = supervisoresPorPosto.get(c.posto_id) ?? []
    lista.push(c.supervisor_id)
    supervisoresPorPosto.set(c.posto_id, lista)
  }

  const nomesPorSupervisor = new Map<string, string[]>()
  for (const v of vencidosUnicos) {
    const postoId = v.funcionarios?.posto_id
    if (!postoId) continue
    for (const supervisorId of (supervisoresPorPosto.get(postoId) ?? [])) {
      const lista = nomesPorSupervisor.get(supervisorId) ?? []
      lista.push(v.funcionarios?.nome ?? '—')
      nomesPorSupervisor.set(supervisorId, lista)
    }
  }

  // `alertas_supervisor` é uma tabela nova (Task 1) que ainda não existe em
  // types/database.ts até alguém rodar a regeração de tipos do Supabase — usa `as any`
  // aqui pra não travar o build nesse meio-tempo, mesmo padrão já usado noutros pontos
  // deste arquivo/projeto pra tabelas recém-criadas.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabaseAny = supabase as any

  let supervisoresNotificados = 0
  for (const [supervisorId, nomes] of Array.from(nomesPorSupervisor.entries())) {
    const { data: existing } = await supabaseAny
      .from('alertas_supervisor')
      .select('id')
      .eq('supervisor_id', supervisorId)
      .eq('tipo', 'retorno_inss_vencido')
      .gte('created_at', `${hoje}T00:00:00`)
      .lte('created_at', `${hoje}T23:59:59`)
      .maybeSingle()

    const payload = {
      supervisor_id: supervisorId,
      tipo: 'retorno_inss_vencido',
      titulo: `${nomes.length} funcionário${nomes.length > 1 ? 's' : ''} com retorno INSS vencido`,
      detalhes: JSON.stringify({ nomes, total: nomes.length }),
      lido: false,
    }

    if (existing) {
      await supabaseAny.from('alertas_supervisor').update(payload).eq('id', existing.id)
    } else {
      await supabaseAny.from('alertas_supervisor').insert(payload)
    }
    supervisoresNotificados++
  }

  return { supervisoresNotificados }
}
```

- [ ] **Step 2: Chamar as duas funções no handler `GET` e incluir no JSON de resposta**

Localizar dentro de `export async function GET`:

```typescript
  const ferias      = await sincronizarStatusFerias(supabase, hoje)
  const alertaFerias = await alertarFeriasVencendo(supabase, hoje)
  const retornosAtestado = await processarRetornosAtestado()
  const coberturasEncerradas = await encerrarCoberturasVencidas()
```

Substituir por:

```typescript
  const ferias      = await sincronizarStatusFerias(supabase, hoje)
  const alertaFerias = await alertarFeriasVencendo(supabase, hoje)
  const alertaRetornoInss = await alertarRetornosInssVencidos(supabase, hoje)
  const alertaRetornoInssSupervisores = await alertarRetornosInssVencidosSupervisores(supabase, hoje)
  const retornosAtestado = await processarRetornosAtestado()
  const coberturasEncerradas = await encerrarCoberturasVencidas()
```

Localizar o `return NextResponse.json({ ok: true, ... })` no final do handler:

```typescript
  return NextResponse.json({ ok: true, data: hoje, ferias, alertaFerias, retornosAtestado, coberturasEncerradas, kpis: {
```

Substituir por:

```typescript
  return NextResponse.json({ ok: true, data: hoje, ferias, alertaFerias, alertaRetornoInss, alertaRetornoInssSupervisores, retornosAtestado, coberturasEncerradas, kpis: {
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: sem erros novos em `app/api/cron/snapshot-diario/route.ts`

- [ ] **Step 4: Commit**

```bash
git add "app/api/cron/snapshot-diario/route.ts"
git commit -m "feat(cron): gera alertas de retorno inss vencido (admin + supervisor)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Sino do admin — novo tipo de alerta

**Files:**
- Modify: `components/admin/notificacoes-bell.tsx`

- [ ] **Step 1: Adicionar ícone e label**

Localizar (linhas 1-33):

```typescript
'use client'

import { useState, useTransition } from 'react'
import { Bell, X, CheckCheck, AlertTriangle, FileText, UserMinus, Shield, Trash2, CalendarDays } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { marcarTodasLidas, excluirNotificacoesLidas, excluirNotificacaoIndividual } from '@/app/(admin)/notificacoes/actions'

export type LogAcao = {
  id: string
  created_at: string
  supervisor_nome: string
  tipo: string
  acao: string
  funcionario_nome: string | null
  detalhes: string | null
  lido: boolean
}

const TIPO_ICON: Record<string, React.ReactNode> = {
  atestado:       <FileText size={14} className="text-blue-500" />,
  falta:          <UserMinus size={14} className="text-amber-500" />,
  advertencia:    <Shield size={14} className="text-red-500" />,
  cobertura:      <AlertTriangle size={14} className="text-orange-500" />,
  alerta_ferias:  <CalendarDays size={14} className="text-orange-500" />,
  ferias_agendada:<CalendarDays size={14} className="text-indigo-500" />,
}

const TIPO_LABEL: Record<string, string> = {
  atestado:        'Atestado',
  falta:           'Falta',
  advertencia:     'Advertência',
  cobertura:       'Cobertura',
  alerta_ferias:   'Alerta de Férias',
  ferias_agendada: 'Férias',
}
```

Substituir por:

```typescript
'use client'

import { useState, useTransition } from 'react'
import { Bell, X, CheckCheck, AlertTriangle, FileText, UserMinus, Shield, Trash2, CalendarDays, Timer } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { marcarTodasLidas, excluirNotificacoesLidas, excluirNotificacaoIndividual } from '@/app/(admin)/notificacoes/actions'

export type LogAcao = {
  id: string
  created_at: string
  supervisor_nome: string
  tipo: string
  acao: string
  funcionario_nome: string | null
  detalhes: string | null
  lido: boolean
}

const TIPO_ICON: Record<string, React.ReactNode> = {
  atestado:       <FileText size={14} className="text-blue-500" />,
  falta:          <UserMinus size={14} className="text-amber-500" />,
  advertencia:    <Shield size={14} className="text-red-500" />,
  cobertura:      <AlertTriangle size={14} className="text-orange-500" />,
  alerta_ferias:  <CalendarDays size={14} className="text-orange-500" />,
  ferias_agendada:<CalendarDays size={14} className="text-indigo-500" />,
  alerta_retorno_inss: <Timer size={14} className="text-red-500" />,
}

const TIPO_LABEL: Record<string, string> = {
  atestado:        'Atestado',
  falta:           'Falta',
  advertencia:     'Advertência',
  cobertura:       'Cobertura',
  alerta_ferias:   'Alerta de Férias',
  ferias_agendada: 'Férias',
  alerta_retorno_inss: 'Retorno INSS Vencido',
}
```

- [ ] **Step 2: Adicionar o case em `renderConteudo`**

Localizar `renderConteudo` (por volta da linha 45-64):

```typescript
function renderConteudo(log: LogAcao): React.ReactNode | null {
  if (log.tipo === 'alerta_ferias') {
    let vencidos = 0
    let criticos = 0
    try {
      const d = JSON.parse(log.detalhes ?? '{}')
      vencidos = d.vencidos ?? 0
      criticos = d.criticos ?? 0
    } catch { /* ignore */ }
    return (
      <p className="text-xs text-gray-700 leading-snug">
        <span className="font-semibold text-orange-700">Alerta de Férias</span>
        {' — '}
        {vencidos > 0 && <span className="text-red-600 font-medium">{vencidos} vencido{vencidos !== 1 ? 's' : ''}</span>}
        {vencidos > 0 && criticos > 0 && ', '}
        {criticos > 0 && <span className="text-orange-500">{criticos} vence{criticos !== 1 ? 'm' : ''} em 30d</span>}
        {' '}
        <Link href="/ferias/saldo" className="text-blue-500 underline hover:text-blue-700 text-[10px]">ver saldo</Link>
      </p>
    )
  }
  return null
}
```

Substituir por:

```typescript
function renderConteudo(log: LogAcao): React.ReactNode | null {
  if (log.tipo === 'alerta_ferias') {
    let vencidos = 0
    let criticos = 0
    try {
      const d = JSON.parse(log.detalhes ?? '{}')
      vencidos = d.vencidos ?? 0
      criticos = d.criticos ?? 0
    } catch { /* ignore */ }
    return (
      <p className="text-xs text-gray-700 leading-snug">
        <span className="font-semibold text-orange-700">Alerta de Férias</span>
        {' — '}
        {vencidos > 0 && <span className="text-red-600 font-medium">{vencidos} vencido{vencidos !== 1 ? 's' : ''}</span>}
        {vencidos > 0 && criticos > 0 && ', '}
        {criticos > 0 && <span className="text-orange-500">{criticos} vence{criticos !== 1 ? 'm' : ''} em 30d</span>}
        {' '}
        <Link href="/ferias/saldo" className="text-blue-500 underline hover:text-blue-700 text-[10px]">ver saldo</Link>
      </p>
    )
  }
  if (log.tipo === 'alerta_retorno_inss') {
    let nomes: string[] = []
    try {
      const d = JSON.parse(log.detalhes ?? '{}')
      nomes = Array.isArray(d.nomes) ? d.nomes : []
    } catch { /* ignore */ }
    return (
      <p className="text-xs text-gray-700 leading-snug">
        <span className="font-semibold text-red-700">Retorno INSS Vencido</span>
        {' — '}
        <span className="text-red-600 font-medium">{nomes.length} funcionário{nomes.length !== 1 ? 's' : ''}</span>
        {nomes.length > 0 && <span className="text-gray-400"> ({nomes.slice(0, 3).join(', ')}{nomes.length > 3 ? '...' : ''})</span>}
        {' '}
        <Link href="/efetivo" className="text-blue-500 underline hover:text-blue-700 text-[10px]">ver efetivo</Link>
      </p>
    )
  }
  return null
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: sem erros novos em `components/admin/notificacoes-bell.tsx`

- [ ] **Step 4: Commit**

```bash
git add components/admin/notificacoes-bell.tsx
git commit -m "feat(notificacoes): sino do admin exibe alerta de retorno inss vencido

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Server Action pra marcar alertas do supervisor como lidos

**Files:**
- Modify: `app/(admin)/notificacoes/actions.ts`

- [ ] **Step 1: Adicionar a action**

Localizar o final do arquivo (a função `marcarSolicitacoesLidasSupervisor`):

```typescript
export async function marcarSolicitacoesLidasSupervisor() {
  const auth = await getUser()
  if (!auth || auth.perfil.role !== 'supervisor') return
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any
  await supabase
    .from('solicitacoes')
    .update({ lida_supervisor: true })
    .eq('supervisor_id', auth.perfil.id)
    .neq('status', 'pendente')
    .eq('lida_supervisor', false)
}
```

Adicionar logo depois:

```typescript

export async function marcarAlertasSupervisorLidos() {
  const auth = await getUser()
  if (!auth || auth.perfil.role !== 'supervisor') return
  // `alertas_supervisor` é tabela nova (Task 1), ainda não presente em types/database.ts
  // até alguém regerar os tipos do Supabase — `as any` aqui, mesmo padrão já usado em
  // `marcarSolicitacoesLidasSupervisor` logo acima nesta mesma função/arquivo.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any
  await supabase
    .from('alertas_supervisor')
    .update({ lido: true })
    .eq('supervisor_id', auth.perfil.id)
    .eq('lido', false)
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: sem erros novos em `app/(admin)/notificacoes/actions.ts`

- [ ] **Step 3: Commit**

```bash
git add "app/(admin)/notificacoes/actions.ts"
git commit -m "feat(notificacoes): action pra marcar alertas do supervisor como lidos

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Sino do supervisor — novo canal de alertas

**Files:**
- Modify: `components/admin/supervisor-bell.tsx`

- [ ] **Step 1: Adicionar o tipo `AlertaSupervisor` e o import da nova action**

Localizar (linhas 1-16):

```typescript
'use client'

import { useState, useTransition } from 'react'
import { Bell, X, CheckCheck, CheckCircle2, XCircle, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { marcarSolicitacoesLidasSupervisor } from '@/app/(admin)/notificacoes/actions'

export type SolicitacaoNotif = {
  id: string
  tipo: string
  status: string
  created_at: string | null
  observacao_admin: string | null
  lida_supervisor: boolean
  funcionario_nome: string | null
}
```

Substituir por:

```typescript
'use client'

import { useState, useTransition } from 'react'
import { Bell, X, CheckCheck, CheckCircle2, XCircle, Clock, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { marcarSolicitacoesLidasSupervisor, marcarAlertasSupervisorLidos } from '@/app/(admin)/notificacoes/actions'

export type SolicitacaoNotif = {
  id: string
  tipo: string
  status: string
  created_at: string | null
  observacao_admin: string | null
  lida_supervisor: boolean
  funcionario_nome: string | null
}

export type AlertaSupervisor = {
  id: string
  tipo: string
  titulo: string
  detalhes: string | null
  created_at: string
  lido: boolean
}

function renderAlerta(a: AlertaSupervisor): React.ReactNode {
  if (a.tipo === 'retorno_inss_vencido') {
    let nomes: string[] = []
    try {
      const d = JSON.parse(a.detalhes ?? '{}')
      nomes = Array.isArray(d.nomes) ? d.nomes : []
    } catch { /* ignore */ }
    return (
      <p className="text-xs text-gray-700 leading-snug">
        <span className="font-semibold text-red-700">{a.titulo}</span>
        {nomes.length > 0 && <span className="text-gray-400"> ({nomes.slice(0, 3).join(', ')}{nomes.length > 3 ? '...' : ''})</span>}
      </p>
    )
  }
  return <p className="text-xs text-gray-700 leading-snug font-semibold">{a.titulo}</p>
}
```

- [ ] **Step 2: Estender `Props` e o estado do componente**

Localizar (por volta da linha 41-50):

```typescript
interface Props {
  unread: number
  notifs: SolicitacaoNotif[]
}

export function SupervisorBell({ unread: initialUnread, notifs: initialNotifs }: Props) {
  const [open, setOpen]     = useState(false)
  const [unread, setUnread] = useState(initialUnread)
  const [notifs, setNotifs] = useState(initialNotifs)
  const [pending, startTransition] = useTransition()
```

Substituir por:

```typescript
interface Props {
  unread: number
  notifs: SolicitacaoNotif[]
  alertasUnread: number
  alertas: AlertaSupervisor[]
}

export function SupervisorBell({ unread: initialUnread, notifs: initialNotifs, alertasUnread: initialAlertasUnread, alertas: initialAlertas }: Props) {
  const [open, setOpen]     = useState(false)
  const [unread, setUnread] = useState(initialUnread)
  const [notifs, setNotifs] = useState(initialNotifs)
  const [alertasUnread, setAlertasUnread] = useState(initialAlertasUnread)
  const [alertas, setAlertas] = useState(initialAlertas)
  const [pending, startTransition] = useTransition()
  const totalUnread = unread + alertasUnread
```

- [ ] **Step 3: Atualizar `handleMarcarLidas` pra marcar os dois canais**

Localizar:

```typescript
  function handleMarcarLidas() {
    startTransition(async () => {
      await marcarSolicitacoesLidasSupervisor()
      setUnread(0)
      setNotifs(notifs.map(n => ({ ...n, lida_supervisor: true })))
    })
  }
```

Substituir por:

```typescript
  function handleMarcarLidas() {
    startTransition(async () => {
      await Promise.all([marcarSolicitacoesLidasSupervisor(), marcarAlertasSupervisorLidos()])
      setUnread(0)
      setAlertasUnread(0)
      setNotifs(notifs.map(n => ({ ...n, lida_supervisor: true })))
      setAlertas(alertas.map(a => ({ ...a, lido: true })))
    })
  }
```

- [ ] **Step 4: Usar `totalUnread` no botão do sino**

Localizar (por volta da linha 60-77):

```typescript
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={cn(
          'relative flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
          open ? 'bg-slate-100' : 'hover:bg-gray-100',
        )}
        title="Suas solicitações"
      >
        <Bell size={17} className={unread > 0 ? 'text-slate-700' : 'text-gray-400'} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white leading-none">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>
```

Substituir por:

```typescript
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={cn(
          'relative flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
          open ? 'bg-slate-100' : 'hover:bg-gray-100',
        )}
        title="Notificações"
      >
        <Bell size={17} className={totalUnread > 0 ? 'text-slate-700' : 'text-gray-400'} />
        {totalUnread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white leading-none">
            {totalUnread > 99 ? '99+' : totalUnread}
          </span>
        )}
      </button>
```

- [ ] **Step 5: Atualizar o header do painel e o botão "Lidas"**

Localizar (por volta da linha 83-103):

```typescript
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-gray-900">Suas solicitações</p>
                {unread > 0 && (
                  <p className="text-xs text-gray-400">{unread} nova{unread !== 1 ? 's' : ''}</p>
                )}
              </div>
              <div className="flex items-center gap-1">
                {unread > 0 && (
                  <button
                    type="button"
                    onClick={handleMarcarLidas}
                    disabled={pending}
                    title="Marcar todas como lidas"
                    className="flex items-center gap-1 rounded px-2 py-1 text-xs text-gray-400 hover:bg-gray-50 hover:text-gray-700 disabled:opacity-50"
                  >
                    <CheckCheck size={13} />
                    Lidas
                  </button>
                )}
```

Substituir por:

```typescript
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-gray-900">Notificações</p>
                {totalUnread > 0 && (
                  <p className="text-xs text-gray-400">{totalUnread} nova{totalUnread !== 1 ? 's' : ''}</p>
                )}
              </div>
              <div className="flex items-center gap-1">
                {totalUnread > 0 && (
                  <button
                    type="button"
                    onClick={handleMarcarLidas}
                    disabled={pending}
                    title="Marcar todas como lidas"
                    className="flex items-center gap-1 rounded px-2 py-1 text-xs text-gray-400 hover:bg-gray-50 hover:text-gray-700 disabled:opacity-50"
                  >
                    <CheckCheck size={13} />
                    Lidas
                  </button>
                )}
```

- [ ] **Step 6: Adicionar a seção de alertas na lista, antes da lista de solicitações**

Localizar (por volta da linha 114-118):

```typescript
            <div className="max-h-96 overflow-y-auto">
              {notifs.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-gray-400">Sem notificações recentes</p>
              ) : (
```

Substituir por:

```typescript
            <div className="max-h-96 overflow-y-auto">
              {alertas.length > 0 && (
                <div>
                  <p className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-gray-400">Alertas</p>
                  {alertas.map(a => (
                    <div
                      key={a.id}
                      className={cn(
                        'flex gap-3 px-4 py-3 border-b border-gray-50 last:border-0',
                        !a.lido && 'bg-red-50/60',
                      )}
                    >
                      <div className="mt-0.5 shrink-0">
                        <AlertTriangle size={14} className="text-red-500" />
                      </div>
                      <div className="min-w-0 flex-1">
                        {renderAlerta(a)}
                        <p className="mt-0.5 text-[10px] text-gray-400">{fmtRelativo(a.created_at)}</p>
                      </div>
                      {!a.lido && (
                        <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
                      )}
                    </div>
                  ))}
                  <p className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-gray-400">Solicitações</p>
                </div>
              )}
              {notifs.length === 0 ? (
                alertas.length === 0 && <p className="px-4 py-8 text-center text-sm text-gray-400">Sem notificações recentes</p>
              ) : (
```

- [ ] **Step 7: Type-check**

Run: `npx tsc --noEmit`
Expected: sem erros novos em `components/admin/supervisor-bell.tsx`

- [ ] **Step 8: Commit**

```bash
git add components/admin/supervisor-bell.tsx
git commit -m "feat(notificacoes): sino do supervisor ganha canal de alertas do sistema

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Layout busca os alertas do supervisor logado

**Files:**
- Modify: `app/(admin)/layout.tsx`

- [ ] **Step 1: Importar o tipo novo**

Localizar (linhas 9-11):

```typescript
import { SupervisorBell } from '@/components/admin/supervisor-bell'
import type { SolicitacaoNotif } from '@/components/admin/supervisor-bell'
```

Substituir por:

```typescript
import { SupervisorBell } from '@/components/admin/supervisor-bell'
import type { SolicitacaoNotif, AlertaSupervisor } from '@/components/admin/supervisor-bell'
```

- [ ] **Step 2: Adicionar a 5ª busca no `Promise.all`**

Localizar o início do array desestruturado (por volta da linha 45-49):

```typescript
  const [
    { count: pendingCount },
    alertCount,
    { unread: notifUnread, logs: notifLogs },
    { unread: supNotifUnread, notifs: supNotifs },
  ] = await Promise.all([
```

Substituir por:

```typescript
  const [
    { count: pendingCount },
    alertCount,
    { unread: notifUnread, logs: notifLogs },
    { unread: supNotifUnread, notifs: supNotifs },
    { unread: supAlertasUnread, alertas: supAlertas },
  ] = await Promise.all([
```

Localizar o final do array de promises (a última entrada é a IIFE de "Notificações de solicitações processadas (só para supervisor)", que termina assim):

```typescript
      return {
        unread: cnt ?? 0,
        notifs: ((solsData ?? []) as {
          id: string; tipo: string; status: string; created_at: string | null
          observacao_admin: string | null; lida_supervisor: boolean
          funcionarios: { nome: string | null } | null
        }[]).map(s => ({
          id: s.id, tipo: s.tipo, status: s.status, created_at: s.created_at,
          observacao_admin: s.observacao_admin, lida_supervisor: s.lida_supervisor,
          funcionario_nome: s.funcionarios?.nome ?? null,
        })),
      }
    })(),
  ])
```

Adicionar uma nova IIFE logo antes do `])` de fechamento:

```typescript
      return {
        unread: cnt ?? 0,
        notifs: ((solsData ?? []) as {
          id: string; tipo: string; status: string; created_at: string | null
          observacao_admin: string | null; lida_supervisor: boolean
          funcionarios: { nome: string | null } | null
        }[]).map(s => ({
          id: s.id, tipo: s.tipo, status: s.status, created_at: s.created_at,
          observacao_admin: s.observacao_admin, lida_supervisor: s.lida_supervisor,
          funcionario_nome: s.funcionarios?.nome ?? null,
        })),
      }
    })(),

    // Alertas do sistema direcionados ao supervisor (só para supervisor)
    (async () => {
      if (perfil.role !== 'supervisor') return { unread: 0, alertas: [] as AlertaSupervisor[] }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = createClient() as any
      const [{ count: cntAlertas }, { data: alertasData }] = await Promise.all([
        sb.from('alertas_supervisor')
          .select('*', { count: 'exact', head: true })
          .eq('supervisor_id', perfil.id)
          .eq('lido', false),
        sb.from('alertas_supervisor')
          .select('id, tipo, titulo, detalhes, created_at, lido')
          .eq('supervisor_id', perfil.id)
          .order('created_at', { ascending: false })
          .limit(30),
      ])
      return {
        unread: cntAlertas ?? 0,
        alertas: (alertasData ?? []) as AlertaSupervisor[],
      }
    })(),
  ])
```

- [ ] **Step 3: Passar os novos props pro `SupervisorBell`**

Localizar:

```typescript
            {perfil.role === 'supervisor' && (
              <SupervisorBell unread={supNotifUnread} notifs={supNotifs} />
            )}
```

Substituir por:

```typescript
            {perfil.role === 'supervisor' && (
              <SupervisorBell unread={supNotifUnread} notifs={supNotifs} alertasUnread={supAlertasUnread} alertas={supAlertas} />
            )}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: sem erros novos em `app/(admin)/layout.tsx`

- [ ] **Step 5: Commit**

```bash
git add "app/(admin)/layout.tsx"
git commit -m "feat(notificacoes): layout busca alertas_supervisor do usuario logado

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: Aviso nos cards de KPI (visual, sem card novo)

**Files:**
- Modify: `app/(admin)/dashboard/page.tsx`

- [ ] **Step 1: Card "Afastados" do admin**

Localizar (dentro do bloco "Row 1: KPI Cards principais" do dashboard admin, não do `SupervisorDashboard`):

```typescript
        <KpiCardPrincipal
          label="Afastados"
          valor={kpis.afastados}
          corBorda="border-t-amber-500"
          delta={deltaAfastados}
          sparklineData={sparkAfastados}
          sparkColor="#f59e0b"
          href="/efetivo?status=afastado"
        />
```

Substituir por:

```typescript
        <KpiCardPrincipal
          label="Afastados"
          valor={kpis.afastados}
          corBorda="border-t-amber-500"
          delta={deltaAfastados}
          aviso={alertas.retornosInssVencidos.length > 0 ? `${alertas.retornosInssVencidos.length} com retorno vencido` : undefined}
          sparklineData={sparkAfastados}
          sparkColor="#f59e0b"
          href="/efetivo?status=afastado"
        />
```

- [ ] **Step 2: Card "Ausentes" do supervisor**

Localizar, dentro de `SupervisorDashboard`:

```typescript
        <KpiCardPrincipal label="Ausentes"           valor={totalAusentes}    corBorda="border-t-amber-500" aviso={(() => {
          const partes: string[] = []
          if (kpis.atestados > 0) partes.push(`${kpis.atestados} atestado${kpis.atestados > 1 ? 's' : ''}`)
          if (kpis.afastados > 0) partes.push(`${kpis.afastados} INSS`)
          if (kpis.faltantes > 0) partes.push(`${kpis.faltantes} faltante${kpis.faltantes > 1 ? 's' : ''}`)
          return partes.length > 0 ? partes.join(', ') : undefined
        })()} />
```

Substituir por:

```typescript
        <KpiCardPrincipal label="Ausentes"           valor={totalAusentes}    corBorda="border-t-amber-500" aviso={(() => {
          const partes: string[] = []
          if (kpis.atestados > 0) partes.push(`${kpis.atestados} atestado${kpis.atestados > 1 ? 's' : ''}`)
          if (kpis.afastados > 0) partes.push(`${kpis.afastados} INSS`)
          if (kpis.faltantes > 0) partes.push(`${kpis.faltantes} faltante${kpis.faltantes > 1 ? 's' : ''}`)
          if (retornosInssVencidos.length > 0) partes.push(`${retornosInssVencidos.length} com retorno vencido`)
          return partes.length > 0 ? partes.join(', ') : undefined
        })()} />
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: sem erros novos em `app/(admin)/dashboard/page.tsx`

- [ ] **Step 4: Build completo (inclui lint)**

Run: `npm run build`
Expected: `✓ Compiled successfully`, sem erros de lint

- [ ] **Step 5: Commit**

```bash
git add "app/(admin)/dashboard/page.tsx"
git commit -m "feat(dashboard): aviso de retorno inss vencido nos cards de kpi

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 8: Verificação manual (checkpoint, sem commit)

**Files:** nenhum

- [ ] **Step 1:** Confirmar que a migration da Task 1 foi aplicada no Supabase antes de rodar essa verificação (senão as queries em `alertas_supervisor` falham silenciosamente/retornam vazio).
- [ ] **Step 2:** Rodar manualmente o endpoint do cron localmente (`curl` com o header `Authorization: Bearer $CRON_SECRET` contra `http://localhost:3000/api/cron/snapshot-diario`, com `npm run dev` rodando) e conferir no JSON de resposta que `alertaRetornoInss` e `alertaRetornoInssSupervisores` aparecem com valores condizentes (ex: `{ notificado: true, total: 2 }` e `{ supervisoresNotificados: 1 }` se houver dados de teste como Sonia/Emily).
- [ ] **Step 3:** Logar como admin, abrir o sino 🔔 no topo, confirmar que aparece "Retorno INSS Vencido" com os nomes.
- [ ] **Step 4:** Conferir o card "Afastados" no topo do dashboard admin — deve mostrar o aviso "N com retorno vencido" abaixo do número.
- [ ] **Step 5:** Logar como supervisor de um posto com funcionário vencido, confirmar que o sino dele mostra a seção "Alertas" com o item de retorno INSS, e que o card "Ausentes" do dashboard dele mostra o aviso.
- [ ] **Step 6:** Reportar o resultado ao usuário — sem commit nesta task.
