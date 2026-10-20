# Admissão assistida — Fase 1

Assistente de 6 passos para o supervisor preparar **Cadastro de Funcionários + Solicitação de VT + Lista de Presença da Integração** (PDF para imprimir e assinar) e, no mesmo ato, enviar a solicitação de admissão para Aprovações. Substitui o modal "Solicitar Admissão" da página Postos (só supervisor). O admin continua com `modal-admitir-admin` (admissão direta).

Fase 2 (não faz parte desta entrega): leitura de RG/CNH/comprovante de residência por IA (Claude Haiku, imagem processada em memória e descartada). Fase 3: sugestão de linhas de VT pelos colegas do posto.

## Decisões fechadas com o usuário

- Documentos físicos são anexados em papel: nada de upload/armazenamento de imagem.
- CPF aparece completo no assistente e nos PDFs (o RH precisa). Nas demais telas continua mascarado.
- **RE em branco**: quem atribui é o RH. (`funcionarios.registro` guarda o RE, 5–6 dígitos; o modal antigo o chamava de "PIS/NIT" e o exigia — o assistente não pede.)
- Integração: uma lista **por nome**; palestrante = supervisor logado.
- Substituído: sugere desligados dos últimos 60 dias (mesmo posto primeiro, depois outros postos; busca por nome amplia para 12 meses), ou "não consta" com nome digitado. Para outros postos só devolve nome, posto e data de desligamento (nunca CPF/salário).
- Dependentes: só checklist de documentos, sem cadastro.
- Salário, insalubridade, periculosidade, VA e VR vêm de `funcoes` + `custos_funcoes` (admin client, pois o RLS dessas tabelas é só admin/coord). CBO e sindicato: colunas novas em `funcoes`. Centro de custo: coluna nova em `postos`. Todos editáveis no assistente.
- Segurança do Trabalho (setor, região, ASO) e RE saem em branco nos PDFs.

## Dados

Migração `20261025_admissao_assistida.sql` (aplicar no Supabase Studio — o banco não tem `exec_sql`):

- `funcoes.cbo`, `funcoes.sindicato`, `postos.centro_custo` (texto, opcionais).
- `funcionarios_dados_pessoais` (1:1 com `funcionarios`): telefone, e-mail, endereço, VT (utiliza/linhas/cartão), uniforme. Só admin/coord (RLS). Preenchida na aprovação da solicitação.
- `admissao_rascunhos`: um rascunho por supervisor (PK = `supervisor_id`), RLS só do dono. Guarda CPF/endereço, por isso não vai para `localStorage`.

O CPF vai para `funcionarios.cpf` (hoje vazio em todos os 1219 registros) somente com 11 dígitos, validado pelo dígito.

## Fluxo

`solicitacoes` (`tipo = 'admissao'`) continua sendo a fonte da verdade. `dados_depois` ganha `dossie` (tudo que os PDFs precisam, inclusive um retrato do salário/benefícios da data do envio). Os campos antigos (`nome`, `funcao_id`, `posto_id`, `data_admissao`, `periodo_experiencia`, `turno_destino_id`, `dia_curso_destino`) permanecem, então a aprovação atual e a lista de Aprovações não quebram.

Na aprovação (`app/(admin)/aprovacoes/actions.ts`, caso `admissao`): grava `funcionarios.cpf` e faz upsert em `funcionarios_dados_pessoais` a partir do `dossie`. Em Aprovações o detalhe da solicitação ganha "Reimprimir documentos".

## Passos do assistente

1. Pessoais: nome, CPF, telefone, e-mail, CEP (ViaCEP preenche rua/bairro/cidade/UF), endereço.
2. Vaga: posto, função, data, experiência, motivo (aumento de efetivo / substituição), turno.
3. Condições: contrato, centro de custo, sindicato, CBO, VA, VR, salário/insalubridade/periculosidade (leitura).
4. VT: utiliza ou não; até 5 linhas (tipo, linha, empresa, valor, passagens/dia); cartão.
5. Uniforme (calça, camisa, sapato) e checklist de documentos.
6. Revisão: data da integração (padrão = data de admissão) e dois botões: **Enviar e imprimir** (cria a solicitação, baixa o PDF com os 3 documentos) ou voltar.

Rascunho salvo automaticamente (debounce) e retomado ao reabrir.

## PDFs (A4, uma página cada, reproduzem os modelos da empresa)

`cadastro` (inclui bloco de horário derivado do turno), `vt`, `integracao`. Assinaturas em branco, como no papel.
