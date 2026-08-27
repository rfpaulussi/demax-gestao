# Contexto Compactado — Auditoria SESMT, Episódios INSS e Gestão de Afastamentos (demax-gestao)

**Data da compactação:** 2026-08-21
**Chat original:** sessão longa, múltiplas features sequenciais (~200+ mensagens)

---

## 1. Objetivo

Sistema `demax-gestao` (Next.js 14 + Supabase, RH/operações de contrato de limpeza/áreas verdes). Sessão cobriu 5 features sequenciais, todas girando em torno de **atestados médicos e afastamentos INSS**: (1) auditar planilha do SESMT contra o sistema, (2) corrigir cálculo de agrupamento de atestados pra fins de INSS, (3) dar visibilidade a retornos de INSS vencidos, (4) permitir prorrogar/cadastrar data de retorno, (5) mostrar essa data na tabela principal de funcionários.

## 2. Decisões Tomadas

- **Módulo novo `auditoria-atestados`, não reaproveitar `/atestados`:** comparação SESMT×sistema é conceito distinto do CRUD de atestados existente.
- **Upload `.xlsx` (não `.md`)** pro arquivo do SESMT — usa `xlsx-js-style`, já dependência do projeto.
- **Match por matrícula**: SESMT usa `001-000-XXXXXX`, sistema usa `funcionarios.registro` (só os dígitos finais, sem zero à esquerda — `parseInt` remove).
- **Sem CID "pontes"** no agrupamento de episódio INSS: um atestado sem CID conecta dois atestados vizinhos mesmo que os CIDs dos dois lados sejam diferentes (falta de informação, não pode assumir divergência).
- **Janela de 60 dias corridos** entre atestados da mesma doença (mesmo CID) = mesmo "episódio" pra fins da regra dos 15 dias pagos pela empresa antes do INSS assumir.
- **`dias` do episódio = span calendário** (primeiro início → último fim), não soma dos dias individuais — corrige bug onde gaps entre atestados eram perdidos na conta.
- **Alerta "Retorno INSS Vencido" não distingue doença** — soma bruta por 30 dias, propositalmente mais abrangente que o cálculo fino do episódio (que só entra no modal "Solicitar INSS").
- **Sino do supervisor precisou de tabela nova** (`alertas_supervisor`) — o sino dele hoje só mostra status de solicitações que ELE enviou, não tinha canal de "alerta do sistema". Tabela genérica, não específica de INSS, pra servir alertas futuros.
- **`log_supervisor_acoes`** (existente) reaproveitada pro sino do admin — mesmo padrão do `alerta_ferias` já existente (1 registro/dia, dedupe por tipo+data).
- **Prorrogar = edição direta**, sem fluxo de aprovação (o afastamento original já foi aprovado uma vez).
- **Prorrogar também cadastra** quando não existe `afastamentos` aberto — funcionário pode estar `status='afastado'` sem nenhum registro rastreado (ex: setado via edição manual fora do fluxo normal) → botão "Prorrogar" nesse caso mostra formulário de CADASTRO (data início + data prevista) em vez de aviso morto.
- **Coluna "Retorno Previsto"** na tabela Efetivo: "sem data" (cinza itálico) / data normal / vermelho+"(vencido)" — só populada quando `status='afastado'`.
- **"Vencido" = `data_fim_prevista <= hoje`** (inclusive) — consistente entre dashboard, sino e coluna da tabela (achamos e corrigimos uma inconsistência `<` vs `<=` durante revisão).
- **Migrations do Supabase sempre aplicadas manualmente pelo usuário** no SQL Editor — Claude nunca aplica DDL sozinho.
- **Todo trabalho em worktree isolado** (`EnterWorktree`/`ExitWorktree`), merge em master só após aprovação explícita, push só com confirmação.
- **Todo código revisado em 2 estágios** (spec compliance + code quality) por subagentes antes de aprovar — vários bugs reais pegos nesse processo (ver seção 6).

## 3. Estado Atual

Tudo implementado, revisado, mergeado em `master` e **deployado em produção** (Vercel, https://demax-gestao.vercel.app). Branch `master` está no commit `16dc14a` (ou mais recente).

- ✅ **Auditoria SESMT** (`/auditoria-atestados`) — funcional, testado com dados reais.
- ✅ **Episódio INSS** — modal "Solicitar INSS" em `/atestados` recalculado corretamente.
- ✅ **Alerta Retorno INSS Vencido** — dashboard (KPI aviso) + sino admin + sino supervisor, cron `snapshot-diario` gera diariamente às 17:30. Migration `alertas_supervisor` **já aplicada** pelo usuário no Supabase — confirmado funcionando (testado com Sonia/Emily).
- ✅ **Prorrogar Afastamento** — botão na tabela Efetivo, edita OU cadastra conforme o caso. Testado com Adriana Aparecida Alves (caso sem registro).
- ✅ **Coluna "Retorno Previsto"** — testado, aparece corretamente.

**Correções manuais de dados feitas via script** (não via UI, autorizado explicitamente pelo usuário):
- SONIA REGINA DA SILVA: tinha 2 registros duplicados idênticos em `afastamentos` — 1 fechado (`data_fim_real` setado), outro estendido pra `data_fim_prevista = 2026-09-27`.
- EMILY LAUREN DE ALMEIDA MOREIRA: tinha registro antigo (24/07, órfão) + registro novo correto (06/08→25/08) — o antigo foi fechado (`data_fim_real = 2026-08-05`).

**Verificação manual (Task final de cada plano) não foi executada por mim** em nenhuma das 5 features — sem credenciais de login. Usuário (Rodolfo, admin) testou manualmente após cada deploy e confirmou funcionamento via screenshots.

## 4. Arquivos e Artefatos Relevantes

| Arquivo | Status | Descrição |
|---|---|---|
| `lib/auditoria-atestados/tipos.ts` | Criado | Tipos: `LinhaSesmt`, `AtestadoSistema`, `LinhaResultado`, `ResultadoAuditoria` |
| `lib/auditoria-atestados/parse.ts` | Criado | Parsing puro: matrícula, CID, dias indeterminados (999/9999), datas br |
| `lib/auditoria-atestados/comparar.ts` | Criado | Algoritmo de cruzamento SESMT×sistema, dedupe 1:1 guloso |
| `app/(admin)/auditoria-atestados/actions.ts` | Criado | Server Action `auditarSesmt`, `calcularEpisodioInssAction` NÃO é daqui (é de efetivo) |
| `app/(admin)/auditoria-atestados/page.tsx` | Criado | Página, guard admin/coordenador |
| `components/auditoria-atestados/upload-form.tsx` | Criado | Parse client-side do `.xlsx` |
| `components/auditoria-atestados/tabela-resultado.tsx` | Criado | 4 seções + export Excel |
| `components/auditoria-atestados/modal-lancar-atestado.tsx` | Criado | Lança atestado direto de "não lançados" |
| `lib/atestados/episodio-inss.ts` | Criado | `calcularEpisodioInss()` — agrupamento por episódio (60d, CID, span) |
| `app/(admin)/atestados/actions.ts` | Modificado | `calcularEpisodioInssAction` adicionada |
| `components/atestados/atestados-client.tsx` | Modificado | Modal Solicitar INSS usa episódio calculado (com guard de race condition) |
| `app/(admin)/dashboard/actions.ts` | Modificado | `retornosInssVencidos` em `AlertasDashboard` (admin) e `DadosSupervisor` (supervisor), dedupe por funcionário |
| `app/(admin)/dashboard/page.tsx` | Modificado | Renderiza alerta admin+supervisor, aviso nos cards KPI |
| `components/dashboard/alertas-criticos.tsx` | Modificado | Bloco "Retorno INSS Vencido" (admin) |
| `app/api/cron/snapshot-diario/route.ts` | Modificado | `alertarRetornosInssVencidos` (admin) + `alertarRetornosInssVencidosSupervisores` (por supervisor, agrupado por posto) |
| `supabase/migrations/20260821_alertas_supervisor.sql` | Criado, **aplicado** | Tabela nova, RLS por `supervisor_id` |
| `components/admin/notificacoes-bell.tsx` | Modificado | Sino admin — novo tipo `alerta_retorno_inss` |
| `components/admin/supervisor-bell.tsx` | Modificado | Sino supervisor — canal `alertas_supervisor` novo, unread combinado |
| `app/(admin)/notificacoes/actions.ts` | Modificado | `marcarAlertasSupervisorLidos` |
| `app/(admin)/layout.tsx` | Modificado | Busca `alertas_supervisor` do usuário logado |
| `components/efetivo/efetivo-client.tsx` | Modificado | Lê `?busca=` da URL (fix de link morto vindo do alerta) |
| `app/(admin)/efetivo/actions.ts` | Modificado | `buscarAfastamentoAberto`, `prorrogarAfastamento`, `cadastrarAfastamentoRastreado` |
| `components/efetivo/modal-prorrogar-afastamento.tsx` | Criado | Modal com modo edição + modo cadastro |
| `components/efetivo/funcionarios-table.tsx` | Modificado | Botão "Prorrogar", coluna "Retorno Previsto", campo `data_fim_prevista_afastamento` em `FuncionarioRow` |
| `app/(admin)/efetivo/page.tsx` | Modificado | Query `afastamentoPrevistoMap`, merge no enrichment |

Specs e planos (todos em `docs/superpowers/specs/` e `docs/superpowers/plans/`, prefixo de data):
- `2026-08-19-auditoria-sesmt-atestados-*`
- `2026-08-20-episodio-inss-*`
- `2026-08-20-alerta-retorno-inss-*` / `2026-08-21-visibilidade-alerta-retorno-inss-*`
- `2026-08-21-prorrogar-afastamento-*`
- `2026-08-21-visibilidade-afastamentos-sem-data-*`

## 5. Código e Configurações Críticas

**IDs fixos do projeto:** Contrato UUID `c73a81ae-0104-4c05-b7d6-e6266f6be1b2`; Supabase project `fwdhnipekbmeqozkpfyh`; Admin `rfpaulussi@hotmail.com`.

**Regra de agrupamento de episódio (`lib/atestados/episodio-inss.ts`):**
```typescript
const JANELA_MESMA_DOENCA_DIAS = 60
function cidCompativel(a, b) {
  return a.cidCodigo === null || b.cidCodigo === null || a.cidCodigo === b.cidCodigo
}
// dataFim do episódio = MÁXIMO entre grupo (não o último por ordem de início —
// atestados podem se sobrepor/aninhar)
const dataFim = grupo.reduce((max, a) => (a.dataFim > max ? a.dataFim : max), grupo[0].dataFim)
```

**Regra "vencido" consistente em todo lugar:** `data_fim_prevista <= hoje` (inclusive — vence HOJE já conta).

**Padrão de query pra `afastamentos` (usado em cron, dashboard, page.tsx):**
```typescript
supabase.from('afastamentos')
  .select('funcionario_id, funcionarios!inner(nome, status, posto_id)')
  .is('data_fim_real', null)
  .not('data_fim_prevista', 'is', null)
  .lte('data_fim_prevista', hoje)
  .eq('funcionarios.status', 'afastado')
```
Sempre dedupe por `funcionario_id` (pode haver mais de 1 registro aberto — bug de dados real, encontrado 2x).

**`ActionResult` reutilizado** em todas as actions novas de `efetivo/actions.ts`:
```typescript
type ActionResult = { success: true } | { success: false; error: string }
```

**`.env.local` não existe nos worktrees** (gitignored) — builds em worktree sempre mostram `Error: supabaseUrl is required` durante geração estática de `/coberturas`; é ruído esperado, não falha real (build termina com `✓ Compiled successfully` mesmo assim).

## 6. Erros e Armadilhas Conhecidas

- **Vercel roda `next lint` no build**, `npx tsc --noEmit` sozinho NÃO pega erros de lint (ex: variável não usada) — sempre rodar `npm run build` completo antes de considerar pronto, já causou falha de deploy uma vez.
- **`dataFim` do episódio = último elemento por ordem de início ≠ máximo real** — bug pego em review, atestados podem se sobrepor/aninhar.
- **Duas linhas SESMT podiam "capturar" o mesmo atestado do sistema** — corrigido com pareamento guloso 1:1 excluindo já-usados.
- **Race condition em modais async** (`abrirModalInss`, depois replicado em `ModalProrrogarAfastamento`): resposta antiga de fetch pode sobrescrever resposta nova se o usuário trocar de item rápido. Padrão de correção: `let cancelado = false` + cleanup no `useEffect`, ou `requestIdRef` pra casos com múltiplos triggers concorrentes.
- **Link `?busca=` no alerta apontava pra `/efetivo` mas a página não lia esse query param** — corrigido em `efetivo-client.tsx` com `useSearchParams()`.
- **Supervisor "afastado" pode estar num posto-holding secretaria="AFASTADOS"**, excluído do `postoIds` normal do supervisor — query de alerta do supervisor precisa buscar esses funcionários separadamente (`afastadosPostoIds`), senão o supervisor nunca vê alerta de quem está há mais tempo afastado.
- **Falha de INSERT em `movimentacoes` (log de auditoria) não deve travar a ação principal** — sempre `console.error`, nunca `throw`, já que a mutação principal (ex: `afastamentos.update`) já foi commitada.
- **`types/database.ts` não é regenerado automaticamente** após criar tabela nova via migration — usar `as any` explícito nas queries pra tabela nova até alguém rodar a regeração de tipos do Supabase (aconteceu com `alertas_supervisor`).
- **Um funcionário pode ter 2 registros abertos em `afastamentos` simultaneamente** — bug de dados real (duplicidade de solicitação aprovada 2x), sempre tratar com dedupe (mantém o mais recente/mais antigo conforme o caso) em qualquer query nova sobre essa tabela.

## 7. Próximos Passos

- [ ] Nenhum pendente conhecido — todas as 5 features estão em produção e confirmadas funcionando pelo usuário via teste manual.
- [ ] (Sugestão não pedida, mencionada em conversa) — considerar constraint única em `afastamentos` (`funcionario_id` WHERE `data_fim_real IS NULL`) pra impedir duplicidade na origem, já que o bug se repetiu 2x nesta sessão.

---

> **Instrução para o próximo chat:** Este arquivo contém o contexto compactado de um chat anterior sobre o sistema demax-gestao. Use-o como base para continuar o trabalho. Não peça ao usuário para repetir informações que já estão aqui. Comece confirmando brevemente que entendeu o contexto e pergunte por onde o usuário quer continuar.
