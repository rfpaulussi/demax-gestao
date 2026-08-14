# PDF do Dossiê do Funcionário

## Contexto

O modal do dossiê (`components/ocorrencias/modal-dossie.tsx`) mostra o histórico unificado de advertências, atestados, faltas e ocorrências de um funcionário, com KPIs e timeline. Não existe hoje forma de exportar esse conteúdo — só dá pra ver na tela. Supervisores/admin precisam levar esse histórico pra fora do sistema (ex: reunião, RH, processo disciplinar).

## Objetivo

Botão "Baixar PDF" dentro do modal do dossiê, gerando um documento com o mesmo tema visual dos outros PDFs do sistema (`advertencia-pdf.tsx`), contendo cabeçalho do funcionário, um resumo descritivo automático dos números, e a timeline completa.

## Escopo

Inclui:
- Novo arquivo `components/ocorrencias/dossie-pdf.tsx` com o documento React-PDF e a função de download.
- Botão no `modal-dossie.tsx` que chama essa função com o `dossie` já carregado no state.

Fora de escopo:
- Nenhuma nova chamada ao servidor — o PDF usa exatamente os dados já em `DossieFuncionario` (mesmo objeto que alimenta a tela).
- Não respeita o filtro de chip da tela (Advertência/Atestado/etc) — o PDF sempre traz os 4 tipos completos, é um documento de registro, não uma "foto da tela".

## Conteúdo do PDF

Uma página A4, estilo consistente com `components/advertencias/advertencia-pdf.tsx` (cabeçalho DEMAX + nº de registro, rodapé com emissão):

1. **Cabeçalho:** título "DOSSIÊ DO FUNCIONÁRIO" + nome, RE, posto — secretaria, CPF mascarado (mesmo `***.***.***-**` fixo usado em todo o sistema).
2. **Resumo descritivo automático** (gerado a partir de `dossie.kpis`, sem digitação manual): frase única, ex.:
   > "Registra 7 advertência(s), 13 dia(s) de atestado nos últimos 12 meses, 7 falta(s) e 0 ocorrência(s) aberta(s) no momento da emissão."
   Pluralização simples (`(s)` fixo, sem lógica de singular/plural — mesmo padrão simplificado já usado em `faltas` do projeto).
3. **Timeline completa** (todos os itens de `dossie.timeline`, já vem ordenado desc por data): cada linha com data, tipo (rótulo + cor, mesmo mapeamento de `TIPO_LABEL`/`TIPO_COLOR` já usado em `modal-dossie.tsx`), título, detalhe. Sem paginação especial — deixa o React-PDF quebrar página automaticamente (`wrap` padrão), como o `advertencia-pdf.tsx` já faz pras seções longas.
4. **Rodapé:** "DEMAX Serviços e Comércio LTDA · Emitido em {data}", fixed (repete em toda página, como já é padrão).

## Interface

```typescript
// components/ocorrencias/dossie-pdf.tsx
export async function downloadDossiePDF(dossie: DossieFuncionario): Promise<void>
```

Segue o mesmo padrão de `downloadAdvertenciaPDF` em `advertencia-pdf.tsx`: import dinâmico de `pdf` de `@react-pdf/renderer`, gera blob, cria link temporário, dispara download, revoga a URL depois de 10s. Nome do arquivo: `dossie_<nome_sanitizado>_<data_de_hoje>.pdf` (sanitização de nome igual à já existente em `downloadAdvertenciaPDF`: normaliza acentos, troca espaços por `_`, remove caracteres não alfanuméricos).

## Botão no modal

Em `modal-dossie.tsx`, ao lado do botão "Nova Ocorrência" (que só aparece se `canWrite`), adiciona "Baixar PDF" — este **sempre visível** (não depende de `canWrite`, é só leitura/exportação, mesma regra de quem já pode ver o dossiê). `onClick` chama `downloadDossiePDF(dossie)` direto (sem `useTransition`, é síncrono client-side — só mostra um `disabled` curto enquanto gera se quiser, mas não é obrigatório dado que já é rápido pra esse volume de dados).

## Testes / verificação

- `npm run build` limpo.
- QA manual: abrir dossiê de um funcionário com registros nos 4 tipos, clicar "Baixar PDF", abrir o arquivo e conferir cabeçalho, resumo e timeline completa (mesmo com filtro de chip ativo na tela em algo diferente de "Todos").
- QA manual: funcionário sem nenhum registro — PDF gera normalmente com resumo "0 advertência(s), 0 dia(s)...", sem quebrar.
