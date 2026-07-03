# Contexto Compactado — Postos, Insalubridade, Auditoria e Dashboard

**Data da compactação:** 2026-06-23
**Chat original:** ~60 mensagens

---

## 1. Objetivo

Sessão de melhorias múltiplas no sistema demax-gestao (RH municipal). Foram implementadas: tabela de Cobertura Insalubre com ranking/busca, regra dos 3 dias para faltas, botão Solicitar INSS, logs de auditoria, correções no Dashboard, correção de constantes de efetivo, badges duplos em Postos, busca em Postos, e correção do cálculo de insalubridade por posto.

---

## 2. Decisões Tomadas

- **Cobertura Insalubre — coluna % removida:** Sempre era 40% (fixo por lei), não agregava valor visual.
- **Faltas → status afastado apenas a partir de 3 dias:** Atestados marcam afastado desde o 1º dia; faltas só a partir do 3º. Regra implementada em `registrarFalta`.
- **Solicitar INSS via botão em Atestados:** Botão aparece apenas em linhas com `alerta === true` (acumulado > 15 dias), abre modal pré-preenchido com dados do funcionário e data do primeiro atestado.
- **Logs de auditoria em `movimentacoes`:** Reutiliza a tabela existente com novos `tipo`: `edicao_direta`, `exclusao_atestado`, `rejeicao`. Não foi criada tabela nova.
- **Página /auditoria admin-only:** Query em `movimentacoes` com join em `perfis` e `funcionarios`, filtros por usuário/tipo/data, paginação 50/página.
- **Dashboard — AFASTADOS filtrado:** Posto com `secretaria = 'AFASTADOS'` excluído do gráfico "Efetivo por Secretaria" (não tem `efetivo_previsto`, distorcia o gráfico).
- **Dashboard — cor diferenciada:** Verde=exato, azul=excedente (+N), âmbar=déficit leve (≥80%), vermelho=déficit crítico.
- **`FUNCOES_FORA_DO_EFETIVO` corrigida:** Mantidos apenas `JOVEM APRENDIZ` e `LIMPADOR DE VIDROS`. Removidos `SUPERVISOR (A) DE SERVIÇOS` e `AUXILIAR ADMINISTRATIVO` (devem contar no efetivo da SEDE e globalmente).
- **Postos — badges duplos STATUS:** Coluna STATUS mostra dois badges separados: "Aloc: X" e "Insalub: X" (quando cota_insalubridade > 0).
- **Insalubridade por posto — correção da query:** `insalubridade_coberturas` já tem `posto_id` direto; query anterior fazia join desnecessário com `funcionarios` que retornava nulo.

---

## 3. Estado Atual

Tudo implementado, buildado (`npm run build` sem erros) e deployed (push em master → Vercel automático). Sistema em produção: https://demax-gestao.vercel.app

---

## 4. Arquivos e Artefatos Relevantes

| Arquivo | Status | Descrição |
|---------|--------|-----------|
| `components/insalubridade/insalubridade-table.tsx` | Editado | Tabela com busca, filtro supervisor, ranking, cabeçalhos ordenáveis, coluna % removida |
| `app/(admin)/faltas/actions.ts` | Editado | `registrarFalta` atualiza status para `afastado` quando `dias >= 3` |
| `app/(admin)/faltas/page.tsx` | Editado | Aviso âmbar no topo explicando regra dos 3 dias |
| `components/atestados/atestados-client.tsx` | Editado | Botão "Solicitar INSS" em linhas com alerta, modal pré-preenchido |
| `app/(admin)/efetivo/actions.ts` | Editado | `editarFuncionario` loga campos alterados em `movimentacoes` com `tipo: 'edicao_direta'` |
| `app/(admin)/atestados/actions.ts` | Editado | `deleteAtestado` loga exclusão em `movimentacoes` com `tipo: 'exclusao_atestado'` |
| `app/(admin)/aprovacoes/actions.ts` | Editado | `rejeitarSolicitacao` loga rejeição em `movimentacoes` com `tipo: 'rejeicao'` |
| `app/(admin)/auditoria/page.tsx` | Criado | Página admin-only de log de ações; filtros usuario/tipo/data; paginação 50/pág |
| `components/admin/nav-config.ts` | Editado | Adicionado `{ href: '/auditoria', label: 'Auditoria' }` no grupo Administração |
| `components/admin/sidebar-nav.tsx` | Editado | Ícone `ScrollText` mapeado para `/auditoria` |
| `app/(admin)/dashboard/actions.ts` | Editado | Filtra `AFASTADOS` de secretarias; remove cap de 100% no percentual |
| `components/dashboard/efetivo-por-secretaria.tsx` | Editado | Sistema de cores + legenda; exibe `+N`/`-N`/`✓` em vez de `100%` |
| `lib/constants.ts` | Editado | `FUNCOES_FORA_DO_EFETIVO` = apenas `JOVEM APRENDIZ` e `LIMPADOR DE VIDROS` |
| `app/(admin)/postos/actions.ts` | Editado | Busca `insalubridade_atual` via `posto_id` direto; campo `hoje` como objeto `new Date()` |
| `components/postos/postos-client.tsx` | Editado | Campo de busca por nome; badges duplos Aloc/Insalub no STATUS; colunas mescladas |

---

## 5. Código e Configurações Críticas

### Regra 3 dias em registrarFalta
```typescript
if (dias >= 3) {
  await supabase
    .from('funcionarios')
    .update({ status: 'afastado' })
    .eq('id', funcionario_id)
    .eq('status', 'ativo')
}
revalidatePath('/faltas')
revalidatePath('/efetivo')
revalidatePath('/dashboard')
```

### Query insalubridade correta (posto_id direto)
```typescript
supabase
  .from('insalubridade_coberturas')
  .select('funcionario_id, posto_id')
  .eq('mes', mesAtual)
  .eq('ano', anoAtual)
```

### FUNCOES_FORA_DO_EFETIVO (lib/constants.ts)
```typescript
export const FUNCOES_FORA_DO_EFETIVO = [
  'JOVEM APRENDIZ',
  'LIMPADOR DE VIDROS',
] as const
```

### Tipos de log em movimentacoes
- `tipo: 'edicao_direta'` — edição direta de funcionário
- `tipo: 'exclusao_atestado'` — exclusão de atestado
- `tipo: 'rejeicao'` — rejeição de solicitação (motivo em `valor_depois`)

---

## 6. Erros e Armadilhas Conhecidas

- **`deleteAtestado` não tem coluna `dias`:** A tabela `atestados` não armazena `dias` — é calculado. Query de leitura antes da exclusão não deve incluir esse campo.
- **Join `funcionarios!funcionario_id` em `insalubridade_coberturas` retorna nulo:** A tabela já tem `posto_id` direto. Usar campo direto, não join.
- **`(admin)` no path quebra PowerShell:** Para `git add` com caminhos contendo parênteses, usar Bash tool em vez de PowerShell.
- **Fragment JSX em ternário:** Ao adicionar elemento após `</ul>` dentro de um ternário, envolver em `<>...</>`.
- **`createClient()` é síncrono:** Nunca usar `await createClient()`.

---

## 7. Próximos Passos

Nenhum pendente definido nesta sessão. Aguardando novas solicitações do usuário.

---

> **Instrução para o próximo chat:** Este arquivo contém o contexto compactado de um chat anterior do projeto demax-gestao. Use-o como base para continuar o trabalho. Não peça ao usuário para repetir informações que já estão aqui. Comece confirmando brevemente que entendeu o contexto e pergunte por onde o usuário quer continuar.
