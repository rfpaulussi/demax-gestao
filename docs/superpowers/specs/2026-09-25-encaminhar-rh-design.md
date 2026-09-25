# Encaminhar ocorrência ao RH (fase 1 do fluxo de devolutiva)

## Contexto

Subprojeto 1b da evolução do dossiê (depois da devolutiva supervisor ↔ gestão, já em produção). A logística real: o supervisor emite a ocorrência, o coordenador/admin decide o caminho. Pode responder direto ao supervisor, ou encaminhar ao RH, receber a resposta do RH e só então devolver ao supervisor.

O RH **não tem login** no sistema (só admin, coordenador e supervisor têm). Então o RH responde fora do sistema, por e-mail, e o coordenador registra a resposta aqui.

A fase 2 (assistente de IA) está em `2026-09-25-ia-ocorrencias-design.md` e usa esta fase como base.

## Objetivo

O coordenador/admin encaminha uma ocorrência ao RH por e-mail a partir do dossiê, com um rascunho já preenchido e editável, acompanha "Com o RH há N dias", registra o retorno do RH e mantém tudo isso invisível ao supervisor (nota interna).

## Escopo

Inclui:
- Botão "Encaminhar ao RH" com rascunho de e-mail editável, e envio pelo Resend com Reply-To no e-mail do coordenador.
- Estado "Com o RH" (desde quando, por quem) e botão "Registrar retorno do RH".
- Tipo de mensagem `nota_interna`, visível só a admin/coordenador.

Fora de escopo:
- IA (fase 2).
- Login ou perfil para o RH; resposta do RH dentro do sistema.
- Filtro ou card de "ocorrências com o RH" no painel (pode entrar depois).
- Notificar supervisor sobre o encaminhamento (o supervisor não fica sabendo do que é interno).

## Regra de dados no e-mail ao RH (decidida com o usuário)

Vão: nome, RE, posto e secretaria, função, data e gravidade da ocorrência, nome do supervisor que registrou, texto da ocorrência, e resumo do histórico (advertências com grau/natureza/data; dias e datas de atestado; faltas com tipo e dias).

**Nunca vão:** CPF, salário, PCD, CID e motivo do atestado, conversa com o supervisor, notas internas.

Esta é a exceção consciente à regra "e-mail sem conteúdo" da devolutiva: o RH não tem login, o texto é revisado e enviado pelo coordenador, e o destinatário é um endereço configurado.

## Modelo de dados

```sql
ALTER TABLE ocorrencias
  ADD COLUMN IF NOT EXISTS com_rh_desde timestamptz,
  ADD COLUMN IF NOT EXISTS com_rh_por   uuid REFERENCES perfis(id);

ALTER TABLE ocorrencia_comentarios DROP CONSTRAINT ocorrencia_comentarios_tipo_check;
ALTER TABLE ocorrencia_comentarios ADD CONSTRAINT ocorrencia_comentarios_tipo_check
  CHECK (tipo IN ('mensagem', 'parecer', 'nota_interna'));
```

`com_rh_desde IS NOT NULL` significa "está com o RH".

RLS: a policy `ocorrencia_comentarios_supervisor_select` é recriada com `AND tipo <> 'nota_interna'`. A policy de INSERT do supervisor continua só `tipo = 'mensagem'`.

Além do RLS, o servidor filtra: para supervisor, `getComentarios` usa `.neq('tipo','nota_interna')` e a contagem da timeline também exclui notas. O supervisor não vê nem quantas notas existem.

## Regras puras (`lib/ocorrencias/encaminhar-rh.ts`, com testes Vitest)

- `montarRascunhoRH(dados): { assunto, corpo }` abre com "Prezada Coordenadora de RH," (a destinatária é a Coordenadora de RH; o cargo fica no texto, o nome não é fixado no código) e recebe **campos explícitos** (sem objeto de funcionário inteiro, pra CPF/salário/PCD não passarem por acidente) e devolve texto pronto em português.
- `validarEmails(lista): { ok, emails } | { ok: false, error }`.
- `diasComRH(desde: string, hoje: Date): number`.

Testes cobrem: o corpo nunca contém o valor de um CPF passado por engano; contém RE, posto, texto da ocorrência e histórico; e-mails inválidos são recusados; contagem de dias.

## Server Actions (`app/(admin)/ocorrencias/actions.ts`)

Todas exigem `admin` ou `coordenador` (supervisor e viewer recebem "Sem permissão").

- `getRascunhoRH(ocorrenciaId)`: carrega ocorrência, funcionário e histórico e devolve `{ para, assunto, corpo }`. `para` vem de `process.env.RESEND_TO_RH ?? ''` e o coordenador pode trocá-lo no modal antes de enviar. Endereço do RH definido pelo usuário: `marcialima@demax.com.br`. Fica só na variável de ambiente (nunca no código): `.env.local` agora, e a variável `RESEND_TO_RH` na Vercel é passo manual do usuário. Sem a variável, o campo "Para" vem vazio e precisa ser digitado.
- `encaminharAoRH(ocorrenciaId, { para, assunto, corpo })`: só se a ocorrência é `tipo='ocorrencia'`, não está encerrada e ainda não está com o RH. Envia o e-mail e **só se o envio for confirmado** marca `com_rh_desde = now()`, `com_rh_por` e grava uma nota interna com o texto enviado e o destinatário. Se o envio falhar, nada muda e o coordenador vê o erro.
- `registrarRetornoRH(ocorrenciaId, texto)`: grava nota interna "Retorno do RH: …" e limpa `com_rh_desde` e `com_rh_por`.

`lib/email.ts`: `enviarEmail` passa a aceitar `replyTo?: string` e a devolver `Promise<boolean>` (true se enviado). Chamadas existentes continuam válidas, porque ignoram o retorno.

## Interface

- `page.tsx` passa `ehGestao` (admin ou coordenador) além de `canWrite`; `ocorrencias-client.tsx` repassa ao `ModalDossie`.
- `modal-dossie.tsx`, só para `ehGestao` e só em ocorrência aberta/em análise:
  - sem `com_rh_desde`: botão **Encaminhar ao RH**, que abre o modal de rascunho (novo `modal-encaminhar-rh.tsx`: Para, Assunto, Corpo, aviso do que não vai, botão Enviar);
  - com `com_rh_desde`: selo **"Com o RH há N dias"** e botão **Registrar retorno do RH** (campo de texto).
- A conversa (`conversa-ocorrencia.tsx`) mostra `nota_interna` com estilo próprio e a etiqueta "Nota interna (só gestão)". O item de timeline ganha `com_rh_desde`.
- O supervisor não vê selo, botão nem notas.

## Permissões

Admin e coordenador: tudo. Supervisor: nada novo e nada visível. Viewer: nada.

## Testes / verificação

- `npm test`, `npx tsc --noEmit` e `npm run build` limpos.
- Migração aplicada no Supabase Studio (o MCP da sessão aponta para outro projeto).
- QA manual: encaminhar com rascunho (conferir que não há CPF, salário, PCD, CID); e-mail chega ao RH e a resposta do RH cai no e-mail do coordenador (Reply-To); selo aparece e some ao registrar retorno; supervisor não vê nota, selo nem contagem; envio falho (chave inválida) não marca "Com o RH".
