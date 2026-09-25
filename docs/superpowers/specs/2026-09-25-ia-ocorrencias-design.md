# Assistente de IA para ocorrências (fase 2 do fluxo de devolutiva)

## Contexto

Depende da fase 1 (`2026-09-25-encaminhar-rh-design.md`: encaminhar ao RH, nota interna, "Com o RH"). O coordenador quer que uma IA leia a ocorrência que o supervisor emitiu, analise, sugira a resolução, indique quando encaminhar ao RH, e depois ajude a redigir a devolutiva ao supervisor. Tudo passa por aprovação do coordenador/admin.

O projeto já tem infraestrutura de IA (módulo de acordos): SDK `@anthropic-ai/sdk`, `ANTHROPIC_API_KEY`, `lib/acordos/ia/cliente.ts` (`chamarFerramenta`, `ErroIA`), `anonimizarPedido` (tira CPF, e-mail, telefone e troca nomes de funcionários por `FUNC_n`) e limite de uso por usuário em memória. Esta fase reaproveita esses pedaços.

## Objetivo

Botão "Analisar com IA" por ocorrência, que devolve categoria, urgência, resumo, resolução sugerida, se deve ir ao RH (com motivo), rascunho da devolutiva ao supervisor e rascunho do e-mail ao RH. O coordenador edita e **aprova ou reprova**. Nada sai, muda de status nem é escrito ao supervisor sem aprovação.

## Escopo

Inclui:
- Análise sob demanda (botão manual), com prévia do texto exato que vai à API.
- Auditoria completa de cada chamada e da decisão.
- Aprovação da devolutiva (posta na conversa) e do encaminhamento ao RH (abre o modal da fase 1 preenchido).
- Segunda chamada: rascunhar a devolutiva ao supervisor a partir da resposta do RH.

Fora de escopo:
- Rodar automaticamente em toda ocorrência nova.
- Enviar o dossiê completo, histórico detalhado ou nomes à IA.
- A IA mudar status, encerrar ou escrever ao supervisor sem aprovação.
- Aprendizado com decisões anteriores.

## Regra de dados enviados à API (decidida com o usuário)

**Vai:** texto da ocorrência **anonimizado**; função; data e gravidade; contagens do histórico ("2 advertências, 19 dias de atestado em 12 meses, 1 falta"); na 2ª chamada, o texto do retorno do RH também anonimizado.

**Nunca vai:** nome, RE, posto, CPF, salário, PCD, CID e motivo do atestado, conversa, notas internas.

Anonimização: `anonimizarPedido` com a lista de nomes de **funcionários e de supervisores** (perfis com role supervisor), para mascarar também os nomes de quem registra. Limite conhecido, que a tela avisa: nomes de terceiros no texto livre ("a diretora Fulana", "a filha") não são detectados. Por isso o envio é manual, com prévia.

## Modelo de dados

```sql
CREATE TABLE ocorrencia_analises_ia (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  ocorrencia_id   uuid        NOT NULL REFERENCES ocorrencias(id) ON DELETE CASCADE,
  tipo            text        NOT NULL DEFAULT 'analise' CHECK (tipo IN ('analise', 'devolutiva_retorno')),
  solicitada_por  uuid        NOT NULL REFERENCES perfis(id),
  modelo          text        NOT NULL,
  tokens_entrada  integer     NOT NULL DEFAULT 0,
  tokens_saida    integer     NOT NULL DEFAULT 0,
  texto_enviado   text        NOT NULL,          -- exatamente o que foi à API (já anonimizado)
  mapa            jsonb       NOT NULL DEFAULT '{}'::jsonb,  -- FUNC_n -> nome real, só no servidor
  resultado       jsonb       NOT NULL,
  decisao         text        NOT NULL DEFAULT 'pendente' CHECK (decisao IN ('pendente', 'aprovada', 'reprovada')),
  decidida_por    uuid        REFERENCES perfis(id),
  decidida_em     timestamptz,
  motivo          text
);
CREATE INDEX idx_ocorrencia_analises_ia_ocorrencia ON ocorrencia_analises_ia(ocorrencia_id, created_at DESC);
ALTER TABLE ocorrencia_analises_ia ENABLE ROW LEVEL SECURITY;
CREATE POLICY ocorrencia_analises_ia_admin_all ON ocorrencia_analises_ia
  FOR ALL TO authenticated USING (is_admin_or_coord()) WITH CHECK (is_admin_or_coord());
-- supervisor e viewer: sem policy = sem acesso
```

## Módulo `lib/ocorrencias/ia/` (testes Vitest nas partes puras)

- `contexto.ts`: `montarContexto(dados)` recebe campos explícitos (texto, função, data, gravidade, contagens) e monta a mensagem ao modelo. Teste garante que só esses campos entram.
- `anonimizar.ts`: `anonimizarOcorrencia(texto, pessoas)` chama `anonimizarPedido` e devolve `{ texto, mapa }`; `restaurarNomes(texto, mapa)` troca `FUNC_n` pelos nomes reais (usado só no servidor, ao devolver rascunhos ao coordenador).
- `schema.ts`: ferramenta `analisar_ocorrencia` com campos `categoria` (saude | conduta | desempenho | seguranca | relacionamento | outro), `urgencia` (baixa | media | alta), `resumo`, `resolucao_sugerida` (lista de passos), `encaminhar_rh` (boolean), `motivo_rh`, `devolutiva_supervisor` (rascunho), `email_rh` (rascunho, vazio se não encaminhar), `alertas` (lista, ex.: "cita menor de idade", "dado de saúde de terceiro"). `lerAnalise(entrada)` valida o retorno e descarta o que estiver fora do formato.
- `prompt.ts`: instruções de sistema em português. A IA é assistente de RH de uma empresa de limpeza urbana com contrato municipal; sugere, não decide; não inventa fatos; não emite juízo sobre saúde; trata `FUNC_n` como pessoas sem tentar identificá-las; linguagem respeitosa; responde só pela ferramenta.
- `lib/acordos/ia/cliente.ts`: `chamarFerramenta` ganha um 4º parâmetro opcional `{ modelo?, maxTokens? }` (hoje fixa `ANTHROPIC_MODEL_ACORDOS` e 1024). Sem o parâmetro, o comportamento dos acordos não muda.
- Modelo padrão: `process.env.ANTHROPIC_MODEL_OCORRENCIAS ?? 'claude-sonnet-5'` (julgamento, não extração), `maxTokens` 2000.

## Server Actions (`app/(admin)/ocorrencias/ia-actions.ts`)

Todas exigem admin ou coordenador. `'use server'`.

- `previaAnalise(ocorrenciaId)`: monta o texto anonimizado e o contexto e devolve **o que será enviado**, sem chamar a API. É a tela de confirmação.
- `analisarOcorrencia(ocorrenciaId)`: refaz a prévia no servidor (nunca confia no cliente), aplica o limite (20 chamadas por usuário em 10 min), chama a API, valida com `lerAnalise`, grava a linha em `ocorrencia_analises_ia` e devolve o resultado com os nomes restaurados. Sem `ANTHROPIC_API_KEY`, devolve erro claro.
- `rascunharDevolutivaRetorno(ocorrenciaId, respostaRH)`: anonimiza a resposta do RH, chama a API com a ferramenta de devolutiva e grava com `tipo = 'devolutiva_retorno'`.
- `decidirAnalise(analiseId, { decisao, devolutivaEditada?, motivo? })`:
  - `reprovada`: grava decisão e motivo; nada mais acontece.
  - `aprovada` com `devolutivaEditada`: posta como mensagem na conversa em nome do coordenador (mesmo caminho de `comentarOcorrencia`, com notificação ao supervisor). O texto postado é o **editado pelo coordenador**, não o bruto da IA.
  - A aprovação do encaminhamento ao RH abre o modal da fase 1 com o rascunho da IA (nomes restaurados) e não envia nada sozinha.

## Interface

- No dossiê, para `ehGestao`, em ocorrência aberta/em análise: botão **Analisar com IA**.
- Passo 1, prévia: mostra o texto exato que vai à API e o aviso do limite da anonimização. Botões "Enviar para análise" e "Cancelar".
- Passo 2, resultado (`painel-analise-ia.tsx`): categoria e urgência como selos, resumo, resolução em passos, "Encaminhar ao RH: sim/não" com o motivo, alertas em destaque, e dois campos editáveis (devolutiva ao supervisor; e-mail ao RH quando aplicável). Botões: **Aprovar devolutiva**, **Encaminhar ao RH** (abre o modal da fase 1) e **Reprovar** (pede motivo).
- Faixa fixa: "Sugestão da IA. A decisão é sua."
- Quando a ocorrência está "Com o RH", aparece **Rascunhar devolutiva do retorno** (campo para colar a resposta do RH).
- Histórico das análises da ocorrência (data, decisão) visível só à gestão.

## Permissões e custo

Só admin e coordenador veem qualquer coisa de IA. Supervisor e viewer não têm botão, tabela nem contagem. Custo por chamada aparece na tela em ordem de grandeza (tokens), como já faz o laboratório de acordos.

## Testes / verificação

- Vitest: `montarContexto` (só campos permitidos; nunca CPF, RE, nome), `anonimizarOcorrencia`/`restaurarNomes` (ida e volta, inclusive supervisores), `lerAnalise` (aceita válido, rejeita categoria fora da lista, limita tamanhos), e o comportamento do `chamarFerramenta` com o parâmetro novo sem alterar os testes de acordos.
- `npx tsc --noEmit` e `npm run build` limpos.
- Migração aplicada no Supabase Studio.
- QA manual: prévia mostra o texto anonimizado (sem CPF, nome, RE); resultado aparece; reprovar não envia nada; aprovar devolutiva chega ao supervisor com o texto editado; sem `ANTHROPIC_API_KEY` mostra erro claro; supervisor não vê nada de IA; chamada aparece em `ocorrencia_analises_ia`.
