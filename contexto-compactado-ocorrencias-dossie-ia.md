# Contexto Compactado — Dossiê do Funcionário / Ocorrências / Devolutiva ao RH / IA / Desligamento

**Data da compactação:** 2026-09-30 (atualiza versão anterior do mesmo arquivo, de 2026-09-28)
**Chat original:** ~120 mensagens (duas sessões seguidas sobre o mesmo tema)

---

## 1. Objetivo

Reformular a tela `/ocorrencias` do sistema demax-gestao (Next.js 14 + Supabase, RH/operações de limpeza urbana, contrato municipal) de um registro por posto para um **dossiê do funcionário**: histórico unificado de advertências/atestados/faltas/ocorrências, com devolutiva RH↔supervisor, encaminhamento ao RH, assistente de IA que sugere análise/resolução (incluindo nível de medida disciplinar), e geração do comunicado oficial de desligamento — sempre com aprovação humana antes de qualquer envio.

## 2. Decisões Tomadas

- **Dossiê por funcionário, não por posto:** caso real — supervisor registrou 3 ocorrências da mesma funcionária sem devolutiva; sistema antigo não linkava ocorrência→funcionário.
- **Painel inicial só lista quem tem registro** (busca por nome acha todos, inclusive sem registro).
- **Conversa por ocorrência** (thread), não parecer único.
- **E-mail de devolutiva NUNCA leva o texto da mensagem** (LGPD). Só "há nova devolutiva, acesse o link".
- **RH não tem login no sistema.** Responde fora do sistema; coordenador registra a resposta como **nota interna** (comentário só visível a admin/coordenador).
- **E-mail ao RH pode levar dado identificável, exceto CPF** — nome, RE, posto, secretaria, função, relato, histórico resumido. **Nunca:** CPF, salário, PCD, CID, motivo do atestado.
- **Dados para a IA (API externa) são mais restritos que para o RH:** só texto da ocorrência anonimizado + função + data + gravidade + contagens agregadas. Nunca nome, RE, posto, CPF, salário, PCD, CID. Anonimização cobre funcionários **e** supervisores (`FUNC_n`).
- **Análise de IA é sempre manual (botão), nunca automática**, com prévia do texto exato antes de enviar, decisão final sempre humana (Aprovar/Reprovar). Reaproveita `lib/acordos/ia/` (cliente Anthropic, `chamarFerramenta`, `anonimizarPedido`).
- **`email_rh` da IA é só um bloco de "considerações"**, inserido no rascunho já montado pelo sistema — a IA nunca monta cabeçalho com nome/RE/posto.
- **Campo Data da ocorrência NÃO reflete data do fato, fica assim de propósito.** Responsabilidade de registrar em dia é do supervisor. **Não implementar edição de data/ocorrência.**
- **Modelo Anthropic para IA de ocorrências:** `claude-sonnet-5`.
- **Nível recomendado (orientar/advertir/suspender/dispensar) é campo próprio, separado da lista de passos**, com selo visual e aviso quando `dispensar`.
- **Dispensa NUNCA força `encaminhar_rh = true`** — são campos independentes, a IA decide os dois separadamente.
- **Gerente Operacional NÃO tem login e NÃO recebe fluxo automatizado.** Autorização de dispensa é tratada pessoalmente entre coordenador e gerente, fora do sistema. Nenhum botão/e-mail para ele.
- **Comunicado de Desligamento: só admin/coordenador**, botão dentro do modal do dossiê (não em Efetivo, não em Desligamentos/Aprovações) — ferramenta de apoio na hora de avaliar a ocorrência, não parte do fluxo formal. PDF reproduz o formulário físico oficial da empresa; só preenche o que o sistema tem certeza (Nome, RE, Função, Data de Admissão); todo o resto fica em branco para preencher à mão (Contrato, Causa — 6 checkboxes, Motivo(s), Devolução de uniforme, Exame demissional, Será substituído, Data de desligamento, 5 assinaturas: Diretoria/Coordenador/Supervisor/RH/Gerente Operacional).
- Score de risco de funcionário: **já existe em outro worktree** (`.claude/worktrees/score-risco-funcionario`, branch `worktree-score-risco-funcionario`), na tela de Efetivo — trabalho separado, não integrado a este dossiê.

## 3. Estado Atual

**Tudo em produção no `master`, deployado (push feito, usuário autorizou):**

- Dossiê do funcionário completo: busca, painel com contagens/cards/export Excel/ordenação, modal do dossiê com timeline unificada, PDF do dossiê, conversa por ocorrência, parecer obrigatório ao encerrar, avisos via sino e e-mail (Resend) sem conteúdo.
- Fase RH: "Encaminhar ao RH" (rascunho editável sem CPF/salário/PCD/CID), selo "Com o RH há N dias", "Registrar retorno do RH" (nota interna), invisível ao supervisor.
- Fase IA (análise): botão "Analisar com IA" com prévia anonimizada, resultado (categoria/urgência/**nível recomendado**/resumo/resolução/sugestão de RH/rascunhos), Aprovar/Reprovar, "Rascunhar devolutiva do retorno" (prévia também adicionada nessa etapa), auditoria completa em `ocorrencia_analises_ia` (grava ANTES de chamar a API — corrigido em revisão).
- **Nível recomendado:** selo (`orientar` cinza / `advertir` âmbar / `suspender` laranja / `dispensar` vermelho) + aviso fixo quando `dispensar`: "Decisão de dispensa é tratada diretamente com o gerente operacional. O sistema não envia nada automaticamente."
- **Data de admissão** no cabeçalho do dossiê, entre RE e CPF.
- **Comunicado de Desligamento**: botão vermelho no dossiê, só admin/coordenador, gera PDF (`components/ocorrencias/comunicado-desligamento-pdf.tsx`) com Nome/RE/Admissão preenchidos, resto em branco.
- Todas as revisões de segurança/LGPD passaram (múltiplas rodadas de code review por subagentes + correções: envio duplicado ao RH corrigido, auditoria da IA antes de chamar API, prévia no fluxo de retorno, decisão atômica sem post duplicado).
- Testes: `npm test` = **377 testes passando**. `tsc --noEmit` e `npm run build` limpos em todas as entregas.
- Migrações SQL aplicadas com sucesso pelo usuário no Supabase Studio: `20260814_ocorrencias_funcionario.sql`, `20260924_ocorrencia_comentarios.sql`, `20260925_encaminhar_rh.sql`, `20260925_ia_ocorrencias.sql`.

**Resend / e-mail (configuração de infraestrutura, fora do código):**
- Conta Resend criada, `RESEND_API_KEY` gerada e testada com sucesso (enviou e-mail de teste).
- Domínio `demax.com.br` cadastrado no Resend; DNS (TXT DKIM + 2 CNAMEs SPF) publicado corretamente pelo TI (confirmado via `nslookup` externo — bate exatamente com o que o Resend pede).
- Verificação do domínio ficou travada em "Pending" por >24h mesmo com DNS correto. Ação tomada: domínio removido e recadastrado no Resend (mesmos registros, sem precisar do TI de novo) para forçar nova verificação. **Status da verificação após o recadastro: não confirmado no chat — verificar no próximo acesso ao Resend.**
- Variáveis ainda a confirmar/cadastrar na Vercel (Production) + redeploy: `RESEND_FROM_EMAIL` (usar domínio verificado quando pronto, ex. `Demax Gestão <gestao@demax.com.br>`; até lá, `onboarding@resend.dev` só entrega para o próprio e-mail da conta Resend) e `RESEND_TO_RH=marcialima@demax.com.br` (Coordenadora de RH).
- `ANTHROPIC_API_KEY` já configurada em Production — IA funciona independente do Resend. **IA já testada pelo usuário em produção com sucesso** (rodou análise real numa ocorrência, recebeu categoria/urgência/resumo/resolução/sugestão de RH — ver exemplo real na seção 6).

**Não iniciado:**
- Subprojeto "Confidencial + robustez" (categoria da ocorrência, marcador confidencial, título obrigatório, editar com histórico, log de PDF baixado) — mencionado no brainstorm inicial, nunca ganhou spec própria.
- Integração do score de risco (já existe em worktree separado) ao dossiê de ocorrências.

## 4. Arquivos e Artefatos Relevantes

**Specs e planos (todos em `docs/superpowers/specs/` e `docs/superpowers/plans/`, todos executados):**
| Arquivo | Tema |
|---|---|
| `2026-08-14-dossie-funcionario-design.md` / `.md` (plan) | Dossiê original |
| `2026-08-14-painel-funcionarios-design.md` / `.md` (plan) | Painel/tabela |
| `2026-09-24-devolutiva-ocorrencias-design.md` / `.md` (plan) | Conversa RH↔supervisor |
| `2026-09-25-encaminhar-rh-design.md` / `.md` (plan) | Fase RH |
| `2026-09-25-ia-ocorrencias-design.md` / `.md` (plan) | Fase IA |
| `2026-09-30-nivel-recomendado-admissao-comunicado-design.md` / `2026-09-30-nivel-admissao-comunicado.md` (plan) | Nível IA + admissão + comunicado |

**Código-chave:**
| Arquivo | Descrição |
|---|---|
| `app/(admin)/ocorrencias/actions.ts` | Server actions: dossiê, painel, conversa, parecer, encaminhar RH, retorno RH, `dataAdmissao` em `DossieFuncionario` |
| `app/(admin)/ocorrencias/ia-actions.ts` | Actions da IA: prévia, análise, retorno, decisão, histórico, auditoria |
| `app/(admin)/ocorrencias/page.tsx` | `?f=<funcionario_id>` deep-link, `maxDuration = 60`, calcula `ehGestao` |
| `components/ocorrencias/modal-dossie.tsx` | Modal do dossiê — timeline, RH, IA, **botão Comunicado de Desligamento** (editado muitas vezes; contém `Registrado por {supervisor_nome}` de outro dev — SEMPRE preservar) |
| `components/ocorrencias/modal-analise-ia.tsx` | UI da análise de IA — prévia, resultado, **selo de nível recomendado**, aviso de dispensa, aprovar/reprovar, retorno |
| `components/ocorrencias/modal-encaminhar-rh.tsx` | Rascunho de e-mail ao RH, aceita `consideracoes` da IA |
| `components/ocorrencias/conversa-ocorrencia.tsx` | Thread por ocorrência, com nota interna |
| `components/ocorrencias/dossie-pdf.tsx` | PDF do dossiê completo |
| `components/ocorrencias/comunicado-desligamento-pdf.tsx` | **Novo**: PDF do Comunicado de Desligamento (Nome/RE/Admissão preenchidos, resto em branco) |
| `lib/ocorrencias/devolutiva.ts` + `.test.ts` | Regras puras: validação texto, destinatários, template e-mail sem conteúdo |
| `lib/ocorrencias/encaminhar-rh.ts` + `.test.ts` | Rascunho e-mail RH, validação e-mails, `inserirConsideracoes` |
| `lib/ocorrencias/notificar-devolutiva.ts` | Sino + e-mail |
| `lib/ocorrencias/ia/schema.ts` + `.test.ts` | Ferramenta Anthropic, **`NIVEIS_RECOMENDADOS`/`NivelRecomendado`**, `lerAnalise`, `lerRetorno` |
| `lib/ocorrencias/ia/anonimizar.ts`, `.contexto.ts`, `.prompt.ts` | Anonimização, contexto, prompts (prompt já inclui critérios de quando sugerir cada nível) |
| `lib/acordos/ia/cliente.ts` | `chamarFerramenta` com opções (modelo/tokens/temperatura/timeout) — reuso do módulo de acordos |
| `lib/email.ts` | `enviarEmail` com `replyTo`, devolve `boolean` |
| `supabase/migrations/20260814_*.sql`, `20260924_*.sql`, `20260925_encaminhar_rh.sql`, `20260925_ia_ocorrencias.sql` | Todas **aplicadas** no Supabase |

## 5. Código e Configurações Críticas

**Variáveis de ambiente (Vercel, Production):**
- `ANTHROPIC_API_KEY` — configurada e funcionando.
- `RESEND_API_KEY` — configurada e testada (chegou e-mail de teste).
- `RESEND_FROM_EMAIL` — **a confirmar se já foi cadastrada**; usar domínio verificado quando pronto.
- `RESEND_TO_RH=marcialima@demax.com.br` — **a confirmar se já foi cadastrada** + redeploy necessário após.

**Schema da IA (`lib/ocorrencias/ia/schema.ts`) — campo novo:**
```typescript
export const NIVEIS_RECOMENDADOS = ['orientar', 'advertir', 'suspender', 'dispensar'] as const
export type NivelRecomendado = (typeof NIVEIS_RECOMENDADOS)[number]
// AnaliseOcorrencia.nivel_recomendado: NivelRecomendado — validado em lerAnalise, obrigatório na ferramenta
```

**Critério do prompt (`lib/ocorrencias/ia/prompt.ts`) para `nivel_recomendado`:** independente de `encaminhar_rh`; `dispensar` só quando relato E histórico mostram padrão recorrente do MESMO problema, já tratado antes, sem melhora — nunca por episódio isolado.

**Padrão de PDF novo (`comunicado-desligamento-pdf.tsx`):** mesmo padrão de `advertencia-pdf.tsx` — `Document`/`Page`/`View`/`Text`/`StyleSheet` do `@react-pdf/renderer`, `download*PDF(dados)` com import dinâmico, blob, link temporário. Regex de sanitização de nome (`.replace(/[̀-ͯ]/g, '')`) deve ser **copiado literalmente** de um PDF existente, nunca retipado (intervalo Unicode de diacríticos).

**Convenções do projeto (importantes para continuar):**
- `createClient()` do Supabase é **síncrono** — nunca `await createClient()`.
- Tabelas/colunas fora de `types/database.ts`: usar cast `as unknown as AnyClient`.
- Arquivo `'use server'` só exporta funções async e tipos.
- Testes com Vitest, `npm test`, TDD, arquivos `*.test.ts` ao lado do código.
- **Todos os arquivos existentes usam CRLF** — nunca reescrever arquivo inteiro por script; usar Edit pontual.
- Commits terminam com `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.
- Nunca implementar direto no `master` — sempre `feature/...` branch, subagentes (implementer + spec review + code review), merge, push só com autorização explícita.
- Fluxo padrão já estabelecido nesta série de chats: brainstorm (perguntas uma a uma) → spec em `docs/superpowers/specs/` → aprovação → plano em `docs/superpowers/plans/` → subagent-driven-development (implementer + 2 revisores por task) → build final → merge → push com autorização.

## 6. Erros e Armadilhas Conhecidas

- **Anonimizador não detecta nomes de terceiros em texto livre** ("a diretora Fulana", "a filha") — só mascara quem está na lista de funcionários/perfis. Por isso todo envio à IA é manual com prévia obrigatória.
- **Nunca reescrever `modal-dossie.tsx` por inteiro** — já causou perda acidental da linha `Registrado por {supervisor_nome}` de outro dev, precisou ser restaurada. Sempre editar pontualmente.
- **MCP do Supabase desta sessão aponta para outro projeto** (`atlas-one`, não `demax-gestao`/`fwdhnipekbmeqozkpfyh`) — nunca aplicar migração via MCP; sempre Supabase Studio manual pelo usuário.
- **Ordem de deploy importa**: sempre aplicar migração SQL antes do deploy do código que depende dela.
- **Concorrência**: toda transição de estado (encerrar, encaminhar RH, registrar retorno, decidir análise IA) usa update condicional + verificação de linhas afetadas, nunca duplica e-mail/nota/parecer.
- **Timeout Vercel**: IA usa `timeoutMs: 40_000`/`maxRetries: 0` para caber em `maxDuration = 60`.
- **Domínio Resend travado em "Pending" com DNS correto**: solução que funcionou foi deletar e recadastrar o domínio no Resend (força nova verificação imediata, sem precisar mudar nada no DNS).
- **Exemplo real de análise de IA já testada** (caso "AJUDANTE DE LIMPEZA" com resistência a orientações, divergência de ponto, histórico de mudança de setor): categoria `conduta`, urgência `media`, `encaminhar_rh: true`, resolução em 6 passos, alertas sobre divergência de ponto e influência sobre colegas. Confirma que o pipeline de IA está funcionando ponta a ponta em produção.

## 7. Próximos Passos

- [ ] Confirmar status da verificação do domínio `demax.com.br` no Resend após o recadastro (deve estar "Verified" ou ainda "Pending").
- [ ] Confirmar/cadastrar `RESEND_FROM_EMAIL` e `RESEND_TO_RH` na Vercel (Production) + redeploy.
- [ ] Testar envio real de "Encaminhar ao RH" de ponta a ponta (pode testar primeiro trocando o campo Para pelo e-mail do próprio usuário).
- [ ] Testar como supervisor (aba anônima): confirmar que não vê Encaminhar ao RH, Analisar com IA, selo "Com o RH", nota interna, nem o botão "Comunicado de Desligamento".
- [ ] Baixar e revisar visualmente o PDF do Comunicado de Desligamento gerado de verdade (conferir layout impresso).
- [ ] Decidir e especificar subprojeto "Confidencial + robustez" (categoria, marcador confidencial, título obrigatório, histórico de edição, log de PDF baixado).
- [ ] Decidir se/como integrar o score de risco (já implementado em `.claude/worktrees/score-risco-funcionario`) ao dossiê de ocorrências.

## 8. Informações Pendentes

- Status exato da verificação de domínio no Resend após o recadastro (não confirmado no chat).
- Se `RESEND_FROM_EMAIL`/`RESEND_TO_RH` já foram cadastrados na Vercel e se o redeploy já rodou.
- Layout visual do PDF do Comunicado de Desligamento ainda não foi visto pelo usuário (só revisado em código/testes automatizados).

---

> **Instrução para o próximo chat:** Este arquivo contém o contexto compactado de duas sessões anteriores sobre o projeto demax-gestao (dossiê de funcionário / ocorrências / devolutiva RH / IA / comunicado de desligamento). Use-o como base para continuar o trabalho. Não peça ao usuário para repetir informações que já estão aqui. Comece confirmando brevemente que entendeu o contexto e pergunte por onde o usuário quer continuar — provavelmente confirmar o Resend/RH, testar como supervisor, ou especificar o subprojeto de confidencialidade.
