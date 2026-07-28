# Catálogo de turnos-padrão + atribuição em lote + vínculo automático de horário

**Data:** 2026-07-28
**Status:** Aprovado para implementação

## Contexto e problema

Hoje ~99% dos funcionários não têm horário lançado em `horarios_funcionarios`. Duas causas manuais se somam:

1. **Cadastro de turno por posto** (Postos → Gerenciar → Turnos): cada posto exige digitar/calcular manualmente entrada, almoço e saída, mesmo quando o padrão se repete entre postos (o usuário já levantou uma tabela com ~19 combinações-padrão usadas na operação, para os regimes `5x2` e `5x1`).
2. **Atribuição ao funcionário** (perfil → aba Horário): só existe fluxo individual (`ModalAlterarTurno`), um funcionário por vez — inviável para zerar o backlog atual.

Além disso, existe um terceiro problema estrutural, descoberto durante a análise: `horarios_funcionarios.turno_id` aponta para um turno que pertence a um posto (`turnos_postos.posto_id`). Quando o funcionário muda de posto (transferência) ou muda de condição jovem-aprendiz (mudança de função, retorno de afastamento), **nada atualiza esse vínculo** — o registro antigo continua "vigente" (sem `data_fim`), agora referenciando um turno que não faz mais sentido para a situação atual do funcionário, sem qualquer aviso na tela.

## Escopo

**Dentro do escopo:**
- Catálogo estático de turnos-padrão (5x2 e 5x1) como atalho de preenchimento no modal de turnos do posto.
- Tela de atribuição em lote de turno, por posto, dentro de Postos → Gerenciar.
- Regra central que detecta quando o turno vigente de um funcionário deixa de ser válido (mudança de posto e/ou de condição jovem-aprendiz), aplicada nos 3 fluxos de solicitação que alteram `posto_id`/`funcao_id`: transferência, mudança de função, retorno de afastamento.
- Seleção do novo turno **na criação da solicitação** (pelo supervisor), aplicada automaticamente na aprovação — sem passo manual extra para o admin.

**Fora do escopo (decisão explícita):**
- Movimentações de `coberturas` (substituto cobrindo posto alheio temporariamente) — o posto retorna sozinho ao encerrar a cobertura; mexer no horário nesse fluxo quebraria a lógica de cobertura curta. Não é tocado.
- Catálogo para regimes `12x36` e `jovem_aprendiz` — o usuário não forneceu padrão para eles; modal continua com preenchimento livre nesses casos.
- Qualquer mudança de schema (`turnos_postos`, `horarios_funcionarios`, `config_escalas_postos` permanecem como estão).
- Um "pendências" formal para horários em aberto — o próprio filtro da tela de lote (Bloco B) já expõe quem está sem horário; não criamos item novo no módulo `/pendencias`.

## Bloco A — Catálogo de turnos-padrão (atalho de preenchimento)

- Novo arquivo `lib/turnos/catalogo-padrao.ts`: constantes `CATALOGO_5X2` e `CATALOGO_5X1`, cada item com `{ nome, hora_entrada, hora_inicio_almoco, hora_fim_almoco, hora_saida_seg_qui, hora_saida_sex }` — os ~19 combos fornecidos pelo usuário (arquivo `turnos.md`).
- Em `ModalTurnosPosto` ([modal-turnos-posto.tsx](../../../components/postos/modal-turnos-posto.tsx)), ao abrir "Novo turno" com `tipoEscalaForm` igual a `5x2` ou `5x1`: exibe lista dos itens do catálogo correspondente (nome + resumo do horário, mesmo formato de `formatarResumoTurno`). Clicar em um item preenche `nome`, `horaEntrada`, `horaInicioAlmoco`, `horaFimAlmoco`, `horaSaidaSegQui`, `horaSaidaSex` e marca `almocoTocado=true`/`saidaTocado=true` (para não deixar o `useEffect` de recálculo automático sobrescrever os valores do catálogo). Continua editável em seguida (via "Personalizar horários").
- Regimes `12x36`/`jovem_aprendiz`: sem alteração, formulário livre como hoje.
- Ainda cria um turno por posto (1 clique "Salvar" por posto) — o catálogo elimina o cálculo manual, não o cadastro em si.

## Bloco B — Atribuição de horário em lote (por posto)

- Novo botão no card do posto em `postos-client.tsx`, ao lado de "Turnos": **"Atribuir Horários"**, abrindo `ModalAtribuirHorariosLote`.
- Modal carrega, via nova Server Action `listarFuncionariosParaAtribuicaoLote(postoId)`:
  - Funcionários ativos do posto, **excluindo função Jovem Aprendiz** (continuam só no fluxo individual do perfil, por causa do campo `dia_curso`).
  - Para cada um: `horario_atual` (nome do turno + data de início, se houver vigente — mesmo que aponte para outro posto/órfão) ou `null`.
- Topo do modal: seletor de turno (lista `listarTurnosDoPosto(postoId)`) + campo de data de início (default hoje).
- Lista de funcionários com checkbox por linha + badge de situação ("Sem horário" em âmbar / "Turno X — desde DD/MM" em cinza) + atalho "selecionar todos sem horário".
- Botão "Aplicar a N selecionados" → nova Server Action `atribuirTurnoEmLote(funcionarioIds: string[], turnoId, dataInicio)`:
  - Roda em loop a mesma regra já existente em `alterarTurno` (`app/(admin)/efetivo/horario/actions.ts`) para cada `funcionarioId` — fecha vigente anterior (`data_fim = dataInicio - 1 dia`), insere novo registro, grava `movimentacoes`.
  - Sem transação atômica única (Supabase client não oferece multi-row transaction aqui, mesmo padrão de outros lotes do sistema) — cada item processado individualmente.
  - Retorna resultado por funcionário (sucesso/erro) — ex.: alguém cujo vigente começou depois da `dataInicio` escolhida falha isoladamente (mesma validação de data já existente), sem travar o restante do lote. Modal exibe resumo: "N aplicados, M falharam" com detalhe por nome.
- Serve tanto para zerar o backlog atual (99% pendente) quanto como rede de segurança para os casos do Bloco C em que não havia turno cadastrado no destino no momento da solicitação.

## Bloco C — Vínculo automático de horário na solicitação

### Regra central

Turno vigente deixa de ser válido quando:
- `posto_id` muda **e** a condição jovem-aprendiz é a mesma antes/depois (turno de posto normal é por posto); **ou**
- a condição jovem-aprendiz muda (entra ou sai dela) — turno de jovem aprendiz é global, não por posto, então essa transição sempre exige nova escolha independentemente do posto.

```ts
function precisaNovoTurno(
  postoAtual: string | null, postoNovo: string | null,
  jovemAtual: boolean, jovemNovo: boolean,
): boolean {
  if (jovemAtual !== jovemNovo) return true
  if (jovemAtual && jovemNovo) return false // ambos jovem aprendiz: turno global, posto irrelevante
  return postoAtual !== postoNovo
}
```

Aplica-se igualmente aos 3 fluxos abaixo — todos eles, no fundo, só alteram `posto_id` e/ou `funcao_id` de um funcionário.

### UI — `modal-nova-solicitacao.tsx`

Quando a regra acima disparar (calculada a partir das seleções já feitas no formulário), aparece um bloco extra "Novo turno de trabalho":
- Fonte da lista: `listarTurnosDoPosto(postoResultante)` (posto normal) ou `listarTurnosJovemAprendiz()` (+ campo "Dia de curso") quando a função resultante for jovem aprendiz.
- **Transferência**: bloco aparece se `posto_destino_id !== funcionario.posto_id` e a função resultante (atual, ou nova se "mudar função junto" marcado) não for jovem aprendiz; ou se a mudança de função ativa/desativa jovem aprendiz.
- **Mudança de função**: bloco aparece só se a nova função ativa/desativa jovem aprendiz (mudança de função "normal", sem tocar jovem-aprendiz e sem mudar posto, não precisa — turno do posto continua válido).
- **Retorno de afastamento**: bloco aparece só se o posto de retorno escolhido for diferente do posto original do funcionário.
- Se a lista carregada vier vazia (posto/condição destino ainda sem turno cadastrado): bloco não bloqueia envio — mostra aviso inline "sem turno cadastrado nesse destino — ficará pendente de atribuição" (resolvido depois pelo Bloco B). Se a lista tiver itens, seleção é obrigatória para enviar.
- Campo enviado no `FormData`: `turno_destino_id` (+ `dia_curso_destino` quando aplicável).

### Persistência na solicitação

`solicitarTransferencia`, `solicitarMudancaFuncao`, `solicitarRetornoAfastamento` (`app/(admin)/efetivo/actions.ts`) passam a gravar, quando presentes no `FormData`, `turno_destino_id` e `dia_curso_destino` dentro de `dados_depois` — mesma estrutura JSON já usada para os demais campos de cada tipo.

### Aplicação na aprovação — `aprovacoes/actions.ts`

Novo helper compartilhado em `app/(admin)/efetivo/horario/actions.ts`:

```ts
async function aplicarMudancaHorario(
  funcionarioId: string,
  turnoDestinoId: string | null,
  diaCurso: number | null,
  dataEfetivacao: string,
  criadoPor: string,
)
```

- Busca o vigente atual (`horarios_funcionarios` com `data_fim IS NULL`); se existir, fecha com `data_fim = dataEfetivacao - 1 dia`.
- Se `turnoDestinoId` foi informado (veio da solicitação): insere novo registro (`turno_id`, `data_inicio = dataEfetivacao`, `dia_curso`, `criado_por`) — igual ao segundo passo de `alterarTurno`.
- Se `turnoDestinoId` é `null` (destino sem turno cadastrado no momento do pedido): só fecha o vigente, funcionário fica sem horário até atribuição manual (Bloco B).
- Idempotente/seguro de chamar mesmo quando não havia necessidade de troca (`turnoDestinoId` null e sem vigente): não faz nada.

Chamado nos 3 `case`s de `aprovarSolicitacao`, logo após o `update` de `posto_id`/`funcao_id`, com `dataEfetivacao = hoje` e os valores de `dados_depois.turno_destino_id`/`dia_curso_destino`.

## Migração e compatibilidade

- Nenhuma migração de banco. Tudo é lógica de servidor + UI + uma constante estática nova.
- `horarios_funcionarios` e `turnos_postos` mantêm o schema atual.
- Solicitações já pendentes no momento do deploy (criadas antes desta mudança) não têm `turno_destino_id` em `dados_depois` — na aprovação, `aplicarMudancaHorario` trata isso como "sem turno informado": fecha o vigente (se a regra mandar) e deixa pendente, sem quebrar.

## Plano de verificação

Sem testes automatizados no projeto (`npm run build` + `npx tsc --noEmit` são o gate padrão do repositório). Verificação manual necessária antes de considerar concluído:

1. **Catálogo (Bloco A)**: abrir Postos → Gerenciar → Turnos em posto 5x2 e em posto 5x1, criar turno a partir de item do catálogo, conferir horários preenchidos e salvos corretamente; confirmar que posto 12x36 continua sem catálogo.
2. **Lote (Bloco B)**: aplicar turno a múltiplos funcionários de um posto de uma vez; testar caso de erro isolado (funcionário com vigente que começa depois da data escolhida) sem travar os demais; confirmar jovem aprendiz não aparece na lista.
3. **Vínculo automático (Bloco C)**:
   - Transferência entre postos (função não-jovem-aprendiz em ambos) → bloco de turno aparece, aprovação fecha o vigente antigo e abre o novo na data de aprovação.
   - Transferência sem mudar função, funcionário jovem aprendiz nos dois lados → bloco de turno NÃO aparece, turno permanece o mesmo após aprovação.
   - Mudança de função entrando em jovem aprendiz → bloco de turno (com dia de curso) aparece; aprovação fecha o vigente e cria o novo com `dia_curso`.
   - Retorno de afastamento para posto diferente do original → bloco aparece; retorno para o mesmo posto → não aparece, horário anterior ao afastamento permanece vigente sem alteração.
   - Destino sem turno cadastrado → solicitação enviada sem `turno_destino_id`, aprovação fecha o vigente e deixa pendente; funcionário aparece na tela de lote (Bloco B) do posto novo.
4. Rodar `npm run build` sem erros ao final.

## Fora de escopo / não resolvido por este trabalho

- Backlog de coberturas ativas com posto temporário divergente do posto cadastrado — não analisado aqui, comportamento de `coberturas/actions.ts` inalterado.
- Unificação dos turnos de jovem aprendiz por posto (continuam globais, `posto_id IS NULL`).
- Qualquer aviso proativo (ex.: notificação/pendência) para horários que ficaram em aberto por falta de turno cadastrado no destino — hoje só descobertos ao abrir a tela de lote do posto correspondente.
