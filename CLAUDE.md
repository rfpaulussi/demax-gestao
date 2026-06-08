# Demax Gestão — Instruções do Projeto

## Contexto
Sistema de gestão de RH/operações para contrato municipal de limpeza e áreas verdes.
Next.js 14 App Router + Supabase + TypeScript + Tailwind + shadcn/ui + @react-pdf/renderer.
Em produção: https://demax-gestao.vercel.app

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

## Stack e padrões
- **Supabase client**: `createClient()` é SÍNCRONO neste projeto — nunca usar `await`
- **Status férias**: sempre masculino — `agendado`, `aprovado`, `em_curso`, `concluido`, `cancelado`, `disponivel`
- **CPF**: sempre mascarado em toda interface
- **Secretarias**: sempre buscar do banco, nunca hardcoded
- **Supervisor → funcionário**: relação via `config_supervisores_postos` → `perfis`, não campo direto
- **PDF**: usar `@react-pdf/renderer`, componentes com `'use client'`, download via `pdf().toBlob()`
- **TypeScript**: após qualquer alteração rodar `npm run build` e corrigir todos os erros antes de finalizar

## Design system
- Fonte: Inter
- Fundo: bg-slate-50
- Sidebar: bg-slate-900
- Cards: fundo branco, borda colorida no topo (4px), shadow-sm
- Labels: uppercase tracking-widest text-xs text-slate-500
- Botão primário: bg-slate-900 text-white hover:bg-slate-700
- Botão PDF: bg-amber-500 text-slate-900 hover:bg-amber-400
- Cores por métrica: blue=ativos, green=ok, red=déficit, amber=ocorrências, orange=férias, purple=insalubridade, indigo=coberturas

## IDs críticos
- Contrato UUID: c73a81ae-0104-4c05-b7d6-e6266f6be1b2
- Supabase project: fwdhnipekbmeqozkpfyh
- Admin: rfpaulussi@hotmail.com
