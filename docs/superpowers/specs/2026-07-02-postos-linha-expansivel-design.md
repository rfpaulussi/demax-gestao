# Linha expansível + espaçamento na tabela de Postos

**Data:** 2026-07-02
**Escopo:** Na aba "Visão Geral" de `/postos`, permitir ver quem está alocado em cada posto (nome, função, status) sem sair da tela; e reduzir o espaçamento visual entre as colunas Posto / Secretaria / Supervisor.

---

## Contexto

Hoje, para saber quem ocupa um posto (e sua função), o usuário precisa ir até `/efetivo` e filtrar por posto manualmente — perdendo o contexto de déficit/excesso/férias que estava vendo em `/postos`. Além disso, a tabela usa `table-auto`: como a coluna "Posto" tem nomes longos, ela fica muito larga e deixa um vão grande antes da coluna "Secretaria".

`getPostosData()` já busca todos os funcionários vinculados a postos (para calcular os contadores), só não expõe os registros individuais para o client.

---

## Arquivos alterados

| Arquivo | Tipo de mudança |
|---|---|
| `app/(admin)/postos/actions.ts` | `getPostosData()` passa a agregar e retornar `funcionarios[]` por posto |
| `components/postos/postos-client.tsx` | Estado de expansão, sub-linha da tabela, redução de padding |

---

## Seção 1 — `actions.ts`

### Query existente, campos adicionais

```ts
fetchAllRows<FuncionarioRow>((from, to) =>
  supabase
    .from('funcionarios')
    .select('id, nome, posto_id, status, funcao_id, eh_encarregado_volante, funcoes!funcao_id(nome)')
    .in('status', ['ativo', 'ferias', 'atestado', 'afastado', 'faltante'])
    .order('id', { ascending: true })
    .range(from, to) as unknown as PromiseLike<{ data: FuncionarioRow[] | null; error: { message: string } | null }>,
)
```

`FuncionarioRow` ganha `nome: string` e `funcoes: { nome: string } | null`.

### Agrupamento por posto (no mesmo loop que já calcula `efetivoMap`/`insalubMap`/`feriasMap`)

```ts
const funcionariosPorPosto = new Map<string, PostoFuncionario[]>()
for (const f of funcionariosRaw) {
  if (!f.posto_id) continue
  const lista = funcionariosPorPosto.get(f.posto_id) ?? []
  lista.push({
    id: f.id,
    nome: f.nome,
    funcao_nome: f.funcoes?.nome ?? '—',
    status: f.status,
  })
  funcionariosPorPosto.set(f.posto_id, lista)
}
```

Sem filtro de status/função aqui — a lista mostra **todos** os vinculados ao posto (inclusive férias/afastado/faltante), já que é justamente isso que explica visualmente o déficit.

### Novo campo em `PostoRow`

```ts
export type PostoFuncionario = {
  id: string
  nome: string
  funcao_nome: string
  status: string
}

export type PostoRow = {
  // ...campos existentes
  funcionarios: PostoFuncionario[]
}
```

E no `return` final de `getPostosData()`:

```ts
funcionarios: funcionariosPorPosto.get(p.id) ?? [],
```

---

## Seção 2 — `postos-client.tsx`

### Estado

```ts
const [expandidos, setExpandidos] = useState<Set<string>>(new Set())

function toggleExpandir(id: string) {
  setExpandidos(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })
}
```

Múltiplas linhas podem ficar expandidas simultaneamente (sem exclusividade).

### Coluna do chevron

Nova primeira coluna (antes de "Posto"), só o ícone — sem header de texto, sem sort. `COLS` ganha uma entrada `{ label: '', sortKey: null, align: 'center' }` no início, e o `colSpan` das linhas vazias/loading passa de 7 para 8 (na verdade já estava incorreto — hoje o `<table>` tem 6 `<th>` mas o `colSpan` do "Nenhum posto encontrado" usa `7`; ajustar para o novo total real de colunas).

```tsx
<td className="px-2 py-3 text-center">
  <button type="button" onClick={() => toggleExpandir(p.id)} className="text-gray-400 hover:text-gray-700">
    <ChevronRight className={cn('h-4 w-4 transition-transform', expandidos.has(p.id) && 'rotate-90')} />
  </button>
</td>
```

(`ChevronRight` de `lucide-react`, já é dependência do projeto.)

### Sub-linha expandida

Renderizada com `React.Fragment` por posto, logo após a `<tr>` principal, condicional a `expandidos.has(p.id)`:

```tsx
{expandidos.has(p.id) && (
  <tr>
    <td colSpan={7} className="bg-gray-50 px-6 py-3">
      {p.funcionarios.length === 0 ? (
        <p className="text-xs text-gray-400">Nenhum funcionário vinculado</p>
      ) : (
        <ul className="grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3">
          {[...p.funcionarios]
            .sort((a, b) =>
              (STATUS_ORDER_LISTA[a.status] ?? 9) - (STATUS_ORDER_LISTA[b.status] ?? 9) ||
              a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' })
            )
            .map(f => (
              <li key={f.id} className="flex items-baseline gap-1.5 text-xs">
                <span className={cn('font-medium', NOME_COR_STATUS[f.status] ?? 'text-gray-700')}>{f.nome}</span>
                <span className="text-gray-400">— {f.funcao_nome}</span>
              </li>
            ))}
        </ul>
      )}
    </td>
  </tr>
)}
```

### Cores por status (nome do funcionário)

Reaproveitando a paleta já usada nos badges (`STATUS_CHIP`), mas aplicada ao texto do nome em vez de um badge — pedido explícito do usuário para facilitar a varredura visual:

```ts
const NOME_COR_STATUS: Record<string, string> = {
  ativo:     'text-green-700',
  ferias:    'text-orange-600',
  afastado:  'text-red-600',
  atestado:  'text-red-600',
  faltante:  'text-amber-600',
}

const STATUS_ORDER_LISTA: Record<string, number> = {
  ativo: 0, ferias: 1, faltante: 2, afastado: 3, atestado: 3,
}
```

Sem badge extra ao lado — a cor do nome já comunica o status, mantendo a lista compacta.

### Redução de padding (Posto / Secretaria / Supervisor)

Nas células de cabeçalho (`COLS.map`) e corpo dessas três colunas, `px-4` → `px-2`. As colunas numéricas/status permanecem `px-4` (já centralizadas, não fazem parte da reclamação de espaçamento).

Aplica-se em:
- `<th>` de "Posto", "Secretaria", "Supervisor"
- `<td>` correspondentes na `<tr>` principal

---

## Casos de borda

| Situação | Resultado |
|---|---|
| Posto vago (`efetivo_atual = 0`) | Expande e mostra "Nenhum funcionário vinculado" |
| Funcionário sem função vinculada | Mostra "—" no lugar da função |
| Posto AFASTADOS | Lista mostra todos os afastados vinculados, mesma cor vermelha |
| Muitos funcionários em um posto (ex: SEDE com 16) | Grid quebra em 2-3 colunas, sem scroll interno |

---

## Verificação pós-implementação

1. `npx tsc --noEmit` — sem erros de tipo
2. `npm run build` — build limpo
3. Testar manualmente: expandir/colapsar múltiplas linhas, posto vago, posto com muitos funcionários, posto AFASTADOS
