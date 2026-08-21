# Visibilidade de Afastamentos Sem Data Rastreada — Design

## Contexto

O modal "Prorrogar Afastamento" (sessão anterior) lida corretamente com funcionários `afastado` sem nenhum registro em `afastamentos` (ex.: status setado fora do fluxo normal, como a ADRIANA APARECIDA ALVES) — mostra aviso em vez de quebrar. Mas isso expõe um buraco maior: esses funcionários nunca aparecem no alerta de "Retorno INSS Vencido" (admin nem supervisor), porque o sistema não tem nenhuma data pra saber se venceu. Ficam invisíveis indefinidamente.

## Objetivo

1. Deixar o modal "Prorrogar" também **cadastrar** uma data prevista quando não existe (hoje só edita se já existe) — assim que cadastrada, o funcionário passa a ser rastreado pelos alertas normalmente.
2. Adicionar uma coluna "Retorno Previsto" na tabela Efetivo, visível pra qualquer status `afastado`, mostrando a data cadastrada (ou "sem data" se não houver) — visão geral sem depender só do alerta agregado do dashboard.

## Parte 1 — Prorrogar cadastra quando não existe

Alterar `ModalProrrogarAfastamento`: quando `buscarAfastamentoAberto` retorna `null`, em vez de só mostrar o aviso, mostrar também um formulário com dois campos (`Data de Início` e `Nova Data Prevista de Retorno`) e botão "Cadastrar" — mesmo visual do formulário de edição, só que os dois campos vêm vazios (não tem "data atual" pra mostrar) e o campo Data de Início fica editável (na edição normal ele não aparece, só a data prevista).

**Server Action nova** `cadastrarAfastamentoRastreado(funcionarioId, dataInicio, dataFimPrevista): Promise<ActionResult>` em `app/(admin)/efetivo/actions.ts`:
- Mesmo guard de role (admin/coordenador).
- Valida `dataFimPrevista >= dataInicio`.
- Valida que o funcionário está `status = 'afastado'` (não faz sentido cadastrar afastamento rastreado pra quem não está afastado).
- `INSERT INTO afastamentos (funcionario_id, data_inicio, data_fim_prevista, motivo, solicitacao_id) VALUES (..., ..., ..., null, null)`.
- Log em `movimentacoes`: `tipo: 'afastamento'`, `campo_alterado: 'cadastro_manual'`, `valor_antes: null`, `valor_depois: JSON.stringify({ data_inicio, data_fim_prevista })`.
- `revalidatePath('/efetivo')`, `revalidatePath('/dashboard')`.

## Parte 2 — Coluna "Retorno Previsto" na tabela Efetivo

**`FuncionarioRow`** (`components/efetivo/funcionarios-table.tsx`) ganha campo opcional `data_fim_prevista?: string | null`.

**`app/(admin)/efetivo/page.tsx`**: nova query, mesmo padrão já usado pra `catOrigemMap` (busca só pros `afastadoIds`, pega o mais recente por funcionário via `order('created_at', {ascending: false})` + "primeiro visto vence"): busca `afastamentos` com `funcionario_id IN afastadoIds AND data_fim_real IS NULL`, monta `afastamentoPrevistoMap: Map<string, string | null>`, mescla em `funcionarios` no mesmo `.map()` que já enriquece com `supervisor_nome` etc.

**Coluna nova** em `COLS` e no corpo da tabela: "Retorno Previsto", só populada quando `f.status === 'afastado'` (célula vazia/"—" pros outros status). Regras visuais:
- Sem `data_fim_prevista` (null/undefined): texto cinza "sem data".
- Com data, `data_fim_prevista < hoje`: texto vermelho, data + "(vencido)".
- Com data, `data_fim_prevista >= hoje`: texto normal, só a data formatada.

## Fora de escopo

- Mudar o alerta do dashboard/sino pra também sinalizar "sem data cadastrada" como uma categoria própria (só a coluna na tabela cobre isso por enquanto).
- Qualquer validação de que a data de início "faz sentido" além de não ser depois da data prevista (ex.: não valida contra a data de admissão do funcionário).
