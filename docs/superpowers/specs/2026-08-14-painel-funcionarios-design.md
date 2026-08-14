# Painel de Funcionários (tela inicial de /ocorrencias)

## Contexto

A tela inicial de `/ocorrencias` (implementada na feature anterior, dossiê do funcionário) hoje só mostra uma busca por nome + lista simples com nome/posto/CPF mascarado. Isso tem dois problemas: (1) sem filtro, lista todo mundo — inclusive quem nunca teve nenhum registro — poluindo a tela; (2) não dá nenhuma visão agregada (quantas advertências/atestados/faltas/ocorrências cada um tem, quem é o supervisor responsável, matrícula) sem abrir o dossiê individual.

## Objetivo

Substituir a lista simples por um painel: tabela com colunas de identificação + contagem de registros por tipo, cards de resumo reativos ao filtro, e exportação em Excel. O dossiê individual (modal, já implementado) não muda — só o que leva até ele.

## Escopo

Inclui:
- Nova Server Action `getPainelFuncionarios()` substituindo `getFuncionariosParaBusca()`.
- Nova tabela em `components/ocorrencias/busca-funcionario.tsx` (reescrita) com colunas, ordenação e exportação Excel.
- Cards de resumo reativos ao filtro/busca aplicado.

Fora de escopo:
- Mudanças no modal do dossiê (`modal-dossie.tsx`), no modal de nova ocorrência, ou na seção de alertas — nenhum desses muda.
- Paginação da tabela (a lista já limita a exibição, ver seção "Limites").

## Comportamento da lista

**Sem busca digitada:** mostra só funcionários com pelo menos 1 registro (advertência + atestado + falta + ocorrência > 0), ordenado por total de registros (desc).

**Com busca digitada (por nome):** pesquisa entre **todos** os funcionários, inclusive quem não tem nenhum registro — permite abrir o dossiê "limpo" de alguém novo pra lançar a primeira ocorrência.

**Filtro por secretaria:** continua existindo, combina com a busca/regra acima (aplicado sobre o mesmo conjunto).

**Limites:** a tabela renderiza no máximo 200 linhas do resultado filtrado (evita travar o DOM com toda a base); resultado com mais que isso mostra aviso "refine a busca pra ver mais". A exportação Excel, no entanto, exporta o conjunto filtrado completo (não limitado a 200) — o botão de exportar dispara a mesma Server Action com o filtro atual pra buscar tudo, sem o corte de renderização.

## Cards de resumo

5 cards, recalculados a cada mudança de busca/filtro, somando só os funcionários atualmente visíveis (mesmo conjunto pré-corte de 200, ou seja, soma sobre o resultado filtrado completo, não sobre as 200 linhas renderizadas):
- Funcionários com Registro (contagem de pessoas com total > 0 dentro do filtro atual)
- Total Advertências
- Total Atestados
- Total Faltas
- Total Ocorrências

## Tabela

Colunas: Funcionário | Matrícula (RE) | Posto de Trabalho — Secretaria | Supervisor(es) | Advertências | Atestados | Faltas | Ocorrências

- CPF sai da tabela (não cabia bem com as novas colunas; continua mascarado dentro do dossiê, que é o único lugar que precisa dele).
- Supervisor(es): nomes dos supervisores vinculados ao posto atual do funcionário via `config_supervisores_postos` (pode ter mais de um por posto — concatena com vírgula; nenhum vinculado → "—").
- As 4 colunas de contagem são cliques-para-ordenar (mesmo padrão de `COLS`/`sortKey` que a tabela antiga de ocorrências já usava); default: ordenado por total de registros desc (soma das 4).
- Clicar em qualquer célula da linha abre o dossiê do funcionário (mesmo comportamento de hoje).
- Exportar Excel: botão acima da tabela, usa `lib/export-excel.ts` (`exportToExcel`) com as mesmas 8 colunas (nome do arquivo: `funcionarios-ocorrencias-<data>.xlsx`).

## Modelo de dados / Server Action

`getPainelFuncionarios()` substitui `getFuncionariosParaBusca()` em `app/(admin)/ocorrencias/actions.ts`:

1. Busca funcionários (mesmo escopo de hoje: `neq('status','desligado')`, filtro de posto por supervisor via `config_supervisores_postos`, paginado com `fetchAllRows`).
2. Busca em paralelo, cada uma paginada com `fetchAllRows`, só a coluna `funcionario_id` de `advertencias`, `atestados`, `faltas`, e de `ocorrencias` (filtrando `tipo = 'ocorrencia'`) — reduz em memória pra um `Map<funcionario_id, count>` por tipo (mesmo padrão de agregação em memória já usado em `app/(admin)/faltas/actions.ts` `buscarDashFaltas`).
3. Busca `config_supervisores_postos` (ativo = true) com join em `perfis(nome)`, agrupando por `posto_id` → lista de nomes de supervisor.
4. Monta o resultado: cada funcionário ganha `{ advertencias, atestados, faltas, ocorrencias }` (contagens) e `supervisor_nomes: string[]`.

Tipo de retorno (substitui `FuncionarioBusca`):

```typescript
export type FuncionarioPainel = {
  id: string
  nome: string
  registro: string | null
  posto_nome: string
  secretaria: string
  supervisor_nomes: string[]
  contagens: {
    advertencias: number
    atestados: number
    faltas: number
    ocorrencias: number
  }
}
```

`cpf` sai do tipo (não é mais usado nessa tela).

## Componente

`components/ocorrencias/busca-funcionario.tsx` é reescrito (mesmo arquivo, mesmo nome de export `BuscaFuncionario` — só muda o que renderiza por dentro): recebe `funcionarios: FuncionarioPainel[]`, mantém a mesma prop `onSelect: (id: string) => void`. Fica responsável por: busca/filtro, cálculo dos cards, ordenação da tabela, corte de 200 linhas, e o botão de exportar Excel (client-side, usa o array já carregado — não precisa de nova chamada ao servidor, já que `getPainelFuncionarios()` roda uma vez no carregamento da página e o filtro/ordenação são só client-side).

## Permissões

Sem mudança: mesmo escopo de supervisor já usado em `getFuncionariosParaBusca()` (só funcionários dos postos configurados). `getPainelFuncionarios()` aplica esse filtro antes de contar — supervisor nunca vê contagem de funcionário fora da sua área.

## Testes / verificação

- `npm run build` limpo.
- QA manual como admin: tela inicial mostra só quem tem registro, ordenado por total; buscar nome de alguém sem registro acha e abre dossiê vazio; ordenar por cada coluna; exportar Excel e conferir as 8 colunas e os totais batendo com os cards.
- QA manual como supervisor: lista e cards só contam funcionários dos postos do supervisor.
