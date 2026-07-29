# Enriquecer Modal de Aprovações Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir dados que se perdem nas solicitações (tipo de desligamento, posto/turno de retorno de afastamento) e substituir o dump genérico de campos por um modal de detalhe com informação explícita por tipo, para dar ao admin o que falta para decidir.

**Architecture:** Backend primeiro (capturar e persistir os campos que hoje se perdem), depois estender `calcularImpactoPosto` para cobrir desligamento/retorno, depois UI (um módulo de formatação por tipo + um modal de detalhe reaproveitando as actions de aprovação/rejeição já existentes).

**Tech Stack:** Next.js 14 App Router, Server Actions, Supabase, TypeScript, `@base-ui/react/dialog`, Tailwind.

**Nota sobre verificação:** este projeto não tem suite de testes automatizados (`package.json` só tem `dev`/`build`/`start`/`lint`). Por convenção do projeto (`CLAUDE.md`), a verificação de cada passo é `npx tsc --noEmit` (rápido, a cada task) e `npm run build` (completo, na task final) — não há testes unitários a escrever.

---

## Referência: spec

`docs/superpowers/specs/2026-07-29-modal-aprovacoes-detalhe-design.md`

---

### Task 1: `solicitarDesligamento` — capturar `tipo_desligamento`

**Files:**
- Modify: `app/(admin)/efetivo/actions.ts:192-226`

- [ ] **Step 1: Ler `tipo_desligamento` do form e incluir em `dados_depois`**

Substituir:
```ts
export async function solicitarDesligamento(formData: FormData): Promise<ActionResult> {
  const supabase = createClient()
  const auth = await getUser()
  if (!auth) return { success: false, error: 'Não autenticado' }

  const funcionarioId    = formData.get('funcionario_id') as string
  const dataDesligamento = formData.get('data_desligamento') as string
  const motivo           = formData.get('motivo') as string

  const { data: func } = await supabase
    .from('funcionarios')
    .select('status, posto_id, funcao_id')
    .eq('id', funcionarioId)
    .single()

  const { error } = await supabase.from('solicitacoes').insert({
    tipo: 'desligamento',
    status: 'pendente',
    funcionario_id: funcionarioId,
    supervisor_id: auth.user.id,
    dados_antes: {
      status: func?.status ?? null,
      posto_id: func?.posto_id ?? null,
      funcao_id: func?.funcao_id ?? null,
    },
    dados_depois: { data_desligamento: dataDesligamento, motivo },
    motivo,
  })
```

Por:
```ts
export async function solicitarDesligamento(formData: FormData): Promise<ActionResult> {
  const supabase = createClient()
  const auth = await getUser()
  if (!auth) return { success: false, error: 'Não autenticado' }

  const funcionarioId    = formData.get('funcionario_id') as string
  const dataDesligamento = formData.get('data_desligamento') as string
  const motivo           = formData.get('motivo') as string
  const tipoDesligamento = (formData.get('tipo_desligamento') as string) || null

  const { data: func } = await supabase
    .from('funcionarios')
    .select('status, posto_id, funcao_id')
    .eq('id', funcionarioId)
    .single()

  const { error } = await supabase.from('solicitacoes').insert({
    tipo: 'desligamento',
    status: 'pendente',
    funcionario_id: funcionarioId,
    supervisor_id: auth.user.id,
    dados_antes: {
      status: func?.status ?? null,
      posto_id: func?.posto_id ?? null,
      funcao_id: func?.funcao_id ?? null,
    },
    dados_depois: { data_desligamento: dataDesligamento, motivo, tipo_desligamento: tipoDesligamento },
    motivo,
  })
```

- [ ] **Step 2: Verificar**

Run: `npx tsc --noEmit`
Expected: sem erros novos relacionados a este arquivo.

- [ ] **Step 3: Commit**

```bash
git add app/\(admin\)/efetivo/actions.ts
git commit -m "fix(aprovacoes): captura tipo_desligamento na solicitacao"
```

---

### Task 2: `aprovarSolicitacao` (case `desligamento`) — persistir `tipo_desligamento`

**Files:**
- Modify: `app/(admin)/aprovacoes/actions.ts:142-154`

- [ ] **Step 1: Gravar `tipo_desligamento` em `funcionarios` ao aprovar**

Substituir:
```ts
    case 'desligamento': {
      const dataDesligamento = dadosDepois.data_desligamento as string | undefined
      const { error: errDeslig } = await adminSupabase
        .from('funcionarios')
        .update({
          status:              'desligado',
          data_desligamento:   dataDesligamento ?? null,
          motivo_desligamento: (dadosDepois.motivo as string) ?? null,
        })
        .eq('id', funcionarioId)
      if (errDeslig) return { success: false, error: errDeslig.message }
      break
    }
```

Por:
```ts
    case 'desligamento': {
      const dataDesligamento = dadosDepois.data_desligamento as string | undefined
      const { error: errDeslig } = await adminSupabase
        .from('funcionarios')
        .update({
          status:              'desligado',
          data_desligamento:   dataDesligamento ?? null,
          motivo_desligamento: (dadosDepois.motivo as string) ?? null,
          tipo_desligamento:   (dadosDepois.tipo_desligamento as string) ?? null,
        })
        .eq('id', funcionarioId)
      if (errDeslig) return { success: false, error: errDeslig.message }
      break
    }
```

- [ ] **Step 2: Verificar**

Run: `npx tsc --noEmit`
Expected: sem erros novos. Se `tipo_desligamento` não existir na tipagem gerada de `funcionarios` (`types/database.ts`), checar se `editarFuncionario` (mesmo arquivo `efetivo/actions.ts`, já usa esse campo) precisa do mesmo cast — se sim, aplicar o mesmo padrão de cast usado lá.

- [ ] **Step 3: Commit**

```bash
git add app/\(admin\)/aprovacoes/actions.ts
git commit -m "fix(aprovacoes): persiste tipo_desligamento ao aprovar desligamento"
```

---

### Task 3: `solicitarRetornoAfastamento` — resolver nome do posto e do turno de destino

**Files:**
- Modify: `app/(admin)/efetivo/actions.ts:440-486`

- [ ] **Step 1: Buscar e salvar `posto_retorno_nome` e `turno_destino_nome`**

Substituir:
```ts
export async function solicitarRetornoAfastamento(fd: FormData): Promise<ActionResult> {
  const supabase = createClient()
  const auth = await getUser()
  if (!auth) return { success: false, error: 'Não autenticado' }
  const funcionario_id  = fd.get('funcionario_id') as string
  const data_retorno    = fd.get('data_retorno') as string
  const posto_retorno_id = (fd.get('posto_retorno_id') as string) || null
  const turnoDestinoId    = (fd.get('turno_destino_id') as string) || null
  const diaCursoDestino   = fd.get('dia_curso_destino') ? Number(fd.get('dia_curso_destino')) : null

  if (await existeSolicitacaoConcorrentePendente(supabase, funcionario_id)) {
    return { success: false, error: 'Já existe uma solicitação pendente para este funcionário que altera o horário — aguarde a aprovação antes de enviar outra.' }
  }

  const { data: func } = await supabase
    .from('funcionarios')
    .select('status, posto_id, postos!posto_id(nome)')
    .eq('id', funcionario_id)
    .single()

  const funcTyped = func as unknown as {
    status: string | null
    posto_id: string | null
    postos: { nome: string } | null
  } | null

  const { error } = await supabase.from('solicitacoes').insert({
    funcionario_id,
    tipo:         'retorno_afastamento' as unknown as 'desligamento',
    status:       'pendente',
    supervisor_id: auth.user.id,
    dados_antes:  {
      status:    funcTyped?.status ?? null,
      posto_id:  funcTyped?.posto_id ?? null,
      posto_nome: funcTyped?.postos?.nome ?? null,
    },
    dados_depois: {
      data_retorno, posto_retorno_id,
      ...(turnoDestinoId ? { turno_destino_id: turnoDestinoId } : {}),
      ...(diaCursoDestino ? { dia_curso_destino: diaCursoDestino } : {}),
    },
  })
  if (error) return { success: false, error: error.message }
  revalidatePath('/efetivo')
  revalidatePath('/aprovacoes')
  return { success: true }
}
```

Por:
```ts
export async function solicitarRetornoAfastamento(fd: FormData): Promise<ActionResult> {
  const supabase = createClient()
  const auth = await getUser()
  if (!auth) return { success: false, error: 'Não autenticado' }
  const funcionario_id  = fd.get('funcionario_id') as string
  const data_retorno    = fd.get('data_retorno') as string
  const posto_retorno_id = (fd.get('posto_retorno_id') as string) || null
  const turnoDestinoId    = (fd.get('turno_destino_id') as string) || null
  const diaCursoDestino   = fd.get('dia_curso_destino') ? Number(fd.get('dia_curso_destino')) : null

  if (await existeSolicitacaoConcorrentePendente(supabase, funcionario_id)) {
    return { success: false, error: 'Já existe uma solicitação pendente para este funcionário que altera o horário — aguarde a aprovação antes de enviar outra.' }
  }

  const { data: func } = await supabase
    .from('funcionarios')
    .select('status, posto_id, postos!posto_id(nome)')
    .eq('id', funcionario_id)
    .single()

  const funcTyped = func as unknown as {
    status: string | null
    posto_id: string | null
    postos: { nome: string } | null
  } | null

  // Admin client: supervisor pode não ter acesso ao posto de retorno via RLS
  // (mesmo padrão de solicitarTransferencia)
  const adminDb = createAdminClient() as unknown as typeof supabase
  const [postoRetornoResult, turnoNovoResult] = await Promise.all([
    posto_retorno_id
      ? adminDb.from('postos').select('nome').eq('id', posto_retorno_id).single()
      : Promise.resolve({ data: null }),
    turnoDestinoId
      ? supabase.from('turnos_postos').select('nome').eq('id', turnoDestinoId).single()
      : Promise.resolve({ data: null }),
  ])
  const postoRetornoNome = (postoRetornoResult as { data: { nome: string } | null }).data?.nome ?? null
  const turnoDestinoNome = (turnoNovoResult as { data: { nome: string } | null }).data?.nome ?? null

  const { error } = await supabase.from('solicitacoes').insert({
    funcionario_id,
    tipo:         'retorno_afastamento' as unknown as 'desligamento',
    status:       'pendente',
    supervisor_id: auth.user.id,
    dados_antes:  {
      status:    funcTyped?.status ?? null,
      posto_id:  funcTyped?.posto_id ?? null,
      posto_nome: funcTyped?.postos?.nome ?? null,
    },
    dados_depois: {
      data_retorno, posto_retorno_id, posto_retorno_nome: postoRetornoNome,
      ...(turnoDestinoId ? { turno_destino_id: turnoDestinoId, turno_destino_nome: turnoDestinoNome } : {}),
      ...(diaCursoDestino ? { dia_curso_destino: diaCursoDestino } : {}),
    },
  })
  if (error) return { success: false, error: error.message }
  revalidatePath('/efetivo')
  revalidatePath('/aprovacoes')
  return { success: true }
}
```

Nota: `createAdminClient` já está importado neste arquivo (usado em `solicitarTransferencia`) — não precisa de novo import.

- [ ] **Step 2: Verificar**

Run: `npx tsc --noEmit`
Expected: sem erros novos.

- [ ] **Step 3: Commit**

```bash
git add app/\(admin\)/efetivo/actions.ts
git commit -m "fix(aprovacoes): salva nome do posto e turno de retorno de afastamento"
```

---

### Task 4: `solicitarTransferencia` — resolver nome do turno de destino

**Files:**
- Modify: `app/(admin)/efetivo/actions.ts:254-285` (dentro de `solicitarTransferencia`)

- [ ] **Step 1: Incluir busca do turno no `Promise.all` existente**

Substituir:
```ts
  // Usar admin client para buscar nomes de postos (supervisor pode não ter acesso ao posto destino via RLS)
  const adminDb = createAdminClient() as unknown as typeof supabase
  const [{ data: postoDestino }, postoOrigemResult, novaFuncaoResult] = await Promise.all([
    adminDb.from('postos').select('nome').eq('id', postoDestinoId).single(),
    postoOrigemId
      ? adminDb.from('postos').select('nome').eq('id', postoOrigemId).single()
      : Promise.resolve({ data: null }),
    novaFuncaoId
      ? adminDb.from('funcoes').select('nome').eq('id', novaFuncaoId).single()
      : Promise.resolve({ data: null }),
  ])

  const postoOrigemNome  = (postoOrigemResult as { data: { nome: string } | null }).data?.nome ?? null
  const postoDestinoNome = (postoDestino as { nome: string } | null)?.nome ?? null
  const novaFuncaoNome   = (novaFuncaoResult as { data: { nome: string } | null }).data?.nome ?? null

  const { error } = await supabase.from('solicitacoes').insert({
    tipo: 'transferencia',
    status: 'pendente',
    funcionario_id: funcionarioId,
    supervisor_id: auth.user.id,
    dados_antes: { posto_id: postoOrigemId, posto_nome: postoOrigemNome },
    dados_depois: {
      posto_destino_id: postoDestinoId,
      posto_destino_nome: postoDestinoNome,
      motivo,
      ...(novaFuncaoId ? { nova_funcao_id: novaFuncaoId, nova_funcao_nome: novaFuncaoNome } : {}),
      ...(turnoDestinoId ? { turno_destino_id: turnoDestinoId } : {}),
      ...(diaCursoDestino ? { dia_curso_destino: diaCursoDestino } : {}),
    },
    motivo,
  })
```

Por:
```ts
  // Usar admin client para buscar nomes de postos (supervisor pode não ter acesso ao posto destino via RLS)
  const adminDb = createAdminClient() as unknown as typeof supabase
  const [{ data: postoDestino }, postoOrigemResult, novaFuncaoResult, turnoNovoResult] = await Promise.all([
    adminDb.from('postos').select('nome').eq('id', postoDestinoId).single(),
    postoOrigemId
      ? adminDb.from('postos').select('nome').eq('id', postoOrigemId).single()
      : Promise.resolve({ data: null }),
    novaFuncaoId
      ? adminDb.from('funcoes').select('nome').eq('id', novaFuncaoId).single()
      : Promise.resolve({ data: null }),
    turnoDestinoId
      ? supabase.from('turnos_postos').select('nome').eq('id', turnoDestinoId).single()
      : Promise.resolve({ data: null }),
  ])

  const postoOrigemNome  = (postoOrigemResult as { data: { nome: string } | null }).data?.nome ?? null
  const postoDestinoNome = (postoDestino as { nome: string } | null)?.nome ?? null
  const novaFuncaoNome   = (novaFuncaoResult as { data: { nome: string } | null }).data?.nome ?? null
  const turnoDestinoNome = (turnoNovoResult as { data: { nome: string } | null }).data?.nome ?? null

  const { error } = await supabase.from('solicitacoes').insert({
    tipo: 'transferencia',
    status: 'pendente',
    funcionario_id: funcionarioId,
    supervisor_id: auth.user.id,
    dados_antes: { posto_id: postoOrigemId, posto_nome: postoOrigemNome },
    dados_depois: {
      posto_destino_id: postoDestinoId,
      posto_destino_nome: postoDestinoNome,
      motivo,
      ...(novaFuncaoId ? { nova_funcao_id: novaFuncaoId, nova_funcao_nome: novaFuncaoNome } : {}),
      ...(turnoDestinoId ? { turno_destino_id: turnoDestinoId, turno_destino_nome: turnoDestinoNome } : {}),
      ...(diaCursoDestino ? { dia_curso_destino: diaCursoDestino } : {}),
    },
    motivo,
  })
```

- [ ] **Step 2: Verificar**

Run: `npx tsc --noEmit`
Expected: sem erros novos.

- [ ] **Step 3: Commit**

```bash
git add app/\(admin\)/efetivo/actions.ts
git commit -m "fix(aprovacoes): salva nome do turno de destino na transferencia"
```

---

### Task 5: `solicitarMudancaFuncao` — resolver nome do turno de destino

**Files:**
- Modify: `app/(admin)/efetivo/actions.ts:318-351` (dentro de `solicitarMudancaFuncao`)

- [ ] **Step 1: Incluir busca do turno no `Promise.all` existente**

Substituir:
```ts
  const [{ data: funcaoDestino }, funcaoOrigemResult, supervisorResult] = await Promise.all([
    supabase.from('funcoes').select('nome').eq('id', funcaoDestinoId).single(),
    funcaoOrigemId
      ? supabase.from('funcoes').select('nome').eq('id', funcaoOrigemId).single()
      : Promise.resolve({ data: null }),
    postoId
      ? supabase
          .from('config_supervisores_postos')
          .select('perfis!supervisor_id(nome)')
          .eq('posto_id', postoId)
          .eq('ativo', true)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const funcaoOrigemNome  = (funcaoOrigemResult as { data: { nome: string } | null }).data?.nome ?? null
  const funcaoDestinoNome = funcaoDestino?.nome ?? null
  // Snapshot do supervisor do posto no momento da solicitação — não muda com mudança de função,
  // mas evita que o PDF puxe o supervisor vigente hoje caso a config seja alterada depois.
  const supervisorNome = (supervisorResult as unknown as { data: { perfis: { nome: string | null } | null } | null }).data?.perfis?.nome ?? null

  const { error } = await supabase.from('solicitacoes').insert({
    tipo: 'mudanca_funcao',
    status: 'pendente',
    funcionario_id: funcionarioId,
    supervisor_id: auth.user.id,
    dados_antes: { funcao_id: funcaoOrigemId, funcao_nome: funcaoOrigemNome, supervisor_nome: supervisorNome },
    dados_depois: {
      funcao_destino_id: funcaoDestinoId, funcao_destino_nome: funcaoDestinoNome, motivo, supervisor_nome: supervisorNome,
      ...(turnoDestinoId ? { turno_destino_id: turnoDestinoId } : {}),
      ...(diaCursoDestino ? { dia_curso_destino: diaCursoDestino } : {}),
    },
    motivo,
  })
```

Por:
```ts
  const [{ data: funcaoDestino }, funcaoOrigemResult, supervisorResult, turnoNovoResult] = await Promise.all([
    supabase.from('funcoes').select('nome').eq('id', funcaoDestinoId).single(),
    funcaoOrigemId
      ? supabase.from('funcoes').select('nome').eq('id', funcaoOrigemId).single()
      : Promise.resolve({ data: null }),
    postoId
      ? supabase
          .from('config_supervisores_postos')
          .select('perfis!supervisor_id(nome)')
          .eq('posto_id', postoId)
          .eq('ativo', true)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    turnoDestinoId
      ? supabase.from('turnos_postos').select('nome').eq('id', turnoDestinoId).single()
      : Promise.resolve({ data: null }),
  ])

  const funcaoOrigemNome  = (funcaoOrigemResult as { data: { nome: string } | null }).data?.nome ?? null
  const funcaoDestinoNome = funcaoDestino?.nome ?? null
  // Snapshot do supervisor do posto no momento da solicitação — não muda com mudança de função,
  // mas evita que o PDF puxe o supervisor vigente hoje caso a config seja alterada depois.
  const supervisorNome = (supervisorResult as unknown as { data: { perfis: { nome: string | null } | null } | null }).data?.perfis?.nome ?? null
  const turnoDestinoNome = (turnoNovoResult as { data: { nome: string } | null }).data?.nome ?? null

  const { error } = await supabase.from('solicitacoes').insert({
    tipo: 'mudanca_funcao',
    status: 'pendente',
    funcionario_id: funcionarioId,
    supervisor_id: auth.user.id,
    dados_antes: { funcao_id: funcaoOrigemId, funcao_nome: funcaoOrigemNome, supervisor_nome: supervisorNome },
    dados_depois: {
      funcao_destino_id: funcaoDestinoId, funcao_destino_nome: funcaoDestinoNome, motivo, supervisor_nome: supervisorNome,
      ...(turnoDestinoId ? { turno_destino_id: turnoDestinoId, turno_destino_nome: turnoDestinoNome } : {}),
      ...(diaCursoDestino ? { dia_curso_destino: diaCursoDestino } : {}),
    },
    motivo,
  })
```

- [ ] **Step 2: Verificar**

Run: `npx tsc --noEmit`
Expected: sem erros novos.

- [ ] **Step 3: Commit**

```bash
git add app/\(admin\)/efetivo/actions.ts
git commit -m "fix(aprovacoes): salva nome do turno de destino na mudanca de funcao"
```

---

### Task 6: `calcularImpactoPosto` — modo `apenas_entrada` (retorno de afastamento)

**Files:**
- Modify: `app/(admin)/efetivo/impacto.ts` (função inteira, linhas 44-192)

- [ ] **Step 1: Substituir a função inteira**

Substituir do comentário `/**\n * Calcula o impacto...` até o fechamento da função (linha 192) por:

```ts
/**
 * Calcula o impacto de uma transferência, mudança de função, desligamento ou
 * retorno de afastamento nos postos afetados.
 * - apenas_entrada=true (retorno de afastamento): funcionário está inativo hoje,
 *   não conta no efetivo atual — calcula só o ganho de +1 no posto de retorno.
 * - posto_destino_id sem apenas_entrada → transferência (origem perde, destino ganha)
 * - nova_funcao_nome sem posto_destino_id → mudança de função no mesmo posto
 * - nem posto_destino_id nem nova_funcao_nome → desligamento (origem perde 1, sem destino)
 */
export async function calcularImpactoPosto(params: {
  funcionario_id: string
  posto_destino_id?: string
  nova_funcao_nome?: string
  apenas_entrada?: boolean
}): Promise<ImpactoResult | null> {
  const { funcionario_id, posto_destino_id, nova_funcao_nome, apenas_entrada } = params
  const supabase = createClient()

  // 1. Estado atual do funcionário
  const { data: empData } = await (supabase as unknown as AnyQ)
    .from('funcionarios')
    .select('posto_id, status, funcao_id, eh_encarregado_volante, funcoes!funcao_id(nome)')
    .eq('id', funcionario_id)
    .single()

  if (!empData) return null

  const funcaoAtualNome = ((empData.funcoes?.nome ?? '') as string).trim().toUpperCase()
  const ehVolante        = empData.eh_encarregado_volante === true

  // Retorno de afastamento: funcionário afastado não conta no efetivo atual,
  // então não há "origem" perdendo ninguém — só o ganho no posto de retorno.
  if (apenas_entrada) {
    if (!posto_destino_id) return null

    const [{ data: postoData }, { data: funcsRaw }, { data: empsAtivos }] = await Promise.all([
      supabase
        .from('postos')
        .select('id, nome, secretaria, efetivo_previsto, cota_insalubridade')
        .eq('id', posto_destino_id)
        .single(),
      supabase.from('funcoes').select('id, nome'),
      (supabase as unknown as AnyQ)
        .from('funcionarios')
        .select('id, posto_id, funcao_id, eh_encarregado_volante')
        .eq('posto_id', posto_destino_id)
        .eq('status', 'ativo'),
    ])
    if (!postoData) return null

    const funcaoNomeMap = new Map(
      (funcsRaw ?? []).map((f: { id: string; nome: string }) => [f.id, f.nome.trim().toUpperCase()])
    )
    const excludedIds = new Set(
      (funcsRaw ?? [])
        .filter((f: { nome: string }) => FUNCOES_FORA_DO_EFETIVO.includes(f.nome as never))
        .map((f: { id: string }) => f.id)
    )
    const secretaria = (postoData.secretaria ?? '').toUpperCase()

    let efetivoAtual = 0
    let insalubAtual = 0
    for (const e of (empsAtivos ?? []) as { id: string; posto_id: string; funcao_id: string | null; eh_encarregado_volante: boolean | null }[]) {
      if (e.eh_encarregado_volante === true) continue
      if (e.funcao_id && excludedIds.has(e.funcao_id)) continue
      efetivoAtual++
      const funcNome = e.funcao_id ? (funcaoNomeMap.get(e.funcao_id) ?? '') : ''
      const expected = INSALUBRIDADE_POR_SECRETARIA[secretaria]
      if (expected && funcNome === expected) insalubAtual++
    }

    const funcaoEsperada  = INSALUBRIDADE_POR_SECRETARIA[secretaria]
    const adicionaInsalub = !!(funcaoEsperada && !ehVolante && funcaoAtualNome === funcaoEsperada)

    const entrada: PostoImpact = {
      id:                   postoData.id,
      nome:                 postoData.nome,
      secretaria:           postoData.secretaria ?? '',
      efetivo_previsto:     postoData.efetivo_previsto ?? 0,
      cota_insalubridade:   postoData.cota_insalubridade ?? 0,
      efetivo_atual:        efetivoAtual,
      insalubridade_atual:  insalubAtual,
      efetivo_apos:         efetivoAtual + 1,
      insalubridade_apos:   insalubAtual + (adicionaInsalub ? 1 : 0),
    }
    return { origem: entrada }
  }

  if (!empData.posto_id) return null

  const postoOrigemId = empData.posto_id as string
  const statusAtual    = empData.status as string

  // Mesma lógica de postos/actions.ts: só 'ativo' conta no efetivo, sem volante, sem exclusões
  const contaNoEfetivo = statusAtual === 'ativo' && !ehVolante &&
    !FUNCOES_FORA_DO_EFETIVO.includes(funcaoAtualNome as never)

  // 2. Busca dados dos postos envolvidos e funcionários ativos nesses postos
  const postoIds = [postoOrigemId, ...(posto_destino_id ? [posto_destino_id] : [])]

  const [{ data: postosData }, { data: funcsRaw }, { data: empsAtivos }] = await Promise.all([
    supabase
      .from('postos')
      .select('id, nome, secretaria, efetivo_previsto, cota_insalubridade')
      .in('id', postoIds),
    supabase.from('funcoes').select('id, nome'),
    (supabase as unknown as AnyQ)
      .from('funcionarios')
      .select('id, posto_id, funcao_id, eh_encarregado_volante')
      .in('posto_id', postoIds)
      .eq('status', 'ativo'),
  ])

  if (!postosData?.length) return null

  const funcaoNomeMap = new Map(
    (funcsRaw ?? []).map((f: { id: string; nome: string }) => [f.id, f.nome.trim().toUpperCase()])
  )
  const excludedIds = new Set(
    (funcsRaw ?? [])
      .filter((f: { nome: string }) => FUNCOES_FORA_DO_EFETIVO.includes(f.nome as never))
      .map((f: { id: string }) => f.id)
  )
  const postoSecMap = new Map(
    postosData.map((p: { id: string; secretaria: string | null }) => [p.id, (p.secretaria ?? '').toUpperCase()])
  )
  const postoDataMap = new Map(postosData.map(p => [p.id, p]))

  // 3. Conta efetivo e insalubridade atuais (mesma lógica do postos/actions.ts)
  const efetivoMap = new Map<string, number>()
  const insalubMap = new Map<string, number>()

  for (const e of (empsAtivos ?? []) as { id: string; posto_id: string; funcao_id: string | null; eh_encarregado_volante: boolean | null }[]) {
    const secretaria = postoSecMap.get(e.posto_id) ?? ''
    if (secretaria === 'AFASTADOS') continue
    if (e.eh_encarregado_volante === true) continue
    if (e.funcao_id && excludedIds.has(e.funcao_id)) continue

    efetivoMap.set(e.posto_id, (efetivoMap.get(e.posto_id) ?? 0) + 1)

    const funcNome  = e.funcao_id ? (funcaoNomeMap.get(e.funcao_id) ?? '') : ''
    const expected  = INSALUBRIDADE_POR_SECRETARIA[secretaria]
    if (expected && funcNome === expected) {
      insalubMap.set(e.posto_id, (insalubMap.get(e.posto_id) ?? 0) + 1)
    }
  }

  // 4. Calcula impacto ORIGEM
  const postoOrigem    = postoDataMap.get(postoOrigemId) as { nome: string; secretaria: string | null; efetivo_previsto: number | null; cota_insalubridade: number | null }
  const origemSec      = postoSecMap.get(postoOrigemId) ?? ''
  const efAtualOrigem  = efetivoMap.get(postoOrigemId) ?? 0
  const inAtualOrigem  = insalubMap.get(postoOrigemId) ?? 0

  const funcaoEsperadaOrigem = INSALUBRIDADE_POR_SECRETARIA[origemSec]
  const contaInsalubOrigem   = contaNoEfetivo && funcaoEsperadaOrigem === funcaoAtualNome

  const isMudancaFuncaoApenas = !posto_destino_id && !!nova_funcao_nome

  let efAposOrigem: number
  let inAposOrigem: number

  if (isMudancaFuncaoApenas) {
    // Mudança de função no mesmo posto: efetivo não muda, insalubridade ajusta
    const novaNome       = nova_funcao_nome!.trim().toUpperCase()
    const adicionaInsalub = funcaoEsperadaOrigem && novaNome === funcaoEsperadaOrigem && contaNoEfetivo
    efAposOrigem = efAtualOrigem
    inAposOrigem = inAtualOrigem - (contaInsalubOrigem ? 1 : 0) + (adicionaInsalub ? 1 : 0)
  } else {
    // Transferência ou desligamento: origem perde o funcionário
    efAposOrigem = efAtualOrigem - (contaNoEfetivo ? 1 : 0)
    inAposOrigem = inAtualOrigem - (contaInsalubOrigem ? 1 : 0)
  }

  const origem: PostoImpact = {
    id:                   postoOrigemId,
    nome:                 postoOrigem.nome,
    secretaria:           postoOrigem.secretaria ?? '',
    efetivo_previsto:     postoOrigem.efetivo_previsto ?? 0,
    cota_insalubridade:   postoOrigem.cota_insalubridade ?? 0,
    efetivo_atual:        efAtualOrigem,
    insalubridade_atual:  inAtualOrigem,
    efetivo_apos:         efAposOrigem,
    insalubridade_apos:   inAposOrigem,
  }

  // 5. Calcula impacto DESTINO (transferência)
  let destino: PostoImpact | undefined
  if (posto_destino_id) {
    const postoDestino = postoDataMap.get(posto_destino_id) as { nome: string; secretaria: string | null; efetivo_previsto: number | null; cota_insalubridade: number | null } | undefined
    if (postoDestino) {
      const destSec         = postoSecMap.get(posto_destino_id) ?? ''
      const efAtualDestino  = efetivoMap.get(posto_destino_id) ?? 0
      const inAtualDestino  = insalubMap.get(posto_destino_id) ?? 0

      // Função no destino: nova_funcao_nome se mudando, senão mantém a atual
      const funcaoNoDestino      = (nova_funcao_nome ?? funcaoAtualNome).trim().toUpperCase()
      const funcaoEsperadaDest   = INSALUBRIDADE_POR_SECRETARIA[destSec]
      const adicionaInsalubDest  = !!(funcaoEsperadaDest && funcaoNoDestino === funcaoEsperadaDest)

      destino = {
        id:                   posto_destino_id,
        nome:                 postoDestino.nome,
        secretaria:           postoDestino.secretaria ?? '',
        efetivo_previsto:     postoDestino.efetivo_previsto ?? 0,
        cota_insalubridade:   postoDestino.cota_insalubridade ?? 0,
        efetivo_atual:        efAtualDestino,
        insalubridade_atual:  inAtualDestino,
        efetivo_apos:         efAtualDestino + 1,
        insalubridade_apos:   inAtualDestino + (adicionaInsalubDest ? 1 : 0),
      }
    }
  }

  return { origem, destino }
}
```

- [ ] **Step 2: Verificar**

Run: `npx tsc --noEmit`
Expected: sem erros novos.

- [ ] **Step 3: Commit**

```bash
git add app/\(admin\)/efetivo/impacto.ts
git commit -m "feat(aprovacoes): calcularImpactoPosto ganha modo apenas_entrada p/ retorno de afastamento"
```

---

### Task 7: `aprovacoes/page.tsx` — pré-calcular impacto para desligamento e retorno

**Files:**
- Modify: `app/(admin)/aprovacoes/page.tsx:62-82`

- [ ] **Step 1: Estender o loop de pré-cálculo de impacto**

Substituir:
```ts
  // Pré-calcula impacto para transferências e mudanças de função pendentes
  const impactos: Record<string, ImpactoResult> = {}
  await Promise.all(
    pendentes
      .filter(s => (s.tipo === 'transferencia' || s.tipo === 'mudanca_funcao') && s.funcionario_id)
      .map(async s => {
        const fid = s.funcionario_id!
        const params = s.tipo === 'transferencia'
          ? {
              funcionario_id:   fid,
              posto_destino_id: s.dados_depois?.posto_destino_id as string | undefined,
              nova_funcao_nome: s.dados_depois?.nova_funcao_nome as string | undefined,
            }
          : {
              funcionario_id:  fid,
              nova_funcao_nome: s.dados_depois?.funcao_destino_nome as string | undefined,
            }
        const r = await calcularImpactoPosto(params)
        if (r) impactos[s.id] = r
      })
  )
```

Por:
```ts
  // Pré-calcula impacto para os tipos que afetam efetivo de posto
  const TIPOS_COM_IMPACTO: TipoSolicitacao[] = ['transferencia', 'mudanca_funcao', 'desligamento', 'retorno_afastamento']
  const impactos: Record<string, ImpactoResult> = {}
  await Promise.all(
    pendentes
      .filter(s => TIPOS_COM_IMPACTO.includes(s.tipo) && s.funcionario_id)
      .map(async s => {
        const fid = s.funcionario_id!
        const params =
          s.tipo === 'transferencia'
            ? {
                funcionario_id:   fid,
                posto_destino_id: s.dados_depois?.posto_destino_id as string | undefined,
                nova_funcao_nome: s.dados_depois?.nova_funcao_nome as string | undefined,
              }
          : s.tipo === 'mudanca_funcao'
            ? {
                funcionario_id:  fid,
                nova_funcao_nome: s.dados_depois?.funcao_destino_nome as string | undefined,
              }
          : s.tipo === 'retorno_afastamento'
            ? {
                funcionario_id:   fid,
                posto_destino_id: (s.dados_depois?.posto_retorno_id as string | undefined) ?? (s.dados_antes?.posto_id as string | undefined),
                apenas_entrada:   true,
              }
          : { funcionario_id: fid } // desligamento
        const r = await calcularImpactoPosto(params)
        if (r) impactos[s.id] = r
      })
  )
```

- [ ] **Step 2: Verificar**

Run: `npx tsc --noEmit`
Expected: sem erros novos. (`TipoSolicitacao` já está importado neste arquivo.)

- [ ] **Step 3: Commit**

```bash
git add app/\(admin\)/aprovacoes/page.tsx
git commit -m "feat(aprovacoes): calcula impacto no posto tambem p/ desligamento e retorno"
```

---

### Task 8: Novo módulo `campos-solicitacao.ts` — formatação explícita por tipo

**Files:**
- Create: `components/aprovacoes/campos-solicitacao.ts`

- [ ] **Step 1: Criar o arquivo**

```ts
import { TIPOS_DESLIGAMENTO, MOTIVOS_POR_TIPO, type TipoDesligamento } from '@/components/efetivo/modal-desligar'
import type { TipoSolicitacao } from '@/types'

type Dados = Record<string, unknown> | null

export type CampoExibicao = { label: string; valor: string }

export const TIPO_BADGE: Record<TipoSolicitacao, { label: string; className: string }> = {
  desligamento:        { label: 'Desligamento',       className: 'bg-red-50 text-red-700 ring-red-200'          },
  transferencia:       { label: 'Transferência',       className: 'bg-blue-50 text-blue-700 ring-blue-200'       },
  mudanca_funcao:      { label: 'Mudança de Função',   className: 'bg-indigo-50 text-indigo-700 ring-indigo-200' },
  promocao:            { label: 'Promoção',            className: 'bg-green-50 text-green-700 ring-green-200'    },
  mudanca_supervisor:  { label: 'Mudança Supervisor',  className: 'bg-purple-50 text-purple-700 ring-purple-200'   },
  alteracao_salario:   { label: 'Alteração Salarial',  className: 'bg-amber-50 text-amber-700 ring-amber-200'     },
  afastamento:         { label: 'Afastamento',         className: 'bg-orange-50 text-orange-700 ring-orange-200'  },
  retorno_afastamento: { label: 'Retorno Afastamento', className: 'bg-teal-50 text-teal-700 ring-teal-200'        },
  rescisao_indireta:   { label: 'Rescisão Indireta',   className: 'bg-rose-50 text-rose-700 ring-rose-200'        },
  admissao:            { label: 'Admissão',            className: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  mudanca_horario:     { label: 'Mudança Horário',      className: 'bg-cyan-50 text-cyan-700 ring-cyan-200'          },
}

const DIA_CURSO_LABEL: Record<number, string> = {
  1: 'Segunda', 2: 'Terça', 3: 'Quarta', 4: 'Quinta', 5: 'Sexta',
}

export function fmtData(iso: unknown): string {
  if (typeof iso !== 'string' || !iso) return '—'
  const [y, m, d] = iso.split('T')[0].split('-')
  return `${d}/${m}/${y}`
}

function str(v: unknown, fallback = '—'): string {
  if (v === null || v === undefined || v === '') return fallback
  return String(v)
}

function diaCursoLabel(v: unknown): string {
  const n = Number(v)
  return DIA_CURSO_LABEL[n] ?? String(v)
}

function labelTipoDesligamento(v: unknown): string {
  const found = TIPOS_DESLIGAMENTO.find(t => t.value === v)
  return found?.label ?? str(v)
}

function labelMotivoDesligamento(tipoDesligamento: unknown, motivo: unknown): string {
  const tipo = tipoDesligamento as TipoDesligamento | undefined
  if (tipo && MOTIVOS_POR_TIPO[tipo]) {
    const found = MOTIVOS_POR_TIPO[tipo].find(m => m.value === motivo)
    if (found) return found.label
  }
  return str(motivo)
}

/** Campos explícitos por tipo — nunca faz dump genérico de dados_antes/dados_depois. */
export function camposDaSolicitacao(tipo: TipoSolicitacao, dadosAntes: Dados, dadosDepois: Dados): CampoExibicao[] {
  const antes  = dadosAntes ?? {}
  const depois = dadosDepois ?? {}
  const campos: CampoExibicao[] = []

  switch (tipo) {
    case 'desligamento':
      campos.push({ label: 'Data de Desligamento', valor: fmtData(depois.data_desligamento) })
      if (depois.tipo_desligamento) campos.push({ label: 'Tipo de Desligamento', valor: labelTipoDesligamento(depois.tipo_desligamento) })
      campos.push({ label: 'Motivação', valor: labelMotivoDesligamento(depois.tipo_desligamento, depois.motivo) })
      break

    case 'transferencia':
      campos.push({ label: 'Posto', valor: `${str(antes.posto_nome)} → ${str(depois.posto_destino_nome)}` })
      if (depois.nova_funcao_nome) campos.push({ label: 'Função', valor: str(depois.nova_funcao_nome) })
      if (depois.turno_destino_nome) campos.push({ label: 'Turno', valor: str(depois.turno_destino_nome) })
      if (depois.dia_curso_destino) campos.push({ label: 'Dia de Curso', valor: diaCursoLabel(depois.dia_curso_destino) })
      if (depois.motivo) campos.push({ label: 'Motivo', valor: str(depois.motivo) })
      break

    case 'mudanca_funcao':
    case 'promocao':
      campos.push({ label: 'Função', valor: `${str(antes.funcao_nome)} → ${str(depois.funcao_destino_nome)}` })
      if (depois.motivo) campos.push({ label: 'Motivo', valor: str(depois.motivo) })
      if (depois.turno_destino_nome) campos.push({ label: 'Turno', valor: str(depois.turno_destino_nome) })
      if (depois.dia_curso_destino) campos.push({ label: 'Dia de Curso', valor: diaCursoLabel(depois.dia_curso_destino) })
      break

    case 'retorno_afastamento':
      campos.push({ label: 'Data de Retorno', valor: fmtData(depois.data_retorno) })
      campos.push({
        label: 'Posto de Retorno',
        valor: depois.posto_retorno_nome ? str(depois.posto_retorno_nome) : `${str(antes.posto_nome)} (mesmo posto atual)`,
      })
      if (depois.turno_destino_nome) campos.push({ label: 'Turno', valor: str(depois.turno_destino_nome) })
      if (depois.dia_curso_destino) campos.push({ label: 'Dia de Curso', valor: diaCursoLabel(depois.dia_curso_destino) })
      break

    case 'rescisao_indireta':
      campos.push({ label: 'Data em que Parou de Trabalhar', valor: fmtData(depois.data_parou_trabalhar) })
      campos.push({ label: 'Motivo', valor: str(depois.motivo) })
      if (depois.observacao) campos.push({ label: 'Observação', valor: str(depois.observacao) })
      break

    case 'afastamento':
      campos.push({ label: 'Motivo', valor: str(depois.motivo) })
      campos.push({ label: 'Data de Início', valor: fmtData(depois.data_inicio) })
      if (depois.data_retorno_prevista) campos.push({ label: 'Retorno Previsto', valor: fmtData(depois.data_retorno_prevista) })
      if (depois.dias) campos.push({ label: 'Dias', valor: str(depois.dias) })
      break

    case 'mudanca_supervisor':
      campos.push({ label: 'Supervisor', valor: `${str(antes.supervisor_nome)} → ${str(depois.novo_supervisor_nome)}` })
      if (depois.motivo) campos.push({ label: 'Motivo', valor: str(depois.motivo) })
      break

    case 'mudanca_horario':
      campos.push({ label: 'Turno', valor: `${str(antes.turno_atual_nome)} → ${str(depois.turno_destino_nome)}` })
      if (depois.dia_curso_destino) campos.push({ label: 'Dia de Curso', valor: diaCursoLabel(depois.dia_curso_destino) })
      break

    case 'admissao':
      campos.push({ label: 'Nome', valor: str(depois.nome) })
      campos.push({ label: 'Função', valor: str(depois.funcao_nome) })
      campos.push({ label: 'Posto', valor: str(depois.posto_nome) })
      campos.push({ label: 'Data de Admissão', valor: fmtData(depois.data_admissao) })
      if (depois.registro) campos.push({ label: 'Registro (PIS/NIT)', valor: str(depois.registro) })
      if (depois.periodo_experiencia) campos.push({ label: 'Período de Experiência', valor: str(depois.periodo_experiencia) })
      break

    case 'alteracao_salario':
      campos.push({ label: 'Salário', valor: `${str(antes.salario)} → ${str(depois.novo_salario)}` })
      break

    default:
      // Tipos sem action de criação ativa hoje — fallback defensivo, sem esconder campos por convenção de nome.
      Object.entries(depois).forEach(([k, v]) => campos.push({ label: k, valor: str(v) }))
  }

  return campos
}

/** Resumo curto (1 linha) pro card compacto da listagem. */
export function resumoCurto(tipo: TipoSolicitacao, dadosAntes: Dados, dadosDepois: Dados): string {
  const campos = camposDaSolicitacao(tipo, dadosAntes, dadosDepois)
  if (campos.length === 0) return '—'
  return campos.map(c => c.valor).join(' · ')
}
```

- [ ] **Step 2: Verificar**

Run: `npx tsc --noEmit`
Expected: sem erros. (Arquivo novo, ainda não importado em lugar nenhum — normal não haver uso ainda.)

- [ ] **Step 3: Commit**

```bash
git add components/aprovacoes/campos-solicitacao.ts
git commit -m "feat(aprovacoes): modulo de formatacao explicita de campos por tipo de solicitacao"
```

---

### Task 9: Novo componente `modal-detalhe-solicitacao.tsx`

**Files:**
- Create: `components/aprovacoes/modal-detalhe-solicitacao.tsx`

- [ ] **Step 1: Criar o arquivo**

```tsx
'use client'

import { Dialog } from '@base-ui/react/dialog'
import { cn } from '@/lib/utils'
import { PostoImpactPanel } from '@/components/posto-impact-panel'
import { camposDaSolicitacao, fmtData, TIPO_BADGE } from './campos-solicitacao'
import type { SolicitacaoPendente } from './aprovacoes-list'
import type { ImpactoResult } from '@/app/(admin)/efetivo/impacto'

interface Props {
  sol: SolicitacaoPendente
  impacto?: ImpactoResult
  canApprove: boolean
  open: boolean
  onClose: () => void
  pending: boolean
  erro: string | null
  rejeitando: boolean
  motivo: string
  onMotivoChange: (v: string) => void
  onIniciarRejeicao: () => void
  onCancelarRejeicao: () => void
  onAprovar: () => void
  onRejeitar: () => void
}

export function ModalDetalheSolicitacao({
  sol, impacto, canApprove, open, onClose, pending, erro,
  rejeitando, motivo, onMotivoChange, onIniciarRejeicao, onCancelarRejeicao,
  onAprovar, onRejeitar,
}: Props) {
  const isTransfComFuncao = sol.tipo === 'transferencia' && !!sol.dados_depois?.nova_funcao_id
  const badge = isTransfComFuncao
    ? { label: 'Transferência + Função', className: 'bg-amber-50 text-amber-700 ring-amber-200' }
    : TIPO_BADGE[sol.tipo]
  const campos = camposDaSolicitacao(sol.tipo, sol.dados_antes, sol.dados_depois)

  return (
    <Dialog.Root open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 bg-black/50 z-40" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
          <div className="mb-4 flex items-start justify-between gap-2">
            <div>
              <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset', badge.className)}>
                {badge.label}
              </span>
              <Dialog.Title className="mt-2 text-lg font-semibold text-gray-900">
                {sol.funcionarios?.nome ?? '—'}
              </Dialog.Title>
            </div>
            <span className="shrink-0 text-xs text-gray-400">
              {sol.created_at ? fmtData(sol.created_at) : ''}
            </span>
          </div>

          <p className="mb-4 text-xs text-gray-500">
            Solicitado por <span className="font-medium text-slate-700">{sol.perfis?.nome ?? sol.perfis?.email ?? 'supervisor'}</span>
            {sol.motivo ? ` · ${sol.motivo}` : ''}
          </p>

          <div className="mb-4 space-y-2 rounded-lg border border-gray-100 bg-gray-50 p-3">
            {campos.map(c => (
              <div key={c.label} className="flex justify-between gap-3 text-sm">
                <span className="text-gray-500">{c.label}</span>
                <span className="text-right font-medium text-gray-900">{c.valor}</span>
              </div>
            ))}
          </div>

          {impacto && (
            <div className="mb-4">
              <PostoImpactPanel impacto={impacto} />
            </div>
          )}

          {erro && (
            <p className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{erro}</p>
          )}

          {canApprove && (!rejeitando ? (
            <div className="flex gap-2">
              <button
                onClick={onAprovar}
                disabled={pending}
                className="flex-1 rounded-lg bg-green-600 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-700 disabled:opacity-50"
              >
                {pending ? '...' : 'Aprovar'}
              </button>
              <button
                onClick={onIniciarRejeicao}
                disabled={pending}
                className="flex-1 rounded-lg border border-red-300 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
              >
                Rejeitar
              </button>
            </div>
          ) : (
            <div className="space-y-2 border-t border-gray-100 pt-3">
              <textarea
                value={motivo}
                onChange={e => onMotivoChange(e.target.value)}
                rows={2}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-slate-600"
                placeholder="Motivo da rejeição..."
              />
              <div className="flex gap-2">
                <button
                  onClick={onCancelarRejeicao}
                  className="flex-1 rounded-lg border border-gray-200 py-2 text-sm text-gray-600 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={onRejeitar}
                  disabled={!motivo.trim() || pending}
                  className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {pending ? '...' : 'Confirmar'}
                </button>
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={onClose}
            className="mt-4 w-full rounded px-4 py-2 text-center text-sm font-medium text-gray-500 hover:bg-gray-50"
          >
            Fechar
          </button>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
```

Nota: o import `type { SolicitacaoPendente } from './aprovacoes-list'` é só de tipo (`import type`) — não cria dependência circular em runtime mesmo com `aprovacoes-list.tsx` importando este componente na Task 10.

- [ ] **Step 2: Verificar**

Run: `npx tsc --noEmit`
Expected: sem erros. (Ainda não usado em lugar nenhum — normal.)

- [ ] **Step 3: Commit**

```bash
git add components/aprovacoes/modal-detalhe-solicitacao.tsx
git commit -m "feat(aprovacoes): modal de detalhe da solicitacao"
```

---

### Task 10: `aprovacoes-list.tsx` — usar os novos módulos, adicionar "Ver detalhes"

**Files:**
- Modify: `components/aprovacoes/aprovacoes-list.tsx` (arquivo inteiro — reescrita completa, mantendo a estrutura de `AprovacoesList`/`TIPO_ORDEM` do fim do arquivo)

- [ ] **Step 1: Substituir o conteúdo do arquivo**

Conteúdo completo novo:

```tsx
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { aprovarSolicitacao, rejeitarSolicitacao } from '@/app/(admin)/aprovacoes/actions'
import { PostoImpactPanel } from '@/components/posto-impact-panel'
import { TIPO_BADGE, fmtData, resumoCurto } from './campos-solicitacao'
import { ModalDetalheSolicitacao } from './modal-detalhe-solicitacao'
import type { ImpactoResult } from '@/app/(admin)/efetivo/impacto'
import type { TipoSolicitacao } from '@/types'

// ─── types ────────────────────────────────────────────────────────────────────

export type SolicitacaoPendente = {
  id: string
  tipo: TipoSolicitacao
  motivo: string | null
  dados_antes: Record<string, unknown> | null
  dados_depois: Record<string, unknown> | null
  created_at: string | null
  funcionarios: { nome: string; cpf: string | null } | null
  perfis: { nome: string | null; email: string | null } | null
}

// ─── card ─────────────────────────────────────────────────────────────────────

function SolicitacaoCard({ sol, canApprove, impacto }: { sol: SolicitacaoPendente; canApprove: boolean; impacto?: ImpactoResult }) {
  const [isPending, startTransition] = useTransition()
  const [rejeitando, setRejeitando] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [detalheAberto, setDetalheAberto] = useState(false)
  const router = useRouter()

  const isTransfComFuncao = sol.tipo === 'transferencia' && !!sol.dados_depois?.nova_funcao_id
  const badge = isTransfComFuncao
    ? { label: 'Transferência + Função', className: 'bg-amber-50 text-amber-700 ring-amber-200' }
    : TIPO_BADGE[sol.tipo]

  function handleAprovar() {
    setErro(null)
    startTransition(async () => {
      const result = await aprovarSolicitacao(sol.id)
      if (!result.success) { setErro(result.error); return }
      if (result.redirect_url) router.push(result.redirect_url)
    })
  }

  function handleRejeitar() {
    if (!motivo.trim()) return
    startTransition(async () => {
      await rejeitarSolicitacao(sol.id, motivo)
      setRejeitando(false)
      setMotivo('')
    })
  }

  function iniciarRejeicao() { setRejeitando(true) }
  function cancelarRejeicao() { setRejeitando(false); setMotivo('') }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md">
      {/* Header compacto */}
      <div className="mb-2 flex items-start justify-between gap-2">
        <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset', badge.className)}>
          {badge.label}
        </span>
        <span className="shrink-0 text-[10px] text-gray-400">
          {sol.created_at ? fmtData(sol.created_at) : ''}
        </span>
      </div>

      {/* Funcionário */}
      <p className="mb-0.5 text-sm font-semibold text-gray-900 leading-tight">
        {sol.funcionarios?.nome ?? '—'}
      </p>

      {/* Solicitante + motivo */}
      <p className="mb-2 text-xs text-gray-500">
        <span className="font-medium text-slate-700">{sol.perfis?.nome ?? sol.perfis?.email ?? 'supervisor'}</span>
        {sol.motivo ? ` · ${sol.motivo}` : ''}
      </p>

      {/* Resumo */}
      <p className="mb-2 text-xs text-gray-600">
        {resumoCurto(sol.tipo, sol.dados_antes, sol.dados_depois)}
      </p>

      {/* Impacto nos postos */}
      {impacto && (
        <div className="mb-2">
          <PostoImpactPanel impacto={impacto} />
        </div>
      )}

      <button
        type="button"
        onClick={() => setDetalheAberto(true)}
        className="mb-2 text-xs font-medium text-slate-600 underline underline-offset-2 hover:text-slate-900"
      >
        Ver detalhes
      </button>

      {erro && (
        <p className="mb-2 rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-600">{erro}</p>
      )}

      {canApprove && (!rejeitando ? (
        <div className="flex gap-2">
          <button
            onClick={handleAprovar}
            disabled={isPending}
            className="flex-1 rounded-lg bg-green-600 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-green-700 disabled:opacity-50"
          >
            {isPending ? '...' : 'Aprovar'}
          </button>
          <button
            onClick={iniciarRejeicao}
            disabled={isPending}
            className="flex-1 rounded-lg border border-red-300 py-1.5 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
          >
            Rejeitar
          </button>
        </div>
      ) : (
        <div className="space-y-1.5 border-t border-gray-100 pt-2">
          <textarea
            value={motivo}
            onChange={e => setMotivo(e.target.value)}
            rows={2}
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-slate-600"
            placeholder="Motivo da rejeição..."
          />
          <div className="flex gap-2">
            <button
              onClick={cancelarRejeicao}
              className="flex-1 rounded-lg border border-gray-200 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleRejeitar}
              disabled={!motivo.trim() || isPending}
              className="flex-1 rounded-lg bg-red-600 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
            >
              {isPending ? '...' : 'Confirmar'}
            </button>
          </div>
        </div>
      ))}

      <ModalDetalheSolicitacao
        sol={sol}
        impacto={impacto}
        canApprove={canApprove}
        open={detalheAberto}
        onClose={() => setDetalheAberto(false)}
        pending={isPending}
        erro={erro}
        rejeitando={rejeitando}
        motivo={motivo}
        onMotivoChange={setMotivo}
        onIniciarRejeicao={iniciarRejeicao}
        onCancelarRejeicao={cancelarRejeicao}
        onAprovar={handleAprovar}
        onRejeitar={handleRejeitar}
      />
    </div>
  )
}

// ─── lista principal ──────────────────────────────────────────────────────────

const TIPO_ORDEM: TipoSolicitacao[] = [
  'transferencia', 'mudanca_funcao', 'mudanca_horario', 'desligamento', 'rescisao_indireta',
  'promocao', 'mudanca_supervisor', 'alteracao_salario', 'afastamento',
  'retorno_afastamento', 'admissao',
]

export function AprovacoesList({ solicitacoes, canApprove = true, impactos = {} }: { solicitacoes: SolicitacaoPendente[]; canApprove?: boolean; impactos?: Record<string, ImpactoResult> }) {
  if (solicitacoes.length === 0) {
    return (
      <div className="rounded-xl border border-gray-100 bg-white px-6 py-12 text-center shadow-sm">
        <p className="text-sm font-medium text-gray-400">Nenhuma solicitação encontrada.</p>
      </div>
    )
  }

  const porTipo = solicitacoes.reduce<Record<string, SolicitacaoPendente[]>>((acc, s) => {
    acc[s.tipo] = acc[s.tipo] ?? []
    acc[s.tipo].push(s)
    return acc
  }, {})

  const tiposOrdenados = TIPO_ORDEM.filter(t => porTipo[t])

  return (
    <div className="space-y-6">
      {tiposOrdenados.map(tipo => (
        <div key={tipo}>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">
            {TIPO_BADGE[tipo]?.label ?? tipo} ({porTipo[tipo].length})
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {porTipo[tipo].map(sol => (
              <SolicitacaoCard key={sol.id} sol={sol} canApprove={canApprove} impacto={impactos[sol.id]} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Verificar**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add components/aprovacoes/aprovacoes-list.tsx
git commit -m "feat(aprovacoes): card usa campos explicitos por tipo + botao Ver detalhes"
```

---

### Task 11: Verificação final

**Files:** nenhum (só validação)

- [ ] **Step 1: Build completo**

Run: `npm run build`
Expected: build conclui sem erros (todos os arquivos tocados: `app/(admin)/efetivo/actions.ts`, `app/(admin)/aprovacoes/actions.ts`, `app/(admin)/efetivo/impacto.ts`, `app/(admin)/aprovacoes/page.tsx`, `components/aprovacoes/campos-solicitacao.ts`, `components/aprovacoes/modal-detalhe-solicitacao.tsx`, `components/aprovacoes/aprovacoes-list.tsx`).

- [ ] **Step 2: Verificação manual no navegador (se houver solicitações pendentes de teste)**

- Abrir `/aprovacoes` logado como admin.
- Card de qualquer tipo deve mostrar o resumo em texto legível (sem UUID, sem chave crua).
- Clicar "Ver detalhes" abre o modal com campos rotulados.
- Se houver solicitação de retorno de afastamento pendente: modal deve mostrar "Posto de Retorno" com nome (não UUID nem vazio).
- Se houver solicitação de desligamento pendente: modal deve mostrar "Tipo de Desligamento" e "Motivação" com texto legível (não slug).
- Aprovar/Rejeitar a partir do card continua funcionando igual a antes; aprovar/rejeitar a partir do modal também funciona e fecha o modal ao concluir (via revalidação da página).

Se não houver dados de teste reais para cada tipo, documentar quais tipos foram verificados e quais ficaram sem cobertura manual (não é bloqueante para o build, mas deve ser reportado ao usuário).

- [ ] **Step 3: Commit final (se algo precisar de ajuste da verificação manual)**

Só commitar se a Step 2 revelar necessidade de correção — nesse caso, corrigir, rodar `npx tsc --noEmit` de novo, e commitar como fix pontual referenciando o problema encontrado.

---

## Fora de escopo (confirmado na spec)

- Nenhuma migração de banco.
- Nenhuma mudança nas regras de negócio de `aprovarSolicitacao`/`rejeitarSolicitacao` além dos campos citados.
- Nenhum redesenho visual além do necessário para o modal e o botão "Ver detalhes".
