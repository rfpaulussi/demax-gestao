# Encaminhar ocorrência ao RH Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O coordenador/admin encaminha uma ocorrência ao RH por e-mail (rascunho editável, sem CPF/salário/PCD/CID), acompanha "Com o RH há N dias" e registra o retorno do RH como nota interna, invisível ao supervisor.

**Architecture:** Regras puras (rascunho do e-mail, validação de destinatários, contagem de dias, HTML do e-mail) em `lib/ocorrencias/encaminhar-rh.ts` com testes Vitest. Três Server Actions novas em `app/(admin)/ocorrencias/actions.ts` (só admin/coordenador) e um modal novo de rascunho. `nota_interna` é um novo tipo de mensagem filtrado no servidor e no RLS para o supervisor.

**Tech Stack:** Next.js 14 App Router, Server Actions, Supabase (RLS), TypeScript, Tailwind, Vitest, Resend, `@base-ui/react/dialog`.

**Referência:** spec em `docs/superpowers/specs/2026-09-25-encaminhar-rh-design.md`.

**Antes de começar:** executar numa branch nova (`git checkout -b feature/encaminhar-rh`). Não implementar direto no `master`.

**Convenções do projeto:**
- `createClient()` é SÍNCRONO, nunca `await createClient()`.
- Tabelas/colunas novas não estão em `types/database.ts`: usar o cast `as unknown as AnyClient` já existente em `actions.ts`.
- Um arquivo `'use server'` só pode exportar funções async. Por isso o helper `carregarOcorrenciaDevolutiva` e as constantes ficam privados em `actions.ts` (as novas actions vão nesse mesmo arquivo).
- Testes: `npm test` (Vitest). Commits terminam com `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.
- Ignorar avisos inofensivos `failed to delete '.git/worktrees/wt-*'` e LF/CRLF do git no Windows.

**ORDEM DE DEPLOY (importante):** a migração da Task 1 precisa estar aplicada no Supabase **antes** do deploy do código. O dossiê passa a selecionar a coluna `com_rh_desde`; se ela não existir, a consulta de ocorrências falha e as ocorrências somem da tela.

---

## Task 1: Migração SQL

**Files:**
- Create: `supabase/migrations/20260925_encaminhar_rh.sql`

- [ ] **Step 1: Criar o arquivo**

```sql
-- ============================================================
-- Encaminhar ocorrência ao RH (fluxo do coordenador).
-- - ocorrencias.com_rh_desde / com_rh_por: "está com o RH".
-- - ocorrencia_comentarios.tipo ganha 'nota_interna': só admin/coordenador vê.
--   O supervisor nunca lê esse tipo (RLS abaixo + filtro no servidor).
-- ============================================================

ALTER TABLE ocorrencias
  ADD COLUMN IF NOT EXISTS com_rh_desde timestamptz,
  ADD COLUMN IF NOT EXISTS com_rh_por   uuid REFERENCES perfis(id);

ALTER TABLE ocorrencia_comentarios
  DROP CONSTRAINT IF EXISTS ocorrencia_comentarios_tipo_check;
ALTER TABLE ocorrencia_comentarios
  ADD CONSTRAINT ocorrencia_comentarios_tipo_check
  CHECK (tipo IN ('mensagem', 'parecer', 'nota_interna'));

-- supervisor: lê a conversa das ocorrências do seu posto, MENOS as notas internas
DROP POLICY IF EXISTS ocorrencia_comentarios_supervisor_select ON ocorrencia_comentarios;
CREATE POLICY ocorrencia_comentarios_supervisor_select ON ocorrencia_comentarios
  FOR SELECT TO authenticated
  USING (
    is_supervisor()
    AND tipo <> 'nota_interna'
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
-- A policy de INSERT do supervisor continua só tipo = 'mensagem' (não mexe).
```

- [ ] **Step 2: Aplicar no Supabase**

O MCP do Supabase desta sessão aponta para outro projeto. Não tente aplicar por ele. Avise o usuário para rodar o SQL no Supabase Studio (SQL Editor, projeto `fwdhnipekbmeqozkpfyh`) e aguarde a confirmação antes do QA (Task 7) e antes de qualquer deploy. O código das Tasks 2 a 6 compila sem a migração.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260925_encaminhar_rh.sql
git commit -m "feat(ocorrencias): colunas com_rh e tipo nota_interna + RLS

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 2: Regras puras do encaminhamento (TDD)

**Files:**
- Create: `lib/ocorrencias/encaminhar-rh.test.ts`
- Create: `lib/ocorrencias/encaminhar-rh.ts`

- [ ] **Step 1: Escrever os testes que falham**

```typescript
import { describe, it, expect } from 'vitest'
import {
  montarRascunhoRH,
  validarEmails,
  diasComRH,
  corpoParaHtml,
  type DadosRascunhoRH,
} from './encaminhar-rh'

const base: DadosRascunhoRH = {
  remetenteNome: 'Rodolfo Paulussi',
  funcionarioNome: 'Maria Souza',
  registro: '103152',
  funcao: 'Servente',
  postoNome: 'EM Maria Luiza',
  secretaria: 'SME',
  dataOcorrencia: '2026-09-17',
  gravidade: 'Média',
  supervisorNome: 'CRISL',
  textoOcorrencia: 'Colaboradora apresentou nova crise na unidade.',
  advertencias: [],
  atestados: [],
  faltas: [],
}

describe('montarRascunhoRH', () => {
  it('abre com a saudação à Coordenadora de RH e fecha com o remetente', () => {
    const { corpo } = montarRascunhoRH(base)
    expect(corpo.startsWith('Prezada Coordenadora de RH,')).toBe(true)
    expect(corpo).toContain('Atenciosamente,\nRodolfo Paulussi')
  })

  it('traz colaborador, posto, função, RE, supervisor e o relato', () => {
    const { corpo } = montarRascunhoRH(base)
    expect(corpo).toContain('Maria Souza')
    expect(corpo).toContain('103152')
    expect(corpo).toContain('Servente')
    expect(corpo).toContain('EM Maria Luiza')
    expect(corpo).toContain('SME')
    expect(corpo).toContain('CRISL')
    expect(corpo).toContain('17/09/2026')
    expect(corpo).toContain('Média')
    expect(corpo).toContain('Colaboradora apresentou nova crise na unidade.')
  })

  it('o assunto cita o colaborador e o RE', () => {
    expect(montarRascunhoRH(base).assunto).toBe('Ocorrência — Maria Souza (RE 103152)')
  })

  it('o assunto não quebra sem RE', () => {
    expect(montarRascunhoRH({ ...base, registro: null }).assunto).toBe('Ocorrência — Maria Souza')
  })

  it('diz "nenhuma" quando não há histórico', () => {
    const { corpo } = montarRascunhoRH(base)
    expect(corpo).toContain('Advertências: nenhuma')
    expect(corpo).toContain('Atestados: nenhum')
    expect(corpo).toContain('Faltas: nenhuma')
  })

  it('lista o histórico e calcula os dias de atestado (inclusive)', () => {
    const { corpo } = montarRascunhoRH({
      ...base,
      advertencias: [{ grau: 'Escrita', natureza: 'Falta Injustificada', data: '2026-08-10' }],
      atestados: [{ inicio: '2026-09-17', fim: '2026-09-30' }, { inicio: '2026-09-09', fim: null }],
      faltas: [{ tipo: 'Sem Justificativa', dias: 2, data: '2026-08-11' }],
    })
    expect(corpo).toContain('Escrita — Falta Injustificada (10/08/2026)')
    expect(corpo).toContain('17/09/2026 a 30/09/2026 (14 dias)')
    expect(corpo).toContain('09/09/2026 (1 dia)')
    expect(corpo).toContain('Sem Justificativa, 2 dia(s) (11/08/2026)')
  })

  it('NUNCA vaza dado que não é campo explícito (CPF, salário, CID) mesmo que venha no objeto', () => {
    const contaminado = {
      ...base,
      cpf: '123.456.789-09',
      salario: 4321.55,
      cid_codigo: 'F41.1',
      motivo: 'crise de ansiedade',
    } as unknown as DadosRascunhoRH
    const { assunto, corpo } = montarRascunhoRH(contaminado)
    const tudo = `${assunto}\n${corpo}`
    expect(tudo).not.toContain('123.456.789-09')
    expect(tudo).not.toContain('4321')
    expect(tudo).not.toContain('F41.1')
    expect(tudo).not.toContain('crise de ansiedade')
  })
})

describe('validarEmails', () => {
  it('aceita um e-mail', () => {
    expect(validarEmails('rh@demax.com.br')).toEqual({ ok: true, emails: ['rh@demax.com.br'] })
  })

  it('aceita vários separados por vírgula ou ponto e vírgula, sem repetir, em minúsculas', () => {
    expect(validarEmails('A@x.com; b@x.com, a@X.com')).toEqual({ ok: true, emails: ['a@x.com', 'b@x.com'] })
  })

  it('recusa vazio', () => {
    expect(validarEmails('  ')).toEqual({ ok: false, error: 'Informe o e-mail do destinatário' })
  })

  it('recusa endereço inválido e diz qual', () => {
    expect(validarEmails('rh@demax.com.br, semarroba')).toEqual({ ok: false, error: 'E-mail inválido: semarroba' })
  })

  it('recusa mais de 5 destinatários', () => {
    const r = validarEmails('a@x.com,b@x.com,c@x.com,d@x.com,e@x.com,f@x.com')
    expect(r.ok).toBe(false)
  })
})

describe('diasComRH', () => {
  it('conta dias inteiros desde o encaminhamento', () => {
    expect(diasComRH('2026-09-20T12:00:00Z', new Date('2026-09-25T13:00:00Z'))).toBe(5)
  })

  it('devolve 0 no mesmo dia e nunca negativo', () => {
    expect(diasComRH('2026-09-25T12:00:00Z', new Date('2026-09-25T13:00:00Z'))).toBe(0)
    expect(diasComRH('2026-09-30T12:00:00Z', new Date('2026-09-25T13:00:00Z'))).toBe(0)
  })
})

describe('corpoParaHtml', () => {
  it('escapa HTML e mantém as quebras de linha', () => {
    const html = corpoParaHtml('Linha 1\n<b>Linha 2</b>')
    expect(html).toContain('Linha 1<br>&lt;b&gt;Linha 2&lt;/b&gt;')
    expect(html).not.toContain('<b>')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run lib/ocorrencias/encaminhar-rh.test.ts`
Expected: FAIL (módulo `./encaminhar-rh` não existe).

- [ ] **Step 3: Implementar**

```typescript
// Regras puras do encaminhamento ao RH (sem I/O, testadas em encaminhar-rh.test.ts).
//
// LGPD / decisão do usuário: o e-mail ao RH leva nome, RE, posto, função, relato e resumo do histórico.
// NUNCA leva CPF, salário, PCD, CID nem motivo de atestado, conversa ou notas internas.
// Por isso o rascunho recebe CAMPOS EXPLÍCITOS (nunca um registro de funcionário inteiro).

import { escapeHtml } from './devolutiva'

export const MAX_DESTINATARIOS = 5

export type DadosRascunhoRH = {
  remetenteNome: string
  funcionarioNome: string
  registro: string | null
  funcao: string | null
  postoNome: string
  secretaria: string
  dataOcorrencia: string | null // AAAA-MM-DD
  gravidade: string | null // já com rótulo ("Média")
  supervisorNome: string | null
  textoOcorrencia: string
  advertencias: { grau: string; natureza: string; data: string | null }[]
  atestados: { inicio: string; fim: string | null }[] // só datas: sem CID nem motivo
  faltas: { tipo: string; dias: number; data: string }[]
}

function fmtData(iso: string | null): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('T')[0].split('-')
  return `${d}/${m}/${y}`
}

function diasInclusivos(inicio: string, fim: string | null): number {
  if (!fim) return 1
  const d1 = new Date(inicio.split('T')[0] + 'T00:00:00')
  const d2 = new Date(fim.split('T')[0] + 'T00:00:00')
  return Math.max(1, Math.round((d2.getTime() - d1.getTime()) / 86400000) + 1)
}

export function montarRascunhoRH(d: DadosRascunhoRH): { assunto: string; corpo: string } {
  const assunto = d.registro
    ? `Ocorrência — ${d.funcionarioNome} (RE ${d.registro})`
    : `Ocorrência — ${d.funcionarioNome}`

  const advertencias = d.advertencias.length === 0
    ? 'Advertências: nenhuma'
    : ['Advertências:', ...d.advertencias.map(a => `- ${a.grau} — ${a.natureza} (${fmtData(a.data)})`)].join('\n')

  const atestados = d.atestados.length === 0
    ? 'Atestados: nenhum'
    : [
        'Atestados:',
        ...d.atestados.map(a => {
          const dias = diasInclusivos(a.inicio, a.fim)
          const periodo = a.fim && a.fim !== a.inicio ? `${fmtData(a.inicio)} a ${fmtData(a.fim)}` : fmtData(a.inicio)
          return `- ${periodo} (${dias} ${dias === 1 ? 'dia' : 'dias'})`
        }),
      ].join('\n')

  const faltas = d.faltas.length === 0
    ? 'Faltas: nenhuma'
    : ['Faltas:', ...d.faltas.map(f => `- ${f.tipo}, ${f.dias} dia(s) (${fmtData(f.data)})`)].join('\n')

  const quemRegistrou = d.supervisorNome ? `, registrada pelo supervisor ${d.supervisorNome},` : ''

  const corpo = [
    'Prezada Coordenadora de RH,',
    '',
    `Encaminho a ocorrência abaixo${quemRegistrou} para sua análise e orientação.`,
    '',
    'COLABORADOR',
    `Nome: ${d.funcionarioNome}`,
    `Matrícula (RE): ${d.registro ?? '—'}`,
    `Função: ${d.funcao ?? '—'}`,
    `Posto: ${d.postoNome}${d.secretaria ? ` — ${d.secretaria}` : ''}`,
    '',
    'OCORRÊNCIA',
    `Data: ${fmtData(d.dataOcorrencia)}`,
    `Gravidade: ${d.gravidade ?? '—'}`,
    'Relato:',
    d.textoOcorrencia,
    '',
    'HISTÓRICO',
    advertencias,
    atestados,
    faltas,
    '',
    'Fico no aguardo da sua orientação. Pode responder diretamente a este e-mail.',
    '',
    'Atenciosamente,',
    d.remetenteNome,
  ].join('\n')

  return { assunto, corpo }
}

const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/

export function validarEmails(
  texto: string,
): { ok: true; emails: string[] } | { ok: false; error: string } {
  const partes = texto.split(/[;,]/).map(s => s.trim()).filter(Boolean)
  if (partes.length === 0) return { ok: false, error: 'Informe o e-mail do destinatário' }
  const invalido = partes.find(p => !EMAIL_RE.test(p))
  if (invalido) return { ok: false, error: `E-mail inválido: ${invalido}` }
  const emails = Array.from(new Set(partes.map(p => p.toLowerCase())))
  if (emails.length > MAX_DESTINATARIOS) {
    return { ok: false, error: `Máximo de ${MAX_DESTINATARIOS} destinatários` }
  }
  return { ok: true, emails }
}

export function diasComRH(desde: string, hoje: Date = new Date()): number {
  const ms = hoje.getTime() - new Date(desde).getTime()
  return Math.max(0, Math.floor(ms / 86400000))
}

// O corpo é texto puro editado pelo coordenador: escapa e preserva as quebras de linha.
export function corpoParaHtml(corpo: string): string {
  const conteudo = escapeHtml(corpo).replace(/\r?\n/g, '<br>')
  return `<!DOCTYPE html>
<html lang="pt-BR">
<body style="margin:0;padding:16px;background:#f1f5f9;font-family:Arial,sans-serif">
<div style="max-width:640px;margin:0 auto;background:#fff;border-radius:10px;padding:24px;font-size:14px;line-height:1.6;color:#1e293b">${conteudo}</div>
</body></html>`
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run lib/ocorrencias/encaminhar-rh.test.ts`
Expected: PASS, 15 testes.

- [ ] **Step 5: Commit**

```bash
git add lib/ocorrencias/encaminhar-rh.ts lib/ocorrencias/encaminhar-rh.test.ts
git commit -m "feat(ocorrencias): regras puras do encaminhamento ao RH (rascunho sem dado sensível)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: `enviarEmail` com Reply-To e retorno de sucesso

**Files:**
- Modify: `lib/email.ts` (função `enviarEmail`)

- [ ] **Step 1: Substituir a função `enviarEmail` inteira** (a que começa em `export async function enviarEmail(opts: {`) por:

```typescript
export async function enviarEmail(opts: {
  to: string[]
  subject: string
  html: string
  replyTo?: string
}): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY não configurada — e-mail ignorado')
    return false
  }
  if (opts.to.length === 0) {
    console.warn('[email] Nenhum destinatário — e-mail ignorado')
    return false
  }
  try {
    const { error } = await getResend().emails.send({
      from: FROM,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      ...(opts.replyTo ? { replyTo: opts.replyTo } : {}),
    })
    if (error) {
      console.error('[email] Resend error:', error)
      return false
    }
    return true
  } catch (e) {
    console.error('[email] Erro ao enviar:', e)
    return false
  }
}
```

Os chamadores atuais (`await enviarEmail(...)` em férias, devolutiva, cron) ignoram o retorno, então continuam válidos.

- [ ] **Step 2: Type-check e testes**

Run: `npx tsc --noEmit` — Expected: sem erros.
Run: `npm test` — Expected: tudo passa.

- [ ] **Step 3: Commit**

```bash
git add lib/email.ts
git commit -m "feat(email): enviarEmail aceita replyTo e informa se enviou

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: Server Actions (`actions.ts`)

**Files:**
- Modify: `app/(admin)/ocorrencias/actions.ts` (edições pontuais; leia o arquivo antes e NÃO reescreva o resto)

- [ ] **Step 1: Imports.** Depois da linha `import type { AuthUser } from '@/lib/auth/get-user'`, adicionar:

```typescript
import { enviarEmail } from '@/lib/email'
import {
  corpoParaHtml,
  montarRascunhoRH,
  validarEmails,
  type DadosRascunhoRH,
} from '@/lib/ocorrencias/encaminhar-rh'
```

- [ ] **Step 2: Tipos da timeline.** Em `TimelineItem`, depois de `supervisor_nome?: string | null`, adicionar `com_rh_desde?: string | null`. Em `RawOcorrenciaDossie`, depois de `supervisor_id: string | null`, adicionar `com_rh_desde: string | null`.

- [ ] **Step 3: Dossiê seleciona `com_rh_desde` e esconde do supervisor.**

Na query de ocorrências de `getDossieFuncionario`, trocar
`.select('id, titulo, descricao, data_ocorrencia, gravidade, status, supervisor_id')`
por
`.select('id, titulo, descricao, data_ocorrencia, gravidade, status, supervisor_id, com_rh_desde')`.

Trocar o bloco da contagem de mensagens (o `const contagemComentarios = new Map...` inteiro, até o `}` do `if`) por:

```typescript
  const ehGestao = auth.perfil.role === 'admin' || auth.perfil.role === 'coordenador'

  // contagem de mensagens por ocorrência (viewer não vê a conversa, então não recebe contagem).
  // Nota interna é só da gestão: para supervisor ela nem entra na contagem.
  const contagemComentarios = new Map<string, number>()
  if (ocorrencias.length > 0 && auth.perfil.role !== 'viewer') {
    const { data: cs } = await (createAdminClient() as unknown as AnyClient)
      .from('ocorrencia_comentarios')
      .select('ocorrencia_id, tipo')
      .in('ocorrencia_id', ocorrencias.map(o => o.id))
    for (const c of (cs ?? []) as { ocorrencia_id: string; tipo: string }[]) {
      if (auth.perfil.role === 'supervisor' && c.tipo === 'nota_interna') continue
      contagemComentarios.set(c.ocorrencia_id, (contagemComentarios.get(c.ocorrencia_id) ?? 0) + 1)
    }
  }
```

No `timeline.push` das ocorrências, depois de `supervisor_nome: ...,` adicionar:

```typescript
      com_rh_desde: ehGestao ? (o.com_rh_desde ?? null) : null,
```

- [ ] **Step 4: Helper de acesso devolve `com_rh_desde`.** No tipo `OcorrenciaDevolutiva`, depois de `status: string`, adicionar `com_rh_desde: string | null`. Em `carregarOcorrenciaDevolutiva`, trocar o `.select('id, tipo, status, posto_id, supervisor_id, funcionario_id, funcionarios!funcionario_id(nome, posto_id)')` por `.select('id, tipo, status, com_rh_desde, posto_id, supervisor_id, funcionario_id, funcionarios!funcionario_id(nome, posto_id)')` e, no objeto retornado, depois de `status: data.status ?? 'aberta',`, adicionar `com_rh_desde: data.com_rh_desde ?? null,`.

- [ ] **Step 5: `nota_interna` nos tipos e filtro do supervisor.** Em `ComentarioRow` e em `RawComentario`, trocar `tipo: 'mensagem' | 'parecer'` por `tipo: 'mensagem' | 'parecer' | 'nota_interna'`.

Em `getComentarios`, trocar o trecho
```typescript
  const { data } = await (createAdminClient() as unknown as AnyClient)
    .from('ocorrencia_comentarios')
    .select('id, texto, tipo, created_at, perfis!autor_id(nome, role)')
    .eq('ocorrencia_id', ocorrenciaId)
    .order('created_at', { ascending: true })
```
por
```typescript
  let consulta = (createAdminClient() as unknown as AnyClient)
    .from('ocorrencia_comentarios')
    .select('id, texto, tipo, created_at, perfis!autor_id(nome, role)')
    .eq('ocorrencia_id', ocorrenciaId)
    .order('created_at', { ascending: true })
  // nota interna é só da gestão: o supervisor nunca a recebe
  if (auth.perfil.role === 'supervisor') consulta = consulta.neq('tipo', 'nota_interna')
  const { data } = await consulta
```

- [ ] **Step 6: Encerrar limpa "Com o RH".** Em `updateStatusOcorrencia`, no `.update({ status, atualizado_por: auth.user.id, atualizado_em: new Date().toISOString() })` da troca de status, trocar por:

```typescript
    .update({
      status,
      atualizado_por: auth.user.id,
      atualizado_em: new Date().toISOString(),
      ...(status === 'encerrada' ? { com_rh_desde: null, com_rh_por: null } : {}),
    })
```

- [ ] **Step 7: Novas actions.** No FIM do arquivo (depois de `updateStatusOcorrencia`), acrescentar:

```typescript
// ─── encaminhar ao RH (só admin e coordenador) ─────────────────────────────────

async function exigirGestao(): Promise<AuthUser | null> {
  const auth = await getUser()
  if (!auth || (auth.perfil.role !== 'admin' && auth.perfil.role !== 'coordenador')) return null
  return auth
}

const ROTULO_GRAVIDADE: Record<string, string> = {
  baixa: 'Baixa', media: 'Média', alta: 'Alta', critica: 'Crítica',
}

// Colunas listadas UMA A UMA de propósito: nunca cpf, salário, pcd, cid_codigo nem motivo de atestado.
async function montarDadosRascunhoRH(
  oc: OcorrenciaDevolutiva,
  remetenteNome: string,
): Promise<DadosRascunhoRH | null> {
  const admin = createAdminClient() as unknown as AnyClient
  const [rOc, rFunc, rAdv, rAts, rFts] = await Promise.all([
    admin.from('ocorrencias')
      .select('descricao, data_ocorrencia, gravidade, supervisor_id')
      .eq('id', oc.id)
      .single(),
    admin.from('funcionarios')
      .select('nome, registro, funcoes!funcionarios_funcao_id_fkey(nome), postos!posto_id(nome, secretaria)')
      .eq('id', oc.funcionario_id)
      .single(),
    admin.from('advertencias')
      .select('grau, natureza, data_ocorrencia')
      .eq('funcionario_id', oc.funcionario_id)
      .order('data_ocorrencia', { ascending: false }),
    admin.from('atestados')
      .select('data_inicio, data_fim')
      .eq('funcionario_id', oc.funcionario_id)
      .order('data_inicio', { ascending: false }),
    admin.from('faltas')
      .select('data_falta, tipo, dias')
      .eq('funcionario_id', oc.funcionario_id)
      .order('data_falta', { ascending: false }),
  ])

  const o = rOc.data
  const f = rFunc.data
  if (!o || !f) return null
  const posto = Array.isArray(f.postos) ? f.postos[0] : f.postos
  const funcao = Array.isArray(f.funcoes) ? f.funcoes[0] : f.funcoes

  let supervisorNome: string | null = null
  if (o.supervisor_id) {
    const { data: p } = await admin.from('perfis').select('nome').eq('id', o.supervisor_id).single()
    supervisorNome = p?.nome ?? null
  }

  return {
    remetenteNome,
    funcionarioNome: f.nome,
    registro: f.registro ?? null,
    funcao: funcao?.nome ?? null,
    postoNome: posto?.nome ?? '—',
    secretaria: posto?.secretaria ?? '',
    dataOcorrencia: o.data_ocorrencia ?? null,
    gravidade: o.gravidade ? (ROTULO_GRAVIDADE[o.gravidade] ?? o.gravidade) : null,
    supervisorNome,
    textoOcorrencia: o.descricao ?? '',
    advertencias: ((rAdv.data ?? []) as { grau: string | null; natureza: string | null; data_ocorrencia: string | null }[]).map(a => ({
      grau: GRAU_LABEL[a.grau ?? ''] ?? a.grau ?? '—',
      natureza: a.natureza ? (NATUREZA_LABEL[a.natureza] ?? a.natureza) : '—',
      data: a.data_ocorrencia,
    })),
    atestados: ((rAts.data ?? []) as { data_inicio: string; data_fim: string | null }[]).map(a => ({
      inicio: a.data_inicio,
      fim: a.data_fim,
    })),
    faltas: ((rFts.data ?? []) as { data_falta: string; tipo: string; dias: number | null }[]).map(x => ({
      tipo: FALTA_TIPO_LABELS[x.tipo as FaltaTipo] ?? x.tipo,
      dias: x.dias ?? 1,
      data: x.data_falta,
    })),
  }
}

export type RascunhoRH =
  | { success: true; para: string; assunto: string; corpo: string }
  | { success: false; error: string }

export async function getRascunhoRH(ocorrenciaId: string): Promise<RascunhoRH> {
  const auth = await exigirGestao()
  if (!auth) return { success: false, error: 'Sem permissão' }

  const oc = await carregarOcorrenciaDevolutiva(ocorrenciaId, auth)
  if (!oc) return { success: false, error: 'Sem permissão' }
  if (oc.status === 'encerrada' || oc.status === 'resolvido') {
    return { success: false, error: 'Esta ocorrência já foi encerrada' }
  }
  if (oc.com_rh_desde) return { success: false, error: 'Esta ocorrência já está com o RH' }

  const dados = await montarDadosRascunhoRH(oc, auth.perfil.nome ?? 'Coordenação')
  if (!dados) return { success: false, error: 'Não foi possível montar o rascunho' }

  const { assunto, corpo } = montarRascunhoRH(dados)
  return { success: true, para: process.env.RESEND_TO_RH ?? '', assunto, corpo }
}

const MAX_CORPO_RH = 20000

export async function encaminharAoRH(
  ocorrenciaId: string,
  dados: { para: string; assunto: string; corpo: string },
): Promise<ActionResult> {
  const auth = await exigirGestao()
  if (!auth) return { success: false, error: 'Sem permissão' }

  const destinatarios = validarEmails(dados.para)
  if (!destinatarios.ok) return { success: false, error: destinatarios.error }

  const assunto = dados.assunto.trim()
  const corpo = dados.corpo.trim()
  if (!assunto || assunto.length > 200) return { success: false, error: 'Assunto inválido (até 200 caracteres)' }
  if (!corpo) return { success: false, error: 'Escreva a mensagem' }
  if (corpo.length > MAX_CORPO_RH) return { success: false, error: 'Mensagem muito longa' }

  const oc = await carregarOcorrenciaDevolutiva(ocorrenciaId, auth)
  if (!oc) return { success: false, error: 'Sem permissão' }
  if (oc.status === 'encerrada' || oc.status === 'resolvido') {
    return { success: false, error: 'Esta ocorrência já foi encerrada' }
  }
  if (oc.com_rh_desde) return { success: false, error: 'Esta ocorrência já está com o RH' }

  // Envia primeiro: se o e-mail falhar, nada muda no sistema e o coordenador vê o erro.
  const enviado = await enviarEmail({
    to: destinatarios.emails,
    subject: assunto,
    html: corpoParaHtml(corpo),
    replyTo: auth.user.email ?? undefined,
  })
  if (!enviado) {
    return { success: false, error: 'Não foi possível enviar o e-mail. Confira a configuração do Resend e tente de novo.' }
  }

  const admin = createAdminClient() as unknown as AnyClient
  const { data: marcadas, error } = await admin
    .from('ocorrencias')
    .update({ com_rh_desde: new Date().toISOString(), com_rh_por: auth.user.id })
    .eq('id', ocorrenciaId)
    .is('com_rh_desde', null)
    .select('id')
  if (error || !marcadas || marcadas.length === 0) {
    return {
      success: false,
      error: 'O e-mail foi enviado, mas não foi possível marcar a ocorrência como "Com o RH". Não envie de novo.',
    }
  }

  await admin.from('ocorrencia_comentarios').insert({
    ocorrencia_id: ocorrenciaId,
    autor_id: auth.user.id,
    tipo: 'nota_interna',
    texto: `Encaminhado ao RH (para: ${destinatarios.emails.join(', ')})\nAssunto: ${assunto}\n\n${corpo}`,
  })

  revalidatePath('/ocorrencias')
  return { success: true }
}

export async function registrarRetornoRH(ocorrenciaId: string, texto: string): Promise<ActionResult> {
  const auth = await exigirGestao()
  if (!auth) return { success: false, error: 'Sem permissão' }

  const validado = validarTexto(texto)
  if (!validado.ok) return { success: false, error: validado.error }

  const oc = await carregarOcorrenciaDevolutiva(ocorrenciaId, auth)
  if (!oc) return { success: false, error: 'Sem permissão' }
  if (!oc.com_rh_desde) return { success: false, error: 'Esta ocorrência não está com o RH' }

  const admin = createAdminClient() as unknown as AnyClient

  // Nota primeiro: se a gravação falhar, o "Com o RH" continua e o retorno não se perde.
  const { error: erroNota } = await admin.from('ocorrencia_comentarios').insert({
    ocorrencia_id: ocorrenciaId,
    autor_id: auth.user.id,
    tipo: 'nota_interna',
    texto: `Retorno do RH:\n${validado.texto}`,
  })
  if (erroNota) return { success: false, error: erroNota.message }

  const { error } = await admin
    .from('ocorrencias')
    .update({ com_rh_desde: null, com_rh_por: null })
    .eq('id', ocorrenciaId)
  if (error) return { success: false, error: error.message }

  revalidatePath('/ocorrencias')
  return { success: true }
}
```

- [ ] **Step 8: Verificar**

Run: `npx tsc --noEmit` — Expected: sem erros.
Run: `npm test` — Expected: tudo passa.

- [ ] **Step 9: Commit**

```bash
git add "app/(admin)/ocorrencias/actions.ts"
git commit -m "feat(ocorrencias): actions de encaminhar ao RH e registrar retorno (nota interna só da gestão)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 5: Modal de rascunho (`modal-encaminhar-rh.tsx`)

**Files:**
- Create: `components/ocorrencias/modal-encaminhar-rh.tsx`

- [ ] **Step 1: Criar o componente**

```tsx
'use client'

import { useEffect, useState, useTransition } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { getRascunhoRH, encaminharAoRH } from '@/app/(admin)/ocorrencias/actions'

const inputClass =
  'h-9 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm shadow-sm text-gray-700 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400'

export function ModalEncaminharRH({
  ocorrenciaId,
  onClose,
  onEnviado,
}: {
  ocorrenciaId: string
  onClose: () => void
  onEnviado: () => void
}) {
  const [carregando, setCarregando] = useState(true)
  const [erroCarga, setErroCarga]   = useState<string | null>(null)
  const [para, setPara]             = useState('')
  const [assunto, setAssunto]       = useState('')
  const [corpo, setCorpo]           = useState('')
  const [erro, setErro]             = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    let ativo = true
    ;(async () => {
      const r = await getRascunhoRH(ocorrenciaId)
      if (!ativo) return
      if (r.success) {
        setPara(r.para)
        setAssunto(r.assunto)
        setCorpo(r.corpo)
      } else {
        setErroCarga(r.error)
      }
      setCarregando(false)
    })()
    return () => { ativo = false }
  }, [ocorrenciaId])

  function handleEnviar() {
    setErro(null)
    startTransition(async () => {
      const r = await encaminharAoRH(ocorrenciaId, { para, assunto, corpo })
      if (r.success) {
        onEnviado()
        onClose()
      } else {
        setErro(r.error)
      }
    })
  }

  return (
    <Dialog.Root open onOpenChange={(aberto) => { if (!aberto) onClose() }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[60] bg-black/50" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-[61] max-h-[90vh] w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
          <Dialog.Title className="mb-1 text-sm font-bold uppercase tracking-widest text-gray-900">
            Encaminhar ao RH
          </Dialog.Title>

          {carregando ? (
            <p className="py-10 text-center text-sm text-gray-400">Montando o rascunho…</p>
          ) : erroCarga ? (
            <div className="py-8 text-center">
              <p className="text-sm text-red-500">{erroCarga}</p>
              <button
                onClick={onClose}
                className="mt-4 h-8 rounded-lg border border-gray-200 px-4 text-xs font-semibold uppercase tracking-widest text-gray-500 hover:bg-gray-50"
              >
                Fechar
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Este e-mail sai do sistema. Ele leva o que você ver abaixo, e você pode editar tudo.
                <strong> CPF, salário, PCD, CID e motivo de atestado nunca são incluídos</strong>, nem a conversa
                com o supervisor e as notas internas. O RH responde direto para o seu e-mail.
              </p>

              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-widest text-gray-400">Para</label>
                <input
                  type="text"
                  value={para}
                  onChange={e => setPara(e.target.value)}
                  placeholder="rh@empresa.com.br (vários: separe por vírgula)"
                  className={inputClass}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-widest text-gray-400">Assunto</label>
                <input
                  type="text"
                  value={assunto}
                  onChange={e => setAssunto(e.target.value)}
                  maxLength={200}
                  className={inputClass}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-widest text-gray-400">Mensagem</label>
                <textarea
                  value={corpo}
                  onChange={e => setCorpo(e.target.value)}
                  rows={16}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 font-mono text-xs leading-relaxed text-gray-700 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400"
                />
              </div>

              {erro && <p className="text-xs text-red-500">{erro}</p>}

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="h-9 rounded-lg border border-gray-200 px-4 text-xs font-semibold uppercase tracking-widest text-gray-500 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={isPending || !para.trim() || !assunto.trim() || !corpo.trim()}
                  onClick={handleEnviar}
                  className="h-9 rounded-lg bg-slate-900 px-4 text-xs font-semibold uppercase tracking-widest text-white hover:bg-slate-700 disabled:opacity-50"
                >
                  {isPending ? 'Enviando…' : 'Enviar ao RH'}
                </button>
              </div>
            </div>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit` — Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add components/ocorrencias/modal-encaminhar-rh.tsx
git commit -m "feat(ocorrencias): modal de rascunho do e-mail ao RH

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 6: Integração na interface (edições pontuais)

**Files:**
- Modify: `components/ocorrencias/conversa-ocorrencia.tsx`
- Modify: `components/ocorrencias/modal-dossie.tsx`
- Modify: `components/ocorrencias/ocorrencias-client.tsx`
- Modify: `app/(admin)/ocorrencias/page.tsx`

IMPORTANTE: `modal-dossie.tsx` recebeu commits de outras pessoas (ex.: a linha "Registrado por"). **Faça só as edições abaixo, com Edit pontual. NÃO reescreva o arquivo inteiro.**

- [ ] **Step 1: `conversa-ocorrencia.tsx` mostra a nota interna.**

Trocar a linha do `className` de cada mensagem
```tsx
              className={`rounded-lg px-3 py-2 ${c.tipo === 'parecer' ? 'bg-green-50 ring-1 ring-green-200' : 'bg-gray-50'}`}
```
por
```tsx
              className={`rounded-lg px-3 py-2 ${
                c.tipo === 'parecer'
                  ? 'bg-green-50 ring-1 ring-green-200'
                  : c.tipo === 'nota_interna'
                    ? 'bg-amber-50 ring-1 ring-amber-200'
                    : 'bg-gray-50'
              }`}
```

E, logo depois do bloco do selo "Parecer" (o `{c.tipo === 'parecer' && ( <span ...>Parecer</span> )}`), adicionar:

```tsx
                {c.tipo === 'nota_interna' && (
                  <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                    Nota interna (só gestão)
                  </span>
                )}
```

- [ ] **Step 2: `page.tsx` calcula `ehGestao`.** Depois da linha `const canWrite = ...`, adicionar:

```tsx
  const ehGestao = auth?.perfil.role === 'admin' || auth?.perfil.role === 'coordenador'
```
e, no `<OcorrenciasClient ... />`, acrescentar a prop `ehGestao={ehGestao}` (ao lado de `canWrite={canWrite}`).

- [ ] **Step 3: `ocorrencias-client.tsx` repassa.** Na assinatura, acrescentar `ehGestao` à desestruturação e `ehGestao: boolean` ao tipo das props. No `<ModalDossie ... />`, acrescentar `ehGestao={ehGestao}`.

- [ ] **Step 4: `modal-dossie.tsx` — imports e props.**

Junto dos outros imports, acrescentar:
```tsx
import { ModalEncaminharRH } from './modal-encaminhar-rh'
import { diasComRH } from '@/lib/ocorrencias/encaminhar-rh'
```
Trocar o import das actions por:
```tsx
import { getDossieFuncionario, updateStatusOcorrencia, registrarRetornoRH } from '@/app/(admin)/ocorrencias/actions'
```
Na assinatura de `ModalDossie`, acrescentar `ehGestao,` na desestruturação e `ehGestao: boolean` no tipo, ao lado de `canWrite`.

- [ ] **Step 5: `modal-dossie.tsx` — estados e handler.** Depois da linha `const [parecer, setParecer] = useState('')`, adicionar:

```tsx
  const [encaminharId, setEncaminharId] = useState<string | null>(null)
  const [retornoId, setRetornoId]       = useState<string | null>(null)
  const [retornoTexto, setRetornoTexto] = useState('')
```
e, depois da função `handleStatusUpdate`, adicionar:

```tsx
  function handleRetornoRH(idComPrefixo: string) {
    const id = idComPrefixo.replace('ocorrencia-', '')
    startTransition(async () => {
      const result = await registrarRetornoRH(id, retornoTexto)
      if (result.success) {
        setRetornoId(null)
        setRetornoTexto('')
        carregar()
      } else {
        alert(result.error)
      }
    })
  }
```

- [ ] **Step 6: `modal-dossie.tsx` — botões e selo.** Na coluna da direita de cada item (o `<div className="flex flex-shrink-0 flex-col items-end gap-1.5">`), logo DEPOIS do bloco do botão "Encerrar" (o `{canWrite && ehOcorrencia && item.status === 'em_analise' && ( ... )}`) e ANTES do `</div>` que fecha essa coluna, adicionar:

```tsx
                            {ehGestao && ehOcorrencia && (item.status === 'aberta' || item.status === 'em_analise') && (
                              item.com_rh_desde ? (
                                <>
                                  <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                                    Com o RH há {diasComRH(item.com_rh_desde)} {diasComRH(item.com_rh_desde) === 1 ? 'dia' : 'dias'}
                                  </span>
                                  <button
                                    disabled={isPending}
                                    onClick={() => { setRetornoId(item.id); setRetornoTexto('') }}
                                    className="rounded-lg bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
                                  >
                                    Registrar retorno do RH
                                  </button>
                                </>
                              ) : (
                                <button
                                  disabled={isPending}
                                  onClick={() => setEncaminharId(item.id)}
                                  className="rounded-lg bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
                                >
                                  Encaminhar ao RH
                                </button>
                              )
                            )}
```

- [ ] **Step 7: `modal-dossie.tsx` — caixa do retorno.** Logo ANTES do bloco `{encerrandoId === item.id && ( ... )}`, adicionar:

```tsx
                        {ehGestao && retornoId === item.id && (
                          <div className="space-y-2 border-t border-gray-50 bg-indigo-50/50 px-4 py-3">
                            <label className="text-xs font-semibold uppercase tracking-widest text-gray-500">
                              Retorno do RH (nota interna, o supervisor não vê)
                            </label>
                            <textarea
                              value={retornoTexto}
                              onChange={e => setRetornoTexto(e.target.value)}
                              rows={4}
                              placeholder="Cole ou resuma a resposta que o RH enviou…"
                              className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400"
                            />
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => { setRetornoId(null); setRetornoTexto('') }}
                                className="h-8 rounded-lg border border-gray-200 px-3 text-xs font-semibold uppercase tracking-widest text-gray-500 hover:bg-gray-50"
                              >
                                Cancelar
                              </button>
                              <button
                                type="button"
                                disabled={isPending || !retornoTexto.trim()}
                                onClick={() => handleRetornoRH(item.id)}
                                className="h-8 rounded-lg bg-indigo-600 px-3 text-xs font-semibold uppercase tracking-widest text-white hover:bg-indigo-700 disabled:opacity-50"
                              >
                                {isPending ? 'Salvando…' : 'Registrar retorno'}
                              </button>
                            </div>
                          </div>
                        )}

```

- [ ] **Step 8: `modal-dossie.tsx` — renderizar o modal de rascunho.** Logo ANTES do bloco `{canWrite && ( <ModalNovaOcorrencia ... /> )}` (perto do fim do JSX), adicionar:

```tsx
              {ehGestao && encaminharId && (
                <ModalEncaminharRH
                  ocorrenciaId={encaminharId.replace('ocorrencia-', '')}
                  onClose={() => setEncaminharId(null)}
                  onEnviado={() => carregar()}
                />
              )}

```

- [ ] **Step 9: Verificar**

Run: `npx tsc --noEmit` — Expected: sem erros.
Run: `npm test` — Expected: tudo passa.
Run: `git diff --stat` e confirme que `modal-dossie.tsx` só ganhou linhas (poucas remoções: os imports/props trocados). Confirme que a linha `Registrado por {item.supervisor_nome}` continua no arquivo.

- [ ] **Step 10: Commit**

```bash
git add components/ocorrencias/conversa-ocorrencia.tsx components/ocorrencias/modal-dossie.tsx components/ocorrencias/ocorrencias-client.tsx "app/(admin)/ocorrencias/page.tsx"
git commit -m "feat(ocorrencias): botões Encaminhar ao RH, selo Com o RH e retorno no dossiê

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 7: Build e verificação manual

**Files:** nenhum.

- [ ] **Step 1: Build**

Run: `npm run build` — Expected: conclui sem erros.

- [ ] **Step 2: Confirmar migração aplicada.** Sem ela, as ocorrências somem do dossiê (a consulta seleciona `com_rh_desde`). Peça ao usuário para confirmar que rodou `20260925_encaminhar_rh.sql` no Supabase Studio.

- [ ] **Step 3: QA manual como admin/coordenador**
1. Dossiê de um funcionário com ocorrência aberta: aparece **Encaminhar ao RH**.
2. Clicar abre o rascunho: "Prezada Coordenadora de RH,", nome, RE, função, posto, relato, histórico, assinatura com o seu nome. Conferir que **não** há CPF, salário, CID nem motivo de atestado.
3. Campo **Para** vem de `RESEND_TO_RH` (se a variável existir). Editar o texto, **Enviar ao RH**.
4. Com o Resend ativo: o e-mail chega, e ao responder a resposta vai para o e-mail do coordenador (Reply-To). Sem o Resend ativo: aparece "Não foi possível enviar o e-mail…" e a ocorrência NÃO vira "Com o RH".
5. Após o envio: selo **Com o RH há 0 dias** e botão **Registrar retorno do RH**. Na **Conversa** aparece a nota interna amarela com o texto enviado.
6. **Registrar retorno do RH** com um texto: o selo some e a nota "Retorno do RH:" aparece na conversa.
7. Encaminhar de novo uma ocorrência já "Com o RH" não é oferecido; encerrar uma ocorrência "Com o RH" (com parecer) limpa o selo.

- [ ] **Step 4: QA manual como supervisor**
1. Abrir o dossiê do mesmo funcionário: **não** aparece "Encaminhar ao RH", selo "Com o RH" nem botão de retorno.
2. Na **Conversa** da ocorrência que está com o RH: as notas internas **não** aparecem, e o número em "Conversa (N)" não conta as notas.

---

## Self-Review

**Cobertura da spec (`2026-09-25-encaminhar-rh-design.md`):**
- Colunas `com_rh_desde`/`com_rh_por`, tipo `nota_interna`, RLS que exclui nota do supervisor → Task 1. ✅
- Filtro de nota interna também no servidor (`getComentarios` e contagem) → Task 4, steps 3 e 5. ✅
- `montarRascunhoRH` com campos explícitos, saudação à Coordenadora de RH, teste de não-vazamento de CPF/salário/CID → Task 2. ✅
- `validarEmails`, `diasComRH` → Task 2. ✅
- `getRascunhoRH` (com `para` de `RESEND_TO_RH`), `encaminharAoRH` (envia primeiro, só marca se enviou, guarda nota com o texto enviado), `registrarRetornoRH` → Task 4, step 7. ✅
- `enviarEmail` com `replyTo` e retorno booleano → Task 3. ✅
- Colunas do rascunho listadas uma a uma (sem cpf/salário/pcd/cid/motivo) → Task 4, `montarDadosRascunhoRH`. ✅
- Interface: botões, selo, retorno, modal de rascunho, nota interna com estilo próprio, `ehGestao` → Tasks 5 e 6. ✅
- Encerrar limpa "Com o RH" → Task 4, step 6. ✅
- Supervisor não vê selo, botão, nota nem contagem → Task 4 (`ehGestao ? ... : null`), Task 6 (botões só com `ehGestao`), Task 1 (RLS). ✅

**Consistência de tipos:** `DadosRascunhoRH` (Task 2) é montado em `montarDadosRascunhoRH` (Task 4) com exatamente os mesmos campos. `RascunhoRH` (Task 4) é consumido em `modal-encaminhar-rh.tsx` (Task 5) por `r.success`/`r.para`/`r.assunto`/`r.corpo`/`r.error`. `TimelineItem.com_rh_desde` (Task 4) é lido como `item.com_rh_desde` no modal (Task 6). `diasComRH` e `corpoParaHtml`/`montarRascunhoRH`/`validarEmails` vêm de `lib/ocorrencias/encaminhar-rh.ts` com esses nomes em todas as tasks.

**Riscos conhecidos, aceitos:** dois cliques simultâneos em "Enviar ao RH" podem enviar dois e-mails (a marcação é condicional, então só uma prevalece); o botão fica desabilitado enquanto envia. O e-mail só chega de verdade depois que o Resend estiver configurado na Vercel.
