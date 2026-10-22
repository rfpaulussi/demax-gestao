# Plano — encaminhamento do atestado ao ambulatório

Spec: `docs/superpowers/specs/2026-10-22-atestado-ambulatorio-design.md`. Verificação a cada tarefa: `npx tsc --noEmit` e `npx vitest run` nos arquivos tocados; no fim, `npm run build`.

1. **Migration** `supabase/migrations/20261028_atestado_ambulatorio.sql` (duas colunas) e tipos em `types/database.ts` (Row/Insert/Update de `atestados`).
2. **Destinatários** `lib/atestados/ambulatorio/destinatarios.ts` + teste: `lerDestinatarios(valor)` separa por vírgula, tira espaços, descarta inválidos; vazio → `[]`.
3. **E-mail** `lib/atestados/ambulatorio/email.ts` + teste: `montarEmailAmbulatorio(dados)` → `{ assunto, html, nomeAnexo }`; escapa HTML; sem CPF/CID; `nomeAnexo` sem acento.
4. **`enviarEmail`** em `lib/email.ts` aceita `attachments?: { filename: string; content: Buffer }[]`.
5. **`registrarAtestado`** devolve `{ id }` (insert com `.select('id').single()`); `registrarAtestadoComRetorno` devolve `{ erro?, atestadoId? }`; nova Server Action `ambulatorioAtivo()` (destinatários configurados e usuário não viewer).
6. **Rota** `app/api/atestados/encaminhar/route.ts` conforme a spec.
7. **Cliente** `lib/atestados/ambulatorio/enviar-cliente.ts`: `enviarAoAmbulatorio(atestadoId, arquivo)`.
8. **Modal** `components/efetivo/modal-atestado.tsx`: prop `arquivoInicial?: File`; campo "Anexar atestado" (só se `ambulatorioAtivo()`); estados salvo/enviando/erro/ok; "Tentar de novo".
9. **Por foto** `components/atestados/atestado-por-foto.tsx`: guarda o arquivo reduzido e passa como `arquivoInicial`.
10. **Lista** `page.tsx` + `atestados-client.tsx`: `ambulatorio_enviado_em` no select e no `AtestadoRow`; coluna "Ambulatório" com selo; botão "Enviar" abre diálogo com seletor de arquivo.
11. **Fechamento:** `npm run build`, revisão de segurança (acesso do supervisor, ausência de CPF/CID, escape), relatório.
