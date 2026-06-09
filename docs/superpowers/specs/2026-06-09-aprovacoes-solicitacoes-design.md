# Spec: Módulo Aprovações + Solicitações Supervisor
**Data:** 2026-06-09  
**Status:** Aprovado

---

## Contexto

Reforma completa do módulo de aprovações (`app/(admin)/aprovacoes/`) e criação do fluxo de solicitações no painel supervisor (`app/supervisor/solicitacoes/`).

**Fluxo:** Supervisor solicita → Admin aprova/rejeita → sistema executa a alteração automaticamente.

---

## 1. Migração do Banco

### 1.1 ALTER TABLE funcionarios
```sql
ALTER TABLE funcionarios ADD COLUMN IF NOT EXISTS salario NUMERIC(10,2);
```
Salário individual por colaborador. `funcoes.salario_base` continua como referência de piso por função.

### 1.2 ALTER TABLE solicitacoes
```sql
ALTER TABLE solicitacoes
  ADD COLUMN IF NOT EXISTS vigencia DATE,
  ADD COLUMN IF NOT EXISTS motivo_rejeicao TEXT;
```
`observacao_admin` permanece para notas gerais do admin; `motivo_rejeicao` é específico para rejeições.

### 1.3 Atualizar CHECK constraint de tipo
Remover `mudanca_supervisor`, adicionar `alteracao_salario`:
```sql
ALTER TABLE solicitacoes DROP CONSTRAINT IF EXISTS solicitacoes_tipo_check;
ALTER TABLE solicitacoes ADD CONSTRAINT solicitacoes_tipo_check
  CHECK (tipo IN ('transferencia','mudanca_funcao','promocao','desligamento','alteracao_salario'));
```
Rows existentes com `tipo = 'mudanca_supervisor'` devem ser atualizadas para `status = 'rejeitada'` antes de rodar o constraint (ou deletadas se forem dados de teste).

---

## 2. Tipos TypeScript

### types/database.ts
- `funcionarios.Row/Insert/Update`: adicionar `salario: number | null`
- `solicitacoes.Row/Insert/Update`: adicionar `vigencia: string | null`, `motivo_rejeicao: string | null`; atualizar o union de `tipo` para os 5 novos valores

### types/index.ts
- `TipoSolicitacao`: substituir `mudanca_supervisor` por `alteracao_salario`
- Adicionar alias `Solicitacao` se não existir (já existe)

---

## 3. Admin — Aprovações (`app/(admin)/aprovacoes/`)

### 3.1 page.tsx
Server component. Busca:
- KPI counts: pendentes (total), aprovadas no mês atual, rejeitadas no mês atual, total do mês
- Lista completa com joins: `funcionarios`, `perfis` (solicitante), `postos` (atual + proposto via dados_antes/depois)
- Passa dados para o client component de listagem

Filtros: estado local no client component (filtragem no browser, sem searchParams). O server busca todas as solicitações e o client filtra por `q`, `tipo`, `status`, `supervisor_id`.

### 3.2 actions.ts
```ts
buscarSolicitacoes(filtros: FiltrosSolicitacoes): Promise<SolicitacaoCompleta[]>
aprovarSolicitacao(id: string, aprovadoPor: string): Promise<void>
rejeitarSolicitacao(id: string, motivo: string): Promise<void>
buscarDadosFuncionarioParaPDF(funcId: string): Promise<DadosPDF>
buscarSupervisores(): Promise<Perfil[]>
```

`aprovarSolicitacao` executa:
- `transferencia` → `funcionarios.posto_id = dados_depois.posto_destino_id`
- `mudanca_funcao` → `funcionarios.funcao_id = dados_depois.funcao_destino_id`
- `promocao` → `funcionarios.funcao_id = dados_depois.funcao_destino_id`
- `desligamento` → `funcionarios.status = 'desligado'`, `funcionarios.data_desligamento = vigencia`
- `alteracao_salario` → `funcionarios.salario = dados_depois.salario_proposto`

Em todos os casos: inserir registro em `movimentacoes` + atualizar `solicitacoes.status = 'aprovada'`, `aprovado_por`, `aprovado_em`.

### 3.3 components/aprovacoes/aprovacoes-list.tsx
Client component. Recebe `solicitacoes: SolicitacaoCompleta[]` e `supervisores: Perfil[]`.

#### KPI Cards (4)
- **Pendentes** — amber — status='pendente'
- **Aprovadas no mês** — green — status='aprovada' + mês atual
- **Rejeitadas no mês** — red — status='rejeitada' + mês atual
- **Total do mês** — slate

#### Filtros (estado local, filtra client-side)
- Busca por nome do funcionário (input)
- Select tipo (Todos | Transferência | Mudança de função | Promoção | Desligamento | Alteração de salário)
- Select status (Todos | Pendente | Aprovado | Rejeitado)
- Select supervisor

#### Cards de solicitação
Layout por card:
```
[badge tipo]  [badge status]                         [data]
NOME FUNCIONÁRIO
Supervisor: X · Secretaria: Y

SITUAÇÃO ATUAL          | SITUAÇÃO PROPOSTA
Posto: ...              | Posto: ...
Função: ...             | Função: ...
Salário: R$ X           | Salário: R$ Y
Insalubridade: X%       | Insalubridade: Y%

Vigência: DD/MM/YYYY
Motivo: ...

[Rejeitar]  [Aprovar]  [PDF Movimentação]   ← apenas transferencia/mudanca_funcao/promocao
```

Cards com `status != 'pendente'`: `opacity-60`, sem botões de ação. Mostrar `motivo_rejeicao` se rejeitado.

Badges de tipo:
- `transferencia`: bg-blue-100 text-blue-700
- `mudanca_funcao`: bg-purple-100 text-purple-700
- `promocao`: bg-green-100 text-green-700
- `desligamento`: bg-red-100 text-red-700
- `alteracao_salario`: bg-amber-100 text-amber-700

Badges de status:
- `pendente`: bg-yellow-100 text-yellow-700
- `aprovada`: bg-green-100 text-green-700
- `rejeitada`: bg-red-100 text-red-700

#### Modal rejeição
Inline (sem Dialog externo): ao clicar Rejeitar, o card expande mostrando textarea obrigatória + botões Cancelar / Confirmar Rejeição.

---

## 4. Supervisor — Solicitações (`app/supervisor/solicitacoes/`)

### 4.1 page.tsx
Server component. Busca solicitações do supervisor logado (`supervisor_id = auth.user.id`), ordenadas por `created_at desc`. Passa para client component.

### 4.2 actions.ts
```ts
buscarMinhasSolicitacoes(supervisorId: string): Promise<SolicitacaoComFuncionario[]>
criarSolicitacao(data: NovaSolicitacaoInput): Promise<void>
buscarFuncionariosDoSupervisor(supervisorId: string): Promise<FuncionarioComDados[]>
buscarPostosDisponiveis(): Promise<Posto[]>
buscarFuncoesDisponiveis(): Promise<Funcao[]>
```

`criarSolicitacao` monta o snapshot automaticamente:
- `dados_antes`: busca dados atuais do funcionário (posto_nome, funcao_nome, salario, insalubridade_perc)
- `dados_depois`: preenche apenas os campos relevantes para o tipo

### 4.3 components/supervisor/modal-nova-solicitacao.tsx
Client component. Modal com:

**Campos comuns:**
1. Funcionário (autocomplete — busca apenas funcionários dos postos do supervisor logado)
2. Card "Situação atual" (exibe após selecionar funcionário)
3. Tipo (select)
4. Vigência (date)
5. Motivo (textarea obrigatória)

**Campos condicionais por tipo:**
- `transferencia`: select posto destino (todos os postos do contrato)
- `mudanca_funcao`: select função proposta (de `funcoes`) + dados de insalubridade vêm da função selecionada
- `promocao`: select função proposta + input salário proposto (opcional)
- `desligamento`: select motivo (pedido_demissao | demissao_sem_justa | demissao_justa | aposentadoria | outros)
- `alteracao_salario`: input salário proposto (NUMERIC, obrigatório)

### 4.4 components/supervisor/supervisor-nav.tsx
Adicionar tab `{ href: '/supervisor/solicitacoes', label: 'Solicitações' }`.

---

## 5. PDF de Movimentação (`components/aprovacoes/movimentacao-pdf.tsx`)

Componente `'use client'`. Usa `@react-pdf/renderer`. Gerado apenas para `transferencia`, `mudanca_funcao`, `promocao`.

### Layout A4 landscape

**Cabeçalho:**
- Logo "DEMAX" (texto bold) à esquerda
- "MOVIMENTAÇÃO DE COLABORADOR" centralizado
- "Vigência: DD/MM/YYYY" à direita
- Linha com checkboxes: `Transferência [X]  Promoção [ ]  Mudança de função [ ]` — marcado conforme tipo

**Corpo — 2 colunas (Situação Atual | Situação Proposta):**
- Contrato: MOGI LIMPEZA - 706 (fixo)
- Supervisor
- Registro + Nome (fundo amarelo — linha destacada)
- Função
- Salário
- Local (posto)
- Insalubridade: checkbox Sim/Não + percentual (20%/40%)
- Benefícios: checkboxes VT, VR, VA, Prêmio, Sindicato (todos vazios — preenchimento manual)
- Observações: linha em branco

**Rodapé:**
4 campos de assinatura em linha: Data | Coord./Sup. | Segurança do trabalho | Gerente operacional | Coordenador RH

**Nome do arquivo:** `Movimentacao_[NOME_SLUG]_[YYYY-MM-DD].pdf`  
(NOME_SLUG = nome em maiúsculas com underscores, espaços substituídos por `_`)

> Nota: `funcionarios` não possui campo `registro`/`matricula` no schema atual. O arquivo de referência (`Movimentacao_79317_...`) sugere um número de registro, mas esse campo não existe. O PDF usará apenas nome + data no filename até que o campo seja adicionado ao schema.

Download via:
```ts
const blob = await pdf(<MovimentacaoPDF dados={dados} />).toBlob()
const url = URL.createObjectURL(blob)
// click programático no link
```

---

## 6. Snapshot — Estrutura dos JSON blobs

### dados_antes (sempre preenchido na criação)
```json
{
  "posto_id": "uuid-ou-null",
  "posto_nome": "EM João X",
  "funcao_id": "uuid-ou-null",
  "funcao_nome": "Ajudante",
  "salario": 1837.40,
  "insalubridade_perc": 40
}
```

### dados_depois por tipo

**transferencia:**
```json
{ "posto_destino_id": "uuid", "posto_destino_nome": "EM Maria Y" }
```

**mudanca_funcao:**
```json
{ "funcao_destino_id": "uuid", "funcao_destino_nome": "Agente", "insalubridade_perc": 0 }
```

**promocao:**
```json
{ "funcao_destino_id": "uuid", "funcao_destino_nome": "Encarregado", "salario_proposto": 2200.00, "insalubridade_perc": 40 }
```

**desligamento:**
```json
{ "motivo_desligamento": "pedido_demissao" }
```

**alteracao_salario:**
```json
{ "salario_proposto": 1950.00 }
```

---

## 7. Constraints e Regras

- CPF nunca exibido na UI
- Secretarias e postos sempre dinâmicos do banco
- `createClient()` é síncrono neste projeto — nunca usar `await`
- Supervisores buscam apenas funcionários dos seus postos (`config_supervisores_postos`)
- PDF disponível apenas após aprovação E apenas para tipos `transferencia`, `mudanca_funcao`, `promocao`
- `npm run build` deve passar sem erros TypeScript antes de finalizar

---

## 8. Arquivos — Resumo

| Arquivo | Ação |
|---|---|
| `supabase/migrations/YYYYMMDD_solicitacoes_reforma.sql` | Criar — 3 ALTERs |
| `types/database.ts` | Atualizar |
| `types/index.ts` | Atualizar |
| `app/(admin)/aprovacoes/page.tsx` | Reescrever |
| `app/(admin)/aprovacoes/actions.ts` | Reescrever |
| `components/aprovacoes/aprovacoes-list.tsx` | Reescrever |
| `components/aprovacoes/movimentacao-pdf.tsx` | Criar |
| `app/supervisor/solicitacoes/page.tsx` | Criar |
| `app/supervisor/solicitacoes/actions.ts` | Criar |
| `components/supervisor/modal-nova-solicitacao.tsx` | Criar |
| `components/supervisor/supervisor-nav.tsx` | Atualizar |
