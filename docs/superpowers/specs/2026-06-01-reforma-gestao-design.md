# Design: Reforma Demax Gestão Operacional

**Data:** 2026-06-01  
**Status:** Aprovado  
**Autor:** Rodolfo Paulussi  

---

## Contexto

O sistema atual executa mutações destrutivas (desligamento, transferência, mudança de função) diretamente no banco sem aprovação. Este design introduz um fluxo de solicitação + aprovação para operações estruturais, além de reformar o dashboard, criar perfil de funcionário e melhorar a rastreabilidade via tabela `movimentacoes`.

**Stack:** Next.js 14 App Router + TypeScript + Tailwind + @base-ui/react + Supabase  
**Perfis:** admin (Rodolfo), supervisor (7 pessoas), rh (leitura)  
**Escala:** ~1.150 funcionários, 213 postos

---

## Regra de Aprovação

### Execução direta (sem aprovação):
- Lançar atestado
- Lançar falta
- Registrar advertência/suspensão
- Abrir afastamento temporário / registrar retorno
- Abrir/fechar cobertura insalubre
- Registrar férias

### Requer aprovação do admin:
- Desligamento
- Transferência de posto
- Mudança de função → ao aprovar gera PDF de movimentação (stub)
- Mudança de supervisor
- Promoção

---

## Etapa 0 — Types (pré-requisito)

### `types/database.ts` — Adicionar:

```ts
solicitacoes: {
  Row: {
    id: string
    tipo: 'desligamento' | 'transferencia' | 'mudanca_funcao' | 'promocao' | 'mudanca_supervisor'
    status: 'pendente' | 'aprovada' | 'rejeitada'
    funcionario_id: string
    supervisor_id: string | null
    dados_antes: Json | null       // snapshot antes da mudança
    dados_depois: Json | null      // dados solicitados
    motivo: string | null
    observacao_admin: string | null
    aprovado_por: string | null
    aprovado_em: string | null     // timestamptz armazenado como string ISO
    created_at: string | null
  }
  Insert: { /* todos opcionais exceto id(auto), tipo, status(default pendente), funcionario_id */ }
  Update: { /* campos mutáveis: status, observacao_admin, aprovado_por, aprovado_em */ }
}

movimentacoes: {
  Row: {
    id: string
    funcionario_id: string
    tipo: string
    campo_alterado: string | null
    valor_antes: string | null
    valor_depois: string | null
    executado_por: string | null
    solicitacao_id: string | null
    created_at: string | null
  }
  Insert: { /* id auto, funcionario_id obrigatório, tipo obrigatório */ }
  Update: { /* imutável por design — nunca atualizar movimentações */ }
}
```

### `types/index.ts` — Adicionar aliases:
```ts
export type Solicitacao = Tables<'solicitacoes'>
export type Movimentacao = Tables<'movimentacoes'>
export type TipoSolicitacao = 'desligamento' | 'transferencia' | 'mudanca_funcao' | 'promocao' | 'mudanca_supervisor'
export type StatusSolicitacao = 'pendente' | 'aprovada' | 'rejeitada'
```

---

## Etapa 1 — Refatorar `app/(admin)/efetivo/actions.ts`

### Manter + adicionar logging em `movimentacoes`:

**`registrarAtestado`** — mantém lógica atual, adiciona insert em `movimentacoes`:
- tipo='atestado', campo_alterado='status', valor_antes='ativo', valor_depois='afastado'

**`registrarFerias`** — mantém lógica atual, adiciona insert em `movimentacoes`:
- tipo='ferias', campo_alterado='status', valor_antes='ativo', valor_depois='ferias'

**`afastarFuncionario`** — mantém execução direta, adiciona:
- campos no FormData: `data_prev_retorno` (opcional)
- insert em `movimentacoes`: tipo='afastamento', campo_alterado='status', valor_antes=status_atual, valor_depois='afastado'

### Refatorar:

**`desligarFuncionario` → `solicitarDesligamento(formData)`:**
- Não toca mais em `funcionarios`
- Busca snapshot atual do funcionário: `{ nome, status, posto_id, funcao_id }`
- Insere em `solicitacoes`: tipo='desligamento', status='pendente', dados_antes=snapshot, dados_depois=`{data_desligamento, motivo}`, supervisor_id=auth.user.id

### Adicionar:

**`solicitarTransferencia(formData)`:**
- Campos: funcionario_id, posto_destino_id, motivo
- Busca posto_id atual do funcionário → dados_antes=`{posto_id}`
- Insere em `solicitacoes`: tipo='transferencia', dados_depois=`{posto_destino_id, motivo}`

**`solicitarMudancaFuncao(formData)`:**
- Campos: funcionario_id, funcao_destino_id, motivo
- Busca funcao_id atual → dados_antes=`{funcao_id}`
- Insere em `solicitacoes`: tipo='mudanca_funcao', dados_depois=`{funcao_destino_id, motivo}`

**`solicitarPromocao(formData)`:**
- Campos: funcionario_id, funcao_destino_id, motivo
- Mesma estrutura que mudanca_funcao mas tipo='promocao'

### Modais afetados:

**`components/efetivo/modal-desligar.tsx`:**
- Chama `solicitarDesligamento` ao invés de `desligarFuncionario`
- Warning muda para: "Sua solicitação será enviada para aprovação do administrador."
- Props corrigidas: aceita `funcionario: FuncionarioRow` (não mais funcionarioId/funcionarioNome separados)

**`components/efetivo/modal-afastar.tsx`:**
- Props corrigidas: aceita `funcionario: FuncionarioRow`
- Adiciona campo `data_prev_retorno` (date input, opcional)

---

## Etapa 2 — Página de Aprovações

### Arquivos:
```
app/(admin)/aprovacoes/page.tsx
app/(admin)/aprovacoes/actions.ts
components/aprovacoes/aprovacoes-list.tsx
```

### `page.tsx`:
Server component. Busca `solicitacoes WHERE status='pendente' ORDER BY created_at ASC` com joins:
- `funcionarios!funcionario_id(nome, cpf, status, posto_id, funcao_id)`
- `perfis!supervisor_id(nome, email)`

Passa array para `<AprovacoesList>`.

### `components/aprovacoes/aprovacoes-list.tsx`:
Client component. Cada solicitação renderiza um card com:
- Badge colorido do tipo (ver mapa de cores abaixo)
- Nome do funcionário + CPF mascarado
- Supervisor solicitante + data formatada (dd/mm/yyyy)
- Painel lado a lado: `dados_antes` (fundo cinza) → `dados_depois` (fundo verde claro)
- Botão "Aprovar" (bg-green-600) → chama `aprovarSolicitacao(id, obs?)`
- Botão "Rejeitar" (bg-red-600) → expande form inline de motivo (required), chama `rejeitarSolicitacao(id, motivo)`

**Badges de tipo:**
- desligamento → `bg-red-50 text-red-700 ring-red-200`
- transferencia → `bg-blue-50 text-blue-700 ring-blue-200`
- mudanca_funcao → `bg-indigo-50 text-indigo-700 ring-indigo-200`
- promocao → `bg-green-50 text-green-700 ring-green-200`
- mudanca_supervisor → `bg-purple-50 text-purple-700 ring-purple-200`

### `actions.ts`:

**`aprovarSolicitacao(id: string, observacao?: string)`:**
1. Verifica `perfil.role === 'admin'` — lança erro se não
2. Busca solicitação + dados atuais do funcionário
3. Executa UPDATE em `funcionarios` conforme tipo:
   - `desligamento`: `{ status: 'desligado', data_desligamento: dados_depois.data_desligamento }`
   - `transferencia`: `{ posto_id: dados_depois.posto_destino_id }`
   - `mudanca_funcao` / `promocao`: `{ funcao_id: dados_depois.funcao_destino_id }`
   - `mudanca_supervisor`: deactivate old entry in `config_supervisores_postos`, insert new
4. INSERT em `movimentacoes`: tipo=solicitacao.tipo, campo_alterado relevante, valor_antes/depois, solicitacao_id=id
5. UPDATE `solicitacoes`: `{ status: 'aprovada', aprovado_por: auth.user.id, aprovado_em: now(), observacao_admin: observacao }`
6. Se tipo='mudanca_funcao': chamar `gerarPDFMovimentacao(id)` (stub — retorna null)
7. `revalidatePath('/aprovacoes')`, `revalidatePath('/efetivo')`

**`rejeitarSolicitacao(id: string, motivo: string)`:**
1. Verifica `perfil.role === 'admin'`
2. UPDATE `solicitacoes`: `{ status: 'rejeitada', aprovado_por: auth.user.id, aprovado_em: now(), observacao_admin: motivo }`
3. `revalidatePath('/aprovacoes')`

---

## Etapa 3 — Novo Dashboard

### KPIs (6 cards):
| Label | Cor | Query |
|-------|-----|-------|
| Funcionários Ativos | border-t-blue-500 | COUNT funcionarios WHERE status='ativo' |
| Afastados | border-t-orange-500 | COUNT funcionarios WHERE status='afastado' |
| Em Férias | border-t-amber-500 | COUNT funcionarios WHERE status='ferias' |
| Postos em Déficit | border-t-red-500 | COUNT postos WHERE real < previsto |
| Solicitações Pendentes | border-t-violet-500 | COUNT solicitacoes WHERE status='pendente' |
| Coberturas Ativas | border-t-teal-500 | COUNT coberturas_temporarias WHERE status='ativa' |

Grid: `grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6`

### Seção "Aprovações Pendentes":
- Últimas 5 solicitações pendentes ordenadas por `created_at ASC`
- Cada item: badge tipo + nome funcionário + supervisor + data relativa
- Link "Ver todas →" apontando para `/aprovacoes`
- Se não houver pendentes: estado vazio "Nenhuma solicitação pendente"

### Seção "Alertas do Dia":
- **Retornos previstos:** `coberturas_temporarias WHERE data_prev_retorno = today AND status='ativa'` — mostra nome do funcionário e posto
- **Postos em déficit crítico:** postos WHERE (efetivo_previsto - real) >= 2, mostra nome + gap
- **Coberturas insalubres em aberto:** `coberturas_insalubres WHERE status='pendente' AND created_at <= today-7`
- Se todos zerados: badge verde "Nenhum alerta"

### Seção "Efetivo por Secretaria":
Query dinâmica — não fixar secretarias no código.

```sql
-- Para cada secretaria (via postos):
previsto = SUM(postos.efetivo_previsto) WHERE ativo=true
real = COUNT(funcionarios) WHERE status='ativo' AND posto_id IN (postos da secretaria)
```

Renderização: barra de progresso `(real/previsto)*100%`, cor verde se >= 90%, amarela se 70-89%, vermelha se < 70%.

---

## Etapa 4 — Perfil do Funcionário

### Arquivo:
```
app/(admin)/efetivo/[id]/page.tsx
components/efetivo/perfil-tabs.tsx   ← client component para tabs
```

### Header do perfil:
- Nome (text-2xl font-bold)
- CPF mascarado: `***.***.***-**` — **sempre mascarado, inclusive para admin** (completo só em tela de edição futura)
- Badge de status (mesmas cores do sistema)
- Função, posto, secretaria (a partir dos joins)
- Supervisor: buscar via `config_supervisores_postos JOIN perfis WHERE ativo=true AND posto_id=funcionario.posto_id`

### Dados cadastrais:
- data_admissao formatada
- Campos opcionais (escala, horário): exibir apenas se existirem nas colunas do banco; se não existirem, omitir sem erro

### Abas:

**Movimentações** (padrão ao abrir):
- `movimentacoes WHERE funcionario_id = id ORDER BY created_at DESC`
- Timeline vertical: dot colorido, data dd/mm/yyyy HH:mm, tipo, `campo_alterado: valor_antes → valor_depois`, executado_por (nome via JOIN perfis)

**Afastamentos:**
- Filtro do mesmo dataset: `movimentacoes WHERE funcionario_id AND tipo='afastamento'`
- Formato igual à timeline

**Advertências:**
- `advertencias WHERE funcionario_id ORDER BY created_at DESC`
- Colunas: data, tipo, descrição (truncada), status badge

**Solicitações:**
- `solicitacoes WHERE funcionario_id ORDER BY created_at DESC`
- Mostra: badge tipo, data, quem solicitou (supervisor_id JOIN perfis), status badge (pendente/aprovada/rejeitada)

### Simplificação de `components/efetivo/funcionarios-table.tsx`:
- Remove botões: Férias, Afastar, Desligar
- Mantém botão **Atestado** (ação mais usada no dia a dia)
- Adiciona link `<Link href={/efetivo/${f.id}}>Ver perfil →</Link>` como última coluna
- Remove imports de ModalFerias, ModalAfastar, ModalDesligar (que migram para o perfil)
- Remove state machine de modais (simplifica o componente)

---

## Etapa 5 — Sidebar + Badge

### `components/admin/sidebar-nav.tsx`:
- Adiciona `pendingCount: number` como prop
- Adiciona item "Aprovações" (ícone `ClipboardCheck`) antes de "Usuários"
- Badge: `<span className="ml-auto rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{pendingCount}</span>` — renderiza apenas se `pendingCount > 0`
- Redesign de cores:
  - `aside`: `bg-slate-900` (era bg-white)
  - Logo: `text-white` (era text-gray-900)
  - Links inativos: `text-slate-300 hover:bg-slate-800 hover:text-white`
  - Link ativo: `bg-slate-700 text-white`
  - Bordas separadores: `border-slate-700` (era border-gray-100)

### `app/(admin)/layout.tsx`:
- Adiciona query: `COUNT solicitacoes WHERE status='pendente'`
- Passa `pendingCount` para `<SidebarNav>`

---

## Sequência de execução

```
Etapa 0 → compile ✓
Etapa 1 → compile ✓
Etapa 2 → compile ✓
Etapa 3 → compile ✓
Etapa 4 → compile ✓
Etapa 5 → compile ✓
```

Cada etapa só avança após `npm run build` (ou `tsc --noEmit`) retornar zero erros.

---

## Invariantes de segurança

- Nunca deletar registros — apenas atualizar status
- Toda mutação em `funcionarios` executada por aprovação deve ser precedida de insert em `movimentacoes`
- `aprovarSolicitacao` e `rejeitarSolicitacao` exigem `role === 'admin'` antes de qualquer operação
- CPF sempre mascarado em listagens e perfil — visível completo apenas em tela de edição futura
