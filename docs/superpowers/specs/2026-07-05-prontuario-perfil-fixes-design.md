# Design: Correções Ver Perfil + Prontuário

**Data:** 2026-07-05  
**Escopo:** Bugs e labels nas telas Ver Perfil (`/efetivo/[id]`) e Prontuário (`/efetivo/[id]/historico`)  
**Abordagem:** Opção A — correções pontuais nos arquivos afetados, sem refatoração de contrato

---

## Contexto

Análise das telas Ver Perfil, Prontuário (linha do tempo + histórico por mês) e PDF exportado revelou 5 bugs e 4 problemas de labels. Todos corrigíveis de forma independente, sem alterar contratos entre componentes.

---

## Seção 1 — Deduplicação de eventos (B1 + B2)

**Problema:**
- B1: `historico_funcionarios` contém entradas duplicadas para advertências de 09/04 e 14/05. Causa raiz confirmada: backfill manual rodou duas vezes em 18/06/2026 (18:41 e 18:48), inserindo os mesmos registros em ambas as rodadas. Registros duplicados identificados: `38af4003-67d0-4884-8db1-2e79ad6ca44c` e `85a2fae5-49ba-42c9-bce7-0b00269b3f45`.
- B2: Dois pares de `afastamento` + `retorno_afastamento` no mesmo dia 18/06 (4 eventos no lugar de 2).

**Solução — duas camadas:**

**1a. Limpeza no banco (B1 apenas):** Deletar os 2 registros da segunda rodada do backfill. Conteúdo é idêntico ao par original — sem perda de informação.

```sql
DELETE FROM historico_funcionarios
WHERE id IN (
  '38af4003-67d0-4884-8db1-2e79ad6ca44c',
  '85a2fae5-49ba-42c9-bce7-0b00269b3f45'
);
```

A ser executado via Supabase Dashboard → SQL Editor, antes do deploy.

**1b. Dedup em código (B1 + B2 — salvaguarda):** Em `app/(admin)/efetivo/[id]/historico/page.tsx`, após montar o array `eventos`, aplicar dedup por `tipo + data`. Protege contra duplicatas futuras de qualquer origem.

```ts
const deduped = new Map<string, ProntuarioEvento>()
for (const e of eventos) {
  const key = `${e.tipo}:${e.data}`
  if (!deduped.has(key)) deduped.set(key, e)
}
const eventosFinal = [...deduped.values()]
eventosFinal.sort((a, b) => b.data.localeCompare(a.data))
```

**Ordem de execução em `historico/page.tsx`:** S2 (UUID resolution) roda antes de S1b (dedup), pois o dedup opera nos dados já com nomes resolvidos.

**Impacto:** Banco limpo + exibição protegida para futuros casos similares.

---

## Seção 2 — Resolução de UUIDs de posto (B3 + B4)

**Arquivo:** `app/(admin)/efetivo/[id]/historico/page.tsx`

**Problema:**
- B3: Evento `mudanca_posto` exibe `posto_id: UUID → posto_id: UUID` na timeline e no PDF
- B4: `buildHistoricoMes` busca `d.posto` (nome) mas `dados_novos` tem `{ posto_id: UUID }` → julho continua mostrando posto antigo

**Solução:** No server, após montar `eventos`, varrer todos os `dados_novos` e `dados_anteriores` buscando chave `posto_id` com valor UUID. Coletar IDs únicos, fazer `select('id, nome')` em `postos`, substituir `{ posto_id: UUID }` por `{ posto: 'Nome' }` in-place antes de passar ao client.

```ts
// 1. Coletar UUIDs
const postoIdSet = new Set<string>()
for (const e of eventos) {
  const dn = e.dados_novos
  const da = e.dados_anteriores
  if (isUUID(dn?.posto_id)) postoIdSet.add(dn.posto_id as string)
  if (isUUID(da?.posto_id)) postoIdSet.add(da.posto_id as string)
}
// 2. Buscar nomes
const { data: postosRows } = postoIdSet.size > 0
  ? await supabase.from('postos').select('id, nome').in('id', [...postoIdSet])
  : { data: [] }
const postoNomeMap = Object.fromEntries((postosRows ?? []).map(p => [p.id, p.nome]))
// 3. Substituir nos eventos
for (const e of eventos) {
  if (isUUID(e.dados_novos?.posto_id))
    e.dados_novos = { ...e.dados_novos, posto: postoNomeMap[e.dados_novos.posto_id as string], posto_id: undefined }
  if (isUUID(e.dados_anteriores?.posto_id))
    e.dados_anteriores = { ...e.dados_anteriores, posto: postoNomeMap[e.dados_anteriores.posto_id as string], posto_id: undefined }
}
```

**Impacto:** Timeline e PDF exibem nome do posto. `buildHistoricoMes` passa a encontrar `d.posto` e atualiza o estado para julho corretamente.

---

## Seção 3 — Normalização de status (B5)

**Arquivo:** `components/efetivo/prontuario-client.tsx`

**Problema:** `historico_funcionarios` pode armazenar `status` em uppercase (`'ATIVO'`). `STATUS_BADGE` usa keys lowercase. Lookup falha → exibe texto bruto sem badge.

**Solução:** Em `buildHistoricoMes`, em todo ponto onde `d.status` é atribuído ao `state.status`, normalizar:

```ts
if (d.status) state.status = (d.status as string).toLowerCase()
```

Afeta os cases: `admissao`, `transferencia`, `desligamento`, `reativacao`, `afastamento`, `retorno_afastamento`.

**Impacto:** Todos os meses passam a exibir badge colorido correto.

---

## Seção 4 — Labels no PDF (L3 + L4)

**Arquivo:** `components/efetivo/prontuario-pdf-doc.tsx`

**L3 — Tipos faltando no TIPO_LABEL:**
```ts
retorno_afastamento: 'Retorno de Afastamento',
afastamento:         'Afastamento',  // já existe mas confirmar
```
O `EVENT_CONFIG` do client usa 'Retorno Afastamento' (sem "de") — alinhar para 'Retorno de Afastamento' em ambos.

**L4 — Dados técnicos brutos no PDF:**
Criar função `translateValue(k: string, v: string): string` com mapa de valores comuns e aplicar em `dadosText()`. Também capitalizar chaves.

```ts
const VALUE_LABELS: Record<string, string> = {
  falta_injustificada:  'Falta injustificada',
  advertencia_escrita:  'Advertência escrita',
  verbal:               'Verbal',
  suspensao:            'Suspensão',
  ativo:                'Ativo',
  afastado:             'Afastado',
  gerada:               'Gerada',
  pendente:             'Pendente',
  entregue:             'Entregue',
  falta:                'Falta',
  sem_justificativa:    'Sem justificativa',
  true:                 'Sim',
  false:                'Não',
}
const KEY_LABELS: Record<string, string> = {
  status:       'Status',
  natureza:     'Natureza',
  tipo:         'Tipo',
  grau:         'Grau',
  dias_suspensao: 'Dias de suspensão',
  data_ocorrencia: 'Data da ocorrência',
  posto:        'Posto',
  supervisor:   'Supervisor',
  cargo:        'Cargo',
  cid:          'CID',
  motivo:       'Motivo',
}
```

**Impacto:** PDF exibe dados legíveis em vez de snake_case técnico.

---

## Seção 5 — Labels em perfil-tabs (L1 + L2)

**Arquivo:** `components/efetivo/perfil-tabs.tsx`

**L1 — Tipo da movimentação:**
`TabMovimentacoes` e `TabSolicitacoes` usam `.replace(/_/g, ' ')` com capitalize CSS → perde acentos.

Solução: usar `TIPO_LABELS[m.tipo] ?? m.tipo.replace(/_/g, ' ')` nos itens da lista. O mesmo map já usado no banner "Último Termo".

Para `TabSolicitacoes`, o map de tipos de solicitação cobre: `desligamento`, `transferencia`, `mudanca_funcao`, `promocao`, `alteracao_salario`, `mudanca_supervisor`, `afastamento`, `retorno_afastamento`, `rescisao_indireta`, `admissao`.

**L2 — Tipo de advertência:**
Criar `ADV_TIPO_LABELS`:
```ts
const ADV_TIPO_LABELS: Record<string, string> = {
  escrita:             'Escrita',
  advertencia_escrita: 'Adv. Escrita',
  verbal:              'Verbal',
  suspensao:           'Suspensão',
}
```
Usar em `TabAdvertencias`: `ADV_TIPO_LABELS[a.tipo ?? ''] ?? a.tipo ?? '—'`

**Impacto:** Todas as labels das abas ficam corretas, com acentos e formatação adequada.

---

## Arquivos alterados

| Arquivo | Seções |
|---|---|
| `app/(admin)/efetivo/[id]/historico/page.tsx` | S1 (dedup), S2 (UUID) |
| `components/efetivo/prontuario-client.tsx` | S3 (status) |
| `components/efetivo/prontuario-pdf-doc.tsx` | S4 (labels PDF) |
| `components/efetivo/perfil-tabs.tsx` | S5 (labels perfil) |

## Fora de escopo

- Corrigir root cause de duplicatas no trigger do banco
- Adicionar supervisor ao header do prontuário (M1)
- Link para prontuário no Ver Perfil (M2)
- Agrupamento de eventos no perfil (M3)
- Sistema de alertas por email
