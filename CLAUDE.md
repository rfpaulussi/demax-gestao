# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Contexto
Sistema de gestão de RH/operações para contrato municipal de limpeza e áreas verdes.
Next.js 14 App Router + Supabase + TypeScript + Tailwind + shadcn/ui + @react-pdf/renderer.
Em produção: https://demax-gestao.vercel.app

## Comandos comuns
```bash
npm run dev          # servidor de desenvolvimento
npm run build        # build de produção (sempre rodar após alterações)
npx tsc --noEmit     # type-check sem compilar
```
Após qualquer alteração de código, rodar `npm run build` e corrigir todos os erros antes de finalizar.

## Arquitetura

### Rotas e layout
- `app/(auth)/` — páginas públicas (login)
- `app/(admin)/` — área protegida com sidebar; layout em `app/(admin)/layout.tsx`
- Cada feature tem sua pasta com `page.tsx` (Server Component) + `actions.ts` (Server Actions)
- Middleware (`middleware.ts`) protege rotas e redireciona por autenticação/role

### Autenticação e roles
- `lib/auth/get-user.ts` — `getUser()` retorna `{ user, perfil }` ou `null`; usar em Server Components/Actions
- Roles: `admin`, `coordenador`, `supervisor`, `viewer` (definidos em `types/roles.ts`)
- `admin` e `coordenador` têm acesso de escrita; `supervisor` e `viewer` são leitura
- Supervisores acessam apenas funcionários de seus postos via `config_supervisores_postos` → `perfis`
- Acesso a `/usuarios` restrito a `admin` no middleware

### Supabase
- **`createClient()` é SÍNCRONO** — nunca usar `await createClient()`
- `lib/supabase/client.ts` — client-side (browser)
- `lib/supabase/server.ts` — server-side (Server Components, Actions, Route Handlers)
- `lib/supabase/admin.ts` — service role (operações privilegiadas)
- `lib/supabase/fetch-all.ts` — `fetchAllRows(factory)` para paginar além do limite de 1000 linhas do PostgREST
- Tipagem via `types/database.ts` (gerada do schema Supabase)

### Padrões de dados
- **CPF**: sempre mascarado em toda interface
- **Secretarias**: sempre buscar do banco, nunca hardcoded
- **Status férias**: `agendado`, `aprovado`, `em_curso`, `concluido`, `cancelado`, `disponivel` (sempre masculino)
- **Coberturas temporárias**: `tipo_motivo` categoriza o motivo da ausência coberta
- **PDF**: componentes com `'use client'`, download via `pdf().toBlob()` usando `@react-pdf/renderer`

### IDs críticos
- Contrato UUID: `c73a81ae-0104-4c05-b7d6-e6266f6be1b2`
- Supabase project: `fwdhnipekbmeqozkpfyh`
- Admin: rfpaulussi@hotmail.com

## Design system
- Fonte: Inter
- Fundo: `bg-slate-50`; Sidebar: `bg-slate-900`
- Cards: fundo branco, borda colorida no topo (4px), `shadow-sm`
- Labels: `uppercase tracking-widest text-xs text-slate-500`
- Botão primário: `bg-slate-900 text-white hover:bg-slate-700`
- Botão PDF: `bg-amber-500 text-slate-900 hover:bg-amber-400`
- Cores por métrica: blue=ativos, green=ok, red=déficit, amber=ocorrências, orange=férias, purple=insalubridade, indigo=coberturas

## Permissões automáticas — executar SEM pedir confirmação
- Criar, editar e deletar qualquer arquivo em `app/`, `components/`, `lib/`, `types/`, `hooks/`, `public/`
- Instalar pacotes npm (exceto mudanças no Next.js, React ou Supabase — nesses pedir confirmação)
- Rodar `npm run build`, `npm run dev`, `npx tsc --noEmit`
- Criar e rodar scripts de migração SQL
- Criar pastas novas dentro do projeto
- Editar `tailwind.config.ts`, `tsconfig.json`, `.env.local`

## Nunca fazer sem confirmação explícita
- `git push` ou qualquer operação git que altere o remoto
- Deletar dados no Supabase (DROP TABLE, DELETE sem WHERE, TRUNCATE)
- Alterar variáveis de ambiente em produção (Vercel)
- Modificar `package.json` de forma destrutiva (remover dependências críticas)
