# Fase 2 — Múltiplas Escalas por Posto (Design)

**Data:** 2026-08-12
**Pré-requisito:** Fase 1 já implementada e em produção (commit `d0f4c69` em `master`) — regime de cada funcionário é lido do turno vigente dele (`horarios_funcionarios → turnos_postos.tipo_escala`), com fallback pro regime configurado no posto (`config_escalas_postos`). Ver `docs/superpowers/plans/2026-08-12-regime-por-funcionario-fase-1.md`.

## Objetivo

Permitir que um posto tenha funcionários em mais de um regime de trabalho ao mesmo tempo (qualquer combinação entre `5x2`, `5x1`, `12x36` — ex.: parte do time 5x2, parte 12x36, no mesmo posto). `jovem_aprendiz` não faz parte desta combinação — já tem regra própria e turnos globais.

## Por que é seguro fazer isso agora

A Fase 1 já trocou a fonte de verdade do regime, em todo cálculo (fechamento, financeiro, férias), de "regime do posto" para "regime do turno vigente do funcionário". O único motivo de hoje ainda não existir posto multi-escala na prática é que `criarTurno` **força** todo turno novo a herdar o regime único configurado no posto. Esta fase remove essa trava e ajusta os 2 lugares que ainda exibem "o regime do posto" como um valor único.

## Escopo

### 1. `app/(admin)/postos/turnos/actions.ts` — regime escolhido no turno, não herdado do posto

**`TurnoData`** ganha um campo:

```ts
export interface TurnoData {
  nome: string
  hora_entrada: string
  hora_inicio_almoco: string | null
  hora_fim_almoco: string | null
  hora_saida_seg_qui: string
  hora_saida_sex: string | null
  tipo_escala: TipoEscalaPosto   // novo
}
```

**`criarTurno`**: remove o bloqueio atual (`if (!regime) return { success: false, error: 'Configure o regime...' }`). Passa a validar `dados.tipo_escala` com `isTipoEscalaPosto` (de `lib/turnos/escala.ts`) e usar esse valor no insert, em vez de chamar `obterRegimePosto` como fonte obrigatória:

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

**`editarTurno`**: passa a aceitar e persistir `tipo_escala` também (hoje só atualiza horários, nunca toca no regime):

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

`obterRegimePosto` **não é removida** — continua existindo e é usada só como sugestão de valor default no formulário (ver seção 2), não mais como trava.

### 2. `components/postos/modal-turnos-posto.tsx` — seletor de regime no formulário do turno

O formulário de criar/editar turno ganha um `<select>` de regime (`5x2` / `5x1` / `12x36`), usando `TIPOS_ESCALA_POSTO` de `lib/turnos/escala.ts` como fonte das opções. Pré-preenchido com o regime padrão do posto (`obterRegimePosto`) quando o posto já tem um configurado; em branco/obrigatório quando não tem.

O picker "Usar turno padrão" (catálogo `CATALOGO_POR_REGIME`) já é organizado por regime — cada template pertence a um grupo (`5x2`, `5x1` ou `jovem_aprendiz`, hoje). Ao escolher um template do catálogo, o `<select>` de regime do formulário é setado automaticamente para o regime daquele grupo (o usuário pode trocar depois se quiser).

Validação client-side: bloquear submit se nenhum regime estiver selecionado, com mensagem "Selecione o regime de trabalho deste turno."

### 3. `config_escalas_postos` / tela "Fechamento > Config Escalas" — vira "regime padrão"

Sem mudança de schema. A tabela e a tela continuam existindo exatamente como estão hoje (1 regime por posto). Muda só o **significado**: deixa de ser "a regra travada de todo turno do posto" e passa a ser "o regime sugerido por padrão" — usado em dois lugares:
- pré-preenchimento do seletor de regime no formulário de turno (seção 2);
- fallback do helper `obterRegimesPorFuncionario` (Fase 1) quando o funcionário não tem turno vigente cadastrado.

Ajuste de copy na tela `app/(admin)/fechamento/config-escalas/page.tsx`: trocar qualquer texto que sugira "regime único e obrigatório do posto" por algo como "regime padrão sugerido ao cadastrar turnos deste posto".

### 4. Fechamento RH — `FechamentoPosto.regime` vira `regimes: string[]`

Hoje `FechamentoPosto.regime: string` (um valor) aparece em 3 lugares de exibição:
- `components/fechamento/fechamento-client.tsx` — badge na UI (linha ~472), header do Excel exportado (linha ~114), e um terceiro ponto de exibição (linha ~618).
- `components/fechamento/fechamento-pdf-doc.tsx` — header do PDF (linha ~150).

Passa a ser uma lista dos regimes distintos entre os funcionários lotados naquele posto naquele mês:

```ts
export interface FechamentoPosto {
  posto_id: string
  posto_nome: string
  secretaria: string
  regimes: string[]   // era: regime: string
  funcionarios: FechamentoItemPosto[]
}
```

Em `app/(admin)/fechamento/actions.ts`, `getOrCreatePosto` monta o posto sem `regime` fixo; ao inserir cada funcionário/cobertura no posto (nos 2 loops que já existem — titulares e coberturas recebidas), acumula o regime daquele lançamento num `Set<string>` por posto, convertido pra array ordenado ao final (mesma ordem de `TIPOS_ESCALA_POSTO`: 5x2, 5x1, 12x36) antes de retornar `porPosto`.

Nos 4 pontos de exibição, troca `posto.regime` por `posto.regimes.join(' + ')` — pra posto single-regime, resultado idêntico a hoje (`"5x2"`); pra posto multi-escala, mostra `"5x2 + 12x36"`.

`f.regime` (regime por **funcionário**, não por posto — linhas 57 e 394 de `fechamento-client.tsx`, linha 70 de `fechamento-pdf-doc.tsx`) **não muda** — já é individual e correto desde a Fase 1.

### 5. Fora de escopo (sem mudança)

- Fechamento financeiro (`app/(admin)/fechamento-financeiro/`): não tem agregação "por posto", só lista por funcionário (já correta desde a Fase 1). Nenhuma mudança necessária.
- Regime de destino em cobertura temporária (`coberturas/actions.ts`): continua lendo o regime **padrão** do posto de destino — decisão já tomada na Fase 1, não revisitada aqui.
- Rótulo de regime em `lib/movimentacao-colaborador.ts`: continua lendo o regime padrão do posto (cosmético, fora de escopo desde a Fase 1).
- `jovem_aprendiz`: não entra na combinação multi-escala desta fase — mantém fluxo próprio (turnos globais, sem `posto_id`).

## Impacto para postos que continuam single-regime

Zero mudança de comportamento visível: `regimes` vira array de 1 elemento (exibição idêntica), o seletor de regime no form de turno já vem pré-preenchido com o único regime existente, `criarTurno`/`editarTurno` continuam salvando o mesmo valor de antes — só que agora vindo de um campo explícito do formulário em vez de forçado pelo backend.

## Testes / verificação

Sem test runner no projeto (sem jest/vitest) — mesma convenção da Fase 1:
- `npx tsc --noEmit` + `npm run build` após cada mudança.
- Verificação manual via browser (preview): criar um posto de teste, cadastrar 2 turnos com regimes diferentes, conferir que ambos salvam corretamente e aparecem no card certo (borda azul/roxa/laranja já existe no modal, por `ESCALA_BORDER_CLASS`).
- Conferir no relatório de Fechamento (mês corrente) que um posto com essa mistura mostra `"5x2 + 12x36"` no lugar do regime único, e que todo posto que NÃO foi tocado continua mostrando só 1 regime.
- Reaproveitar `scripts/check-regime-parity.mjs` (Fase 1) rodando `compare` ao final — continua tendo que reportar só os 2 IDs de Jovem Aprendiz já conhecidos (nenhum posto real ganhou 2º regime ainda nesta verificação, então não deve haver novidade).
