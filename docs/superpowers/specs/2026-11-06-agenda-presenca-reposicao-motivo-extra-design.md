# Agenda Semanal — Presença na grade, clareza na reposição e motivo da visita extra

## Objetivo
Três ajustes na Agenda Semanal dos supervisores (feedback do admin, com prints):
1. Dá pra ver, olhando a grade, se o supervisor esteve no posto ou não — hoje só dá pra ver isso trocando pra aba Mapa de Visitas.
2. A reposição automática (visita planejada que vira "feita em outro dia") já funciona, mas o supervisor não sabe disso: ao tentar editar um dia já passado de uma agenda publicada, só vê "peça ao admin pra liberar".
3. Check-in de visita extra (posto fora do plano do dia) não pede motivo nem observação — só acontece.

## Decisões
- Status de presença (`StatusVisita` de `lib/agenda/visitas.ts`) passa a ser calculado também no client da grade (hoje só alimenta o Mapa de Visitas) e exibido como selo por bloco.
- Reposição automática continua só por posto + semana ISO (sem matching manual); o ajuste é só de comunicação/UX.
- Motivo do check-in extra é sempre obrigatório, mesmo quando o posto bate com uma falta da semana (pareamento automático). O motivo é informativo — não altera o pareamento.
- Lista de motivos fixa, nos moldes de `TIPOS_JUSTIFICATIVA`; só "Outro" exige texto.
- Supervisor de apoio não entra nisso: ele já tem fluxo próprio (atividade + observação em `novo-checkin-apoio.tsx`).

## 1. Selo de presença na grade semanal
- `AgendaSupervisor` já busca `carregarMapa(semanaInicio, supervisor.id)` pra montar `repostas`; passa a guardar também o status de cada visita (não só as `reposta`) num mapa `${data}|${posto_id} → StatusVisita`.
- `GradeSemanal` ganha prop `statusPorSlot?: Record<string, StatusVisita>`. Bloco com mais de um posto usa o pior status entre eles (prioridade: `falta` > `sem_foto` > `alerta` > `ok` > `reposta`... reposta já tem selo próprio e continua tratado à parte).
- Selo (ícone pequeno no canto do card, ao lado dos já existentes de replanejado/observação):
  - `ok` / `alerta` → check verde
  - `falta` → X vermelho
  - `sem_foto` → câmera laranja
  - `reposta` → mantém o selo teal "Reposta em DD/MM" já existente
  - `agendado` (hoje sem check-in ainda, ou dia futuro) → sem selo
- Vale nas duas visões que usam `GradeSemanal` (supervisor dono e admin/coordenador em `modoGestao`), sem prop nova de permissão — é só leitura.
- Fora do escopo: blocos sem posto (ex. "Recolhimento de cartão", administrativo) não têm selo — não há check-in pra medir.

## 2. Clareza no remanejamento pós-publicação
- Não muda a lógica de `montarVisitas` (reposição automática já funciona).
- `modal-bloco.tsx`, seção `passadoTravado`: troca o texto fixo por uma explicação que já aponta o caminho certo, algo como:
  > 🔒 Este dia já passou. Se a visita foi feita em outro dia, **não precisa editar aqui**: no dia em que foi, faça o check-in nesse mesmo posto (dentro da mesma semana) — o sistema reconhece sozinho como reposição desta visita. Só peça ao admin pra liberar o dia se o problema for outro (bloco errado, posto errado etc.).
- `docs/guia-uso-agenda-supervisores.md`: nova entrada curta na tabela "Situações especiais" (seção 3) ou "Problemas comuns" (seção 5): "Fiz a visita planejada em outro dia" → "Não mexa no bloco antigo: no dia em que foi, faça o check-in lá. Vira reposição automática se for a mesma semana e o mesmo posto."

## 3. Motivo + observação no check-in de visita extra
### Dados
- Migração `supabase/migrations/20261106_agenda_motivo_extra.sql`:
  ```sql
  ALTER TABLE agenda_checkins ADD COLUMN IF NOT EXISTS motivo_extra text;
  ```
- Observação livre reaproveita a coluna `atividade_obs` (já existe, hoje só usada pelo supervisor de apoio).
- `lib/agenda/motivos-visita-extra.ts` (mesmo formato de `justificativas.ts`):
  - `reposicao` — "Reposição de visita planejada" (sem texto obrigatório)
  - `emergencia` — "Emergência / ocorrência" (sem texto obrigatório)
  - `direcao` — "Pedido da direção / secretaria" (sem texto obrigatório)
  - `cobertura` — "Cobertura de posto" (sem texto obrigatório)
  - `outro` — "Outro (descrever)" (texto obrigatório)

### Fluxo
- `checkin-painel.tsx`, dentro do `<details>` "+ Visita extra (não planejada)": ao tocar "Cheguei" num posto da lista de extras (supervisor comum, não apoio), em vez de chamar `acionar()` direto, abre um mini-painel inline (mesmo estilo do `novo-checkin-apoio.tsx`) pedindo:
  - Motivo (select, obrigatório)
  - Observação (`CampoObservacao`, obrigatória só se motivo = outro)
  - Botão "Fazer check-in de chegada" chama `acionar(posto.id, 'entrada', coords, undefined, motivoExtra, obs)` (nova assinatura passando motivo/obs junto, do mesmo jeito que o apoio já manda `focoId`/`obs`).
- `registrarCheckin` (geo-actions) e `agenda_checkins` passam a gravar `motivo_extra` quando vier preenchido.
- Check-in guardado offline (`fila-checkins`) carrega motivo/obs igual já carrega `focoId`/`atividadeObs` do apoio.

### Exibição
- Mapa de Visitas (`mapa-agenda.tsx`): card de visita com `status === 'extra'` e `motivo_extra` preenchido mostra `"Motivo: <rótulo> <observação>"`, mesmo padrão hoje usado só com `apoio && atividade_obs`.
- PDF semanal e relatório mensal: fora do escopo desta fase.

## Fora do escopo
- Vínculo manual de qual falta a visita extra está repondo (ficou como pareamento automático, decisão do usuário).
- Mudar a janela da reposição automática (continua só mesma semana ISO, mesmo posto).
- Qualquer alteração no fluxo do supervisor de apoio.

## Validação
`npx tsc --noEmit`, `npm run build`. Teste manual no preview: grade com selo nos 3 status principais (ok/falta/sem_foto) + reposta já existente; modal de dia travado com o texto novo; check-in de visita extra pedindo motivo antes de registrar, aparecendo depois no Mapa de Visitas.
