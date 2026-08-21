# Análise geral — relatório consolidado em Markdown

## Contexto

Usuário quer avaliar de forma cruzada: atestados, faltas, mudanças de função,
coberturas insalubres, efetivo x postos e advertências — buscando problemas,
falhas e situações graves. Decisão (após brainstorm): não integrar API de IA
dentro do sistema. Em vez disso, o sistema gera um relatório completo em
Markdown com os dados brutos, já com um prompt de análise embutido no topo,
pronto pra ser colado numa IA (Claude) externamente pelo usuário.

## Rota e acesso

- `app/(admin)/relatorios/analise-geral/page.tsx` + `actions.ts`, seguindo o
  padrão das demais páginas em `relatorios/*`.
- Acesso restrito a `admin` e `coordenador` (mesmo padrão de outras páginas de
  gestão estratégica). `supervisor`/`viewer` sem acesso — página não aparece
  no menu e é bloqueada se acessada direto pela URL.

## UI

- Select de período: 30 / 60 / 90 dias (padrão: 90).
- 6 checkboxes, todos marcados por padrão:
  - Atestados
  - Faltas
  - Mudanças de função
  - Coberturas insalubres
  - Efetivo x postos
  - Advertências
- Botão "Gerar relatório MD" (`bg-slate-900 text-white hover:bg-slate-700`,
  padrão do design system).

## Fluxo

1. Client chama Server Action `gerarAnaliseGeral(periodoDias, secoes[])`.
2. Action consulta (via `fetchAllRows`, evitando o limite de 1000 linhas do
   PostgREST) apenas as tabelas das seções marcadas, filtrando pela janela de
   tempo selecionada — exceto Efetivo x Postos, que é sempre snapshot do
   estado atual (não é um evento histórico, é uma situação corrente).
3. Action monta uma string Markdown única:
   - Cabeçalho com o **prompt de análise** (texto fixo, ver abaixo),
     preenchendo período e data de geração.
   - Uma seção `## <Nome da seção>` por bloco marcado, na ordem: Atestados,
     Faltas, Mudanças de Função, Coberturas Insalubres, Efetivo x Postos,
     Advertências.
   - Cada seção vira uma tabela Markdown. Seção sem registros no período
     imprime "Nenhum registro no período." em vez de tabela vazia ou de
     omitir a seção — mantém estrutura previsível pra quem for colar numa IA
     depois.
4. Client recebe a string e dispara download de arquivo local via Blob:
   `analise-geral-{periodo}dias-{YYYY-MM-DD}.md`. Nenhuma chamada a API
   externa é feita pelo sistema.

## Prompt embutido (cabeçalho fixo do .md)

```
# Prompt para análise

Você é um especialista em RH, Gestão de Pessoas e Medicina do Trabalho.
Analise os dados abaixo (relatório consolidado do período de {dataInicio} a
{dataFim}, gerado em {dataGeracao}) e produza um diagnóstico apontando:
- Problemas, falhas e situações graves ou fora do padrão
- Riscos (saúde ocupacional, rotatividade, conformidade, operacional)
- Padrões preocupantes (ex.: funcionários com atestados recorrentes, postos
  com déficit crônico de efetivo, concentração de advertências)
- Recomendações práticas e priorizadas

---
```

`{dataInicio}` e `{dataFim}` são calculados a partir do período escolhido
(hoje − N dias até hoje); `{dataGeracao}` é a data/hora do clique. Todos
substituídos pelos valores reais na geração — nunca o texto "90 dias" solto,
sempre o intervalo de datas concreto.

## Dados por seção

- **Atestados** (`atestados` + `funcionarios`): funcionário, posto, CID,
  período (data início–fim), dias, status.
- **Faltas** (`faltas` + `funcionarios`): funcionário, posto, data,
  justificada/injustificada, motivo.
- **Mudanças de função** (`movimentacoes` tipo mudança de função +
  `solicitacoes` pendentes do mesmo tipo): funcionário, função anterior →
  nova, posto, data, status (efetivada/pendente).
- **Coberturas insalubres** (`insalubridade_coberturas`): funcionário
  coberto, funcionário cobridor, posto, período, `tipo_motivo`.
- **Efetivo x Postos**: por posto, efetivo necessário vs efetivo atual,
  déficit/superávit — snapshot atual, reaproveitando a lógica já usada no
  dashboard.
- **Advertências** (`advertencias` + `funcionarios`): funcionário, posto,
  data, tipo, motivo.

## Dados sensíveis

CPF nunca aparece em nenhuma seção (não é necessário pro propósito do
relatório). Nomes de funcionários aparecem normalmente, como em outras telas
internas de gestão.

## Erros

Server Action com try/catch; falha retorna `{ error }` pro client, sem
quebrar a página. Nenhum estado parcial é salvo — geração é sempre
determinística a partir do banco no momento do clique.

## Teste

- `npm run build` sem erros.
- Gerar com todas as seções marcadas.
- Gerar com subconjunto de seções.
- Gerar período sem nenhum registro numa seção (placeholder correto).
- Conferir que o download funciona e o prompt aparece certo no topo do
  arquivo.
- Conferir bloqueio de acesso pra supervisor/viewer.
