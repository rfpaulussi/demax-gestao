# Score de risco do funcionário — design

Data: 2026-09-22

## Objetivo

Perfil do funcionário hoje mostra ocorrências (faltas, atestados, advertências) em abas separadas, sem sinal agregado. Objetivo: calcular um **score de risco** combinando esses eventos numa janela de 90 dias e exibir um badge colorido no perfil individual e na lista geral de efetivo, pra identificar rapidamente funcionários com padrão de problema.

## Arquitetura

- **Função pura de cálculo**: novo arquivo `lib/risk-score.ts`. Recebe listas de eventos já filtrados/janelados (faltas, advertências, atestados, movimentações) e devolve `{ score: number, nivel: 'ok' | 'atencao' | 'critico', breakdown: string[] }`. Sem I/O — testável isoladamente.
- **Perfil individual** (`app/(admin)/efetivo/[id]/page.tsx`): já busca `advertencias` e `movimentacoes` por `funcionario_id`. Adicionar `Promise.all` buscando também `faltas` e `atestados` filtrados por `data >= hoje - 90 dias`, passar tudo pra `calcularScoreRisco()`.
- **Lista de efetivo** (`app/(admin)/efetivo/page.tsx`): já faz batch de `atestados`, `faltas`, `coberturas_temporarias` via `.in('funcionario_id', ids)` e monta Maps (linhas ~137, 168, 215). Adicionar batch equivalente de `advertencias` e `movimentacoes`, seguindo o mesmo padrão (sem N+1 novo), e aplicar `calcularScoreRisco()` por funcionário no `.map()` final (linha ~230).

## Pesos (janela de 90 dias)

| Evento | Peso |
|---|---|
| Falta sem justificativa / sem atestado | 3 pts cada |
| Falta com atestado / justificada | 0.5 pt cada |
| Advertência grau leve | 3 pts |
| Advertência grau moderada | 5 pts |
| Advertência grau grave | 8 pts |
| Atestado | 0.3 pt por dia de afastamento |
| Movimentação (mudança posto/função/turno) além da 2ª no período | 1 pt cada movimentação extra |

Grau de advertência não mapeado/null → tratado como "leve" (peso 3), não quebra o cálculo.

**Coberturas temporárias não entram no score diretamente** — são decorrência de falta/atestado que já pontuam por si. Evita dupla contagem do mesmo evento.

## Thresholds (nível do badge)

Score é soma aberta, sem teto máximo.

- `0–4`: verde — "ok"
- `5–9`: amber — "atenção"
- `10+`: vermelho — "crítico" (sem limite superior; o número exato aparece no badge/tooltip pra diferenciar severidade dentro da faixa)

## UI

**Perfil individual**: badge ao lado do status "Ativo" no card principal, ex: `🔴 Risco: 14 pts`. Tooltip ou seção expansível com breakdown textual (ex: "3 faltas sem justificativa (9pt) · 1 advertência grave (8pt)"). Reusa paleta de cores já usada nos cards de métrica do design system do projeto.

**Lista de efetivo**: nova coluna "Risco" na tabela, badge colorido + número, sortable por clique no cabeçalho (ordena desc por score). Sem filtro dedicado nesta primeira versão — só exibição e ordenação.

## Edge cases

- Funcionário sem nenhum evento nos 90 dias → score 0, badge verde "ok" (mostra neutro, não esconde a coluna/badge).
- Grau de advertência ausente/desconhecido → assume peso "leve".
- Sem teto de score — badge sempre mostra o número exato junto da cor.

## Fora de escopo (v1)

- Filtro dedicado por nível de risco na lista de efetivo.
- Comparação com média do posto/secretaria.
- Alertas automáticos/notificações baseados no score.
- Inclusão de coberturas temporárias como fator direto do score.
