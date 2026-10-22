# Atestado por foto — desenho

Data: 2026-10-22 · Status: aguardando revisão do usuário

## Objetivo
O supervisor (ou coordenador/admin) tira a foto de um atestado e o sistema identifica o funcionário, lê início, dias e CID, e abre o formulário de atestado já preenchido. Quem confirma é sempre a pessoa; a IA nunca grava sozinha.

## Decisões já tomadas
- Ponto de partida: **botão "Lançar por foto" na página Atestados** (a página só lista/edita/exclui hoje; o lançamento atual é o modal "Registrar Atestado" em Efetivo, com o funcionário já escolhido).
- **Médico, CRM e data de emissão não são guardados** (não há colunas e não há migração nesta entrega).
- **A imagem não é guardada.** Processada em memória, descartada. Só os dados confirmados vão para o cadastro.
- **Atestado de menor de idade:** a tela avisa ("paciente é menor, pode ser acompanhamento") e também procura o funcionário pelo nome da mãe. Se o supervisor seguir, lança como atestado normal, sem regra nova e sem motivo pré-preenchido.
- Modelo: `claude-haiku-4-5` (o mesmo do projeto), ferramenta forçada.

## Teste de viabilidade (7 fotos reais, Haiku 4.5, prompt de rascunho)
Fotos tortas, escuras, print de tela, assinatura de cabeça para baixo, 5 layouts diferentes.

| Resultado | Detalhe |
|---|---|
| Nome, data de início, dias | Corretos nas 7. "UM"/"DOIS" por extenso, "1 dia(s)", "por 2 dia(s)" e "4 DIA(S)" foram lidos certo |
| Início e retorno diferentes | Atestado com "Início 20/10, Retorno 21/10, 1 dia" → início 20/10, 1 dia (correto) |
| Sem data de início no papel | Usou a data de emissão e marcou `origem_data_inicio = emissao` (correto) |
| Menor de idade | Detectado (paciente de 3 anos) e nome da mãe extraído |
| **Erro 1: nome com 1 letra trocada** | "FELISBINA" lido como "FELISBRINA" → o casamento com o cadastro precisa ser aproximado |
| **Erro 2: CID não encontrado** | Atestado com CID só em checkbox ("Paciente libera a impressão do CID? ☒ S 50") voltou `cid = null` com confiança alta |
| **Erro 3: campo inventado** | Devolveu `data_retorno` que não estava no papel → o campo sai do schema; fim = início + dias − 1 |
| Custo medido | ≈ 3.000 tokens de entrada + 370 de saída por foto ≈ US$ 0,005 (R$ 0,03). ≈ 4 s por foto |

Consequências no desenho: casamento aproximado de nome; CID ausente **nunca** vira "sem CID" automático (fica amarelo); `data_retorno` removido; confiança da IA não é confiável sozinha (a de data é "alta" mesmo quando assumiu a emissão), então as regras abaixo valem mais que a nota dela.

## Fluxo
1. **Atestados → "Lançar por foto"** (oculto para viewer). Escolhe/tira a foto (imagem ou PDF).
2. O navegador reduz a imagem (lado maior 1600 px, JPEG) e envia para `/api/atestados/ler`.
3. O servidor lê com a IA e casa o nome com funcionários **ativos** dos postos do usuário (admin/coordenador: todos).
4. Tela **"Quem é o funcionário?"** — sempre mostra lado a lado *"No papel: X"* e *"No cadastro: Y"*:
   - Um candidato claro: vem pré-selecionado (nota ≥ 0,90 e ≥ 0,08 acima do segundo).
   - Vários parecidos (nota ≥ 0,55, até 5): lista "Você quis dizer…?" com posto e função; o supervisor escolhe.
   - Nenhum: campo de busca por nome, como hoje.
   - Menor de idade: aviso no topo + candidatos também pelo nome da mãe.
5. Abre o modal **Registrar Atestado** preenchido: início, dias, data fim (início + dias − 1), CID. Campos incertos em **amarelo** com a dica do que conferir.
6. **Salvar** = `registrarAtestado` atual, com todas as regras (sobreposição, falta conflitante, afastado, status, movimentação).

## Regras de preenchimento
- **Início:** se `origem_data_inicio = emissao`, o campo fica amarelo ("o papel não traz início; usei a data de emissão"). Também amarelo se estiver mais de 60 dias no passado ou 30 no futuro.
- **Dias:** inteiro ≥ 1 e ≤ 365; fora disso, vazio e amarelo.
- **CID:** o código lido é normalizado (`J399` → `J39.9`, `I517` → `I51.7`) e procurado em `cid_referencia` (exato; depois a categoria sem o ponto). Achou: preenche. Não achou: campo vazio e aviso "CID lido: X, não está na referência". **CID nulo:** campo vazio, amarelo, aviso "não achei CID no papel; confira" — o supervisor marca "sem CID" ele mesmo.
- **Documento que não é atestado** (`tipo_documento = outro`): avisa e oferece lançar manual.
- **CPF do papel:** usado só para casar com o cadastro, se o cadastro tiver CPF só em dígitos (confirmar na implementação). Nunca é exibido nem guardado; telas continuam mascarando CPF.

## Peças
| Peça | Função |
|---|---|
| `lib/acordos/ia/cliente.ts` | `chamarFerramenta` passa a aceitar blocos de imagem/PDF além de texto. Peça compartilhada com a Fase 2 da admissão |
| `lib/atestados/leitura/schema.ts`, `prompt.ts` | Ferramenta e instruções (versão de rascunho já validada no teste) |
| `lib/atestados/leitura/normalizar.ts` | Valida datas, dias e CID; calcula data fim; decide o que fica amarelo |
| `lib/atestados/leitura/casar-funcionario.ts` | Nome (e mãe) → candidatos com nota. Sem acento, maiúsculas, por partes do nome, tolera 1–2 letras trocadas |
| `app/api/atestados/ler/route.ts` | Login, perfil, tamanho; chama a IA; devolve campos + candidatos. Rota, não Server Action (limite de 1 MB) |
| `components/atestados/modal-atestado-foto.tsx` | Captura, redução da imagem, "Quem é o funcionário?", ligação com o modal |
| `components/efetivo/modal-atestado.tsx` | Ganha só a prop opcional `inicial`; nenhum fluxo atual muda |

## Erros e privacidade
- IA sem chave, fora do ar, foto ilegível ou resposta inválida: mensagem clara com atalho "Lançar manualmente".
- A imagem contém nome e dado de saúde e não dá para anonimizar; o usuário já aceitou isso. Nada da imagem é gravado nem logado; log só com tokens e resultado (sem nome, CPF ou CID).
- Acesso do supervisor continua restrito aos postos dele (`config_supervisores_postos`).
- Sem limite por usuário nesta entrega (custo baixo, endpoint exige login e perfil).

## Testes
- Unitários: `normalizar` (por extenso, início ausente, CID com/sem ponto, datas absurdas) e `casar-funcionario` (acento, 1 letra trocada, nome do meio omitido, homônimos, desligado excluído, mãe). **Fixtures com nomes fictícios**, nunca com dados dos atestados reais.
- Leitura real: script descartável com as 7 fotos já rodou; repetir após ajustar o prompt para o caso do CID em checkbox.
- Tela: o teste logado local não funciona neste projeto; o usuário valida no preview. `tsc` e `build` obrigatórios.

## Fora desta entrega
Auditoria de inconsistências em `/auditoria-atestados`, médico/CRM/emissão, admissão por documento (Fase 2), limite de uso por usuário.
