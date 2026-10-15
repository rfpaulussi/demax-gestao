# Contexto Compactado — Reformulação do módulo Acordos de Compensação (demax-gestao)

**Data da compactação:** 2026-09-21
**Chat original:** ~45 turnos do usuário + ~35 subagentes (implementação/revisão)

---

## 1. Objetivo

Módulo `/acordos` (termos de compensação de horas) era pouco usado: formulário manual, horário fixo 07-17, texto com `[PLACEHOLDERS]`, sem validação. Reformular: fluxo estruturado que puxa horário do turno real, valida regras da CLT, gera texto por template e (futuro) aceita pedido em linguagem natural/voz via API Anthropic. Desenvolvimento em branch de teste, sem tocar master/produção.

## 2. Decisões Tomadas

- **IA interpreta, código calcula, humano confirma.** LLM só extrai campos (JSON); texto jurídico vem de templates; nenhum dado de funcionário vai à API (nomes casados no servidor). Modelo previsto: Haiku 4.5.
- **12x36 e Jovem Aprendiz fora do acordo** (aprendiz: art. 432 CLT veda compensação). Bloqueio no servidor, não só na UI. Só 5x2 e 5x1 elegíveis.
- **Regra de direção (usuário):** trabalhou a mais → descansa (redução/folga); não trabalhou → compensa (acréscimo). Minutos com sinal: `+` trabalhou a mais/acréscimo; `−` dispensa/redução/folga; soma por funcionário = 0.
- **5 situações (T1–T5):** T1 evento trabalhado→redução diária; T2 dispensa antecipada (parcial)→acréscimo; T3 dia inteiro de folga (emenda)→acréscimo; T4 banco de horas (acréscimos antes, folga depois, prazo obrigatório); T5 dia de descanso trabalhado→folga.
- **Limites (lib/acordos/regras.ts):** acréscimo ≤2h/dia; jornada ≤10h/dia; 44h/sem; prazo ≤6 meses; mês cruzado exige `prazoLimite` (banco de horas, art. 59 §5º). Compensar folga de 8h48 exige ~8 dias úteis (66 min/dia). Convenção coletiva pode alterar — RH valida.
- **Texto padrão da empresa não muda:** só o parágrafo do objeto varia (T1–T5). T2 mantém "conforme decreto municipal" como padrão. Conector do motivo: "conforme" (decreto/facultativo/determinação) ou "em razão de" (fatos: falta de água, obra etc.) — catálogo `lib/acordos/motivos.ts` (19 motivos, 5 grupos).
- **Um acordo por evento** (decidido pelo usuário): 1 PDF, parágrafo de compensação por turno (`horario_semana.turnos[].objeto`). Turno (mesma semana) cai sempre inteiro num único grupo de texto.
- **Calendário de Mogi novo e isolado** (`lib/calendario/*`, tabela `calendario_feriados`). NÃO alterar `lib/utils/dias-uteis.ts` (`feriadosDoAno`, usado em coberturas/férias/fechamento; diverge do oficial: trata 25/01, 26/06, Carnaval, Corpus Christi como feriado). Fonte: Decreto 24.034/2025 + Lei Mun. 3.433/89; municipais: Sexta Santa, Sant'Ana 26/07, aniv. 01/09, Consciência Negra 20/11. Facultativos 2026 (12): 02/01, 16/02, 17/02, 18/02 (até 13h), 20/04, 04/06 (Corpus Christi), 05/06, 10/07, 31/08, 30/10 (Dia do Servidor), 24/12, 31/12. Semente automática na 1ª leitura do ano.
- **Prefeitura emenda pontos facultativos em ~95% dos casos** → T3/T2 dominam; atalhos do calendário no modal.
- **Controle próprio de saldo/prazo** (aba Controle) foi decidido mas NÃO implementado (Fase 2): tabela `acordo_movimentos` já existe e é gravada.
- **Teste em Vercel Preview** (mesmo Supabase de produção!): título `[TESTE]`, apagar depois só com confirmação do usuário.
- **Custos:** usuário controla tokens → trabalho em estágios; um implementador por estágio + revisão combinada. ~2,6M tokens de subagentes até aqui.

## 3. Estado Atual

- Branch `feat/acordos-ia` (local + origin), à frente do master; **master intocado**. Último commit `a1b42ce`. 163 testes vitest passam, `tsc` limpo, `npm run build` ok.
- **Migration `20260922_acordos_movimentos_calendario.sql` JÁ APLICADA pelo usuário** no Supabase Studio (saída "Success. No rows returned").
- **Preview no ar** (commit `a1b42ce`): https://demax-gestao-git-feat-acordos-ia-rfpaulussis-projects.vercel.app/acordos — aguardando o usuário testar o novo layout (nunca foi visto no navegador; app exige login e não posso digitar senha).
- Feito: Fase 0 completa + Parte A (correção de lógica) + Parte B1 (acordo único, motivos, aviso turno≠44h) + B2 (layout 2 colunas: situações com exemplo, passos numerados, dias em chips de calendário, prazo vermelho, resumo fixo) + B3 (título automático, atalhos calendário, nomes de evento recentes).
- Não feito: API/IA + voz (Fase 1b), aba Controle/status assinado (Fase 2), tela de manutenção do calendário, endurecimento de RLS, merge no master.

## 4. Arquivos e Artefatos Relevantes

| Arquivo | Status | Descrição |
|---------|--------|-----------|
| `lib/acordos/{tipos,tempo,regras}.ts` | Criado | tipos (`CamposAcordo`, `FuncionarioCalc`, `Movimento`, `Achado`), datas UTC-safe, limites |
| `lib/acordos/horario-do-turno.ts` | Criado | `turnos_postos`→semana 7 dias; `minutosAposHorario`, `minutosForaDoHorario`, `assinaturaSemana`, `juntarRotulos`, `removerObjetosDosTurnos`; `TURNO_PADRAO` 5x2 44h p/ quem não tem turno |
| `lib/acordos/movimentos.ts` | Criado | origem por funcionário, `construirMovimentos`, `resumoCalculo` (horasTotalMin/minutosPorDia/horaNormal), `agruparPorJornada` |
| `lib/acordos/templates.ts` | Criado | `gerarObjeto` T1–T5, `normalizaMotivo`, `TEMPLATES`, bloqueio de `[..]` |
| `lib/acordos/validar.ts` | Criado | `validarAcordo`, `camposFaltando`, achados erro/aviso (ORDEM_DATAS, DIA_DE_FOLGA, LIMITE_*, DIVISAO, PRAZO_*, SEM_HORAS_A_COMPENSAR, TURNO_FORA_44H…) |
| `lib/acordos/{dias,resumo,situacoes,motivos}.ts` | Criado | sugestão de dias (`sugerirDiasAjuste`), helpers de UI/checklist/título/calendário, copy das situações, catálogo de motivos e nomes de evento |
| `lib/acordos/__fixtures__.ts` | Criado | turnos/funcionários de teste |
| `lib/calendario/{pascoa,feriados-mogi,mapa,mogi}.ts` | Criado | feriados fixos/móveis, facultativos 2026, tipo/mapa (puro), leitura+semeadura no Supabase |
| `supabase/migrations/20260922_acordos_movimentos_calendario.sql` | Criado, APLICADA | colunas novas em `acordos_compensacao`, tabelas `acordo_movimentos`, `calendario_feriados` + RLS |
| `app/(admin)/acordos/actions.ts` | Editado (CRLF) | `carregarFuncionarios` (regime, turno, escala via service role), `criarAcordo` (valida no servidor, 1 acordo, `criado_por`, movimentos, rollback), `buscarNomesEventoRecentes`, `editarAcordo` (limpa `objeto` se texto muda) |
| `app/(admin)/acordos/page.tsx` | Editado | carrega calendário/nomes; banner corrigido (direção) |
| `components/acordos/*` | Reescrito | `modal-novo-acordo`, `campos-template`, `passo`, `situacao-cards`, `passo-funcionarios`, `motivo-chips`, `dias-chips`, `prazo-limite`, `resumo-acordo`; `acordo-pdf.tsx` (parágrafo por turno); `acordos-client.tsx` (CRLF, props calendario/nomesRecentes) |
| `vitest.config.ts`, `package.json` | Editado | vitest ^3.2.7 (v5 exige @types/node 22; projeto usa 20), script `test` |
| `docs/superpowers/specs/2026-09-21-acordos-ia-design.md` | Criado | spec geral (fases, dados, IA, calendário) |
| `docs/superpowers/specs/2026-09-21-acordos-templates-rascunho.md` | Criado | textos T1–T5 e regra de direção |
| `docs/superpowers/plans/2026-09-21-acordos-fase0.md` | Criado | plano + errata de cada estágio (Partes A, B1, B2, B3) |

## 5. Código e Configurações Críticas

Commits principais (branch `feat/acordos-ia`): `25f114c`…`24324cb` (Tasks 1–4), `5638737`/`548f1f2`/`006cc92`/`7bc1ce9` (movimentos/templates/validador), `3eb91cd`/`18cfe77`/`eb94ffd`/`97cd1a9` (migration/dias/actions), `102b589`/`64c5a52`/`e74bc5e` (modal 1ª versão, facultativos, página), `d5c4b92`/`9ae2216`/`e404a66` (Parte A), `7d648f5`/`a675e5a` (B1), `2e9902c`/`4cad5fb`/`a1b42ce` (B2/B3).

Comandos:
```bash
npm test                    # vitest, lib/**/*.test.ts
npx tsc --noEmit
npm run build               # obrigatório (CLAUDE.md)
# status do deploy Vercel (gh CLI não instalado):
curl -s https://api.github.com/repos/rfpaulussi/demax-gestao/commits/feat/acordos-ia/status
```
Preview: alias `demax-gestao-git-feat-acordos-ia-rfpaulussis-projects.vercel.app`. Dev server: `.claude/launch.json` (`demax-gestao`, porta 3000).

## 6. Erros e Armadilhas Conhecidas

- `git push` só com confirmação explícita do usuário (CLAUDE.md); migrations só o usuário aplica no Supabase Studio; nunca mexer em env/Vercel sem confirmação.
- `createClient()` Supabase é SÍNCRONO. `actions.ts` é `'use server'`: só exporta async. `actions.ts` e `acordos-client.tsx` usam **CRLF** (editar por script ou preservar).
- Preview usa o **banco de produção**; escrita de teste é real.
- RLS: `config_escalas_postos` só admin lê → ler com service role só para postos já filtrados pela sessão. Policy antiga `acordos_compensacao` é `USING (true)` (qualquer logado escreve/lê tudo) e `excluirAcordo/editarAcordo/marcarEntregueRH` usam admin client sem checar posto — **pré-existente, não corrigido** (achado de segurança).
- Ambiente: sem Python, sem `gh`; heredoc longo no Bash falhou → escrever arquivos com Write e concatenar com `cat`. vitest 5 incompatível (usar ^3).
- Testes de UI só por renderToString em Node (sem login); efeitos/cliques nunca foram exercitados.
- Sistema de fuso: usar `Date.UTC` e strings `YYYY-MM-DD`.

## 7. Próximos Passos

- [ ] Usuário testar o preview (roteiro: situações, dias automáticos/manual, prazo vermelho, motivos/atalhos, acordo único com vários turnos, PDF, coluna "Criado por"); corrigir o que aparecer (pedir prints).
- [ ] Após o teste: apagar acordos `[TESTE]` (e seus `acordo_movimentos`, cascade) **com confirmação do usuário**; conferir soma de movimentos = 0: `SELECT funcionario_id, sum(minutos) FROM acordo_movimentos GROUP BY 1 HAVING sum(minutos)<>0`.
- [ ] Fase 1b IA: server action `interpretarPedidoAcordo` (tool use, JSON schema, Haiku 4.5), página `/acordos/ia-lab` em dry-run, voz via Web Speech API pt-BR; precisa de chave Anthropic NOVA (`demax-gestao-acordos`, com limite mensal; NÃO colar a chave no chat; usuário coloca em `.env.local` e Vercel Preview) + 15–20 pedidos reais de supervisores para conjunto de teste. Estimativa ~450k tokens em 3 estágios.
- [ ] Fase 2: aba Controle (saldo/prazo/cumprimento via `faltas/atestados/afastamentos/ferias`, alertas em `/pendencias`), status assinado/entregue.
- [ ] Tarefa separada: endurecer RLS de `acordos_compensacao` e checar posto/role em editar/excluir/entregue; decidir se supervisor pode escrever.
- [ ] Tela de manutenção do calendário (facultativos de 2027+ hoje só por SQL).
- [ ] Merge na master: só via decisão do usuário (PR); revisão final da branch inteira antes.

## 8. Informações Pendentes

- RH/jurídico: aprovar (a) estrutura do PDF com parágrafo por turno; (b) redação do T2 ("trabalharem normalmente até as X… dispensados às Y" parece contraditória; `horaNormal` = saída do turno); (c) cláusula de prazo no T4; (d) se almoço trabalhado no evento conta como hora fora do horário no T1 (hoje conta); (e) "até 13h" de meio período = dispensa às 13h; (f) acordos antigos gerados com o T1 antigo (acréscimo para quem trabalhou) podem estar invertidos — revisar amostra.
- Confirmar no decreto original os facultativos 2026, e a natureza de Corpus Christi (04/06) e Dia do Servidor (30/10) (semeados como facultativo) [A CONFIRMAR].
- Premissa: em 5x1 o domingo é a folga da semana modelo (6×7h20=44h) [A CONFIRMAR].
- Turno cadastrado com 45h/semana (08:00–11:00/12:00–18:00) visto no CEMPRE Benedito — dado a corrigir no cadastro (sistema só avisa).
- Efeito de saldo `nao_cumprido` no fechamento (só sinalizar vs desconto após aprovação do RH); prazo padrão sugerido ao propor T4.
- Diferença `feriadosDoAno()` legado × calendário oficial: decidir migrar o legado (tarefa separada).

---

> **Instrução para o próximo chat:** Este arquivo contém o contexto compactado de um chat anterior. Use-o como base para continuar o trabalho. Não peça ao usuário para repetir informações que já estão aqui. Comece confirmando brevemente que entendeu o contexto e pergunte por onde o usuário quer continuar.
