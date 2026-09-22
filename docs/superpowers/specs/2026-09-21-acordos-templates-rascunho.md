# Acordos de Compensação — rascunhos de templates (para revisão RH/jurídico)

Status: **RASCUNHO — nada disso está no sistema.** Base: texto padrão atual em `components/acordos/acordo-pdf.tsx` e os dois modelos hoje em `modal-novo-acordo.tsx` (`MODELOS.extra` e `MODELOS.dispensa`).

## 1. O que NÃO muda

Todo o PDF continua idêntico: título, qualificação das partes, tabela de horário semanal, cláusulas de faltas, admitidos, desligados (horas em haver/devedoras), fecho, data, assinaturas. Só o **parágrafo do objeto** passa a ser gerado por template.

Frase-âncora do PDF (não muda):

> As partes celebram o presente acordo de compensação de horas, com a finalidade de que os funcionários **{OBJETO}**

Cada template abaixo produz o `{OBJETO}` e começa com verbo no infinitivo flexionado ("trabalharem…", "serem dispensados…"), como os textos atuais.

## 2. Escopo de escalas

- Elegíveis: **5x2** e **5x1**.
- Fora do acordo: **12x36** e **Jovem Aprendiz** (decisão do usuário em 21/09/2026). O sistema não lista esses funcionários na seleção e mostra o motivo ("escala não elegível a acordo de compensação"). Para aprendiz há vedação legal expressa (art. 432 CLT).

## 3-A. Regra de direção (validador real)

Cada acordo é um **livro de movimentos** por funcionário, em minutos com sinal:

- **Crédito** (`+`): trabalhou a mais que a jornada (evento, sábado, acréscimo antecipado). Quita-se com **descanso**: redução de jornada ou folga.
- **Débito** (`−`): não trabalhou parte ou todo o horário (dispensa, emenda). Quita-se com **compensação**: acréscimo de jornada em outros dias.

Regra de fechamento: a soma dos movimentos de cada funcionário deve ser **zero**. Os minutos do débito de um dia são a jornada **daquele funcionário naquele dia** (varia por turno: sexta pode ser menor).

| Template | Situação | Movimento inicial | Movimento de quitação |
|---|---|---|---|
| T1 | trabalhou no evento | crédito | redução diária (`−`) |
| T2 | saiu antes | débito | acréscimo diário (`+`) |
| T3 | dia inteiro dispensado | débito | acréscimo diário (`+`) |
| T4 | trabalha a mais antes | crédito (acréscimos) | folga (`−`) com prazo |
| T5 | trabalhou em dia de descanso | crédito | folga (`−`) |

## 3. Variáveis e formatação

| Variável | Exemplo | Formato |
|---|---|---|
| `{data_evento}` | 28/06/2026 | dd/mm/aaaa |
| `{nome_evento}` | Festa Junina | texto livre curto (até 60 caracteres) |
| `{periodo_evento}` (opcional) | das 08h às 12h | derivado de dois horários |
| `{datas_comp}` | 30/06/2026 e 01/07/2026 | 1 data: "no dia X"; 2+: "nos dias A, B e C" |
| `{acrescimo}` / `{reducao}` | 01:00h | HH:MMh, por dia |
| `{horas_total}` | 02 hora(s) | soma; "01 hora" / "02 horas" / "02h30min" |
| `{data_folga}` | 05/06/2026 | dd/mm/aaaa |
| `{motivo}` | ponto facultativo municipal | texto curto do calendário ou livre |
| `{hora_normal}` / `{hora_dispensa}` | 15h / 12h | HHh (ou HHhMM) |
| `{prazo_limite}` | 31/12/2026 | dd/mm/aaaa |

Regras de saída: nunca imprimir `[...]`; se sobrar variável sem valor, o PDF não é gerado.

## 4. Templates

### T1 — Evento trabalhado, compensado com REDUÇÃO diária
*(evolução do `MODELOS.extra`; `subtipo = evento`; **direção corrigida** conforme a regra do item 3)*

> trabalharem no dia `{data_evento}` (`{nome_evento}`)`{, periodo_evento}`, com redução de `{reducao}` diária no horário normal `{datas_comp}`, compensando assim `{horas_total}` laborada(s) no referido evento.

Exemplo renderizado:

> trabalharem no dia 28/06/2026 (Festa Junina), das 08h às 10h, com redução de 01:00h diária no horário normal nos dias 30/06/2026 e 01/07/2026, compensando assim 02 hora(s) laborada(s) no referido evento.

O texto atual (`MODELOS.extra`) diz "com **acréscimo** de … hora diária" para quem **trabalhou** no evento, o que soma horas em vez de compensar. Regra vigente (ver §3-A): trabalhou a mais → descansa (redução ou folga); não trabalhou → compensa (acréscimo). Conferir soma: `redução × nº de dias = horas_total`.

> Acordos antigos gerados com o texto anterior podem estar com a direção invertida. Vale o RH revisar uma amostra.

### T2 — Dispensa antecipada (saída antes do horário)
*(evolução do `MODELOS.dispensa`; `subtipo = evento`)*

> trabalharem normalmente até as `{hora_normal}` no dia `{data_evento}` (`{nome_evento}`), sendo dispensados às `{hora_dispensa}` conforme `{motivo}`, compensando as `{horas_total}` não laboradas com acréscimo de `{acrescimo}` diária no horário normal `{datas_comp}`.

Exemplo:

> trabalharem normalmente até as 15h no dia 05/06/2026 (Corpus Christi — emenda), sendo dispensados às 12h conforme decreto municipal, compensando as 03 horas não laboradas com acréscimo de 01:00h diária no horário normal nos dias 08/06/2026, 09/06/2026 e 10/06/2026.

Nota: o texto atual fixa "conforme decreto municipal". Passa a ser `{motivo}` com padrão "decreto municipal" quando a data vem do calendário de Mogi.

### T3 — Folga do dia inteiro (emenda/ponte), compensada com acréscimo
*(novo; `subtipo = evento`; variante do T2 para dia completo)*

> serem dispensados do trabalho no dia `{data_folga}` (`{motivo}`), compensando as `{horas_total}` não laboradas com acréscimo de `{acrescimo}` diária no horário normal `{datas_comp}`.

Exemplo:

> serem dispensados do trabalho no dia 16/02/2026 (ponto facultativo municipal), compensando as 08 horas não laboradas com acréscimo de 01:00h diária no horário normal nos dias 19/02/2026, 20/02/2026, 23/02/2026, 24/02/2026, 25/02/2026, 26/02/2026, 27/02/2026 e 02/03/2026.

Este exemplo cruza o mês (fev→mar): o validador classifica como **banco de horas** (§5º, até 6 meses) e exige `{prazo_limite}` — usar T4.

### T4 — Banco de horas / compensação antecipada
*(evolução do subtipo `antecipado`)*

> trabalharem com acréscimo de `{acrescimo}` diária no horário normal `{datas_comp}`, formando um saldo de `{horas_total}` a ser compensado com a dispensa do trabalho no dia `{data_folga}` (`{motivo}`), com prazo máximo de compensação até `{prazo_limite}`.

Exemplo:

> trabalharem com acréscimo de 01:00h diária no horário normal nos dias 01/06/2026, 02/06/2026 e 03/06/2026, formando um saldo de 03 horas a ser compensado com a dispensa do trabalho no dia 05/06/2026 (ponto facultativo municipal), com prazo máximo de compensação até 30/11/2026.

Cláusula de prazo é a **única adição** de conteúdo jurídico proposta ao padrão da empresa (os modelos consultados a trazem). O RH decide se entra.

### T5 — Dia de descanso/sábado trabalhado, compensado com folga
*(novo; `subtipo = evento`)*

> trabalharem no dia `{data_evento}` (`{nome_evento}`)`{, periodo_evento}`, compensando as `{horas_total}` laboradas com a dispensa do trabalho no dia `{data_folga}`.

Exemplo:

> trabalharem no dia 20/06/2026 (Mutirão de limpeza), das 07h às 11h, compensando as 04 horas laboradas com a dispensa do trabalho no dia 26/06/2026.

## 5. Decisões registradas (21/09/2026)

- Direção: trabalhou a mais → descansa; não trabalhou → compensa (§3-A). T1 corrigido para redução.
- Cláusula de prazo: entra no T4 (e o prazo é controlado pelo sistema — ver design, §7).
- Caso dominante: ponto facultativo emendado pela Prefeitura (~95%) → **T3** (dia inteiro) e **T2** (meio período, ex.: 18/02 até 13h). O fluxo "emenda em 1 clique" parte desses dois templates.

## 6. Regras de validação vinculadas aos templates

| Regra | Aplica-se a | Resultado |
|---|---|---|
| Nenhum `[...]` no texto final | todos | bloqueia |
| Soma dos movimentos (com sinal) de cada funcionário = 0, na jornada real dele | todos | bloqueia |
| Jornada do dia + acréscimo ≤ 10h | T2, T3, T4 | bloqueia |
| Acréscimo diário ≤ 2h | T2, T3, T4 | bloqueia |
| Redução não deixa jornada do dia negativa | T1, T4, T5 | bloqueia |
| Datas de compensação são dias úteis do funcionário (não feriado, não folga da escala) | T1–T4 | aviso |
| Compensação em mês diferente do evento | T1–T3 | reclassifica como banco de horas (T4), exige prazo ≤ 6 meses |
| Funcionário de férias/afastado na data de compensação | todos | aviso |
| Funcionário em escala 12x36 ou aprendiz | todos | não elegível |

Limites legais ficam em constantes editáveis (`lib/acordos/regras.ts`), revisadas pelo RH/jurídico. Convenção coletiva da categoria pode alterar limites e prazos.
