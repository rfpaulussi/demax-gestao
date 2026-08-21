# Visibilidade do Alerta de Retorno INSS — Design

## Contexto

O alerta "Retorno INSS vencido" (implementado em sessão anterior) hoje só aparece no fim de uma lista rolável no dashboard — pouco visível, e supervisores raramente abrem o dashboard. Precisa de dois reforços: mais destaque visual quando o dashboard é aberto, e um canal que alcance quem não abre o dashboard (sino de notificação), tanto pra admin quanto pra supervisor.

## Objetivo

1. Tornar o alerta visível sem precisar rolar a tela.
2. Notificar admin via sino (`NotificacoesBell`) — reusa infraestrutura já existente (`log_supervisor_acoes`, cron `snapshot-diario`, padrão idêntico ao `alerta_ferias`).
3. Notificar supervisor via sino (`SupervisorBell`) — hoje esse sino só mostra status de solicitações que o próprio supervisor enviou; não existe canal de "alerta do sistema" pra ele. Cria esse canal do zero, genérico o bastante pra servir outros alertas futuros (não hardcoded só pra INSS).

## Parte 1 — Destaque visual (sem card novo)

Os cards de KPI do topo do dashboard já têm um campo opcional `aviso` (texto pequeno abaixo do número, usado hoje em "Em Férias" pra mostrar "N vencem em 30 dias"). Reaproveitar esse campo:

- **Admin** (`app/(admin)/dashboard/page.tsx`, card "Afastados"): adicionar `aviso={alertas.retornosInssVencidos.length > 0 ? \`${n} com retorno vencido\` : undefined}`. O dado já está carregado (`alertas` vem de `buscarAlertasDashboard()`, já no `Promise.all` existente) — nenhuma query nova.
- **Supervisor** (`SupervisorDashboard`, card "Ausentes"): o `aviso` desse card já é montado concatenando partes (`X atestados, Y INSS, Z faltantes`). Adicionar mais uma parte: `N com retorno vencido` quando `retornosInssVencidos.length > 0`.

Sem mudança de layout, sem card novo, sem query nova — só reaproveita dado que já existe.

## Parte 2 — Sino do admin

Espelha exatamente `alertarFeriasVencendo()` em `app/api/cron/snapshot-diario/route.ts`:

- Nova função `alertarRetornosInssVencidos(supabase, hoje)`: busca `afastamentos` vencidos (mesma query já usada em `buscarAlertasDashboard`), se houver algum, faz upsert (atualiza se já existe registro de hoje, senão insere) em `log_supervisor_acoes` com `tipo: 'alerta_retorno_inss'`, `detalhes: JSON.stringify({ vencidos: [...nomes], total })`.
- `NotificacoesBell` (`components/admin/notificacoes-bell.tsx`): adicionar `alerta_retorno_inss` em `TIPO_ICON`/`TIPO_LABEL`, e um case em `renderConteudo()` mostrando a lista de nomes + link pra `/efetivo`.

## Parte 3 — Sino do supervisor (canal novo)

**Tabela nova** `alertas_supervisor` — genérica, não específica de INSS, pra servir de base a alertas futuros direcionados a um supervisor:

```sql
CREATE TABLE alertas_supervisor (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  supervisor_id uuid        NOT NULL REFERENCES perfis(id) ON DELETE CASCADE,
  tipo          text        NOT NULL,
  titulo        text        NOT NULL,
  detalhes      text,
  lido          boolean     NOT NULL DEFAULT false
);

CREATE INDEX idx_alertas_supervisor_supervisor ON alertas_supervisor(supervisor_id, lido);

ALTER TABLE alertas_supervisor ENABLE ROW LEVEL SECURITY;

CREATE POLICY "supervisor le proprios alertas" ON alertas_supervisor
  FOR SELECT USING (supervisor_id = auth.uid());

CREATE POLICY "supervisor atualiza proprios alertas" ON alertas_supervisor
  FOR UPDATE USING (supervisor_id = auth.uid()) WITH CHECK (supervisor_id = auth.uid());
```

Cron insere via `createAdminClient()` (bypassa RLS, mesmo padrão já usado no resto do cron); leitura/atualização do supervisor passa pela RLS acima.

**Cron** (`app/api/cron/snapshot-diario/route.ts`): nova função `alertarRetornosInssVencidosSupervisores(supabase, hoje)`:
1. Busca todos os `afastamentos` vencidos (mesma query da Parte 2), com o `posto_id` do funcionário.
2. Busca `config_supervisores_postos` (ativo=true) pra montar mapa `posto_id → supervisor_id[]`.
3. Agrupa os vencidos por supervisor (via o posto do funcionário — inclui postos do bucket AFASTADOS, que já pertencem a um supervisor específico igual qualquer outro posto).
4. Pra cada supervisor com pelo menos 1 vencido, upsert (atualiza se já existe registro de hoje pra aquele supervisor+tipo, senão insere) em `alertas_supervisor`: `tipo: 'retorno_inss_vencido'`, `titulo`, `detalhes: JSON.stringify({ nomes: [...], total })`.

**Server Action nova** `marcarAlertasSupervisorLidos()` em `app/(admin)/notificacoes/actions.ts` — mesmo padrão de `marcarSolicitacoesLidasSupervisor()`, mas em `alertas_supervisor`.

**UI** — estender `SupervisorBell` (`components/admin/supervisor-bell.tsx`) pra receber dois novos props (`alertasUnread: number`, `alertas: AlertaSupervisor[]`) e mesclar essa lista com as `notifs` (solicitações) existentes na exibição — badge de não-lidos soma os dois. `app/(admin)/layout.tsx` busca `alertas_supervisor` do supervisor logado junto com `supNotifs` já buscado hoje, no mesmo `Promise.all`.

## Fora de escopo

- Envio de e-mail/push (fica só no sino + card, por enquanto).
- Alterar o comportamento do badge "⚠️ Avaliar INSS" ou qualquer outra lógica de negócio já existente do módulo Atestados.
- Migrar `log_supervisor_acoes` pra reaproveitar como canal do supervisor — tabela nova, separada, propositalmente (evita misturar "log de ações do supervisor" com "alertas pro supervisor", semânticas diferentes).
