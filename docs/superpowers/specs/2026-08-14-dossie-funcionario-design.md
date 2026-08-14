# Dossiê do Funcionário (reformulação de /ocorrências)

## Contexto / Problema

A página `/ocorrencias` atual centra o registro em **unidade (posto)**: cria-se uma ocorrência escolhendo um posto e opcionalmente um supervisor, sem vínculo com um funcionário específico. Na prática, os problemas do admin/supervisor são quase sempre sobre uma **pessoa** (atestados, advertências, faltas, conduta), espalhados em telas diferentes (`/advertencias`, `/atestados`, `/faltas`, `/ocorrencias`). Clicar no nome da unidade numa linha da tabela não leva a lugar nenhum — não existe drill-down por funcionário.

## Objetivo

Substituir `/ocorrencias` por um **dossiê do funcionário**: ponto único onde admin e supervisor veem e registram o histórico disciplinar/de saúde/frequência de uma pessoa (advertências, atestados, faltas, ocorrências de conduta), com o posto/secretaria disponível apenas como filtro auxiliar de busca — não mais como eixo central do registro.

## Escopo

Inclui:
- Migração da tabela `ocorrencias` para vincular a `funcionario_id`.
- Nova página `/ocorrencias` (mesma rota) com busca de funcionário + modal de dossiê.
- Agregação read-only de `advertencias`, `atestados`, `faltas` na timeline do dossiê.
- CRUD de `ocorrencias` (conduta/geral) permanece, agora preso ao funcionário.
- Feature de "Alerta" (lembrete pessoal do supervisor) mantida, sem vínculo a funcionário, como seção separada na mesma página.

Fora de escopo:
- Mudanças nas telas `/advertencias`, `/atestados`, `/faltas` em si (continuam sendo a origem do registro desses tipos).
- Renomear a rota (`/ocorrencias` continua sendo a URL; o rótulo no menu pode virar "Ocorrências" ou similar, mantendo item único).

## Modelo de dados

### Migração `ocorrencias`

```sql
ALTER TABLE ocorrencias ADD COLUMN funcionario_id UUID REFERENCES funcionarios(id);
CREATE INDEX idx_ocorrencias_funcionario_id ON ocorrencias(funcionario_id);
```

- `funcionario_id` é **nullable**: registros antigos (tipo `alerta`, ou ocorrências legadas sem funcionário) continuam válidos e visíveis na seção de Alertas ou como órfãos no histórico bruto (não aparecem em nenhum dossiê, pois não têm funcionário — aceitável, são residuais).
- Novo registro de `tipo = 'ocorrencia'` passa a **exigir** `funcionario_id` (validado na Server Action, não no banco, pra não quebrar linhas antigas).
- `posto_id` continua existindo na tabela (não remover coluna), mas passa a ser **auto-preenchido** a partir do posto atual do funcionário no momento da criação — deixa de ser campo do formulário.
- `tipo = 'alerta'` continua sem `funcionario_id` e sem `posto_id` (comportamento atual inalterado).

### RLS

- Policy `ocorrencias_admin_all` inalterada.
- Policy `ocorrencias_supervisor_select`/`insert`: troca a condição de `posto_id IN (SELECT get_supervisor_posto_ids())` para considerar o posto atual do funcionário (`funcionario_id` → `funcionarios.posto_id` → `IN (SELECT get_supervisor_posto_ids())`), preservando o `OR` que já existe pra alertas (`tipo = 'alerta' AND supervisor_id = auth.uid()`).

## Página `/ocorrencias`

### Estado "busca" (padrão ao abrir)

- Campo de busca por nome/CPF (mascarado) com resultados incrementais (client-side sobre lista de funcionários já carregada, como o `ModalAdvertencia` faz hoje).
- Filtro secundário opcional por secretaria/posto, só pra restringir a lista de busca — não filtra histórico.
- Supervisor só busca entre funcionários dos seus postos (mesma lógica de `getPostosSimples`/`config_supervisores_postos` hoje).
- Seção "Meus Alertas" (colapsável) no topo ou lateral: lista os alertas abertos do supervisor logado (ou todos, se admin/coordenador), com o mesmo fluxo de criar/resolver que existe hoje. Não aparece pra quem não tem alertas e não é foco principal da tela.

### Modal Dossiê (abre ao clicar num funcionário)

Modal grande (`max-w-4xl` ou similar), fecha e volta pro estado de busca sem perder o que foi digitado.

**Header:**
- Nome, matrícula/RE, CPF mascarado, posto + secretaria atuais.

**KPIs (linha de cards, como os `CounterCard` já existentes):**
- Advertências (total)
- Dias de atestado (últimos 12 meses)
- Faltas (total)
- Ocorrências abertas

**Timeline unificada:**
- Uma lista única, ordenada por data desc, mesclando os 4 tipos.
- Chips de filtro por tipo: Todos / Advertência / Atestado / Falta / Ocorrência.
- Filtro de período (últimos 3/6/12 meses / tudo).
- Cada item mostra: ícone/cor por tipo, data, resumo (ex: advertência → grau + natureza; atestado → período + motivo; falta → tipo + dias; ocorrência → gravidade + descrição).
- Itens de `advertencias`, `atestados`, `faltas` são **somente leitura** aqui (clicar leva/linka pra tela de origem se fizer sentido; não é obrigatório no MVP).
- Itens de `ocorrencias` mantêm as ações que já existem hoje (mudar status: Em Análise / Encerrar).

**Registro de nova ocorrência:**
- Botão "Nova Ocorrência" dentro do modal abre o form já preso ao funcionário — sem campo de seleção de posto (vem do contexto) e sem campo de funcionário (já selecionado). Campo de supervisor mantido (pode ficar em branco).
- Reaproveita `createOcorrencia`, adaptada pra receber `funcionario_id` obrigatório e derivar `posto_id` do funcionário no server.

## Server actions (`app/(admin)/ocorrencias/actions.ts`)

Novas/alteradas:
- `getFuncionariosParaBusca()`: lista enxuta de funcionários (id, nome, cpf, posto, secretaria) respeitando escopo do supervisor — similar ao que `ModalAdvertencia` já consome de `/advertencias/actions`.
- `getDossieFuncionario(funcionarioId)`: busca em paralelo `advertencias`, `atestados`, `faltas`, `ocorrencias` do funcionário + dados do funcionário, monta a timeline unificada no server (menos trabalho no client).
- `createOcorrencia`: passa a exigir `funcionario_id`, deriva `posto_id` do funcionário.
- `updateStatusOcorrencia`, `criarAlerta`, `resolverAlerta`: mantidas como estão (RLS supervisor de `updateStatusOcorrencia` ajustada pra nova regra de posto via funcionário).
- Remove `getOcorrenciasData` (lista bruta de ocorrências) e `getPostosSimples`/`getSupervisoresSimples` como estavam — supervisores continuam sendo usados no form, postos deixam de ser necessários como campo de formulário mas a lista de funcionários precisa do posto/secretaria pra exibição e filtro de busca.

## Permissões

Igual ao padrão do projeto:
- `admin`/`coordenador`: acesso total, todos os funcionários.
- `supervisor`: apenas funcionários dos postos configurados em `config_supervisores_postos`; pode criar ocorrências e ver o dossiê completo (advertências/atestados/faltas são informativos, não editáveis por ele de qualquer forma).
- `viewer`: leitura, sem botão de "Nova Ocorrência" nem ações de status (mesma regra atual: bloqueado em `createOcorrencia`/`updateStatusOcorrencia`).

## Testes / verificação

- `npm run build` limpo.
- Fluxo manual: buscar funcionário como admin → abrir dossiê → ver itens dos 4 tipos → criar ocorrência → status muda pra Em Análise/Encerrada.
- Fluxo manual como supervisor: só vê funcionários dos seus postos na busca; RLS bloqueia dossiê de funcionário fora do escopo (testar via `getDossieFuncionario` retornando vazio/erro).
- Conferir que `tipo = 'alerta'` continua funcionando sem `funcionario_id`.
