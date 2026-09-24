# Termo de Movimentação — redesign + controle de protocolo RH

## Problema
- Transferência grava 3 linhas em `movimentacoes` (posto, função, turno); linha de horário sem `solicitacao_id`. PDF mostra só 1 linha.
- Supervisor origem/destino e horário antes/depois não aparecem.
- "Executado por" = admin aprovador; assinatura "Rodolfo Paulussi" fixa no código.

## Decisões (aprovadas)
1. **Um termo por solicitação**: agrupa `movimentacoes` por `solicitacao_id`; `aplicarMudancaHorario` passa a receber `solicitacaoId`. Ações manuais = termo de 1 linha.
2. **Snapshot na aprovação** em `solicitacoes.dados_depois`: supervisor origem/destino, horário antes/depois completo, função, secretaria, data de efetivação. Termos antigos: busca ao vivo, "—" onde faltar.
3. **PDF A4 novo**: cabeçalho + MOV-ID; título por tipo; I Colaborador; II quadro ORIGEM → DESTINO (posto, secretaria, supervisor, função, horário; mudou = destaque colorido, igual = "sem alteração"); III Efetivação (solicitado por/em, aprovado por/em); IV Motivo; V Declaração objetiva; VI Assinaturas (colaborador, supervisor solicitante, supervisor destino na transferência; "Aprovado por" = nome real do aprovador); caixa PROTOCOLO RH. Sem "Executado por". Cores por etapa/tipo para destacar o processo.
4. **/movimentacoes** (menu): status Pendente de entrega ao RH / Protocolado; filtros período, tipo, supervisor, status; PDF individual e lote; "Marcar como protocolado" por **admin, coordenador e supervisor** (supervisor só nos seus postos); badge de pendentes no menu; pendente >3 dias em âmbar.
5. **Migração** `termos_protocolo` (solicitacao_id | movimentacao_id, protocolado_em, protocolado_por, observacao) + RLS com escopo supervisor. SQL aplicado manualmente no Supabase Studio.

## Fora do escopo
Envio de e-mail.

## Ordem
(a) dados: snapshot + agrupamento; (b) PDF; (c) página, protocolo, badge. `npm run build` em cada etapa.
