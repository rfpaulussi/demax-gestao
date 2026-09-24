# Devolutiva por ocorrência Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cada ocorrência ganha uma conversa entre RH e supervisor, com aviso no sino e por e-mail (sem o texto da mensagem), e encerramento com parecer obrigatório.

**Architecture:** Tabela nova `ocorrencia_comentarios` (só INSERT, sem edição). Regras puras (validar texto, montar destinatários, template de e-mail) ficam em `lib/ocorrencias/devolutiva.ts` com testes Vitest. As Server Actions em `app/(admin)/ocorrencias/actions.ts` checam o escopo do supervisor, gravam com o admin client e chamam `notificarDevolutiva`, que reusa `alertas_supervisor` (sino do supervisor), `log_supervisor_acoes` (sino do admin) e `lib/email.ts` (Resend). A UI é um componente novo de conversa dentro do modal do dossiê.

**Tech Stack:** Next.js 14 App Router, Server Actions, Supabase (RLS), TypeScript, Tailwind, Vitest, Resend.

**Referência:** spec em `docs/superpowers/specs/2026-09-24-devolutiva-ocorrencias-design.md`.

**Antes de começar:** executar numa branch nova (`git checkout -b feature/devolutiva-ocorrencias`). Não implementar direto no `master`.

**Convenções deste projeto que o plano segue:**
- `createClient()` é síncrono, nunca usar `await createClient()`.
- Tabelas novas ainda não estão em `types/database.ts`, então usa-se o cast `as unknown as AnyClient` já existente em `actions.ts`.
- Testes rodam com `npm test` (Vitest, arquivos `*.test.ts` ao lado do código).
- Cada task termina em commit com o trailer `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.

---

## Task 1: Migração SQL — `ocorrencia_comentarios` + RLS

**Files:**
- Create: `supabase/migrations/20260924_ocorrencia_comentarios.sql`

- [ ] **Step 1: Criar a migração**

```sql
-- ============================================================
-- Devolutiva por ocorrência: conversa RH <-> supervisor.
-- Mensagens não são editadas nem apagadas (registro de RH, auditável):
-- por isso só existem policies de SELECT e INSERT (mais admin_all).
-- ============================================================

CREATE TABLE ocorrencia_comentarios (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  ocorrencia_id uuid        NOT NULL REFERENCES ocorrencias(id) ON DELETE CASCADE,
  autor_id      uuid        NOT NULL REFERENCES perfis(id),
  texto         text        NOT NULL CHECK (length(btrim(texto)) > 0),
  tipo          text        NOT NULL DEFAULT 'mensagem' CHECK (tipo IN ('mensagem', 'parecer'))
);

CREATE INDEX idx_ocorrencia_comentarios_ocorrencia
  ON ocorrencia_comentarios(ocorrencia_id, created_at);

ALTER TABLE ocorrencia_comentarios ENABLE ROW LEVEL SECURITY;

-- admin/coordenador: acesso total
CREATE POLICY ocorrencia_comentarios_admin_all ON ocorrencia_comentarios
  FOR ALL TO authenticated
  USING (is_admin_or_coord())
  WITH CHECK (is_admin_or_coord());

-- supervisor: lê a conversa das ocorrências do seu posto
CREATE POLICY ocorrencia_comentarios_supervisor_select ON ocorrencia_comentarios
  FOR SELECT TO authenticated
  USING (
    is_supervisor()
    AND EXISTS (
      SELECT 1 FROM ocorrencias o
      WHERE o.id = ocorrencia_id
        AND o.tipo = 'ocorrencia'
        AND (
          o.posto_id IN (SELECT get_supervisor_posto_ids())
          OR o.funcionario_id IN (
            SELECT id FROM funcionarios
            WHERE posto_id IN (SELECT get_supervisor_posto_ids())
          )
        )
    )
  );

-- supervisor: escreve na conversa das ocorrências do seu posto, sempre como ele mesmo
CREATE POLICY ocorrencia_comentarios_supervisor_insert ON ocorrencia_comentarios
  FOR INSERT TO authenticated
  WITH CHECK (
    is_supervisor()
    AND autor_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM ocorrencias o
      WHERE o.id = ocorrencia_id
        AND o.tipo = 'ocorrencia'
        AND (
          o.posto_id IN (SELECT get_supervisor_posto_ids())
          OR o.funcionario_id IN (
            SELECT id FROM funcionarios
            WHERE posto_id IN (SELECT get_supervisor_posto_ids())
          )
        )
    )
  );

-- viewer: sem policy = sem acesso (a conversa é um canal privado RH <-> supervisor)
```

- [ ] **Step 2: Aplicar no Supabase**

O MCP do Supabase desta sessão aponta para outro projeto (`atlas-one`), não para o `demax-gestao` (`fwdhnipekbmeqozkpfyh`). Não tente aplicar por ele. Avise o usuário para rodar o SQL acima no Supabase Studio, em SQL Editor, e aguarde a confirmação antes da Task 8 (QA). O código das Tasks 2 a 7 compila sem a migração.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260924_ocorrencia_comentarios.sql
git commit -m "feat(ocorrencias): tabela ocorrencia_comentarios + RLS

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 2: Regras puras da devolutiva (TDD)

**Files:**
- Create: `lib/ocorrencias/devolutiva.test.ts`
- Create: `lib/ocorrencias/devolutiva.ts`

- [ ] **Step 1: Escrever os testes que falham**

```typescript
import { describe, it, expect } from 'vitest'
import {
  MAX_COMENTARIO,
  validarTexto,
  montarDestinatariosSupervisores,
  escapeHtml,
  assuntoDevolutiva,
  templateDevolutivaOcorrencia,
} from './devolutiva'

describe('validarTexto', () => {
  it('recusa texto vazio ou só com espaços', () => {
    expect(validarTexto('')).toEqual({ ok: false, error: 'Escreva uma mensagem' })
    expect(validarTexto('   \n  ')).toEqual({ ok: false, error: 'Escreva uma mensagem' })
  })

  it('devolve o texto sem espaços nas pontas', () => {
    expect(validarTexto('  oi  ')).toEqual({ ok: true, texto: 'oi' })
  })

  it('recusa texto acima do limite', () => {
    const r = validarTexto('a'.repeat(MAX_COMENTARIO + 1))
    expect(r.ok).toBe(false)
  })

  it('aceita texto exatamente no limite', () => {
    const r = validarTexto('a'.repeat(MAX_COMENTARIO))
    expect(r.ok).toBe(true)
  })
})

describe('montarDestinatariosSupervisores', () => {
  it('junta supervisores do posto e o da ocorrência sem repetir', () => {
    const r = montarDestinatariosSupervisores({
      supervisoresDoPosto: ['s1', 's2'],
      supervisorDaOcorrencia: 's2',
      autorId: 'rh',
    })
    expect(r.sort()).toEqual(['s1', 's2'])
  })

  it('inclui o supervisor da ocorrência mesmo fora da lista do posto', () => {
    const r = montarDestinatariosSupervisores({
      supervisoresDoPosto: ['s1'],
      supervisorDaOcorrencia: 's9',
      autorId: 'rh',
    })
    expect(r.sort()).toEqual(['s1', 's9'])
  })

  it('não avisa o próprio autor', () => {
    const r = montarDestinatariosSupervisores({
      supervisoresDoPosto: ['s1', 's2'],
      supervisorDaOcorrencia: null,
      autorId: 's1',
    })
    expect(r).toEqual(['s2'])
  })

  it('devolve lista vazia quando não há ninguém', () => {
    const r = montarDestinatariosSupervisores({
      supervisoresDoPosto: [],
      supervisorDaOcorrencia: null,
      autorId: 'rh',
    })
    expect(r).toEqual([])
  })
})

describe('escapeHtml', () => {
  it('escapa os caracteres perigosos', () => {
    expect(escapeHtml(`<a href="x">&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;')
  })
})

describe('assuntoDevolutiva', () => {
  it('cita o funcionário', () => {
    expect(assuntoDevolutiva('Maria')).toBe('Nova devolutiva no dossiê de Maria')
  })
})

describe('templateDevolutivaOcorrencia', () => {
  const base = { funcionarioNome: 'Maria Souza', funcionarioId: 'abc-123', parecer: false }

  it('leva o link direto pro dossiê do funcionário', () => {
    const html = templateDevolutivaOcorrencia(base)
    expect(html).toContain('https://demax-gestao.vercel.app/ocorrencias?f=abc-123')
  })

  it('avisa que o conteúdo não vai por e-mail (LGPD)', () => {
    const html = templateDevolutivaOcorrencia(base)
    expect(html).toContain('não é enviado por e-mail')
  })

  it('escapa o nome do funcionário', () => {
    const html = templateDevolutivaOcorrencia({ ...base, funcionarioNome: '<script>x</script>' })
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('muda a chamada quando é parecer de encerramento', () => {
    const msg = templateDevolutivaOcorrencia(base)
    const parecer = templateDevolutivaOcorrencia({ ...base, parecer: true })
    expect(msg).toContain('nova devolutiva')
    expect(parecer).toContain('encerrada com parecer')
    expect(parecer).not.toContain('nova devolutiva')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run lib/ocorrencias/devolutiva.test.ts`
Expected: FAIL (o módulo `./devolutiva` não existe).

- [ ] **Step 3: Implementar**

```typescript
// Regras puras da devolutiva por ocorrência (sem I/O, testadas em devolutiva.test.ts)

export const MAX_COMENTARIO = 4000

const URL_BASE = 'https://demax-gestao.vercel.app'

export function validarTexto(
  texto: string,
): { ok: true; texto: string } | { ok: false; error: string } {
  const t = texto.trim()
  if (!t) return { ok: false, error: 'Escreva uma mensagem' }
  if (t.length > MAX_COMENTARIO) {
    return { ok: false, error: `Mensagem muito longa (máximo ${MAX_COMENTARIO} caracteres)` }
  }
  return { ok: true, texto: t }
}

// Supervisores do posto + o supervisor da ocorrência, sem repetir e sem o autor.
export function montarDestinatariosSupervisores(p: {
  supervisoresDoPosto: string[]
  supervisorDaOcorrencia: string | null
  autorId: string
}): string[] {
  const ids = new Set(p.supervisoresDoPosto)
  if (p.supervisorDaOcorrencia) ids.add(p.supervisorDaOcorrencia)
  ids.delete(p.autorId)
  return Array.from(ids)
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function assuntoDevolutiva(funcionarioNome: string): string {
  return `Nova devolutiva no dossiê de ${funcionarioNome}`
}

// LGPD: o e-mail NUNCA leva o texto da mensagem (pode ter dado de saúde ou de vida pessoal).
// Por isso este template nem recebe o texto como parâmetro.
export function templateDevolutivaOcorrencia(d: {
  funcionarioNome: string
  funcionarioId: string
  parecer: boolean
}): string {
  const nome = escapeHtml(d.funcionarioNome)
  const chamada = d.parecer
    ? `Uma ocorrência foi encerrada com parecer no dossiê de <strong>${nome}</strong>.`
    : `Há uma nova devolutiva no dossiê de <strong>${nome}</strong>.`
  const link = `${URL_BASE}/ocorrencias?f=${encodeURIComponent(d.funcionarioId)}`

  return `<!DOCTYPE html>
<html lang="pt-BR">
<body style="margin:0;padding:16px;background:#f1f5f9;font-family:Arial,sans-serif">
<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08)">
  <div style="background:#1e293b;padding:20px 24px">
    <p style="margin:0;font-size:18px;font-weight:700;color:#fff">Demax Gestão</p>
    <p style="margin:4px 0 0;font-size:12px;color:#94a3b8">Devolutiva em ocorrência</p>
  </div>
  <div style="padding:24px">
    <p style="margin:0 0 12px;font-size:14px;color:#374151">${chamada}</p>
    <p style="margin:0;font-size:12px;color:#6b7280">
      Por segurança, o conteúdo da mensagem não é enviado por e-mail. Acesse o sistema para ler.
    </p>
    <div style="margin-top:24px;text-align:center">
      <a href="${link}"
        style="display:inline-block;background:#1e293b;color:#fff;padding:11px 24px;border-radius:7px;text-decoration:none;font-size:14px;font-weight:600">
        Acessar o sistema →
      </a>
    </div>
  </div>
</div>
</body></html>`
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run lib/ocorrencias/devolutiva.test.ts`
Expected: PASS, 14 testes.

- [ ] **Step 5: Commit**

```bash
git add lib/ocorrencias/devolutiva.ts lib/ocorrencias/devolutiva.test.ts
git commit -m "feat(ocorrencias): regras puras da devolutiva (validação, destinatários, e-mail sem conteúdo)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: Infra de aviso (tipos do log, e-mail por perfil, notificador)

**Files:**
- Modify: `lib/log-supervisor.ts`
- Modify: `lib/email.ts`
- Create: `lib/ocorrencias/notificar-devolutiva.ts`

- [ ] **Step 1: Ampliar os tipos de `lib/log-supervisor.ts`**

Trocar:

```typescript
export type TipoModulo = 'atestado' | 'advertencia' | 'falta' | 'cobertura'
export type TipoOp     = 'criou' | 'editou' | 'excluiu'
```

por:

```typescript
export type TipoModulo = 'atestado' | 'advertencia' | 'falta' | 'cobertura' | 'ocorrencia'
export type TipoOp     = 'criou' | 'editou' | 'excluiu' | 'respondeu'
```

- [ ] **Step 2: Adicionar `buscarEmailsPorPerfil` em `lib/email.ts`**

Inserir logo depois da função `buscarEmailsAdmins` (antes de `export async function enviarEmail`):

```typescript
// Busca o e-mail (Supabase Auth) de cada perfil informado
export async function buscarEmailsPorPerfil(ids: string[]): Promise<string[]> {
  if (ids.length === 0) return []
  try {
    const admin = createAdminClient()
    const resultados = await Promise.all(ids.map((id) => admin.auth.admin.getUserById(id)))
    return resultados
      .map((r) => r.data.user?.email)
      .filter((e): e is string => Boolean(e))
  } catch (e) {
    console.error('[email] buscarEmailsPorPerfil:', e)
    return []
  }
}
```

- [ ] **Step 3: Criar `lib/ocorrencias/notificar-devolutiva.ts`**

```typescript
import { createAdminClient } from '@/lib/supabase/admin'
import { logSupervisorAcao } from '@/lib/log-supervisor'
import { enviarEmail, buscarEmailsAdmins, buscarEmailsPorPerfil } from '@/lib/email'
import {
  assuntoDevolutiva,
  montarDestinatariosSupervisores,
  templateDevolutivaOcorrencia,
} from './devolutiva'

export type NotificarDevolutivaParams = {
  funcionarioId: string
  funcionarioNome: string
  postoId: string | null
  supervisorDaOcorrencia: string | null
  autorId: string
  autorRole: string
  parecer: boolean
}

// Avisa a outra parte da conversa (sino + e-mail sem o texto da mensagem).
// Nunca lança: a mensagem já foi gravada, falha de aviso não pode desfazer nem quebrar a ação.
export async function notificarDevolutiva(p: NotificarDevolutivaParams): Promise<void> {
  try {
    const subject = assuntoDevolutiva(p.funcionarioNome)
    const html = templateDevolutivaOcorrencia({
      funcionarioNome: p.funcionarioNome,
      funcionarioId: p.funcionarioId,
      parecer: p.parecer,
    })

    // Supervisor respondeu -> sino do admin (log_supervisor_acoes) + e-mail pros admins
    if (p.autorRole === 'supervisor') {
      await logSupervisorAcao({
        supervisorId: p.autorId,
        tipo: 'ocorrencia',
        acao: 'respondeu',
        funcionarioNome: p.funcionarioNome,
        detalhes: JSON.stringify({ funcionario_id: p.funcionarioId }),
      })
      await enviarEmail({ to: await buscarEmailsAdmins(), subject, html })
      return
    }

    // RH respondeu -> sino do supervisor (alertas_supervisor) + e-mail pra ele
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = createAdminClient() as any

    let supervisoresDoPosto: string[] = []
    if (p.postoId) {
      const { data: cfg } = await admin
        .from('config_supervisores_postos')
        .select('supervisor_id')
        .eq('posto_id', p.postoId)
        .eq('ativo', true)
      supervisoresDoPosto = ((cfg ?? []) as { supervisor_id: string }[]).map(r => r.supervisor_id)
    }

    const destinatarios = montarDestinatariosSupervisores({
      supervisoresDoPosto,
      supervisorDaOcorrencia: p.supervisorDaOcorrencia,
      autorId: p.autorId,
    })
    if (destinatarios.length === 0) return

    await admin.from('alertas_supervisor').insert(
      destinatarios.map(supervisor_id => ({
        supervisor_id,
        tipo: 'ocorrencia_devolutiva',
        titulo: p.parecer ? 'Ocorrência encerrada com parecer' : 'Nova devolutiva em ocorrência',
        detalhes: JSON.stringify({
          funcionario_id: p.funcionarioId,
          funcionario_nome: p.funcionarioNome,
        }),
      })),
    )

    await enviarEmail({ to: await buscarEmailsPorPerfil(destinatarios), subject, html })
  } catch (err) {
    console.error('[devolutiva] falha ao notificar:', err)
  }
}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 5: Commit**

```bash
git add lib/log-supervisor.ts lib/email.ts lib/ocorrencias/notificar-devolutiva.ts
git commit -m "feat(ocorrencias): notificador de devolutiva (sino + e-mail sem conteúdo)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: Server Actions da conversa e parecer ao encerrar

**Files:**
- Modify: `app/(admin)/ocorrencias/actions.ts`

- [ ] **Step 1: Imports**

Logo depois de `import { fetchAllRows } from '@/lib/supabase/fetch-all'`, adicionar:

```typescript
import { validarTexto } from '@/lib/ocorrencias/devolutiva'
import { notificarDevolutiva } from '@/lib/ocorrencias/notificar-devolutiva'
import type { AuthUser } from '@/lib/auth/get-user'
```

- [ ] **Step 2: Contagem de mensagens na timeline**

No tipo `TimelineItem`, adicionar o campo opcional:

```typescript
export type TimelineItem = {
  id: string
  tipo: TimelineTipo
  data: string
  titulo: string
  detalhe: string
  gravidade?: 'baixa' | 'media' | 'alta' | 'critica' | null
  status?: string | null
  comentarios?: number
}
```

Em `getDossieFuncionario`, logo depois da linha `const ocorrencias = (ocorrenciasRaw ?? []) as RawOcorrenciaDossie[]`, adicionar:

```typescript
  // contagem de mensagens por ocorrência (viewer não vê a conversa, então não recebe contagem)
  const contagemComentarios = new Map<string, number>()
  if (ocorrencias.length > 0 && auth.perfil.role !== 'viewer') {
    const { data: cs } = await (createAdminClient() as unknown as AnyClient)
      .from('ocorrencia_comentarios')
      .select('ocorrencia_id')
      .in('ocorrencia_id', ocorrencias.map(o => o.id))
    for (const c of (cs ?? []) as { ocorrencia_id: string }[]) {
      contagemComentarios.set(c.ocorrencia_id, (contagemComentarios.get(c.ocorrencia_id) ?? 0) + 1)
    }
  }
```

E no `timeline.push` das ocorrências, acrescentar `comentarios` ao objeto:

```typescript
  for (const o of ocorrencias) {
    timeline.push({
      id: `ocorrencia-${o.id}`,
      tipo: 'ocorrencia',
      data: o.data_ocorrencia ?? '',
      titulo: o.titulo ?? 'Ocorrência',
      detalhe: o.descricao ?? '—',
      gravidade: (o.gravidade ?? 'baixa') as TimelineItem['gravidade'],
      status: o.status ?? 'aberta',
      comentarios: contagemComentarios.get(o.id) ?? 0,
    })
  }
```

- [ ] **Step 3: Helper de acesso + `getComentarios` + `comentarOcorrencia`**

Inserir logo antes de `export async function createOcorrencia`:

```typescript
// ─── devolutiva (conversa RH <-> supervisor) ──────────────────────────────────

type OcorrenciaDevolutiva = {
  id: string
  posto_id: string | null
  supervisor_id: string | null
  funcionario_id: string
  funcionario_nome: string
}

// Carrega a ocorrência com o admin client e barra supervisor fora do posto dele.
// Devolve null se não existe, não é do tipo 'ocorrencia', não tem funcionário ou o usuário não tem acesso.
async function carregarOcorrenciaDevolutiva(
  ocorrenciaId: string,
  auth: AuthUser,
): Promise<OcorrenciaDevolutiva | null> {
  const { data } = await (createAdminClient() as unknown as AnyClient)
    .from('ocorrencias')
    .select('id, tipo, posto_id, supervisor_id, funcionario_id, funcionarios!funcionario_id(nome)')
    .eq('id', ocorrenciaId)
    .single()
  if (!data || data.tipo !== 'ocorrencia' || !data.funcionario_id) return null

  if (auth.perfil.role === 'supervisor') {
    const postoIds = await getPostoIdsSupervisor(createClient(), auth.user.id)
    if (!data.posto_id || !postoIds.includes(data.posto_id)) return null
  }

  const func = Array.isArray(data.funcionarios) ? data.funcionarios[0] : data.funcionarios
  return {
    id: data.id,
    posto_id: data.posto_id,
    supervisor_id: data.supervisor_id,
    funcionario_id: data.funcionario_id,
    funcionario_nome: func?.nome ?? 'funcionário',
  }
}

export type ComentarioRow = {
  id: string
  texto: string
  tipo: 'mensagem' | 'parecer'
  created_at: string
  autor_nome: string
  autor_role: string
}

type RawComentario = {
  id: string
  texto: string
  tipo: 'mensagem' | 'parecer'
  created_at: string
  perfis: { nome: string | null; role: string | null } | { nome: string | null; role: string | null }[] | null
}

export async function getComentarios(ocorrenciaId: string): Promise<ComentarioRow[]> {
  const auth = await getUser()
  if (!auth || auth.perfil.role === 'viewer') return []

  const oc = await carregarOcorrenciaDevolutiva(ocorrenciaId, auth)
  if (!oc) return []

  // admin client: o RLS de perfis não deixa o supervisor ler o nome do autor do RH.
  // O escopo do supervisor já foi checado em carregarOcorrenciaDevolutiva.
  const { data } = await (createAdminClient() as unknown as AnyClient)
    .from('ocorrencia_comentarios')
    .select('id, texto, tipo, created_at, perfis!autor_id(nome, role)')
    .eq('ocorrencia_id', ocorrenciaId)
    .order('created_at', { ascending: true })

  return ((data ?? []) as RawComentario[]).map(c => {
    const perfil = Array.isArray(c.perfis) ? c.perfis[0] : c.perfis
    return {
      id: c.id,
      texto: c.texto,
      tipo: c.tipo,
      created_at: c.created_at,
      autor_nome: perfil?.nome ?? 'Usuário',
      autor_role: perfil?.role ?? '',
    }
  })
}

export async function comentarOcorrencia(ocorrenciaId: string, texto: string): Promise<ActionResult> {
  const auth = await getUser()
  if (!auth || auth.perfil.role === 'viewer') return { success: false, error: 'Sem permissão' }

  const validado = validarTexto(texto)
  if (!validado.ok) return { success: false, error: validado.error }

  const oc = await carregarOcorrenciaDevolutiva(ocorrenciaId, auth)
  if (!oc) return { success: false, error: 'Sem permissão' }

  const { error } = await (createAdminClient() as unknown as AnyClient)
    .from('ocorrencia_comentarios')
    .insert({
      ocorrencia_id: ocorrenciaId,
      autor_id: auth.user.id,
      texto: validado.texto,
      tipo: 'mensagem',
    })
  if (error) return { success: false, error: error.message }

  await notificarDevolutiva({
    funcionarioId: oc.funcionario_id,
    funcionarioNome: oc.funcionario_nome,
    postoId: oc.posto_id,
    supervisorDaOcorrencia: oc.supervisor_id,
    autorId: auth.user.id,
    autorRole: auth.perfil.role ?? '',
    parecer: false,
  })

  revalidatePath('/ocorrencias')
  return { success: true }
}
```

- [ ] **Step 4: Trocar `updateStatusOcorrencia` (agora exige parecer ao encerrar)**

Substituir a função inteira por:

```typescript
export async function updateStatusOcorrencia(formData: FormData): Promise<ActionResult> {
  const auth = await getUser()
  if (!auth || auth.perfil.role === 'viewer') return { success: false, error: 'Sem permissão' }

  const id         = formData.get('id') as string
  const status     = formData.get('status') as string
  const parecerRaw = (formData.get('parecer') as string | null) ?? ''

  // Encerrar exige parecer. Ele vira uma mensagem (tipo 'parecer') na conversa.
  let parecer: string | null = null
  if (status === 'encerrada') {
    const validado = validarTexto(parecerRaw)
    if (!validado.ok) return { success: false, error: 'Escreva o parecer para encerrar a ocorrência' }
    parecer = validado.texto
  }

  const oc = await carregarOcorrenciaDevolutiva(id, auth)
  if (!oc) return { success: false, error: 'Sem permissão' }

  const adminSupabase = createAdminClient() as unknown as AnyClient

  // Parecer primeiro: se a gravação falhar o status não muda e o usuário pode tentar de novo.
  if (parecer) {
    const { error: erroParecer } = await adminSupabase.from('ocorrencia_comentarios').insert({
      ocorrencia_id: id,
      autor_id: auth.user.id,
      texto: parecer,
      tipo: 'parecer',
    })
    if (erroParecer) return { success: false, error: erroParecer.message }
  }

  const { error } = await adminSupabase
    .from('ocorrencias')
    .update({ status, atualizado_por: auth.user.id, atualizado_em: new Date().toISOString() })
    .eq('id', id)
  if (error) return { success: false, error: error.message }

  if (parecer) {
    await notificarDevolutiva({
      funcionarioId: oc.funcionario_id,
      funcionarioNome: oc.funcionario_nome,
      postoId: oc.posto_id,
      supervisorDaOcorrencia: oc.supervisor_id,
      autorId: auth.user.id,
      autorRole: auth.perfil.role ?? '',
      parecer: true,
    })
  }

  revalidatePath('/ocorrencias')
  return { success: true }
}
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: sem erros em `actions.ts`. Erros em `modal-dossie.tsx` sobre `handleStatusUpdate` NÃO devem aparecer (a assinatura do FormData não mudou de forma que quebre o chamador atual).

- [ ] **Step 6: Commit**

```bash
git add "app/(admin)/ocorrencias/actions.ts"
git commit -m "feat(ocorrencias): actions da conversa e parecer obrigatório ao encerrar

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 5: Componente `conversa-ocorrencia.tsx`

**Files:**
- Create: `components/ocorrencias/conversa-ocorrencia.tsx`

- [ ] **Step 1: Criar o componente**

```tsx
'use client'

import { useEffect, useState, useTransition } from 'react'
import { ROLE_LABELS } from '@/types'
import type { Role } from '@/types'
import type { ComentarioRow } from '@/app/(admin)/ocorrencias/actions'
import { getComentarios, comentarOcorrencia } from '@/app/(admin)/ocorrencias/actions'
import { MAX_COMENTARIO } from '@/lib/ocorrencias/devolutiva'

function fmtDataHora(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

export function ConversaOcorrencia({
  ocorrenciaId,
  onEnviado,
}: {
  ocorrenciaId: string
  onEnviado: () => void
}) {
  const [comentarios, setComentarios] = useState<ComentarioRow[] | null>(null)
  const [texto, setTexto]             = useState('')
  const [erro, setErro]               = useState<string | null>(null)
  const [isPending, startTransition]  = useTransition()

  async function carregar() {
    setComentarios(await getComentarios(ocorrenciaId))
  }

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ocorrenciaId])

  function handleEnviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErro(null)
    startTransition(async () => {
      const result = await comentarOcorrencia(ocorrenciaId, texto)
      if (result.success) {
        setTexto('')
        await carregar()
        onEnviado()
      } else {
        setErro(result.error)
      }
    })
  }

  return (
    <div className="space-y-3">
      {comentarios === null ? (
        <p className="text-xs text-gray-400">Carregando conversa…</p>
      ) : comentarios.length === 0 ? (
        <p className="text-xs text-gray-400">Nenhuma mensagem ainda.</p>
      ) : (
        <div className="space-y-2">
          {comentarios.map(c => (
            <div
              key={c.id}
              className={`rounded-lg px-3 py-2 ${c.tipo === 'parecer' ? 'bg-green-50 ring-1 ring-green-200' : 'bg-gray-50'}`}
            >
              <p className="text-xs">
                <span className="font-semibold text-gray-900">{c.autor_nome}</span>
                {c.autor_role && (
                  <span className="text-gray-400"> · {ROLE_LABELS[c.autor_role as Role] ?? c.autor_role}</span>
                )}
                <span className="text-gray-400"> · {fmtDataHora(c.created_at)}</span>
                {c.tipo === 'parecer' && (
                  <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">
                    Parecer
                  </span>
                )}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">{c.texto}</p>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleEnviar} className="space-y-2">
        <textarea
          value={texto}
          onChange={e => setTexto(e.target.value)}
          rows={2}
          maxLength={MAX_COMENTARIO}
          placeholder="Escreva uma resposta…"
          className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400"
        />
        {erro && <p className="text-xs text-red-500">{erro}</p>}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isPending || !texto.trim()}
            className="h-8 rounded-lg bg-slate-900 px-3 text-xs font-semibold uppercase tracking-widest text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {isPending ? 'Enviando…' : 'Enviar'}
          </button>
        </div>
      </form>
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: sem erros em `conversa-ocorrencia.tsx`.

- [ ] **Step 3: Commit**

```bash
git add components/ocorrencias/conversa-ocorrencia.tsx
git commit -m "feat(ocorrencias): componente da conversa por ocorrência

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 6: `modal-dossie.tsx` com conversa e parecer ao encerrar

**Files:**
- Modify: `components/ocorrencias/modal-dossie.tsx` (substituir o arquivo inteiro)

Mudanças em relação ao arquivo atual: import de `ConversaOcorrencia`; estados `conversasAbertas`, `encerrandoId`, `parecer`; `carregar(silencioso)` pra atualizar a contagem sem piscar a tela; botão "Conversa (N)" por ocorrência (só para quem escreve); "Encerrar" abre o campo de parecer obrigatório; estado "dossiê indisponível" (necessário pro link do sino quando o supervisor não tem acesso àquele funcionário).

- [ ] **Step 1: Substituir todo o conteúdo do arquivo**

```tsx
'use client'

import { useEffect, useState, useTransition } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import type { DossieFuncionario, SupervisorSimples, TimelineTipo } from '@/app/(admin)/ocorrencias/actions'
import { getDossieFuncionario, updateStatusOcorrencia } from '@/app/(admin)/ocorrencias/actions'
import { ModalNovaOcorrencia } from './modal-nova-ocorrencia'
import { ConversaOcorrencia } from './conversa-ocorrencia'
import { downloadDossiePDF } from './dossie-pdf'

function maskCPF(cpf: string | null): string {
  if (!cpf) return '—'
  return '***.***.***-**'
}

const TIPO_LABEL: Record<TimelineTipo, string> = {
  advertencia: 'Advertência',
  atestado:    'Atestado',
  falta:       'Falta',
  ocorrencia:  'Ocorrência',
}

const TIPO_COLOR: Record<TimelineTipo, string> = {
  advertencia: 'bg-orange-100 text-orange-700',
  atestado:    'bg-blue-100 text-blue-700',
  falta:       'bg-red-100 text-red-700',
  ocorrencia:  'bg-purple-100 text-purple-700',
}

const GRAVIDADE_CHIP: Record<string, string> = {
  baixa:   'bg-gray-100 text-gray-600',
  media:   'bg-amber-100 text-amber-700',
  alta:    'bg-orange-100 text-orange-700',
  critica: 'bg-red-100 text-red-700 font-bold',
}

const STATUS_LABEL: Record<string, string> = {
  aberta: 'Aberta', em_analise: 'Em Análise', encerrada: 'Encerrada', resolvido: 'Resolvido',
}

function CounterCard({ label, value, topColor }: { label: string; value: number | string; topColor: string }) {
  return (
    <div className={`rounded-xl border border-gray-100 border-t-4 bg-white p-3 shadow-sm ${topColor}`}>
      <p className="text-2xl font-black tracking-tight text-gray-900">{value}</p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-gray-400">{label}</p>
    </div>
  )
}

export function ModalDossie({
  funcionarioId,
  supervisores,
  canWrite,
  onClose,
}: {
  funcionarioId: string
  supervisores: SupervisorSimples[]
  canWrite: boolean
  onClose: () => void
}) {
  const [dossie, setDossie]         = useState<DossieFuncionario | null>(null)
  const [loading, setLoading]       = useState(true)
  const [filtroTipo, setFiltroTipo] = useState<TimelineTipo | ''>('')
  const [novaOpen, setNovaOpen]     = useState(false)
  const [loadingPdf, setLoadingPdf] = useState(false)
  const [conversasAbertas, setConversasAbertas] = useState<Set<string>>(new Set())
  const [encerrandoId, setEncerrandoId]         = useState<string | null>(null)
  const [parecer, setParecer]                   = useState('')
  const [isPending, startTransition] = useTransition()

  // silencioso = atualiza os dados sem trocar a tela por "Carregando" (usado ao enviar mensagem)
  async function carregar(silencioso = false) {
    if (!silencioso) setLoading(true)
    const data = await getDossieFuncionario(funcionarioId)
    setDossie(data)
    setLoading(false)
  }

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [funcionarioId])

  function toggleConversa(id: string) {
    setConversasAbertas(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleStatusUpdate(idComPrefixo: string, novoStatus: 'em_analise' | 'encerrada', parecerTexto?: string) {
    const id = idComPrefixo.replace('ocorrencia-', '')
    const fd = new FormData()
    fd.set('id', id)
    fd.set('status', novoStatus)
    if (parecerTexto) fd.set('parecer', parecerTexto)
    startTransition(async () => {
      const result = await updateStatusOcorrencia(fd)
      if (result.success) {
        setEncerrandoId(null)
        setParecer('')
        carregar()
      } else {
        alert(result.error)
      }
    })
  }

  async function handleBaixarPdf() {
    if (!dossie) return
    setLoadingPdf(true)
    try {
      await downloadDossiePDF(dossie)
    } finally {
      setLoadingPdf(false)
    }
  }

  const timelineFiltrada = dossie
    ? (filtroTipo ? dossie.timeline.filter(t => t.tipo === filtroTipo) : dossie.timeline)
    : []

  return (
    <Dialog.Root open onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/50" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-full max-w-3xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
          {loading ? (
            <p className="py-12 text-center text-sm text-gray-400">Carregando dossiê…</p>
          ) : !dossie ? (
            <div className="py-12 text-center">
              <p className="text-sm text-gray-500">Dossiê indisponível para este funcionário.</p>
              <button
                onClick={onClose}
                className="mt-4 h-8 rounded-lg border border-gray-200 px-4 text-xs font-semibold uppercase tracking-widest text-gray-500 hover:bg-gray-50"
              >
                Fechar
              </button>
            </div>
          ) : (
            <>
              <div className="mb-5 flex items-start justify-between">
                <div>
                  <Dialog.Title className="text-lg font-bold text-gray-900">{dossie.funcionario.nome}</Dialog.Title>
                  <p className="text-sm text-gray-400">
                    {dossie.funcionario.posto_nome} — {dossie.funcionario.secretaria || '—'}
                    {dossie.funcionario.registro && ` · RE ${dossie.funcionario.registro}`}
                    {' · CPF '}{maskCPF(dossie.funcionario.cpf)}
                  </p>
                </div>
                <button onClick={onClose} className="text-lg leading-none text-gray-400 hover:text-gray-600">✕</button>
              </div>

              <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <CounterCard label="Advertências"    value={dossie.kpis.advertencias}       topColor="border-t-orange-500" />
                <CounterCard label="Dias Atestado (12m)" value={dossie.kpis.diasAtestado12m} topColor="border-t-blue-500"   />
                <CounterCard label="Faltas"           value={dossie.kpis.faltas}             topColor="border-t-red-500"    />
                <CounterCard label="Ocorrências Abertas" value={dossie.kpis.ocorrenciasAbertas} topColor="border-t-purple-500" />
              </div>

              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setFiltroTipo('')}
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${filtroTipo === '' ? 'bg-slate-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                  >
                    Todos
                  </button>
                  {(Object.keys(TIPO_LABEL) as TimelineTipo[]).map(tipo => (
                    <button
                      key={tipo}
                      onClick={() => setFiltroTipo(tipo)}
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${filtroTipo === tipo ? 'bg-slate-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                    >
                      {TIPO_LABEL[tipo]}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button
                    disabled={loadingPdf}
                    onClick={handleBaixarPdf}
                    className="h-8 rounded-lg bg-amber-500 px-3 text-xs font-semibold uppercase tracking-widest text-slate-900 hover:bg-amber-400 disabled:opacity-50"
                  >
                    {loadingPdf ? 'Gerando…' : 'Baixar PDF'}
                  </button>
                  {canWrite && (
                    <button
                      onClick={() => setNovaOpen(true)}
                      className="h-8 rounded-lg bg-slate-900 px-3 text-xs font-semibold uppercase tracking-widest text-white hover:bg-slate-700"
                    >
                      Nova Ocorrência
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                {timelineFiltrada.length === 0 ? (
                  <p className="py-8 text-center text-sm text-gray-400">Nenhum registro encontrado.</p>
                ) : (
                  timelineFiltrada.map(item => {
                    const ehOcorrencia   = item.tipo === 'ocorrencia'
                    const conversaAberta = conversasAbertas.has(item.id)
                    return (
                      <div key={item.id} className="rounded-lg border border-gray-100">
                        <div className="flex items-start justify-between gap-3 px-4 py-3">
                          <div className="flex items-start gap-3">
                            <span className={`mt-0.5 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${TIPO_COLOR[item.tipo]}`}>
                              {TIPO_LABEL[item.tipo]}
                            </span>
                            <div>
                              <p className="text-sm font-medium text-gray-900">{item.titulo}</p>
                              <p className="text-xs text-gray-500">{item.detalhe}</p>
                            </div>
                          </div>
                          <div className="flex flex-shrink-0 flex-col items-end gap-1.5">
                            <span className="text-xs text-gray-400">
                              {item.data ? new Date(item.data + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}
                            </span>
                            {ehOcorrencia && item.gravidade && (
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${GRAVIDADE_CHIP[item.gravidade] ?? ''}`}>
                                {item.gravidade}
                              </span>
                            )}
                            {ehOcorrencia && item.status && (
                              <span className="text-xs font-medium text-gray-500">{STATUS_LABEL[item.status] ?? item.status}</span>
                            )}
                            {canWrite && ehOcorrencia && item.status === 'aberta' && (
                              <button
                                disabled={isPending}
                                onClick={() => handleStatusUpdate(item.id, 'em_analise')}
                                className="rounded-lg bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700 hover:bg-amber-200 disabled:opacity-50"
                              >
                                Em Análise
                              </button>
                            )}
                            {canWrite && ehOcorrencia && item.status === 'em_analise' && (
                              <button
                                disabled={isPending}
                                onClick={() => { setEncerrandoId(item.id); setParecer('') }}
                                className="rounded-lg bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700 hover:bg-green-200 disabled:opacity-50"
                              >
                                Encerrar
                              </button>
                            )}
                          </div>
                        </div>

                        {canWrite && ehOcorrencia && (
                          <div className="border-t border-gray-50 px-4 py-2">
                            <button
                              type="button"
                              onClick={() => toggleConversa(item.id)}
                              className="text-xs font-semibold text-purple-700 hover:text-purple-900"
                            >
                              {conversaAberta ? 'Ocultar conversa' : `Conversa (${item.comentarios ?? 0})`}
                            </button>
                          </div>
                        )}

                        {encerrandoId === item.id && (
                          <div className="space-y-2 border-t border-gray-50 bg-green-50/50 px-4 py-3">
                            <label className="text-xs font-semibold uppercase tracking-widest text-gray-500">
                              Parecer (obrigatório)
                            </label>
                            <textarea
                              value={parecer}
                              onChange={e => setParecer(e.target.value)}
                              rows={3}
                              placeholder="Descreva a conclusão e o encaminhamento dado…"
                              className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400"
                            />
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => { setEncerrandoId(null); setParecer('') }}
                                className="h-8 rounded-lg border border-gray-200 px-3 text-xs font-semibold uppercase tracking-widest text-gray-500 hover:bg-gray-50"
                              >
                                Cancelar
                              </button>
                              <button
                                type="button"
                                disabled={isPending || !parecer.trim()}
                                onClick={() => handleStatusUpdate(item.id, 'encerrada', parecer)}
                                className="h-8 rounded-lg bg-green-600 px-3 text-xs font-semibold uppercase tracking-widest text-white hover:bg-green-700 disabled:opacity-50"
                              >
                                {isPending ? 'Salvando…' : 'Confirmar encerramento'}
                              </button>
                            </div>
                          </div>
                        )}

                        {canWrite && ehOcorrencia && conversaAberta && (
                          <div className="border-t border-gray-50 px-4 py-3">
                            <ConversaOcorrencia
                              ocorrenciaId={item.id.replace('ocorrencia-', '')}
                              onEnviado={() => carregar(true)}
                            />
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>

              {canWrite && (
                <ModalNovaOcorrencia
                  open={novaOpen}
                  onClose={() => setNovaOpen(false)}
                  funcionarioId={dossie.funcionario.id}
                  funcionarioNome={dossie.funcionario.nome}
                  supervisores={supervisores}
                  onCreated={carregar}
                />
              )}
            </>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add components/ocorrencias/modal-dossie.tsx
git commit -m "feat(ocorrencias): conversa e parecer obrigatório no modal do dossiê

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 7: Avisos clicáveis nos sinos + abrir o dossiê pelo link (`?f=`)

**Files:**
- Modify: `components/admin/notificacoes-bell.tsx`
- Modify: `components/admin/supervisor-bell.tsx`
- Modify: `app/(admin)/ocorrencias/page.tsx`
- Modify: `components/ocorrencias/ocorrencias-client.tsx`

- [ ] **Step 1: Sino do admin (`notificacoes-bell.tsx`)**

Na linha do import do `lucide-react`, acrescentar `MessageSquare`:

```tsx
import { Bell, X, CheckCheck, AlertTriangle, FileText, UserMinus, Shield, Trash2, CalendarDays, Timer, MessageSquare } from 'lucide-react'
```

No objeto `TIPO_ICON`, acrescentar a linha:

```tsx
  ocorrencia:     <MessageSquare size={14} className="text-purple-500" />,
```

Em `renderConteudo`, logo antes do `return null` final, acrescentar:

```tsx
  if (log.tipo === 'ocorrencia') {
    let funcionarioId = ''
    try {
      const d = JSON.parse(log.detalhes ?? '{}')
      funcionarioId = d.funcionario_id ?? ''
    } catch { /* ignore */ }
    return (
      <p className="text-xs text-gray-700 leading-snug">
        <span className="font-semibold text-gray-900">{log.supervisor_nome}</span>
        {' '}respondeu em ocorrência de{' '}
        <span className="font-medium">{log.funcionario_nome ?? 'funcionário'}</span>{' '}
        {funcionarioId && (
          <Link href={`/ocorrencias?f=${funcionarioId}`} className="text-blue-500 underline hover:text-blue-700 text-[10px]">abrir dossiê</Link>
        )}
      </p>
    )
  }
```

- [ ] **Step 2: Sino do supervisor (`supervisor-bell.tsx`)**

Adicionar o import no topo, depois do import de `react`:

```tsx
import Link from 'next/link'
```

Em `renderAlerta`, logo antes da linha `return <p className="text-xs text-gray-700 leading-snug font-semibold">{a.titulo}</p>`, acrescentar:

```tsx
  if (a.tipo === 'ocorrencia_devolutiva') {
    let funcionarioId = ''
    let funcionarioNome = ''
    try {
      const d = JSON.parse(a.detalhes ?? '{}')
      funcionarioId = d.funcionario_id ?? ''
      funcionarioNome = d.funcionario_nome ?? ''
    } catch { /* ignore */ }
    return (
      <p className="text-xs text-gray-700 leading-snug">
        <span className="font-semibold text-purple-700">{a.titulo}</span>
        {funcionarioNome && <span className="text-gray-400"> ({funcionarioNome})</span>}{' '}
        {funcionarioId && (
          <Link href={`/ocorrencias?f=${funcionarioId}`} className="text-blue-500 underline hover:text-blue-700 text-[10px]">abrir dossiê</Link>
        )}
      </p>
    )
  }
```

- [ ] **Step 3: `page.tsx` lê `?f=`**

Substituir o arquivo `app/(admin)/ocorrencias/page.tsx` por:

```tsx
import { getUser } from '@/lib/auth/get-user'
import { getPainelFuncionarios, getSupervisoresSimples, getAlertas } from './actions'
import { OcorrenciasClient } from '@/components/ocorrencias/ocorrencias-client'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function OcorrenciasPage({
  searchParams,
}: {
  searchParams: { f?: string }
}) {
  const [funcionarios, supervisores, alertas, auth] = await Promise.all([
    getPainelFuncionarios(),
    getSupervisoresSimples(),
    getAlertas(),
    getUser(),
  ])

  const canWrite = auth?.perfil.role === 'admin' || auth?.perfil.role === 'coordenador' || auth?.perfil.role === 'supervisor'
  const funcionarioInicial = searchParams.f && UUID_RE.test(searchParams.f) ? searchParams.f : null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Ocorrências</h1>
        <p className="text-sm text-gray-400">Dossiê do funcionário: advertências, atestados, faltas e ocorrências num só lugar</p>
      </div>

      <OcorrenciasClient
        funcionarios={funcionarios}
        supervisores={supervisores}
        alertasIniciais={alertas}
        currentUserId={auth?.user.id ?? null}
        canWrite={canWrite}
        funcionarioInicial={funcionarioInicial}
      />
    </div>
  )
}
```

- [ ] **Step 4: `ocorrencias-client.tsx` abre o dossiê inicial**

Trocar a assinatura e o `useState`:

```tsx
export function OcorrenciasClient({
  funcionarios,
  supervisores,
  alertasIniciais,
  canWrite,
  funcionarioInicial,
}: {
  funcionarios: FuncionarioPainel[]
  supervisores: SupervisorSimples[]
  alertasIniciais: AlertaRow[]
  currentUserId: string | null
  canWrite: boolean
  funcionarioInicial: string | null
}) {
  const [selecionado, setSelecionado] = useState<string | null>(funcionarioInicial)
```

(O resto do componente não muda.)

- [ ] **Step 5: Type-check e testes**

Run: `npx tsc --noEmit`
Expected: sem erros.

Run: `npm test`
Expected: todos os testes passam (os 14 novos e os já existentes).

- [ ] **Step 6: Commit**

```bash
git add components/admin/notificacoes-bell.tsx components/admin/supervisor-bell.tsx "app/(admin)/ocorrencias/page.tsx" components/ocorrencias/ocorrencias-client.tsx
git commit -m "feat(ocorrencias): avisos dos sinos abrem o dossiê pelo link ?f=

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 8: Build e verificação manual

**Files:** nenhum (só verificação)

- [ ] **Step 1: Build de produção**

Run: `npm run build`
Expected: build conclui sem erros.

- [ ] **Step 2: Conferir que a migração está aplicada**

Confirmar com o usuário que o SQL da Task 1 foi rodado no Supabase Studio. Sem isso a conversa retorna erro de tabela inexistente.

- [ ] **Step 3: QA manual como admin**

1. Abrir `/ocorrencias`, abrir o dossiê de um funcionário que tenha ocorrência.
2. Clicar em "Conversa (0)" da ocorrência, enviar uma mensagem. Ela aparece na lista com nome, papel e data; o contador vira "Conversa (1)" sem a tela piscar.
3. Clicar em "Encerrar" numa ocorrência "Em Análise": o botão "Confirmar encerramento" fica desabilitado até digitar o parecer. Confirmar, e o parecer aparece na conversa com o selo verde "Parecer".
4. Tentar encerrar sem parecer pela API (não deve ser possível pela UI) retorna erro.

- [ ] **Step 4: QA manual como supervisor**

1. No sino aparece "Nova devolutiva em ocorrência (Nome)" com o link "abrir dossiê". Clicar abre `/ocorrencias?f=...` já com o dossiê aberto.
2. O e-mail recebido tem o link, o nome do funcionário e a frase de que o conteúdo não vai por e-mail, e **não** contém o texto da mensagem.
3. Responder na conversa: o admin vê o aviso "respondeu em ocorrência de ..." no sino, com "abrir dossiê".
4. Abrir `/ocorrencias?f=<id de funcionário de outro posto>`: mostra "Dossiê indisponível para este funcionário." com botão Fechar.

- [ ] **Step 5: QA manual como viewer (se houver usuário de teste)**

O dossiê abre, a timeline aparece, mas não há "Conversa", "Nova Ocorrência" nem botões de status.

---

## Self-Review

**Cobertura da spec:**
- Tabela `ocorrencia_comentarios` + RLS (admin_all, supervisor select/insert, viewer sem acesso, sem edição) → Task 1. ✅
- Thread por ocorrência no dossiê, só em ocorrência → Tasks 5 e 6. ✅
- Parecer obrigatório ao encerrar, gravado como `tipo = 'parecer'` → Task 4 (`updateStatusOcorrencia`) e Task 6 (campo obrigatório). ✅
- `getComentarios`, `comentarOcorrencia`, contagem na timeline → Task 4. ✅
- Aviso RH→supervisor (`alertas_supervisor` + e-mail) e supervisor→RH (`logSupervisorAcao` + e-mail aos admins) → Task 3. ✅
- E-mail sem o texto da mensagem (LGPD) → Task 2 (template sem parâmetro de texto, com teste) e Task 3. ✅
- Falha de e-mail não quebra a ação, mensagem gravada antes do envio → Task 3 (`try/catch`) e Task 4 (notifica depois do insert). ✅
- Link do aviso abre o dossiê (`/ocorrencias?f=`) → Task 7. ✅
- Viewer sem acesso à conversa → Task 1 (sem policy), Task 4 (`getComentarios` devolve `[]`, `comentarOcorrencia` barra), Task 6 (botão só com `canWrite`). ✅
- Fora de escopo respeitado: sem responsável, prazo, anexos, menção, edição de mensagem. ✅

**Decisões que refinam a spec (para o revisor confirmar):**
- A spec diz "supervisor lê a conversa via RLS". As actions usam o admin client depois de checar o escopo na mão, porque o RLS de `perfis` não deixa o supervisor ler o nome do autor do RH. As policies de supervisor ficam como segunda camada de defesa.
- `?f=` inválido (não é UUID) é ignorado na `page.tsx`; funcionário fora do escopo mostra "Dossiê indisponível".

**Consistência de tipos:** `NotificarDevolutivaParams` (Task 3) é chamado com os mesmos campos em `comentarOcorrencia` e `updateStatusOcorrencia` (Task 4). `ComentarioRow` (Task 4) é consumido em `conversa-ocorrencia.tsx` (Task 5) com os mesmos campos. `TimelineItem.comentarios` (Task 4) é lido como `item.comentarios` no modal (Task 6). `MAX_COMENTARIO`, `validarTexto`, `montarDestinatariosSupervisores`, `assuntoDevolutiva`, `templateDevolutivaOcorrencia` são definidos na Task 2 e usados com esses nomes nas Tasks 3, 4 e 5.
