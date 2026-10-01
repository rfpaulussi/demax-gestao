# Considerações ao RH geradas a partir da devolutiva (fluxo sequencial)

## Contexto / problema

Hoje, quando a IA analisa uma ocorrência (`analisarOcorrencia`), ela gera em paralelo e de forma independente:
- `devolutiva_supervisor` — rascunho de resposta ao supervisor.
- `email_rh` — rascunho de "considerações para o e-mail ao RH".

Os dois campos vêm da mesma chamada, sem relação um com o outro. Na prática o `email_rh` às vezes volta vazio mesmo com `encaminhar_rh: true` (já mitigado uma vez reforçando o prompt, mas o problema de fundo é arquitetural: a IA não viu a devolutiva final que o coordenador escreveu, então o texto para o RH pode ficar desalinhado com o que o coordenador realmente pensa).

Pedido do usuário: o texto para o RH deve nascer do que o coordenador escreveu/editou para o supervisor, não de um campo paralelo e desconectado.

## O que sai

- O campo `email_rh` da análise da IA (gerado junto com a análise inicial).
- A caixa "Considerações para o e-mail ao RH" que hoje aparece sempre que `analise.encaminhar_rh === true`, preenchida automaticamente ao analisar.
- O botão "Encaminhar ao RH" gating por `analise?.encaminhar_rh`.

## O que entra

Fluxo, dentro do `ModalAnaliseIA` em modo `analise`, depois que a análise voltou (`temResultado`):

1. Coordenador ajusta a **devolutiva ao supervisor** no textarea existente (como já faz hoje).
2. Clica **"Gerar considerações ao RH"** — botão novo, **sempre disponível** quando há uma análise carregada, independente do que `analise.encaminhar_rh` sugeriu (a IA pode ter dito que não precisa ir ao RH, mas o coordenador decide por conta própria que quer encaminhar).
3. Modal mostra a **prévia** do texto exato que vai à IA — mesmo padrão já usado em "Analisar com IA" / "Rascunhar devolutiva do retorno": contexto original anonimizado + a devolutiva atual (editada), anonimizados juntos, com o mesmo truque de separador usado em `prepararMensagemRetorno`.
4. Coordenador confirma ("Enviar para a IA"). A IA gera o texto das considerações, que aparece numa caixa editável.
5. Só então aparece o botão **"Encaminhar ao RH"**, que abre o modal de e-mail já com essas considerações dentro (igual já funciona hoje — `onEncaminharRH(consideracoes)`).

Fica igual:
- "Aprovar devolutiva" continua independente: pode aprovar/postar a devolutiva sem nunca gerar nada para o RH.
- "Nível recomendado" e "Por que encaminhar ao RH" (`motivo_rh`, sugestão da IA) continuam aparecendo, só informativos — não geram nem bloqueiam nada.
- O botão "Encaminhar ao RH" continua, como hoje, aprovando a análise (`decidirAnalise(analiseId, {decisao:'aprovada'})`, sem `devolutivaEditada`) e chamando `onEncaminharRH`. A devolutiva digitada nesse caminho continua não sendo postada agora (ela é tratada depois, quando o RH responder, via `rascunharDevolutivaRetorno`) — isso já é o comportamento atual e não muda.

## Desenho técnico

### Migração SQL

Nova migração `supabase/migrations/20261001_consideracoes_rh_tipo.sql`:

```sql
ALTER TABLE ocorrencia_analises_ia
  DROP CONSTRAINT IF EXISTS ocorrencia_analises_ia_tipo_check;

ALTER TABLE ocorrencia_analises_ia
  ADD CONSTRAINT ocorrencia_analises_ia_tipo_check
  CHECK (tipo IN ('analise', 'devolutiva_retorno', 'consideracoes_rh'));
```

Aplicada manualmente pelo usuário no Supabase Studio (padrão já seguido neste projeto — nunca via MCP).

### `lib/ocorrencias/ia/prompt.ts`

- Remover a linha do bullet `email_rh` de `PROMPT_ANALISE` (linha 31 atual) e a menção a `"email_rh"` no bullet de tom de escrita (linha 14: trocar `"devolutiva_supervisor" e "email_rh"` por só `"devolutiva_supervisor"`, já que o novo prompt de considerações também referencia o tom via `BASE` mas sem precisar citar um campo específico ali).
- Novo export `PROMPT_CONSIDERACOES_RH`, no mesmo padrão de `PROMPT_RETORNO`:

```typescript
export const PROMPT_CONSIDERACOES_RH = `${BASE}

Você recebe o contexto da ocorrência e a devolutiva que o coordenador já escreveu para o supervisor. A partir disso, redija o texto de considerações para encaminhar o caso ao RH: 2 a 6 frases, sem saudação nem assinatura, explicando o motivo do encaminhamento e o que se pede ao RH. Termine com uma recomendação objetiva (ex.: "sugerimos orientação sobre medida disciplinar", "sugerimos acompanhamento formal antes de nova medida") para o coordenador decidir rápido se concorda antes de enviar. Baseie-se no que a devolutiva já diz; não contradiga nem invente uma decisão diferente da que o coordenador escreveu. Responda SEMPRE chamando a ferramenta ${NOME_FERRAMENTA_CONSIDERACOES_RH}.`
```

(Import de `NOME_FERRAMENTA_CONSIDERACOES_RH` adicionado ao import existente de `./schema` no topo do arquivo.)

### `lib/ocorrencias/ia/schema.ts`

- Remover de `AnaliseOcorrencia`: o campo `email_rh: string` e seu comentário (linhas 23-24 atuais).
- Remover de `FERRAMENTA_ANALISE.input_schema.properties`: a propriedade `email_rh` (linhas 71-74 atuais).
- Remover de `lerAnalise`: a linha `email_rh: encaminhar ? texto(o.email_rh, 3000) : ''` (linha 140 atual) e o campo correspondente no objeto de retorno.
- `required` de `FERRAMENTA_ANALISE` não lista `email_rh` hoje — nada a mudar ali.
- Novo tipo, tool e validador, no mesmo padrão de `RetornoOcorrencia`/`FERRAMENTA_RETORNO`/`lerRetorno`:

```typescript
export interface ConsideracoesRH {
  consideracoes_rh: string
}

export const NOME_FERRAMENTA_CONSIDERACOES_RH = 'redigir_consideracoes_rh'

export const FERRAMENTA_CONSIDERACOES_RH: Anthropic.Tool = {
  name: NOME_FERRAMENTA_CONSIDERACOES_RH,
  description:
    'Redige as considerações para encaminhar uma ocorrência ao RH, a partir da devolutiva que o coordenador já escreveu ao supervisor.',
  input_schema: {
    type: 'object' as const,
    properties: {
      consideracoes_rh: {
        type: 'string',
        description: '2 a 6 frases sobre o motivo do encaminhamento e o que se pede ao RH, SEM saudação e SEM assinatura, terminando com uma recomendação objetiva.',
      },
    },
    required: ['consideracoes_rh'],
  },
}

export function lerConsideracoesRH(bruto: unknown): ConsideracoesRH | null {
  if (!bruto || typeof bruto !== 'object' || Array.isArray(bruto)) return null
  const o = bruto as Record<string, unknown>
  const consideracoes = texto(o.consideracoes_rh, 3000)
  if (!consideracoes) return null
  return { consideracoes_rh: consideracoes }
}
```

`AnaliseHistorico['tipo']` (hoje `'analise' | 'devolutiva_retorno'`, em `ia-actions.ts`) passa a incluir `'consideracoes_rh'`.

### `lib/ocorrencias/ia/contexto.ts`

Reaproveita `montarContexto` (contexto base) tal como está. `montarContextoRetorno` já faz exatamente o formato necessário (`[contexto, '', 'Resposta do RH:', texto].join('\n')`), mas o rótulo "Resposta do RH:" não serve aqui. Novo helper, mesmo padrão:

```typescript
export function montarContextoConsideracoesRH(p: { contexto: string; devolutivaAnonima: string }): string {
  return [p.contexto, '', 'Devolutiva que o coordenador escreveu ao supervisor:', p.devolutivaAnonima].join('\n')
}
```

### `app/(admin)/ocorrencias/ia-actions.ts`

- Import: trocar `PROMPT_RETORNO` → também importar `PROMPT_CONSIDERACOES_RH`; trocar `montarContextoRetorno` → também importar `montarContextoConsideracoesRH`; importar `FERRAMENTA_CONSIDERACOES_RH`, `lerConsideracoesRH` de `./schema` (junto dos demais já importados de lá).
- `restaurarAnalise`: remover a linha `email_rh: r(a.email_rh)` e o campo correspondente no tipo `ResultadoAnalise`/objeto retornado (localizar via leitura do trecho entre `ResultadoAnalise` e `analisarOcorrencia`, que ainda não foi lido nesta sessão — ajustar no ponto exato onde `email_rh` aparece, análogo ao que já foi confirmado em `schema.ts`).
- Nova função privada `prepararMensagemConsideracoesRH(ocorrenciaId, devolutivaFinal)`, espelhando `prepararMensagemRetorno` linha a linha (mesmo `SEPARADOR_RESPOSTA_RH` reaproveitado — não precisa de separador novo, já que o papel é o mesmo: juntar dois textos para anonimizar com os mesmos códigos):

```typescript
async function prepararMensagemConsideracoesRH(ocorrenciaId: string, devolutivaFinal: string): Promise<MensagemRetorno> {
  const validado = validarTexto(devolutivaFinal)
  if (!validado.ok) return { ok: false, error: validado.error }
  if (validado.texto.includes(SEPARADOR_RESPOSTA_RH.trim())) {
    return { ok: false, error: 'O texto contém um trecho reservado. Remova "<<<SEPARADOR_RESPOSTA_RH>>>".' }
  }

  const base = await carregarBase(ocorrenciaId)
  if (!base) return { ok: false, error: 'Ocorrência não encontrada' }

  const junto = anonimizarOcorrencia(`${base.descricao}${SEPARADOR_RESPOSTA_RH}${validado.texto}`, await carregarPessoas())
  const partes = junto.texto.split(SEPARADOR_RESPOSTA_RH)
  if (partes.length !== 2) return { ok: false, error: 'Não foi possível preparar o texto para a IA.' }

  const contexto = montarContexto({
    funcao: base.funcao,
    dataOcorrencia: base.dataOcorrencia,
    gravidade: base.gravidade,
    textoAnonimo: partes[0],
    historico: base.historico,
  })
  return { ok: true, mensagem: montarContextoConsideracoesRH({ contexto, devolutivaAnonima: partes[1] }), nomes: junto.nomes }
}
```

(Reutiliza o tipo `MensagemRetorno` já existente — ele é genérico o bastante, mas se o nome ficar confuso durante a implementação, pode ser renomeado para algo neutro como `MensagemPreparada` já que passa a servir dois fluxos; decisão de nomenclatura fica para quem implementar, sem mudar o comportamento.)

Nova função pública de prévia, espelhando `previaRetorno`:

```typescript
export type PreviaConsideracoesRH =
  | { success: true; mensagem: string; iaConfigurada: boolean }
  | { success: false; error: string }

export async function previaConsideracoesRH(ocorrenciaId: string, devolutivaFinal: string): Promise<PreviaConsideracoesRH> {
  const guard = await requireRole(['admin', 'coordenador'])
  if (!guard.success) return { success: false, error: guard.error }

  const preparada = await prepararMensagemConsideracoesRH(ocorrenciaId, devolutivaFinal)
  if (!preparada.ok) return { success: false, error: preparada.error }
  return { success: true, mensagem: preparada.mensagem, iaConfigurada: iaConfigurada() }
}
```

Nova função pública de geração, espelhando `rascunharDevolutivaRetorno` (guard de role, `iaConfigurada`, rate limit, preparo da mensagem, auditoria ANTES da chamada com `tipo: 'consideracoes_rh'`, chamada à IA, validação, `fecharAuditoria`/`falharAuditoria`, restauração de nomes):

```typescript
export type ResultadoConsideracoesRH =
  | { success: true; analiseId: string; consideracoes: string }
  | { success: false; error: string }

export async function gerarConsideracoesRH(ocorrenciaId: string, devolutivaFinal: string): Promise<ResultadoConsideracoesRH> {
  const guard = await requireRole(['admin', 'coordenador'])
  if (!guard.success) return { success: false, error: guard.error }
  const { auth } = guard

  if (!iaConfigurada()) return { success: false, error: 'A IA não está configurada neste ambiente (falta ANTHROPIC_API_KEY).' }
  if (!dentroDoLimite(auth.user.id)) {
    return { success: false, error: 'Muitas análises em pouco tempo. Aguarde alguns minutos.' }
  }

  const preparada = await prepararMensagemConsideracoesRH(ocorrenciaId, devolutivaFinal)
  if (!preparada.ok) return { success: false, error: preparada.error }
  const { mensagem, nomes } = preparada

  const auditoriaId = await abrirAuditoria({
    ocorrenciaId,
    tipo: 'consideracoes_rh',
    userId: auth.user.id,
    textoEnviado: mensagem,
    mapa: nomes,
  })
  if (!auditoriaId) {
    return { success: false, error: 'Não foi possível registrar a auditoria. Nada foi enviado à IA.' }
  }

  try {
    const resp = await chamarFerramenta(PROMPT_CONSIDERACOES_RH, FERRAMENTA_CONSIDERACOES_RH, mensagem, opcoesIA())
    const resultado = lerConsideracoesRH(resp.entrada)
    if (!resultado) {
      await falharAuditoria(auditoriaId, 'Resposta da IA fora do formato', resp)
      return { success: false, error: 'A IA devolveu uma resposta fora do formato. Tente de novo.' }
    }

    await fecharAuditoria(auditoriaId, resp, resultado)
    return {
      success: true,
      analiseId: auditoriaId,
      consideracoes: restaurarNomes(resultado.consideracoes_rh, nomes),
    }
  } catch (e) {
    const erro = mensagemErroIA(e)
    await falharAuditoria(auditoriaId, erro)
    return { success: false, error: erro }
  }
}
```

Esta auditoria (`tipo: 'consideracoes_rh'`) é um registro **separado** da auditoria da análise original (`tipo: 'analise'`) e da eventual auditoria de retorno — não reutiliza `analiseId` da análise original, tem o seu próprio. `listarAnalises` já devolve as últimas 10 por `ocorrencia_id` sem filtrar por `tipo`, então os 3 tipos aparecem juntos no histórico automaticamente; nenhuma mudança necessária em `listarAnalises` além do tipo de `AnaliseHistorico['tipo']` já citado.

### `components/ocorrencias/modal-analise-ia.tsx`

Import: adicionar `previaConsideracoesRH`, `gerarConsideracoesRH` ao import de `ia-actions`.

Novo estado:
```typescript
const [passoRH, setPassoRH] = useState<'inicial' | 'previa' | 'gerado'>('inicial')
const [mensagemRH, setMensagemRH] = useState('')
```

- `handleAnalisar`: remover a linha `setConsideracoes(r.analise.email_rh)`.
- Novo handler `handlePreviaConsideracoesRH`:
```typescript
function handlePreviaConsideracoesRH() {
  setErro(null)
  startTransition(async () => {
    const r = await previaConsideracoesRH(ocorrenciaId, devolutiva)
    if (!r.success) { setErro(r.error); return }
    setMensagemRH(r.mensagem)
    setIaOk(r.iaConfigurada)
    setPassoRH('previa')
  })
}
```
- Novo handler `handleGerarConsideracoesRH`:
```typescript
function handleGerarConsideracoesRH() {
  setErro(null)
  startTransition(async () => {
    const r = await gerarConsideracoesRH(ocorrenciaId, devolutiva)
    if (!r.success) { setErro(r.error); return }
    setConsideracoes(r.consideracoes)
    setPassoRH('gerado')
  })
}
```
- Bloco JSX de UI que hoje é (linhas 316-323):
```tsx
{analise?.encaminhar_rh && (
  <div className="space-y-1">
    <label className="text-xs font-semibold uppercase tracking-widest text-gray-400">
      Considerações para o e-mail ao RH (entram no rascunho do e-mail)
    </label>
    <textarea value={consideracoes} onChange={e => setConsideracoes(e.target.value)} rows={4} className={textareaClass} />
  </div>
)}
```
passa a ser, substituído por (condicionado a `analise` existir, ou seja só em modo `analise`, igual hoje):
```tsx
{analise && passoRH === 'inicial' && (
  <div className="flex justify-end">
    <button
      disabled={isPending || !devolutiva.trim()}
      onClick={handlePreviaConsideracoesRH}
      className="h-9 rounded-lg border border-indigo-200 px-4 text-xs font-semibold uppercase tracking-widest text-indigo-600 hover:bg-indigo-50 disabled:opacity-50"
    >
      Gerar considerações ao RH
    </button>
  </div>
)}

{analise && passoRH === 'previa' && (
  <div className="space-y-2 rounded-lg border border-indigo-100 bg-indigo-50/50 p-3">
    <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
      Texto exato que vai para a IA (confira antes de enviar)
    </p>
    <pre className="max-h-56 overflow-y-auto whitespace-pre-wrap rounded-lg border border-gray-200 bg-white p-3 text-xs text-gray-700">
      {mensagemRH}
    </pre>
    {!iaOk && <p className="text-xs text-red-500">A IA não está configurada neste ambiente.</p>}
    <div className="flex justify-end gap-2">
      <button onClick={() => setPassoRH('inicial')} className="h-9 rounded-lg border border-gray-200 px-4 text-xs font-semibold uppercase tracking-widest text-gray-500 hover:bg-gray-50">
        Voltar
      </button>
      <button
        disabled={isPending || !iaOk}
        onClick={handleGerarConsideracoesRH}
        className="h-9 rounded-lg bg-indigo-600 px-4 text-xs font-semibold uppercase tracking-widest text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {isPending ? 'Gerando…' : 'Enviar para a IA'}
      </button>
    </div>
  </div>
)}

{analise && passoRH === 'gerado' && (
  <div className="space-y-1">
    <label className="text-xs font-semibold uppercase tracking-widest text-gray-400">
      Considerações para o e-mail ao RH (edite antes de encaminhar)
    </label>
    <textarea value={consideracoes} onChange={e => setConsideracoes(e.target.value)} rows={4} className={textareaClass} />
  </div>
)}
```

Botão "Encaminhar ao RH" no footer (linhas 347-351 atuais), trocar o gate de `analise?.encaminhar_rh` para `passoRH === 'gerado'`:
```tsx
{passoRH === 'gerado' && (
  <button disabled={isPending} onClick={handleEncaminhar} className="h-9 rounded-lg bg-indigo-600 px-4 text-xs font-semibold uppercase tracking-widest text-white hover:bg-indigo-700 disabled:opacity-50">
    Encaminhar ao RH
  </button>
)}
```

`handleEncaminhar` em si não muda (continua chamando `decidirAnalise` sem `devolutivaEditada` e `onEncaminharRH(consideracoes)`).

O badge informativo "Sugere encaminhar ao RH" / "Não precisa ir ao RH" (linhas 263-265) e o bloco "Por que encaminhar ao RH" / `motivo_rh` (linhas 294-299) **continuam exatamente como estão** — só informativos, não controlam mais nenhum botão.

## O que NÃO muda

- `PROMPT_RETORNO`, `rascunharDevolutivaRetorno`, `previaRetorno`, modo `retorno` do modal — intocados.
- `decidirAnalise`, aprovação/reprovação da análise — intocados.
- `onEncaminharRH`/`onAprovada` (callbacks do componente pai) e o modal de e-mail ao RH — intocados; `onEncaminharRH` continua recebendo uma string de considerações, só que agora ela vem de um fluxo sequencial em vez de paralelo.
- Nada muda em `modal-dossie.tsx`.
- Dados enviados à IA continuam seguindo a mesma política de anonimização e mascaramento (CPF/salário/PCD/CID nunca saem; nomes viram códigos FUNC_n).

## Testes

Não há testes automatizados hoje para `ia-actions.ts` (confirmado: nenhum arquivo `*.test.ts`/`__tests__` para este módulo). Verificação por `npx tsc --noEmit` + `npm run build` + teste manual no preview (gerar prévia, gerar considerações, editar, encaminhar ao RH), como já é o padrão para esta área do sistema.
