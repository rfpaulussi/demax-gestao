# Devolutiva por ocorrência (thread RH ↔ supervisor)

## Contexto

Este é o subprojeto 1 de 4 da evolução do dossiê do funcionário (ordem: 1 devolutiva → 2 confidencial + robustez → 3 índice de atenção → 4 IA). Cada um tem spec e plano próprios.

Caso real (PDF `dossie_RAIMUNDA_DEUZIENE_CIDRONE_DA_SILVA_2026-09-24`): o supervisor registrou uma ocorrência pedindo apoio do RH e do Ambulatório e o sistema não tem onde o RH responder. Resultado: 3 ocorrências abertas sem devolutiva e o texto da ocorrência de 09/09 copiado dentro da de 17/09, porque a ocorrência não pode ser complementada nem comentada.

## Objetivo

Cada ocorrência (`ocorrencias.tipo = 'ocorrencia'`) ganha uma conversa em ordem cronológica entre RH (admin/coordenador) e supervisor, com aviso no sino e por e-mail, e encerramento com parecer obrigatório.

## Escopo

Inclui:
- Tabela `ocorrencia_comentarios` + RLS.
- Thread por ocorrência dentro do modal do dossiê.
- Parecer obrigatório ao encerrar.
- Avisos: sino do supervisor, sino do admin e e-mail.
- Abrir o dossiê direto pelo link do aviso (`/ocorrencias?f=<funcionario_id>`).

Fora de escopo (ficam para depois, se fizer falta):
- Responsável, prazo e SLA da ocorrência.
- Anexos, menção (@), edição ou exclusão de mensagem.
- Thread em advertência, atestado ou falta (seguem só leitura na timeline).
- Visibilidade confidencial da ocorrência (subprojeto 2). Quando existir, a conversa herda a visibilidade da ocorrência.

## Modelo de dados

```sql
CREATE TABLE ocorrencia_comentarios (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  ocorrencia_id uuid        NOT NULL REFERENCES ocorrencias(id) ON DELETE CASCADE,
  autor_id      uuid        NOT NULL REFERENCES perfis(id),
  texto         text        NOT NULL CHECK (length(btrim(texto)) > 0),
  tipo          text        NOT NULL DEFAULT 'mensagem' CHECK (tipo IN ('mensagem', 'parecer'))
);
CREATE INDEX idx_ocorrencia_comentarios_ocorrencia ON ocorrencia_comentarios(ocorrencia_id, created_at);
ALTER TABLE ocorrencia_comentarios ENABLE ROW LEVEL SECURITY;
```

- Mensagem não edita nem apaga (registro de RH, auditável). Sem policy de UPDATE/DELETE. `ON DELETE CASCADE` só vale se a própria ocorrência for removida.
- `tipo = 'parecer'` marca a mensagem escrita ao encerrar.

**RLS** (helpers já existentes em `002_rls.sql`: `is_admin_or_coord()`, `is_supervisor()`, `get_supervisor_posto_ids()`):
- `admin_all`: `FOR ALL` para `is_admin_or_coord()`.
- `supervisor_select`: `is_supervisor()` e a ocorrência pertence a um posto do supervisor. Regra de posto idêntica à de `ocorrencias_supervisor_select`: `o.posto_id IN (SELECT get_supervisor_posto_ids())` ou `o.funcionario_id` de um funcionário desses postos.
- `supervisor_insert`: mesma condição, mais `autor_id = auth.uid()`.
- Viewer: sem acesso à conversa (conversa é canal privado RH ↔ supervisor).

## Server Actions (`app/(admin)/ocorrencias/actions.ts`)

- `getComentarios(ocorrenciaId): Promise<ComentarioRow[]>` — carregado ao expandir a conversa. Devolve `{ id, autor_nome, autor_role, texto, tipo, created_at }`, ordem crescente.
- `comentarOcorrencia(ocorrenciaId, texto): Promise<ActionResult>` — valida sessão, viewer barrado, supervisor só na ocorrência do seu posto (mesma checagem de `updateStatusOcorrencia`). Insere com o admin client e dispara as notificações (abaixo).
- `updateStatusOcorrencia` — ao encerrar (`status = 'encerrada'`), exige `parecer` não vazio: grava o comentário `tipo = 'parecer'` e muda o status na mesma action. Sem parecer, retorna erro.
- `getDossieFuncionario` — passa a devolver `comentarios: number` por item de ocorrência na timeline, para o "Conversa (N)".

## Notificações

**RH comenta ou encerra → supervisor.**
- Destinatários: supervisores ativos do posto da ocorrência (`config_supervisores_postos`, `ativo = true`) e o `supervisor_id` da ocorrência, sem duplicar.
- Sino: insere em `alertas_supervisor` (`tipo = 'ocorrencia_devolutiva'`, `titulo = 'Nova devolutiva em ocorrência'`, `detalhes = JSON {funcionario_id, funcionario_nome}`). Inserção via admin client (a tabela só tem policy de SELECT/UPDATE).
- E-mail: `enviarEmail` de `lib/email.ts` para o e-mail de cada supervisor (Supabase Auth).

**Supervisor comenta → RH.**
- Sino: `logSupervisorAcao` com `tipo = 'ocorrencia'`, `acao = 'respondeu'`, `funcionarioNome`, `detalhes = JSON {funcionario_id}`. Amplia `TipoModulo` e `TipoOp` em `lib/log-supervisor.ts`.
- E-mail: `buscarEmailsAdmins()`.

**Privacidade.** O e-mail NÃO leva o texto da mensagem. Conteúdo: "Nova devolutiva no dossiê de {nome}" + link `https://demax-gestao.vercel.app/ocorrencias?f={funcionario_id}` + botão "Acessar o sistema". Motivo: as ocorrências têm dado de saúde e de vida pessoal (LGPD), que devem ficar atrás de login. Template novo `templateDevolutivaOcorrencia` em `lib/email.ts`, no mesmo padrão dos existentes.

**Falha de e-mail nunca quebra a ação.** `enviarEmail` já engole erro e sem `RESEND_API_KEY` só registra aviso. A mensagem é gravada antes do envio.

## Interface

- `modal-dossie.tsx`: cada item de ocorrência mostra "Conversa (N)". Ao clicar, expande a thread (novo componente `components/ocorrencias/conversa-ocorrencia.tsx`): lista de mensagens (autor, papel, data/hora, texto; parecer com selo "Parecer") e caixa "Responder" com botão Enviar. Carrega com `getComentarios` só ao expandir.
- Botão "Encerrar": abre um campo obrigatório "Parecer" antes de confirmar.
- Sino do supervisor (`supervisor-bell.tsx`) e do admin (`notificacoes-bell.tsx`): o item de tipo `ocorrencia_devolutiva` / `ocorrencia` vira link para `/ocorrencias?f=<funcionario_id>` (mesmo padrão de `renderConteudo`, que já lê `detalhes` em JSON).
- `ocorrencias-client.tsx`: lê `?f=` e abre o dossiê desse funcionário ao carregar. `page.tsx` repassa o parâmetro.

## Permissões

- Admin/coordenador: lê e escreve em qualquer ocorrência.
- Supervisor: só nas ocorrências dos seus postos; pode comentar e encerrar (mantém o comportamento atual de `updateStatusOcorrencia`, agora com parecer).
- Viewer: vê a ocorrência na timeline como hoje, sem acesso à conversa e sem botão de responder.

## Testes / verificação

- `npm run build` e `npx tsc --noEmit` limpos.
- Migração revisada e aplicada no Supabase Studio (o MCP da sessão aponta para outro projeto).
- QA manual: admin comenta, supervisor vê o aviso no sino e recebe o e-mail (sem texto da mensagem); supervisor responde, admin vê o aviso; encerrar sem parecer é bloqueado; supervisor de outro posto não vê a conversa; viewer não vê a conversa; link do aviso abre o dossiê certo.
