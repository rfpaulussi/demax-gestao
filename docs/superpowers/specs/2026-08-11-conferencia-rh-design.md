# Conferência RH — Design

## Contexto

RH da prefeitura envia periodicamente planilha (`ATIVOS MOGI DD-MM-AAAA.xlsx`) com duas abas:

- **LISTAGEM**: uma linha por funcionário — `RE` (registro), `NOME DO FUNCIONARIO`, `FUNCAO`, `ADMISSAO`, `AFASTADO` (data — preenchida quando o funcionário está afastado; vazia = ativo), `CONTRATO` (código de 6 dígitos que identifica o **supervisor**, não o posto — ver mapeamento abaixo), coluna fixa `706`, `NUM` (sempre 1, coluna auxiliar de pivot).
- **RESUMO**: pivot função × código de supervisor, com totais por coluna, coluna `AF.` (afastados) e `TOTAL` / `TOTAL DE ATIVOS`. É derivada da LISTAGEM (877 linhas totais, 836 ativas, 41 afastadas na amostra de 10/08/2026).

### Mapeamento código RH → supervisor

| Código | Apelido |
|---|---|
| 70601 | SIL |
| 70602 | HEB |
| 70603 | BRAZ |
| 70604 | PEDRO |
| 70605 | CRISL |
| 70606 | ROS |
| 70607 | CHRIS |
| 706999 | ADMIN |

Não existe hoje no schema um campo que guarde esse código por posto/funcionário. Como o código é uma convenção do RH (pode mudar de supervisor sem aviso), ele fica numa tabela de configuração editável pelo admin, não hardcoded no código-fonte (regra do projeto: nunca hardcodar dados que podem mudar).

## Objetivo

Permitir que admin/coordenador suba essa planilha e veja, numa única tela:

1. Um **resumo agregado** (função × supervisor, RH vs Sistema) — confere rápido se os totais batem, no mesmo formato da aba RESUMO do RH.
2. Uma **tabela de divergências funcionário-a-funcionário** — aponta exatamente o que corrigir.

Sem persistência entre importações (upload manual, resultado descartável — cada conferência é independente).

## Escopo

- Nova rota `app/(admin)/conferencia-rh/` — acesso admin e coordenador (leitura); apenas admin edita o mapeamento de códigos.
- Nova tabela `config_codigos_rh` (migração SQL): `codigo` (int, PK), `apelido` (text), `supervisor_id` (uuid, FK `perfis`, nullable — pode não haver um perfil de supervisor cadastrado ainda). Seed inicial com os 8 códigos acima (supervisor_id null até o admin vincular na tela).
- Server Action `compararConferenciaRH(formData)`: recebe o arquivo, faz todo o parse+comparação em memória, retorna o resultado pro client renderizar. Nenhuma escrita no banco a partir do upload em si (só leitura de `funcionarios`, `postos`, `config_supervisores_postos`, `perfis`, `config_codigos_rh`).
- Reaproveita `xlsx-js-style` (já é dependência) pra ler o arquivo no servidor, e `lib/export-excel.ts` pra exportar a tabela de divergências.

## Modelo de comparação

### Carregamento do lado RH
Lê aba `LISTAGEM` da planilha enviada. Ignora `RESUMO` (será recalculado por nós a partir da LISTAGEM, pra evitar depender de fórmulas da planilha do RH). Cada linha vira:

```ts
{ re: number, nome: string, funcao: string, admissao: Date, afastadoEm: Date | null, codigoSupervisor: number }
```

### Carregamento do lado Sistema
Busca todos os `funcionarios` com `status <> 'desligado'` (ou equivalente — mesmo critério usado hoje na página `efetivo`), com join em `funcoes` (nome da função), `postos` → `config_supervisores_postos` → `perfis` (supervisor atual do posto do funcionário). CPF nunca entra nessa tela (não é necessário pra comparação).

### Casamento (matching)
1. Casa por `RE` (RH) = `registro` (Sistema), convertendo ambos pra string sem espaços/zeros à esquerda.
2. Quando um RE do RH não casa com nenhum `registro` do sistema (e vice-versa), tenta casar por nome normalizado (maiúsculas, sem acento, espaços colapsados). Se casar por nome mas RE for diferente → linha de divergência tipo "RE divergente".
3. O que sobra sem casar de nenhum jeito vira "só no RH" ou "só no sistema".

### Comparações por par casado
Pra cada par (RH, Sistema) casado, gera uma linha de divergência pra cada campo que não bate:

| Tipo | Condição |
|---|---|
| `nome_diferente` | nome normalizado diverge (mesmo após match por RE) |
| `re_divergente` | RE diverge mas nome bateu no fallback |
| `funcao_diferente` | função do RH ≠ nome da função no sistema (comparação por nome normalizado) |
| `afastado_diferente` | RH tem `afastadoEm` preenchido e sistema não está com status de afastado, ou vice-versa |
| `supervisor_diferente` | apelido do `codigoSupervisor` (via `config_codigos_rh`) ≠ supervisor atual do posto do funcionário no sistema |

Funcionário sem nenhuma divergência não aparece na tabela de divergências (só conta pro resumo agregado).

## Telas

### Card superior — upload
Dropzone/input de arquivo (.xlsx). Botão "Comparar". Mostra nome do arquivo e data extraída do nome (se seguir o padrão `ATIVOS MOGI DD-MM-AAAA.xlsx`) como referência, mas não bloqueia se o nome for diferente.

### Seção 1 — Resumo agregado
Tabela função (linha) × supervisor (coluna, usando apelido do `config_codigos_rh`), réplica do layout da aba RESUMO do RH. Cada célula mostra `RH / Sistema` (ex.: `16 / 15`) e fica destacada (borda/fundo âmbar) quando os dois números não batem. Linha de rodapé com totais gerais e coluna extra com total de afastados. Uma linha de aviso lista códigos do RH presentes na planilha que ainda não têm `supervisor_id` vinculado em `config_codigos_rh` (a comparação usa o apelido mesmo assim, mas sinaliza que falta configurar).

### Seção 2 — Divergências
Tabela com filtro por tipo de divergência (multi-select) e busca por nome. Colunas: nome, RE (RH) / RE (sistema), função (RH) / função (sistema), supervisor (RH) / supervisor (sistema), tipo(s) de divergência, link para `/efetivo/[id]` quando o funcionário existir no sistema. Botão "Exportar Excel" gera planilha com essas mesmas colunas via `lib/export-excel.ts`.

### Seção 3 (só admin) — Configuração de códigos
Tabela pequena e editável inline: código RH, apelido, supervisor (select de `perfis` com role supervisor). Server Action separada `salvarConfigCodigoRH`.

## Erros e casos-limite

- Arquivo sem aba `LISTAGEM`, ou aba com colunas fora da ordem esperada → mensagem de erro clara, não tenta adivinhar.
- Linha da planilha sem RE ou sem nome → ignorada, mas contada num aviso ("N linhas ignoradas por falta de RE/nome").
- Função do RH sem correspondência em `funcoes` no sistema (nome não bate com nenhuma) → tratada como `funcao_diferente` com função sistema = "(não encontrada)", não quebra a comparação.
- Múltiplos funcionários do sistema com o mesmo `registro` (não deveria acontecer, mas não é impedido hoje) → primeiro match ganha, aviso genérico não é necessário pro escopo desta feature.

## Fora de escopo (YAGNI)

- Persistir histórico de conferências.
- Corrigir divergências automaticamente (só aponta; correção continua manual nas telas existentes de `efetivo`).
- Ler a aba RESUMO da planilha do RH (recalculamos a partir da LISTAGEM).
