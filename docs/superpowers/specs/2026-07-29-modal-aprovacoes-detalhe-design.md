# Enriquecer aprovações: correção de dados + modal de detalhe

## Contexto

O painel de aprovações (`/aprovacoes`) exibe cada solicitação em um card compacto com um resumo "antes → depois" gerado por `renderInline()`, que faz `Object.entries(dados).filter(([k]) => !k.endsWith('_id'))`. Isso descarta silenciosamente qualquer campo cuja chave termine em `_id` — inclusive quando esse é o único dado relevante disponível (ex: `posto_retorno_id`). Investigação encontrou três problemas concretos que impedem o admin de tomar decisão informada:

1. **Retorno de afastamento não mostra o posto de destino.** `solicitarRetornoAfastamento` salva `posto_retorno_id` (UUID) mas nunca resolve/salva o nome do posto — diferente de `solicitarTransferencia`, que já salva `posto_destino_nome`. Mesmo removendo o filtro de `_id`, o card mostraria um UUID.
2. **Desligamento não trata todos os campos.** O modal de solicitação captura `tipo_desligamento` (Demissão sem justa causa, Judicial, etc.), mas `solicitarDesligamento` nunca lê esse campo do formulário — ele nunca chega a `dados_depois`. Pior: `aprovarSolicitacao` (case `desligamento`) nunca grava `tipo_desligamento` em `funcionarios`, mesmo que o dado existisse — o campo se perde permanentemente ao aprovar.
3. **Turno de destino é invisível.** Quando uma transferência ou mudança de função implica troca de turno (`turno_destino_id`), o id é salvo mas o nome do turno nunca é — ao contrário de `solicitarMudancaHorario`, que já salva `turno_destino_nome` corretamente (padrão a replicar).

Além disso, o painel de impacto no posto (`PostoImpactPanel`, via `calcularImpactoPosto`) só é calculado para `transferencia` e `mudanca_funcao` — desligamento e retorno de afastamento, que também afetam o efetivo de um posto, não mostram esse impacto.

## Objetivo

Corrigir a captura/persistência dos dados que faltam e apresentar as solicitações de forma legível e específica por tipo, com um modal de detalhe para decisão informada — sem alterar o fluxo de aprovação/rejeição já existente.

## Escopo

### 1. Backend — captura e persistência de dados

**`app/(admin)/efetivo/actions.ts`**
- `solicitarDesligamento`: ler `tipo_desligamento` do `FormData` e incluir em `dados_depois`.
- `solicitarRetornoAfastamento`: quando `posto_retorno_id` informado, buscar e salvar `posto_retorno_nome` (mesmo padrão de `solicitarTransferencia`, usando admin client se necessário por RLS). Quando `turno_destino_id` informado, buscar e salvar `turno_destino_nome` (mesmo padrão de `solicitarMudancaHorario`).
- `solicitarTransferencia`, `solicitarMudancaFuncao`: quando `turno_destino_id` informado, buscar e salvar `turno_destino_nome`.

**`app/(admin)/aprovacoes/actions.ts`**
- `aprovarSolicitacao`, case `desligamento`: incluir `tipo_desligamento: dadosDepois.tipo_desligamento` no update de `funcionarios` (coluna já existe, usada por `editarFuncionario`).

Nenhuma migração de banco é necessária — `dados_depois`/`dados_antes` são jsonb; `tipo_desligamento` já existe como coluna em `funcionarios`.

### 2. Impacto no posto para desligamento e retorno

**`app/(admin)/efetivo/impacto.ts`**
- Desligamento: nenhuma mudança de código — chamar `calcularImpactoPosto({ funcionario_id })` sem `posto_destino_id`/`nova_funcao_nome` já cai no branch existente (origem perde 1 do efetivo).
- Retorno de afastamento: funcionário afastado não conta no efetivo atual (`contaNoEfetivo` exige `status === 'ativo'`), então o modelo origem/destino não se aplica — é só entrada. Adicionar parâmetro opcional `apenas_entrada?: boolean`: quando `true`, requer `posto_destino_id` (posto de retorno) e calcula somente o impacto de entrada nesse posto (efetivo atual → atual+1, mesma lógica de insalubridade do bloco "destino" existente), retornando `{ origem: <impacto do posto de retorno> }` (sem `destino`) — `PostoImpactPanel` já renderiza uma única linha rotulada "Posto" quando não há `destino`.

**`app/(admin)/aprovacoes/page.tsx`**
- Estender o loop de pré-cálculo de impacto (hoje só `transferencia`/`mudanca_funcao`) para incluir:
  - `desligamento`: `calcularImpactoPosto({ funcionario_id })`.
  - `retorno_afastamento`: `calcularImpactoPosto({ funcionario_id, posto_destino_id: dados_depois.posto_retorno_id ?? funcionario.posto_id, apenas_entrada: true })`.

### 3. UI — campos explícitos por tipo + modal de detalhe

**Novo: mapa de campos por tipo** (local a definir, provavelmente `components/aprovacoes/campos-solicitacao.ts`), algo como:
```ts
type CampoSolicitacao = { label: string; origem: 'antes' | 'depois'; key: string; format?: (v: unknown) => string }
const CAMPOS_POR_TIPO: Record<TipoSolicitacao, CampoSolicitacao[]>
```
Cada tipo define explicitamente quais campos de `dados_antes`/`dados_depois` exibir e com qual rótulo — substitui o dump genérico e cego de `Object.entries` por uma allowlist curada. Isso resolve o problema de raiz (filtro de `_id`) tanto no resumo do card quanto no modal, porque ambos passam a usar a mesma fonte.

Exemplos de mapeamento:
- **Desligamento**: Data de Desligamento, Tipo de Desligamento, Motivação.
- **Retorno de Afastamento**: Data de Retorno, Posto de Retorno (`posto_retorno_nome`, fallback "mesmo posto atual" se null), Turno (`turno_destino_nome`, se houver), Dia de Curso (se jovem aprendiz).
- **Transferência**: Posto Origem → Destino (nomes), Função (se `nova_funcao_nome` presente), Turno (se `turno_destino_nome` presente).
- **Mudança de Função**: Função Origem → Destino, Motivo, Turno (se houver).
- **Rescisão Indireta**: Data em que Parou de Trabalhar, Motivo, Observação.
- **Afastamento**: Motivo, Data Início, Data Retorno Prevista, Dias.
- **Alteração Salarial**: Salário Atual → Novo.
- **Mudança de Supervisor**: Supervisor Atual → Novo, Motivo.
- **Admissão**: Nome, Função, Posto, Data de Admissão, Registro, Período de Experiência.
- **Mudança de Horário**: Turno Atual → Novo, Dia de Curso (se houver).

**`components/aprovacoes/aprovacoes-list.tsx`**
- `renderInline` é substituído por uma versão que usa `CAMPOS_POR_TIPO` (resumo curto, 1 linha, igual ao visual atual).
- Card ganha botão **"Ver detalhes"** que abre o novo modal. Botões Aprovar/Rejeitar continuam no card exatamente como hoje — fluxo rápido não muda.

**Novo: `components/aprovacoes/modal-detalhe-solicitacao.tsx`**
- Dialog (mesmo padrão de `ModalNovaSolicitacao`, usando `@base-ui/react/dialog`).
- Header: badge do tipo, nome do funcionário, CPF mascarado, solicitante, data da solicitação.
- Corpo: lista de campos via `CAMPOS_POR_TIPO` (rótulo + valor, sem dump genérico).
- `PostoImpactPanel`, cobrindo agora todos os tipos da Seção 2 (transferência, mudança de função, desligamento, retorno de afastamento).
- Ações Aprovar/Rejeitar reaproveitando `aprovarSolicitacao`/`rejeitarSolicitacao` (mesma lógica do card, sem duplicação — extrair a lógica de pending/erro do `SolicitacaoCard` para um hook compartilhado ou passar callbacks, decidir na fase de plano).

## Fora de escopo

- Mudança de schema/migração — tudo cabe nas colunas/jsonb existentes.
- Alteração do fluxo de aprovação/rejeição em si (regras de negócio de `aprovarSolicitacao` permanecem as mesmas, só ganham os campos que faltavam).
- Redesenho visual do card compacto além do botão "Ver detalhes".

## Critérios de aceite

- Desligamento aprovado grava `tipo_desligamento` em `funcionarios`.
- Retorno de afastamento mostra nome do posto de destino (ou "mesmo posto atual" quando não trocou) e nome do turno (quando aplicável), tanto no resumo do card quanto no modal.
- Transferência/mudança de função com troca de turno mostram o nome do turno, não só o id.
- Card de desligamento e retorno de afastamento exibem painel de impacto no posto.
- Nenhum campo é ocultado só por terminar em `_id` — a exibição é sempre uma allowlist explícita por tipo.
- `npm run build` passa sem erros.
