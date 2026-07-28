# Solicitação de mudança de horário (supervisor) + Excel do Efetivo com horário colorido

**Data:** 2026-07-28
**Status:** Aprovado para implementação

## Contexto e problema

Segue diretamente o trabalho de `docs/superpowers/specs/2026-07-28-catalogo-turnos-e-vinculo-horario-design.md` (Blocos A/B/C, já implementados e validados manualmente no preview `feature/turnos-padrao-e-horario`). Dois gaps identificados na validação:

1. **Mudar o turno de um funcionário dentro do mesmo posto** hoje só é possível via o botão "Alterar Turno" no perfil, restrito a `admin`/`coordenador` (`canWrite` em `components/efetivo/tab-horario.tsx`). Supervisor — que só tem acesso de leitura no sistema, e faz qualquer mudança estrutural via solicitação/aprovação — não tem nenhum caminho para pedir isso.
2. **Não existe forma de exportar a relação de horários** dos funcionários. O Excel de Efetivo já existe (`components/efetivo/efetivo-client.tsx`) e usa um exportador genérico por coluna (`lib/export-excel.ts`) que já suporta `cellStyle` (cor de fundo/fonte por célula) — usado hoje só na coluna Status.

## Escopo

**Dentro do escopo:**
- Bloco D: novo tipo de solicitação `mudanca_horario` — supervisor pede, admin aprova, aplica automaticamente (reaproveita 100% a infra do Bloco C).
- Bloco E: 2 colunas novas no Excel de Efetivo (Turno, Horário) coloridas por regime.

**Fora do escopo:**
- `mudanca_supervisor` — confirmado com o usuário que já funciona corretamente hoje: supervisor é derivado dinamicamente do posto (`config_supervisores_postos`), então muda sozinho quando o funcionário muda de posto via transferência (Bloco C). O tipo de solicitação `mudanca_supervisor` existente (`app/(admin)/efetivo/actions.ts:553`) não tem `case` de aprovação implementado em `aprovacoes/actions.ts` — feature separada, pré-existente, não investigada nem alterada aqui.
- Qualquer mudança de schema (nenhuma migração nova).
- Data de início escolhível pelo supervisor no Bloco D — sempre aplica na data da aprovação, igual aos outros 3 fluxos do Bloco C.
- Cor por "sem horário" no Excel — só cor por regime; linhas sem horário ficam sem cor (já contrastam com as coloridas).

## Bloco D — Solicitação de mudança de horário

### Regra

Esta solicitação nunca passa por `precisaNovoTurno` — a troca de turno É o pedido em si, não uma consequência de outra mudança (posto e função permanecem os mesmos). Sempre exige a escolha de um novo turno.

### UI — `components/efetivo/modal-nova-solicitacao.tsx`

- Novo tipo `mudanca_horario` adicionado a `TIPOS_POR_STATUS.ativo` (ao lado de `transferencia`, `mudanca_funcao`, `desligamento`, `rescisao_indireta`) e a `TIPO_LABELS` (ex.: `🕐 Mudança de Horário`).
- Formulário: sem campo de posto/função — só o seletor de turno, igual ao bloco "Novo turno de trabalho" já existente nos outros 3 tipos, mas **sempre visível** (não condicional a `precisaTurno`) quando `tipo === 'mudanca_horario'`.
  - Fonte da lista: se o funcionário já é Jovem Aprendiz (`funcionario.funcoes?.nome === FUNCAO_JOVEM_APRENDIZ`) → `listarTurnosJovemAprendiz()` + campo "Dia de curso" obrigatório; senão → `listarTurnosDoPosto(funcionario.posto_id)`.
  - Sem painel de "Impacto nos postos" (posto não muda).
  - Turno é obrigatório para enviar (sem o fallback "sem turno cadastrado" dos outros 3 tipos — se o posto não tiver nenhum turno cadastrado, mostra aviso e bloqueia envio, já que aqui não faz sentido solicitar uma troca para um destino sem opções).

### Persistência — `app/(admin)/efetivo/actions.ts`

Nova função `solicitarMudancaHorario(formData)`, no mesmo padrão das demais `solicitar*`:
```
dados_antes:  { turno_atual_id, turno_atual_nome }
dados_depois: { turno_destino_id, turno_destino_nome, dia_curso_destino? }
```
Busca o turno vigente do funcionário (via `horarios_funcionarios` + `turnos_postos`, mesmo padrão de leitura já usado em outras partes do arquivo) para preencher `dados_antes`.

### Aprovação — `app/(admin)/aprovacoes/actions.ts`

Novo `case 'mudanca_horario'`: chama `aplicarMudancaHorario(funcionarioId, dadosDepois.turno_destino_id, dadosDepois.dia_curso_destino ?? null, hojeISO, guard.userId)` diretamente — sem chamar `precisaNovoTurno` (a troca sempre se aplica aqui). Nenhum `update` em `funcionarios` (posto/função não mudam).

### Tipo

`TipoSolicitacao` em `types/index.ts:164` (union TS mantida manualmente, não gerada) ganha `'mudanca_horario'`.

`solicitacoes.tipo` no banco é `TEXT` com um `CHECK` constraint (`solicitacoes_tipo_check`), não um enum Postgres — confirmado em `supabase/migrations/20260613_admissao_solicitacao.sql:28-33`. Nova migração dropando e recriando o constraint com `'mudanca_horario'` incluído no `ARRAY`, mesmo padrão das migrações anteriores que adicionaram tipos (`20260609_solicitacoes_reforma.sql`, `20260613_admissao_solicitacao.sql`).

## Bloco E — Excel do Efetivo com horário colorido

### Busca de dados — `app/(admin)/efetivo/page.tsx`

Nova query buscando o horário vigente (`turno_id`, `data_fim IS NULL`) de todos os `funcionario_id` já carregados na página, com join em `turnos_postos` (nome, tipo_escala, horários) — mesmo padrão de query já usado em `listarFuncionariosParaAtribuicaoLote` (Bloco B). Resultado mesclado em cada linha antes de passar para `EfetivoClient`.

### Tipo — `components/efetivo/funcionarios-table.tsx`

`FuncionarioRow` ganha campos opcionais:
```ts
turno_atual_nome:   string | null
turno_atual_regime: string | null   // tipo_escala resolvido (5x2/5x1/12x36/jovem_aprendiz)
turno_atual_resumo: string | null   // formatarResumoTurno(...) já calculado no servidor
```

### Excel — `components/efetivo/efetivo-client.tsx`

2 colunas novas no `handleExport`, após "Status":
- **Turno**: `r.turno_atual_nome ?? ''`
- **Horário**: `r.turno_atual_resumo ?? ''`, com `cellStyle` colorindo por `r.turno_atual_regime`, reaproveitando a paleta já usada na tela (`ESCALA_BADGE_CLASS`/`ESCALA_BORDER_CLASS` em `lib/turnos/escala.ts`), convertida para hex:
  - `5x2`: fill `EFF6FF`, fonte `1D4ED8`
  - `5x1`: fill `FAF5FF`, fonte `7E22CE`
  - `12x36`: fill `FFF7ED`, fonte `C2410C`
  - `jovem_aprendiz`: fill `F0FDFA`, fonte `0F766E`
  - sem horário (`turno_atual_regime` null): sem `cellStyle` (célula em branco, sem cor).

Nenhuma mudança em `lib/export-excel.ts` — o utilitário já suporta `cellStyle` por coluna.

## Migração e compatibilidade

- 1 migração SQL nova: drop + recriar `solicitacoes_tipo_check` incluindo `'mudanca_horario'` no `ARRAY`.
- Nenhuma mudança em `horarios_funcionarios`, `turnos_postos` ou RLS.
- Solicitações antigas (outros tipos) não são afetadas.

## Plano de verificação

Manual, mesmo padrão do trabalho anterior (sem framework de testes no projeto):

1. **Bloco D**: supervisor solicita mudança de horário para funcionário normal (não jovem aprendiz) → turno aparece sempre, sem condicional → aprovar → conferir troca no perfil (vigente fecha/abre na data de aprovação, `movimentacoes` registrada). Repetir para funcionário Jovem Aprendiz → campo dia de curso aparece e é obrigatório.
2. **Bloco E**: exportar Excel do Efetivo → conferir colunas Turno/Horário presentes, cor de fundo correspondendo ao regime de cada linha, funcionários sem horário com célula em branco.
3. `npm run build` sem erros ao final.

## Fora de escopo / não resolvido por este trabalho

- Investigação do `case` de aprovação ausente para `mudanca_supervisor` — feature pré-existente e separada, fora do escopo confirmado com o usuário.
- Relatório de horários dedicado por posto (alternativa mais trabalhosa discutida e descartada em favor de estender o Excel existente).
