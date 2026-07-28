# Solicitação de mudança de horário + Excel colorido — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deixar o supervisor solicitar mudança de horário (turno) de um funcionário dentro do mesmo posto, com aprovação do admin aplicando automaticamente; e exportar a relação de horários dos funcionários no Excel do Efetivo, colorida por regime.

**Architecture:** Bloco D é um novo tipo de solicitação (`mudanca_horario`) que reaproveita 100% a infraestrutura já existente do trabalho anterior (`aplicarMudancaHorario`, `listarTurnosDoPosto`, `listarTurnosJovemAprendiz`) — só adiciona o caminho de request/approval em cima dela, sem lógica nova de negócio sobre horário. Bloco E é puramente leitura: 1 query nova na página do Efetivo + 2 colunas no exportador Excel já existente (que já suporta `cellStyle` por coluna).

**Tech Stack:** Next.js 14 App Router, Server Actions, Supabase (`createClient()` síncrono), TypeScript, Tailwind, `xlsx-js-style` (via `lib/export-excel.ts`). Sem framework de testes — verificação é `npx tsc --noEmit` + `npm run build` + checagem manual no browser.

**Branch:** continua em `feature/turnos-padrao-e-horario` (já tem Blocos A/B/C commitados e validados no preview). Não criar branch nova, não fazer push/merge — isso é feito manualmente pelo usuário só depois de tudo validado junto.

---

## Task 1: Migração — novo tipo de solicitação

**Files:**
- Create: `supabase/migrations/20260728_mudanca_horario_solicitacao.sql`

- [ ] **Step 1: Criar a migração**

```sql
-- ============================================================
-- Solicitação de mudança de horário (turno) dentro do mesmo posto
-- ============================================================

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'solicitacoes'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%desligamento%'
  LOOP
    EXECUTE format('ALTER TABLE solicitacoes DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE solicitacoes ADD CONSTRAINT solicitacoes_tipo_check
  CHECK (tipo = ANY (ARRAY[
    'desligamento','transferencia','mudanca_funcao','promocao',
    'mudanca_supervisor','alteracao_salario','afastamento',
    'retorno_afastamento','rescisao_indireta','admissao','mudanca_horario'
  ]));

-- Verificação: exibir constraint aplicada
SELECT conname, pg_get_constraintdef(oid) AS definicao
FROM pg_constraint
WHERE conrelid = 'solicitacoes'::regclass AND contype = 'c';
```

Este arquivo é só criado — não é aplicado automaticamente pelo `npm run build`. Aplicar via Supabase Studio (SQL Editor) ou `mcp__.*__apply_migration` se disponível no ambiente de execução; se não houver acesso ao banco neste ambiente, deixar o arquivo pronto e avisar no relatório final que a migração precisa ser aplicada manualmente antes do Bloco D funcionar em produção/preview.

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260728_mudanca_horario_solicitacao.sql
git commit -m "feat(solicitacoes): adiciona tipo mudanca_horario ao check constraint"
```

---

## Task 2: Tipo `TipoSolicitacao` + Server Action de criação da solicitação

**Files:**
- Modify: `types/index.ts`
- Modify: `app/(admin)/efetivo/actions.ts`

- [ ] **Step 1: Adicionar o tipo em `types/index.ts`**

Esta linha (por volta da linha 164):
```ts
export type TipoSolicitacao =
  | 'desligamento'
  | 'transferencia'
  | 'mudanca_funcao'
  | 'promocao'
  | 'alteracao_salario'
  | 'mudanca_supervisor'
  | 'afastamento'
  | 'retorno_afastamento'
  | 'rescisao_indireta'
  | 'admissao'
```
vira:
```ts
export type TipoSolicitacao =
  | 'desligamento'
  | 'transferencia'
  | 'mudanca_funcao'
  | 'promocao'
  | 'alteracao_salario'
  | 'mudanca_supervisor'
  | 'afastamento'
  | 'retorno_afastamento'
  | 'rescisao_indireta'
  | 'admissao'
  | 'mudanca_horario'
```

- [ ] **Step 2: Corrigir os dois dicionários exaustivos que quebram com o novo tipo**

`TipoSolicitacao` é usado em `Record<TipoSolicitacao, ...>` (não `Partial`) em 2 lugares — o TypeScript exige todas as chaves, então adicionar um valor novo à union quebra a build ali até adicionar a entrada correspondente.

Em `app/(admin)/aprovacoes/page.tsx`, esta linha (por volta da linha 30):
```ts
const TIPO_LABELS: Record<TipoSolicitacao, string> = {
  desligamento:        'Desligamento',
  transferencia:       'Transferência',
  mudanca_funcao:      'Mudança de Função',
  promocao:            'Promoção',
  mudanca_supervisor:  'Mudança de Supervisor',
  alteracao_salario:   'Alteração Salarial',
  afastamento:         'Afastamento',
  retorno_afastamento: 'Retorno de Afastamento',
  rescisao_indireta:   'Rescisão Indireta',
  admissao:            'Admissão',
```
ganha, logo após `admissao:`:
```ts
  admissao:            'Admissão',
  mudanca_horario:     'Mudança de Horário',
```

Em `components/aprovacoes/aprovacoes-list.tsx`, esta linha (por volta da linha 31):
```ts
const TIPO_BADGE: Record<TipoSolicitacao, { label: string; className: string }> = {
  desligamento:       { label: 'Desligamento',      className: 'bg-red-50 text-red-700 ring-red-200'         },
  transferencia:      { label: 'Transferência',      className: 'bg-blue-50 text-blue-700 ring-blue-200'       },
  mudanca_funcao:     { label: 'Mudança de Função',  className: 'bg-indigo-50 text-indigo-700 ring-indigo-200' },
  promocao:           { label: 'Promoção',           className: 'bg-green-50 text-green-700 ring-green-200'    },
  mudanca_supervisor:  { label: 'Mudança Supervisor',  className: 'bg-purple-50 text-purple-700 ring-purple-200'   },
  alteracao_salario:   { label: 'Alteração Salarial',  className: 'bg-amber-50 text-amber-700 ring-amber-200'     },
  afastamento:         { label: 'Afastamento',         className: 'bg-orange-50 text-orange-700 ring-orange-200'  },
  retorno_afastamento: { label: 'Retorno Afastamento', className: 'bg-teal-50 text-teal-700 ring-teal-200'        },
  rescisao_indireta:   { label: 'Rescisão Indireta',   className: 'bg-rose-50 text-rose-700 ring-rose-200'        },
  admissao:            { label: 'Admissão',            className: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
}
```
ganha, logo antes do `}` de fechamento:
```ts
  admissao:            { label: 'Admissão',            className: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  mudanca_horario:     { label: 'Mudança Horário',      className: 'bg-cyan-50 text-cyan-700 ring-cyan-200'          },
}
```

Não é preciso mexer em `app/(admin)/auditoria/page.tsx` — o dicionário de lá (`TIPO_LABEL`) é tipado como `Record<string, ...>`, não `Record<TipoSolicitacao, ...>`, então não é exaustivo e não quebra a build (fica sem essa entrada específica, cosmético, fora de escopo).

- [ ] **Step 3: Rodar type-check**

```bash
npx tsc --noEmit
```
Expected: sem erros.

- [ ] **Step 4: Adicionar `solicitarMudancaHorario` em `app/(admin)/efetivo/actions.ts`**

Ao final do arquivo (após `excluirFuncionarioCompleto`), adicionar:

```ts

export async function solicitarMudancaHorario(formData: FormData): Promise<ActionResult> {
  const supabase = createClient()
  const auth = await getUser()
  if (!auth) return { success: false, error: 'Não autenticado' }

  const funcionarioId   = formData.get('funcionario_id') as string
  const turnoDestinoId  = formData.get('turno_destino_id') as string
  const diaCursoDestino = formData.get('dia_curso_destino') ? Number(formData.get('dia_curso_destino')) : null

  if (!turnoDestinoId) return { success: false, error: 'Selecione o turno de destino' }

  const { data: vigente } = await supabase
    .from('horarios_funcionarios')
    .select('turno_id, turnos_postos!turno_id(nome)')
    .eq('funcionario_id', funcionarioId)
    .is('data_fim', null)
    .maybeSingle()

  const vigenteTyped = vigente as unknown as { turno_id: string; turnos_postos: { nome: string } | null } | null

  const { data: turnoNovo } = await supabase
    .from('turnos_postos')
    .select('nome')
    .eq('id', turnoDestinoId)
    .single()

  const { error } = await supabase.from('solicitacoes').insert({
    tipo:           'mudanca_horario' as unknown as 'desligamento',
    status:         'pendente',
    funcionario_id: funcionarioId,
    supervisor_id:  auth.user.id,
    dados_antes: {
      turno_atual_id:   vigenteTyped?.turno_id ?? null,
      turno_atual_nome: vigenteTyped?.turnos_postos?.nome ?? null,
    },
    dados_depois: {
      turno_destino_id:   turnoDestinoId,
      turno_destino_nome: turnoNovo?.nome ?? null,
      ...(diaCursoDestino ? { dia_curso_destino: diaCursoDestino } : {}),
    },
  })
  if (error) return { success: false, error: error.message }

  revalidatePath('/efetivo')
  revalidatePath('/aprovacoes')
  return { success: true }
}
```

(`tipo: 'mudanca_horario' as unknown as 'desligamento'` reaproveita o mesmo truque de cast já usado em `solicitarAfastamento`/`solicitarRetornoAfastamento` neste arquivo — os tipos gerados de `solicitacoes.tipo` em `types/database.ts` não são regenerados automaticamente a cada migração de CHECK constraint, então o cast contorna isso sem precisar rodar codegen.)

- [ ] **Step 5: Rodar type-check e build**

```bash
npx tsc --noEmit
npm run build
```
Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
git add types/index.ts "app/(admin)/efetivo/actions.ts" "app/(admin)/aprovacoes/page.tsx" components/aprovacoes/aprovacoes-list.tsx
git commit -m "feat(efetivo): tipo e server action de solicitacao de mudanca de horario"
```

---

## Task 3: Aprovação — aplica a mudança de horário

**Files:**
- Modify: `app/(admin)/aprovacoes/actions.ts`

- [ ] **Step 1: Adicionar o `case 'mudanca_horario'`**

Localizar o `case 'retorno_afastamento': { ... break }` (por volta da linha 243-268):
```ts
    case 'retorno_afastamento': {
      const postoRetornoId = (dadosDepois.posto_retorno_id as string | undefined) ?? func?.posto_id ?? null
      const { error: errRetorno } = await adminSupabase
        .from('funcionarios')
        .update({ status: 'ativo', posto_id: postoRetornoId })
        .eq('id', funcionarioId)
      if (errRetorno) return { success: false, error: errRetorno.message }
      await supabase
        .from('afastamentos')
        .update({ data_fim_real: dadosDepois.data_retorno as string })
        .eq('funcionario_id', funcionarioId)
        .is('data_fim_real', null)

      // Função não muda nesse fluxo — passar jovemAtual nos dois lados propositalmente;
      // só o posto varia aqui.
      if (precisaNovoTurno(func?.posto_id ?? null, postoRetornoId, jovemAtual, jovemAtual)) {
        await aplicarMudancaHorario(
          funcionarioId,
          (dadosDepois.turno_destino_id as string | undefined) ?? null,
          (dadosDepois.dia_curso_destino as number | undefined) ?? null,
          hojeISO,
          guard.userId,
        )
      }
      break
    }
```

Adicionar logo após (antes do próximo `case 'rescisao_indireta':`):
```ts

    case 'mudanca_horario': {
      // Esta solicitação só existe para trocar o turno — não passa por precisaNovoTurno
      // (posto e função não mudam aqui, então essa regra sempre daria "false"). A troca
      // sempre se aplica. aplicarMudancaHorario já registra a movimentação de turno
      // sozinha, então este case sai cedo (return) em vez de "break" — pulando o insert
      // genérico de movimentacoes no final da função, que criaria uma segunda entrada
      // vazia/duplicada (essa solicitação não tem campo em campoMap, já que não altera
      // posto_id/funcao_id/status em funcionarios).
      await aplicarMudancaHorario(
        funcionarioId,
        (dadosDepois.turno_destino_id as string | undefined) ?? null,
        (dadosDepois.dia_curso_destino as number | undefined) ?? null,
        hojeISO,
        guard.userId,
      )

      await supabase
        .from('solicitacoes')
        .update({
          status:           'aprovada',
          aprovado_por:     guard.userId,
          aprovado_em:      new Date().toISOString(),
          observacao_admin: observacao ?? null,
        })
        .eq('id', id)

      revalidatePath('/aprovacoes')
      revalidatePath('/efetivo')
      revalidatePath('/dashboard')

      return { success: true }
    }
```

**Importante:** este `case` usa `return`, não `break` — é o mesmo padrão já usado pelo `case 'admissao'` mais abaixo no arquivo (que também sai cedo pulando o bloco genérico de `movimentacoes`/`campoMap` no final da função). Não adicionar entrada em `campoMap` para `mudanca_horario` — ela não precisa, porque esse `case` nunca alcança o código que lê `campoMap`.

- [ ] **Step 2: Rodar type-check e build**

```bash
npx tsc --noEmit
npm run build
```
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add "app/(admin)/aprovacoes/actions.ts"
git commit -m "feat(aprovacoes): aplica mudanca de horario ao aprovar solicitacao dedicada"
```

---

## Task 4: UI — seletor de turno na solicitação de mudança de horário

**Files:**
- Modify: `components/efetivo/modal-nova-solicitacao.tsx`

- [ ] **Step 1: Adicionar o tipo à lista local, label e disponibilidade por status**

Esta linha (por volta da linha 31-36):
```ts
type TipoSolicitacao =
  | 'desligamento'
  | 'transferencia'
  | 'mudanca_funcao'
  | 'retorno_afastamento'
  | 'rescisao_indireta'
```
vira:
```ts
type TipoSolicitacao =
  | 'desligamento'
  | 'transferencia'
  | 'mudanca_funcao'
  | 'retorno_afastamento'
  | 'rescisao_indireta'
  | 'mudanca_horario'
```

Esta linha (por volta da linha 46-52):
```ts
const TIPO_LABELS: Record<TipoSolicitacao, string> = {
  desligamento:        '🔴 Desligamento',
  transferencia:       '🔀 Transferência',
  mudanca_funcao:      '🔄 Mudança de Função',
  retorno_afastamento: '🔙 Retorno de Afastamento',
  rescisao_indireta:   '⚠️ Rescisão Indireta',
}
```
vira:
```ts
const TIPO_LABELS: Record<TipoSolicitacao, string> = {
  desligamento:        '🔴 Desligamento',
  transferencia:       '🔀 Transferência',
  mudanca_funcao:      '🔄 Mudança de Função',
  retorno_afastamento: '🔙 Retorno de Afastamento',
  rescisao_indireta:   '⚠️ Rescisão Indireta',
  mudanca_horario:     '🕐 Mudança de Horário',
}
```

Esta linha (por volta da linha 54-58):
```ts
const TIPOS_POR_STATUS: Partial<Record<string, TipoSolicitacao[]>> = {
  ativo:    ['transferencia', 'mudanca_funcao', 'desligamento', 'rescisao_indireta'],
  afastado: ['retorno_afastamento', 'desligamento'],
  default:  ['desligamento'],
}
```
vira:
```ts
const TIPOS_POR_STATUS: Partial<Record<string, TipoSolicitacao[]>> = {
  ativo:    ['transferencia', 'mudanca_funcao', 'mudanca_horario', 'desligamento', 'rescisao_indireta'],
  afastado: ['retorno_afastamento', 'desligamento'],
  default:  ['desligamento'],
}
```

- [ ] **Step 2: Importar a Server Action nova**

Esta linha (topo do arquivo):
```ts
import {
  solicitarDesligamento,
  solicitarTransferencia,
  solicitarMudancaFuncao,
  solicitarRetornoAfastamento,
  solicitarRescisaoIndireta,
} from '@/app/(admin)/efetivo/actions'
```
vira:
```ts
import {
  solicitarDesligamento,
  solicitarTransferencia,
  solicitarMudancaFuncao,
  solicitarRetornoAfastamento,
  solicitarRescisaoIndireta,
  solicitarMudancaHorario,
} from '@/app/(admin)/efetivo/actions'
```

- [ ] **Step 3: Forçar `precisaTurno = true` para este tipo**

Esta linha (por volta da linha 149-151):
```ts
  const precisaTurno = condicaoAtendida
    ? precisaNovoTurno(funcionario.posto_id, postoDestinoIdAtual(), jovemAtual, jovemNovo)
    : false
```
vira:
```ts
  // mudanca_horario sempre precisa de turno — é o próprio propósito do pedido,
  // não uma consequência de posto/função terem mudado (que aqui nunca mudam).
  const precisaTurno = tipo === 'mudanca_horario'
    ? true
    : condicaoAtendida
      ? precisaNovoTurno(funcionario.posto_id, postoDestinoIdAtual(), jovemAtual, jovemNovo)
      : false
```

Nenhuma mudança necessária em `postoDestinoIdAtual()` nem em `funcaoDestinoNomeAtual()` — ambas já retornam o posto/função atuais do funcionário (`funcionario.posto_id` / `funcaoAtualNome`) para qualquer `tipo` que não seja `transferencia`/`mudanca_funcao`/`retorno_afastamento`, o que já cobre `mudanca_horario` corretamente (posto e função não mudam nesse fluxo).

- [ ] **Step 4: Validação de submit — bloquear se não houver turno cadastrado**

Esta linha (dentro de `handleSubmit`, por volta da linha 219-230):
```ts
    if (!tipo) return
    setErro(null)
    if (precisaTurno && turnoOpcoes.length > 0 && !turnoDestinoId) {
      setErro('Selecione o turno de destino')
      return
    }
    if (precisaTurno && jovemNovo && turnoDestinoId && !diaCursoDestino) {
      setErro('Selecione o dia de curso')
      return
    }
    const fd = new FormData(e.currentTarget)
```
vira:
```ts
    if (!tipo) return
    setErro(null)
    if (tipo === 'mudanca_horario' && !loadingTurnos && turnoOpcoes.length === 0) {
      setErro('Nenhum turno cadastrado para este destino — cadastre um turno antes de solicitar')
      return
    }
    if (precisaTurno && turnoOpcoes.length > 0 && !turnoDestinoId) {
      setErro('Selecione o turno de destino')
      return
    }
    if (precisaTurno && jovemNovo && turnoDestinoId && !diaCursoDestino) {
      setErro('Selecione o dia de curso')
      return
    }
    const fd = new FormData(e.currentTarget)
```

- [ ] **Step 5: Despachar a Server Action nova**

Esta linha (por volta da linha 236-241):
```ts
      if (tipo === 'desligamento')             result = await solicitarDesligamento(fd)
      else if (tipo === 'transferencia')       result = await solicitarTransferencia(fd)
      else if (tipo === 'mudanca_funcao')      result = await solicitarMudancaFuncao(fd)
      else if (tipo === 'retorno_afastamento') result = await solicitarRetornoAfastamento(fd)
      else if (tipo === 'rescisao_indireta')   result = await solicitarRescisaoIndireta(fd)
      else return
```
vira:
```ts
      if (tipo === 'desligamento')             result = await solicitarDesligamento(fd)
      else if (tipo === 'transferencia')       result = await solicitarTransferencia(fd)
      else if (tipo === 'mudanca_funcao')      result = await solicitarMudancaFuncao(fd)
      else if (tipo === 'retorno_afastamento') result = await solicitarRetornoAfastamento(fd)
      else if (tipo === 'rescisao_indireta')   result = await solicitarRescisaoIndireta(fd)
      else if (tipo === 'mudanca_horario')     result = await solicitarMudancaHorario(fd)
      else return
```

- [ ] **Step 6: Bloco de UI — sempre visível, sem painel de impacto**

Localizar o fim do bloco `{tipo === 'rescisao_indireta' && (...)}` (o último bloco de tipo antes de `{erro && (...)}`). Inserir um novo bloco logo depois (a ordem entre blocos de tipo não importa, já que só um é exibido por vez via a condicional):

```tsx
            {/* mudanca_horario */}
            {tipo === 'mudanca_horario' && (
              <div className="space-y-3 rounded border border-blue-200 bg-blue-50 px-4 py-3">
                <p className="text-sm font-semibold text-blue-800">Novo turno de trabalho</p>
                {loadingTurnos ? (
                  <p className="text-xs text-blue-600">Carregando turnos…</p>
                ) : turnoOpcoes.length === 0 ? (
                  <p className="text-xs text-red-700">
                    Nenhum turno cadastrado para {jovemNovo ? 'jovem aprendiz' : 'este posto'}. Cadastre um turno antes de solicitar a mudança.
                  </p>
                ) : (
                  <>
                    <div>
                      <label className={labelClass}>Turno</label>
                      <select name="turno_destino_id" required value={turnoDestinoId}
                        onChange={e => setTurnoDestinoId(e.target.value)} className={inputClass}>
                        <option value="">Selecione…</option>
                        {turnoOpcoes.map(t => (
                          <option key={t.id} value={t.id}>{t.nome} — {formatarResumoTurno(t)}</option>
                        ))}
                      </select>
                    </div>
                    {jovemNovo && (
                      <div>
                        <label className={labelClass}>Dia de curso</label>
                        <select name="dia_curso_destino" required value={diaCursoDestino}
                          onChange={e => setDiaCursoDestino(e.target.value ? Number(e.target.value) : '')}
                          className={inputClass}>
                          <option value="">Selecione…</option>
                          <option value={1}>Segunda</option>
                          <option value={2}>Terça</option>
                          <option value={3}>Quarta</option>
                          <option value={4}>Quinta</option>
                          <option value={5}>Sexta</option>
                        </select>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
```

- [ ] **Step 7: Rodar build**

```bash
npm run build
```
Expected: sem erros. Prestar atenção a JSX desbalanceado, igual nas edições anteriores desse arquivo.

- [ ] **Step 8: Verificação manual no browser**

Perfil de um funcionário ativo (não jovem aprendiz) → "Nova Solicitação" → Tipo "Mudança de Horário" → confirmar que o seletor de turno aparece imediatamente (sem precisar marcar mais nada), lista os turnos do posto atual do funcionário, bloqueia envio sem turno escolhido. Enviar → aprovar em `/aprovacoes` → conferir na aba Horário do perfil que o turno mudou, histórico registrou o antigo, e não apareceu nenhuma entrada vazia/duplicada em Movimentações. Repetir com um funcionário Jovem Aprendiz → confirmar que a lista vem dos turnos globais (Manhã/Tarde) e o campo "Dia de curso" aparece e é obrigatório.

- [ ] **Step 9: Commit**

```bash
git add components/efetivo/modal-nova-solicitacao.tsx
git commit -m "feat(efetivo): solicitacao de mudanca de horario dentro do mesmo posto"
```

---

## Task 5: Excel do Efetivo — colunas de horário coloridas por regime

**Files:**
- Modify: `components/efetivo/funcionarios-table.tsx`
- Modify: `app/(admin)/efetivo/page.tsx`
- Modify: `components/efetivo/efetivo-client.tsx`

- [ ] **Step 1: Adicionar campos opcionais em `FuncionarioRow`**

Esta linha (em `components/efetivo/funcionarios-table.tsx`, por volta da linha 34-36):
```ts
  supervisor_nome?: string | null
  supervisor_id?: string | null
}
```
vira:
```ts
  supervisor_nome?: string | null
  supervisor_id?: string | null
  turno_atual_nome?:   string | null
  turno_atual_regime?: string | null
  turno_atual_resumo?: string | null
}
```

- [ ] **Step 2: Rodar type-check**

```bash
npx tsc --noEmit
```
Expected: sem erros (campos opcionais não quebram nada que já usa `FuncionarioRow`).

- [ ] **Step 3: Commit**

```bash
git add components/efetivo/funcionarios-table.tsx
git commit -m "feat(efetivo): campos de turno atual em FuncionarioRow"
```

- [ ] **Step 4: Buscar o horário vigente de todos os funcionários em `app/(admin)/efetivo/page.tsx`**

Import — esta linha:
```ts
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getUser } from '@/lib/auth/get-user'
import { EfetivoClient } from '@/components/efetivo/efetivo-client'
import type { FuncionarioRow } from '@/components/efetivo/funcionarios-table'
import { processarRetornosAtestado } from '@/lib/processar-retornos'
import { encerrarCoberturasVencidas } from '@/app/(admin)/coberturas/actions'
```
vira:
```ts
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getUser } from '@/lib/auth/get-user'
import { EfetivoClient } from '@/components/efetivo/efetivo-client'
import type { FuncionarioRow } from '@/components/efetivo/funcionarios-table'
import { processarRetornosAtestado } from '@/lib/processar-retornos'
import { encerrarCoberturasVencidas } from '@/app/(admin)/coberturas/actions'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import { resolverTipoEscala, formatarResumoTurno } from '@/lib/turnos/escala'
```

Nova busca — adicionar logo após o bloco `const { data: faltasRaw } = ...` (por volta da linha 128-139, depois do fechamento do `for` que popula `faltasAtivas`) e antes do comentário `// Coberturas ativas hoje`:
```ts

  // Horário vigente de todos os funcionários (para o Excel) — sem filtro de IDs
  // para evitar URL enorme com até ~1500 UUIDs; pagina além do limite de 1000
  // linhas do PostgREST via fetchAllRows.
  type HorarioVigenteRow = {
    funcionario_id: string
    turnos_postos: {
      nome: string
      tipo_escala: string
      hora_entrada: string
      hora_saida_seg_qui: string
      hora_saida_sex: string | null
      hora_inicio_almoco: string | null
      hora_fim_almoco: string | null
    } | null
  }
  const horariosVigentes = await fetchAllRows<HorarioVigenteRow>((from, to) =>
    supabase
      .from('horarios_funcionarios')
      .select('funcionario_id, turnos_postos!turno_id(nome, tipo_escala, hora_entrada, hora_saida_seg_qui, hora_saida_sex, hora_inicio_almoco, hora_fim_almoco)')
      .is('data_fim', null)
      .range(from, to) as unknown as PromiseLike<{ data: HorarioVigenteRow[] | null; error: { message: string } | null }>,
  )
  const horarioMap = new Map<string, { nome: string; regime: string; resumo: string }>()
  for (const h of horariosVigentes) {
    if (!h.turnos_postos) continue
    horarioMap.set(h.funcionario_id, {
      nome:   h.turnos_postos.nome,
      regime: resolverTipoEscala(h.turnos_postos.tipo_escala),
      resumo: formatarResumoTurno(h.turnos_postos),
    })
  }
```

Merge no `funcionarios` — esta linha (por volta da linha 156-165):
```ts
  // Enrich ALL funcionarios with supervisor_nome + supervisor_id + origem_ocupacional_cat
  const funcionarios = rawFuncs.map(f => {
    const sup = f.posto_id ? postoSupervisorMap.get(f.posto_id) : undefined
    return {
      ...f,
      supervisor_nome:        sup?.nomeCompleto ?? null,
      supervisor_id:          sup?.id ?? null,
      origem_ocupacional_cat: catOrigemMap.get(f.id) ?? null,
    }
  })
```
vira:
```ts
  // Enrich ALL funcionarios with supervisor_nome + supervisor_id + origem_ocupacional_cat + turno_atual
  const funcionarios = rawFuncs.map(f => {
    const sup = f.posto_id ? postoSupervisorMap.get(f.posto_id) : undefined
    const horario = horarioMap.get(f.id)
    return {
      ...f,
      supervisor_nome:        sup?.nomeCompleto ?? null,
      supervisor_id:          sup?.id ?? null,
      origem_ocupacional_cat: catOrigemMap.get(f.id) ?? null,
      turno_atual_nome:       horario?.nome ?? null,
      turno_atual_regime:     horario?.regime ?? null,
      turno_atual_resumo:     horario?.resumo ?? null,
    }
  })
```

- [ ] **Step 5: Rodar type-check e build**

```bash
npx tsc --noEmit
npm run build
```
Expected: sem erros. Se `fetchAllRows` reclamar de tipo do `supabase.from(...).select(...).is(...).range(...)` não bater com `QueryFactory<T>`, o cast `as unknown as PromiseLike<...>` já incluído no Step 4 resolve — é o mesmo padrão de cast usado em outras queries deste arquivo (ex.: `AnyQ`).

- [ ] **Step 6: Commit**

```bash
git add "app/(admin)/efetivo/page.tsx"
git commit -m "feat(efetivo): busca horario vigente de todos os funcionarios para o excel"
```

- [ ] **Step 7: Adicionar colunas coloridas no Excel — `components/efetivo/efetivo-client.tsx`**

Esta linha (por volta da linha 20-26, ao lado de `STATUS_COLORS`):
```ts
const STATUS_COLORS: Record<string, { fill: string; color: string }> = {
  ativo:             { fill: 'F0FDF4', color: '15803D' },
  afastado:          { fill: 'FFF1F2', color: 'B91C1C' },
  ferias:            { fill: 'FFF7ED', color: 'C2410C' },
  desligado:         { fill: 'F3F4F6', color: '6B7280' },
  rescisao_indireta: { fill: 'FAF5FF', color: '7E22CE' },
}
```
vira (adiciona a constante de cor por regime logo abaixo):
```ts
const STATUS_COLORS: Record<string, { fill: string; color: string }> = {
  ativo:             { fill: 'F0FDF4', color: '15803D' },
  afastado:          { fill: 'FFF1F2', color: 'B91C1C' },
  ferias:            { fill: 'FFF7ED', color: 'C2410C' },
  desligado:         { fill: 'F3F4F6', color: '6B7280' },
  rescisao_indireta: { fill: 'FAF5FF', color: '7E22CE' },
}

const REGIME_COLORS: Record<string, { fill: string; color: string }> = {
  '5x2':            { fill: 'EFF6FF', color: '1D4ED8' },
  '5x1':            { fill: 'FAF5FF', color: '7E22CE' },
  '12x36':          { fill: 'FFF7ED', color: 'C2410C' },
  'jovem_aprendiz':  { fill: 'F0FDFA', color: '0F766E' },
}
```

Esta linha (dentro de `handleExport`, por volta da linha 132-149):
```ts
  function handleExport() {
    exportToExcel(
      sorted,
      [
        { label: 'Registro',   value: r => r.registro ?? '', asText: true },
        { label: 'Nome',       value: r => r.nome },
        { label: 'Função',     value: r => r.funcoes?.nome ?? '' },
        { label: 'Posto',      value: r => r.postos?.nome ?? '' },
        { label: 'Secretaria', value: r => r.postos?.secretaria ?? '' },
        { label: 'Supervisor', value: r => r.supervisor_nome ?? '' },
        {
          label: 'Status',
          value: r => STATUS_LABELS[r.status ?? ''] ?? '',
          cellStyle: r => STATUS_COLORS[r.status ?? ''],
        },
      ],
      todayFilename(),
    )
  }
```
vira:
```ts
  function handleExport() {
    exportToExcel(
      sorted,
      [
        { label: 'Registro',   value: r => r.registro ?? '', asText: true },
        { label: 'Nome',       value: r => r.nome },
        { label: 'Função',     value: r => r.funcoes?.nome ?? '' },
        { label: 'Posto',      value: r => r.postos?.nome ?? '' },
        { label: 'Secretaria', value: r => r.postos?.secretaria ?? '' },
        { label: 'Supervisor', value: r => r.supervisor_nome ?? '' },
        {
          label: 'Status',
          value: r => STATUS_LABELS[r.status ?? ''] ?? '',
          cellStyle: r => STATUS_COLORS[r.status ?? ''],
        },
        { label: 'Turno',    value: r => r.turno_atual_nome ?? '' },
        {
          label: 'Horário',
          value: r => r.turno_atual_resumo ?? '',
          cellStyle: r => r.turno_atual_regime ? REGIME_COLORS[r.turno_atual_regime] : undefined,
        },
      ],
      todayFilename(),
    )
  }
```

- [ ] **Step 8: Rodar build**

```bash
npm run build
```
Expected: sem erros.

- [ ] **Step 9: Verificação manual no browser**

Efetivo → "Exportar Excel" → abrir o arquivo gerado → conferir colunas "Turno" e "Horário" presentes, células coloridas conforme o regime de cada funcionário (azul/roxo/laranja/verde-água), funcionários sem horário atribuído com célula "Horário" em branco (sem cor).

- [ ] **Step 10: Commit**

```bash
git add components/efetivo/efetivo-client.tsx
git commit -m "feat(efetivo): colunas de turno e horario coloridas por regime no excel"
```

---

## Task 6: Build final + push do branch de teste

**Files:** nenhum (verificação + git).

- [ ] **Step 1: Type-check e build completos**

```bash
npx tsc --noEmit
npm run build
```
Expected: sem erros em nenhum arquivo tocado neste plano.

- [ ] **Step 2: Conferir working tree limpo**

```bash
git status --short
```
Expected: sem saída.

- [ ] **Step 3: Push (atualiza o mesmo Preview Deployment já existente no Vercel)**

```bash
git push origin feature/turnos-padrao-e-horario
```

- [ ] **Step 4: Reportar ao usuário**

Passar a lista dos itens novos pra validar no preview (solicitação de mudança de horário — casos normal e jovem aprendiz — e o Excel colorido), e lembrar que a migração SQL (Task 1) precisa estar aplicada no banco usado pelo preview antes do Bloco D funcionar. Merge em `master` e deploy de produção continuam pendentes de confirmação explícita do usuário, junto com os Blocos A/B/C já validados anteriormente.
