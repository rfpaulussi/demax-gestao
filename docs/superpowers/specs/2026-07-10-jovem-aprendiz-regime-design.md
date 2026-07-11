# Regime de trabalho para Jovem Aprendiz

**Data:** 2026-07-10
**Status:** Aprovado para implementação

## Contexto e problema

O sistema já modela três regimes de trabalho por posto (5x2, 5x1, 12x36 — ver [2026-07-10-turnos-postos-tipo-escala-design.md](2026-07-10-turnos-postos-tipo-escala-design.md)), com um regime por posto em `config_escalas_postos` e turnos calculados a partir dele.

Jovens aprendizes (função `JOVEM APRENDIZ`, já cadastrada em `funcoes`) não se encaixam nesse modelo: trabalham 4h/dia, segunda a sexta, em uma de duas equipes fixas (manhã ou tarde) — fixa por pessoa, não alternando — e têm um dia da semana individual reservado para curso (varia por aprendiz, não por posto). Consultando o banco em produção, ~30+ aprendizes ativos estão espalhados por dezenas de postos escolares (secretaria SME), quase sempre dividindo o mesmo posto com funcionários de outra função em outro regime (ex: agente de limpeza em 5x2). Isso significa que **o mesmo posto pode ter pessoas em regimes diferentes ao mesmo tempo** — o modelo atual de "1 regime por posto" não comporta isso.

## Escopo

**Dentro do escopo:** suporte ao regime de jovem aprendiz na atribuição de turno do funcionário (aba Horário do perfil) e na exibição do card "Horário Vigente".

**Fora de escopo:**
- Fechamento, férias e cálculo de dias úteis continuam lendo `config_escalas_postos.regime` do posto, sem alteração — jovem aprendiz também trabalha só seg-sex, então o cálculo de dias úteis já é compatível sem mudança.
- O dia de curso conta como dia normal de trabalho para fins de pagamento (não é falta/afastamento) — nenhuma mudança em lógica de folha.
- Sem tela de gerenciamento para os turnos globais de jovem aprendiz (são fixos, semeados uma vez).
- Sem backfill automático dos aprendizes já cadastrados — após o deploy, cada um precisa ser reatribuído manualmente via "Alterar Turno" (o dia de curso de cada pessoa não é uma informação inferível dos dados existentes).

## Modelo de dados

```sql
ALTER TABLE turnos_postos ALTER COLUMN posto_id DROP NOT NULL;
ALTER TABLE horarios_funcionarios ADD COLUMN dia_curso SMALLINT;
ALTER TABLE horarios_funcionarios ADD CONSTRAINT dia_curso_range CHECK (dia_curso IS NULL OR dia_curso BETWEEN 1 AND 5);

INSERT INTO turnos_postos (posto_id, nome, tipo_escala, hora_entrada, hora_saida_seg_qui, hora_saida_sex, hora_inicio_almoco, hora_fim_almoco, ativo)
VALUES
  (NULL, 'Jovem Aprendiz Manhã', 'jovem_aprendiz', '07:00', '11:00', NULL, NULL, NULL, true),
  (NULL, 'Jovem Aprendiz Tarde', 'jovem_aprendiz', '13:00', '17:00', NULL, NULL, NULL, true);
```

- `turnos_postos.posto_id` (nullable): `NULL` identifica um turno **global**, reutilizável por qualquer posto — diferente dos turnos existentes, que sempre pertencem a um posto específico.
- Os dois turnos globais de jovem aprendiz são semeados uma única vez, via migração. Não há fluxo de criação/edição para eles — são constantes do sistema.
- `horarios_funcionarios.dia_curso` (nullable, 1=segunda...5=sexta): dia da semana individual do aprendiz reservado para curso. Preenchido apenas quando o turno atribuído é um dos dois globais de jovem aprendiz; `NULL` em todos os outros casos.
- `tipo_escala = 'jovem_aprendiz'` passa a ser um quarto valor válido, ao lado de `5x2`/`5x1`/`12x36` (mesma coluna texto livre já existente, sem CHECK constraint — consistente com o padrão já adotado).
- Sem horário de almoço (turno de 4h não exige intervalo) e sem distinção "saída sexta" — mesmo shape de dados já usado por 12x36 (`hora_saida_sex = NULL`, `hora_inicio_almoco/hora_fim_almoco = NULL`), então a renderização null-safe do card "Horário Vigente" (já construída para 12x36) funciona automaticamente para jovem aprendiz sem mudança adicional.

## Atribuição de turno (aba Horário → "Alterar Turno")

- A tela precisa saber a função do funcionário para decidir qual lista de turnos mostrar — hoje esse dado não chega até `TabHorario`/`ModalAlterarTurno`, precisa ser propagado desde `app/(admin)/efetivo/[id]/page.tsx`.
- Quando a função é `JOVEM APRENDIZ`: o seletor mostra exclusivamente os dois turnos globais (Manhã/Tarde) — não os turnos do posto onde a pessoa está lotada. Isso garante que um aprendiz nunca seja atribuído por engano a um turno de 5x2/5x1/12x36 pensado para outra função.
- Quando o turno selecionado é um dos globais, um campo adicional obrigatório aparece: "Dia de curso" (Segunda a Sexta). Sem essa escolha, o formulário não pode ser salvo.
- Para qualquer outra função, o comportamento permanece exatamente como está hoje (lista os turnos do posto).

## Exibição no card "Horário Vigente"

- Blocos de Entrada/Almoço/Saída: nenhuma mudança de código necessária — o mesmo mecanismo null-safe construído para 12x36 (2 blocos: Entrada/Saída, sem Almoço) já cobre o shape de dados do jovem aprendiz.
- Badge de regime: novo, cor **teal** (`bg-teal-50 text-teal-700 ring-teal-200`), distinta das já usadas (5x2 azul, 5x1 roxo, 12x36 laranja).
- Grade "Dias de trabalho": hoje é 100% derivada de um dicionário estático por regime (`REGIME_CONFIG`). Para jovem aprendiz isso não é suficiente, porque o dia de curso varia por pessoa, não por regime — a grade precisa ler `horarioVigente.dia_curso` e marcar especificamente aquele dia com um estilo distinto (ícone de formatura, cor própria) em vez de "trabalha" (azul) ou "folga" (cinza). Os demais dias seg-sex continuam marcados como dia de trabalho normal.

## Fora de escopo / não resolvido por este trabalho

- Os dois turnos globais são fixos no código/migração — mudar os horários exige um ajuste manual, não uma tela de admin.
- Nenhum aprendiz já cadastrado é migrado automaticamente para o novo modelo; a reatribuição é manual, um por um, via "Alterar Turno".
- Se no futuro surgir a necessidade de mais de duas equipes (ex: um terceiro turno), ou de dia de curso variável ao longo do tempo (não fixo), isso não é coberto aqui.
