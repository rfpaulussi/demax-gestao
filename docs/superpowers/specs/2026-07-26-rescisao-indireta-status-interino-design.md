# Design: Status interino para Rescisão Indireta (aguardando audiência)

**Data:** 2026-07-26
**Escopo:** Fluxo de rescisão indireta em Efetivo (`/efetivo`) e Aprovações (`/aprovacoes`)
**Abordagem:** Reaproveitar e ajustar o fluxo de solicitação "Rescisão Indireta" já existente, em vez de criar mecanismo novo

---

## Contexto

Quando um funcionário avisa que vai entrar com ação de rescisão indireta (Art. 483 CLT) e para de comparecer ao trabalho, o vínculo empregatício continua existindo até a audiência confirmar (ou não) a rescisão. Hoje o sistema não representa esse período intermediário.

Existe hoje um tipo de solicitação dedicado "⚠️ Rescisão Indireta" (`components/efetivo/modal-nova-solicitacao.tsx:418-438`), mas ao ser aprovado ele já finaliza o desligamento na hora (`app/(admin)/aprovacoes/actions.ts:216-226`, `case 'rescisao_indireta'`): seta `status = 'desligado'`, `data_desligamento` e `motivo_desligamento` imediatamente, usando a data em que o funcionário parou de trabalhar como se fosse a data de desligamento oficial. Não existe hoje nenhuma etapa de confirmação pós-audiência — a rescisão é dada como certa no momento do aviso.

Este é exatamente o mecanismo usado hoje para registrar esses casos, e é o que precisa ser desdobrado em duas etapas.

**Permissão confirmada:** o fluxo de solicitação já funciona sem checagem de role além de estar autenticado (`getUser()`), o que já permite supervisor solicitar e admin aprovar — mesmo padrão de todas as outras solicitações deste arquivo (`solicitarDesligamento`, `solicitarTransferencia` etc.). Nenhuma mudança de permissão é necessária.

---

## Seção 1 — Novo status interino no modelo de dados

**Arquivo:** nova migration `supabase/migrations/20260726_status_rescisao_indireta.sql`

Adiciona `'rescisao_indireta'` ao enum de status de `funcionarios`, seguindo o mesmo padrão usado para adicionar `'faltante'` (`supabase/migrations/20260627_status_faltante.sql`):

```sql
ALTER TABLE funcionarios
  DROP CONSTRAINT IF EXISTS funcionarios_status_check;

ALTER TABLE funcionarios
  ADD CONSTRAINT funcionarios_status_check
  CHECK (status IN ('ativo', 'atestado', 'afastado', 'ferias', 'desligado', 'faltante', 'rescisao_indireta'));
```

`types/index.ts:140` — `StatusFuncionario` ganha o novo valor:
```ts
export type StatusFuncionario = 'ativo' | 'afastado' | 'ferias' | 'desligado' | 'atestado' | 'faltante' | 'rescisao_indireta'
```
(hoje esse type já está desalinhado do CHECK real do banco — não inclui `atestado`/`faltante`; ajustar para refletir o CHECK completo, não só adicionar o novo valor.)

**Data em que parou de trabalhar + observação:** não cria colunas novas. Reaproveita a tabela `afastamentos` (`id, funcionario_id, motivo, data_inicio, data_fim_prevista, data_fim_real, solicitacao_id, created_at`), no mesmo padrão que `aprovarSolicitacao` já usa para o `case 'afastamento'` (`app/(admin)/aprovacoes/actions.ts:190-197`): `data_inicio` = data em que parou de trabalhar, `motivo` = observação livre, `data_fim_prevista` = null (fica em aberto até a audiência), `solicitacao_id` vinculado à solicitação.

`posto_id` do funcionário **não é alterado** nessa transição — continua vinculado ao posto de origem, como já acontece hoje nesse fluxo e no de afastamento. Isso é o que já faz o posto aparecer como descoberto nos relatórios de déficit, sem lógica adicional.

---

## Seção 2 — Ajuste no formulário de solicitação

**Arquivo:** `components/efetivo/modal-nova-solicitacao.tsx:418-438`

A opção "⚠️ Rescisão Indireta" muda de sentido: hoje pergunta a "Data da Rescisão" como se já fosse definitiva. Passa a registrar o aviso:

- **Data em que parou de trabalhar** (era "Data da Rescisão"; campo `data_parou_trabalhar`, era `data_rescisao`)
- **Motivo legal** (mantém o select existente: Falta de Pagamento, Desvio de Função, Assédio Moral, Condições de Trabalho Inadequadas, Alteração Contratual Ilícita, Outros)
- **Observação** (novo campo de texto livre, opcional)

O texto de aviso no topo do modal ("Esta solicitação será enviada para aprovação do administrador...") é ajustado para deixar claro que isso registra o aviso/afastamento, não o desligamento em si.

**Arquivo:** `app/(admin)/efetivo/actions.ts:366-393` (`solicitarRescisaoIndireta`)

Passa a ler `data_parou_trabalhar` e `observacao` do FormData e gravar em `dados_depois`:
```ts
dados_depois: { motivo, data_parou_trabalhar, observacao },
```

---

## Seção 3 — Ajuste na aprovação

**Arquivo:** `app/(admin)/aprovacoes/actions.ts:216-226`

```ts
case 'rescisao_indireta': {
  await supabase
    .from('funcionarios')
    .update({ status: 'rescisao_indireta' })
    .eq('id', funcionarioId)

  await supabase.from('afastamentos').insert({
    funcionario_id: funcionarioId,
    motivo:         (dadosDepois.observacao as string | null) || (dadosDepois.motivo as string),
    data_inicio:    dadosDepois.data_parou_trabalhar as string,
    solicitacao_id: sol.id,
  })
  break
}
```

Não seta mais `data_desligamento`/`motivo_desligamento` — isso passa a acontecer só na finalização (Seção 4). A entrada no `campoMap` (linha 298: `rescisao_indireta: { campo: 'status', antes: ..., depois: 'desligado' }`) usada para registrar a movimentação também é ajustada para `depois: 'rescisao_indireta'`.

---

## Seção 4 — Finalização pós-audiência (sem mudança de código)

Quando a audiência confirma a rescisão indireta, o admin desliga o funcionário pelo caminho genérico que já existe: **Nova Solicitação → Desligamento → Judicial → Rescisão Indireta (Art. 483 CLT)** (`components/efetivo/modal-desligar.tsx:54-60`, reaproveitado dentro de `modal-nova-solicitacao.tsx:208-241`).

Esse caminho já está disponível para qualquer funcionário com `status !== 'desligado'` (`components/efetivo/funcionarios-table.tsx:295`), e o novo status `rescisao_indireta` cai no bucket `default: ['desligamento']` de `TIPOS_POR_STATUS` (`modal-nova-solicitacao.tsx:41-45`) — ou seja, quem está nesse status interino só vê a opção "Desligamento" na Nova Solicitação, nada mais. **Nenhuma mudança de código necessária nesta seção.**

---

## Seção 5 — Exibição (badges, contadores, filtros)

Adicionar entrada `rescisao_indireta` (label "Rescisão Indireta", cor roxa — `purple-50/700/200`, não usada por nenhum outro status de funcionário hoje) em:

1. `components/efetivo/funcionarios-table.tsx` — `STATUS_BADGE` (linha 51-61) e `STATUS_ROW` (linha 65-72)
2. `components/efetivo/prontuario-client.tsx` — `STATUS_BADGE` (linha 55-60)
3. `components/efetivo/filtros-efetivo.tsx` — dropdown de filtro por status (linha 7-11)
4. `components/efetivo/efetivo-client.tsx` — mapa de label/cor da exportação Excel (linhas 13-23)

**Card novo no topo do Efetivo** (`app/(admin)/efetivo/page.tsx:184-189`): novo `CounterCard label="Em Processo"` ao lado de Ativos/Afastados/Em Férias, alimentado por uma nova query `count` (`eq('status', 'rescisao_indireta')`) adicionada ao `Promise.all` das linhas 62-94. Grid passa de `lg:grid-cols-4` para `lg:grid-cols-5`.

**Fora desta seção:** dashboard principal (`lib/dashboard-kpis.ts`) não ganha KPI novo — ele resume só ativos/afastados/férias para visão executiva; "em processo" é detalhe operacional do módulo Efetivo.

---

## Fora de escopo

- Reversão para `status = 'ativo'` caso a audiência rejeite a rescisão indireta (tratado manualmente por enquanto, se acontecer)
- Número do processo judicial, vara, ou data prevista de audiência (não solicitados)
- Qualquer mudança no fluxo de aprovação em si (continua pendente → aprovada/rejeitada, sem novo estado)
- Novo KPI no dashboard principal
- Corrigir o gap pré-existente de `prontuario-client.tsx` `STATUS_BADGE` não ter `atestado`/`faltante` (bug antigo, não relacionado a esta feature)

## Arquivos alterados

| Arquivo | Seções |
|---|---|
| `supabase/migrations/20260726_status_rescisao_indireta.sql` (novo) | S1 |
| `types/index.ts` | S1 |
| `components/efetivo/modal-nova-solicitacao.tsx` | S2 |
| `app/(admin)/efetivo/actions.ts` | S2 |
| `app/(admin)/aprovacoes/actions.ts` | S3 |
| `components/efetivo/funcionarios-table.tsx` | S5 |
| `components/efetivo/prontuario-client.tsx` | S5 |
| `components/efetivo/filtros-efetivo.tsx` | S5 |
| `components/efetivo/efetivo-client.tsx` | S5 |
| `app/(admin)/efetivo/page.tsx` | S5 |
