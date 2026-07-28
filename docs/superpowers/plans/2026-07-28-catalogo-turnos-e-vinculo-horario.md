# Catálogo de turnos-padrão + atribuição em lote + vínculo automático de horário — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Acelerar o cadastro de turnos por posto e a atribuição de horário aos funcionários, e eliminar o bug em que o horário de um funcionário fica órfão (apontando para turno de outro posto/regime) após transferência, mudança de função ou retorno de afastamento.

**Architecture:** Três blocos independentes na camada de UI + Server Actions do App Router, sem migração de banco. Bloco A é um atalho estático de preenchimento no modal de turnos do posto. Bloco B é uma tela de lote nova (modal) que reaproveita a regra de troca de turno já existente (`alterarTurno`). Bloco C amarra a escolha do novo turno na criação da solicitação (supervisor) e aplica automaticamente na aprovação (admin), via uma regra central `precisaNovoTurno` + um helper `aplicarMudancaHorario`.

**Tech Stack:** Next.js 14 App Router, Server Actions, Supabase (`createClient()` síncrono), TypeScript, Tailwind. Sem framework de testes no projeto — verificação é `npx tsc --noEmit` + `npm run build` + checagem manual no browser (dev server), por instrução do `CLAUDE.md` do projeto.

**Branch:** todo o trabalho é feito em uma branch de teste, commitada e enviada ao GitHub para gerar Preview Deployment no Vercel. Só depois de validado no preview é que a branch é mesclada em `master`.

---

## Task 0: Criar branch de teste

**Files:** nenhum (operação git).

- [ ] **Step 1: Confirmar working tree limpo**

```bash
git status --short
```
Expected: sem saída (nenhuma mudança pendente). Se houver algo, parar e perguntar ao usuário antes de prosseguir.

- [ ] **Step 2: Criar e mudar para a branch de teste**

```bash
git checkout -b feature/turnos-padrao-e-horario
```
Expected: `Switched to a new branch 'feature/turnos-padrao-e-horario'`

---

## Task 1: Catálogo de turnos-padrão (Bloco A)

**Files:**
- Create: `lib/turnos/catalogo-padrao.ts`
- Modify: `components/postos/modal-turnos-posto.tsx`

- [ ] **Step 1: Criar o arquivo de catálogo**

```ts
// lib/turnos/catalogo-padrao.ts

export interface TurnoCatalogoItem {
  nome: string
  hora_entrada: string
  hora_inicio_almoco: string | null
  hora_fim_almoco: string | null
  hora_saida_seg_qui: string
  hora_saida_sex: string | null
}

export const CATALOGO_5X2: TurnoCatalogoItem[] = [
  { nome: 'Turno 6h 30m (a)', hora_entrada: '06:30', hora_inicio_almoco: '12:00', hora_fim_almoco: '13:00', hora_saida_seg_qui: '16:18', hora_saida_sex: '16:18' },
  { nome: 'Turno 6h 30m (b)', hora_entrada: '06:30', hora_inicio_almoco: '11:00', hora_fim_almoco: '12:00', hora_saida_seg_qui: '16:18', hora_saida_sex: '16:18' },
  { nome: 'Turno 6h 30m (c)', hora_entrada: '06:30', hora_inicio_almoco: '10:15', hora_fim_almoco: '11:15', hora_saida_seg_qui: '16:30', hora_saida_sex: '16:30' },
  { nome: 'Turno 6h 30m (d)', hora_entrada: '06:30', hora_inicio_almoco: '11:30', hora_fim_almoco: '13:00', hora_saida_seg_qui: '16:30', hora_saida_sex: '15:30' },
  { nome: 'Turno 7h (a)',     hora_entrada: '07:00', hora_inicio_almoco: '12:00', hora_fim_almoco: '13:00', hora_saida_seg_qui: '17:00', hora_saida_sex: '16:00' },
  { nome: 'Turno 7h (b)',     hora_entrada: '07:00', hora_inicio_almoco: '13:00', hora_fim_almoco: '14:00', hora_saida_seg_qui: '17:00', hora_saida_sex: '16:00' },
  { nome: 'Turno 7h (c)',     hora_entrada: '07:00', hora_inicio_almoco: '12:00', hora_fim_almoco: '13:12', hora_saida_seg_qui: '17:00', hora_saida_sex: '17:00' },
  { nome: 'Turno 7h (d)',     hora_entrada: '07:00', hora_inicio_almoco: '13:00', hora_fim_almoco: '14:12', hora_saida_seg_qui: '17:00', hora_saida_sex: '17:00' },
  { nome: 'Turno 7h 12m (a)', hora_entrada: '07:12', hora_inicio_almoco: '12:00', hora_fim_almoco: '13:00', hora_saida_seg_qui: '17:00', hora_saida_sex: '17:00' },
  { nome: 'Turno 7h 12m (b)', hora_entrada: '07:12', hora_inicio_almoco: '13:00', hora_fim_almoco: '14:00', hora_saida_seg_qui: '17:00', hora_saida_sex: '17:00' },
  { nome: 'Turno 7h 12m (c)', hora_entrada: '07:12', hora_inicio_almoco: '12:30', hora_fim_almoco: '13:30', hora_saida_seg_qui: '17:00', hora_saida_sex: '17:00' },
  { nome: 'Turno 8h (a)',     hora_entrada: '08:00', hora_inicio_almoco: '11:00', hora_fim_almoco: '12:00', hora_saida_seg_qui: '18:00', hora_saida_sex: '18:00' },
  { nome: 'Turno 8h (b)',     hora_entrada: '08:00', hora_inicio_almoco: '12:15', hora_fim_almoco: '13:15', hora_saida_seg_qui: '18:00', hora_saida_sex: '17:00' },
  { nome: 'Turno 8h (c)',     hora_entrada: '08:00', hora_inicio_almoco: '12:30', hora_fim_almoco: '13:30', hora_saida_seg_qui: '18:00', hora_saida_sex: '18:00' },
  { nome: 'Turno 8h 12m',     hora_entrada: '08:12', hora_inicio_almoco: '13:00', hora_fim_almoco: '14:00', hora_saida_seg_qui: '18:00', hora_saida_sex: '18:00' },
]

export const CATALOGO_5X1: TurnoCatalogoItem[] = [
  { nome: 'Turno 6h (a)',     hora_entrada: '06:00', hora_inicio_almoco: '12:00', hora_fim_almoco: '13:00', hora_saida_seg_qui: '14:20', hora_saida_sex: null },
  { nome: 'Turno 6h (b)',     hora_entrada: '06:00', hora_inicio_almoco: '11:00', hora_fim_almoco: '12:00', hora_saida_seg_qui: '14:20', hora_saida_sex: null },
  { nome: 'Turno 13h 40m',    hora_entrada: '13:40', hora_inicio_almoco: '18:00', hora_fim_almoco: '19:00', hora_saida_seg_qui: '22:00', hora_saida_sex: null },
  { nome: 'Turno 14h 40m',    hora_entrada: '14:40', hora_inicio_almoco: '19:00', hora_fim_almoco: '20:00', hora_saida_seg_qui: '23:00', hora_saida_sex: null },
]

/** Catálogo de turnos-padrão por regime. Só existe para 5x2 e 5x1 — 12x36 e jovem_aprendiz continuam com preenchimento livre. */
export const CATALOGO_POR_REGIME: Partial<Record<string, TurnoCatalogoItem[]>> = {
  '5x2': CATALOGO_5X2,
  '5x1': CATALOGO_5X1,
}
```

- [ ] **Step 2: Rodar type-check para confirmar que o arquivo novo compila sozinho**

```bash
npx tsc --noEmit
```
Expected: sem erros relacionados a `lib/turnos/catalogo-padrao.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/turnos/catalogo-padrao.ts
git commit -m "feat(turnos): catalogo de turnos-padrao 5x2/5x1"
```

- [ ] **Step 4: Adicionar o import no modal de turnos do posto**

Modificar `components/postos/modal-turnos-posto.tsx` — no bloco de imports do topo:

```ts
import { cn } from '@/lib/utils'
import type { TurnoPosto } from '@/types'
```

vira:

```ts
import { cn } from '@/lib/utils'
import type { TurnoPosto } from '@/types'
import { CATALOGO_POR_REGIME, type TurnoCatalogoItem } from '@/lib/turnos/catalogo-padrao'
```

- [ ] **Step 5: Adicionar estado do painel de catálogo**

Logo abaixo da linha `const [personalizando, setPersonalizando]     = useState(false)` (dentro do bloco "form fields"), adicionar:

```ts
  const [catalogoAberto, setCatalogoAberto]     = useState(true)
```

- [ ] **Step 6: Aplicar item do catálogo ao formulário**

Adicionar esta função logo após `function restaurarHorariosPadrao() { ... }`:

```ts
  function aplicarItemCatalogo(item: TurnoCatalogoItem) {
    setNome(item.nome)
    setHoraEntrada(item.hora_entrada)
    setHoraInicioAlmoco(item.hora_inicio_almoco ?? '')
    setHoraFimAlmoco(item.hora_fim_almoco ?? '')
    setHoraSaidaSegQui(item.hora_saida_seg_qui)
    setHoraSaidaSex(item.hora_saida_sex ?? '')
    setAlmocoTocado(true)
    setSaidaTocado(true)
    setCatalogoAberto(false)
  }
```

- [ ] **Step 7: Resetar o painel do catálogo ao abrir "Novo turno"**

Em `function abrirNovo() { ... }`, dentro do corpo existente:

```ts
  function abrirNovo() {
    if (!regime) return
    setForm('novo')
    setNome('')
    setHoraEntrada('07:00')
    setAlmocoTocado(false)
    setSaidaTocado(false)
    setPersonalizando(false)
    setErro(null)
  }
```

vira (adiciona a linha `setCatalogoAberto(true)`):

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
    setErro(null)
  }
```

- [ ] **Step 8: Renderizar a lista do catálogo no formulário**

Localizar este bloco (dentro do form de novo/editar turno, logo após o `<div className="grid grid-cols-2 gap-3">` de Nome/Hora de entrada e antes do comentário `{/* almoço/saída: ... */}`):

```tsx
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-500">Nome</label>
                  <input value={nome} onChange={e => setNome(e.target.value)}
                    placeholder="Ex: Turno 7h"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-500">Horário de entrada</label>
                  <input
                    type="time"
                    value={horaEntrada}
                    onChange={e => setHoraEntrada(e.target.value)}
                    min={tipoEscalaForm === '5x1' ? '05:00' : undefined}
                    max={tipoEscalaForm === '5x1' ? '16:00' : undefined}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400" />
                </div>
              </div>

              {/* almoço/saída: resumo calculado por padrão; "Personalizar" libera edição livre por campo */}
```

Substituir por (insere o painel de catálogo entre os dois blocos, só quando `form === 'novo'` e existe catálogo para o regime):

```tsx
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-500">Nome</label>
                  <input value={nome} onChange={e => setNome(e.target.value)}
                    placeholder="Ex: Turno 7h"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-500">Horário de entrada</label>
                  <input
                    type="time"
                    value={horaEntrada}
                    onChange={e => setHoraEntrada(e.target.value)}
                    min={tipoEscalaForm === '5x1' ? '05:00' : undefined}
                    max={tipoEscalaForm === '5x1' ? '16:00' : undefined}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400" />
                </div>
              </div>

              {form === 'novo' && tipoEscalaForm && CATALOGO_POR_REGIME[tipoEscalaForm] && (
                <div className="rounded-lg border border-gray-100 bg-slate-50 p-3">
                  <button type="button" onClick={() => setCatalogoAberto(p => !p)}
                    className="flex w-full items-center justify-between text-xs font-semibold uppercase tracking-widest text-gray-500">
                    Usar turno padrão
                    <span className="text-gray-400">{catalogoAberto ? '▲' : '▼'}</span>
                  </button>
                  {catalogoAberto && (
                    <div className="mt-2 max-h-48 space-y-1 overflow-y-auto">
                      {CATALOGO_POR_REGIME[tipoEscalaForm]!.map(item => (
                        <button key={item.nome} type="button" onClick={() => aplicarItemCatalogo(item)}
                          className="flex w-full items-center justify-between rounded-md border border-transparent px-2 py-1.5 text-left text-xs hover:border-gray-200 hover:bg-white">
                          <span className="font-medium text-gray-700">{item.nome}</span>
                          <span className="text-gray-400">
                            {item.hora_entrada}
                            {item.hora_inicio_almoco && item.hora_fim_almoco ? ` · almoço ${item.hora_inicio_almoco}–${item.hora_fim_almoco}` : ''}
                            {' · saída '}
                            {item.hora_saida_sex && item.hora_saida_sex !== item.hora_saida_seg_qui
                              ? `${item.hora_saida_seg_qui} (sex ${item.hora_saida_sex})`
                              : item.hora_saida_seg_qui}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* almoço/saída: resumo calculado por padrão; "Personalizar" libera edição livre por campo */}
```

- [ ] **Step 9: Rodar build**

```bash
npm run build
```
Expected: build concluído sem erros. Corrigir qualquer erro de tipo/lint antes de seguir.

- [ ] **Step 10: Verificação manual no browser**

Abrir o dev server (`npm run dev`), ir em Postos → Gerenciar → escolher um posto com regime 5x2 ou 5x1 já configurado → clicar "Turnos" → "Novo turno" → confirmar que a lista "Usar turno padrão" aparece, clicar em um item, confirmar que Nome/Entrada/Almoço/Saída foram preenchidos, salvar e confirmar que o turno aparece na listagem com os horários corretos. Repetir em um posto 12x36 e confirmar que a lista de catálogo **não** aparece.

- [ ] **Step 11: Commit**

```bash
git add components/postos/modal-turnos-posto.tsx
git commit -m "feat(turnos): atalho de catalogo padrao no cadastro de turno do posto"
```

---

## Task 2: Atribuição de horário em lote (Bloco B)

**Files:**
- Modify: `app/(admin)/efetivo/horario/actions.ts`
- Create: `components/postos/modal-atribuir-horarios-lote.tsx`
- Modify: `components/postos/postos-client.tsx`

- [ ] **Step 1: Adicionar import de `FUNCAO_JOVEM_APRENDIZ` em `horario/actions.ts`**

No topo do arquivo, esta linha:

```ts
import { resolverTipoEscala } from '@/lib/turnos/escala'
```

vira:

```ts
import { resolverTipoEscala, FUNCAO_JOVEM_APRENDIZ } from '@/lib/turnos/escala'
```

- [ ] **Step 2: Adicionar as duas Server Actions de lote**

Ao final de `app/(admin)/efetivo/horario/actions.ts` (após `deletarHorarioFuncionario`), adicionar:

```ts

export interface FuncionarioLoteRow {
  id: string
  nome: string
  turno_atual_nome: string | null
  turno_atual_desde: string | null
}

export async function listarFuncionariosParaAtribuicaoLote(postoId: string): Promise<FuncionarioLoteRow[]> {
  const supabase = createClient()

  const { data: funcionariosRaw, error } = await supabase
    .from('funcionarios')
    .select('id, nome, funcoes!funcao_id(nome)')
    .eq('posto_id', postoId)
    .eq('status', 'ativo')
    .order('nome')
  if (error) throw new Error(error.message)

  const funcionarios = (funcionariosRaw ?? []) as unknown as { id: string; nome: string; funcoes: { nome: string } | null }[]
  const elegiveis = funcionarios.filter(f => f.funcoes?.nome !== FUNCAO_JOVEM_APRENDIZ)
  if (elegiveis.length === 0) return []

  const { data: vigentesRaw } = await supabase
    .from('horarios_funcionarios')
    .select('funcionario_id, data_inicio, turnos_postos!turno_id(nome)')
    .in('funcionario_id', elegiveis.map(f => f.id))
    .is('data_fim', null)

  const vigentes = (vigentesRaw ?? []) as unknown as { funcionario_id: string; data_inicio: string; turnos_postos: { nome: string } | null }[]
  const vigenteMap = new Map<string, { nome: string; data_inicio: string }>()
  for (const v of vigentes) {
    if (v.turnos_postos) vigenteMap.set(v.funcionario_id, { nome: v.turnos_postos.nome, data_inicio: v.data_inicio })
  }

  return elegiveis.map(f => ({
    id: f.id,
    nome: f.nome,
    turno_atual_nome: vigenteMap.get(f.id)?.nome ?? null,
    turno_atual_desde: vigenteMap.get(f.id)?.data_inicio ?? null,
  }))
}

export async function atribuirTurnoEmLote(
  funcionarioIds: string[],
  turnoId: string,
  dataInicio: string,
): Promise<{ sucesso: string[]; falhas: { funcionarioId: string; erro: string }[] }> {
  const auth = await getUser()
  if (!auth || !['admin', 'coordenador'].includes(auth.perfil.role ?? '')) {
    return { sucesso: [], falhas: funcionarioIds.map(id => ({ funcionarioId: id, erro: 'Acesso negado' })) }
  }

  const sucesso: string[] = []
  const falhas: { funcionarioId: string; erro: string }[] = []
  for (const funcionarioId of funcionarioIds) {
    const res = await alterarTurno(funcionarioId, turnoId, dataInicio)
    if (res.success) sucesso.push(funcionarioId)
    else falhas.push({ funcionarioId, erro: res.error ?? 'Erro desconhecido' })
  }

  revalidatePath('/postos')
  return { sucesso, falhas }
}
```

- [ ] **Step 3: Rodar type-check**

```bash
npx tsc --noEmit
```
Expected: sem erros novos.

- [ ] **Step 4: Commit**

```bash
git add app/\(admin\)/efetivo/horario/actions.ts
git commit -m "feat(horario): server actions de atribuicao de turno em lote por posto"
```

- [ ] **Step 5: Criar o modal de atribuição em lote**

Criar `components/postos/modal-atribuir-horarios-lote.tsx`:

```tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { X } from 'lucide-react'
import {
  listarFuncionariosParaAtribuicaoLote,
  listarTurnosDoPosto,
  atribuirTurnoEmLote,
  type FuncionarioLoteRow,
} from '@/app/(admin)/efetivo/horario/actions'
import { formatarResumoTurno } from '@/lib/turnos/escala'

type TurnoOpcao = {
  id: string
  nome: string
  hora_entrada: string
  hora_saida_seg_qui: string
  hora_saida_sex: string | null
  hora_inicio_almoco: string | null
  hora_fim_almoco: string | null
  tipo_escala: string
}

interface Props {
  postoId: string
  postoNome: string
  open: boolean
  onClose: () => void
}

function hoje(): string {
  return new Date().toISOString().slice(0, 10)
}

function fmtData(iso: string) {
  const [y, m, d] = iso.split('T')[0].split('-')
  return `${d}/${m}/${y}`
}

export function ModalAtribuirHorariosLote({ postoId, postoNome, open, onClose }: Props) {
  const [funcionarios, setFuncionarios] = useState<FuncionarioLoteRow[]>([])
  const [turnos, setTurnos]             = useState<TurnoOpcao[]>([])
  const [loading, setLoading]           = useState(false)
  const [turnoId, setTurnoId]           = useState('')
  const [dataInicio, setDataInicio]     = useState(hoje())
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())
  const [saving, setSaving]             = useState(false)
  const [resultado, setResultado] = useState<{ sucesso: string[]; falhas: { funcionarioId: string; erro: string }[] } | null>(null)

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const [f, t] = await Promise.all([
        listarFuncionariosParaAtribuicaoLote(postoId),
        listarTurnosDoPosto(postoId),
      ])
      setFuncionarios(f)
      setTurnos(t as TurnoOpcao[])
    } finally {
      setLoading(false)
    }
  }, [postoId])

  useEffect(() => {
    if (open) { carregar(); setResultado(null); setSelecionados(new Set()) }
  }, [open, carregar])

  function toggle(id: string) {
    setSelecionados(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selecionarSemHorario() {
    setSelecionados(new Set(funcionarios.filter(f => !f.turno_atual_nome).map(f => f.id)))
  }

  async function handleAplicar() {
    if (!turnoId || selecionados.size === 0 || !dataInicio) return
    setSaving(true)
    const res = await atribuirTurnoEmLote(Array.from(selecionados), turnoId, dataInicio)
    setSaving(false)
    setResultado(res)
    carregar()
  }

  function nomeFuncionario(id: string) {
    return funcionarios.find(f => f.id === id)?.nome ?? id
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h2 className="text-base font-bold text-gray-900">Atribuir Horários em Lote</h2>
            <p className="text-xs text-gray-400">{postoNome}</p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-500">Turno</label>
              <select value={turnoId} onChange={e => setTurnoId(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400">
                <option value="">Selecione…</option>
                {turnos.map(t => (
                  <option key={t.id} value={t.id}>{t.nome} — {formatarResumoTurno(t)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-500">Data de Início</label>
              <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400" />
            </div>
          </div>

          {turnos.length === 0 && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
              Nenhum turno cadastrado para este posto. Acesse <strong>Postos → Turnos</strong> para criar.
            </p>
          )}

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">
                Funcionários ({funcionarios.length})
              </p>
              <button type="button" onClick={selecionarSemHorario}
                className="text-xs font-medium text-slate-700 underline hover:text-slate-900">
                Selecionar todos sem horário
              </button>
            </div>

            {loading ? (
              <p className="text-sm text-gray-400">Carregando…</p>
            ) : funcionarios.length === 0 ? (
              <p className="text-sm text-gray-400">
                Nenhum funcionário elegível neste posto (jovens aprendizes são atribuídos individualmente no perfil).
              </p>
            ) : (
              <div className="max-h-72 space-y-1 overflow-y-auto rounded-lg border border-gray-100">
                {funcionarios.map(f => (
                  <label key={f.id}
                    className="flex cursor-pointer items-center justify-between gap-3 border-b border-gray-50 px-3 py-2 last:border-b-0 hover:bg-gray-50">
                    <span className="flex items-center gap-2">
                      <input type="checkbox" checked={selecionados.has(f.id)} onChange={() => toggle(f.id)}
                        className="h-4 w-4 rounded border-gray-300 accent-slate-900" />
                      <span className="text-sm text-gray-800">{f.nome}</span>
                    </span>
                    {f.turno_atual_nome ? (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                        {f.turno_atual_nome} — desde {fmtData(f.turno_atual_desde!)}
                      </span>
                    ) : (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                        Sem horário
                      </span>
                    )}
                  </label>
                ))}
              </div>
            )}
          </div>

          {resultado && (
            <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 text-sm">
              <p className="font-semibold text-gray-700">
                {resultado.sucesso.length} aplicado(s), {resultado.falhas.length} falharam
              </p>
              {resultado.falhas.length > 0 && (
                <ul className="mt-1.5 space-y-0.5 text-xs text-red-600">
                  {resultado.falhas.map(f => (
                    <li key={f.funcionarioId}>{nomeFuncionario(f.funcionarioId)}: {f.erro}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-100 px-6 py-3">
          <button type="button" onClick={onClose}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
            Fechar
          </button>
          <button type="button" onClick={handleAplicar}
            disabled={saving || !turnoId || selecionados.size === 0 || !dataInicio}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50">
            {saving ? 'Aplicando…' : `Aplicar a ${selecionados.size} selecionado(s)`}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Rodar type-check**

```bash
npx tsc --noEmit
```
Expected: sem erros novos.

- [ ] **Step 7: Commit**

```bash
git add components/postos/modal-atribuir-horarios-lote.tsx
git commit -m "feat(postos): modal de atribuicao de horario em lote"
```

- [ ] **Step 8: Conectar o botão em `postos-client.tsx`**

Import — esta linha:

```ts
import { ModalTurnosPosto } from './modal-turnos-posto'
```

vira:

```ts
import { ModalTurnosPosto } from './modal-turnos-posto'
import { ModalAtribuirHorariosLote } from './modal-atribuir-horarios-lote'
```

Import do ícone — esta linha:

```ts
import { UserPlus, FileSpreadsheet, ChevronRight, Clock } from 'lucide-react'
```

vira:

```ts
import { UserPlus, FileSpreadsheet, ChevronRight, Clock, CalendarClock } from 'lucide-react'
```

Estado — logo abaixo de `const [modalTurnos, setModalTurnos]          = useState<PostoRow | null>(null)`, adicionar:

```ts
  const [modalLote, setModalLote]              = useState<PostoRow | null>(null)
```

Botão — este trecho na aba "Gerenciar":

```tsx
                        {p.secretaria !== 'AFASTADOS' && (
                          <button type="button" onClick={() => setModalTurnos(p)}
                            className="flex items-center gap-1 rounded border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">
                            <Clock className="h-3 w-3" /> Turnos
                          </button>
                        )}
```

vira:

```tsx
                        {p.secretaria !== 'AFASTADOS' && (
                          <button type="button" onClick={() => setModalTurnos(p)}
                            className="flex items-center gap-1 rounded border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">
                            <Clock className="h-3 w-3" /> Turnos
                          </button>
                        )}
                        {p.secretaria !== 'AFASTADOS' && (role === 'admin' || role === 'coordenador') && (
                          <button type="button" onClick={() => setModalLote(p)}
                            className="flex items-center gap-1 rounded border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">
                            <CalendarClock className="h-3 w-3" /> Horários
                          </button>
                        )}
```

Render do modal — este trecho no final do JSX:

```tsx
      {modalTurnos && (
        <ModalTurnosPosto
          postoId={modalTurnos.id}
          postoNome={modalTurnos.nome}
          open={true}
          onClose={() => setModalTurnos(null)}
          role={role}
        />
      )}
```

vira:

```tsx
      {modalTurnos && (
        <ModalTurnosPosto
          postoId={modalTurnos.id}
          postoNome={modalTurnos.nome}
          open={true}
          onClose={() => setModalTurnos(null)}
          role={role}
        />
      )}

      {modalLote && (
        <ModalAtribuirHorariosLote
          postoId={modalLote.id}
          postoNome={modalLote.nome}
          open={true}
          onClose={() => setModalLote(null)}
        />
      )}
```

- [ ] **Step 9: Rodar build**

```bash
npm run build
```
Expected: sem erros.

- [ ] **Step 10: Verificação manual no browser**

Postos → Gerenciar → posto com turno já cadastrado e ao menos 2 funcionários ativos (idealmente 1 com horário já atribuído e 1 sem) → clicar "Horários" → confirmar lista, badges de situação, selecionar turno + data + funcionários → "Aplicar" → confirmar resumo de sucesso/falha e que o funcionário passa a exibir o novo horário no perfil dele.

- [ ] **Step 11: Commit**

```bash
git add components/postos/postos-client.tsx
git commit -m "feat(postos): botao de atribuicao de horario em lote no card do posto"
```

---

## Task 3: Vínculo automático de horário na solicitação (Bloco C)

**Files:**
- Modify: `app/(admin)/efetivo/horario/actions.ts`
- Modify: `app/(admin)/efetivo/actions.ts`
- Modify: `components/efetivo/modal-nova-solicitacao.tsx`
- Modify: `app/(admin)/aprovacoes/actions.ts`

- [ ] **Step 1: Adicionar `precisaNovoTurno` e `aplicarMudancaHorario` em `horario/actions.ts`**

Ao final do arquivo (após as funções do Bloco B adicionadas na Task 2), adicionar:

```ts

/**
 * Turno vigente deixa de ser válido quando o posto muda (turno é por posto) OU quando a
 * condição jovem-aprendiz muda (turno de jovem aprendiz é global, não por posto — então
 * essa transição sempre exige nova escolha, independente do posto).
 */
export function precisaNovoTurno(
  postoAtual: string | null,
  postoNovo: string | null,
  jovemAtual: boolean,
  jovemNovo: boolean,
): boolean {
  if (jovemAtual !== jovemNovo) return true
  if (jovemAtual && jovemNovo) return false
  return postoAtual !== postoNovo
}

/**
 * Fecha o horário vigente do funcionário (se houver) e, quando um novo turno foi informado,
 * já abre o próximo registro na data de efetivação. Chamado na aprovação de transferência,
 * mudança de função e retorno de afastamento — os 3 fluxos que alteram posto_id/funcao_id.
 * Se turnoDestinoId for null (destino ainda sem turno cadastrado no momento do pedido), só
 * fecha o vigente — o funcionário fica pendente de atribuição manual (tela de lote do posto).
 */
export async function aplicarMudancaHorario(
  funcionarioId: string,
  turnoDestinoId: string | null,
  diaCurso: number | null,
  dataEfetivacao: string,
  criadoPor: string,
): Promise<void> {
  const supabase = createClient()

  const { data: vigente } = await supabase
    .from('horarios_funcionarios')
    .select('id, data_inicio')
    .eq('funcionario_id', funcionarioId)
    .is('data_fim', null)
    .maybeSingle()

  if (vigente) {
    const d = new Date(dataEfetivacao + 'T12:00:00')
    d.setDate(d.getDate() - 1)
    const dataFim = d.toISOString().split('T')[0]
    if (dataFim >= vigente.data_inicio) {
      await supabase.from('horarios_funcionarios').update({ data_fim: dataFim }).eq('id', vigente.id)
    }
  }

  if (turnoDestinoId) {
    await supabase.from('horarios_funcionarios').insert({
      funcionario_id: funcionarioId,
      turno_id: turnoDestinoId,
      data_inicio: dataEfetivacao,
      dia_curso: diaCurso,
      criado_por: criadoPor,
    })
  }
}
```

- [ ] **Step 2: Rodar type-check e commit**

```bash
npx tsc --noEmit
git add app/\(admin\)/efetivo/horario/actions.ts
git commit -m "feat(horario): regra e helper para fechar/reatribuir horario em mudanca de posto ou funcao"
```

- [ ] **Step 3: Persistir `turno_destino_id`/`dia_curso_destino` em `solicitarTransferencia`**

Em `app/(admin)/efetivo/actions.ts`, dentro de `solicitarTransferencia`, esta linha:

```ts
  const novaFuncaoId   = (formData.get('nova_funcao_id') as string) || null
```

vira:

```ts
  const novaFuncaoId   = (formData.get('nova_funcao_id') as string) || null
  const turnoDestinoId  = (formData.get('turno_destino_id') as string) || null
  const diaCursoDestino = formData.get('dia_curso_destino') ? Number(formData.get('dia_curso_destino')) : null
```

E este trecho do insert:

```ts
    dados_depois: {
      posto_destino_id: postoDestinoId,
      posto_destino_nome: postoDestinoNome,
      motivo,
      ...(novaFuncaoId ? { nova_funcao_id: novaFuncaoId, nova_funcao_nome: novaFuncaoNome } : {}),
    },
```

vira:

```ts
    dados_depois: {
      posto_destino_id: postoDestinoId,
      posto_destino_nome: postoDestinoNome,
      motivo,
      ...(novaFuncaoId ? { nova_funcao_id: novaFuncaoId, nova_funcao_nome: novaFuncaoNome } : {}),
      ...(turnoDestinoId ? { turno_destino_id: turnoDestinoId } : {}),
      ...(diaCursoDestino ? { dia_curso_destino: diaCursoDestino } : {}),
    },
```

- [ ] **Step 4: Persistir em `solicitarMudancaFuncao`**

Esta linha:

```ts
  const motivo          = (formData.get('motivo') as string) || null
```

(a que está dentro de `solicitarMudancaFuncao` — não confundir com a de `solicitarTransferencia`) vira:

```ts
  const motivo          = (formData.get('motivo') as string) || null
  const turnoDestinoId  = (formData.get('turno_destino_id') as string) || null
  const diaCursoDestino = formData.get('dia_curso_destino') ? Number(formData.get('dia_curso_destino')) : null
```

E este trecho:

```ts
    dados_antes: { funcao_id: funcaoOrigemId, funcao_nome: funcaoOrigemNome, supervisor_nome: supervisorNome },
    dados_depois: { funcao_destino_id: funcaoDestinoId, funcao_destino_nome: funcaoDestinoNome, motivo, supervisor_nome: supervisorNome },
```

vira:

```ts
    dados_antes: { funcao_id: funcaoOrigemId, funcao_nome: funcaoOrigemNome, supervisor_nome: supervisorNome },
    dados_depois: {
      funcao_destino_id: funcaoDestinoId, funcao_destino_nome: funcaoDestinoNome, motivo, supervisor_nome: supervisorNome,
      ...(turnoDestinoId ? { turno_destino_id: turnoDestinoId } : {}),
      ...(diaCursoDestino ? { dia_curso_destino: diaCursoDestino } : {}),
    },
```

- [ ] **Step 5: Persistir em `solicitarRetornoAfastamento`**

Esta linha:

```ts
  const posto_retorno_id = (fd.get('posto_retorno_id') as string) || null
```

vira:

```ts
  const posto_retorno_id = (fd.get('posto_retorno_id') as string) || null
  const turnoDestinoId    = (fd.get('turno_destino_id') as string) || null
  const diaCursoDestino   = fd.get('dia_curso_destino') ? Number(fd.get('dia_curso_destino')) : null
```

E este trecho:

```ts
    dados_depois: { data_retorno, posto_retorno_id },
```

vira:

```ts
    dados_depois: {
      data_retorno, posto_retorno_id,
      ...(turnoDestinoId ? { turno_destino_id: turnoDestinoId } : {}),
      ...(diaCursoDestino ? { dia_curso_destino: diaCursoDestino } : {}),
    },
```

- [ ] **Step 6: Rodar type-check e commit**

```bash
npx tsc --noEmit
git add app/\(admin\)/efetivo/actions.ts
git commit -m "feat(efetivo): solicitacoes de transferencia/mudanca-funcao/retorno gravam turno de destino"
```

- [ ] **Step 7: Adicionar seleção de turno no formulário `modal-nova-solicitacao.tsx`**

Imports — esta linha:

```ts
import { calcularImpactoPosto } from '@/app/(admin)/efetivo/impacto'
```

vira:

```ts
import { calcularImpactoPosto } from '@/app/(admin)/efetivo/impacto'
import { listarTurnosDoPosto, listarTurnosJovemAprendiz, precisaNovoTurno } from '@/app/(admin)/efetivo/horario/actions'
import { FUNCAO_JOVEM_APRENDIZ, formatarResumoTurno } from '@/lib/turnos/escala'
```

Tipo local — adicionar logo abaixo do bloco de imports, antes de `type TipoSolicitacao = ...`:

```ts
type TurnoOpcao = {
  id: string
  nome: string
  hora_entrada: string
  hora_saida_seg_qui: string
  hora_saida_sex: string | null
  hora_inicio_almoco: string | null
  hora_fim_almoco: string | null
  tipo_escala: string
}
```

Estado — logo após o bloco `// Combobox posto retorno (retorno_afastamento)` e suas 3 linhas de `useState`, adicionar:

```ts
  // Turno de destino — aparece quando posto ou condição jovem-aprendiz mudam
  const [turnoOpcoes, setTurnoOpcoes]         = useState<TurnoOpcao[]>([])
  const [loadingTurnos, setLoadingTurnos]     = useState(false)
  const [turnoDestinoId, setTurnoDestinoId]   = useState('')
  const [diaCursoDestino, setDiaCursoDestino] = useState<number | ''>('')
```

Lógica de derivação — adicionar logo antes do `useEffect` que calcula `impacto` (o que começa com `// Calcula impacto quando as seleções relevantes mudam`):

```ts
  const funcaoAtualNome = funcionario.funcoes?.nome ?? null
  const jovemAtual = funcaoAtualNome === FUNCAO_JOVEM_APRENDIZ

  function funcaoDestinoNomeAtual(): string | null {
    if (tipo === 'transferencia') {
      return mudarFuncao && funcaoSelecionadaId
        ? funcoes.find(f => f.id === funcaoSelecionadaId)?.nome ?? null
        : funcaoAtualNome
    }
    if (tipo === 'mudanca_funcao') {
      return funcoes.find(f => f.id === funcaoSelecionadaId)?.nome ?? null
    }
    return funcaoAtualNome
  }

  function postoDestinoIdAtual(): string | null {
    if (tipo === 'transferencia')       return postoSelecionado?.id ?? null
    if (tipo === 'retorno_afastamento') return postoRetornoSelecionado?.id ?? funcionario.posto_id
    return funcionario.posto_id
  }

  const jovemNovo = funcaoDestinoNomeAtual() === FUNCAO_JOVEM_APRENDIZ

  const condicaoAtendida =
    (tipo === 'transferencia' && !!postoSelecionado) ||
    (tipo === 'mudanca_funcao' && !!funcaoSelecionadaId) ||
    (tipo === 'retorno_afastamento' && !!postoRetornoSelecionado)

  const precisaTurno = condicaoAtendida
    ? precisaNovoTurno(funcionario.posto_id, postoDestinoIdAtual(), jovemAtual, jovemNovo)
    : false

  // Carrega as opções de turno quando a necessidade de troca é detectada
  useEffect(() => {
    setTurnoDestinoId('')
    setDiaCursoDestino('')
    if (!precisaTurno) { setTurnoOpcoes([]); return }
    setLoadingTurnos(true)
    const destino = postoDestinoIdAtual()
    const promise = jovemNovo
      ? listarTurnosJovemAprendiz()
      : destino ? listarTurnosDoPosto(destino) : Promise.resolve([])
    promise.then(data => { setTurnoOpcoes(data as TurnoOpcao[]); setLoadingTurnos(false) })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [precisaTurno, jovemNovo, tipo, postoSelecionado?.id, postoRetornoSelecionado?.id, funcaoSelecionadaId, mudarFuncao])
```

Reset ao fechar o modal — este trecho em `handleClose`:

```ts
    setPostoRetornoSearch(''); setPostoRetornoOpen(false); setPostoRetornoSelecionado(null)
    onClose()
```

vira:

```ts
    setPostoRetornoSearch(''); setPostoRetornoOpen(false); setPostoRetornoSelecionado(null)
    setTurnoOpcoes([]); setTurnoDestinoId(''); setDiaCursoDestino('')
    onClose()
```

Validação no submit — em `handleSubmit`, logo antes de `const fd = new FormData(e.currentTarget)`:

```ts
    if (!tipo) return
    setErro(null)
    const fd = new FormData(e.currentTarget)
```

vira:

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

Bloco de UI — dentro de `{tipo === 'transferencia' && (...)}`, logo após o bloco `{/* Resumo de impacto para transferência */}` e antes do `</>` de fechamento:

```tsx
              {/* Resumo de impacto para transferência */}
              {(impacto || loadingImpacto) && (
                <PostoImpactPanel impacto={impacto} loading={loadingImpacto} />
              )}
              </>
            )}
```

vira:

```tsx
              {/* Resumo de impacto para transferência */}
              {(impacto || loadingImpacto) && (
                <PostoImpactPanel impacto={impacto} loading={loadingImpacto} />
              )}

              {precisaTurno && (
                <div className="space-y-3 rounded border border-blue-200 bg-blue-50 px-4 py-3">
                  <p className="text-sm font-semibold text-blue-800">Novo turno de trabalho</p>
                  {loadingTurnos ? (
                    <p className="text-xs text-blue-600">Carregando turnos…</p>
                  ) : turnoOpcoes.length === 0 ? (
                    <p className="text-xs text-amber-700">
                      Sem turno cadastrado para o destino — o horário ficará pendente de atribuição manual após a aprovação.
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
              </>
            )}
```

Bloco de UI para `mudanca_funcao` — dentro de `{tipo === 'mudanca_funcao' && (...)}`, logo após o bloco `{/* Resumo de impacto para mudança de função */}` e antes do `</>`:

```tsx
                {/* Resumo de impacto para mudança de função */}
                {(impacto || loadingImpacto) && (
                  <PostoImpactPanel impacto={impacto} loading={loadingImpacto} />
                )}
              </>
            )}
```

vira:

```tsx
                {/* Resumo de impacto para mudança de função */}
                {(impacto || loadingImpacto) && (
                  <PostoImpactPanel impacto={impacto} loading={loadingImpacto} />
                )}

                {precisaTurno && (
                  <div className="space-y-3 rounded border border-blue-200 bg-blue-50 px-4 py-3">
                    <p className="text-sm font-semibold text-blue-800">Novo turno de trabalho</p>
                    {loadingTurnos ? (
                      <p className="text-xs text-blue-600">Carregando turnos…</p>
                    ) : turnoOpcoes.length === 0 ? (
                      <p className="text-xs text-amber-700">
                        Sem turno cadastrado para o destino — o horário ficará pendente de atribuição manual após a aprovação.
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
              </>
            )}
```

Bloco de UI para `retorno_afastamento` — dentro de `{tipo === 'retorno_afastamento' && (...)}`, logo após o fechamento do `<div>` do combobox de posto de retorno (o `</div>` que fecha o bloco iniciado em `<label className={labelClass}>Posto de Retorno</label>`) e antes do `</>` final desse tipo:

```tsx
                  {postoRetornoSelecionado && (
                    <p className="mt-1 text-xs text-gray-400">
                      Selecionado: <span className="font-medium text-slate-700">{postoRetornoSelecionado.nome}</span>
                      {postoRetornoSelecionado.secretaria && ` — ${postoRetornoSelecionado.secretaria}`}
                    </p>
                  )}
                </div>
              </>
            )}
```

vira:

```tsx
                  {postoRetornoSelecionado && (
                    <p className="mt-1 text-xs text-gray-400">
                      Selecionado: <span className="font-medium text-slate-700">{postoRetornoSelecionado.nome}</span>
                      {postoRetornoSelecionado.secretaria && ` — ${postoRetornoSelecionado.secretaria}`}
                    </p>
                  )}
                </div>

                {precisaTurno && (
                  <div className="space-y-3 rounded border border-blue-200 bg-blue-50 px-4 py-3">
                    <p className="text-sm font-semibold text-blue-800">Novo turno de trabalho</p>
                    {loadingTurnos ? (
                      <p className="text-xs text-blue-600">Carregando turnos…</p>
                    ) : turnoOpcoes.length === 0 ? (
                      <p className="text-xs text-amber-700">
                        Sem turno cadastrado para o destino — o horário ficará pendente de atribuição manual após a aprovação.
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
              </>
            )}
```

- [ ] **Step 8: Rodar build**

```bash
npm run build
```
Expected: sem erros. Prestar atenção especial a erros de JSX desbalanceado (fechamento de `</>`/`)` errado) — comuns nesse tipo de edição por blocos.

- [ ] **Step 9: Commit**

```bash
git add components/efetivo/modal-nova-solicitacao.tsx
git commit -m "feat(efetivo): seletor de turno de destino na solicitacao de transferencia/mudanca-funcao/retorno"
```

- [ ] **Step 10: Aplicar a mudança em `aprovacoes/actions.ts`**

Import — esta linha:

```ts
import type { TipoSolicitacao } from '@/types'
```

vira:

```ts
import type { TipoSolicitacao } from '@/types'
import { aplicarMudancaHorario, precisaNovoTurno } from '@/app/(admin)/efetivo/horario/actions'
import { FUNCAO_JOVEM_APRENDIZ } from '@/lib/turnos/escala'
```

Query do funcionário — esta linha, dentro de `aprovarSolicitacao`:

```ts
  const { data: func } = sol.funcionario_id
    ? await supabase
        .from('funcionarios')
        .select('status, posto_id, funcao_id, salario')
        .eq('id', sol.funcionario_id)
        .single()
    : { data: null }
```

vira:

```ts
  const { data: func } = sol.funcionario_id
    ? await supabase
        .from('funcionarios')
        .select('status, posto_id, funcao_id, salario, funcoes!funcao_id(nome)')
        .eq('id', sol.funcionario_id)
        .single()
    : { data: null }

  const funcaoAtualNome = (func as unknown as { funcoes: { nome: string } | null } | null)?.funcoes?.nome ?? null
  const jovemAtual = funcaoAtualNome === FUNCAO_JOVEM_APRENDIZ
  const hojeISO = new Date().toISOString().slice(0, 10)
```

Case `transferencia` — este trecho:

```ts
    case 'transferencia': {
      const updateTransf: Record<string, unknown> = { posto_id: dadosDepois.posto_destino_id as string }
      if (dadosDepois.nova_funcao_id) updateTransf.funcao_id = dadosDepois.nova_funcao_id as string
      const { error: errTransf } = await adminSupabase
        .from('funcionarios')
        .update(updateTransf as { posto_id: string })
        .eq('id', funcionarioId)
      if (errTransf) return { success: false, error: errTransf.message }
      if (dadosDepois.nova_funcao_id) {
        await supabase.from('movimentacoes').insert({
          funcionario_id:  funcionarioId,
          tipo:            'mudanca_funcao',
          campo_alterado:  'funcao_id',
          valor_antes:     func?.funcao_id ?? null,
          valor_depois:    dadosDepois.nova_funcao_id as string,
          executado_por:   guard.userId,
          solicitacao_id:  id,
        })
      }
      break
    }
```

vira:

```ts
    case 'transferencia': {
      const postoDestinoId = dadosDepois.posto_destino_id as string
      const updateTransf: Record<string, unknown> = { posto_id: postoDestinoId }
      if (dadosDepois.nova_funcao_id) updateTransf.funcao_id = dadosDepois.nova_funcao_id as string
      const { error: errTransf } = await adminSupabase
        .from('funcionarios')
        .update(updateTransf as { posto_id: string })
        .eq('id', funcionarioId)
      if (errTransf) return { success: false, error: errTransf.message }
      if (dadosDepois.nova_funcao_id) {
        await supabase.from('movimentacoes').insert({
          funcionario_id:  funcionarioId,
          tipo:            'mudanca_funcao',
          campo_alterado:  'funcao_id',
          valor_antes:     func?.funcao_id ?? null,
          valor_depois:    dadosDepois.nova_funcao_id as string,
          executado_por:   guard.userId,
          solicitacao_id:  id,
        })
      }

      const funcaoNovaNome = (dadosDepois.nova_funcao_nome as string | undefined) ?? funcaoAtualNome
      const jovemNovo = funcaoNovaNome === FUNCAO_JOVEM_APRENDIZ
      if (precisaNovoTurno(func?.posto_id ?? null, postoDestinoId, jovemAtual, jovemNovo)) {
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

Case `mudanca_funcao`/`promocao` — este trecho:

```ts
    case 'mudanca_funcao':
    case 'promocao': {
      const { error: errFuncao } = await adminSupabase
        .from('funcionarios')
        .update({ funcao_id: dadosDepois.funcao_destino_id as string })
        .eq('id', funcionarioId)
      if (errFuncao) return { success: false, error: errFuncao.message }
      break
    }
```

vira:

```ts
    case 'mudanca_funcao':
    case 'promocao': {
      const { error: errFuncao } = await adminSupabase
        .from('funcionarios')
        .update({ funcao_id: dadosDepois.funcao_destino_id as string })
        .eq('id', funcionarioId)
      if (errFuncao) return { success: false, error: errFuncao.message }

      const funcaoNovaNome = (dadosDepois.funcao_destino_nome as string | undefined) ?? null
      const jovemNovo = funcaoNovaNome === FUNCAO_JOVEM_APRENDIZ
      if (precisaNovoTurno(func?.posto_id ?? null, func?.posto_id ?? null, jovemAtual, jovemNovo)) {
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

Case `retorno_afastamento` — este trecho:

```ts
    case 'retorno_afastamento': {
      const { error: errRetorno } = await adminSupabase
        .from('funcionarios')
        .update({
          status:   'ativo',
          posto_id: (dadosDepois.posto_retorno_id as string | undefined) ?? func?.posto_id ?? null,
        })
        .eq('id', funcionarioId)
      if (errRetorno) return { success: false, error: errRetorno.message }
      await supabase
        .from('afastamentos')
        .update({ data_fim_real: dadosDepois.data_retorno as string })
        .eq('funcionario_id', funcionarioId)
        .is('data_fim_real', null)
      break
    }
```

vira:

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

- [ ] **Step 11: Rodar build**

```bash
npm run build
```
Expected: sem erros.

- [ ] **Step 12: Commit**

```bash
git add app/\(admin\)/aprovacoes/actions.ts
git commit -m "feat(aprovacoes): aplica fechamento/reatribuicao de horario ao aprovar transferencia, mudanca de funcao e retorno"
```

- [ ] **Step 13: Verificação manual no browser — os 4 cenários do plano de verificação da spec**

Com dev server rodando, usando um funcionário de teste (não um funcionário real em produção — usar dado de teste local/staging):

1. Solicitar transferência entre 2 postos normais (função não-jovem-aprendiz em ambos, ambos com turno cadastrado) → confirmar que o bloco "Novo turno de trabalho" aparece e exige seleção → aprovar em `/aprovacoes` → abrir o perfil do funcionário → aba Horário → confirmar que o horário antigo aparece no histórico com `data_fim` = dia anterior à aprovação, e o novo turno está vigente desde a data de aprovação.
2. Transferência entre postos sem marcar "mudar função junto", funcionário já jovem aprendiz → confirmar que o bloco de turno **não** aparece, e que após aprovado o horário/turno do funcionário continua o mesmo de antes.
3. Mudança de função que ativa jovem aprendiz (função destino = "JOVEM APRENDIZ") → bloco aparece com campo "Dia de curso" → aprovar → conferir na aba Horário que o novo turno é um dos turnos globais de jovem aprendiz com o dia de curso certo.
4. Retorno de afastamento escolhendo um posto de retorno diferente do posto original → bloco aparece → aprovar → conferir troca de horário. Repetir deixando o campo de posto de retorno em branco (mesmo posto) → bloco não deve aparecer, horário anterior ao afastamento permanece vigente.

- [ ] **Step 14: `npx tsc --noEmit` final de todo o trabalho**

```bash
npx tsc --noEmit
```
Expected: sem erros em nenhum dos arquivos tocados.

---

## Task 4: Deploy de teste no Vercel

**Files:** nenhum (operação git/deploy).

- [ ] **Step 1: Conferir que tudo foi commitado**

```bash
git status --short
```
Expected: sem saída.

- [ ] **Step 2: Push da branch para o GitHub (gera Preview Deployment no Vercel)**

```bash
git push -u origin feature/turnos-padrao-e-horario
```

- [ ] **Step 3: Confirmar o Preview Deployment**

Verificar no painel do Vercel (ou no comentário automático do PR/branch no GitHub, se o projeto tiver essa integração) que o deploy do preview terminou com sucesso, e repetir os 4 cenários de verificação manual do Step 13 da Task 3 diretamente na URL de preview antes de considerar pronto para `master`.

- [ ] **Step 4: Reportar ao usuário**

Passar a URL do preview e o resumo do que testar. Não mesclar em `master` nem fazer deploy de produção sem confirmação explícita do usuário — isso é uma etapa separada, decidida por ele depois da validação.
