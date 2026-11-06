# Agenda — Presença na grade, clareza na reposição e motivo da visita extra — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar na grade semanal se o supervisor esteve no posto ou não, deixar claro como funciona a reposição de visita depois da agenda publicada, e pedir motivo + observação no check-in de visita extra (fora do plano do dia) para supervisores comuns.

**Architecture:** Reaproveita o status de presença já calculado em `lib/agenda/visitas.ts` (`montarVisitas`), hoje só consumido pelo Mapa de Visitas, também na grade semanal (`GradeSemanal`). Adiciona uma coluna `motivo_extra` em `agenda_checkins`, uma lista fixa de motivos (`lib/agenda/motivos-visita-extra.ts`, no mesmo padrão de `lib/agenda/justificativas.ts`) e um pequeno painel no check-in de visita extra (`checkin-painel.tsx`) antes de registrar a chegada. Nenhuma mudança na lógica de reposição automática — só no texto que explica.

**Tech Stack:** Next.js 14 App Router, TypeScript, Supabase (service role via `createAdminClient`), Tailwind, Vitest.

**Nota de execução:** Este projeto não tem testes de componente React (só `*.test.ts` para funções puras de `lib/`). Tarefas de UI seguem o padrão do repo: implementar, validar com `npx tsc --noEmit` e `npm run build`, sem teste automatizado de componente. Tarefas de lógica pura (`lib/agenda/*.ts`) seguem TDD com Vitest.

**Pré-requisito de ambiente:** o dev local aponta pro banco de produção (ver `docs/superpowers/RETOMAR.md` / contexto compactado). A Tarefa 3 cria uma migração SQL — ela precisa ser **aplicada no Supabase Studio** antes de testar o check-in de visita extra (online ou pela fila offline), senão a gravação de `motivo_extra` cai no fallback sem coluna (funciona, mas sem guardar o motivo). O check-in e a grade continuam funcionando sem a migração; só o motivo fica de fora até aplicar.

---

### Task 1: `piorStatus` e propagação de `motivo_extra` em `lib/agenda/visitas.ts`

**Files:**
- Modify: `lib/agenda/visitas.ts`
- Test: `lib/agenda/visitas.test.ts` (novo)

- [ ] **Step 1: Escrever o teste (ainda falha: `piorStatus` não existe e `motivo_extra` não é propagado)**

Criar `lib/agenda/visitas.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { piorStatus, montarVisitas, type CheckinRaw, type PostoGeo } from './visitas'

describe('piorStatus', () => {
  it('falta é o pior status; agendado, o melhor', () => {
    expect(piorStatus(['ok', 'falta'])).toBe('falta')
    expect(piorStatus(['ok', 'agendado'])).toBe('ok')
    expect(piorStatus(['sem_foto', 'alerta'])).toBe('sem_foto')
    expect(piorStatus(['reposta', 'ok'])).toBe('ok')
  })

  it('lista vazia devolve null', () => {
    expect(piorStatus([])).toBeNull()
  })
})

describe('motivo_extra propaga pra VisitaView', () => {
  it('visita extra carrega o motivo e a observação informados no check-in', () => {
    const postos = new Map<string, PostoGeo>([
      ['p1', { id: 'p1', nome: 'Posto 1', latitude: -23.5, longitude: -46.6, raio_m: 150 }],
    ])
    const checkins: CheckinRaw[] = [{
      id: 'c1', supervisor_id: 's1', posto_id: 'p1', tipo: 'entrada',
      latitude: -23.5, longitude: -46.6, precisao_m: 10, distancia_m: 5, dentro_raio: true, baixa_precisao: false,
      justificativa: null, created_at: '2026-11-03T12:00:00-03:00',
      motivo_extra: 'emergencia', atividade_obs: 'Cobri o colega',
    }]
    const { visitas } = montarVisitas({ planos: [], checkins, postos, hoje: '2026-11-06', publicada: true })
    expect(visitas).toHaveLength(1)
    expect(visitas[0].status).toBe('extra')
    expect(visitas[0].motivo_extra).toBe('emergencia')
    expect(visitas[0].atividade_obs).toBe('Cobri o colega')
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run lib/agenda/visitas.test.ts`
Expected: FAIL — `piorStatus` não exportado (erro de import) e/ou `motivo_extra` undefined na asserção.

- [ ] **Step 3: Implementar em `lib/agenda/visitas.ts`**

No tipo `CheckinRaw` (campos opcionais), logo após `atividade_obs?: string | null`, adicionar:

```ts
  atividade_obs?: string | null
  motivo_extra?: string | null // supervisor comum: motivo da visita extra (fora do plano do dia)
  fechamento_automatico?: boolean | null // saída (tipo='saida') criada pelo sistema ao abrir check-in em outro posto
```

No tipo `VisitaView`, logo após `atividade_obs: string | null`, adicionar:

```ts
  atividade_obs: string | null
  motivo_extra: string | null // supervisor comum: motivo da visita extra (fora do plano do dia)
  motivo_falta: string | null // justificativa do "Fechar o dia" (tipo) quando não houve check-in
```

Logo depois da definição de `export type StatusVisita = ...`, adicionar a função (nova, antes de `montarVisitas`):

```ts
const PRIORIDADE_STATUS: Record<StatusVisita, number> = {
  falta: 0, sem_foto: 1, alerta: 2, extra: 3, ok: 4, reposta: 5, agendado: 6,
}

/** Pior (mais grave) status entre os informados — usado pra resumir um bloco com vários postos na grade. */
export function piorStatus(status: StatusVisita[]): StatusVisita | null {
  if (status.length === 0) return null
  return status.reduce((pior, s) => (PRIORIDADE_STATUS[s] < PRIORIDADE_STATUS[pior] ? s : pior))
}
```

Dentro de `montar()`, no objeto `VisitaView` retornado, logo após `atividade_obs: entrada?.atividade_obs ?? null,`, adicionar:

```ts
      atividade_obs: entrada?.atividade_obs ?? null,
      motivo_extra: entrada?.motivo_extra ?? null,
      motivo_falta: entrada ? null : justificativas?.get(`${data}|${postoId}`)?.tipo ?? null,
```

No bloco de reposição automática (`Object.assign(falta, { ... })`), adicionar `motivo_extra: extra.motivo_extra,` junto dos outros campos copiados da visita extra:

```ts
    Object.assign(falta, {
      status: 'reposta' as StatusVisita,
      entrada_em: extra.entrada_em,
      saida_em: extra.saida_em,
      tempo_min: extra.tempo_min,
      distancia_m: extra.distancia_m,
      justificativa: extra.justificativa,
      baixa_precisao: extra.baixa_precisao,
      lat_real: extra.lat_real,
      lng_real: extra.lng_real,
      fotos: extra.fotos,
      motivo_extra: extra.motivo_extra,
      reposta_em: extra.data,
      saida_forcada: extra.saida_forcada,
      alertas: [`Reposição: visita planejada para ${diaMes(falta.data)} feita em ${diaMes(extra.data)}`, ...extra.alertas],
    })
```

- [ ] **Step 4: Rodar de novo e confirmar que passa**

Run: `npx vitest run lib/agenda/visitas.test.ts`
Expected: PASS (3 testes)

- [ ] **Step 5: Checar tipos do projeto**

Run: `npx tsc --noEmit`
Expected: sem erros novos.

- [ ] **Step 6: Commit**

```bash
git add lib/agenda/visitas.ts lib/agenda/visitas.test.ts
git commit -m "feat(agenda): piorStatus e propagacao de motivo_extra em VisitaView"
```

---

### Task 2: Lista de motivos da visita extra (`lib/agenda/motivos-visita-extra.ts`)

**Files:**
- Create: `lib/agenda/motivos-visita-extra.ts`
- Test: `lib/agenda/motivos-visita-extra.test.ts`

- [ ] **Step 1: Escrever o teste (falha: arquivo não existe)**

```ts
import { describe, it, expect } from 'vitest'
import { TIPOS_MOTIVO_EXTRA, ROTULO_MOTIVO_EXTRA, exigeTextoMotivoExtra } from './motivos-visita-extra'

describe('motivos da visita extra', () => {
  it('só "outro" exige texto', () => {
    expect(exigeTextoMotivoExtra('outro')).toBe(true)
    expect(exigeTextoMotivoExtra('reposicao')).toBe(false)
    expect(exigeTextoMotivoExtra('emergencia')).toBe(false)
    expect(exigeTextoMotivoExtra('direcao')).toBe(false)
    expect(exigeTextoMotivoExtra('cobertura')).toBe(false)
    expect(exigeTextoMotivoExtra('inexistente')).toBe(false)
  })

  it('tem rótulo pra cada motivo', () => {
    for (const m of TIPOS_MOTIVO_EXTRA) expect(ROTULO_MOTIVO_EXTRA[m.id]).toBe(m.rotulo)
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run lib/agenda/motivos-visita-extra.test.ts`
Expected: FAIL — módulo `./motivos-visita-extra` não encontrado.

- [ ] **Step 3: Implementar**

Criar `lib/agenda/motivos-visita-extra.ts`:

```ts
// Motivo da visita extra (fora do plano do dia), informado pelo supervisor comum no check-in.
// Compartilhado entre servidor e telas. Mesmo padrão de lib/agenda/justificativas.ts.

export const TIPOS_MOTIVO_EXTRA = [
  { id: 'reposicao', rotulo: 'Reposição de visita planejada', exigeTexto: false },
  { id: 'emergencia', rotulo: 'Emergência / ocorrência', exigeTexto: false },
  { id: 'direcao', rotulo: 'Pedido da direção / secretaria', exigeTexto: false },
  { id: 'cobertura', rotulo: 'Cobertura de posto', exigeTexto: false },
  { id: 'outro', rotulo: 'Outro (descrever)', exigeTexto: true },
] as const

export type MotivoExtra = (typeof TIPOS_MOTIVO_EXTRA)[number]['id']

export const ROTULO_MOTIVO_EXTRA: Record<string, string> = Object.fromEntries(TIPOS_MOTIVO_EXTRA.map(m => [m.id, m.rotulo]))

export const exigeTextoMotivoExtra = (motivo: string) => TIPOS_MOTIVO_EXTRA.find(m => m.id === motivo)?.exigeTexto ?? false
```

- [ ] **Step 4: Rodar de novo e confirmar que passa**

Run: `npx vitest run lib/agenda/motivos-visita-extra.test.ts`
Expected: PASS (2 testes)

- [ ] **Step 5: Commit**

```bash
git add lib/agenda/motivos-visita-extra.ts lib/agenda/motivos-visita-extra.test.ts
git commit -m "feat(agenda): lista de motivos da visita extra"
```

---

### Task 3: Migração SQL — coluna `motivo_extra`

**Files:**
- Create: `supabase/migrations/20261106_agenda_motivo_extra.sql`

- [ ] **Step 1: Criar o arquivo de migração**

```sql
-- Motivo da visita extra (fora do plano do dia), informado pelo supervisor comum no check-in.
-- Aplicar no Supabase Studio (SQL Editor) antes de testar o check-in de visita extra.

ALTER TABLE agenda_checkins ADD COLUMN IF NOT EXISTS motivo_extra text;
```

- [ ] **Step 2: Mostrar o SQL acima para o usuário rodar no Supabase Studio**

Este passo não é automatizável (o projeto não tem `exec_sql`, ver CLAUDE.md / armadilhas conhecidas). Antes de testar o check-in de visita extra em produção/preview, confirme com o usuário que a migração foi aplicada.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20261106_agenda_motivo_extra.sql
git commit -m "feat(agenda): migracao para coluna agenda_checkins.motivo_extra"
```

---

### Task 4: `CheckinPendente` ganha `motivoExtra` (fila offline)

**Files:**
- Modify: `lib/agenda/fila-checkins.ts`

- [ ] **Step 1: Adicionar o campo ao tipo**

No tipo `CheckinPendente`, logo após `atividadeObs?: string`, adicionar:

```ts
  focoId?: string // supervisor de apoio: atividade da visita
  atividadeObs?: string
  motivoExtra?: string // supervisor comum: motivo da visita extra (fora do plano do dia)
  postoNome?: string // para listar o posto enquanto o check-in não foi enviado
```

- [ ] **Step 2: Checar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros novos (campo opcional, não quebra nenhum uso existente).

- [ ] **Step 3: Commit**

```bash
git add lib/agenda/fila-checkins.ts
git commit -m "feat(agenda): CheckinPendente carrega motivoExtra na fila offline"
```

---

### Task 5: `registrarCheckin` e `carregarMapa` — gravar e ler `motivo_extra` (`app/(admin)/agenda/geo-actions.ts`)

**Files:**
- Modify: `app/(admin)/agenda/geo-actions.ts`

- [ ] **Step 1: Importar a lista de motivos**

Junto dos outros imports do topo do arquivo, adicionar:

```ts
import { TIPOS_MOTIVO_EXTRA, exigeTextoMotivoExtra } from '@/lib/agenda/motivos-visita-extra'
```

- [ ] **Step 2: Adicionar `motivoExtra` ao input de `registrarCheckin`**

No tipo do parâmetro `input` de `registrarCheckin`, logo após `atividadeObs?: string`, adicionar:

```ts
  focoId?: string // supervisor de apoio: atividade da visita (obrigatória na entrada)
  atividadeObs?: string
  motivoExtra?: string // supervisor comum: motivo da visita fora do plano do dia (obrigatório na entrada)
}): Promise<ResultadoCheckin> {
```

- [ ] **Step 3: Validar o motivo e gravar com fallback (coluna pode não existir ainda)**

Logo após o bloco que calcula `blocoId` (comentário `// Vincula ao bloco planejado do dia da captura (se houver).`) e antes do `insert` final, substituir o trecho original:

```ts
  const { data: criado, error } = await admin
    .from('agenda_checkins')
    .insert({
      supervisor_id: auth.perfil.id,
      posto_id: input.postoId,
      bloco_id: blocoId,
      tipo: input.tipo,
      latitude: input.latitude,
      longitude: input.longitude,
      precisao_m: input.precisaoM,
      distancia_m: Math.round(distancia),
      dentro_raio: dentro,
      baixa_precisao: baixa,
      justificativa: justificativa || null,
      created_at: momento,
      local_id: input.localId ?? null,
      ...(apoio && input.tipo === 'entrada' ? { foco_id: input.focoId, atividade_obs: atividadeObs || null } : {}),
    })
    .select('id')
    .single()
  if (error) return { ok: false, erro: error.message }
```

por:

```ts
  // Supervisor comum (não apoio), visita fora do plano do dia: motivo obrigatório na entrada.
  const motivoExtraNecessario = !apoio && input.tipo === 'entrada' && blocoId === null
  if (motivoExtraNecessario) {
    if (!input.motivoExtra) return { ok: false, erro: 'Escolha o motivo desta visita extra.' }
    if (!TIPOS_MOTIVO_EXTRA.some(m => m.id === input.motivoExtra)) return { ok: false, erro: 'Motivo inválido.' }
    if (exigeTextoMotivoExtra(input.motivoExtra) && atividadeObs.length < 5) {
      return { ok: false, erro: 'Descreva o motivo desta visita extra.' }
    }
  }

  const camposAtividade = apoio && input.tipo === 'entrada'
    ? { foco_id: input.focoId, atividade_obs: atividadeObs || null }
    : motivoExtraNecessario
      ? { motivo_extra: input.motivoExtra, atividade_obs: atividadeObs || null }
      : {}

  const inserir = (campos: Record<string, unknown>) =>
    admin
      .from('agenda_checkins')
      .insert({
        supervisor_id: auth.perfil.id,
        posto_id: input.postoId,
        bloco_id: blocoId,
        tipo: input.tipo,
        latitude: input.latitude,
        longitude: input.longitude,
        precisao_m: input.precisaoM,
        distancia_m: Math.round(distancia),
        dentro_raio: dentro,
        baixa_precisao: baixa,
        justificativa: justificativa || null,
        created_at: momento,
        local_id: input.localId ?? null,
        ...campos,
      })
      .select('id')
      .single()

  let { data: criado, error } = await inserir(camposAtividade)
  // Coluna motivo_extra pode ainda não existir (migração 20261106_agenda_motivo_extra.sql pendente):
  // grava o check-in do mesmo jeito, sem o motivo, em vez de bloquear o registro da visita.
  if (error && 'motivo_extra' in camposAtividade && String(error.message).includes('motivo_extra')) {
    ;({ data: criado, error } = await inserir({ atividade_obs: camposAtividade.atividade_obs }))
  }
  if (error) return { ok: false, erro: error.message }
```

E no `return` final da função, trocar `criado.id` por `criado!.id` (o `!` porque depois do fallback o TypeScript não sabe que `criado` está definido quando `error` é falso):

```ts
  revalidatePath('/agenda')
  return { ok: true, dentro, baixaPrecisao: baixa, distancia, checkinId: criado!.id as string }
}
```

- [ ] **Step 4: Estender a busca de check-ins em `carregarMapa` pra trazer `motivo_extra`**

No `carregarMapa`, a cadeia de fallback de colunas (começa com `let { data: cksRaw, error: cksErr } = await buscarCheckins(...)`), adicionar uma tentativa no topo com `motivo_extra`:

```ts
  let { data: cksRaw, error: cksErr } = await buscarCheckins(`${colunas}, foto_path, foco_id, atividade_obs, motivo_extra, recebido_em`)
  if (cksErr) ({ data: cksRaw, error: cksErr } = await buscarCheckins(`${colunas}, foto_path, foco_id, atividade_obs, recebido_em`))
  if (cksErr) ({ data: cksRaw, error: cksErr } = await buscarCheckins(`${colunas}, foto_path, foco_id, atividade_obs`))
  if (cksErr) ({ data: cksRaw, error: cksErr } = await buscarCheckins(`${colunas}, foto_path`))
  if (cksErr) ({ data: cksRaw, error: cksErr } = await buscarCheckins(colunas))
  if (cksErr) return { ok: false, erro: MSG_MIGRACAO }
```

- [ ] **Step 5: Checar tipos e build**

Run: `npx tsc --noEmit`
Expected: sem erros.

Run: `npm run build`
Expected: build conclui sem erros.

- [ ] **Step 6: Commit**

```bash
git add "app/(admin)/agenda/geo-actions.ts"
git commit -m "feat(agenda): registrarCheckin grava motivo da visita extra, com fallback sem a coluna"
```

---

### Task 6: Encaminhar `motivoExtra` no envio da fila offline (`lib/agenda/sync-fila.ts`)

**Files:**
- Modify: `lib/agenda/sync-fila.ts`

- [ ] **Step 1: Repassar o campo na chamada de `registrarCheckin`**

Em `processarCheckins`, no `registrarCheckin({...})`, adicionar `motivoExtra: item.motivoExtra,`:

```ts
      r = await comTempoLimite(registrarCheckin({
        postoId: item.postoId, tipo: item.tipo, latitude: item.latitude, longitude: item.longitude,
        precisaoM: item.precisaoM, justificativa: item.justificativa, localId: item.localId, capturadoEm: item.capturadoEm,
        focoId: item.focoId, atividadeObs: item.atividadeObs, motivoExtra: item.motivoExtra,
      }))
```

- [ ] **Step 2: Checar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add lib/agenda/sync-fila.ts
git commit -m "feat(agenda): fila offline encaminha motivo da visita extra ao reenviar"
```

---

### Task 7: Painel de motivo no check-in de visita extra (`components/agenda/checkin-painel.tsx`)

**Files:**
- Modify: `components/agenda/checkin-painel.tsx`

- [ ] **Step 1: Importar o campo de observação e a lista de motivos**

Junto dos outros imports do topo, adicionar:

```ts
import { CampoObservacao } from './campo-observacao'
import { TIPOS_MOTIVO_EXTRA, exigeTextoMotivoExtra } from '@/lib/agenda/motivos-visita-extra'
```

- [ ] **Step 2: Novo estado, junto de `atividadesRef`**

Logo após a declaração de `atividadesRef`, adicionar:

```ts
  const atividadesRef = useRef<Record<string, { focoId: string; obs: string; postoNome: string }>>({})
  const motivosExtraRef = useRef<Record<string, { motivo: string; obs: string }>>({})
  const [motivoAberto, setMotivoAberto] = useState<string | null>(null) // postoId aguardando motivo da visita extra
  const [motivoSel, setMotivoSel] = useState('')
  const [motivoObs, setMotivoObs] = useState('')
```

- [ ] **Step 3: `acionar()` passa a ler o motivo da visita extra**

Na função `acionar`, logo após `const atv = tipo === 'entrada' ? atividadesRef.current[postoId] : undefined`, adicionar:

```ts
    const atv = tipo === 'entrada' ? atividadesRef.current[postoId] : undefined
    const mx = tipo === 'entrada' ? motivosExtraRef.current[postoId] : undefined
```

No objeto `item: CheckinPendente` montado logo abaixo, trocar `atividadeObs: atv?.obs,` por `atividadeObs: atv?.obs ?? mx?.obs,` e adicionar `motivoExtra: mx?.motivo,`:

```ts
      const item: CheckinPendente = {
        localId: gerarIdLocal(),
        postoId,
        tipo,
        latitude: coords.lat,
        longitude: coords.lng,
        precisaoM: coords.precisao,
        capturadoEm: new Date().toISOString(),
        justificativa,
        focoId: atv?.focoId,
        atividadeObs: atv?.obs ?? mx?.obs,
        motivoExtra: mx?.motivo,
        postoNome: atv?.postoNome ?? [...postos, ...visitadosApoio].find(p => p.id === postoId)?.nome,
      }
```

Na chamada a `registrarCheckin` (dentro do mesmo `try`), adicionar `motivoExtra: item.motivoExtra,`:

```ts
        r = await comTempoLimite(registrarCheckin({
          postoId, tipo, latitude: coords.lat, longitude: coords.lng, precisaoM: coords.precisao, justificativa,
          localId: item.localId, capturadoEm: item.capturadoEm, focoId: item.focoId, atividadeObs: item.atividadeObs,
          motivoExtra: item.motivoExtra,
        }))
```

- [ ] **Step 4: Em `linha()`, abrir o painel de motivo em vez de registrar direto**

Dentro de `function linha(posto, extra = false)`, logo após `function sair() { ... }`, adicionar:

```ts
    function iniciarExtra() {
      setErro(null)
      setMotivoAberto(posto.id)
      setMotivoSel('')
      setMotivoObs('')
    }

    function confirmarExtra() {
      motivosExtraRef.current[posto.id] = { motivo: motivoSel, obs: motivoObs.trim() }
      setMotivoAberto(null)
      void acionar(posto.id, 'entrada')
    }
```

No botão "Cheguei" (ramo `!entrada` do JSX), trocar o `onClick`:

```tsx
          ) : !entrada ? (
            <button type="button" disabled={!!busy} onClick={() => (extra ? iniciarExtra() : acionar(posto.id, 'entrada'))}
              className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-50">
              <LogIn className="h-4 w-4" /> {carregando ? 'Localizando…' : 'Cheguei'}
            </button>
          ) : !saida ? (
```

No botão "Voltei ao posto (nova visita)" (depois do check-in concluído), mesma troca:

```tsx
              {!apoio && <button type="button" disabled={!!busy} onClick={() => (extra ? iniciarExtra() : acionar(posto.id, 'entrada'))}
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-50">
                <LogIn className="h-3.5 w-3.5" /> {carregando ? 'Localizando…' : 'Voltei ao posto (nova visita)'}
              </button>}
```

- [ ] **Step 5: Renderizar o painel de motivo**

Logo antes do bloco `{precisaJust && ( ... )}` (depois do bloco `{itemAJustificar && ( ... )}`), adicionar:

```tsx
        {motivoAberto === posto.id && (
          <div className="mt-3 rounded-lg border border-slate-300 bg-slate-50 p-3">
            <p className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-600">Por que esta visita não estava no plano?</p>
            <select value={motivoSel} onChange={e => setMotivoSel(e.target.value)}
              className="mb-2 w-full rounded-lg border border-slate-200 bg-white p-2 text-sm outline-none focus:border-slate-400">
              <option value="">Motivo (obrigatório)…</option>
              {TIPOS_MOTIVO_EXTRA.map(m => <option key={m.id} value={m.id}>{m.rotulo}</option>)}
            </select>
            <CampoObservacao
              value={motivoObs}
              onChange={setMotivoObs}
              maxLength={300}
              placeholder={motivoSel === 'outro' ? 'Descreva o motivo (obrigatório)' : 'Observação (opcional)'}
            />
            <div className="mt-2 flex gap-2">
              <button type="button"
                disabled={!!busy || !motivoSel || (exigeTextoMotivoExtra(motivoSel) && motivoObs.trim().length < 5)}
                onClick={confirmarExtra}
                className="rounded-lg bg-slate-900 px-4 py-1.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-40">
                Confirmar e fazer check-in
              </button>
              <button type="button" onClick={() => setMotivoAberto(null)} className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-white">
                Cancelar
              </button>
            </div>
          </div>
        )}

        {precisaJust && (
```

- [ ] **Step 6: Checar tipos e build**

Run: `npx tsc --noEmit`
Expected: sem erros.

Run: `npm run build`
Expected: build conclui sem erros.

- [ ] **Step 7: Commit**

```bash
git add components/agenda/checkin-painel.tsx
git commit -m "feat(agenda): pede motivo e observacao antes do check-in de visita extra"
```

---

### Task 8: Selo de presença na grade semanal (`components/agenda/grade-semanal.tsx`)

**Files:**
- Modify: `components/agenda/grade-semanal.tsx`

- [ ] **Step 1: Substituir o arquivo inteiro**

Conteúdo final de `components/agenda/grade-semanal.tsx`:

```tsx
'use client'

import { Camera, CheckCircle2, MessageSquareText, Plus, RefreshCw, RotateCcw, Sun, Sunset, XCircle } from 'lucide-react'
import { DIAS_CURTOS, PERIODOS, slotsVisiveis, temaDe, type FeriadoDia, type Periodo } from '@/lib/agenda/tema'
import { diaMes, numeroDia } from '@/lib/agenda/datas'
import { ehDiaDaJanela } from '@/lib/agenda/recolhimento'
import { piorStatus, type StatusVisita } from '@/lib/agenda/visitas'
import type { BlocoView, TipoFoco } from '@/app/(admin)/agenda/actions'

const ICONE_PERIODO = { manha: Sun, tarde: Sunset } as const

type SeloStatus = { Icone: typeof CheckCircle2; cor: string; titulo: string }
const SELO_STATUS: Partial<Record<StatusVisita, SeloStatus>> = {
  ok: { Icone: CheckCircle2, cor: 'text-emerald-600', titulo: 'Esteve no posto' },
  alerta: { Icone: CheckCircle2, cor: 'text-emerald-600', titulo: 'Esteve no posto, com atenção' },
  falta: { Icone: XCircle, cor: 'text-rose-600', titulo: 'Sem check-in' },
  sem_foto: { Icone: Camera, cor: 'text-orange-600', titulo: 'Sem foto obrigatória' },
}

export function GradeSemanal({
  dias,
  blocos,
  tipos,
  hoje,
  podeEditar,
  feriados,
  repostas,
  statusPorSlot,
  onSlot,
}: {
  dias: string[]
  blocos: BlocoView[]
  tipos: TipoFoco[]
  hoje: string
  podeEditar: boolean
  feriados: Record<string, FeriadoDia>
  repostas?: Record<string, string> // `data|postoId` → dia em que a visita foi reposta
  statusPorSlot?: Record<string, StatusVisita> // `data|postoId` → status da visita (presença), para o selo na grade
  onSlot: (data: string, periodo: Periodo, ordem: number, bloco: BlocoView | null) => void
}) {
  const tiposMap = new Map(tipos.map(t => [t.id, t]))
  const porSlot = new Map(blocos.map(b => [`${b.data}|${b.periodo}|${b.ordem}`, b]))

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
      {dias.map((data, i) => {
        const ehHoje = data === hoje
        const passado = data < hoje
        const fer = feriados[data]
        const bloqueado = !!fer && fer.tipo !== 'facultativo'
        const temBlocos = blocos.some(b => b.data === data)
        const semPlanejar = bloqueado && !temBlocos
        return (
          <div
            key={data}
            className={`flex flex-col gap-2 rounded-2xl p-2 ${
              ehHoje ? 'bg-emerald-50 ring-2 ring-emerald-400/70' : bloqueado ? 'bg-rose-50/60 ring-1 ring-rose-200' : 'bg-white ring-1 ring-slate-200'
            } shadow-sm`}
          >
            <div className="flex items-center justify-between px-1.5 pt-1 md:flex-col md:items-start md:gap-0.5">
              <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500">{DIAS_CURTOS[i]}</span>
              <span className="flex items-center gap-1.5">
                <span className={`text-2xl font-black leading-none ${ehHoje ? 'text-emerald-600' : passado ? 'text-slate-400' : 'text-slate-900'}`}>
                  {numeroDia(data)}
                </span>
                {ehHoje && (
                  <span className="rounded-full bg-emerald-500 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">hoje</span>
                )}
              </span>
            </div>

            {fer && (
              <p className={`rounded-lg px-2 py-1 text-[11px] font-semibold leading-tight ${
                bloqueado ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-800'
              }`}>
                {bloqueado ? '🎉 Feriado' : '⚠️ Ponto facultativo'} · {fer.nome}
                {fer.ate_hora ? ` (até ${fer.ate_hora})` : ''}
              </p>
            )}

            {ehDiaDaJanela(data) && !blocos.some(b => b.data === data && tiposMap.get(b.tipo_foco_id)?.dia_inteiro) && (
              <p className="rounded-lg border border-dashed border-amber-400 bg-amber-50 px-2 py-1 text-[10px] font-semibold leading-tight text-amber-800">
                🕒 Janela de recolhimento: marque se for recolher neste dia
              </p>
            )}

            {semPlanejar && (
              <div className="flex min-h-[120px] flex-1 items-center justify-center rounded-xl border-2 border-dashed border-rose-200 p-3 text-center text-xs font-medium text-rose-400">
                Sem expediente.<br />Não há visitas neste dia.
              </div>
            )}

            {(semPlanejar ? [] : PERIODOS).map(p => {
              const Icone = ICONE_PERIODO[p.id]
              const doPeriodo = blocos.filter(b => b.data === data && b.periodo === p.id)
              const maior = doPeriodo.reduce((m, b) => Math.max(m, b.ordem), 0)
              const total = slotsVisiveis(maior)
              return (
                <div key={p.id} className="space-y-1.5">
                  <div className="flex items-center gap-1.5 px-1">
                    <span className={`h-1.5 w-4 rounded-full ${p.faixa}`} aria-hidden />
                    <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      <Icone className="h-3 w-3" /> {p.label}
                    </span>
                    <span className="ml-auto text-[10px] font-semibold text-slate-400">{doPeriodo.length}</span>
                  </div>

                  {Array.from({ length: total }, (_, k) => k + 1).map(ordem => {
                    const bloco = porSlot.get(`${data}|${p.id}|${ordem}`) ?? null
                    const tipo = bloco ? tiposMap.get(bloco.tipo_foco_id) : null

                    if (!bloco) {
                      return (
                        <button
                          key={ordem}
                          type="button"
                          disabled={!podeEditar || bloqueado}
                          onClick={() => onSlot(data, p.id, ordem, null)}
                          className="group flex min-h-[52px] w-full items-center justify-between rounded-xl border-2 border-dashed border-slate-200 px-2.5 py-1.5 text-left transition enabled:hover:border-slate-400 enabled:hover:bg-slate-50 disabled:cursor-default"
                        >
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-300">Visita {ordem}</span>
                          {podeEditar ? (
                            <Plus className="h-5 w-5 text-slate-300 transition group-hover:text-slate-600" />
                          ) : (
                            <span className="text-[10px] text-slate-300">livre</span>
                          )}
                        </button>
                      )
                    }

                    const tema = temaDe(tipo?.cor)
                    const extras = bloco.postos.length - 2
                    const reposicao = bloco.postos.map(po => repostas?.[`${data}|${po.id}`]).find(Boolean)
                    const statusBloco = statusPorSlot && bloco.postos.length > 0
                      ? piorStatus(bloco.postos.map(po => statusPorSlot[`${data}|${po.id}`]).filter((s): s is StatusVisita => !!s))
                      : null
                    const selo = statusBloco ? SELO_STATUS[statusBloco] : null
                    return (
                      <button
                        key={ordem}
                        type="button"
                        onClick={() => onSlot(data, p.id, ordem, bloco)}
                        className={`relative flex min-h-[52px] w-full flex-col gap-1 overflow-hidden rounded-xl border py-1.5 pl-3.5 pr-2 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${tema.card} ${tema.texto}`}
                      >
                        <span className={`absolute inset-y-0 left-0 w-1.5 ${p.faixa}`} aria-hidden />
                        <span className="flex items-start gap-1.5 text-[12px] font-bold leading-tight">
                          <span className="text-sm leading-none">{tipo?.icone ?? '📌'}</span>
                          <span className="line-clamp-2 flex-1">{tipo?.nome ?? 'Foco'}</span>
                          {bloco.replanejado && <RefreshCw className="h-3 w-3 shrink-0 text-amber-600" aria-label="Replanejado" />}
                          {bloco.observacao && <MessageSquareText className="h-3 w-3 shrink-0" aria-label="Com observação" />}
                          {selo && <selo.Icone className={`h-3 w-3 shrink-0 ${selo.cor}`} aria-label={selo.titulo} />}
                        </span>
                        <span className="flex flex-wrap gap-1">
                          {bloco.postos.slice(0, 2).map(po => (
                            <span key={po.id} className={`max-w-full truncate rounded-md px-1.5 py-0.5 text-[10px] font-medium ${tema.chip}`}>
                              {po.nome}
                            </span>
                          ))}
                          {extras > 0 && <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${tema.chip}`}>+{extras}</span>}
                        </span>
                        {reposicao && (
                          <span className="flex w-fit items-center gap-1 rounded-md bg-teal-100 px-1.5 py-0.5 text-[10px] font-bold text-teal-800">
                            <RotateCcw className="h-3 w-3" /> Reposta em {diaMes(reposicao)}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Checar tipos**

Run: `npx tsc --noEmit`
Expected: erro esperado nesta etapa — `statusPorSlot` ainda não é passado por quem usa `GradeSemanal` (`components/agenda/agenda-supervisor.tsx`). Resolvido na Task 9.

- [ ] **Step 3: Commit**

```bash
git add components/agenda/grade-semanal.tsx
git commit -m "feat(agenda): selo de presenca por bloco na grade semanal"
```

---

### Task 9: Alimentar a grade com o status de presença (`components/agenda/agenda-supervisor.tsx`)

**Files:**
- Modify: `components/agenda/agenda-supervisor.tsx`

- [ ] **Step 1: Importar o tipo de status**

Junto dos outros imports do topo, adicionar:

```ts
import type { StatusVisita, VisitaView } from '@/lib/agenda/visitas'
```

- [ ] **Step 2: Guardar a lista completa de visitas e montar `statusPorSlot`**

Substituir o trecho original:

```ts
  const [repostasLista, setRepostasLista] = useState<{ data: string; posto_id: string; reposta_em: string }[]>([])

  // Visitas repostas na semana (falta coberta por visita extra no mesmo posto): selo nos cards da grade.
  useEffect(() => {
    let vivo = true
    setRepostasLista([])
    if (!publicada) return
    carregarMapa(semanaInicio, supervisor.id).then(r => {
      if (!vivo || !r.ok) return
      setRepostasLista(
        r.dados.visitas
          .filter(v => v.status === 'reposta' && v.reposta_em)
          .map(v => ({ data: v.data, posto_id: v.posto_id, reposta_em: v.reposta_em! })),
      )
    })
    return () => { vivo = false }
  }, [semanaInicio, supervisor.id, publicada, blocos])
  const repostas = useMemo(
    () => Object.fromEntries(repostasLista.map(r => [`${r.data}|${r.posto_id}`, r.reposta_em])),
    [repostasLista],
  )
```

por:

```ts
  const [repostasLista, setRepostasLista] = useState<{ data: string; posto_id: string; reposta_em: string }[]>([])
  const [statusLista, setStatusLista] = useState<VisitaView[]>([])

  // Visitas da semana (status de presença + repostas): selos na grade. Uma busca só alimenta os dois.
  useEffect(() => {
    let vivo = true
    setRepostasLista([])
    setStatusLista([])
    if (!publicada) return
    carregarMapa(semanaInicio, supervisor.id).then(r => {
      if (!vivo || !r.ok) return
      setStatusLista(r.dados.visitas)
      setRepostasLista(
        r.dados.visitas
          .filter(v => v.status === 'reposta' && v.reposta_em)
          .map(v => ({ data: v.data, posto_id: v.posto_id, reposta_em: v.reposta_em! })),
      )
    })
    return () => { vivo = false }
  }, [semanaInicio, supervisor.id, publicada, blocos])
  const repostas = useMemo(
    () => Object.fromEntries(repostasLista.map(r => [`${r.data}|${r.posto_id}`, r.reposta_em])),
    [repostasLista],
  )
  // Status de presença por posto+dia (ignora 'extra': não corresponde a um bloco planejado específico).
  const statusPorSlot = useMemo(() => {
    const m: Record<string, StatusVisita> = {}
    for (const v of statusLista) if (v.status !== 'extra') m[`${v.data}|${v.posto_id}`] = v.status
    return m
  }, [statusLista])
```

- [ ] **Step 3: Passar `statusPorSlot` pra `GradeSemanal`**

No JSX onde `<GradeSemanal ... repostas={repostas} ... />` é chamado, adicionar a prop logo abaixo de `repostas`:

```tsx
        <GradeSemanal
          dias={dias}
          blocos={blocos}
          tipos={tipos}
          hoje={hoje}
          podeEditar={podeEditar}
          feriados={feriados}
          repostas={repostas}
          statusPorSlot={statusPorSlot}
          onSlot={(data, periodo, ordem, bloco) => setSlot({
```

- [ ] **Step 4: Checar tipos e build**

Run: `npx tsc --noEmit`
Expected: sem erros.

Run: `npm run build`
Expected: build conclui sem erros.

- [ ] **Step 5: Commit**

```bash
git add components/agenda/agenda-supervisor.tsx
git commit -m "feat(agenda): agenda-supervisor alimenta o selo de presenca da grade"
```

---

### Task 10: Texto de orientação no modal de dia travado (`components/agenda/modal-bloco.tsx`)

**Files:**
- Modify: `components/agenda/modal-bloco.tsx`

- [ ] **Step 1: Trocar o texto**

Substituir:

```tsx
          {passadoTravado && (
            <section className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-800">
              🔒 Este dia já passou. Numa agenda publicada, dias passados só o admin altera. Peça ao admin para liberar este dia se precisar corrigir.
            </section>
          )}
```

por:

```tsx
          {passadoTravado && (
            <section className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-800">
              🔒 Este dia já passou. Se a visita foi feita em <b>outro dia</b>, não precisa editar aqui: no dia em que foi, faça o check-in nesse mesmo posto (dentro da mesma semana) — o sistema reconhece sozinho como reposição desta visita. Só peça ao admin para liberar o dia se o problema for outro (bloco errado, posto errado etc.).
            </section>
          )}
```

- [ ] **Step 2: Checar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add components/agenda/modal-bloco.tsx
git commit -m "fix(agenda): orienta reposicao por check-in no dia certo, em vez de so dizer que o dia esta travado"
```

---

### Task 11: Mostrar o motivo da visita extra no Mapa de Visitas (`components/agenda/mapa-agenda.tsx`)

**Files:**
- Modify: `components/agenda/mapa-agenda.tsx`

- [ ] **Step 1: Importar os rótulos de motivo**

Junto do import de `ROTULO_CURTO_JUSTIFICATIVA`, adicionar:

```ts
import { ROTULO_CURTO_JUSTIFICATIVA } from '@/lib/agenda/justificativas'
import { ROTULO_MOTIVO_EXTRA } from '@/lib/agenda/motivos-visita-extra'
```

- [ ] **Step 2: Incluir o motivo no popup do mapa**

No array `detalhes` dentro do `if (v.lat_real != null && v.lng_real != null) { ... }`, substituir:

```ts
          apoio ? `<i>${esc(v.atividade ?? 'Sem atividade informada')}</i>` : '',
          apoio && v.atividade_obs ? esc(v.atividade_obs) : '',
```

por:

```ts
          apoio ? `<i>${esc(v.atividade ?? 'Sem atividade informada')}</i>` : '',
          !apoio && v.status === 'extra' && v.motivo_extra ? `Motivo: <b>${esc(ROTULO_MOTIVO_EXTRA[v.motivo_extra] ?? v.motivo_extra)}</b>` : '',
          v.atividade_obs ? esc(v.atividade_obs) : '',
```

- [ ] **Step 3: Incluir o motivo na lista lateral**

No `<li>` de cada visita, substituir:

```tsx
                        {v.focos.length > 0 && <span className="block truncate text-[11px] text-slate-400">{v.focos.join(' · ')}</span>}
                        {apoio && v.atividade_obs && <span className="block text-[11px] text-slate-600">{v.atividade_obs}</span>}
                        {v.motivo_falta && (
```

por:

```tsx
                        {v.focos.length > 0 && <span className="block truncate text-[11px] text-slate-400">{v.focos.join(' · ')}</span>}
                        {!apoio && v.status === 'extra' && v.motivo_extra && (
                          <span className="block text-[11px] font-semibold text-indigo-700">
                            Motivo: {ROTULO_MOTIVO_EXTRA[v.motivo_extra] ?? v.motivo_extra}
                          </span>
                        )}
                        {v.atividade_obs && <span className="block text-[11px] text-slate-600">{v.atividade_obs}</span>}
                        {v.motivo_falta && (
```

- [ ] **Step 4: Checar tipos e build**

Run: `npx tsc --noEmit`
Expected: sem erros.

Run: `npm run build`
Expected: build conclui sem erros.

- [ ] **Step 5: Commit**

```bash
git add components/agenda/mapa-agenda.tsx
git commit -m "feat(agenda): mapa de visitas mostra o motivo da visita extra"
```

---

### Task 12: Atualizar o guia de uso (`docs/guia-uso-agenda-supervisores.md`)

**Files:**
- Modify: `docs/guia-uso-agenda-supervisores.md`

- [ ] **Step 1: Explicar a reposição por check-in no dia certo**

Substituir:

```markdown
5. **Mudou o plano depois de publicar?.** Pode alterar, mas o sistema pede o motivo. A mudança fica registrada na linha do tempo (ícone de replanejamento).
```

por:

```markdown
5. **Mudou o plano depois de publicar?.** Pode alterar, mas o sistema pede o motivo. A mudança fica registrada na linha do tempo (ícone de replanejamento). **Fez a visita em outro dia?** Não precisa editar o bloco antigo (dias já passados de uma agenda publicada só o admin libera): no dia em que foi, registre o check-in nesse mesmo posto — dentro da mesma semana, o sistema reconhece sozinho como reposição da visita planejada.
```

- [ ] **Step 2: Atualizar a linha da visita extra na tabela de situações especiais**

Substituir:

```markdown
| Fez uma visita que não estava na agenda | Toque em "+ Visita extra (não planejada)" e faça o Cheguei normalmente. |
```

por:

```markdown
| Fez uma visita que não estava na agenda | Toque em "+ Visita extra (não planejada)", escolha o motivo (reposição, emergência, pedido da direção, cobertura ou outro) e faça o Cheguei normalmente. |
```

- [ ] **Step 3: Commit**

```bash
git add docs/guia-uso-agenda-supervisores.md
git commit -m "docs(agenda): atualiza guia com reposicao por check-in e motivo da visita extra"
```

---

### Task 13: Validação final

**Files:** nenhum (só checagem)

- [ ] **Step 1: Tipos, testes e build completos**

Run: `npx tsc --noEmit`
Expected: sem erros.

Run: `npx vitest run`
Expected: todos os testes passam (inclui os novos de `visitas.test.ts` e `motivos-visita-extra.test.ts`).

Run: `npm run build`
Expected: build de produção conclui sem erros.

- [ ] **Step 2: Confirmar que a migração foi aplicada**

Perguntar ao usuário se rodou `supabase/migrations/20261106_agenda_motivo_extra.sql` no Supabase Studio. Sem ela, o check-in de visita extra funciona, mas o motivo não é gravado (cai no fallback da Task 5).

- [ ] **Step 3: Checklist manual no preview (`npm run dev`, logado como supervisor e como admin/coordenador)**

- [ ] Grade semanal (aba Agenda) de uma semana publicada e já passada: blocos com check-in mostram selo verde; blocos sem check-in mostram selo vermelho; bloco com foco que exige foto e sem foto mostra selo laranja; bloco de dia futuro não mostra selo.
- [ ] Visão do admin/coordenador (editando em nome de um supervisor) mostra os mesmos selos.
- [ ] Bloco com reposição (falta recoberta por visita extra no mesmo posto/semana) continua mostrando "Reposta em DD/MM" (sem selo duplicado).
- [ ] Abrir "Editar visita" num dia já passado de agenda publicada (sem liberação do admin): mensagem nova explica o check-in no dia certo, mantendo o botão de liberar pro admin.
- [ ] No painel "Seu dia em campo", abrir "+ Visita extra (não planejada)" e tocar em "Cheguei" num posto fora do plano: abre o painel de motivo antes de registrar; sem escolher motivo o botão de confirmar fica desabilitado; motivo "Outro" exige descrição.
- [ ] Confirmar o motivo e registrar: check-in é feito normalmente (dentro ou fora do raio, com a justificativa de raio quando for o caso).
- [ ] Na aba Mapa de Visitas, a visita extra registrada mostra o motivo escolhido.
- [ ] Testar sem sinal (modo avião): check-in de visita extra guardado localmente também pede o motivo antes de guardar, e ao voltar o sinal o motivo chega ao servidor (confirmar no Mapa de Visitas depois do envio).

- [ ] **Step 4: Reportar ao usuário**

Resumir o que foi verificado e o que falta verificar manualmente (ex.: fluxo offline real num celular), seguindo a skill `superpowers:verification-before-completion`.
