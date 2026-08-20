# Agrupamento de Atestados por Episódio (INSS) — Design

## Contexto

O botão "Solicitar INSS" na tela `/atestados` abre um modal pré-preenchido pra gerar um atestado "guarda-chuva" cobrindo o período do afastamento acumulado, usado pra formalizar o pedido de auxílio-doença ao INSS. Hoje o pré-preenchimento tem dois problemas:

1. **`dias`** vem da soma bruta de dias de *todos* os atestados do funcionário cuja `data_fim` caiu nos últimos 30 dias (qualquer CID, qualquer motivo) — não distingue se são a mesma doença ou doenças diferentes, e a soma de dias individuais subestima o período real quando há um intervalo (gap) sem atestado entre dois lançamentos da mesma doença.
2. **`data_inicio`** vem do atestado mais antigo de *toda a história* do funcionário (`primeiroAtestadoMap`), não respeitando nem a janela de 30 dias nem qualquer noção de "mesma doença" — pode produzir uma data de início completamente desconectada do afastamento atual.

Regra real do INSS/CLT que precisa ser capturada: os primeiros 15 dias de um afastamento são pagos pela empresa; a partir do 16º dia o INSS assume. Se o funcionário tem um novo atestado da **mesma doença** dentro de **60 dias corridos** do atestado anterior, os períodos se somam como um único episódio pra essa contagem — não reinicia os 15 dias. CID diferente, ou gap maior que 60 dias, conta como episódio novo.

## Objetivo

Calcular corretamente o período do "episódio de doença" que contém o atestado que disparou o alerta, e pré-preencher o modal de Solicitar INSS com esse período — mantendo todos os campos editáveis pra quando o julgamento médico da empresa divergir da regra automática.

## Regra de agrupamento (episódio)

Dado um atestado-âncora (o que gerou o alerta "Avaliar INSS"), o episódio é formado caminhando cronologicamente pra trás e pra frente a partir dele, incluindo o atestado vizinho seguinte enquanto, entre os dois:

- **CID compatível**: código exatamente igual, OU um dos dois é "sem CID" (atua como ponte — não quebra o encadeamento mesmo que o CID do outro lado seja diferente).
- **Gap ≤ 60 dias corridos**: dias entre o fim de um atestado e o início do próximo (exclusive) não pode passar de 60.

Ambas as condições precisam valer pro par ser encadeado. O processo para quando nenhum vizinho (pra trás ou pra frente) satisfaz as duas condições.

**Resultado do episódio:**
- `dataInicio` = `data_inicio` do primeiro atestado do grupo
- `dataFim` = `data_fim` do último atestado do grupo
- `dias` = span de calendário entre `dataInicio` e `dataFim` (inclusive) — **não** a soma dos `dias` individuais de cada atestado. Isso cobre corretamente qualquer gap interno dentro da janela de 60 dias (dias em que o funcionário não tinha atestado registrado, mas que a regra do INSS trata como parte do mesmo benefício).
- `atestadosIncluidos` = lista dos atestados que entraram no grupo (id, data_inicio, data_fim, cid_codigo) — exibida no modal pra transparência.

## Arquitetura

**`lib/atestados/episodio-inss.ts`** (função pura, nova):

```typescript
export type AtestadoParaEpisodio = {
  id: string
  dataInicio: string  // ISO yyyy-mm-dd
  dataFim: string
  cidCodigo: string | null
}

export type EpisodioInss = {
  dataInicio: string
  dataFim: string
  dias: number
  atestadosIncluidos: AtestadoParaEpisodio[]
}

export function calcularEpisodioInss(
  atestadoAncoraId: string,
  atestados: AtestadoParaEpisodio[],
): EpisodioInss
```

Lança erro (ou retorna null — decidir na implementação) se `atestadoAncoraId` não estiver presente em `atestados`.

**Server Action nova em `app/(admin)/atestados/actions.ts`:**

```typescript
export async function calcularEpisodioInssAction(
  funcionarioId: string,
  atestadoAncoraId: string,
): Promise<EpisodioInss | { erro: string }>
```

Busca **todos** os atestados daquele `funcionario_id` direto no Supabase (não usa o array já carregado/filtrado no client, que pode estar incompleto por causa de filtros de busca/data ativos na tela), monta `AtestadoParaEpisodio[]`, chama `calcularEpisodioInss`.

## Fluxo na UI

Em `components/atestados/atestados-client.tsx`:

1. Clique em "Solicitar INSS" (mesmo botão, mesma condição de exibição — `isAdmin && ultimoAlertaIds.has(a.id)`) chama `calcularEpisodioInssAction(a.funcionario_id, a.id)` (loading state no botão).
2. Resultado preenche o `InssModalState`: `data_inicio = episodio.dataInicio`, `dias = episodio.dias`.
3. O modal (`ModalSolicitarInss`) ganha uma seção nova, somente leitura, listando os atestados que entraram no episódio (data início → fim, CID ou "Sem CID"), pra o admin conferir visualmente antes de ajustar.
4. Todos os campos do formulário continuam editáveis exatamente como hoje — nenhuma trava nova. Esse é o mecanismo de override quando a médica da empresa discordar do agrupamento automático.
5. Em caso de erro na Server Action, mostra a mensagem de erro no modal e mantém o fallback atual (`primeiroAtestadoMap`/`a.acumulado`) como pré-preenchimento — não bloqueia a abertura do modal.

## O que NÃO muda

- O badge "⚠️ Avaliar INSS" na listagem principal continua usando a soma bruta por janela de 30 dias (`acumulado`), sem lógica de episódio — serve como sinalização ampla, não precisa ser precisa.
- Nenhuma mudança em `atestados/page.tsx`, no cálculo de `acumuladoMap`, ou nas Rankings da aba "Ranking".
- Nenhuma mudança na tela de Auditoria SESMT (`/auditoria-atestados`) — é um problema totalmente separado, já resolvido em sessão anterior.

## Testes (harness manual, sem test runner no projeto)

`calcularEpisodioInss` é pura — validar com harness descartável (`npx tsx`) cobrindo:
1. Único atestado (episódio = ele mesmo).
2. Dois atestados mesmo CID, gap 10 dias → agrupa, `dias` = span completo (cobre o gap).
3. Dois atestados CID diferente, gap 5 dias → não agrupa (episódio = só o âncora).
4. Dois atestados, um "sem CID", gap 30 dias → agrupa (ponte).
5. Dois atestados mesmo CID, gap 61 dias → não agrupa (passou de 60).
6. Cadeia de 3 atestados (A-B mesmo CID gap 10, B-C CID diferente gap 5) com âncora em B → inclui A e B, não inclui C.
7. Âncora não encontrado na lista → erro.

## Fora de escopo

- Mudar a lógica do badge "Avaliar INSS" pra usar episódio.
- Persistir o agrupamento no banco (é recalculado a cada abertura do modal).
- Vincular/desvincular atestados manualmente no cadastro (override é só via edição dos campos do modal, não altera os atestados-fonte).
