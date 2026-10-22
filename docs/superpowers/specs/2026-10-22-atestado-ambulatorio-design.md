# Encaminhamento do atestado ao ambulatório — desenho

Data: 2026-10-22 · Status: aprovado pelo usuário (chat de 22/10)

## Objetivo
Hoje o supervisor lança o atestado no sistema e ainda posta o papel no grupo de WhatsApp do ambulatório. O sistema passa a enviar o atestado (foto/PDF) por e-mail ao ambulatório, no mesmo gesto do lançamento.

## Decisões
- **Destino:** e-mail via Resend, com o arquivo em anexo. Endereço em `RESEND_TO_AMBULATORIO` (vírgula separa vários). Valor de produção: `rute@demax.com.br`.
- **Só produção envia ao ambulatório.** Em preview e no dev local (`VERCEL_ENV` diferente de `production`) o e-mail vai para o e-mail de quem está logado, com `[TESTE]` no assunto e aviso no corpo. Assim nenhum teste chega à Rute e não é preciso variável de teste na Vercel.
- **Remetente:** `RESEND_FROM_EMAIL` (já em produção e preview, domínio demax.com.br verificado).
- **Arquivo não é guardado:** vive só em memória durante o envio. Banco guarda apenas quando e por quem foi enviado.
- **E-mail sem CPF e sem CID** (o CID já está no papel). Dados vêm do banco, nunca do cliente.
- **Variável ausente:** o recurso inteiro some (sem campo de anexo, sem botão, sem selo); o lançamento segue como hoje.
- **Fora do escopo:** Google Drive, guardar o arquivo no sistema, automação de WhatsApp.

## Fluxo
1. **Registrar Atestado** (Efetivo) ganha o campo "Anexar atestado" (foto/PDF, opcional). No **Lançar por foto** o arquivo já vem anexado.
2. Salvar = `registrarAtestado` como hoje; agora devolve o `id` do atestado.
3. Com arquivo, o navegador envia `POST /api/atestados/encaminhar` (multipart: `arquivo`, `atestadoId`). Imagem é reduzida antes (mesma `prepararArquivo` da leitura por foto).
4. Falha no envio: o atestado já está salvo; o modal mostra o erro e "Tentar de novo" (arquivo ainda na memória do navegador) ou "Fechar".
5. **Lista de Atestados:** coluna "Ambulatório" com selo "Enviado dd/mm hh:mm" ou "Não enviado" + botão "Enviar" (pede o arquivo na hora). Cobre atestados antigos e os lançados sem anexo. Reenviar é permitido e atualiza a data.

## Rota `POST /api/atestados/encaminhar`
- Login obrigatório; viewer recebe 403.
- Sem destinatário configurado: 503.
- Arquivo: JPG, PNG, WEBP ou PDF, até 4 MB (limite do corpo da Vercel é ~4,5 MB).
- Acesso: admin/coordenador qualquer atestado; supervisor só de posto vinculado e ativo em `config_supervisores_postos` (mesma regra de `verificarAcessoAtestado`).
- Monta o e-mail com dados lidos do banco (admin client), envia, e só então grava `ambulatorio_enviado_em` e `ambulatorio_enviado_por`.
- Resposta JSON `{ ok: true, enviadoEm }` ou `{ ok: false, erro }`. Log só com ids e resultado.

## E-mail
- Assunto: `Atestado – NOME – POSTO – dd/mm a dd/mm/aaaa`.
- Corpo: nome, registro (RE), posto, secretaria, lançado por, início, fim e dias. Texto escapado (sem HTML injetado por nome ou posto). Anexo com o nome `atestado-<nome>.<ext>` sem acento.
- Função pura `montarEmailAmbulatorio` com testes (assunto, corpo, escape, ausência de CPF/CID).

## Dados
Migration `20261028_atestado_ambulatorio.sql`:
```sql
ALTER TABLE atestados
  ADD COLUMN IF NOT EXISTS ambulatorio_enviado_em  timestamptz,
  ADD COLUMN IF NOT EXISTS ambulatorio_enviado_por uuid REFERENCES perfis(id);
```
Aplicada pelo usuário no Supabase Studio **antes** do deploy (o código da lista lê as colunas novas).

## Peças
| Peça | Função |
|---|---|
| `supabase/migrations/20261028_atestado_ambulatorio.sql` | Duas colunas |
| `lib/atestados/ambulatorio/destinatarios.ts` (+ teste) | Lê e valida `RESEND_TO_AMBULATORIO` |
| `lib/atestados/ambulatorio/email.ts` (+ teste) | Monta assunto, HTML e nome do anexo |
| `lib/atestados/ambulatorio/enviar-cliente.ts` | `fetch` da rota no navegador; trata sessão expirada e 413 |
| `lib/email.ts` | `enviarEmail` aceita `attachments` |
| `app/api/atestados/encaminhar/route.ts` | A rota acima |
| `app/(admin)/efetivo/actions.ts` | `registrarAtestado` devolve `{ id }` |
| `app/(admin)/atestados/actions.ts` | `registrarAtestadoComRetorno` devolve `atestadoId`; `ambulatorioAtivo()` |
| `components/efetivo/modal-atestado.tsx` | Campo de anexo, envio após salvar, tela de sucesso/erro |
| `components/atestados/atestado-por-foto.tsx` | Guarda o arquivo reduzido e passa ao modal |
| `app/(admin)/atestados/page.tsx`, `components/atestados/atestados-client.tsx` | Coluna, selo, botão e diálogo de envio |
