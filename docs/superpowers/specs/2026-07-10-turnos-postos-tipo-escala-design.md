# Tipo de escala no cadastro de Turnos do Posto

**Data:** 2026-07-10
**Status:** Aprovado para implementação

## Contexto e problema

O modal "Turnos de trabalho" (Postos → Gerenciar → botão "Turnos") só permite cadastrar `nome` + `hora_entrada`, e deriva os demais horários (almoço, saída) por uma fórmula fixa de escala **5x2/44h**. A tabela `turnos_postos` tem colunas rígidas (`hora_saida_seg_qui`, `hora_saida_sex`) que só fazem sentido para esse regime.

O conceito de regime de trabalho (`5x2`/`5x1`/`12x36`) já existe no sistema, mas isolado em `config_escalas_postos.regime` (1 valor de texto livre por posto, sem enum/CHECK), usado hoje só para cálculo de dias úteis em fechamento, férias, coberturas e absenteísmo. Essa tabela nunca é consultada pelo modal de Turnos, então cadastrar um turno em um posto marcado como 12x36 continua forçando campos de "saída seg-qui"/"saída sexta" sem sentido para esse regime.

A tag "5x2 · 44h/sem" e a grade de "Dias de trabalho" exibidas no card "Horário Vigente" do perfil do funcionário (`components/efetivo/tab-horario.tsx`) já leem `config_escalas_postos.regime` e o mapeiam via um dicionário `REGIME_CONFIG` hardcoded no frontend — com paleta de cores já estabelecida (5x2 = azul, 5x1 = roxo, 12x36 = laranja). Este trabalho reaproveita essa mesma paleta.

## Escopo

**Dentro do escopo:** modal de cadastro/edição de turnos do posto — passa a exigir e refletir o tipo de escala do posto, com campos e cálculo automático adequados a cada regime.

**Fora do escopo** (decisão explícita): não altera `config_escalas_postos` como fonte de regime por posto, não versiona regime no tempo, não remove os dicionários hardcoded existentes (`REGIME_CONFIG` em `tab-horario.tsx`, `REGIME_LABELS` em `movimentacao-colaborador-constants.ts`, `config-escalas-client.tsx`), não altera lógica de fechamento/férias/coberturas/absenteísmo — todos continuam lendo `config_escalas_postos.regime` exatamente como hoje.

## Modelo de dados

Reaproveita as colunas existentes de `turnos_postos` em vez de remodelar a tabela, minimizando o raio de impacto sobre código que já lê `hora_saida_seg_qui`/`hora_saida_sex` (perfil do funcionário, PDFs, fechamento).

```sql
ALTER TABLE turnos_postos ADD COLUMN tipo_escala TEXT;
ALTER TABLE turnos_postos ALTER COLUMN hora_saida_sex DROP NOT NULL;
ALTER TABLE turnos_postos ALTER COLUMN hora_inicio_almoco DROP NOT NULL;
ALTER TABLE turnos_postos ALTER COLUMN hora_fim_almoco DROP NOT NULL;

UPDATE turnos_postos SET tipo_escala = '5x2' WHERE tipo_escala IS NULL;
ALTER TABLE turnos_postos ALTER COLUMN tipo_escala SET NOT NULL;
ALTER TABLE turnos_postos ALTER COLUMN tipo_escala SET DEFAULT '5x2';
```

- `tipo_escala`: snapshot do regime do posto (`config_escalas_postos.regime`) no momento da criação do turno. Guardado no turno (não apenas lido em tempo real) para que o turno permaneça interpretável mesmo se o regime do posto for alterado depois em Config Escalas — sem isso, editar o regime do posto reinterpretaria retroativamente turnos já cadastrados.
- `hora_saida_seg_qui`: passa a ser a coluna de **"saída"** genérica — para 5x2 é a saída seg-qui (comportamento atual inalterado); para 5x1 é a saída dos 6 dias trabalhados; para 12x36 é a saída do turno.
- `hora_saida_sex`: preenchida só para 5x2; `NULL` para 5x1 e 12x36.
- `hora_inicio_almoco` / `hora_fim_almoco`: preenchidas para 5x2 e 5x1 (que têm intervalo com horário fixo); `NULL` para 12x36 (intervalo é descontado da duração total, sem horário de relógio fixo).

Nenhuma mudança em `horarios_funcionarios` ou `config_escalas_postos`.

## Regras de cálculo automático por regime

Todas partem só da `hora_entrada` informada pelo usuário — igual ao comportamento atual do 5x2.

- **5x2** (mantém como está — sem alteração de comportamento): almoço de 72min; saída seg-qui e saída sexta com os deslocamentos (`delta`) já existentes em `calcularHorariosDerivados`.
- **5x1** (novo): almoço fixo de 1h; `saída = entrada + 8h20` (7h20 de trabalho + 1h de almoço, fechando 44h em 6 dias). Mesmo horário nos 6 dias trabalhados — sem distinção tipo "saída de sábado".
- **12x36** (novo): sem horário de almoço fixo; `saída = entrada + 13h` (12h de trabalho + 1h de intervalo descontado da duração total, sem horário de relógio próprio).

## Fluxo e UI do modal

**1. Posto sem regime configurado em Config Escalas** (bloqueio):
- O cadastro de novo turno fica bloqueado. Exibe um aviso em card **âmbar** (`bg-amber-50 border-amber-200 text-amber-800`, consistente com a cor de "ocorrências"/alerta do design system) explicando que o posto ainda não tem um regime de trabalho definido.
- Dentro do próprio aviso, um seletor inline de regime (3 botões: 5x2 / 5x1 / 12x36) que, ao ser escolhido, faz upsert direto em `config_escalas_postos` (mesma Server Action já usada por Config Escalas) e libera o formulário — sem sair do modal ou navegar para outra tela.

**2. Posto com regime configurado:**
- O modal exibe um badge fixo e não-editável no topo com o regime do posto, reaproveitando a paleta já usada em `tab-horario.tsx`:
  - `5x2` → `bg-blue-50 text-blue-700 ring-blue-200`
  - `5x1` → `bg-purple-50 text-purple-700 ring-purple-200`
  - `12x36` → `bg-orange-50 text-orange-700 ring-orange-200`
- Abaixo do badge, uma nota secundária em `text-slate-500` explicando que o regime é definido em Config Escalas (link para lá), reforçando que não é editável a partir daqui.
- O formulário "Novo turno" mostra só `nome` + `hora_entrada` (como hoje) — nenhum campo extra de escala, já que ela vem do posto.
- O card de preview "Horários calculados automaticamente" é recalculado conforme a regra do regime ativo, e usa a **mesma cor do badge do regime** como acento (borda esquerda colorida de 4px, seguindo o padrão de cards do design system) para reforçar visualmente qual regra está sendo aplicada:
  - 5x2: mostra Almoço, Saída Seg-Qui, Saída Sex (como hoje).
  - 5x1: mostra Almoço, Saída (label único, sem distinção de dia).
  - 12x36: mostra só Saída (sem linha de almoço, já que não há horário fixo de intervalo).
- Na listagem de turnos já cadastrados do posto (all listagem existente do modal), cada turno passa a exibir um badge pequeno com seu `tipo_escala` (mesma paleta de cores), permitindo identificar de relance turnos legados 5x2 vs. novos turnos 5x1/12x36 no mesmo posto (útil durante a transição, já que turnos antigos serão todos marcados 5x2 no backfill).

## Server Actions (`app/(admin)/postos/turnos/actions.ts`)

- `listarTurnosPosto`: passa a retornar `tipo_escala` de cada turno (sem mudança de assinatura, só inclui a coluna nova no select).
- `criarTurno`: passa a buscar `config_escalas_postos.regime` do posto antes de inserir; se não existir, retorna erro orientando a configurar o regime primeiro (proteção de backend equivalente ao bloqueio de UI, para o caso de chamada direta da action). Grava `tipo_escala` = regime encontrado. Calcula os horários derivados conforme a regra do regime (nova função `calcularHorariosDerivados(horaEntrada, tipoEscala)`, substituindo a atual que assume 5x2 implicitamente).
- `editarTurno`: mesma lógica de recálculo condicionada ao `tipo_escala` já gravado no turno (não relê o regime do posto — evita que editar um turno existente mude seu regime "por baixo dos panos" se o posto tiver sido reconfigurado nesse meio tempo).
- Novo helper compartilhado: Server Action de upsert de regime (reaproveitando a lógica de `saveEscala()` de `app/(admin)/fechamento/config-escalas/actions.ts`) exposta para o seletor inline do modal.

## Migração e compatibilidade

- Turnos já existentes recebem `tipo_escala = '5x2'` no backfill — comportamento visual e de cálculo inalterado para eles.
- Nenhuma mudança em `horarios_funcionarios`, RLS, ou nas leituras existentes de `hora_saida_seg_qui`/`hora_saida_sex` em `tab-horario.tsx`/PDFs — que continuam funcionando sem alteração para turnos 5x2 (a maioria hoje). Turnos 5x1/12x36 recém-criados terão `hora_saida_sex` e/ou almoço `NULL`, então qualquer tela que hoje formata esses campos precisa tratar `null` graciosamente (checar `tab-horario.tsx` e o PDF de movimentação como parte da implementação).

## Fora de escopo / não resolvido por este trabalho

- Os 3 dicionários hardcoded de regime continuam duplicados (não são unificados).
- Regime continua sendo 1 valor por posto (não por turno/funcionário) e sem versionamento temporal — mudar o regime em Config Escalas depois de turnos já criados não afeta os turnos existentes (protegidos pelo snapshot em `tipo_escala`), mas a tag exibida no perfil do funcionário (`tab-horario.tsx`, que lê `config_escalas_postos.regime` em tempo real) pode divergir do `tipo_escala` do turno vigente se o regime do posto mudar depois — isso é uma inconsistência conhecida e pré-existente, não introduzida por este trabalho.
