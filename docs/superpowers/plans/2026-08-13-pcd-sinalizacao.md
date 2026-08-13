# Sinalização de PCD no efetivo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar campo PCD (tipo de deficiência) a `funcionarios`, importar os 68 já ativos da planilha, sinalizar com badge âmbar no Efetivo e no Controle de Postos, e capturar o dado nos modais de admissão/edição — com o modal de admissão redesenhado em blocos coloridos.

**Architecture:** Migração SQL adiciona 3 colunas (`pcd`, `pcd_tipo`, `pcd_tipo_outro`) em `funcionarios`. Server Actions existentes (`admitirFuncionarioAdmin`, `editarFuncionario`) ganham os 3 campos. Queries que já buscam funcionários (Efetivo, Postos) passam a selecionar as novas colunas; componentes de UI recebem um badge compartilhado. Import one-off casa `registro` (banco) com `CODIGO` (planilha) via script Node usando o client Supabase já configurado no projeto — **confirmado por query real: os 68 registros da planilha batem 1:1 com `registro` no banco, sem divergência.**

**Tech Stack:** Next.js 14 App Router, Supabase (Postgres + supabase-js), TypeScript, Tailwind.

---

## Nota sobre aplicação da migração DDL

Este projeto não tem `supabase` CLI linkado nem `DATABASE_URL`/`pg` configurado — o próprio
`scripts/apply-migrations.mjs` existente já documenta isso: tenta via RPC `exec_sql` (que não
existe no projeto) e, se falhar, imprime o SQL para rodar manualmente no Supabase Studio.
A Task 1 segue esse mesmo padrão. **Updates de dados (não-DDL)**, como o import da Task 3, rodam
normalmente via `supabase-js` `.update()` sem precisar de Studio — já validado nesta sessão.

---

### Task 1: Migração de schema — colunas PCD em `funcionarios`

**Files:**
- Create: `supabase/migrations/20260813_add_pcd_funcionarios.sql`
- Create: `scripts/apply-pcd-schema.mjs`

- [ ] **Step 1: Criar arquivo de migração**

`supabase/migrations/20260813_add_pcd_funcionarios.sql`:
```sql
alter table funcionarios
  add column if not exists pcd boolean not null default false,
  add column if not exists pcd_tipo text null,
  add column if not exists pcd_tipo_outro text null;

alter table funcionarios drop constraint if exists funcionarios_pcd_tipo_check;
alter table funcionarios
  add constraint funcionarios_pcd_tipo_check
  check (pcd_tipo is null or pcd_tipo in ('Visual', 'Física', 'Auditiva', 'Intelectual', 'Outra'));
```

- [ ] **Step 2: Criar script de aplicação**

`scripts/apply-pcd-schema.mjs`:
```js
// Script temporário para aplicar a migração PCD via Supabase Admin API.
// Uso: node scripts/apply-pcd-schema.mjs
import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

const url = 'https://fwdhnipekbmeqozkpfyh.supabase.co'
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(url, key)

const sql = readFileSync('supabase/migrations/20260813_add_pcd_funcionarios.sql', 'utf8')

const { error } = await supabase.rpc('exec_sql', { sql })
if (error) {
  console.log('RPC falhou (esperado neste projeto):', error.message)
  console.log('\nExecute manualmente no Supabase Studio → SQL Editor:\n')
  console.log(sql)
} else {
  console.log('OK — migração aplicada.')
}
```

- [ ] **Step 3: Rodar o script**

Run: `node --env-file=.env.local scripts/apply-pcd-schema.mjs`

Expected: RPC falha (não existe no projeto) e o SQL é impresso no terminal.

- [ ] **Step 4: Aplicar manualmente no Supabase Studio**

Abrir https://supabase.com/dashboard/project/fwdhnipekbmeqozkpfyh/sql/new, colar o conteúdo de
`supabase/migrations/20260813_add_pcd_funcionarios.sql`, rodar.

- [ ] **Step 5: Confirmar as colunas existem**

Run:
```bash
node --env-file=.env.local -e "
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://fwdhnipekbmeqozkpfyh.supabase.co', process.env.SUPABASE_SERVICE_ROLE_KEY);
supabase.from('funcionarios').select('id, pcd, pcd_tipo, pcd_tipo_outro').limit(1).then(r => console.log(r));
"
```
Expected: `{ data: [ { id: '...', pcd: false, pcd_tipo: null, pcd_tipo_outro: null } ], error: null }`

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260813_add_pcd_funcionarios.sql scripts/apply-pcd-schema.mjs
git commit -m "feat(db): adiciona colunas pcd/pcd_tipo/pcd_tipo_outro em funcionarios

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Atualizar tipos gerados do Supabase

**Files:**
- Modify: `types/database.ts:1340-1409` (bloco `funcionarios` — `Row`, `Insert`, `Update`)

- [ ] **Step 1: Adicionar os 3 campos em `Row`**

Em `types/database.ts`, dentro de `funcionarios.Row` (bloco que começa em torno da linha 1340),
adicionar em ordem alfabética junto dos demais campos opcionais:
```ts
          pcd: boolean | null
          pcd_tipo: string | null
          pcd_tipo_outro: string | null
```
(ao lado de `periodo_experiencia`, `posto_id` etc — mesma seção `Row`)

- [ ] **Step 2: Adicionar os 3 campos em `Insert`**

No mesmo bloco `funcionarios.Insert`, adicionar:
```ts
          pcd?: boolean | null
          pcd_tipo?: string | null
          pcd_tipo_outro?: string | null
```

- [ ] **Step 3: Adicionar os 3 campos em `Update`**

No mesmo bloco `funcionarios.Update`, adicionar:
```ts
          pcd?: boolean | null
          pcd_tipo?: string | null
          pcd_tipo_outro?: string | null
```

- [ ] **Step 4: Verificar compilação**

Run: `npx tsc --noEmit`
Expected: sem novos erros relacionados a `funcionarios` (podem existir erros pré-existentes não
relacionados — ignorar).

- [ ] **Step 5: Commit**

```bash
git add types/database.ts
git commit -m "chore(types): adiciona campos pcd aos tipos gerados de funcionarios

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Import dos 68 funcionários PCD já ativos

**Files:**
- Create: `scripts/import-pcd.mjs`

- [ ] **Step 1: Criar script de import com os 68 pares (registro, tipo)**

`scripts/import-pcd.mjs`:
```js
// Script one-off: marca pcd=true / pcd_tipo=<tipo> nos 68 funcionários da planilha
// "ATIVOS MOGI 10-08-2026_PCD.xlsx", casando por funcionarios.registro = CODIGO.
// Uso: node --env-file=.env.local scripts/import-pcd.mjs
import { createClient } from '@supabase/supabase-js'

const url = 'https://fwdhnipekbmeqozkpfyh.supabase.co'
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(url, key)

// [registro, tipo] — extraído de ATIVOS MOGI 10-08-2026_PCD.xlsx, aba LISTAGEM
const PARES = [
  ['100834', 'Visual'],
  ['100713', 'Visual'],
  ['102689', 'Visual'],
  ['104386', 'Visual'],
  ['103870', 'Visual'],
  ['99551', 'Visual'],
  ['100543', 'Visual'],
  ['91993', 'Visual'],
  ['109087', 'Visual'],
  ['108583', 'Visual'],
  ['99766', 'Visual'],
  ['99119', 'Visual'],
  ['98596', 'Visual'],
  ['97910', 'Visual'],
  ['98282', 'Visual'],
  ['100987', 'Visual'],
  ['97431', 'Intelectual'],
  ['97441', 'Intelectual'],
  ['97374', 'Intelectual'],
  ['106568', 'Intelectual'],
  ['97432', 'Intelectual'],
  ['106449', 'Intelectual'],
  ['103878', 'Intelectual'],
  ['98978', 'Intelectual'],
  ['108877', 'Intelectual'],
  ['103179', 'Física'],
  ['97907', 'Física'],
  ['103742', 'Física'],
  ['103680', 'Física'],
  ['97468', 'Física'],
  ['103665', 'Física'],
  ['97905', 'Física'],
  ['98580', 'Física'],
  ['97909', 'Física'],
  ['97646', 'Física'],
  ['98281', 'Física'],
  ['104915', 'Física'],
  ['99888', 'Física'],
  ['79247', 'Física'],
  ['97555', 'Física'],
  ['100268', 'Física'],
  ['104071', 'Física'],
  ['105074', 'Física'],
  ['100053', 'Física'],
  ['105783', 'Física'],
  ['104021', 'Física'],
  ['109135', 'Física'],
  ['100061', 'Física'],
  ['104686', 'Física'],
  ['103170', 'Física'],
  ['97553', 'Física'],
  ['97693', 'Auditiva'],
  ['104326', 'Auditiva'],
  ['107900', 'Auditiva'],
  ['103037', 'Auditiva'],
  ['98533', 'Auditiva'],
  ['103287', 'Auditiva'],
  ['102968', 'Auditiva'],
  ['107462', 'Auditiva'],
  ['100511', 'Auditiva'],
  ['98280', 'Auditiva'],
  ['97491', 'Auditiva'],
  ['105045', 'Auditiva'],
  ['85381', 'Auditiva'],
  ['97380', 'Auditiva'],
  ['104292', 'Auditiva'],
  ['103854', 'Auditiva'],
  ['99926', 'Auditiva'],
]

const registros = PARES.map(([r]) => r)
const { data: antes, error: erroSelect } = await supabase
  .from('funcionarios')
  .select('id, registro, nome, status')
  .in('registro', registros)

if (erroSelect) { console.error('Erro ao buscar:', erroSelect.message); process.exit(1) }

const encontrados = new Set(antes.map(f => f.registro))
const naoEncontrados = registros.filter(r => !encontrados.has(r))
if (naoEncontrados.length > 0) {
  console.warn('ATENÇÃO — registros sem match no banco (não atualizados):', naoEncontrados)
}

let ok = 0, falhas = 0
for (const [registro, tipo] of PARES) {
  const alvo = antes.find(f => f.registro === registro)
  if (!alvo) continue
  const { error } = await supabase
    .from('funcionarios')
    .update({ pcd: true, pcd_tipo: tipo, pcd_tipo_outro: null })
    .eq('id', alvo.id)
  if (error) {
    console.error(`FALHA registro=${registro} nome=${alvo.nome}:`, error.message)
    falhas++
  } else {
    ok++
  }
}

console.log(`Concluído: ${ok} atualizados, ${falhas} falhas, ${naoEncontrados.length} sem match.`)
```

- [ ] **Step 2: Rodar o import**

Run: `node --env-file=.env.local scripts/import-pcd.mjs`
Expected: `Concluído: 68 atualizados, 0 falhas, 0 sem match.`

- [ ] **Step 3: Conferir contagem final no banco**

Run:
```bash
node --env-file=.env.local -e "
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://fwdhnipekbmeqozkpfyh.supabase.co', process.env.SUPABASE_SERVICE_ROLE_KEY);
supabase.from('funcionarios').select('pcd_tipo', {count:'exact'}).eq('pcd', true).then(r => {
  const counts = {};
  r.data.forEach(d => counts[d.pcd_tipo] = (counts[d.pcd_tipo]||0)+1);
  console.log('total pcd=true:', r.data.length, counts);
});
"
```
Expected: `total pcd=true: 68 { Visual: 16, Intelectual: 9, Física: 26, Auditiva: 17 }`

- [ ] **Step 4: Commit**

```bash
git add scripts/import-pcd.mjs
git commit -m "chore(dados): importa 68 funcionários PCD da planilha (Mogi das Cruzes)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Server Actions — capturar PCD em admissão e edição

**Files:**
- Modify: `app/(admin)/efetivo/actions.ts:571-648` (`editarFuncionario`)
- Modify: `app/(admin)/efetivo/actions.ts:701-730` (`admitirFuncionarioAdmin`)

- [ ] **Step 1: Adicionar helper de validação de PCD**

Logo acima de `editarFuncionario` (antes da linha 571) em `app/(admin)/efetivo/actions.ts`,
adicionar:
```ts
type PcdTipo = 'Visual' | 'Física' | 'Auditiva' | 'Intelectual' | 'Outra'
const PCD_TIPOS: readonly PcdTipo[] = ['Visual', 'Física', 'Auditiva', 'Intelectual', 'Outra']

function validarPcd(pcd: boolean, pcdTipo: string | null, pcdTipoOutro: string | null): { error?: string } {
  if (!pcd) return {}
  if (!pcdTipo || !PCD_TIPOS.includes(pcdTipo as PcdTipo)) {
    return { error: 'Selecione o tipo de PCD' }
  }
  if (pcdTipo === 'Outra' && !pcdTipoOutro?.trim()) {
    return { error: 'Descreva o tipo de PCD em "Outra"' }
  }
  return {}
}
```

- [ ] **Step 2: Estender `editarFuncionario` com os campos PCD**

Em `app/(admin)/efetivo/actions.ts:571-585`, o parâmetro `campos` ganha:
```ts
    periodo_experiencia?: '30+30' | '45+45' | null
    pcd: boolean
    pcd_tipo: string | null
    pcd_tipo_outro: string | null
```
(adicionar essas 3 linhas logo após `periodo_experiencia?: ...`)

Logo após a linha `const periodoExperiencia = campos.periodo_experiencia ?? null` (linha 593),
adicionar:
```ts
  const pcdCheck = validarPcd(campos.pcd, campos.pcd_tipo, campos.pcd_tipo_outro)
  if (pcdCheck.error) return { success: false, error: pcdCheck.error }
```

No `updatePayload` (linhas 595-606), adicionar dentro do objeto:
```ts
    pcd:                 campos.pcd,
    pcd_tipo:            campos.pcd ? campos.pcd_tipo : null,
    pcd_tipo_outro:      (campos.pcd && campos.pcd_tipo === 'Outra') ? campos.pcd_tipo_outro : null,
```

- [ ] **Step 3: Estender `admitirFuncionarioAdmin` com os campos PCD**

Em `app/(admin)/efetivo/actions.ts:701-730`, após a leitura de `periodo_experiencia` (linha 711),
adicionar:
```ts
  const pcd          = formData.get('pcd') === 'on'
  const pcd_tipo      = (formData.get('pcd_tipo') as string)?.trim() || null
  const pcd_tipo_outro = (formData.get('pcd_tipo_outro') as string)?.trim() || null
```

Após a checagem `if (!nome || !funcao_id || ...)` (linha 713-715), adicionar:
```ts
  const pcdCheck = validarPcd(pcd, pcd_tipo, pcd_tipo_outro)
  if (pcdCheck.error) return { error: pcdCheck.error }
```

No `payload` (linhas 717-722), adicionar:
```ts
  payload.pcd = pcd
  payload.pcd_tipo = pcd ? pcd_tipo : null
  payload.pcd_tipo_outro = (pcd && pcd_tipo === 'Outra') ? pcd_tipo_outro : null
```

- [ ] **Step 4: Verificar compilação**

Run: `npx tsc --noEmit`
Expected: sem erros novos em `actions.ts`.

- [ ] **Step 5: Commit**

```bash
git add "app/(admin)/efetivo/actions.ts"
git commit -m "feat(efetivo): captura pcd/pcd_tipo em admissão e edição de funcionário

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Badge PCD reutilizável

**Files:**
- Create: `components/efetivo/badge-pcd.tsx`

- [ ] **Step 1: Criar o componente**

`components/efetivo/badge-pcd.tsx`:
```tsx
export function BadgePcd({ tipo, tipoOutro }: { tipo: string | null; tipoOutro?: string | null }) {
  const detalhe = tipo === 'Outra' && tipoOutro ? `Outra (${tipoOutro})` : tipo
  return (
    <span
      title={detalhe ? `PCD — ${detalhe}` : 'PCD'}
      className="ml-1.5 inline-flex items-center rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700 ring-1 ring-inset ring-amber-200"
    >
      PCD
    </span>
  )
}
```

- [ ] **Step 2: Exportar no barrel do módulo**

Em `components/efetivo/index.ts`, adicionar (seguindo o padrão dos demais exports do arquivo):
```ts
export { BadgePcd } from './badge-pcd'
```

- [ ] **Step 3: Verificar compilação**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add components/efetivo/badge-pcd.tsx components/efetivo/index.ts
git commit -m "feat(efetivo): componente BadgePcd

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Badge no Efetivo (tabela de funcionários)

**Files:**
- Modify: `app/(admin)/efetivo/page.tsx:71-77` (select)
- Modify: `components/efetivo/funcionarios-table.tsx:16-38` (`FuncionarioRow`)
- Modify: `components/efetivo/funcionarios-table.tsx` (linha que renderiza `f.nome` na célula)

- [ ] **Step 1: Incluir colunas no select do Efetivo**

Em `app/(admin)/efetivo/page.tsx:71-77`, o `.select(` passa a incluir `pcd, pcd_tipo,
pcd_tipo_outro`:
```ts
      .select(`
        id, nome, registro, cpf, status, motivo_afastamento, data_admissao, posto_id,
        data_desligamento, motivo_desligamento,
        periodo_experiencia, fase_experiencia, data_fim_fase1, data_fim_fase2,
        pcd, pcd_tipo, pcd_tipo_outro,
        funcoes!funcao_id ( id, nome ),
        postos!posto_id ( id, nome, secretaria )
      `)
```

- [ ] **Step 2: Adicionar os campos em `FuncionarioRow`**

Em `components/efetivo/funcionarios-table.tsx:16-38`, dentro de `export type FuncionarioRow`,
adicionar (perto de `cpf`):
```ts
  pcd: boolean | null
  pcd_tipo: string | null
  pcd_tipo_outro: string | null
```

- [ ] **Step 3: Renderizar o badge ao lado do nome**

Em `components/efetivo/funcionarios-table.tsx`, importar o componente:
```ts
import { BadgePcd } from './badge-pcd'
```
Localizar a célula que renderiza `f.nome` (busque por `f.nome` na tabela — é o `<td>` da coluna
"Nome") e envolver:
```tsx
<td className="px-2 py-3">
  <span className="font-medium text-gray-900">{f.nome}</span>
  {f.pcd && <BadgePcd tipo={f.pcd_tipo} tipoOutro={f.pcd_tipo_outro} />}
</td>
```
(ajustar as classes exatas ao que já existe na célula — o objetivo é só inserir `{f.pcd &&
<BadgePcd .../>}` logo após o nome, sem alterar layout/classes da célula.)

- [ ] **Step 4: Rodar build**

Run: `npm run build`
Expected: build sem erros.

- [ ] **Step 5: Commit**

```bash
git add "app/(admin)/efetivo/page.tsx" components/efetivo/funcionarios-table.tsx
git commit -m "feat(efetivo): badge PCD na tabela de funcionários

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: Badge no Controle de Postos

**Files:**
- Modify: `app/(admin)/postos/actions.ts:68-74` (`PostoFuncionario`)
- Modify: `app/(admin)/postos/actions.ts:165-208` (`FuncionarioRow` local + `select` + montagem da lista)
- Modify: `components/postos/postos-client.tsx` (linha ~631, renderização de `f.nome`)

- [ ] **Step 1: Estender `PostoFuncionario`**

Em `app/(admin)/postos/actions.ts:68-74`:
```ts
export type PostoFuncionario = {
  id: string
  nome: string
  funcao_nome: string
  status: string
  motivo_afastamento: string | null
  pcd: boolean
  pcd_tipo: string | null
  pcd_tipo_outro: string | null
}
```

- [ ] **Step 2: Estender `FuncionarioRow` local e o select**

Em `app/(admin)/postos/actions.ts:130-139` (interface local `FuncionarioRow`), adicionar:
```ts
interface FuncionarioRow {
  id: string
  nome: string
  posto_id: string | null
  status: string
  motivo_afastamento: string | null
  funcao_id: string | null
  eh_encarregado_volante: boolean | null
  pcd: boolean | null
  pcd_tipo: string | null
  pcd_tipo_outro: string | null
  funcoes: { nome: string } | null
}
```

No `select` de `funcionarios` em `app/(admin)/postos/actions.ts:167-168`:
```ts
        .select('id, nome, posto_id, status, motivo_afastamento, funcao_id, eh_encarregado_volante, pcd, pcd_tipo, pcd_tipo_outro, funcoes!funcao_id(nome)')
```

- [ ] **Step 3: Propagar para `PostoFuncionario` na montagem da lista**

Em `app/(admin)/postos/actions.ts:200-207`, dentro do `lista.push({...})`:
```ts
    lista.push({
      id: f.id,
      nome: f.nome,
      funcao_nome: f.funcoes?.nome ?? '—',
      status: f.status,
      motivo_afastamento: f.motivo_afastamento,
      pcd: f.pcd ?? false,
      pcd_tipo: f.pcd_tipo,
      pcd_tipo_outro: f.pcd_tipo_outro,
    })
```

- [ ] **Step 4: Renderizar o badge no card expandido do posto**

Em `components/postos/postos-client.tsx`, importar:
```ts
import { BadgePcd } from '@/components/efetivo/badge-pcd'
```
Na linha ~631 (`{f.nome}` seguido de `— {f.funcao_nome}` em `<span className="text-gray-400">`),
adicionar o badge logo após o nome:
```tsx
{f.nome}
{f.pcd && <BadgePcd tipo={f.pcd_tipo} tipoOutro={f.pcd_tipo_outro} />}
<span className="text-gray-400">— {f.funcao_nome}</span>
```
(manter a estrutura JSX existente ao redor — só inserir a linha do badge entre o nome e o
`<span>` da função.)

- [ ] **Step 5: Rodar build**

Run: `npm run build`
Expected: build sem erros.

- [ ] **Step 6: Commit**

```bash
git add "app/(admin)/postos/actions.ts" components/postos/postos-client.tsx
git commit -m "feat(postos): badge PCD na lista de funcionários do posto

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 8: Bloco PCD no modal de edição de funcionário

**Files:**
- Modify: `components/efetivo/modal-editar-funcionario.tsx`

- [ ] **Step 1: Adicionar estados PCD**

Em `components/efetivo/modal-editar-funcionario.tsx`, junto dos demais `useState` (perto da linha
30-46), adicionar:
```ts
  const [pcd,          setPcd]          = useState(funcionario.pcd ?? false)
  const [pcdTipo,       setPcdTipo]      = useState(funcionario.pcd_tipo ?? '')
  const [pcdTipoOutro,  setPcdTipoOutro] = useState(funcionario.pcd_tipo_outro ?? '')
```

- [ ] **Step 2: Estender o tipo `FuncionarioRow` usado pelo modal**

O modal importa `type { FuncionarioRow }` de `./funcionarios-table` (já estendido na Task 6 com
`pcd`, `pcd_tipo`, `pcd_tipo_outro`) — nenhuma mudança adicional de tipo necessária aqui.

- [ ] **Step 3: Incluir os campos no `handleSubmit`**

No objeto passado para `editarFuncionario` dentro de `handleSubmit` (perto da linha 85-97),
adicionar:
```ts
        periodo_experiencia: periodoExp || null,
        pcd,
        pcd_tipo:            pcd ? (pcdTipo || null) : null,
        pcd_tipo_outro:      (pcd && pcdTipo === 'Outra') ? (pcdTipoOutro || null) : null,
```

- [ ] **Step 4: Adicionar o bloco de UI**

Antes do bloco de botões de ação (`erro && (...)` seguido dos `<button>`, próximo ao fim do
`<form>`), adicionar:
```tsx
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={pcd}
                  onChange={e => { setPcd(e.target.checked); if (!e.target.checked) { setPcdTipo(''); setPcdTipoOutro('') } }}
                  className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                />
                Pessoa com deficiência (PCD)
              </label>
              {pcd && (
                <div className="mt-2 space-y-2">
                  <select
                    value={pcdTipo}
                    onChange={e => setPcdTipo(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">Selecione o tipo...</option>
                    <option value="Visual">Visual</option>
                    <option value="Física">Física</option>
                    <option value="Auditiva">Auditiva</option>
                    <option value="Intelectual">Intelectual</option>
                    <option value="Outra">Outra</option>
                  </select>
                  {pcdTipo === 'Outra' && (
                    <input
                      value={pcdTipoOutro}
                      onChange={e => setPcdTipoOutro(e.target.value)}
                      placeholder="Descreva o tipo..."
                      className={inputClass}
                    />
                  )}
                </div>
              )}
            </div>
```

- [ ] **Step 5: Rodar build**

Run: `npm run build`
Expected: build sem erros.

- [ ] **Step 6: Commit**

```bash
git add components/efetivo/modal-editar-funcionario.tsx
git commit -m "feat(efetivo): campo PCD no modal de edição de funcionário

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 9: Modal de admissão — redesenho em blocos + campo PCD

**Files:**
- Modify: `components/efetivo/modal-admitir-admin.tsx`

- [ ] **Step 1: Adicionar estados PCD**

Em `components/efetivo/modal-admitir-admin.tsx`, junto dos demais `useState` (perto da linha
20-25), adicionar:
```ts
  const [pcd,         setPcd]         = useState(false)
  const [pcdTipo,      setPcdTipo]     = useState('')
  const [pcdTipoOutro, setPcdTipoOutro] = useState('')
```

- [ ] **Step 2: Resetar os novos estados em `handleClose` e "Admitir outro"**

Na função `handleClose` (linha 37-42), adicionar `setPcd(false); setPcdTipo(''); setPcdTipoOutro('')`
junto das demais chamadas de reset:
```ts
  function handleClose() {
    if (pending) return
    setErro(null); setOk(false); setPostoSearch(''); setPeriodoExp('45+45')
    setPcd(false); setPcdTipo(''); setPcdTipoOutro('')
    formRef.current?.reset()
    onClose()
  }
```
No botão "Admitir outro" (linha 68), o `onClick` ganha a mesma limpeza:
```tsx
              <button type="button" onClick={() => { setOk(false); setErro(null); setPeriodoExp('45+45'); setPcd(false); setPcdTipo(''); setPcdTipoOutro(''); formRef.current?.reset() }}
```

- [ ] **Step 3: Reescrever o corpo do `<form>` em blocos coloridos**

Substituir todo o conteúdo entre `<form ref={formRef} ...>` e o bloco de erro/botões (linhas
79-142) por:
```tsx
          <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
            <div className="rounded-lg border border-slate-100 border-t-4 border-t-blue-400 bg-white p-4 shadow-sm">
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">Dados pessoais</p>
              <div>
                <label className={labelClass}>Nome completo *</label>
                <input name="nome" required placeholder="Nome do funcionário..." className={inputClass} />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Registro</label>
                  <input name="registro" placeholder="Nº registro..." className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>CPF</label>
                  <input name="cpf" placeholder="000.000.000-00" className={inputClass} />
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-100 border-t-4 border-t-indigo-400 bg-white p-4 shadow-sm">
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">Função &amp; posto</p>
              <div>
                <label className={labelClass}>Função *</label>
                <select name="funcao_id" required className={inputClass}>
                  <option value="">Selecione...</option>
                  {funcoes.map(f => (
                    <option key={f.id} value={f.id}>{f.nome}</option>
                  ))}
                </select>
              </div>
              <div className="mt-3">
                <label className={labelClass}>Posto *</label>
                <input
                  placeholder="Buscar posto..."
                  value={postoSearch}
                  onChange={e => setPostoSearch(e.target.value)}
                  className={inputClass + ' mb-1'}
                />
                <select name="posto_id" required className={inputClass} size={4} style={{ height: 'auto' }}>
                  <option value="">Selecione...</option>
                  {postosFiltrados.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.nome}{p.secretaria ? ` — ${p.secretaria}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="rounded-lg border border-slate-100 border-t-4 border-t-orange-400 bg-white p-4 shadow-sm">
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">Admissão</p>
              <div>
                <label className={labelClass}>Data de admissão *</label>
                <input name="data_admissao" type="date" required className={inputClass} />
              </div>
              <div className="mt-3">
                <label className={labelClass}>Período de Experiência</label>
                <select
                  name="periodo_experiencia"
                  value={periodoExp}
                  onChange={e => setPeriodoExp(e.target.value as '30+30' | '45+45' | '')}
                  className={inputClass}
                >
                  <option value="">Nenhum</option>
                  <option value="30+30">30 + 30 dias</option>
                  <option value="45+45">45 + 45 dias</option>
                </select>
              </div>
            </div>

            <div className="rounded-lg border border-slate-100 border-t-4 border-t-amber-400 bg-white p-4 shadow-sm">
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">PCD</p>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <input
                  type="checkbox"
                  name="pcd"
                  checked={pcd}
                  onChange={e => { setPcd(e.target.checked); if (!e.target.checked) { setPcdTipo(''); setPcdTipoOutro('') } }}
                  className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                />
                Pessoa com deficiência
              </label>
              {pcd && (
                <div className="mt-3 space-y-2">
                  <select
                    name="pcd_tipo"
                    value={pcdTipo}
                    onChange={e => setPcdTipo(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">Selecione o tipo...</option>
                    <option value="Visual">Visual</option>
                    <option value="Física">Física</option>
                    <option value="Auditiva">Auditiva</option>
                    <option value="Intelectual">Intelectual</option>
                    <option value="Outra">Outra</option>
                  </select>
                  {pcdTipo === 'Outra' && (
                    <input
                      name="pcd_tipo_outro"
                      value={pcdTipoOutro}
                      onChange={e => setPcdTipoOutro(e.target.value)}
                      placeholder="Descreva o tipo..."
                      className={inputClass}
                    />
                  )}
                </div>
              )}
            </div>

            {erro && (
              <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{erro}</p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={handleClose} disabled={pending}
                className="rounded px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50">
                Cancelar
              </button>
              <button type="submit" disabled={pending}
                className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50">
                {pending ? 'Admitindo...' : 'Admitir'}
              </button>
            </div>
          </form>
```

- [ ] **Step 4: Ampliar a largura do modal**

Na `<div>` externa do modal (linha 59), trocar `max-w-lg` por `max-w-xl`:
```tsx
      <div className="w-full max-w-xl rounded-xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
```

- [ ] **Step 5: Rodar build**

Run: `npm run build`
Expected: build sem erros.

- [ ] **Step 6: Commit**

```bash
git add components/efetivo/modal-admitir-admin.tsx
git commit -m "feat(efetivo): redesenha modal de admissão em blocos + campo PCD

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 10: Verificação final

**Files:** nenhum (só validação)

- [ ] **Step 1: Type-check completo**

Run: `npx tsc --noEmit`
Expected: sem erros novos.

- [ ] **Step 2: Build de produção**

Run: `npm run build`
Expected: build conclui sem erros.

- [ ] **Step 3: Conferência manual no navegador**

Abrir `/efetivo`, confirmar badge PCD aparece nos 68 funcionários esperados; abrir modal de
admissão e conferir layout em blocos + campo PCD funcional; abrir modal de editar um funcionário
PCD existente e confirmar que o campo vem pré-marcado com o tipo certo; abrir `/postos`, expandir
um posto com funcionário PCD e conferir o badge na lista.
