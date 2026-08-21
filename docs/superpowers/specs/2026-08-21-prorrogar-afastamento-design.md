# Prorrogar Afastamento — Design

## Contexto

`afastamentos.data_fim_prevista` hoje só é gravada na criação (aprovação da solicitação) e lida na fila de fechamento (`data_fim_real`). Não existe nenhuma tela pra corrigir/estender essa data quando o RH informa um prazo diferente (ex.: perícia do INSS reagendada). Descoberto ao investigar por que o alerta "Retorno INSS Vencido" mostrava a Sonia/Emily com data errada — a correção precisou ser feita via SQL manual, o que não é sustentável.

Também descoberto no processo: é possível existir mais de um registro aberto (`data_fim_real IS NULL`) em `afastamentos` pro mesmo funcionário (achamos e corrigimos 2 casos reais). A feature precisa lidar com isso sem quebrar.

## Objetivo

Botão "Prorrogar" na tela Efetivo, visível pra admin/coordenador em funcionários `status = 'afastado'`, que abre um modal mostrando a data prevista atual e permite salvar uma nova — edição direta, sem fluxo de aprovação (o afastamento original já foi aprovado uma vez).

## Fluxo

1. Botão "Prorrogar" na linha do funcionário (`components/efetivo/funcionarios-table.tsx`), ao lado de Editar/Solicitar/Excluir — mesmo padrão visual (`Button size="sm" variant="outline"`) — visível só quando `f.status === 'afastado'` e `isAdmin` (reaproveita a prop `isAdmin` já passada pra esse componente).
2. Ao clicar, abre `ModalProrrogarAfastamento`, que busca o afastamento aberto do funcionário via nova Server Action `buscarAfastamentoAberto(funcionarioId)`.
3. Se não encontrar nenhum registro aberto (funcionário `afastado` sem linha em `afastamentos` — caso raro, ex. edição manual de status fora do fluxo normal), o modal mostra: "Nenhum afastamento rastreado pra esse funcionário — não é possível prorrogar por aqui." e não oferece o formulário.
4. Se encontrar (e escolhe o **mais recente por `created_at`** se houver mais de um aberto — não deveria acontecer mais após a limpeza de hoje, mas a action lida com isso sem quebrar), mostra a data prevista atual e um campo de data pra nova data prevista.
5. Salvar chama `prorrogarAfastamento(afastamentoId, novaData)`:
   - Valida `novaData >= data_inicio` do registro.
   - Faz `UPDATE afastamentos SET data_fim_prevista = novaData WHERE id = afastamentoId`.
   - Grava em `movimentacoes`: `tipo: 'afastamento'`, `campo_alterado: 'data_fim_prevista'`, `valor_antes`/`valor_depois` com as datas.
   - `revalidatePath('/efetivo')`, `revalidatePath('/dashboard')`.

## Fora de escopo

- Fluxo de aprovação pra prorrogação (edição direta, conforme decidido).
- Resolver/alertar sobre afastamentos duplicados automaticamente (a action só pega o mais recente; duplicatas continuam precisando de limpeza manual pontual, como a de hoje).
- Mudar o botão/local pro alerta do dashboard/sino (fica só na tela Efetivo).
