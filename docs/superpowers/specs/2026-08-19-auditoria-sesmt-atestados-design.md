# Auditoria SESMT × Atestados — Design

## Contexto

O sistema de segurança e medicina do trabalho (SESMT) mantém uma planilha própria de afastamentos (atestados médicos), exportável em Excel. Precisamos comparar esse arquivo com os lançamentos de atestado do módulo `/atestados` do sistema para detectar divergências (datas, CID, dias, origem ocupacional) e lançamentos faltantes em qualquer um dos dois lados.

## Objetivo

Nova página administrativa que recebe o arquivo Excel do SESMT, cruza com a tabela `atestados` do Supabase e apresenta um relatório de divergências. Somente leitura — correções continuam sendo feitas na tela de Atestados existente.

## Formato do arquivo SESMT

Planilha `.xlsx` com colunas (nomes de cabeçalho exatos, conforme exportação do sistema SESMT):

| Coluna | Uso |
|---|---|
| Data | data de início do afastamento (dd/mm/aaaa) |
| Matrícula | formato `001-000-XXXXXX` — os dígitos após o segundo `-` são o registro (RE) do funcionário no sistema |
| Empregado | nome, usado só como confirmação visual, não como chave de match |
| Afastamento | duração em dias (texto, ex: "15 dias", "999 dias", "9999 dias") |
| Motivo | ex: "Acidente/Doença não relacionada ao trabalho", "Acidente/Doença do trabalho", "Licença maternidade", "Auxilio reclusão" |
| CID Abonado | "Sem CID" ou `"<código> - <descrição>"` (ex: "A09 - Diarréia e gastroenterite...") |
| Data Retorno | data de retorno (dd/mm/aaaa) |
| ID, Status, Status eSocial | **ignoradas** |

Valores "999 dias" / "9999 dias" indicam benefício em aberto/indeterminado (a "Data Retorno" correspondente é uma data de preenchimento arbitrário, não real) — tratados como afastamento sem data de fim confiável.

## Chave de cruzamento

- **Matrícula** (dígitos após `001-000-` no arquivo) == `funcionarios.registro` no banco.
- Nome do funcionário exibido lado a lado só para conferência visual humana.

## Algoritmo de comparação

Para cada linha do SESMT:
1. Resolve `funcionario_id` pelo `registro`. Não encontrado → linha fica em **"Matrícula não encontrada no sistema"**.
2. Busca todos os `atestados` desse funcionário cuja `[data_inicio, data_fim]` se sobrepõe ao `[data_inicio SESMT, data_fim SESMT]` (para linhas 999/9999 dias, considera só sobreposição pela `data_inicio`, ignorando o fim).
3. Classifica:
   - **0 candidatos** → "Não lançado no sistema"
   - **1 candidato** → compara campo a campo (ver abaixo) → "Confere" ou "Divergência" com lista dos campos que bateram errado
   - **2+ candidatos** → "Ambíguo — revisar manualmente", lista todos os candidatos sem decidir

Campos comparados quando há 1 candidato:
- `data_inicio`: exata
- `data_fim` (dias): exata, exceto quando SESMT é 999/9999 dias (não compara)
- CID: código extraído do texto SESMT (antes do " - ") vs `atestados.cid_codigo`; "Sem CID" no SESMT deve corresponder a `cid_codigo` nulo
- Origem ocupacional: quando Motivo SESMT é "Acidente/Doença do trabalho", espera-se `origem_ocupacional` preenchido (`acidente_trabalho` ou `doenca_ocupacional`) no sistema; motivo "não relacionada ao trabalho" espera `origem_ocupacional` nulo

Depois de processar todas as linhas SESMT, uma segunda passada busca atestados do sistema cuja `data_inicio` cai dentro do intervalo de datas coberto pelo arquivo (min/max das datas SESMT) e que não foram usados como candidato em nenhum pareamento → **"Sem registro no SESMT"** (aviso informativo, não necessariamente erro — pode ser atestado lançado após a exportação do SESMT).

## UI

Rota: `app/(admin)/auditoria-atestados/page.tsx` + `actions.ts`. Acesso: `admin` e `coordenador` (mesmo padrão de guard das demais páginas, redirect se `viewer`/`supervisor`).

- Campo de upload de arquivo `.xlsx` (client component, parse com `xlsx-js-style` já usado no projeto para exportação — aqui usado para leitura via `XLSX.read`).
- Ao enviar, chama Server Action que recebe as linhas já parseadas (array de objetos) do client, roda o cruzamento contra o Supabase, retorna o relatório.
- Relatório em 4 seções (cards/tabelas), contadores no topo:
  1. ✅ Confere
  2. ⚠️ Divergência (mostra SESMT vs Sistema lado a lado, campos divergentes destacados)
  3. ❌ Não lançado no sistema / Matrícula não encontrada
  4. ℹ️ Ambíguo / Sem registro no SESMT

Sem persistência em banco — cada upload é uma auditoria isolada, sem histórico salvo.

## Fora de escopo

- Criar/editar atestados a partir da tela de auditoria (fluxo continua manual em `/atestados`)
- Guardar snapshots de auditorias anteriores
- Suporte a outros formatos de arquivo além do `.xlsx` com esse layout de colunas
