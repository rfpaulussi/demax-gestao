# Inteligência de Absenteísmo e Disponibilidade Operacional — Design

Data: 2026-11-19 · Rota: `/relatorios/absenteismo` · Status: aprovado em conversa, aguardando revisão do spec

## 1. Objetivo

Substituir a tela atual de Absenteísmo (listagem de ausências + 6 KPIs) por um módulo de análise para coordenadores e gestores: taxa correta, comparativos, tendência, composição por natureza, rankings, padrões, saúde (CID), disponibilidade operacional e recomendações acionáveis.

A tela atual NÃO é reaproveitada na lógica de cálculo (ver seção 2). O relatório "Faltas do Mês" permanece como está.

## 2. Auditoria (resumo do que justifica o design)

### 2.1 Falhas de método da tela atual
1. Numerador mistura unidades: faltas (`dias` lançado), atestados (dias corridos), suspensões (`dias_suspensao`); denominador é `ativos × dias úteis 5x2`.
2. Denominador usa ativos de HOJE, não os do mês consultado.
3. Todos tratados como `5x2`, ignorando a escala real (5x2, 5x1, 6x1, 12x36).
4. Falta não é cortada no mês; `data_fim` existente não é usado.
5. Atestado longo (>15 dias, que na prática é INSS) entra como absenteísmo.
6. A tabela `afastamentos` não é consultada.
7. Suspensão disciplinar entra como absenteísmo.
8. `faltas.tipo` é ignorado (tudo vira "Falta", inclusive `declaracao`).
9. Sobreposições sem dedupe (2 faltas × atestado, 3 atestados sobrepostos hoje).
10. Férias em dias corridos; sem `fetchAllRows` (corte em 1000 linhas ao ampliar a janela).

### 2.2 Dados reais (consulta somente leitura em 2026-11-19, agregados)
- `faltas` 287 (de 2026-06-18 a 2026-11-17): `sem_justificativa` 206, `justificada` 46, `declaracao` 29, `atraso` 5, `suspensao` 1. 77 multi-dia. Coluna `justificativa` 100% vazia (texto em `observacao`); `tem_documento` sempre falso. `confirmada_em`/`confirmada_por` existem (confirmação pelo supervisor).
- `atestados` 442: 40% de 1 dia; 22 com >15 dias (19 com afastamento INSS no período); 124 sem `cid_codigo` (49 marcados `sem_cid`); 434 enviados ao ambulatório; 4 de acidente de trabalho.
- `afastamentos` 72: 44 abertos; 12 sem previsão; `motivo` é texto livre (INSS - Doença 24, Outros 17, sem motivo 17, Maternidade 4, NA 3, INSS - Acidente 2, Paternidade 1, 4 textos soltos).
- `snapshots_diarios` 155 dias (desde 2026-06-18); `snapshots_mensais` vazia.
- `funcionarios` 1247 com `data_admissao` e `data_desligamento` (355 com saída): permite reconstruir o quadro de qualquer data.
- Escalas dos turnos ativos: 5x2 441, 5x1 20, 6x1 16, 12x36 4, jovem_aprendiz 8.

### 2.3 Limitações assumidas
- Histórico de ausências começa em 2026-06-18: gráfico mostra jul–nov (5 meses completos), junho marcado como parcial. O gráfico cresce a cada mês.
- Comparativo com o mesmo período do ano anterior: indisponível até jun/2027; o card aparece com "sem base".
- Não existe view/RPC/agregação no banco; tudo é calculado em memória (volume pequeno).

## 3. Decisões de produto

- INSS, licenças e demais afastamentos ficam em **faixa própria (aba Disponibilidade), fora da taxa de absenteísmo**.
- Férias ficam fora da taxa e fora da faixa principal; aparecem na aba Disponibilidade.
- Suspensão disciplinar fica fora da taxa (indicador disciplinar separado).
- Nenhum registro de origem é alterado: a classificação gerencial é uma camada de mapeamento no código.
- Sem migração de banco na primeira versão.
- Filtro "Contrato" do mockup é removido (contrato único). Filtros: mês/período, secretaria, posto, supervisor, natureza.
- Coluna "Status" do mockup é derivada: falta → confirmada / pendente de confirmação (`confirmada_em`); atestado → em curso / encerrado (por data); afastamento → aberto / encerrado (`data_fim_real`).

## 4. Classificação gerencial

| Classe | Origem | Entra na taxa? |
|---|---|---|
| Falta injustificada | `faltas.tipo = sem_justificativa` | Sim |
| Falta justificada | `faltas.tipo IN (justificada, declaracao, com_atestado, falta_justificada)` | Sim |
| Falta injustificada (cobertura) | `faltas.tipo = falta_injustificada`, `sem_atestado` | Sim |
| Outras não programadas | `faltas.tipo = atraso` (e tipos não mapeados) | Sim |
| Atestado médico | `atestados`, dias 1–15 a partir de `data_inicio` | Sim |
| Atestado prolongado | `atestados`, dias acima do 15º (regra do fechamento: `DIAS_COBERTURA_ATESTADO = 15`) | Não → Disponibilidade |
| Afastamento INSS | `afastamentos.motivo` contém "INSS" | Não → Disponibilidade |
| Licença legal | motivo contém "Maternidade" ou "Paternidade" | Não → Disponibilidade |
| Afastamento temporário/outros | demais motivos (inclui "Outros", "NA", nulo, texto livre) | Não → Disponibilidade |
| Suspensão disciplinar | `faltas.tipo = suspensao` e `advertencias` grau suspensão | Não → indicador disciplinar |
| Férias | `ferias` (status ≠ cancelado) | Não → Disponibilidade |

O mapeamento de afastamentos é por dicionário (regex sobre `motivo`, sem acento/caixa); o que não casar vira "Outros" e aparece na aba Qualidade dos dados.

## 5. Regras de cálculo

Biblioteca pura em `lib/absenteismo/` com testes unitários em `vitest` (`npm test`, já usado em `lib/atestados/periodos.test.ts`).

- **Dia útil por escala:** `diasUteisNoPeriodo(inicio, fim, regime, feriados)` existente; regime por funcionário via `obterRegimesPorFuncionario(..., asOfDate = fim do mês)`.
- **Quadro do dia:** funcionário com `data_admissao ≤ dia` e (`data_desligamento` nulo ou `> dia`). **Quadro médio** = soma dos dias-pessoa do quadro no período ÷ dias corridos do período. Funcionários com status `desligado` ou `rescisao_indireta` e sem `data_desligamento` ficam fora do quadro (hoje: 19 casos de rescisão indireta sem data). Critério de aceite: diferença relativa ≤ 2% contra `snapshots_diarios.ativos + afastados + em_ferias` em todos os dias com snapshot. Medido em 2026-11-19 sobre os 155 dias existentes: máximo de 1,63% (a diferença vem de mudanças de status que o histórico não registra); acima de 2% o trabalho para e é investigado.
- **Jornadas programadas** (por funcionário): dias úteis da escala entre `max(início do período, admissão)` e `min(fim do período, desligamento − 1)`, menos os dias úteis em férias e em afastamento/atestado prolongado (indisponibilidade).
- **Jornadas perdidas:** união dos dias de ausência da taxa, cada dia contado uma vez, em dias úteis da escala do funcionário, cortados ao período. Precedência quando há sobreposição entre fontes: afastamento > atestado > falta (coerente com a regra existente "falta nunca coexiste com atestado/afastamento"). Dia compartilhado entre atestados seguidos (passagem de bastão) conta uma vez (`diasUnicosAtestados`).
- **Episódio:** cada falta (inclusive multi-dia) é 1 episódio; atestados contíguos (inclusive passagem de bastão) formam 1 episódio.
- **Taxa de absenteísmo** = jornadas perdidas ÷ jornadas programadas × 100.
- **Índice de Frequência (IF)** = episódios ÷ quadro médio × 100.
- **Índice de Gravidade (IG)** = jornadas perdidas ÷ quadro médio × 100.
- **Duração média por ocorrência** = jornadas perdidas ÷ episódios.
- **Funcionários afetados** = distintos com ≥ 1 episódio no período; **% afetados** = afetados ÷ quadro médio.
- **Taxa de reincidência** = afetados com ≥ 2 episódios no período ÷ afetados.
- **Variação** = (atual − anterior) ÷ anterior para contagens; diferença em p.p. para taxas. Período anterior = mês imediatamente anterior completo; para junho/2026 aparece "sem base completa".
- **Disponibilidade** (aba própria): funcionários-dia indisponíveis por classe, em dias corridos, e **taxa de indisponibilidade** = dias-pessoa indisponíveis ÷ dias-pessoa do quadro.
- Tooltips ⓘ de cada métrica explicam a fórmula e a diferença entre dia corrido, dia útil e jornada. Horas trabalháveis ficam como métrica secundária derivada do horário do turno e só são exibidas quando o turno do funcionário tem horário cadastrado; a métrica principal é jornada.
- Faltas ainda sem `confirmada_em` entram na taxa com marca visível; filtro "somente confirmadas" disponível.
- **Precedência por dia** (do menor para o maior; o último vence): falta `outras` < falta injustificada < falta justificada < suspensão < atestado (até o 15º dia, contado a partir de `data_inicio` de cada atestado) < atestado prolongado < férias < afastamento. Cada dia pertence a uma única classe.
- **Suspensão** (falta tipo `suspensao` ou advertência de grau suspensão) não conta como jornada programada nem como perdida; vira o indicador disciplinar `suspensao_jornadas`. Para advertência, as jornadas suspensas são os primeiros `dias_suspensao` dias programados a partir de `data_ocorrencia`.
- **Dia fora da escala:** falta lançada em dia não programado (ex.: fim de semana em 5x2) não gera jornada perdida, mas o episódio continua contado; a aba Qualidade dos dados sinaliza episódios com 0 jornadas.
- **Mês corrente e mês inicial:** o mês corrente é calculado até hoje (jornadas programadas só até hoje) e marcado como parcial; o mês que contém 2026-06-18 começa nessa data e também é parcial. Meses anteriores a 2026-06-18 ficam "sem dados".
- **Série mensal:** usa um único mapa de regimes (vigente no fim do período mais recente). Resolver o regime mês a mês fica fora da primeira versão.
- **Posto/secretaria/supervisor nos filtros:** são os atuais do funcionário (não há histórico de posto por dia); vale para todas as fontes.

## 6. Interface

Cabeçalho com filtros globais combináveis, persistidos em `searchParams` (compartilháveis): mês/período, secretaria, posto, supervisor, natureza. Layout: 6 colunas desktop, 2 tablet, 1 celular; tabelas rolam na horizontal dentro do card; estados de carregamento (skeleton), vazio e erro; cor forte só em alertas. Design system do projeto (Inter, `bg-slate-50`, cards brancos com borda superior 4px, labels `uppercase tracking-widest text-xs`, botão PDF `bg-amber-500`). Gráficos com `recharts`.

Abas:
1. **Visão Executiva:** 5 KPIs (taxa, jornadas perdidas, episódios, funcionários afetados, IF) com variação vs. mês anterior e vs. mesmo mês do ano anterior (quando houver); evolução mensal; composição por classe; indicadores (IF, IG, duração média, reincidência); ranking por secretaria (taxa normalizada pelo quadro); mapa de calor por dia da semana; as 3 recomendações mais relevantes.
2. **Ocorrências:** tabela única pesquisável, ordenável, paginada; filtros por natureza e status; funcionário, matrícula, posto, secretaria, tipo, data, jornadas, justificativa/motivo, status; exportação Excel e PDF. CPF nunca exibido.
3. **Saúde (atestados):** distribuição por duração, capítulos de CID, % sem CID, nexo ocupacional, acidente de trabalho, reincidentes, episódios INSS perto de 60 dias (`calcularEpisodioInss`).
4. **Disponibilidade:** afastamentos (INSS, licenças legais, temporários/outros), atestados prolongados e férias; funcionários indisponíveis por dia, taxa de indisponibilidade, previsões de retorno nos próximos 30 dias, impacto por posto.
5. **Qualidade dos dados:** atestados sem CID e sem flag `sem_cid`, afastamentos com motivo não mapeado ou sem previsão, faltas pendentes de confirmação, atestados >15 dias sem afastamento INSS, sobreposições encontradas.

Mapa de calor: faltas por `data_falta`; atestados e afastamentos por dia de início do episódio (explicitado no tooltip).

## 7. Recomendações (regras fixas)

Cada recomendação tem severidade (Alta/Média/Boa), o número que a sustenta e link para o funcionário ou posto. Limiares ficam em um único objeto de configuração em `lib/absenteismo/recomendacoes.ts`:

| Regra | Limiar padrão |
|---|---|
| Secretaria/posto com taxa alta | taxa > 1,5× a taxa geral e ≥ 3 episódios |
| Faltas injustificadas reincidentes | ≥ 3 no mês e nenhuma advertência registrada no mês |
| Falta contínua (possível abandono) | ≥ 30 dias corridos |
| Atestado prolongado sem INSS | atestado > 15 dias sem afastamento INSS no período |
| Episódio INSS próximo | episódio ≥ 45 dias com mesma CID (limite de 60) |
| Concentração em dia da semana | segunda-feira ≥ 30% das faltas, com ≥ 10 faltas no período |
| Pendências de dados | > 10% dos atestados sem CID e sem flag, ou ≥ 5 faltas pendentes de confirmação |
| Melhora (Boa) | queda da taxa ≥ 0,3 p.p. contra o mês anterior |

Aba Visão Executiva mostra as 3 mais relevantes (por severidade, depois por impacto); lista completa na aba Qualidade dos dados e no PDF.

## 8. Arquitetura de código

- `lib/absenteismo/` (puro, testado): `classificar.ts`, `jornadas.ts`, `quadro.ts`, `episodios.ts`, `kpis.ts`, `series.ts`, `recomendacoes.ts`, `tipos.ts`.
- `app/(admin)/relatorios/absenteismo/actions.ts`: `buscarAbsenteismo(filtros)` carrega a janela (mês atual, mês anterior e até 12 meses para a série) com `fetchAllRows`, resolve regimes, delega ao `lib/absenteismo` e devolve o dataset pronto. `page.tsx` permanece Server Component e lê filtros de `searchParams`.
- `components/absenteismo/`: abas, cards de KPI, gráficos, tabela, tooltips, estados vazio/erro; componentes de exportação (`'use client'`; Excel via `lib/export-excel.ts`, PDF via `@react-pdf/renderer`).
- Acesso: mesmo gating de rota que o relatório atual; escopo por posto do supervisor respeitado via RLS e conferido na implementação (revisão com o agente `rls-reviewer`). Revisão de vazamento de CPF/salário nas exportações com `pii-masking-reviewer`.

## 9. Fases de entrega (cada uma com `npm run build` limpo)

1. Motor de cálculo em `lib/absenteismo/` com testes (inclui validação do quadro contra `snapshots_diarios`).
2. Visão Executiva.
3. Abas Ocorrências, Saúde e Disponibilidade.
4. Aba Qualidade dos dados e recomendações.
5. PDF e Excel novos.

## 10. Fora do escopo
- Alterações de schema ou de registros existentes.
- Backfill de histórico anterior a 2026-06-18.
- Substituir ou alterar o relatório "Faltas do Mês" e a Análise Geral.
- Análise por IA (já existe na Análise Geral).
