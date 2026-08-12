# Fase 2 — Múltiplas Escalas por Posto Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que um posto tenha turnos (e portanto funcionários) em mais de um regime de trabalho ao mesmo tempo — qualquer combinação entre `5x2`/`5x1`/`12x36`. Regime passa a ser escolhido no formulário de cada turno (com sugestão pré-preenchida do "regime padrão" do posto), em vez de forçado e travado pelo regime único configurado no posto.

**Architecture:** `criarTurno`/`editarTurno` deixam de herdar/travar o regime do posto — passam a receber `tipo_escala` explicitamente no payload do turno. `config_escalas_postos` não muda de schema, só de papel: vira "sugestão de regime padrão" (usada como default no seletor do formulário e como fallback do helper `obterRegimesPorFuncionario` da Fase 1). O modal de turnos ganha um `<select>` de regime no formulário de novo/editar turno. O relatório de Fechamento RH, que hoje mostra "o regime do posto" como 1 valor, passa a mostrar a lista de regimes distintos presentes naquele posto no mês (`FechamentoPosto.regime: string` → `regimes: string[]`).

**Tech Stack:** Next.js 14 App Router, Supabase, TypeScript, React (client components). Sem test runner — verificação via `npx tsc --noEmit`, `npm run build`, e checagem manual no browser (preview).

**Pré-requisito:** Fase 1 (commit `d0f4c69` em `master`) — regime do funcionário já vem do turno vigente dele. Ver `docs/superpowers/plans/2026-08-12-regime-por-funcionario-fase-1.md` e a spec desta fase em `docs/superpowers/specs/2026-08-12-multiplas-escalas-por-posto-design.md`.

**Fora de escopo:** fechamento financeiro (não tem agregação por posto), regime de destino em cobertura temporária (continua lendo o regime padrão do posto de destino), rótulo de regime em `lib/movimentacao-colaborador.ts`, `jovem_aprendiz` (fluxo próprio, fora da combinação multi-escala).

---

## Arquivos

- Modificar: `app/(admin)/postos/turnos/actions.ts` — `TurnoData` ganha `tipo_escala`; `criarTurno`/`editarTurno` param de regime em vez de travado.
- Modificar: `components/postos/modal-turnos-posto.tsx` — seletor de regime no form, remove trava do botão "Novo turno".
- Modificar: `app/(admin)/fechamento/config-escalas/page.tsx` — copy do subtítulo.
- Modificar: `app/(admin)/fechamento/actions.ts` — `FechamentoPosto.regime` → `regimes: string[]`.
- Modificar: `components/fechamento/fechamento-client.tsx` — 3 pontos de exibição (Excel, badge, mini-card).
- Modificar: `components/fechamento/fechamento-pdf-doc.tsx` — 1 ponto de exibição (PDF).

---

### Task 1: `postos/turnos/actions.ts` — regime explícito no turno

**Files:**
- Modify: `app/(admin)/postos/turnos/actions.ts`

- [ ] **Step 1: `TurnoData` ganha `tipo_escala`**

```ts
export interface TurnoData {
  nome: string
  hora_entrada: string
  hora_inicio_almoco: string | null
  hora_fim_almoco: string | null
  hora_saida_seg_qui: string
  hora_saida_sex: string | null
  tipo_escala: TipoEscalaPosto
}
```

- [ ] **Step 2: `criarTurno` valida em vez de herdar do posto**

Antes:

```ts
export async function criarTurno(postoId: string, dados: TurnoData) {
  const auth = await getUser()
  if (!auth || !['admin', 'coordenador'].includes(auth.perfil.role ?? '')) {
    return { success: false, error: 'Acesso negado' }
  }
  const regime = await obterRegimePosto(postoId)
  if (!regime) {
    return { success: false, error: 'Configure o regime de trabalho deste posto antes de cadastrar turnos.' }
  }
  const supabase = createClient()
  const { error } = await supabase.from('turnos_postos').insert({
    posto_id: postoId,
    nome: dados.nome,
    hora_entrada: dados.hora_entrada,
    tipo_escala: regime,
    hora_inicio_almoco: dados.hora_inicio_almoco,
    hora_fim_almoco: dados.hora_fim_almoco,
    hora_saida_seg_qui: dados.hora_saida_seg_qui,
    hora_saida_sex: dados.hora_saida_sex,
  })
  if (error) return { success: false, error: error.message }
  revalidatePath('/postos')
  return { success: true }
}
```

Depois:

```ts
export async function criarTurno(postoId: string, dados: TurnoData) {
  const auth = await getUser()
  if (!auth || !['admin', 'coordenador'].includes(auth.perfil.role ?? '')) {
    return { success: false, error: 'Acesso negado' }
  }
  if (!isTipoEscalaPosto(dados.tipo_escala)) {
    return { success: false, error: 'Selecione um regime de trabalho válido para o turno.' }
  }
  const supabase = createClient()
  const { error } = await supabase.from('turnos_postos').insert({
    posto_id: postoId,
    nome: dados.nome,
    hora_entrada: dados.hora_entrada,
    tipo_escala: dados.tipo_escala,
    hora_inicio_almoco: dados.hora_inicio_almoco,
    hora_fim_almoco: dados.hora_fim_almoco,
    hora_saida_seg_qui: dados.hora_saida_seg_qui,
    hora_saida_sex: dados.hora_saida_sex,
  })
  if (error) return { success: false, error: error.message }
  revalidatePath('/postos')
  return { success: true }
}
```

Note: `obterRegimePosto` continua no arquivo (é usada pela UI como sugestão de default — Task 2), só deixa de ser chamada dentro de `criarTurno`.

- [ ] **Step 3: `editarTurno` também aceita e persiste `tipo_escala`**

Antes:

```ts
export async function editarTurno(id: string, dados: TurnoData) {
  const auth = await getUser()
  if (!auth || !['admin', 'coordenador'].includes(auth.perfil.role ?? '')) {
    return { success: false, error: 'Acesso negado' }
  }
  const supabase = createClient()
  const { error } = await supabase
    .from('turnos_postos')
    .update({
      nome: dados.nome,
      hora_entrada: dados.hora_entrada,
      hora_inicio_almoco: dados.hora_inicio_almoco,
      hora_fim_almoco: dados.hora_fim_almoco,
      hora_saida_seg_qui: dados.hora_saida_seg_qui,
      hora_saida_sex: dados.hora_saida_sex,
    })
    .eq('id', id)
  if (error) return { success: false, error: error.message }
  revalidatePath('/postos')
  return { success: true }
}
```

Depois:

```ts
export async function editarTurno(id: string, dados: TurnoData) {
  const auth = await getUser()
  if (!auth || !['admin', 'coordenador'].includes(auth.perfil.role ?? '')) {
    return { success: false, error: 'Acesso negado' }
  }
  if (!isTipoEscalaPosto(dados.tipo_escala)) {
    return { success: false, error: 'Selecione um regime de trabalho válido para o turno.' }
  }
  const supabase = createClient()
  const { error } = await supabase
    .from('turnos_postos')
    .update({
      nome: dados.nome,
      hora_entrada: dados.hora_entrada,
      tipo_escala: dados.tipo_escala,
      hora_inicio_almoco: dados.hora_inicio_almoco,
      hora_fim_almoco: dados.hora_fim_almoco,
      hora_saida_seg_qui: dados.hora_saida_seg_qui,
      hora_saida_sex: dados.hora_saida_sex,
    })
    .eq('id', id)
  if (error) return { success: false, error: error.message }
  revalidatePath('/postos')
  return { success: true }
}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: erros esperados **só** no arquivo `components/postos/modal-turnos-posto.tsx` (chamadas a `criarTurno`/`editarTurno` sem `tipo_escala` no payload) — será corrigido na Task 2. Se aparecer erro em qualquer outro arquivo, investigar antes de prosseguir.

- [ ] **Step 5: Commit**

```bash
git add "app/(admin)/postos/turnos/actions.ts"
git commit -m "feat(postos): regime do turno explicito, sem herdar do posto"
```

---

### Task 2: `modal-turnos-posto.tsx` — seletor de regime no formulário

**Files:**
- Modify: `components/postos/modal-turnos-posto.tsx`

- [ ] **Step 1: Novo state para o regime selecionado no formulário**

Adicionar, junto aos outros `useState` de form fields (perto da linha 54):

```ts
  const [tipoEscalaSelecionado, setTipoEscalaSelecionado] = useState<TipoEscalaPosto | null>(null)
```

- [ ] **Step 2: `abrirNovo` não bloqueia mais por falta de regime do posto, e inicializa o seletor com a sugestão**

Antes:

```ts
  function abrirNovo() {
    if (!regime) return
    setForm('novo')
    setNome('')
    setHoraEntrada('07:00')
    setAlmocoTocado(false)
    setSaidaTocado(false)
    setPersonalizando(false)
    setCatalogoAberto(true)
    setGrupoCatalogo(null)
    setErro(null)
  }
```

Depois:

```ts
  function abrirNovo() {
    setForm('novo')
    setNome('')
    setHoraEntrada('07:00')
    setTipoEscalaSelecionado(regime ?? null)
    setAlmocoTocado(false)
    setSaidaTocado(false)
    setPersonalizando(false)
    setCatalogoAberto(true)
    setGrupoCatalogo(null)
    setErro(null)
  }
```

- [ ] **Step 3: `abrirEditar` inicializa o seletor com o regime já gravado no turno**

Antes:

```ts
  function abrirEditar(t: TurnoPosto) {
    setForm(t)
    setNome(t.nome)
    setHoraEntrada(t.hora_entrada.slice(0, 5))
    setHoraInicioAlmoco(t.hora_inicio_almoco?.slice(0, 5) ?? '')
    setHoraFimAlmoco(t.hora_fim_almoco?.slice(0, 5) ?? '')
    setHoraSaidaSegQui(t.hora_saida_seg_qui.slice(0, 5))
    setHoraSaidaSex(t.hora_saida_sex?.slice(0, 5) ?? '')
    // valores já gravados são tratados como customizados: mudar a entrada não os sobrescreve sozinho
    setAlmocoTocado(true)
    setSaidaTocado(true)
    setPersonalizando(false)
    setErro(null)
  }
```

Depois:

```ts
  function abrirEditar(t: TurnoPosto) {
    setForm(t)
    setNome(t.nome)
    setHoraEntrada(t.hora_entrada.slice(0, 5))
    setHoraInicioAlmoco(t.hora_inicio_almoco?.slice(0, 5) ?? '')
    setHoraFimAlmoco(t.hora_fim_almoco?.slice(0, 5) ?? '')
    setHoraSaidaSegQui(t.hora_saida_seg_qui.slice(0, 5))
    setHoraSaidaSex(t.hora_saida_sex?.slice(0, 5) ?? '')
    setTipoEscalaSelecionado(resolverTipoEscalaPosto(t.tipo_escala))
    // valores já gravados são tratados como customizados: mudar a entrada não os sobrescreve sozinho
    setAlmocoTocado(true)
    setSaidaTocado(true)
    setPersonalizando(false)
    setErro(null)
  }
```

- [ ] **Step 4: Handler pra trocar o regime no formulário — reseta horários derivados e catálogo, igual já acontece ao aplicar um item do catálogo**

Adicionar logo após `aplicarItemCatalogo`:

```ts
  function handleMudarRegimeForm(tipo: TipoEscalaPosto) {
    setTipoEscalaSelecionado(tipo)
    setAlmocoTocado(false)
    setSaidaTocado(false)
    setCatalogoAberto(true)
    setGrupoCatalogo(null)
  }
```

- [ ] **Step 5: `tipoEscalaForm` passa a vir do estado do formulário, não mais do regime fixo do posto**

Antes:

```ts
  const tipoEscalaForm: TipoEscalaPosto | null =
    form === 'novo' ? (regime ?? null) : form ? resolverTipoEscalaPosto(form.tipo_escala) : null
```

Depois:

```ts
  const tipoEscalaForm: TipoEscalaPosto | null = form !== null ? tipoEscalaSelecionado : null
```

- [ ] **Step 6: `handleSalvar` — mensagem de erro explícita quando nenhum regime foi escolhido, e envia `tipo_escala` no payload**

Antes:

```ts
  async function handleSalvar() {
    if (!nome.trim()) { setErro('Informe o nome do turno'); return }
    if (!tipoEscalaForm) return
    setSaving(true)
    setErro(null)
    const temAlmoco = tipoEscalaForm !== '12x36'
    const temSaidaSex = tipoEscalaForm === '5x2'
    const dados: TurnoData = {
      nome: nome.trim(),
      hora_entrada: horaEntrada,
      hora_inicio_almoco: temAlmoco ? horaInicioAlmoco : null,
      hora_fim_almoco: temAlmoco ? horaFimAlmoco : null,
      hora_saida_seg_qui: horaSaidaSegQui,
      hora_saida_sex: temSaidaSex ? horaSaidaSex : null,
    }
    const res = form === 'novo'
      ? await criarTurno(postoId, dados)
      : await editarTurno((form as TurnoPosto).id, dados)
    setSaving(false)
    if (!res.success) { setErro(res.error ?? 'Erro ao salvar'); return }
    fecharForm()
    carregar()
  }
```

Depois:

```ts
  async function handleSalvar() {
    if (!nome.trim()) { setErro('Informe o nome do turno'); return }
    if (!tipoEscalaForm) { setErro('Selecione o regime de trabalho deste turno.'); return }
    setSaving(true)
    setErro(null)
    const temAlmoco = tipoEscalaForm !== '12x36'
    const temSaidaSex = tipoEscalaForm === '5x2'
    const dados: TurnoData = {
      nome: nome.trim(),
      hora_entrada: horaEntrada,
      hora_inicio_almoco: temAlmoco ? horaInicioAlmoco : null,
      hora_fim_almoco: temAlmoco ? horaFimAlmoco : null,
      hora_saida_seg_qui: horaSaidaSegQui,
      hora_saida_sex: temSaidaSex ? horaSaidaSex : null,
      tipo_escala: tipoEscalaForm,
    }
    const res = form === 'novo'
      ? await criarTurno(postoId, dados)
      : await editarTurno((form as TurnoPosto).id, dados)
    setSaving(false)
    if (!res.success) { setErro(res.error ?? 'Erro ao salvar'); return }
    fecharForm()
    carregar()
  }
```

- [ ] **Step 7: Botão "Novo turno" deixa de exigir regime padrão do posto**

Antes:

```tsx
          {/* botão novo turno */}
          {canWrite && form === null && regime && (
            <button type="button" onClick={abrirNovo}
              className="flex items-center gap-1.5 text-sm font-medium text-slate-700 hover:text-slate-900">
              <Plus className="h-4 w-4" />
              Novo turno
            </button>
          )}
```

Depois:

```tsx
          {/* botão novo turno */}
          {canWrite && form === null && (
            <button type="button" onClick={abrirNovo}
              className="flex items-center gap-1.5 text-sm font-medium text-slate-700 hover:text-slate-900">
              <Plus className="h-4 w-4" />
              Novo turno
            </button>
          )}
```

- [ ] **Step 8: Ajustar copy do aviso "posto sem regime configurado" — não é mais bloqueio, é sugestão**

Antes:

```tsx
          {/* aviso: posto sem regime configurado */}
          {regime === null && (
            <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-sm text-amber-800">
                Este posto ainda não tem um regime de trabalho definido. Selecione um regime para poder cadastrar turnos.
              </p>
```

Depois:

```tsx
          {/* aviso: posto sem regime padrão configurado */}
          {regime === null && (
            <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-sm text-amber-800">
                Este posto ainda não tem um regime padrão definido. Isso não impede cadastrar turnos — o regime é
                escolhido em cada turno — mas definir um padrão aqui pré-preenche o formulário e serve de sugestão.
              </p>
```

(o restante do bloco — botões pra escolher o regime padrão via `handleDefinirRegime` — continua igual, sem mudança de mecânica, só a frase acima.)

- [ ] **Step 9: Ajustar copy do texto "Regime definido em Config Escalas"**

Antes:

```tsx
          {regime && (
            <p className="text-xs text-gray-400">
              Regime definido em{' '}
              <a href="/fechamento/config-escalas" className="underline hover:text-gray-600">
                Config Escalas
              </a>.
            </p>
          )}
```

Depois:

```tsx
          {regime && (
            <p className="text-xs text-gray-400">
              Regime padrão sugerido (editável por turno): definido em{' '}
              <a href="/fechamento/config-escalas" className="underline hover:text-gray-600">
                Config Escalas
              </a>.
            </p>
          )}
```

- [ ] **Step 10: Adicionar o `<select>` de regime no formulário de turno**

No bloco do formulário (`{form !== null && canWrite && tipoEscalaForm && (...)}`), logo antes do `<div className="grid grid-cols-2 gap-3">` que tem Nome e Horário de entrada (linha ~321), adicionar:

```tsx
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-500">Regime</label>
                <select
                  value={tipoEscalaForm}
                  onChange={e => handleMudarRegimeForm(e.target.value as TipoEscalaPosto)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-gray-400"
                >
                  {TIPOS_ESCALA_POSTO.map(tipo => (
                    <option key={tipo} value={tipo}>{ESCALA_LABEL[tipo]}</option>
                  ))}
                </select>
              </div>

```

Nota: como `tipoEscalaForm` só renderiza este bloco quando não é `null` (condição `tipoEscalaForm &&` no `{form !== null && canWrite && tipoEscalaForm && (...)}` já existente), o `<select>` sempre tem um valor válido pra mostrar — não precisa de opção vazia/disabled. Quando `tipoEscalaForm` for `null` (posto sem regime padrão E usuário ainda não tocou no seletor), o formulário inteiro não aparece; nesse caso, ajustar a condição de exibição do formulário pra sempre aparecer quando `form !== null && canWrite`, e tratar `tipoEscalaForm === null` dentro do form mostrando o `<select>` com um placeholder. Ver Step 11.

- [ ] **Step 11: Formulário deve renderizar mesmo sem regime pré-selecionado (caso posto sem padrão)**

Antes (condição de exibição do form, linha ~307):

```tsx
          {/* form de novo/editar turno */}
          {form !== null && canWrite && tipoEscalaForm && (
            <div className={cn('space-y-4 rounded-lg border border-l-4 bg-white p-5 shadow-sm', ESCALA_BORDER_CLASS[tipoEscalaForm])}>
```

Depois:

```tsx
          {/* form de novo/editar turno */}
          {form !== null && canWrite && (
            <div className={cn('space-y-4 rounded-lg border border-l-4 bg-white p-5 shadow-sm', tipoEscalaForm ? ESCALA_BORDER_CLASS[tipoEscalaForm] : 'border-l-gray-300')}>
```

E o `<select>` do Step 10 precisa aceitar `tipoEscalaForm` nulo:

```tsx
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-500">Regime</label>
                <select
                  value={tipoEscalaForm ?? ''}
                  onChange={e => handleMudarRegimeForm(e.target.value as TipoEscalaPosto)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-gray-400"
                >
                  <option value="" disabled>Selecione…</option>
                  {TIPOS_ESCALA_POSTO.map(tipo => (
                    <option key={tipo} value={tipo}>{ESCALA_LABEL[tipo]}</option>
                  ))}
                </select>
              </div>

```

E os demais trechos do form que hoje assumem `tipoEscalaForm` não-nulo dentro do bloco (badge de regime no cabeçalho do form, catálogo, `temAlmoco`/`temSaidaSex`, `calcularHorariosDerivados`) precisam de guarda condicional pra não quebrar quando `tipoEscalaForm` for `null`:

- O badge de regime no cabeçalho (`{form === 'novo' ? 'Novo turno' : 'Editar turno'}` + `<span className={...ESCALA_BADGE_CLASS[tipoEscalaForm]}>`): envolver em `{tipoEscalaForm && (<span ...>{ESCALA_LABEL[tipoEscalaForm]}</span>)}`.
- O bloco do catálogo (`{form === 'novo' && tipoEscalaForm && CATALOGO_POR_REGIME[tipoEscalaForm] && (...)}`) — já tem `tipoEscalaForm &&` na condição, não precisa mudar.
- `temAlmoco`/`temSaidaSex` (linha ~196): já são `tipoEscalaForm !== null && ...` / `tipoEscalaForm === '5x2'` — já seguros com `tipoEscalaForm` nulo (retornam `false`), não precisa mudar.
- O `useEffect` que chama `calcularHorariosDerivados(horaEntrada, tipoEscalaForm)` (linha ~181): já tem `if (!tipoEscalaForm) return` no topo — já seguro, não precisa mudar.
- Os campos de horário do form (`min`/`max` baseados em `tipoEscalaForm === '5x1'`) — já são comparações seguras com `null` (retornam `false`), não precisa mudar.

- [ ] **Step 12: Type-check e build**

Run: `npx tsc --noEmit && npm run build`
Expected: sem erros.

- [ ] **Step 13: Commit**

```bash
git add components/postos/modal-turnos-posto.tsx
git commit -m "feat(postos): seletor de regime no formulario de turno"
```

---

### Task 3: `fechamento/config-escalas/page.tsx` — copy

**Files:**
- Modify: `app/(admin)/fechamento/config-escalas/page.tsx:50`

- [ ] **Step 1: Trocar subtítulo**

Antes:

```tsx
        <p className="text-sm text-gray-400">Regime de trabalho por posto</p>
```

Depois:

```tsx
        <p className="text-sm text-gray-400">Regime padrão sugerido por posto — pode ser sobrescrito em cada turno</p>
```

- [ ] **Step 2: Type-check e build**

Run: `npx tsc --noEmit && npm run build`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add "app/(admin)/fechamento/config-escalas/page.tsx"
git commit -m "docs(config-escalas): ajusta copy pra regime padrao (nao mais obrigatorio unico)"
```

---

### Task 4: `fechamento/actions.ts` — `FechamentoPosto.regimes: string[]`

**Files:**
- Modify: `app/(admin)/fechamento/actions.ts:1-6,75-81,513-584`

- [ ] **Step 1: Import de `TIPOS_ESCALA_POSTO`**

```ts
import { TIPOS_ESCALA_POSTO } from '@/lib/turnos/escala'
```

- [ ] **Step 2: Interface `FechamentoPosto` troca `regime` por `regimes`**

Antes:

```ts
export interface FechamentoPosto {
  posto_id: string
  posto_nome: string
  secretaria: string
  regime: string
  funcionarios: FechamentoItemPosto[]
}
```

Depois:

```ts
export interface FechamentoPosto {
  posto_id: string
  posto_nome: string
  secretaria: string
  regimes: string[]
  funcionarios: FechamentoItemPosto[]
}
```

- [ ] **Step 3: `getOrCreatePosto` não fixa mais `regime` na criação; novo Map auxiliar acumula os regimes vistos por posto**

Antes:

```ts
  // 4. Por posto
  const porPostoMap = new Map<string, FechamentoPosto>()

  function getOrCreatePosto(postoId: string): FechamentoPosto {
    if (!porPostoMap.has(postoId)) {
      const info = postosMap.get(postoId)
      porPostoMap.set(postoId, {
        posto_id:   postoId,
        posto_nome: info?.nome ?? '—',
        secretaria: info?.secretaria ?? '',
        regime:     postoConfigMap.get(postoId) ?? '5x2',
        funcionarios: [],
      })
    }
    return porPostoMap.get(postoId)!
  }
```

Depois:

```ts
  // 4. Por posto
  const porPostoMap = new Map<string, FechamentoPosto>()
  const regimesVistosPorPosto = new Map<string, Set<string>>()

  function getOrCreatePosto(postoId: string): FechamentoPosto {
    if (!porPostoMap.has(postoId)) {
      const info = postosMap.get(postoId)
      porPostoMap.set(postoId, {
        posto_id:   postoId,
        posto_nome: info?.nome ?? '—',
        secretaria: info?.secretaria ?? '',
        regimes:    [],
        funcionarios: [],
      })
    }
    return porPostoMap.get(postoId)!
  }

  function registrarRegimeNoPosto(postoId: string, regime: string) {
    const set = regimesVistosPorPosto.get(postoId) ?? new Set<string>()
    set.add(regime)
    regimesVistosPorPosto.set(postoId, set)
  }
```

- [ ] **Step 4: Registrar o regime do funcionário (já resolvido via turno vigente, Fase 1) a cada lançamento de titular**

No loop de titulares, logo após `const posto = getOrCreatePosto(seg.posto_id)`:

```ts
      const posto = getOrCreatePosto(seg.posto_id)
      registrarRegimeNoPosto(seg.posto_id, f.regime)
```

(`f.regime` é o campo já existente em `FechamentoFuncionario`, resolvido na Fase 1 a partir do turno vigente do funcionário — é exatamente o valor certo pra essa contagem.)

- [ ] **Step 5: Registrar o regime no loop de coberturas recebidas**

No loop de coberturas, logo após `const posto = getOrCreatePosto(cob.posto_destino_id)`:

```ts
    const posto = getOrCreatePosto(cob.posto_destino_id)
    registrarRegimeNoPosto(cob.posto_destino_id, regime)
```

(`regime` aqui já é a variável existente — regime do posto de destino da cobertura, calculada logo acima no mesmo bloco; comportamento inalterado, só passa a também alimentar o Set.)

- [ ] **Step 6: Preencher `regimes` de cada posto antes de retornar, na ordem `TIPOS_ESCALA_POSTO`**

Antes:

```ts
  const porPosto = Array.from(porPostoMap.values()).sort((a, b) => {
    const sc = a.secretaria.localeCompare(b.secretaria, 'pt-BR')
    if (sc !== 0) return sc
    return a.posto_nome.localeCompare(b.posto_nome, 'pt-BR')
  })

  return { porFuncionario, porPosto }
```

Depois:

```ts
  for (const posto of porPostoMap.values()) {
    const vistos = regimesVistosPorPosto.get(posto.posto_id)
    posto.regimes = vistos && vistos.size > 0
      ? TIPOS_ESCALA_POSTO.filter(r => vistos.has(r))
      : [postoConfigMap.get(posto.posto_id) ?? '5x2']
  }

  const porPosto = Array.from(porPostoMap.values()).sort((a, b) => {
    const sc = a.secretaria.localeCompare(b.secretaria, 'pt-BR')
    if (sc !== 0) return sc
    return a.posto_nome.localeCompare(b.posto_nome, 'pt-BR')
  })

  return { porFuncionario, porPosto }
```

Nota: `postoConfigMap` continua no arquivo (usada em outros pontos — regime de destino de cobertura, fallback do helper da Fase 1) — este fallback cobre o caso raro de um posto entrar em `porPostoMap` sem nenhum lançamento de titular/cobertura registrado (não deveria acontecer no fluxo atual, mas mantém o mesmo default `'5x2'` de antes por segurança).

- [ ] **Step 7: Type-check**

Run: `npx tsc --noEmit`
Expected: erros esperados **só** em `components/fechamento/fechamento-client.tsx` e `components/fechamento/fechamento-pdf-doc.tsx` (ainda lendo `posto.regime`, campo renomeado) — corrigidos nas Tasks 5 e 6. Nenhum outro arquivo deve quebrar.

- [ ] **Step 8: Commit**

```bash
git add "app/(admin)/fechamento/actions.ts"
git commit -m "refactor(fechamento): FechamentoPosto.regime vira regimes (lista de regimes distintos no posto)"
```

---

### Task 5: `fechamento-client.tsx` — exibição

**Files:**
- Modify: `components/fechamento/fechamento-client.tsx:114,472,618`

- [ ] **Step 1: Header do Excel (linha ~114)**

Antes:

```ts
        rows.push({ data: [`${posto.posto_nome} (${posto.regime})`, ...Array(NC - 1).fill('')], style: 'postoHeader' })
```

Depois:

```ts
        rows.push({ data: [`${posto.posto_nome} (${posto.regimes.join(' + ')})`, ...Array(NC - 1).fill('')], style: 'postoHeader' })
```

- [ ] **Step 2: Badge no card do posto (linha ~472)**

Antes:

```tsx
                        <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-mono text-slate-600">{posto.regime}</span>
```

Depois:

```tsx
                        <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-mono text-slate-600">{posto.regimes.join(' + ')}</span>
```

- [ ] **Step 3: Mini-card resumo (linha ~618)**

Antes:

```tsx
                        <p className="text-[10px] text-gray-400">{p.regime}</p>
```

Depois:

```tsx
                        <p className="text-[10px] text-gray-400">{p.regimes.join(' + ')}</p>
```

- [ ] **Step 4: Type-check e build**

Run: `npx tsc --noEmit && npm run build`
Expected: sem erros relacionados a `posto.regime`/`p.regime` neste arquivo. Se `npx tsc --noEmit` ainda apontar erro em `components/fechamento/fechamento-pdf-doc.tsx`, é esperado — corrigido na Task 6.

- [ ] **Step 5: Commit**

```bash
git add components/fechamento/fechamento-client.tsx
git commit -m "feat(fechamento): exibe todos os regimes do posto (nao so 1)"
```

---

### Task 6: `fechamento-pdf-doc.tsx` — exibição no PDF

**Files:**
- Modify: `components/fechamento/fechamento-pdf-doc.tsx:150`

- [ ] **Step 1: Header do posto no PDF**

Antes:

```tsx
                    <Text style={sp.postoHeader}>{posto.posto_nome} ({posto.regime}) — {totalDias} dias · {titulares.length} titular{titulares.length !== 1 ? 'es' : ''}{coberturas.length > 0 ? ` · ${coberturas.length} cob.` : ''}</Text>
```

Depois:

```tsx
                    <Text style={sp.postoHeader}>{posto.posto_nome} ({posto.regimes.join(' + ')}) — {totalDias} dias · {titulares.length} titular{titulares.length !== 1 ? 'es' : ''}{coberturas.length > 0 ? ` · ${coberturas.length} cob.` : ''}</Text>
```

- [ ] **Step 2: Type-check e build completo**

Run: `npx tsc --noEmit && npm run build`
Expected: sem erros em lugar nenhum do projeto.

- [ ] **Step 3: Commit**

```bash
git add components/fechamento/fechamento-pdf-doc.tsx
git commit -m "feat(fechamento): exibe todos os regimes do posto no PDF"
```

---

### Task 7: Verificação final

**Files:** nenhum (só verificação)

- [ ] **Step 1: Build completo**

Run: `npx tsc --noEmit && npm run build`
Expected: sem erros.

- [ ] **Step 2: Paridade de regressão**

Run: `node scripts/check-regime-parity.mjs compare`
Expected: só os 2 IDs de Jovem Aprendiz já conhecidos (`12a55b69-9077-4656-b8f0-fc82aebc91e6`, `c63e5563-64bd-46e0-84ec-760b848bbe64`) — nenhum posto real deveria ter ganhado 2º regime ainda nesta verificação.

- [ ] **Step 3: Verificação manual no browser (preview)**

Abrir o preview do app, ir em Postos → escolher um posto de teste → "Turnos de trabalho":
1. Cadastrar um turno com regime `5x2`.
2. Cadastrar um segundo turno no MESMO posto com regime `12x36` — confirmar que **não aparece** o erro "Configure o regime de trabalho deste posto..." e que o turno salva normalmente com borda laranja (12x36) ao lado do turno 5x2 com borda azul.
3. Editar o turno `12x36` e trocar o regime pra `5x1` — confirmar que salva e a borda muda pra roxa.
4. Ir em Fechamento (mês corrente) → conferir que, se esse posto de teste tiver funcionários no mês corrente, o card do posto mostra os regimes combinados (ex.: `"5x2 + 5x1"`). Se o posto de teste não tiver funcionários lotados, pular esta checagem (não é possível ver o efeito sem massa de dados).
5. Desfazer as mudanças de teste (desativar os turnos criados) se o posto usado era real e não um posto de teste dedicado.

- [ ] **Step 4: Commit final (se sobrar algum ajuste do passo 3)**

Só commitar se a verificação manual do Step 3 revelar algo a corrigir. Caso contrário, este task não gera commit — é só checagem.
