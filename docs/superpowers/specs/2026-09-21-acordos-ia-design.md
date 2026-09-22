# Acordos de Compensação com IA + Calendário de Mogi — Design

Data: 2026-09-21 · Status: **PROPOSTA — aguardando aprovação; nenhum código alterado**

Documento complementar: `2026-09-21-acordos-templates-rascunho.md` (textos).

## 1. Problema

Supervisores quase não usam o módulo `/acordos`. Causas confirmadas no código:

| # | Causa | Local |
|---|---|---|
| 1 | Horário nasce fixo 07:00–12:00/13:12–17:00; turno real do funcionário (já buscado) é ignorado | `modal-novo-acordo.tsx:41-49`, `actions.ts:200-217` |
| 2 | 7 dias × 4 selects por turno, contador só entende 44h | `modal-novo-acordo.tsx:423` |
| 3 | Regime/escala ignorados | `lib/turnos/escala.ts` não é usado |
| 4 | Texto com `[PLACEHOLDERS]` editados à mão; nada impede salvar com placeholder | `handleSalvar` |
| 5 | Dados do evento (data, horas, datas de compensação) só existem como texto livre | `descricao_acordo` |
| 6 | `criado_por` nunca gravado → coluna "Criado por" sempre "—" | `criarAcordo`, `actions.ts:139-151` |
| 7 | Fluxo de 3 passos para achar funcionários (posto → carregar → marcar) | modal |
| 8 | Sem status "assinado"; só flag `entregue_rh` | migrations |

## 2. Decisões já tomadas

- IA disponível (API Anthropic, baixo volume). Chave nova dedicada ao projeto, com limite de gasto.
- Texto do PDF segue o padrão da empresa; só o parágrafo do objeto varia.
- **12x36 e Jovem Aprendiz ficam fora do acordo** (aprendiz: art. 432 CLT veda compensação).
- Entrada por voz na Fase 1.
- Implantar calendário de feriados de Mogi das Cruzes.
- Regra de direção: trabalhou a mais → descansa (redução/folga); não trabalhou → compensa (acréscimo). O validador segue isso; T1 foi corrigido para redução.
- Cláusula de prazo entra no T4, e o sistema mantém um **controle próprio de saldo e prazo** numa aba do módulo (seção 6-A).
- Pontos facultativos: a Prefeitura emenda em ~95% dos casos. Esse é o caso dominante e ganha fluxo dedicado (seção 6-B).

## 3. Princípio

IA interpreta o pedido; código calcula e escreve; humano confirma.

```
texto/voz → IA (extrai JSON) → resolver posto/funcionários no banco → motor determinístico
         → validador → tela de revisão (campos incertos destacados) → salvar → PDF
```

- A IA **não** escreve texto do documento e **não** salva nada.
- A IA devolve nomes como texto; o **código** casa com o banco (busca normalizada). Nenhum dado de funcionário vai para a API, CPF nunca.

## 4. Fases

| Fase | Entrega | Depende de IA |
|---|---|---|
| 0 | Correções e base estruturada: horário do turno real, filtro de escala, livro de movimentos, templates T1–T5, validador, `criado_por`, calendário de Mogi | Não |
| 1a | **Emenda em 1 clique** a partir do calendário (seção 6-B) | Não |
| 1b | Caixa "descreva o acordo" (texto + voz), lab dry-run no Vercel Preview | Sim |
| 2 | Aba **Controle** (saldo, prazo, cumprimento) + status rascunho→gerado→assinado→entregue + upload do assinado | Não |
| 3 (futuro) | Acordos em lote; aviso proativo em pendências | Sim/Não |

Fase 0 tem valor sozinha e é pré-requisito das demais. A 1a vem antes da IA porque cobre ~95% dos casos sem depender dela.

## 5. Calendário de Mogi das Cruzes

### 5.1 Achados

O sistema já tem `feriadosDoAno()` em `lib/utils/dias-uteis.ts`, usado por coberturas (e possivelmente férias/fechamento). Comparado à fonte oficial pesquisada (calendário administrativo da Prefeitura, Decreto 24.034/2025; Lei Municipal 3.433/89), há divergências:

| Item no código | Situação |
|---|---|
| 25/01 "Aniv. São Paulo" tratado como feriado | Não é feriado de Mogi |
| 26/06 "Aniv. de Mogi" | Não consta na lista oficial; o aniversário é 01/09 (também presente) |
| Segunda e terça de Carnaval, Corpus Christi tratados como feriado | Na lista oficial 2026 são **ponto facultativo** (16/02, 17/02, 18/02 até 13h, 05/06) |
| Ausente: nada relevante | Sexta-Feira Santa, Sant'Ana, 01/09, 20/11 presentes |

**Não vou alterar `feriadosDoAno()`**: mexer muda cálculos de coberturas/fechamento já em produção. Criar calendário novo, só para acordos, e decidir depois se migra o resto (tarefa separada).

Ressalva: fontes de terceiros divergem entre si; a lista oficial foi lida por resumo de página. **Conferir no decreto original antes do seed de 2026**.

### 5.2 Tipos e semântica

- `nacional`, `estadual`, `municipal`: feriado para todos (CLT).
- `facultativo`: ponto facultativo da Prefeitura. Não é feriado para o empregado CLT; é o principal **gatilho de acordos** neste contrato (unidades fechadas → dispensa → compensação). Tem campo de meio período (ex.: 18/02 até 13h).

Municipais oficiais (Lei 3.433/89): Paixão de Cristo (Sexta-Feira Santa), N.S. Sant'Ana (26/07), Aniversário da Cidade (01/09), Consciência Negra (20/11).

### 5.3 Tabela

```sql
create table calendario_feriados (
  id uuid primary key default gen_random_uuid(),
  data date not null,
  nome text not null,
  tipo text not null check (tipo in ('nacional','estadual','municipal','facultativo')),
  ate_hora time,              -- ponto facultativo de meio período
  base_legal text,
  ativo boolean not null default true,
  created_at timestamptz default now(),
  unique (data, nome)
);
-- RLS: SELECT authenticated; INSERT/UPDATE/DELETE admin e coordenador
```

Seed: feriados fixos + móveis calculados (Páscoa) para 2026–2028; facultativos de 2026 do decreto. Facultativos de outros anos entram por tela simples em admin (ou SQL) quando a Prefeitura publicar o decreto do ano.

Uso no acordo: seletor de data mostra o nome do feriado/facultativo; validador avisa compensação em feriado; template T2/T3 preenche `{motivo}` automaticamente.

## 6. Modelo de dados (migration aditiva)

```sql
alter table acordos_compensacao
  add column evento_data date,
  add column evento_nome text,
  add column template_id text,                          -- T1..T5
  add column prazo_limite date,                         -- T4 e acordos que cruzam o mês
  add column origem text not null default 'manual' check (origem in ('manual','ia')),
  add column pedido_original text;

-- livro de movimentos: um registro por funcionário e data
create table acordo_movimentos (
  id uuid primary key default gen_random_uuid(),
  acordo_id uuid not null references acordos_compensacao(id) on delete cascade,
  funcionario_id uuid not null references funcionarios(id),
  data date not null,
  minutos integer not null,          -- + trabalhou a mais / acréscimo ; − dispensa / redução / folga
  papel text not null check (papel in ('origem','quitacao')),
  status text not null default 'previsto'
    check (status in ('previsto','cumprido','nao_cumprido','dispensado_ajuste')),
  observacao text,
  verificado_em timestamptz,
  unique (acordo_id, funcionario_id, data, papel)
);
-- RLS: SELECT authenticated (supervisor limitado aos seus postos, como nas demais tabelas);
--      escrita via Server Actions (admin, coordenador, supervisor)
```

Campos novos nulos para acordos antigos; `descricao_acordo` continua sendo o texto final (agora gerado). Acordos antigos não ganham movimentos automaticamente (o texto livre não é confiável para extrair datas). Migration só roda com aprovação e após review.

Por que tabela e não JSON: a jornada varia por funcionário e por dia da semana (sexta pode ser menor), então os minutos a compensar diferem por pessoa; e o controle precisa consultar/atualizar cada movimento.

## 6-A. Aba "Controle" (saldo e prazo) — controle próprio

Nova aba em `/acordos` ao lado da lista. Visão por funcionário e por acordo, alimentada por `acordo_movimentos`:

| Coluna | Origem |
|---|---|
| Funcionário / posto / acordo | acordo |
| A compensar (min) | soma dos movimentos de origem |
| Compensado | soma dos movimentos de quitação com status `cumprido` |
| Saldo | diferença, em horas |
| Prazo | fim da última data de quitação prevista, ou `prazo_limite` |
| Situação | `em dia`, `vence em ≤ 7 dias`, `vencido com saldo`, `quitado` |

**Verificação automática de cumprimento.** Para cada movimento de quitação com data passada, o sistema cruza com `faltas`, `atestados`, `afastamentos` e `ferias` do funcionário naquela data:
- sem ocorrência → `cumprido`;
- com falta sem justificativa → `nao_cumprido` (o PDF já prevê redução salarial proporcional às horas não compensadas);
- com atestado/afastamento/férias → `nao_cumprido` com observação, para o RH decidir remanejar a data (`dispensado_ajuste`).

Rodagem: job diário (mesmo modelo do cron `snapshot-diario` em `vercel.json`) e botão "reverificar". O RH pode sobrescrever o status manualmente.

**Integrações:**
- Saldo devedor de funcionário (`nao_cumprido`) aparece como ocorrência para o fechamento (efeito financeiro só após decisão do RH; nada é descontado automaticamente).
- Acordo com saldo vencido ou próximo do prazo vai para `/pendencias`.
- Aba visível para admin, coordenador e RH; supervisor vê apenas os postos dele.
- Exportação Excel via `lib/export-excel.ts`.

O controle é interno: não altera nem substitui o documento assinado.

## 6-B. Emenda em 1 clique (ponto facultativo)

Caso dominante: a Prefeitura emenda o ponto facultativo, os funcionários ficam sem trabalhar (débito) e compensam com acréscimo depois (T3 dia inteiro, T2 meio período).

Fluxo:
1. Seção "Próximos pontos facultativos" no topo de `/acordos` (do `calendario_feriados`, tipo `facultativo`, futuros ou recém-passados).
2. Cada linha mostra: data, nome, meio período, e quantos dos postos do usuário já têm acordo para essa data.
3. "Criar acordo" abre o modal já preenchido: template T3 (ou T2 se `ate_hora`), motivo = nome da data, posto(s) do supervisor, funcionários elegíveis (5x2/5x1), jornada do dia de cada um.
4. O sistema **propõe** as datas de quitação: próximos dias úteis do funcionário após a emenda, acréscimo padrão de 1h/dia (limite 2h/dia), preferindo fechar no mesmo mês; se não couber, avisa e reclassifica como banco de horas (T4) com prazo.
5. Supervisor ajusta o que quiser; o validador roda; o texto é gerado; salva.

Sem IA. Na Fase 1b a IA entende "ponto facultativo do dia 5 no CEIM X, compensar 1h por dia" e chama esse mesmo motor.

**Aviso proativo (Fase 3):** ponto facultativo sem acordo a menos de N dias para postos com funcionários → item em `/pendencias`.

## 7. Componentes (Fase 0)

- `lib/acordos/horario-do-turno.ts` — `turnos_postos` + regime → tabela semanal (7 dias). Reaproveita `lib/turnos/escala.ts`.
- `lib/acordos/calc-compensacao.ts` — minutos ↔ HH:MM, livro de movimentos com sinal, distribuição de quitação por dia (respeitando 2h/dia e 10h/dia).
- `lib/acordos/emenda.ts` — proposta de datas de quitação a partir de um facultativo (seção 6-B).
- `lib/acordos/verificar-cumprimento.ts` — cruza movimentos com faltas/atestados/afastamentos/férias (seção 6-A).
- `lib/acordos/templates.ts` — T1–T5 e formatadores (datas, horas por extenso).
- `lib/acordos/regras.ts` — constantes (2h/dia, 10h/dia, 44h/sem, 6 meses).
- `lib/acordos/validar.ts` — regras da tabela do documento de templates.
- `lib/calendario/mogi.ts` — leitura do calendário + helpers.
- `buscarFuncionariosPorPostos`: filtrar 12x36 e aprendiz (mostrar como "não elegível", desabilitado), retornar turno completo.
- Modal: pré-preencher horário do turno; agrupar automaticamente funcionários com turnos iguais; campos estruturados de evento e compensação; texto gerado e somente-leitura (com "editar manualmente" que marca `origem=manual`).
- `criarAcordo`: gravar `criado_por = user.id` (bug). Testes unitários (vitest ou o runner que o projeto já tiver) para calc/templates/validar.

## 8. Fase 1 — IA

- **Chamada:** server action `interpretarPedidoAcordo(texto)` com `requireRole(['admin','coordenador','supervisor'])`, timeout 15s, limite de chamadas por usuário/minuto.
- **Modelo:** Haiku 4.5 (extração simples; menos de 1 centavo de dólar por pedido). Escalar para Sonnet 5 só se a taxa de acerto no conjunto de teste for baixa.
- **Método:** tool use com schema JSON fixo. Campos: `template_id`, `titulo`, `evento{data,nome,periodo}`, `movimentos[{data,minutos_por_dia,papel}]`, `folga{data,motivo}`, `data_calendario` (quando o pedido cita ponto facultativo/feriado), `posto_texto`, `funcionarios_texto[] | "todos"`, `campos_incertos[]`.
- **Contexto enviado:** só o pedido digitado/falado e data de hoje/ano. Nada de banco.
- **Pós-processamento:** casar posto e nomes com o banco (ambíguo → o supervisor escolhe), montar horário do turno, rodar validador, gerar texto por template.
- **Falha da IA ou da API:** cai no formulário manual sem perder o que foi digitado.
- **Auditoria:** `pedido_original` e `origem` gravados; integração com `lib/auditoria`.
- **Voz:** botão de microfone com Web Speech API (`pt-BR`); texto falado aparece editável antes de enviar. Fallback: ditado nativo do teclado do celular (iOS Safari tem suporte parcial).
- **Chave:** `ANTHROPIC_API_KEY` só em `.env.local` e no escopo Preview do Vercel (Produção só após aprovação). Nunca no client.

## 9. Teste no Vercel sem tocar produção

O Preview usa o mesmo Supabase de produção, então:

1. Branch `feat/acordos-ia` → Preview automático (exige `git push`: só com confirmação).
2. `ANTHROPIC_API_KEY` e `ACORDOS_IA=1` só no escopo Preview (confirmação necessária, regra do projeto).
3. Página `/acordos/ia-lab` em **dry-run**: mostra JSON extraído, horário, texto gerado e PDF; **não grava** no banco.
4. Depois de validar com pedidos reais, liberar "Salvar" no Preview com título prefixado `[TESTE]`.

## 10. Conjunto de teste da IA

15–20 pedidos reais/realistas de supervisores (texto e transcrição de voz), cada um com o JSON esperado. Critérios: posto correto, funcionários corretos, datas corretas, soma de horas fecha, template correto. Meta: ≥ 90% sem correção manual; o restante deve chegar marcado em `campos_incertos`.

## 11. Riscos

| Risco | Mitigação |
|---|---|
| IA erra data/horas | Validador determinístico + tela de revisão + campos incertos destacados |
| Texto jurídico inadequado | Templates aprovados por RH/jurídico; IA não redige |
| Acordo indevido (aprendiz, 12x36) | Filtro de escala + validação no servidor (não só na UI) |
| Teste polui produção | Dry-run + flag Preview + prefixo `[TESTE]` |
| Divergência de feriados com o resto do sistema | Calendário novo isolado; migração do legado como tarefa separada |
| Calendário desatualizado nos anos seguintes | Tela de manutenção + aviso quando o ano corrente não tem facultativos cadastrados |
| Convenção coletiva altera limites | Limites em constantes revisáveis; validação final pelo RH |

## 12. Pendências para aprovar

1. Confirmar lista oficial de feriados/facultativos 2026 no decreto original.
2. Chave de API dedicada criada e limite de gasto definido.
3. 15–20 pedidos reais para o conjunto de teste da IA.
4. Acordos antigos gerados com o T1 anterior (acréscimo para quem trabalhou): RH revisa uma amostra.
5. Efeito do saldo `nao_cumprido` no fechamento: só sinalizar (proposto) ou gerar desconto após aprovação do RH?
6. Prazo padrão sugerido ao propor T4 (limite legal é 6 meses; qual o padrão interno?).

## 13. Fora de escopo

12x36, jovem aprendiz, acordos em lote, migração do `feriadosDoAno()` legado, assinatura eletrônica.
