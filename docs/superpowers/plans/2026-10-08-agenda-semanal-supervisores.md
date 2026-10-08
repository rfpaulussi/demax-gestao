# Agenda Semanal dos Supervisores (Fase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Execução desta fase: inline.

**Goal:** Supervisor monta/publica agenda semanal (dia × período) com tipo de foco e postos; gestão acompanha e comenta.

**Architecture:** Tabelas `agenda_*` acessadas só via service role nas Server Actions (autorização em código: dono edita, gestão lê). Página Server Component carrega a semana; componentes client fazem mutações via actions + `router.refresh()`.

**Tech Stack:** Next.js 14, Supabase (admin client, sem tipos gerados → cast `AnyClient`), Tailwind, shadcn Dialog, lucide-react.

## Arquivos
- `supabase/migrations/20261011_agenda_semanal.sql` — tabelas, RLS ligado sem policies, seed dos tipos.
- `lib/agenda/datas.ts` — helpers de semana (strings YYYY-MM-DD, UTC-safe).
- `lib/agenda/tema.ts` — paleta de cores dos focos, períodos, dias.
- `app/(admin)/agenda/actions.ts` — queries + mutações.
- `app/(admin)/agenda/page.tsx` — rota (supervisor / gestão).
- `app/(admin)/agenda/tipos/page.tsx` — CRUD dos tipos (admin).
- `components/agenda/*` — `agenda-supervisor.tsx`, `grade-semanal.tsx`, `modal-bloco.tsx`, `resumo-semana.tsx`, `sugestoes.tsx`, `comentarios.tsx`, `visao-geral.tsx`, `tipos-foco-admin.tsx`.
- `components/admin/nav-config.ts`, `sidebar-nav.tsx` — item "Agenda".

## Tasks
1. Migração SQL (aplicar no Supabase Studio).
2. Helpers `datas.ts` e `tema.ts`.
3. `actions.ts`: carregar, salvarBloco, removerBloco, publicar, copiarSemanaAnterior, comentar, visaoGeral, tipos CRUD.
4. Componentes de UI (grade, modal, resumo, sugestões, comentários, visão geral).
5. Páginas `/agenda` e `/agenda/tipos`.
6. Sidebar.
7. `npx tsc --noEmit`, `npm run build`, verificação no preview.
