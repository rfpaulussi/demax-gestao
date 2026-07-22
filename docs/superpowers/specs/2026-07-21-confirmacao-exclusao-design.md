# Confirmação de exclusão — digitar "deletar"

**Data:** 2026-07-21
**Status:** Aprovado para implementação

## Contexto e problema

O sistema tem hoje **~10 pontos de exclusão definitiva** (dado apagado do banco pra sempre, sem soft-delete) espalhados por 10 telas diferentes, cada uma com seu próprio mecanismo de confirmação — levantamento encontrou **5 padrões distintos coexistindo**: `window.confirm()` nativo do navegador, um modal customizado bespoke (advertências), toggle inline na própria linha da tabela (atestados, usuários, horário do funcionário), o componente `AlertDialog` reutilizável (usado só em mudanças de função), e **nenhuma confirmação** em pelo menos um caso (remoção de dia de cobertura de insalubridade).

Essa inconsistência é arriscada — um clique acidental em telas sem confirmação forte apaga dado de RH sem chance de desfazer. A mudança proposta: exigir que o usuário digite a palavra "deletar" antes de qualquer exclusão definitiva ser executada, com um componente único reaproveitado em todos os pontos.

## Escopo

**Dentro do escopo:** os ~10 pontos de exclusão **definitiva** (DELETE SQL, irreversível):
- Efetivo: exclusão completa de cadastro de funcionário (`excluirFuncionarioCompleto`)
- Horário do funcionário: exclusão de registro histórico (`deletarHorarioFuncionario`)
- Férias (`excluirFerias`)
- Faltas (`removerFalta`)
- Atestados (`deleteAtestado`)
- Advertências (`excluirAdvertencia`)
- Acordos de compensação (`excluirAcordo`)
- Insalubridade: remoção de dia de cobertura (`removerDia`) e exclusão de cobertura (`excluirCobertura`)
- Mudanças de função (`excluirMudancaFuncao`)

**Fora de escopo (decisão explícita):**
- Desativações/soft-delete — postos (`desativarPosto`), turnos (`desativarTurno`), usuários (`toggleAtivo`), supervisores (`desvincularPosto`). São reversíveis (o dado continua no banco, `ativo=false`), então a confirmação simples que já existe em cada uma é suficiente; não precisam da camada extra.
- Exclusão de notificações do sino (`excluirNotificacoesLidas`, `excluirNotificacaoIndividual` em `components/admin/notificacoes-bell.tsx`) — continua sem qualquer confirmação, como já é hoje. É a exceção explícita pedida.
- O arquivo residual `components/mudancas-funcao/mudancas-funcao-client.tsx.tmp.5740.ae4fe052bea9` (aparenta ser sobra de editor) não é tocado por este trabalho — assunto separado.

## Componente `ConfirmarExclusaoDialog`

Novo componente em `components/ui/confirmar-exclusao-dialog.tsx`, construído sobre o `AlertDialog` já existente (`components/ui/alert-dialog.tsx`), único ponto usado hoje (mudanças de função) — vira a base compartilhada por todos os 10 casos.

```tsx
interface ConfirmarExclusaoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  titulo: string
  descricao?: string
  onConfirmar: () => Promise<{ success: boolean; error?: string }>
}
```

- `titulo`: obrigatório, customizado por tela (ex: "Excluir férias de João Silva?", "Excluir advertência?").
- `descricao`: opcional; se omitido, usa um texto padrão fixo ("Esta ação é irreversível. O registro será apagado permanentemente.").
- Campo de texto interno, exige que o valor digitado (`trim().toLowerCase()`) seja exatamente `"deletar"` — aceita qualquer combinação de maiúsculas/minúsculas. Botão "Excluir" fica desabilitado até o texto bater.
- Ao confirmar: chama `onConfirmar()`, mostra estado de carregamento no botão. Se `{success: false}`, mostra `error` (ou uma mensagem genérica de fallback) dentro do próprio diálogo, sem fechar — deixa o usuário tentar de novo ou cancelar. Se `{success: true}`, fecha o diálogo (via `onOpenChange(false)`) e limpa o campo de texto.
- Cancelar/fechar sempre limpa o campo de texto (não deve persistir "deletar" digitado se o usuário reabrir o diálogo depois pra outro item).

Cada uma das 10 telas mantém sua própria Server Action e seu próprio gatilho (botão/ícone de lixeira) — a única mudança é trocar o mecanismo de confirmação atual (seja ele qual for) por este componente, guardando o id/objeto do item a excluir em um state local (`itemParaExcluir`) até o diálogo confirmar.

## Contrato de retorno das Server Actions

O componente assume que `onConfirmar` sempre resolve para `{ success: boolean; error?: string }` — o padrão já usado pela maioria das actions deste projeto (confirmado em `alterarTurno`, `criarTurno`, etc. em trabalhos anteriores desta mesma sessão). Ao implementar, cada uma das 10 Server Actions envolvidas precisa ser conferida individualmente contra esse contrato exato antes de ligar o componente — se alguma tiver um shape de retorno diferente, o call site adapta o retorno (wrapper local), sem alterar a Server Action em si.

## Fora de escopo / não resolvido por este trabalho

- Não uniformiza o texto/copy de cada tela além do necessário (cada `titulo` continua específico da tela).
- Não adiciona a camada extra a nenhuma desativação/soft-delete.
- Não mexe no sino de notificações.
- Não remove o arquivo residual `.tmp.*` encontrado durante o levantamento.
