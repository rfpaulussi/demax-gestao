# Contexto Compactado — Postos/Efetivo/Faltas: cálculos, filtros e exports

**Data da compactação:** 2026-06-30
**Chat original:** ~40 mensagens

---

## 1. Objetivo

Corrigir cálculo de efetivo nos postos (férias não contavam como ausência), adicionar filtro por posto na aba Efetivo, adicionar export Excel na aba Faltas, e entender como o sistema encerra coberturas/atestados/faltas automaticamente.

---

## 2. Decisões Tomadas

- **Férias NÃO contam no efetivo_atual:** Funcionário com status `ferias` incrementa apenas `feriasMap` (badge 🌴) e pula `efetivoMap` via `continue`. Posto fica com déficit real quando alguém está de férias.
- **Filtro por posto no Efetivo:** Adicionado como select extra em `filtros-efetivo.tsx`, independente dos outros filtros (secretaria, supervisor, status, busca).
- **Excel em Faltas:** Botão ao lado de "+ Registrar Falta", exporta todas as colunas do período filtrado. Nome: `faltas_Mês_Ano.xlsx`.
- **Encerramento automático = final do dia:** `data_prev_retorno = hoje` → cobertura ainda ativa. `data_fim = hoje` → atestado/falta ainda ativo. Funcionário retorna na manhã do dia seguinte.
- **CIDs R42 e grupo R:** Migração rodada no Supabase (`supabase/migrations/20260626_add_cid_r42_grupo_r.sql`).

---

## 3. Estado Atual

Tudo commitado e deployado em produção (`63a0b22`). Sistema funcionando com:
- Postos com férias mostrando déficit correto
- Badge 🌴 X em férias na coluna Status dos postos
- Filtro por posto na aba Efetivo
- Export Excel na aba Faltas
- CIDs R42/R50.9/R53/R55/R60.0/R61/R68.8 disponíveis

---

## 4. Arquivos e Artefatos Relevantes

| Arquivo | Status | Descrição |
|---------|--------|-----------|
| `app/(admin)/postos/actions.ts` | Editado | `continue` após `feriasMap` — férias não entram no efetivo |
| `components/efetivo/filtros-efetivo.tsx` | Editado | `FiltrosValues` + `FiltrosCounts` + select de posto |
| `components/efetivo/efetivo-client.tsx` | Editado | Filtro `posto_id`, `postoCounts`, passa `postos` ao FiltrosEfetivo |
| `components/faltas/faltas-client.tsx` | Editado | `exportFaltasExcel()` + botão Excel |
| `supabase/migrations/20260626_add_cid_r42_grupo_r.sql` | Executado | CIDs grupo R inseridos |

---

## 5. Código e Configurações Críticas

### Férias não contam no efetivo (`postos/actions.ts` ~linha 179)
```typescript
// Férias: registra badge mas NÃO entra no efetivo_atual (posto fica com déficit)
if (f.status === 'ferias') {
  feriasMap.set(f.posto_id, (feriasMap.get(f.posto_id) ?? 0) + 1)
  continue  // ← pula efetivoMap
}
```

### Lógica de encerramento automático
```typescript
// coberturas: encerra quando data_prev_retorno < hoje (retorno = dia seguinte)
.lt('data_prev_retorno', hoje)

// atestados/faltas: ainda ativo se data_fim >= hoje (retorno = dia seguinte)
.gte('data_fim', hoje)
```

---

## 7. Próximos Passos

- [ ] Nenhum combinado — aguardar próxima demanda do usuário

---

> **Instrução para o próximo chat:** Este arquivo contém o contexto compactado de um chat anterior. Use-o como base para continuar o trabalho. Não peça ao usuário para repetir informações que já estão aqui. Comece confirmando brevemente que entendeu o contexto e pergunte por onde o usuário quer continuar.
