# Alerta de Retorno INSS Vencido — Design

## Contexto

Afastamentos por INSS (`funcionarios.status = 'afastado'`) não têm nenhuma automação de retorno — diferente do status `atestado`, que a rotina diária (`processarRetornosAtestado`, `lib/processar-retornos.ts`) já reverte sozinha pra `ativo` quando o atestado vence. Isso é intencional: retorno de INSS exige confirmação médica/administrativa, não pode reverter sozinho. Mas hoje, se o "Retorno Previsto" (`afastamentos.data_fim_prevista`) passa e ninguém lança o retorno manualmente, nada sinaliza isso pra ninguém — o funcionário fica "esquecido" como afastado indefinidamente sem que admin ou supervisor percebam.

## Objetivo

Mostrar um alerta visual no dashboard (admin e supervisor) listando funcionários cujo retorno previsto de INSS já passou e ainda não foi lançado — mesmo padrão visual dos alertas já existentes (déficit de posto, CAT em atraso, limite de férias).

## Fonte do dado

Tabela `afastamentos`: `data_fim_real IS NULL` (retorno ainda não lançado) **e** `data_fim_prevista <= hoje` (data prevista já passou) **e** o funcionário ainda está com `status = 'afastado'` (segurança extra — se por algum motivo o status já mudou sem atualizar `afastamentos`, não alertar sobre isso).

## Escopo por role

- **Admin/coordenador**: vê todos os retornos vencidos, sem filtro de posto — adicionado em `buscarAlertasDashboard()` (`app/(admin)/dashboard/actions.ts`), renderizado no card "Situação dos Postos" (`components/dashboard/alertas-criticos.tsx`), mesmo local dos alertas de CAT/déficit/férias.
- **Supervisor**: vê só os retornos vencidos dos funcionários dos postos que ele supervisiona — adicionado em `buscarDadosSupervisor()`, filtrado pelos `postoIds` que a função já calcula pra outras métricas. Renderizado dentro do `SupervisorDashboard` (função inline em `app/(admin)/dashboard/page.tsx`), mesmo estilo dos blocos de alerta já existentes lá (atestados ativos, coberturas vencendo).

Sem mudança nos sinos de notificação (`NotificacoesBell`/`SupervisorBell`) — fora de escopo, conforme decidido.

## Tipo compartilhado

```typescript
export type RetornoInssVencido = {
  id: string                // id da linha em afastamentos
  funcionarioId: string
  funcionarioNome: string
  postoNome: string | null
  dataFimPrevista: string    // ISO yyyy-mm-dd
  diasAtraso: number         // hoje - dataFimPrevista, sempre >= 0
}
```

Adicionado a `AlertasDashboard.retornosInssVencidos` e a `DadosSupervisor.retornosInssVencidos`.

## UI

Novo bloco em `AlertasCriticos`, mesmo padrão visual dos blocos de CAT (`border-l-[3px]`, ícone, cor por severidade — usar vermelho já que por definição está sempre atrasado, não tem estado "próximo do prazo"):

```
⏰ Retorno INSS vencido
FULANA DE TAL — SMS · Paço Municipal — venceu há 5 dias (15/11/2026)
```

Clicável, link pra `/efetivo?busca=<nome do funcionário>` (mesmo padrão de link usado noutros alertas do sistema) — de lá o admin/supervisor abre a solicitação de retorno manualmente (fluxo já existente, `solicitarRetornoAfastamento` via `components/efetivo/modal-nova-solicitacao.tsx`).

No `SupervisorDashboard`, mesmo conteúdo/estilo, adaptado ao layout de blocos já usado lá pros outros alertas (atestados ativos, coberturas).

## Fora de escopo

- Automação de retorno (fica manual, decisão de negócio já tomada).
- Mudança nos sinos de notificação.
- Alterar a tabela `afastamentos` ou o fluxo de aprovação existente.
