# Filtro por Supervisor na página /efetivo

**Data:** 2026-06-03  
**Escopo:** Adicionar dropdown de supervisor aos filtros já existentes (busca, secretaria, status) na página `/efetivo`.

---

## Contexto

A página `/efetivo` já possui três filtros via `searchParams`:
- `busca` — texto livre sobre nome do funcionário
- `secretaria` — dropdown com distinct de `postos.secretaria`
- `status` — dropdown com valores fixos (ativo / afastado / ferias / desligado)

O único filtro a ser adicionado é **supervisor**.

---

## Tabelas envolvidas

```
funcionarios.posto_id
  → postos.id
    → config_supervisores_postos.posto_id (WHERE ativo = true)
      → config_supervisores_postos.supervisor_id
        → perfis.id (WHERE role = 'supervisor' AND ativo = true)
```

---

## Arquivos alterados

| Arquivo | Tipo de mudança |
|---|---|
| `app/(admin)/efetivo/page.tsx` | Duas novas queries + lógica de filtro + nova prop |
| `components/efetivo/filtros-efetivo.tsx` | Nova prop + novo dropdown |

---

## Seção 1 — `page.tsx`

### Novas queries (em paralelo com a existente)

```ts
const [{ data: raw }, { data: supervisoresRaw }, { data: configRaw }] = await Promise.all([
  supabase.from('funcionarios').select(...).order('nome'),
  supabase.from('perfis').select('id, nome').eq('role', 'supervisor').eq('ativo', true).order('nome'),
  supabase.from('config_supervisores_postos').select('supervisor_id, posto_id').eq('ativo', true),
])
```

### Índices em memória

```ts
// supervisor_id → Set<posto_id>
const supervisorPostoMap = new Map<string, Set<string>>()
for (const row of configRaw ?? []) {
  if (!supervisorPostoMap.has(row.supervisor_id)) {
    supervisorPostoMap.set(row.supervisor_id, new Set())
  }
  supervisorPostoMap.get(row.supervisor_id)!.add(row.posto_id)
}

// todos os posto_ids com supervisor ativo
const supervisedPostoIds = new Set((configRaw ?? []).map(r => r.posto_id))
```

### Lógica de filtro

```ts
if (supervisor === 'sem_supervisor') {
  filtered = filtered.filter(f => !f.posto_id || !supervisedPostoIds.has(f.posto_id))
} else if (supervisor) {
  const postosDoSup = supervisorPostoMap.get(supervisor) ?? new Set()
  filtered = filtered.filter(f => f.posto_id && postosDoSup.has(f.posto_id))
}
```

### SearchParams

```ts
type SearchParams = {
  busca?: string
  status?: string
  secretaria?: string
  supervisor?: string   // novo
}
```

### Props para FiltrosEfetivo

```ts
<FiltrosEfetivo
  secretarias={secretarias}
  supervisores={supervisoresRaw ?? []}   // novo
/>
```

---

## Seção 2 — `filtros-efetivo.tsx`

### Props

```ts
export function FiltrosEfetivo({
  secretarias,
  supervisores,
}: {
  secretarias: string[]
  supervisores: { id: string; nome: string | null }[]
})
```

### Leitura do searchParam

```ts
const supervisor = searchParams.get('supervisor') ?? ''
```

### Dropdown (entre busca e secretaria)

```tsx
<select
  value={supervisor}
  onChange={e => update('supervisor', e.target.value)}
  className={inputClass}
>
  <option value="">Todos os supervisores</option>
  <option value="sem_supervisor">Sem Supervisor</option>
  {supervisores.map(s => (
    <option key={s.id} value={s.id}>{s.nome}</option>
  ))}
</select>
```

Ordem visual final: **busca → supervisor → secretaria → status**

---

## Comportamento combinado

Os filtros se encadeiam sobre `let filtered = funcionarios`. A ordem de aplicação é: busca → status → secretaria → supervisor (ou qualquer ordem — são independentes).

## Casos de borda

| Situação | Resultado |
|---|---|
| Funcionário com `posto_id = null` | Aparece em "Sem Supervisor", oculto em qualquer supervisor específico |
| Posto sem nenhuma entrada ativa em `config_supervisores_postos` | Funcionários desse posto aparecem em "Sem Supervisor" |
| Supervisor sem postos configurados | Dropdown mostra o nome; selecionar retorna lista vazia |

---

## Verificação pós-implementação

1. `npx tsc --noEmit` — sem erros de tipo
2. `npm run build` — build limpo
