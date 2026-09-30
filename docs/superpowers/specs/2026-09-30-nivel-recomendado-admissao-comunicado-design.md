# Nível recomendado na IA + Data de admissão no dossiê + Comunicado de Desligamento

## Contexto

Três pedidos pequenos e independentes, surgidos usando o dossiê/IA em produção:

1. Testando a IA, o coordenador notou que a resolução sugerida nunca aponta dispensa como opção, mesmo quando o histórico mostra padrão recorrente sem melhora. Precisa de um jeito explícito da IA sinalizar isso.
2. O dossiê mostra posto/secretaria/RE/CPF no cabeçalho, mas não a data de admissão.
3. A empresa tem um formulário físico oficial ("COMUNICAÇÃO DE DESLIGAMENTO", RH) que hoje é preenchido totalmente à mão. O admin quer poder gerar esse PDF pré-preenchido a partir do dossiê, só nos casos em que está avaliando uma ocorrência e considerando dispensa — não como parte do fluxo formal de aprovação de desligamento (que já existe em `/desligamentos` e `/aprovacoes`, sem relação com isto).

## Objetivo

Cada item entra sem tocar no que já existe fora do necessário:
1. Análise de IA ganha um campo de nível recomendado (orientar/advertir/suspender/dispensar), com aviso claro sobre como tratar dispensa.
2. Cabeçalho do dossiê ganha a data de admissão.
3. Modal do dossiê ganha um botão, só para admin/coordenador, que gera um PDF do comunicado com os poucos campos que o sistema já sabe, e o resto em branco pra preencher à mão.

## Escopo

Inclui os três itens acima. Fora de escopo:
- Qualquer e-mail ou fluxo de aprovação para o gerente operacional (decisão do usuário: isso é tratado pessoalmente, fora do sistema).
- Botão do comunicado em Efetivo, Desligamentos ou Aprovações — só no dossiê, só admin/coordenador.
- Qualquer tentativa de preencher automaticamente causa, motivo, devolução de uniforme, exame demissional, será substituído, data de desligamento ou assinaturas — ficam em branco por decisão explícita (são campos que dependem de decisão humana e checagem física, não de dado que o sistema já tem certeza).
- Mudança no fluxo/tabela `/desligamentos` existente.

## 1. Nível recomendado na análise de IA

**Schema (`lib/ocorrencias/ia/schema.ts`):**
```typescript
export const NIVEIS_RECOMENDADOS = ['orientar', 'advertir', 'suspender', 'dispensar'] as const
export type NivelRecomendado = (typeof NIVEIS_RECOMENDADOS)[number]
```
Novo campo obrigatório em `AnaliseOcorrencia`: `nivel_recomendado: NivelRecomendado`. Entra na `FERRAMENTA_ANALISE` (`input_schema.properties.nivel_recomendado`, enum dos 4 valores, `required`) e em `lerAnalise` (valida contra a lista, sem fallback silencioso — se vier fora da lista, `lerAnalise` devolve `null`, igual já acontece hoje para `categoria`/`urgencia` inválidos).

**Prompt (`lib/ocorrencias/ia/prompt.ts`):** acrescentar ao `PROMPT_ANALISE`, no mesmo estilo dos bullets já existentes:
- `orientar`: caso pontual, sem padrão recorrente.
- `advertir`: já houve conversa/orientação sobre o mesmo tipo de problema antes, sem melhora, ou a gravidade justifica registro formal.
- `suspender`: repetição após advertência já registrada, ou gravidade alta com risco à operação.
- `dispensar`: só quando o relato E o histórico mostram padrão recorrente do mesmo problema, já tratado antes (conversa, mudança de setor, advertência) e sem melhora — nunca por um episódio isolado, mesmo que grave.

Deixar explícito no prompt: `nivel_recomendado` é independente de `encaminhar_rh` — a IA decide os dois campos separadamente, sem forçar um a partir do outro.

**Tela (`components/ocorrencias/modal-analise-ia.tsx`):** selo próprio ao lado de categoria/urgência (mesma linha), com rótulo e cor por nível:
- `orientar`: cinza (`bg-gray-100 text-gray-600`)
- `advertir`: âmbar (`bg-amber-100 text-amber-700`)
- `suspender`: laranja (`bg-orange-100 text-orange-700`)
- `dispensar`: vermelho (`bg-red-100 text-red-700`)

Quando `nivel_recomendado === 'dispensar'`, mostrar um aviso fixo abaixo do selo, sem botão nem link:
> "Decisão de dispensa é tratada diretamente com o gerente operacional. O sistema não envia nada automaticamente."

## 2. Data de admissão no dossiê

**Actions (`app/(admin)/ocorrencias/actions.ts`):**
- `getDossieFuncionario`: a query de funcionário (`.select('id, nome, cpf, registro, postos!posto_id(nome, secretaria)')`, dentro da função) ganha `data_admissao` na lista de colunas.
- `DossieFuncionario.funcionario` ganha o campo `dataAdmissao: string | null`.

**Tela (`components/ocorrencias/modal-dossie.tsx`):** na linha do cabeçalho que já mostra `{posto} — {secretaria} · RE {registro} · CPF {cpf mascarado}`, acrescentar `· Admissão {data formatada dd/mm/aaaa}` quando `dataAdmissao` existir (mesmo padrão de formatação de data já usado no resto do arquivo, `new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR')`).

## 3. Comunicado de Desligamento (PDF)

**Componente novo (`components/ocorrencias/comunicado-desligamento-pdf.tsx`):** mesmo padrão de `components/advertencias/advertencia-pdf.tsx` (`@react-pdf/renderer`, `Document`/`Page`/`View`/`Text`/`StyleSheet`, função `downloadComunicadoDesligamentoPDF(dados)` com import dinâmico de `pdf`, blob, link temporário, nome de arquivo sanitizado). Reproduz o layout do formulário físico (visto em `COMUNICADO DE DESLIGAMENTO.xlsx`, aba "FORMULÁRIO EM BRANCO"):

- Título "COMUNICAÇÃO DE DESLIGAMENTO" + "RECURSOS HUMANOS" (mesmo cabeçalho DEMAX dos outros PDFs).
- Linha: **Nome** (preenchido) — **RE** (preenchido).
- Linha: **Função** (preenchido) — **Contrato** (em branco, linha pra preencher à mão).
- Bloco **Causa**: as 6 opções do formulário original como checkboxes desenhados vazios (retângulo sem marca), um ao lado do outro, exatamente como no físico — nenhuma pré-marcada:
  - Pedido de Demissão
  - Reprova na Experiência
  - Dispensa sem Justa Causa Indenizado
  - Dispensa com Justa Causa
  - Dispensa sem Justa Causa Trabalhado
  - Falecimento
- **Motivo(s):** linha em branco (espaço pra escrever).
- Linha: **Devolução de uniforme** (checkboxes Sim/Não vazios) — **Exame** (linha `____/____/____` em branco).
- Linha: **Data Admissão** (preenchida, formato dd/mm/aaaa) — em branco não, essa é a única data preenchida.
- Linha: **Será substituído** (checkboxes Sim/Não vazios) — **Data Desligamento** (linha `____/____/____` em branco).
- Rodapé: 5 colunas de assinatura, cada uma só com uma linha em branco e o rótulo abaixo: Diretoria, Coordenador, Supervisor, RH, Gerente Operacional (nenhum nome preenchido — são assinaturas físicas).
- Rodapé do documento (padrão DEMAX): "DEMAX Serviços e Comércio LTDA · Emitido em {data}".

**Dados de entrada** (tipo `DadosComunicadoDesligamento`): `{ nome: string; registro: string | null; funcao: string | null; dataAdmissao: string | null }`. Vem do que já está carregado no `dossie` do modal — sem nova chamada ao servidor.

**Botão no modal do dossiê (`modal-dossie.tsx`):** "Comunicado de Desligamento", visível só quando `auth`/`canWrite` indicar `admin` ou `coordenador` (mesma checagem de papel já usada pelos botões "Encaminhar ao RH"/"Analisar com IA" — reaproveitar a mesma flag `ehGestao` já existente no componente). Fica junto dos outros botões de gestão da timeline, mas fora do bloco por-ocorrência: é um botão do dossiê como um todo (mesmo lugar do "Baixar PDF" geral), não de uma ocorrência específica.

## Permissões

- Nível recomendado: informação dentro da análise de IA, já restrita a admin/coordenador (sem mudança de escopo).
- Data de admissão: mesma visibilidade do resto do cabeçalho do dossiê (todo papel que já abre o dossiê).
- Comunicado de Desligamento: só admin/coordenador. Supervisor e viewer não veem o botão.

## Testes / verificação

- `npm test`: novo teste em `lib/ocorrencias/ia/schema.test.ts` cobrindo `nivel_recomendado` (aceita os 4 valores, recusa fora da lista).
- `npx tsc --noEmit` e `npm run build` limpos.
- QA manual: rodar "Analisar com IA" num caso recorrente e ver o selo `dispensar` com o aviso; ver a data de admissão no cabeçalho do dossiê; baixar o Comunicado de Desligamento como admin e confirmar nome/RE/função/admissão preenchidos e o resto em branco; confirmar que supervisor não vê o botão do comunicado.
