# Termo de Movimentação + Controle de Protocolo RH — Plano de Implementação

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans. Passos usam checkbox (`- [ ]`).

**Goal:** Termo de movimentação completo (ORIGEM → DESTINO com posto, secretaria, supervisor, função e horário), agrupado por solicitação, com assinatura do supervisor solicitante e aprovador real, mais página `/movimentacoes` para controlar entrega ao RH.

**Architecture:** Um "termo" = todas as linhas de `movimentacoes` com o mesmo `solicitacao_id` (ou 1 linha quando manual). Um builder puro (`montarTermo`) transforma linhas + dados de apoio em `TermoData`; o PDF só renderiza `TermoData`. Supervisores de origem/destino são gravados em snapshot na aprovação (`solicitacoes.dados_depois.termo_snapshot`), pois mudam com o tempo. Protocolo RH fica na tabela `termos_protocolo`.

**Tech Stack:** Next.js 14, Supabase, TypeScript, @react-pdf/renderer, Tailwind, vitest (`lib/**/*.test.ts`).

**Regras do projeto:** `createClient()` é SÍNCRONO. CPF sempre mascarado. Rodar `npm run build` ao fim de cada tarefa. Nunca `git push`.

---

## Estrutura de arquivos

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `supabase/migrations/20260924_termos_protocolo.sql` | Criar | Tabela + RLS |
| `types/database.ts` | Modificar | Tipos de `termos_protocolo` |
| `lib/termos/tipos.ts` | Criar | `TermoData`, `TermoLinhaDiff` |
| `lib/termos/montar-termo.ts` | Criar | Builder puro (testável) |
| `lib/termos/montar-termo.test.ts` | Criar | Testes do builder |
| `lib/termos/carregar-termo.ts` | Criar | Server action: busca dados e chama o builder |
| `app/(admin)/efetivo/horario/actions.ts` | Modificar | `aplicarMudancaHorario` recebe `solicitacaoId` |
| `app/(admin)/aprovacoes/actions.ts` | Modificar | Snapshot de supervisores + repassar `solicitacaoId` |
| `components/efetivo/movimentacao-pdf.tsx` | Reescrever | Novo layout a partir de `TermoData` |
| `components/efetivo/perfil-tabs.tsx` | Modificar | Botões usam o termo agrupado |
| `app/(admin)/movimentacoes/page.tsx` | Criar | Lista de termos e filtros |
| `app/(admin)/movimentacoes/actions.ts` | Criar | Protocolar / desfazer |
| `components/movimentacoes/movimentacoes-client.tsx` | Criar | Tabela, filtros, ações, lote |
| `components/admin/nav-config.ts`, `sidebar-nav.tsx`, `app/(admin)/layout.tsx` | Modificar | Item de menu + badge de pendentes |

---

### Task 1: Migração e tipos

**Files:**
- Create: `supabase/migrations/20260924_termos_protocolo.sql`
- Modify: `types/database.ts` (dentro de `Tables`, ordem alfabética, após `solicitacoes`... use o mesmo formato das demais)

- [ ] **Step 1: Escrever a migração**

```sql
-- Controle de protocolo dos termos de movimentação no RH.
-- Aditiva. Aplicar no Supabase Studio (SQL Editor).
-- chave_termo: 'sol:<solicitacao_id>' quando há solicitação; 'mov:<movimentacao_id>' quando manual.

CREATE TABLE IF NOT EXISTS termos_protocolo (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chave_termo    text NOT NULL UNIQUE,
  funcionario_id uuid NOT NULL REFERENCES funcionarios(id),
  protocolado_em timestamptz NOT NULL DEFAULT now(),
  protocolado_por uuid NOT NULL REFERENCES perfis(id),
  observacao     text,
  created_at     timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_termos_protocolo_func ON termos_protocolo (funcionario_id);

ALTER TABLE termos_protocolo ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS termos_protocolo_select ON termos_protocolo;
CREATE POLICY termos_protocolo_select ON termos_protocolo
  FOR SELECT TO authenticated
  USING (
    is_admin_or_coord() OR is_viewer()
    OR funcionario_id IN (
      SELECT id FROM funcionarios WHERE posto_id IN (SELECT get_supervisor_posto_ids())
    )
  );
-- Escrita somente via service role (Server Actions com createAdminClient, que validam o escopo).
```

- [ ] **Step 2: Adicionar tipos** em `types/database.ts`, no padrão Row/Insert/Update das outras tabelas, com `Relationships: []`:
  `id, chave_termo, funcionario_id, protocolado_em, protocolado_por, observacao, created_at`.

- [ ] **Step 3: Aplicar a migração** no Supabase Studio (manual — avisar o usuário) e validar: `select count(*) from termos_protocolo;` retorna 0.

- [ ] **Step 4: Build e commit**

```bash
npx tsc --noEmit
git add supabase/migrations/20260924_termos_protocolo.sql types/database.ts
git commit -m "feat(termos): tabela termos_protocolo para controle de entrega ao RH"
```

---

### Task 2: Tipos e builder puro do termo (TDD)

**Files:**
- Create: `lib/termos/tipos.ts`, `lib/termos/montar-termo.ts`, `lib/termos/montar-termo.test.ts`

- [ ] **Step 1: Criar `lib/termos/tipos.ts`**

```ts
export type HorarioTermo = {
  nome: string | null
  escala: string | null
  entrada: string | null
  saidaSegQui: string | null
  entradaSex: string | null
  saidaSex: string | null
  almocoInicio: string | null
  almocoFim: string | null
  entradaSab: string | null
  saidaSab: string | null
}

export type TermoLinhaDiff = {
  rotulo: string          // ex.: 'Posto de Trabalho'
  antes: string           // texto já formatado
  depois: string
  mudou: boolean
}

export type TermoTipo =
  | 'transferencia' | 'mudanca_funcao' | 'promocao' | 'mudanca_horario'
  | 'desligamento' | 'afastamento' | 'retorno_afastamento' | 'alteracao_salario' | 'outro'

export type TermoData = {
  chave: string                 // 'sol:<id>' ou 'mov:<id>'
  codigo: string                // MOV-XXXXXXXX
  tipo: TermoTipo
  titulo: string                // ex.: TERMO DE TRANSFERÊNCIA DE COLABORADOR
  tiposIncluidos: string[]      // ex.: ['transferencia','mudanca_funcao','mudanca_horario']
  colaborador: {
    id: string; nome: string; registro: string | null
    funcao: string | null; admissao: string | null
  }
  diffs: TermoLinhaDiff[]
  efetivacao: string | null     // ISO date
  solicitadoPor: string | null
  solicitadoEm: string | null   // ISO datetime
  aprovadoPor: string | null
  aprovadoEm: string | null
  motivo: string | null
  supervisorOrigem: string | null
  supervisorDestino: string | null
  emitidoEm: string             // ISO datetime
}
```

- [ ] **Step 2: Escrever testes** em `lib/termos/montar-termo.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { formatarHorario, montarDiffs, tituloDoTermo } from './montar-termo'
import type { HorarioTermo } from './tipos'

const h = (o: Partial<HorarioTermo>): HorarioTermo => ({
  nome: null, escala: null, entrada: null, saidaSegQui: null, entradaSex: null,
  saidaSex: null, almocoInicio: null, almocoFim: null, entradaSab: null, saidaSab: null, ...o,
})

describe('formatarHorario', () => {
  it('devolve traço sem horário', () => {
    expect(formatarHorario(null)).toEqual(['—'])
  })
  it('monta linhas seg-qui, sexta distinta, sábado e almoço', () => {
    const linhas = formatarHorario(h({
      nome: 'Turno 11h (b)', escala: '5x1', entrada: '07:00:00', saidaSegQui: '18:00:00',
      saidaSex: '17:00:00', almocoInicio: '12:00:00', almocoFim: '13:00:00',
    }))
    expect(linhas).toContain('Turno 11h (b) · 5x1')
    expect(linhas).toContain('Seg–Qui: 07:00 às 18:00')
    expect(linhas).toContain('Sexta: 07:00 às 17:00')
    expect(linhas).toContain('Almoço: 12:00 às 13:00')
  })
})

describe('montarDiffs', () => {
  it('marca mudou só onde há diferença e mantém sem alteração', () => {
    const d = montarDiffs({
      posto: { antes: 'A', depois: 'B' },
      secretaria: { antes: 'SMMT', depois: 'SMMT' },
      supervisor: { antes: 'X', depois: 'Y' },
      funcao: { antes: 'AJ', depois: 'AJ' },
      horario: { antes: h({ nome: 'T1', entrada: '07:00', saidaSegQui: '16:00' }), depois: h({ nome: 'T2', entrada: '08:00', saidaSegQui: '17:00' }) },
    })
    const por = Object.fromEntries(d.map(x => [x.rotulo, x.mudou]))
    expect(por['Posto de Trabalho']).toBe(true)
    expect(por['Secretaria']).toBe(false)
    expect(por['Supervisor']).toBe(true)
    expect(por['Função']).toBe(false)
    expect(por['Horário']).toBe(true)
  })
})

describe('tituloDoTermo', () => {
  it('usa transferência quando há posto', () => {
    expect(tituloDoTermo(['transferencia', 'mudanca_horario'])).toBe('TERMO DE TRANSFERÊNCIA DE COLABORADOR')
  })
  it('usa mudança de horário isolada', () => {
    expect(tituloDoTermo(['mudanca_horario'])).toBe('TERMO DE ALTERAÇÃO DE HORÁRIO')
  })
})
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx vitest run lib/termos/montar-termo.test.ts`
Expected: FAIL (módulo inexistente)

- [ ] **Step 4: Implementar `lib/termos/montar-termo.ts`**

```ts
import type { HorarioTermo, TermoLinhaDiff, TermoTipo } from './tipos'

const hm = (v: string | null) => (v ? v.slice(0, 5) : null)

export function formatarHorario(t: HorarioTermo | null): string[] {
  if (!t || !t.entrada) return ['—']
  const linhas: string[] = []
  linhas.push([t.nome, t.escala].filter(Boolean).join(' · ') || 'Horário')
  linhas.push(`Seg–Qui: ${hm(t.entrada)} às ${hm(t.saidaSegQui)}`)
  if (t.saidaSex && t.saidaSex !== t.saidaSegQui) linhas.push(`Sexta: ${hm(t.entradaSex ?? t.entrada)} às ${hm(t.saidaSex)}`)
  if (t.entradaSab && t.saidaSab) linhas.push(`Sábado: ${hm(t.entradaSab)} às ${hm(t.saidaSab)}`)
  if (t.almocoInicio && t.almocoFim) linhas.push(`Almoço: ${hm(t.almocoInicio)} às ${hm(t.almocoFim)}`)
  return linhas
}

type Par = { antes: string | null; depois: string | null }

export function montarDiffs(d: {
  posto?: Par; secretaria?: Par; supervisor?: Par; funcao?: Par
  horario?: { antes: HorarioTermo | null; depois: HorarioTermo | null }
}): TermoLinhaDiff[] {
  const out: TermoLinhaDiff[] = []
  const add = (rotulo: string, p: Par | undefined) => {
    if (!p) return
    const antes = p.antes ?? '—'
    const depois = p.depois ?? '—'
    out.push({ rotulo, antes, depois, mudou: antes !== depois })
  }
  add('Posto de Trabalho', d.posto)
  add('Secretaria', d.secretaria)
  add('Supervisor', d.supervisor)
  add('Função', d.funcao)
  if (d.horario) {
    const antes = formatarHorario(d.horario.antes).join('\n')
    const depois = formatarHorario(d.horario.depois).join('\n')
    out.push({ rotulo: 'Horário', antes, depois, mudou: antes !== depois })
  }
  return out
}

export function tipoDoTermo(tipos: string[]): TermoTipo {
  if (tipos.includes('transferencia')) return 'transferencia'
  if (tipos.includes('promocao')) return 'promocao'
  if (tipos.includes('mudanca_funcao')) return 'mudanca_funcao'
  if (tipos.includes('mudanca_horario')) return 'mudanca_horario'
  if (tipos.includes('desligamento')) return 'desligamento'
  if (tipos.includes('retorno_afastamento')) return 'retorno_afastamento'
  if (tipos.includes('afastamento')) return 'afastamento'
  if (tipos.includes('alteracao_salario')) return 'alteracao_salario'
  return 'outro'
}

const TITULOS: Record<TermoTipo, string> = {
  transferencia: 'TERMO DE TRANSFERÊNCIA DE COLABORADOR',
  mudanca_funcao: 'TERMO DE MUDANÇA DE FUNÇÃO',
  promocao: 'TERMO DE PROMOÇÃO',
  mudanca_horario: 'TERMO DE ALTERAÇÃO DE HORÁRIO',
  desligamento: 'TERMO DE DESLIGAMENTO',
  afastamento: 'TERMO DE AFASTAMENTO',
  retorno_afastamento: 'TERMO DE RETORNO DE AFASTAMENTO',
  alteracao_salario: 'TERMO DE ALTERAÇÃO SALARIAL',
  outro: 'TERMO DE MOVIMENTAÇÃO DE PESSOAL',
}

export function tituloDoTermo(tipos: string[]): string {
  return TITULOS[tipoDoTermo(tipos)]
}

/** Cor de destaque por tipo — usada no PDF e na página /movimentacoes. */
export const COR_TIPO: Record<TermoTipo, { hex: string; fundo: string }> = {
  transferencia:       { hex: '#1d4ed8', fundo: '#eff6ff' },
  mudanca_funcao:      { hex: '#7c3aed', fundo: '#f5f3ff' },
  promocao:            { hex: '#059669', fundo: '#ecfdf5' },
  mudanca_horario:     { hex: '#d97706', fundo: '#fffbeb' },
  desligamento:        { hex: '#dc2626', fundo: '#fef2f2' },
  afastamento:         { hex: '#ea580c', fundo: '#fff7ed' },
  retorno_afastamento: { hex: '#0891b2', fundo: '#ecfeff' },
  alteracao_salario:   { hex: '#4f46e5', fundo: '#eef2ff' },
  outro:               { hex: '#475569', fundo: '#f8fafc' },
}
```

- [ ] **Step 5: Rodar testes**

Run: `npx vitest run lib/termos/montar-termo.test.ts`
Expected: PASS (5 testes)

- [ ] **Step 6: Commit**

```bash
git add lib/termos
git commit -m "feat(termos): tipos e builder puro do termo de movimentacao"
```

---

### Task 3: Vincular horário à solicitação e gravar snapshot de supervisores

**Files:**
- Modify: `app/(admin)/efetivo/horario/actions.ts:239-294`
- Modify: `app/(admin)/aprovacoes/actions.ts` (chamadas em ~199, 223, 296, 315, 401 e bloco final ~443)

- [ ] **Step 1: `aplicarMudancaHorario` recebe `solicitacaoId?: string | null`** como 6º parâmetro opcional e o grava no insert de `movimentacoes` (`solicitacao_id: solicitacaoId ?? null`). Manter compatível com chamadores atuais.

- [ ] **Step 2: Em `aprovarSolicitacao`, passar `id` (a solicitação) como 6º argumento em TODAS as 5 chamadas** de `aplicarMudancaHorario`.

- [ ] **Step 3: Helper de supervisor** no topo de `aprovacoes/actions.ts`:

```ts
async function nomeSupervisorDoPosto(postoId: string | null): Promise<string | null> {
  if (!postoId) return null
  const adm = createAdminClient()
  const { data } = await adm
    .from('config_supervisores_postos')
    .select('perfis!supervisor_id(nome)')
    .eq('posto_id', postoId)
    .eq('ativo', true)
    .limit(1)
    .maybeSingle()
  return (data as unknown as { perfis: { nome: string | null } | null } | null)?.perfis?.nome ?? null
}
```

- [ ] **Step 4: Gravar o snapshot ANTES do `switch`** (origem ainda é o posto atual). Para `transferencia` e `retorno_afastamento` o posto destino é `dadosDepois.posto_destino_id` / `posto_retorno_id`; para os demais tipos, origem = destino = `func.posto_id`.

```ts
const postoOrigemId = func?.posto_id ?? null
const postoDestSnapId = sol.tipo === 'transferencia'
  ? (dadosDepois.posto_destino_id as string | undefined) ?? null
  : sol.tipo === 'retorno_afastamento'
    ? (dadosDepois.posto_retorno_id as string | undefined) ?? postoOrigemId
    : postoOrigemId
const [supOrigem, supDestino] = await Promise.all([
  nomeSupervisorDoPosto(postoOrigemId),
  nomeSupervisorDoPosto(postoDestSnapId),
])
dadosDepois.termo_snapshot = {
  supervisor_origem_nome: supOrigem,
  supervisor_destino_nome: supDestino,
  posto_origem_id: postoOrigemId,
  posto_destino_id: postoDestSnapId,
  data_efetivacao: hojeISO,
}
```

`dadosDepois` já é persistido no `update` final (linha ~461). Para o caso `mudanca_horario` (return antecipado, ~323) e `admissao`, incluir `dados_depois: dadosDepois as unknown as Json` no update correspondente do case `mudanca_horario`.

- [ ] **Step 5: Build e commit**

```bash
npm run build
git add "app/(admin)/efetivo/horario/actions.ts" "app/(admin)/aprovacoes/actions.ts"
git commit -m "feat(termos): horario vinculado a solicitacao e snapshot de supervisores na aprovacao"
```

---

### Task 4: Carregar o termo (server action)

**Files:**
- Create: `lib/termos/carregar-termo.ts`

`'use server'`. Exporta `carregarTermo(chave: string): Promise<TermoData | null>`, `carregarTermoDaMovimentacao(movId: string)` (resolve a chave: `sol:<solicitacao_id>` se houver, senão `mov:<id>`).

- [ ] **Step 1: Implementar.** Usar `createClient()` (RLS) para validar acesso e `createAdminClient()` só para nomes de posto/supervisor fora do escopo do supervisor (mesmo padrão de `solicitarTransferencia`).

Lógica:
1. Resolver linhas: `chave = 'sol:<id>'` → `movimentacoes.select('id,tipo,campo_alterado,valor_antes,valor_depois,created_at,funcionario_id,solicitacao_id, perfis!executado_por(nome)').eq('solicitacao_id', id)`; `'mov:<id>'` → `.eq('id', id)`. Retornar `null` se vazio.
2. Solicitação (se houver): `solicitacoes.select('tipo,motivo,dados_antes,dados_depois,created_at,aprovado_em, sol:perfis!supervisor_id(nome), apr:perfis!aprovado_por(nome)')`. `solicitadoPor` = `sol.nome`; `aprovadoPor` = `apr.nome`. Sem solicitação: `solicitadoPor = null`, `aprovadoPor = perfis.nome` da linha (executado_por).
3. Colaborador: `funcionarios.select('id,nome,registro,data_admissao,posto_id, funcoes!funcao_id(nome), postos!posto_id(nome,secretaria)')`.
4. Ids de posto: `snapshot.posto_origem_id ?? dados_antes.posto_id` e `snapshot.posto_destino_id ?? dados_depois.posto_destino_id`; buscar `postos(id,nome,secretaria)` em uma query `.in('id', ids)`. Sem transferência, usar posto atual dos dois lados.
5. Função: linhas com `campo_alterado='funcao_id'` → `funcoes.select('id,nome').in('id',[antes,depois])`; sem mudança, função atual dos dois lados.
6. Horário: linha `tipo='mudanca_horario'` → `turnos_postos` (`nome,tipo_escala,hora_entrada,hora_saida_seg_qui,hora_entrada_sex,hora_saida_sex,hora_inicio_almoco,hora_fim_almoco,hora_entrada_sabado,hora_saida_sabado`) `.in('id',[valor_antes,valor_depois])`, mapeando para `HorarioTermo` (`escala = tipo_escala`). Se não houver linha de horário, não incluir o diff de horário (`horario: undefined`).
7. Supervisor: `snapshot.supervisor_origem_nome/destino_nome`; sem snapshot (termos antigos), usar `sol.nome` como fallback do destino e `null` na origem.
8. `montarDiffs({...})`, `tituloDoTermo(tipos)`, `tipoDoTermo(tipos)`; `codigo = 'MOV-' + primeiros 8 chars (upper) do id da solicitação, ou da movimentação`.
9. `efetivacao = snapshot.data_efetivacao ?? created_at do primeiro registro`.
10. Se `tipos` = só `['alteracao_salario']`, NÃO exibir valores salariais no PDF além do que já exibia (manter comportamento atual: sem salário).

- [ ] **Step 2: Build, commit**

```bash
npm run build
git add lib/termos/carregar-termo.ts
git commit -m "feat(termos): server action que monta o termo agrupado por solicitacao"
```

---

### Task 5: Novo PDF

**Files:**
- Rewrite: `components/efetivo/movimentacao-pdf.tsx` (mantém export `FuncionarioParaPDF` se ainda usada por `perfil-tabs.tsx`/`mov-colaborador-pdf`; caso contrário remover)

Nova API: `export async function downloadTermoPDF(termo: TermoData): Promise<void>` — nome de arquivo `MOV_<codigo>_<NOME_SLUG>_<AAAAMMDD>.pdf`. Manter `'use client'`, import dinâmico de `pdf`.

- [ ] **Step 1: Layout (Helvetica, A4, padding 40)**, cor de destaque = `COR_TIPO[termo.tipo]`:
  1. **Cabeçalho:** DEMAX + "Serviços e Comércio LTDA" à esquerda; à direita "REGISTRO" e `codigo`; linha inferior 2pt na cor do tipo.
  2. **Título** em caixa com borda e fundo `COR_TIPO.fundo`, texto na cor do tipo.
  3. **I. Colaborador** — grade 2 colunas: Nome, RE, Função atual, CPF `***.***.***-**`, Admissão.
  4. **II. Alterações (ORIGEM → DESTINO)** — tabela com 3 colunas: `Item | ORIGEM (fundo cinza claro) | DESTINO (fundo verde claro `#ecfdf5`)`. Linha com `mudou=true`: fundo âmbar claro `#fffbeb`, valor destino em negrito e barra lateral na cor do tipo; `mudou=false`: texto cinza + selo "sem alteração". Valores multilinha (horário) usam `\n` → `<Text>` por linha. Usar `wrap={false}` na tabela.
  5. **III. Efetivação e Trâmite** — 4 cartões em linha: Efetivação (data), Solicitado por (nome + data/hora), Aprovado por (nome + data/hora), Emitido em.
  6. **IV. Motivo** (só se houver), caixa âmbar.
  7. **V. Declaração:** "A DEMAX SERVIÇOS E COMÉRCIO LTDA comunica ao Departamento de Recursos Humanos que o(a) colaborador(a) **NOME** teve as alterações acima registradas, com efeito a partir de **DD/MM/AAAA**. Solicita-se a atualização do cadastro funcional, controle de ponto, benefícios e demais registros pertinentes, conforme aplicável."
  8. **VI. Assinaturas** (linhas de assinatura): `Colaborador(a)`, `Supervisor(a) solicitante — <nome>`, e apenas em `transferencia`, `Supervisor(a) de destino — <supervisorDestino>` (se diferente do solicitante). Abaixo, faixa "APROVADO POR: <aprovadoPor> — Coordenação/Administração · <aprovadoEm>" (sem linha de assinatura).
  9. **Caixa PROTOCOLO RH** (borda tracejada, fundo `#f8fafc`): "Recebido em ___/___/______ · Nome do recebedor: ______________ · Carimbo / assinatura RH".
  10. **Rodapé fixo:** `DEMAX Serviços e Comércio LTDA` · `codigo · Emitido em dd/mm/aaaa hh:mm` · `Página x de y` (`render={({pageNumber,totalPages})=>...}`).
- Cabe em 1 página: fonte 9, espaçamentos enxutos; se o horário for longo, permitir quebra natural.

- [ ] **Step 2: Build e conferência visual** — gerar termo de teste (Task 6) e abrir o PDF; conferir: quadro ORIGEM/DESTINO, supervisores, horário, assinaturas, caixa RH.

- [ ] **Step 3: Commit**

```bash
git add components/efetivo/movimentacao-pdf.tsx
git commit -m "feat(termos): novo layout do PDF com quadro origem/destino, supervisores, horario e protocolo RH"
```

---

### Task 6: Ligar ao perfil do funcionário

**Files:**
- Modify: `components/efetivo/perfil-tabs.tsx` (`TabMovimentacoes`, `handleDownload`, imports)

- [ ] **Step 1:** Em `handleDownload(mov)`: manter o ramo `mudanca_funcao` isolado (sem posto/horário no mesmo grupo) como está; nos demais casos, `const termo = await carregarTermoDaMovimentacao(mov.id); if (termo) await downloadTermoPDF(termo)`.
  - Regra: se a solicitação do grupo contém `transferencia`, usar sempre o termo novo, inclusive quando a linha clicada for `mudanca_funcao`/`mudanca_horario`.
- [ ] **Step 2:** Remover do JSX as linhas duplicadas do mesmo grupo? **Não** — a timeline continua mostrando todas as linhas; só o PDF é agrupado. Adicionar um selo com a cor do tipo (`COR_TIPO`) e um selo "Protocolado em dd/mm" / "Pendente RH" por linha (dado vem de `termos_protocolo` carregado em `efetivo/[id]/page.tsx` e passado via prop `protocolos: Record<string,string>` chave→data).
- [ ] **Step 3:** `npm run build`, testar no navegador (preview) com a Aline (transferência 14/07): PDF deve mostrar TERMINAL ESTUDANTES, supervisores, horário, e os selos.
- [ ] **Step 4: Commit** `git commit -am "feat(termos): perfil usa termo agrupado e mostra status de protocolo"`

---

### Task 7: Página `/movimentacoes` e protocolo

**Files:**
- Create: `app/(admin)/movimentacoes/page.tsx`, `app/(admin)/movimentacoes/actions.ts`, `components/movimentacoes/movimentacoes-client.tsx`
- Modify: `components/admin/nav-config.ts`, `components/admin/sidebar-nav.tsx`, `app/(admin)/layout.tsx`

- [ ] **Step 1: `actions.ts` (`'use server'`)**

```ts
export async function protocolarTermo(chave: string, observacao?: string): Promise<{ success: boolean; error?: string }>
export async function desfazerProtocolo(chave: string): Promise<{ success: boolean; error?: string }>
```
Regras: `getUser()`; roles `admin|coordenador|supervisor` (viewer não). Para `supervisor`, validar via `createClient()` (RLS) que enxerga a movimentação (`select id` do funcionário/linha) antes de escrever com `createAdminClient()`. `protocolarTermo` faz `upsert` em `termos_protocolo` (`onConflict: 'chave_termo'`) com `protocolado_por = user.id`. `desfazerProtocolo` só admin/coordenador. Registrar em auditoria seguindo `lib/auditoria` (mesmo padrão das demais actions). `revalidatePath('/movimentacoes')` e `/efetivo`.

- [ ] **Step 2: `page.tsx` (Server Component)** — `getUser()`; buscar `movimentacoes` dos últimos 90 dias (filtro por período na URL: `?de=&ate=&tipo=&supervisor=&status=`) com `solicitacao_id`, agrupar por chave (`sol:` ou `mov:`), excluir tipos internos (`rejeicao`, `atestado`, `admissao` se não gerarem termo hoje — confirmar com a lista atual de `TIPO_LABELS`), juntar `funcionarios(nome, postos(nome))`, supervisor solicitante e `termos_protocolo`. Supervisores: RLS já limita. Usar `fetchAllRows` se passar de 1000 linhas.

- [ ] **Step 3: `movimentacoes-client.tsx`** — cores por status:
  - **Pendente** ⇒ chip âmbar (`bg-amber-50 text-amber-700 ring-amber-200`); pendente há >3 dias ⇒ chip vermelho "Atrasado" e linha com borda esquerda vermelha.
  - **Protocolado** ⇒ chip verde com data e quem protocolou.
  - Chip do tipo com `COR_TIPO`.
  - Cards de resumo no topo (borda superior 4px): Pendentes (amber), Atrasados (red), Protocolados no mês (green).
  - Ações por linha: `PDF` (botão amber-500), `Marcar protocolado` (verde), `Desfazer` (só admin/coord).
  - Seleção múltipla + "Baixar PDFs selecionados" (gera um PDF por termo, em sequência) e "Marcar selecionados como protocolados".
  - Filtros: período, tipo, supervisor (só admin/coord), status; padrão = **Pendentes**.

- [ ] **Step 4: Menu** — `nav-config.ts`: em "Operacional", após `/aprovacoes`: `{ href: '/movimentacoes', label: 'Movimentações', termosBadge: true }` (novo campo opcional em `NavItem`). `sidebar-nav.tsx`: ícone `FileCheck2` (lucide) em `ICONS`, prop `termosPendentes: number`, badge âmbar quando `termosBadge` (mesmo estilo do badge de aprovações). `layout.tsx`: contar termos pendentes (mesma agregação da página, últimos 90 dias; supervisor = escopo RLS) e passar para `SidebarNav`. Checar `middleware.ts`: rota liberada a `supervisor` e `viewer` (viewer só leitura).

- [ ] **Step 5: Verificar no preview** — `preview_start` do dev server; logar; abrir `/movimentacoes`; conferir filtros, protocolar, desfazer, badge do menu e escopo do supervisor.

- [ ] **Step 6: Build e commit**

```bash
npm run build
git add app/(admin)/movimentacoes components/movimentacoes components/admin "app/(admin)/layout.tsx"
git commit -m "feat(movimentacoes): pagina de controle de protocolo dos termos no RH com badge no menu"
```

---

## Auto-revisão contra a spec

| Requisito da spec | Tarefa |
|---|---|
| Termo agrupado por solicitação | 3 (vínculo do horário), 4 |
| Snapshot de supervisores/data | 3 |
| Horário, supervisor, função, secretaria antes/depois | 2, 4 |
| PDF novo com cores, assinaturas, aprovador real, caixa RH | 5 |
| Sem "Executado por" | 5 |
| Página, filtros, lote, badge, âmbar >3 dias | 7 |
| Admin, coord e supervisor marcam protocolado | 7 (actions) |
| Migração + RLS | 1 |
| Fora de escopo: e-mail | — |

Risco conhecido: termos anteriores a esta entrega não têm snapshot; mostram supervisor de origem "—". Aceito na spec.
