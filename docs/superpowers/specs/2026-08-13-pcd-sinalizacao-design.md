# Sinalização de PCD no efetivo — design

Data: 2026-08-13

## Contexto

Contrato de Mogi das Cruzes tem 68 funcionários PCD (planilha `ATIVOS MOGI 10-08-2026_PCD.xlsx`,
aba LISTAGEM, colunas `CODIGO | NOME DO FUNCIONARIO | PCD`). Tipos encontrados: Visual (16),
Física (26), Auditiva (17), Intelectual (9). Hoje não existe nenhum campo PCD no banco
(`funcionarios` não tem coluna relacionada).

Objetivo: sinalizar PCD no Efetivo e no Controle de Postos, capturar o dado na admissão e na
edição de funcionário, e importar os 68 já ativos a partir da planilha.

## Schema

Migração em `funcionarios`:

```sql
alter table funcionarios
  add column pcd boolean not null default false,
  add column pcd_tipo text null,
  add column pcd_tipo_outro text null;

alter table funcionarios
  add constraint funcionarios_pcd_tipo_check
  check (pcd_tipo is null or pcd_tipo in ('Visual', 'Física', 'Auditiva', 'Intelectual', 'Outra'));
```

- `pcd_tipo_outro` só é relevante quando `pcd_tipo = 'Outra'`; não valida no banco (texto livre),
  validação de coerência fica na Server Action.
- Sem RLS específico novo — segue as policies já existentes de `funcionarios`.

## Import dos 68 ativos

Migração de dados one-off (SQL, rodada uma vez via Supabase Studio/MCP), casando
`funcionarios.registro = planilha.CODIGO` (ambos tratados como texto). Fluxo:

1. Gerar `insert`/`update` statements (ou tabela temporária + `update ... from`) com os 68 pares
   `(registro, pcd_tipo)` extraídos da planilha.
2. Rodar e conferir contagem de linhas afetadas — esperado 68 (ou menos, se algum `registro`
   estiver vazio/divergente no banco).
3. Reportar ao usuário qualquer linha da planilha que não bateu com nenhum `registro` ativo, para
   correção manual.

## Server Actions (`app/(admin)/efetivo/actions.ts`)

- `admitirFuncionarioAdmin`: lê `pcd` (checkbox), `pcd_tipo`, `pcd_tipo_outro` do FormData. Se
  `pcd` desmarcado, grava `pcd=false, pcd_tipo=null, pcd_tipo_outro=null`. Se marcado, exige
  `pcd_tipo`; se `pcd_tipo==='Outra'`, exige `pcd_tipo_outro` não vazio.
- `editarFuncionario`: mesmos três campos adicionados à assinatura `campos` e ao `updatePayload`.
  Mesma validação de coerência. Não entra na lista `camposAuditoria` (fora do escopo — segue
  padrão dos campos que hoje não geram log em `movimentacoes`, ex. `registro`).

## UI

### Badge PCD

Componente pequeno reutilizável (`components/efetivo/badge-pcd.tsx` ou inline onde usado):
pill âmbar (`bg-amber-50 text-amber-700 ring-1 ring-amber-200`), texto `PCD`, `title` com o tipo
(`PCD — Física`, ou `PCD — Outra (texto)` quando aplicável).

Usos:
- `components/efetivo/funcionarios-table.tsx`: badge ao lado do nome quando `funcionario.pcd`.
  `FuncionarioRow` ganha `pcd: boolean`, `pcd_tipo: string | null`, `pcd_tipo_outro: string | null`.
- `components/postos/postos-client.tsx`: na lista de funcionários dentro do card expandido do
  posto (linha ~631, ao lado de `f.nome`/`f.funcao_nome`). `PostoFuncionario` (em
  `app/(admin)/postos/actions.ts`) ganha `pcd: boolean`, `pcd_tipo: string | null`. A query em
  `getPostosData()` inclui `pcd, pcd_tipo` no `select` de `funcionarios`.

Sem contador agregado novo no card do posto (decisão do usuário) — só o selo individual.

### Modal de edição (`modal-editar-funcionario.tsx`)

Novo bloco "PCD": checkbox "Pessoa com deficiência" + (se marcado) select de tipo
(Visual/Física/Auditiva/Intelectual/Outra) + (se "Outra") input de texto. Estado inicial vem de
`funcionario.pcd`/`pcd_tipo`/`pcd_tipo_outro`. Enviado em `editarFuncionario`.

### Modal de admissão (`modal-admitir-admin.tsx`)

Mesmo bloco PCD adicionado ao formulário, mais reorganização visual do modal inteiro em blocos
com título e borda-topo colorida, mantendo o mesmo conjunto de campos, nomes de input e função de
submit (`admitirFuncionarioAdmin` já usa `FormData` por `name`, então basta adicionar os novos
inputs com `name="pcd"`, `name="pcd_tipo"`, `name="pcd_tipo_outro"`):

- **Bloco 1 — Dados pessoais** (accent blue, como cards "ativos"): Nome, Registro, CPF.
- **Bloco 2 — Função & Posto** (accent indigo): Função, Posto (busca + select existente).
- **Bloco 3 — Admissão** (accent orange, como cards "férias"): Data de admissão, Período de
  experiência.
- **Bloco 4 — PCD** (accent amber): checkbox + tipo, sempre visível mas opcional.

Cada bloco: `rounded-lg border border-slate-100 bg-white p-4` com barra superior de 4px na cor do
bloco (`border-t-4 border-t-{cor}-400`), título em `text-xs font-semibold uppercase tracking-widest
text-slate-500` com ícone pequeno (lucide-react) ao lado. Modal geral ganha `max-w-xl` (mais
respiro) e mantém scroll interno atual. Botões, validação HTML5 (`required`), estados
`pending`/`erro`/`ok` e a função `handleSubmit`/`handleClose` não mudam de comportamento.

## Fora de escopo

- Não altera `conferência RH x sistema` (sinônimos/matching) para considerar PCD.
- Não adiciona filtro por PCD nas listagens (pode vir depois, se pedido).
- Não gera PDF/relatório de PCD.
