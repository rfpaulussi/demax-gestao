# Assistente de IA para ocorrências Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O coordenador/admin aciona "Analisar com IA" numa ocorrência, vê exatamente o que vai à API (anonimizado), recebe categoria, urgência, resumo, resolução sugerida, indicação de encaminhar ao RH e rascunhos; edita e **aprova ou reprova**. Nada sai sem aprovação.

**Architecture:** Módulo `lib/ocorrencias/ia/` (schema da ferramenta, anonimização, contexto, prompts) com testes Vitest nas partes puras. `lib/acordos/ia/cliente.ts` ganha opções (modelo, tokens, temperatura, timeout) sem mudar o comportamento dos acordos. Server Actions em `app/(admin)/ocorrencias/ia-actions.ts` (só admin/coordenador) gravam cada chamada em `ocorrencia_analises_ia`. UI: `modal-analise-ia.tsx`, integrado ao `modal-dossie.tsx` e ao `modal-encaminhar-rh.tsx` da fase 1.

**Tech Stack:** Next.js 14, Server Actions, `@anthropic-ai/sdk`, Supabase (RLS), TypeScript, Tailwind, Vitest.

**Referência:** spec `docs/superpowers/specs/2026-09-25-ia-ocorrencias-design.md`. Depende da fase 1 (`2026-09-25-encaminhar-rh.md`), que já está na mesma branch.

**Ajustes de engenharia em relação à spec (por descoberta durante o plano):**
- `email_rh` da IA não é um e-mail completo: é só um bloco curto de "considerações e pedido ao RH". O sistema já monta o cabeçalho com nome, RE, posto e histórico (fase 1); o bloco da IA é **inserido** nesse rascunho (`inserirConsideracoes`). Assim a IA nunca precisa saber nome, RE nem posto.
- A chamada à IA passa dos 10 s padrão de função na Vercel: `page.tsx` ganha `export const maxDuration = 60`.
- `chamarFerramenta` ganha um 4º parâmetro de opções; `temperatura: null` omite o parâmetro `temperature` (alguns modelos novos rejeitam).

**Branch:** continua em `feature/encaminhar-rh` (a fase 2 empilha na fase 1, que ainda não foi para o master).

**Convenções:** `createClient()` é síncrono; tabelas novas usam cast `as unknown as AnyClient`/`any`; arquivos `'use server'` só exportam funções async e tipos; testes com `npm test`; commits com `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`; ignorar avisos `failed to delete '.git/worktrees/wt-*'` e LF/CRLF. **Os arquivos existentes do repositório usam CRLF: ao editar com a ferramenta Edit isso é transparente; não use scripts que reescrevam o arquivo inteiro.**

**ORDEM DE DEPLOY:** as duas migrações (`20260925_encaminhar_rh.sql` e `20260925_ia_ocorrencias.sql`) devem ser aplicadas no Supabase Studio antes do deploy.

---

## Task 1: Migração da tabela de auditoria

**Files:**
- Create: `supabase/migrations/20260925_ia_ocorrencias.sql`

- [ ] **Step 1: Criar o arquivo**

```sql
-- ============================================================
-- Assistente de IA para ocorrências: auditoria de cada chamada e da decisão.
-- texto_enviado = exatamente o que foi à API (já anonimizado).
-- mapa = FUNC_n -> nome real, fica só no servidor (tabela sem acesso de supervisor/viewer).
-- ============================================================

CREATE TABLE IF NOT EXISTS ocorrencia_analises_ia (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  ocorrencia_id   uuid        NOT NULL REFERENCES ocorrencias(id) ON DELETE CASCADE,
  tipo            text        NOT NULL DEFAULT 'analise' CHECK (tipo IN ('analise', 'devolutiva_retorno')),
  solicitada_por  uuid        NOT NULL REFERENCES perfis(id),
  modelo          text        NOT NULL,
  tokens_entrada  integer     NOT NULL DEFAULT 0,
  tokens_saida    integer     NOT NULL DEFAULT 0,
  texto_enviado   text        NOT NULL,
  mapa            jsonb       NOT NULL DEFAULT '{}'::jsonb,
  resultado       jsonb       NOT NULL,
  decisao         text        NOT NULL DEFAULT 'pendente' CHECK (decisao IN ('pendente', 'aprovada', 'reprovada')),
  decidida_por    uuid        REFERENCES perfis(id),
  decidida_em     timestamptz,
  motivo          text
);

CREATE INDEX IF NOT EXISTS idx_ocorrencia_analises_ia_ocorrencia
  ON ocorrencia_analises_ia(ocorrencia_id, created_at DESC);

ALTER TABLE ocorrencia_analises_ia ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ocorrencia_analises_ia_admin_all ON ocorrencia_analises_ia;
CREATE POLICY ocorrencia_analises_ia_admin_all ON ocorrencia_analises_ia
  FOR ALL TO authenticated
  USING (is_admin_or_coord())
  WITH CHECK (is_admin_or_coord());

-- supervisor e viewer: sem policy = sem acesso
```

- [ ] **Step 2:** NÃO aplicar em banco nenhum (o usuário aplica no Supabase Studio).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260925_ia_ocorrencias.sql
git commit -m "feat(ocorrencias): tabela de auditoria das análises de IA

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 2: Módulo puro `lib/ocorrencias/ia/` (TDD)

**Files:**
- Create: `lib/ocorrencias/ia/schema.test.ts`, `lib/ocorrencias/ia/anonimizar.test.ts`, `lib/ocorrencias/ia/contexto.test.ts`
- Create: `lib/ocorrencias/ia/schema.ts`, `lib/ocorrencias/ia/anonimizar.ts`, `lib/ocorrencias/ia/contexto.ts`, `lib/ocorrencias/ia/prompt.ts`

- [ ] **Step 1: Testes que falham**

`lib/ocorrencias/ia/schema.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { lerAnalise, lerRetorno, CATEGORIAS, URGENCIAS } from './schema'

const valida = {
  categoria: 'saude',
  urgencia: 'alta',
  resumo: 'Colaboradora teve três crises em nove dias.',
  resolucao_sugerida: ['Contatar familiar', 'Agendar consulta no ambulatório'],
  encaminhar_rh: true,
  motivo_rh: 'Recorrência de episódios de saúde.',
  devolutiva_supervisor: 'Obrigado pelo registro. Vamos acompanhar.',
  email_rh: 'Solicito orientação sobre o acompanhamento.',
  alertas: ['Cita dado de saúde'],
}

describe('lerAnalise', () => {
  it('aceita uma análise válida', () => {
    const r = lerAnalise(valida)
    expect(r).not.toBeNull()
    expect(r?.categoria).toBe('saude')
    expect(r?.encaminhar_rh).toBe(true)
    expect(r?.resolucao_sugerida).toHaveLength(2)
  })

  it('recusa quando não é objeto', () => {
    expect(lerAnalise(null)).toBeNull()
    expect(lerAnalise('x')).toBeNull()
    expect(lerAnalise([])).toBeNull()
  })

  it('recusa categoria ou urgência fora da lista', () => {
    expect(lerAnalise({ ...valida, categoria: 'juridico' })).toBeNull()
    expect(lerAnalise({ ...valida, urgencia: 'urgentissima' })).toBeNull()
  })

  it('recusa resumo vazio', () => {
    expect(lerAnalise({ ...valida, resumo: '   ' })).toBeNull()
  })

  it('limita tamanhos e quantidade de itens', () => {
    const r = lerAnalise({
      ...valida,
      resumo: 'a'.repeat(5000),
      resolucao_sugerida: Array.from({ length: 20 }, (_, i) => `passo ${i}`),
      alertas: Array.from({ length: 20 }, (_, i) => `alerta ${i}`),
    })
    expect(r?.resumo.length).toBe(1500)
    expect(r?.resolucao_sugerida).toHaveLength(8)
    expect(r?.alertas).toHaveLength(6)
  })

  it('ignora itens que não são texto nas listas', () => {
    const r = lerAnalise({ ...valida, resolucao_sugerida: ['ok', 3, null, { a: 1 }, '  '] })
    expect(r?.resolucao_sugerida).toEqual(['ok'])
  })

  it('zera email_rh e motivo quando não é para encaminhar', () => {
    const r = lerAnalise({ ...valida, encaminhar_rh: false, email_rh: 'texto que não deveria ficar', motivo_rh: '' })
    expect(r?.encaminhar_rh).toBe(false)
    expect(r?.email_rh).toBe('')
    expect(r?.motivo_rh).toBeNull()
  })

  it('só considera encaminhar_rh verdadeiro quando é exatamente true', () => {
    expect(lerAnalise({ ...valida, encaminhar_rh: 'true' })?.encaminhar_rh).toBe(false)
  })

  it('as listas de categorias e urgências são as combinadas', () => {
    expect([...CATEGORIAS]).toEqual(['saude', 'conduta', 'desempenho', 'seguranca', 'relacionamento', 'outro'])
    expect([...URGENCIAS]).toEqual(['baixa', 'media', 'alta'])
  })
})

describe('lerRetorno', () => {
  it('aceita devolutiva com pontos de atenção', () => {
    const r = lerRetorno({ devolutiva_supervisor: 'Segue a orientação do RH.', pontos_de_atencao: ['Guardar registro'] })
    expect(r?.devolutiva_supervisor).toBe('Segue a orientação do RH.')
    expect(r?.pontos_de_atencao).toEqual(['Guardar registro'])
  })

  it('recusa devolutiva vazia ou entrada inválida', () => {
    expect(lerRetorno({ devolutiva_supervisor: '  ', pontos_de_atencao: [] })).toBeNull()
    expect(lerRetorno(null)).toBeNull()
  })
})
```

`lib/ocorrencias/ia/anonimizar.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { anonimizarOcorrencia, restaurarNomes } from './anonimizar'

const pessoas = [
  { id: 'f1', nome: 'Maria Souza Lima' },
  { id: 'f2', nome: 'João Pereira Santos' },
  { id: 'perfil:s1', nome: 'Carlos Andrade' },
]

describe('anonimizarOcorrencia', () => {
  it('troca nomes de funcionários e de supervisores por códigos', () => {
    const r = anonimizarOcorrencia('Maria Souza Lima discutiu com João Pereira Santos e avisou Carlos Andrade.', pessoas)
    expect(r.texto).not.toContain('Maria')
    expect(r.texto).not.toContain('João')
    expect(r.texto).not.toContain('Carlos')
    expect(r.texto).toMatch(/FUNC_\d/)
    expect(Object.keys(r.nomes)).toHaveLength(3)
  })

  it('guarda o nome real de cada código', () => {
    const r = anonimizarOcorrencia('Maria Souza Lima chegou atrasada.', pessoas)
    expect(Object.values(r.nomes)).toEqual(['Maria Souza Lima'])
  })

  it('remove CPF, e-mail e telefone', () => {
    const r = anonimizarOcorrencia('CPF 123.456.789-09, e-mail a@b.com, fone (11) 98888-7777.', pessoas)
    expect(r.texto).not.toContain('123.456.789-09')
    expect(r.texto).not.toContain('a@b.com')
    expect(r.texto).not.toContain('98888-7777')
  })

  it('não altera texto sem nomes', () => {
    const r = anonimizarOcorrencia('A colaboradora passou mal na unidade.', pessoas)
    expect(r.texto).toBe('A colaboradora passou mal na unidade.')
    expect(r.nomes).toEqual({})
  })
})

describe('restaurarNomes', () => {
  it('devolve os nomes reais no lugar dos códigos', () => {
    const r = anonimizarOcorrencia('Maria Souza Lima e João Pereira Santos brigaram.', pessoas)
    const volta = restaurarNomes(r.texto, r.nomes)
    expect(volta).toContain('Maria Souza Lima')
    expect(volta).toContain('João Pereira Santos')
    expect(volta).not.toMatch(/FUNC_\d/)
  })

  it('mantém um código desconhecido como está', () => {
    expect(restaurarNomes('Falar com FUNC_9.', {})).toBe('Falar com FUNC_9.')
  })
})
```

`lib/ocorrencias/ia/contexto.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { montarContexto, montarContextoRetorno, type DadosContexto } from './contexto'

const base: DadosContexto = {
  funcao: 'Servente',
  dataOcorrencia: '2026-09-17',
  gravidade: 'Média',
  textoAnonimo: 'FUNC_1 apresentou uma crise na unidade.',
  historico: { advertencias: 2, diasAtestado12m: 19, faltas: 1 },
}

describe('montarContexto', () => {
  it('leva função, data, gravidade, contagens e o relato anonimizado', () => {
    const m = montarContexto(base)
    expect(m).toContain('Servente')
    expect(m).toContain('17/09/2026')
    expect(m).toContain('Média')
    expect(m).toContain('2 advertência(s)')
    expect(m).toContain('19 dia(s) de atestado')
    expect(m).toContain('1 falta(s)')
    expect(m).toContain('FUNC_1 apresentou uma crise na unidade.')
  })

  it('NUNCA leva campos que não são explícitos (nome, RE, CPF, posto, CID) mesmo se vierem no objeto', () => {
    const contaminado = {
      ...base,
      funcionarioNome: 'Maria Souza',
      registro: '103152',
      cpf: '123.456.789-09',
      postoNome: 'EM Maria Luiza',
      cid_codigo: 'F41.1',
    } as unknown as DadosContexto
    const m = montarContexto(contaminado)
    expect(m).not.toContain('Maria Souza')
    expect(m).not.toContain('103152')
    expect(m).not.toContain('123.456.789-09')
    expect(m).not.toContain('EM Maria Luiza')
    expect(m).not.toContain('F41.1')
  })

  it('aceita função e data ausentes', () => {
    const m = montarContexto({ ...base, funcao: null, dataOcorrencia: null, gravidade: null })
    expect(m).toContain('Função do colaborador: não informada')
  })
})

describe('montarContextoRetorno', () => {
  it('junta o contexto e a resposta anonimizada do RH', () => {
    const m = montarContextoRetorno({ contexto: 'CONTEXTO', respostaRhAnonima: 'Orientar consulta médica.' })
    expect(m).toContain('CONTEXTO')
    expect(m).toContain('Resposta do RH:')
    expect(m).toContain('Orientar consulta médica.')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run lib/ocorrencias/ia`
Expected: FAIL (módulos não existem).

- [ ] **Step 3: Implementar**

`lib/ocorrencias/ia/schema.ts`:
```typescript
import type Anthropic from '@anthropic-ai/sdk'

export const CATEGORIAS = ['saude', 'conduta', 'desempenho', 'seguranca', 'relacionamento', 'outro'] as const
export type Categoria = (typeof CATEGORIAS)[number]

export const URGENCIAS = ['baixa', 'media', 'alta'] as const
export type Urgencia = (typeof URGENCIAS)[number]

/** O que a IA devolve na análise. É sugestão: quem decide é o coordenador. */
export interface AnaliseOcorrencia {
  categoria: Categoria
  urgencia: Urgencia
  resumo: string
  resolucao_sugerida: string[]
  encaminhar_rh: boolean
  motivo_rh: string | null
  /** Rascunho da devolutiva ao supervisor (ainda com códigos FUNC_n; o servidor restaura os nomes). */
  devolutiva_supervisor: string
  /** Só um bloco de "considerações e pedido ao RH", sem saudação nem assinatura. Vazio se não encaminhar. */
  email_rh: string
  alertas: string[]
}

export interface RetornoOcorrencia {
  devolutiva_supervisor: string
  pontos_de_atencao: string[]
}

export const NOME_FERRAMENTA_ANALISE = 'analisar_ocorrencia'
export const NOME_FERRAMENTA_RETORNO = 'redigir_devolutiva'

export const FERRAMENTA_ANALISE: Anthropic.Tool = {
  name: NOME_FERRAMENTA_ANALISE,
  description:
    'Registra a análise de uma ocorrência de trabalho registrada por um supervisor. Baseie-se apenas no texto recebido; não invente fatos. É uma sugestão para o coordenador, que decide.',
  input_schema: {
    type: 'object' as const,
    properties: {
      categoria: {
        type: 'string',
        enum: [...CATEGORIAS],
        description: 'Tema principal: saude, conduta, desempenho, seguranca, relacionamento ou outro.',
      },
      urgencia: { type: 'string', enum: [...URGENCIAS], description: 'baixa, media ou alta.' },
      resumo: { type: 'string', description: 'Resumo neutro do ocorrido em até 4 frases.' },
      resolucao_sugerida: {
        type: 'array',
        items: { type: 'string' },
        description: 'Passos práticos e objetivos que o coordenador pode adotar (até 8).',
      },
      encaminhar_rh: {
        type: 'boolean',
        description: 'true quando o caso exige orientação do RH (saúde recorrente, conflito grave, risco trabalhista ou a envolvendo menor/terceiros).',
      },
      motivo_rh: { type: ['string', 'null'], description: 'Por que encaminhar ao RH. null se não for encaminhar.' },
      devolutiva_supervisor: {
        type: 'string',
        description: 'Rascunho respeitoso de resposta ao supervisor, em português, sem afirmar decisões ainda não tomadas.',
      },
      email_rh: {
        type: 'string',
        description: 'Se encaminhar_rh for true: 2 a 6 frases com o motivo do encaminhamento e o que se pede ao RH, SEM saudação e SEM assinatura. Vazio se não encaminhar.',
      },
      alertas: {
        type: 'array',
        items: { type: 'string' },
        description: 'Pontos sensíveis (ex.: cita menor de idade, expõe dado de saúde de terceiro, possível assédio). Vazio se não houver.',
      },
    },
    required: ['categoria', 'urgencia', 'resumo', 'resolucao_sugerida', 'encaminhar_rh', 'devolutiva_supervisor', 'alertas'],
  },
}

export const FERRAMENTA_RETORNO: Anthropic.Tool = {
  name: NOME_FERRAMENTA_RETORNO,
  description:
    'Redige a devolutiva ao supervisor a partir da orientação que o RH deu. Não acrescente decisões que o RH não tomou.',
  input_schema: {
    type: 'object' as const,
    properties: {
      devolutiva_supervisor: {
        type: 'string',
        description: 'Texto claro e respeitoso ao supervisor, em português, com o que foi orientado e os próximos passos.',
      },
      pontos_de_atencao: {
        type: 'array',
        items: { type: 'string' },
        description: 'Cuidados que o coordenador deve ter antes de enviar (até 5). Vazio se não houver.',
      },
    },
    required: ['devolutiva_supervisor', 'pontos_de_atencao'],
  },
}

function texto(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : ''
}

function listaTextos(v: unknown, maxItens: number, maxChars: number): string[] {
  if (!Array.isArray(v)) return []
  return v
    .filter((x): x is string => typeof x === 'string')
    .map(x => x.trim().slice(0, maxChars))
    .filter(Boolean)
    .slice(0, maxItens)
}

/** Valida o que a IA devolveu. Devolve null se faltar o essencial ou estiver fora do formato. */
export function lerAnalise(bruto: unknown): AnaliseOcorrencia | null {
  if (!bruto || typeof bruto !== 'object' || Array.isArray(bruto)) return null
  const o = bruto as Record<string, unknown>
  if (!(CATEGORIAS as readonly string[]).includes(o.categoria as string)) return null
  if (!(URGENCIAS as readonly string[]).includes(o.urgencia as string)) return null
  const resumo = texto(o.resumo, 1500)
  if (!resumo) return null

  const encaminhar = o.encaminhar_rh === true
  const motivo = texto(o.motivo_rh, 600)
  return {
    categoria: o.categoria as Categoria,
    urgencia: o.urgencia as Urgencia,
    resumo,
    resolucao_sugerida: listaTextos(o.resolucao_sugerida, 8, 400),
    encaminhar_rh: encaminhar,
    motivo_rh: encaminhar && motivo ? motivo : null,
    devolutiva_supervisor: texto(o.devolutiva_supervisor, 3000),
    email_rh: encaminhar ? texto(o.email_rh, 3000) : '',
    alertas: listaTextos(o.alertas, 6, 200),
  }
}

export function lerRetorno(bruto: unknown): RetornoOcorrencia | null {
  if (!bruto || typeof bruto !== 'object' || Array.isArray(bruto)) return null
  const o = bruto as Record<string, unknown>
  const devolutiva = texto(o.devolutiva_supervisor, 3000)
  if (!devolutiva) return null
  return { devolutiva_supervisor: devolutiva, pontos_de_atencao: listaTextos(o.pontos_de_atencao, 5, 300) }
}
```

`lib/ocorrencias/ia/anonimizar.ts`:
```typescript
import { anonimizarPedido, type PessoaRef } from '@/lib/acordos/ia/anonimizar'

export type { PessoaRef }

export interface OcorrenciaAnonima {
  /** Texto que pode ir à API: sem CPF, e-mail, telefone nem nomes de funcionários/supervisores. */
  texto: string
  /** 'FUNC_1' -> nome real. Fica só no servidor. */
  nomes: Record<string, string>
}

/**
 * Reaproveita o anonimizador dos acordos (CPF, e-mail, telefone e nomes viram códigos FUNC_n).
 * Limite conhecido: nomes de terceiros escritos no texto livre e que não estão na lista de pessoas
 * ("a diretora Fulana", "a filha") NÃO são detectados. Por isso o envio é manual, com prévia.
 */
export function anonimizarOcorrencia(texto: string, pessoas: PessoaRef[]): OcorrenciaAnonima {
  const { texto: anon, mapa } = anonimizarPedido(texto, pessoas)
  const nomePorId = new Map(pessoas.map(p => [p.id, p.nome]))
  const nomes: Record<string, string> = {}
  for (const [codigo, id] of Object.entries(mapa)) nomes[codigo] = nomePorId.get(id) ?? codigo
  return { texto: anon, nomes }
}

/** Volta dos códigos FUNC_n para os nomes reais. Código desconhecido fica como está. */
export function restaurarNomes(texto: string, nomes: Record<string, string>): string {
  return texto.replace(/FUNC_\d+/g, codigo => nomes[codigo] ?? codigo)
}
```

`lib/ocorrencias/ia/contexto.ts`:
```typescript
// Monta a mensagem que vai à API. Recebe CAMPOS EXPLÍCITOS (nunca um registro inteiro de funcionário):
// nome, RE, CPF, posto, salário, PCD, CID etc. não têm por onde entrar.

export type DadosContexto = {
  funcao: string | null
  dataOcorrencia: string | null // AAAA-MM-DD
  gravidade: string | null // já com rótulo
  textoAnonimo: string
  historico: { advertencias: number; diasAtestado12m: number; faltas: number }
}

function fmtData(iso: string | null): string {
  if (!iso) return 'não informada'
  const [y, m, d] = iso.split('T')[0].split('-')
  return `${d}/${m}/${y}`
}

export function montarContexto(d: DadosContexto): string {
  return [
    'Ocorrência registrada por um supervisor.',
    `Função do colaborador: ${d.funcao ?? 'não informada'}`,
    `Data: ${fmtData(d.dataOcorrencia)}`,
    `Gravidade informada: ${d.gravidade ?? 'não informada'}`,
    `Histórico resumido: ${d.historico.advertencias} advertência(s), ${d.historico.diasAtestado12m} dia(s) de atestado nos últimos 12 meses, ${d.historico.faltas} falta(s).`,
    '',
    'Relato do supervisor:',
    d.textoAnonimo,
  ].join('\n')
}

export function montarContextoRetorno(p: { contexto: string; respostaRhAnonima: string }): string {
  return [p.contexto, '', 'Resposta do RH:', p.respostaRhAnonima].join('\n')
}
```

`lib/ocorrencias/ia/prompt.ts`:
```typescript
import { NOME_FERRAMENTA_ANALISE, NOME_FERRAMENTA_RETORNO } from './schema'

const BASE = `Você é uma assistente de RH de uma empresa de limpeza urbana e áreas verdes com contrato municipal. Você ajuda a coordenação a tratar ocorrências registradas por supervisores. Você SUGERE; quem decide é a coordenação.

Regras:
- Baseie-se somente no texto recebido. Nunca invente fatos, datas, nomes ou diagnósticos.
- As pessoas aparecem como códigos (FUNC_1, FUNC_2…). Trate como pessoas, sem tentar identificá-las, e use esses mesmos códigos quando precisar citá-las.
- Não faça juízo médico nem diagnóstico. Fale de "episódio", "atestado", "acompanhamento".
- Linguagem respeitosa, objetiva e em português do Brasil.
- Se o texto envolver menor de idade, terceiros, possível assédio, acidente ou risco trabalhista, registre em "alertas".`

export const PROMPT_ANALISE = `${BASE}

Responda SEMPRE chamando a ferramenta ${NOME_FERRAMENTA_ANALISE}.
- "encaminhar_rh": true quando houver recorrência de episódios de saúde, conflito grave, risco trabalhista/segurança, ou quando o caso pede orientação que a coordenação não resolve sozinha. Caso simples e pontual: false.
- "devolutiva_supervisor": agradeça o registro, diga o que será feito e o que o supervisor deve fazer agora. Não prometa o que ainda não foi decidido.
- "email_rh": só quando encaminhar_rh for true; 2 a 6 frases sobre o motivo e o que se pede ao RH, sem saudação nem assinatura.`

export const PROMPT_RETORNO = `${BASE}

Você recebe o contexto da ocorrência e a resposta que o RH deu. Redija a devolutiva ao supervisor com o que o RH orientou e os próximos passos. Não acrescente decisões que o RH não tomou. Responda SEMPRE chamando a ferramenta ${NOME_FERRAMENTA_RETORNO}.`
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run lib/ocorrencias/ia` — Expected: PASS (todos os testes dos 3 arquivos).
Run: `npx tsc --noEmit` — Expected: sem erros.

- [ ] **Step 5: Commit**

```bash
git add lib/ocorrencias/ia
git commit -m "feat(ocorrencias): módulo de IA (schema, anonimização, contexto, prompts) com testes

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: `chamarFerramenta` com opções

**Files:**
- Modify: `lib/acordos/ia/cliente.ts`

- [ ] **Step 1: Editar** (edições pontuais; o comportamento sem o 4º parâmetro não pode mudar)

Logo antes de `export function iaConfigurada()`, adicionar:

```typescript
export interface OpcoesChamada {
  /** Sobrescreve o modelo (padrão: ANTHROPIC_MODEL_ACORDOS ou o modelo barato de extração). */
  modelo?: string
  maxTokens?: number
  /** null = não envia o parâmetro `temperature` (alguns modelos novos o rejeitam). Padrão: 0. */
  temperatura?: number | null
  timeoutMs?: number
}
```

Trocar a assinatura e o corpo de `chamarFerramenta` para:

```typescript
export async function chamarFerramenta(
  sistema: string,
  ferramenta: Anthropic.Tool,
  mensagem: string,
  opcoes: OpcoesChamada = {},
): Promise<RespostaModelo> {
  const chave = process.env.ANTHROPIC_API_KEY
  if (!chave) throw new ErroIA('NAO_CONFIGURADA', 'A IA não está configurada neste ambiente (falta ANTHROPIC_API_KEY).')
  const modelo = opcoes.modelo || process.env.ANTHROPIC_MODEL_ACORDOS || MODELO_PADRAO
  const client = new Anthropic({ apiKey: chave, timeout: opcoes.timeoutMs ?? 25_000, maxRetries: 1 })
  try {
    const resp = await client.messages.create({
      model: modelo,
      max_tokens: opcoes.maxTokens ?? 1024,
      ...(opcoes.temperatura === null ? {} : { temperature: opcoes.temperatura ?? 0 }),
      system: sistema,
      tools: [ferramenta],
      tool_choice: { type: 'tool', name: ferramenta.name },
      messages: [{ role: 'user', content: mensagem }],
    })
    const bloco = resp.content.find(b => b.type === 'tool_use')
    if (!bloco || bloco.type !== 'tool_use') throw new ErroIA('RESPOSTA_INVALIDA', 'A IA não devolveu os campos esperados.')
    return {
      entrada: bloco.input,
      modelo,
      tokensEntrada: resp.usage.input_tokens,
      tokensSaida: resp.usage.output_tokens,
    }
  } catch (e) {
    if (e instanceof ErroIA) throw e
    if (e instanceof Anthropic.RateLimitError) throw new ErroIA('FALHA', 'Muitos pedidos à IA agora. Tente de novo em instantes.')
    if (e instanceof Anthropic.AuthenticationError) throw new ErroIA('FALHA', 'A chave da IA foi recusada. Confira ANTHROPIC_API_KEY.')
    if (e instanceof Anthropic.APIError) throw new ErroIA('FALHA', `A IA respondeu com erro (${e.status}).`)
    throw new ErroIA('FALHA', 'Não foi possível falar com a IA. Tente novamente.')
  }
}
```
(É o mesmo corpo de hoje, mudando só: parâmetro `opcoes`, `modelo`, `timeout`, `max_tokens` e o `temperature` condicional.)

- [ ] **Step 2: Verificar**

Run: `npx tsc --noEmit` — sem erros. Run: `npm test` — tudo passa (os testes dos acordos não podem mudar).

- [ ] **Step 3: Commit**

```bash
git add lib/acordos/ia/cliente.ts
git commit -m "feat(ia): chamarFerramenta aceita modelo, tokens, temperatura e timeout opcionais

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: `inserirConsideracoes` (TDD)

**Files:**
- Modify: `lib/ocorrencias/encaminhar-rh.test.ts`, `lib/ocorrencias/encaminhar-rh.ts`

- [ ] **Step 1: Teste que falha.** Em `lib/ocorrencias/encaminhar-rh.test.ts`, trocar a linha de import
```typescript
  corpoParaHtml,
  type DadosRascunhoRH,
```
por
```typescript
  corpoParaHtml,
  inserirConsideracoes,
  type DadosRascunhoRH,
```
e acrescentar no FIM do arquivo:
```typescript
describe('inserirConsideracoes', () => {
  it('insere o bloco antes do "Fico no aguardo", mantendo o resto do rascunho', () => {
    const { corpo } = montarRascunhoRH(base)
    const r = inserirConsideracoes(corpo, 'Solicito orientação sobre o acompanhamento.')
    const iBloco = r.indexOf('CONSIDERAÇÕES')
    const iAguardo = r.indexOf('Fico no aguardo')
    expect(iBloco).toBeGreaterThan(0)
    expect(iBloco).toBeLessThan(iAguardo)
    expect(r).toContain('Solicito orientação sobre o acompanhamento.')
    expect(r).toContain('Maria Souza')
    expect(r.endsWith('Rodolfo Paulussi')).toBe(true)
  })

  it('acrescenta no fim quando não acha a frase de fechamento', () => {
    const r = inserirConsideracoes('Texto livre editado.', 'Bloco da IA.')
    expect(r).toContain('Texto livre editado.')
    expect(r.trimEnd().endsWith('Bloco da IA.')).toBe(true)
  })

  it('não muda nada quando o bloco está vazio', () => {
    expect(inserirConsideracoes('Corpo.', '   ')).toBe('Corpo.')
  })
})
```

- [ ] **Step 2:** `npx vitest run lib/ocorrencias/encaminhar-rh.test.ts` — Expected: FAIL (`inserirConsideracoes` não existe).

- [ ] **Step 3: Implementar.** Acrescentar ao FIM de `lib/ocorrencias/encaminhar-rh.ts`:

```typescript
/**
 * Insere um bloco de "CONSIDERAÇÕES" (sugerido pela IA) no rascunho do e-mail, antes da frase de fechamento.
 * O cabeçalho com nome, RE, posto e histórico continua vindo do sistema, nunca da IA.
 */
export function inserirConsideracoes(corpo: string, consideracoes: string): string {
  const bloco = consideracoes.trim()
  if (!bloco) return corpo
  const secao = `CONSIDERAÇÕES\n${bloco}\n`
  const marca = 'Fico no aguardo da sua orientação.'
  const i = corpo.indexOf(marca)
  if (i < 0) return `${corpo.trimEnd()}\n\n${secao}`
  return `${corpo.slice(0, i)}${secao}\n${corpo.slice(i)}`
}
```

- [ ] **Step 4:** `npx vitest run lib/ocorrencias/encaminhar-rh.test.ts` — Expected: PASS (18 testes).

- [ ] **Step 5: Commit**

```bash
git add lib/ocorrencias/encaminhar-rh.ts lib/ocorrencias/encaminhar-rh.test.ts
git commit -m "feat(ocorrencias): inserirConsideracoes (bloco da IA dentro do rascunho ao RH)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 5: Server Actions da IA (`ia-actions.ts`)

**Files:**
- Create: `app/(admin)/ocorrencias/ia-actions.ts`

- [ ] **Step 1: Criar o arquivo**

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/auth/assert-role'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import { chamarFerramenta, ErroIA, iaConfigurada } from '@/lib/acordos/ia/cliente'
import { validarTexto } from '@/lib/ocorrencias/devolutiva'
import { anonimizarOcorrencia, restaurarNomes, type PessoaRef } from '@/lib/ocorrencias/ia/anonimizar'
import { montarContexto, montarContextoRetorno } from '@/lib/ocorrencias/ia/contexto'
import { PROMPT_ANALISE, PROMPT_RETORNO } from '@/lib/ocorrencias/ia/prompt'
import {
  FERRAMENTA_ANALISE,
  FERRAMENTA_RETORNO,
  lerAnalise,
  lerRetorno,
  type AnaliseOcorrencia,
} from '@/lib/ocorrencias/ia/schema'
import { comentarOcorrencia } from './actions'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any

const MODELO_PADRAO_OCORRENCIAS = 'claude-sonnet-5'
const opcoesIA = () => ({
  modelo: process.env.ANTHROPIC_MODEL_OCORRENCIAS || MODELO_PADRAO_OCORRENCIAS,
  maxTokens: 2000,
  temperatura: null as number | null,
  timeoutMs: 60_000,
})

// Limite simples por usuário (melhor esforço: cada instância do servidor tem a sua memória).
const JANELA_MS = 10 * 60 * 1000
const MAX_CHAMADAS_NA_JANELA = 20
const historicoChamadas = new Map<string, number[]>()
function dentroDoLimite(userId: string): boolean {
  const agora = Date.now()
  const recentes = (historicoChamadas.get(userId) ?? []).filter(t => agora - t < JANELA_MS)
  if (recentes.length >= MAX_CHAMADAS_NA_JANELA) {
    historicoChamadas.set(userId, recentes)
    return false
  }
  historicoChamadas.set(userId, [...recentes, agora])
  return true
}

const ROTULO_GRAVIDADE: Record<string, string> = { baixa: 'Baixa', media: 'Média', alta: 'Alta', critica: 'Crítica' }

function diasInclusivos(inicio: string, fim: string | null): number {
  if (!fim) return 1
  const d1 = new Date(inicio.split('T')[0] + 'T00:00:00')
  const d2 = new Date(fim.split('T')[0] + 'T00:00:00')
  return Math.max(1, Math.round((d2.getTime() - d1.getTime()) / 86400000) + 1)
}

type BaseOcorrencia = {
  id: string
  status: string
  descricao: string
  dataOcorrencia: string | null
  gravidade: string | null
  funcao: string | null
  historico: { advertencias: number; diasAtestado12m: number; faltas: number }
}

// Colunas listadas uma a uma: nunca cpf, salário, PCD, CID, motivo de atestado.
async function carregarBase(ocorrenciaId: string): Promise<BaseOcorrencia | null> {
  const admin = createAdminClient() as AnyClient
  const { data: o } = await admin
    .from('ocorrencias')
    .select('id, tipo, status, descricao, data_ocorrencia, gravidade, funcionario_id')
    .eq('id', ocorrenciaId)
    .single()
  if (!o || o.tipo !== 'ocorrencia' || !o.funcionario_id) return null

  const [{ data: f }, { data: adv }, { data: ats }, { data: fts }] = await Promise.all([
    admin.from('funcionarios').select('funcoes!funcionarios_funcao_id_fkey(nome)').eq('id', o.funcionario_id).single(),
    admin.from('advertencias').select('id').eq('funcionario_id', o.funcionario_id),
    admin.from('atestados').select('data_inicio, data_fim').eq('funcionario_id', o.funcionario_id),
    admin.from('faltas').select('id').eq('funcionario_id', o.funcionario_id),
  ])

  const funcao = Array.isArray(f?.funcoes) ? f.funcoes[0] : f?.funcoes
  const umAnoAtras = new Date()
  umAnoAtras.setFullYear(umAnoAtras.getFullYear() - 1)
  const corte = umAnoAtras.toISOString().split('T')[0]
  const diasAtestado12m = ((ats ?? []) as { data_inicio: string; data_fim: string | null }[])
    .filter(a => a.data_inicio >= corte)
    .reduce((soma, a) => soma + diasInclusivos(a.data_inicio, a.data_fim), 0)

  return {
    id: o.id,
    status: o.status ?? 'aberta',
    descricao: o.descricao ?? '',
    dataOcorrencia: o.data_ocorrencia ?? null,
    gravidade: o.gravidade ? (ROTULO_GRAVIDADE[o.gravidade] ?? o.gravidade) : null,
    funcao: funcao?.nome ?? null,
    historico: {
      advertencias: (adv ?? []).length,
      diasAtestado12m,
      faltas: (fts ?? []).length,
    },
  }
}

// Nomes a mascarar: todos os funcionários e todos os perfis (supervisores, coordenação).
async function carregarPessoas(): Promise<PessoaRef[]> {
  const admin = createAdminClient() as AnyClient
  const funcionarios = await fetchAllRows<{ id: string; nome: string }>((from, to) =>
    admin.from('funcionarios').select('id, nome').range(from, to),
  )
  const { data: perfis } = await admin.from('perfis').select('id, nome')
  const doPerfil = ((perfis ?? []) as { id: string; nome: string | null }[]).map(p => ({
    id: `perfil:${p.id}`,
    nome: p.nome ?? '',
  }))
  return [...funcionarios, ...doPerfil].filter(p => p.nome.trim().length > 0)
}

function mensagemErroIA(e: unknown): string {
  if (e instanceof ErroIA) return e.message
  return 'Não foi possível falar com a IA. Tente novamente.'
}

// ─── prévia (nada é enviado à API) ────────────────────────────────────────────

export type PreviaAnalise =
  | { success: true; mensagem: string; iaConfigurada: boolean }
  | { success: false; error: string }

export async function previaAnalise(ocorrenciaId: string): Promise<PreviaAnalise> {
  const guard = await requireRole(['admin', 'coordenador'])
  if (!guard.success) return { success: false, error: guard.error }

  const base = await carregarBase(ocorrenciaId)
  if (!base) return { success: false, error: 'Ocorrência não encontrada' }
  if (base.status === 'encerrada' || base.status === 'resolvido') {
    return { success: false, error: 'Esta ocorrência já foi encerrada' }
  }

  const anon = anonimizarOcorrencia(base.descricao, await carregarPessoas())
  const mensagem = montarContexto({
    funcao: base.funcao,
    dataOcorrencia: base.dataOcorrencia,
    gravidade: base.gravidade,
    textoAnonimo: anon.texto,
    historico: base.historico,
  })
  return { success: true, mensagem, iaConfigurada: iaConfigurada() }
}

// ─── análise ──────────────────────────────────────────────────────────────────

export type ResultadoAnalise =
  | { success: true; analiseId: string; analise: AnaliseOcorrencia; modelo: string; tokensEntrada: number; tokensSaida: number }
  | { success: false; error: string }

function restaurarAnalise(a: AnaliseOcorrencia, nomes: Record<string, string>): AnaliseOcorrencia {
  const r = (t: string) => restaurarNomes(t, nomes)
  return {
    ...a,
    resumo: r(a.resumo),
    resolucao_sugerida: a.resolucao_sugerida.map(r),
    motivo_rh: a.motivo_rh ? r(a.motivo_rh) : null,
    devolutiva_supervisor: r(a.devolutiva_supervisor),
    email_rh: r(a.email_rh),
    alertas: a.alertas.map(r),
  }
}

export async function analisarOcorrencia(ocorrenciaId: string): Promise<ResultadoAnalise> {
  const guard = await requireRole(['admin', 'coordenador'])
  if (!guard.success) return { success: false, error: guard.error }
  const { auth } = guard

  if (!iaConfigurada()) return { success: false, error: 'A IA não está configurada neste ambiente (falta ANTHROPIC_API_KEY).' }
  if (!dentroDoLimite(auth.user.id)) {
    return { success: false, error: 'Muitas análises em pouco tempo. Aguarde alguns minutos.' }
  }

  const base = await carregarBase(ocorrenciaId)
  if (!base) return { success: false, error: 'Ocorrência não encontrada' }
  if (base.status === 'encerrada' || base.status === 'resolvido') {
    return { success: false, error: 'Esta ocorrência já foi encerrada' }
  }

  // A prévia é refeita aqui no servidor: nunca se confia no que o navegador diz que enviou.
  const anon = anonimizarOcorrencia(base.descricao, await carregarPessoas())
  const mensagem = montarContexto({
    funcao: base.funcao,
    dataOcorrencia: base.dataOcorrencia,
    gravidade: base.gravidade,
    textoAnonimo: anon.texto,
    historico: base.historico,
  })

  try {
    const resp = await chamarFerramenta(PROMPT_ANALISE, FERRAMENTA_ANALISE, mensagem, opcoesIA())
    const analise = lerAnalise(resp.entrada)
    if (!analise) return { success: false, error: 'A IA devolveu uma resposta fora do formato. Tente de novo.' }

    const { data: linha, error } = await (createAdminClient() as AnyClient)
      .from('ocorrencia_analises_ia')
      .insert({
        ocorrencia_id: ocorrenciaId,
        tipo: 'analise',
        solicitada_por: auth.user.id,
        modelo: resp.modelo,
        tokens_entrada: resp.tokensEntrada,
        tokens_saida: resp.tokensSaida,
        texto_enviado: mensagem,
        mapa: anon.nomes,
        resultado: analise,
      })
      .select('id')
      .single()
    if (error || !linha) return { success: false, error: 'A análise foi feita, mas não foi possível registrá-la. Tente de novo.' }

    return {
      success: true,
      analiseId: linha.id,
      analise: restaurarAnalise(analise, anon.nomes),
      modelo: resp.modelo,
      tokensEntrada: resp.tokensEntrada,
      tokensSaida: resp.tokensSaida,
    }
  } catch (e) {
    return { success: false, error: mensagemErroIA(e) }
  }
}

// ─── devolutiva a partir da resposta do RH ────────────────────────────────────

export type ResultadoRetorno =
  | { success: true; analiseId: string; devolutiva: string; pontos: string[] }
  | { success: false; error: string }

export async function rascunharDevolutivaRetorno(ocorrenciaId: string, respostaRH: string): Promise<ResultadoRetorno> {
  const guard = await requireRole(['admin', 'coordenador'])
  if (!guard.success) return { success: false, error: guard.error }
  const { auth } = guard

  const validado = validarTexto(respostaRH)
  if (!validado.ok) return { success: false, error: validado.error }

  if (!iaConfigurada()) return { success: false, error: 'A IA não está configurada neste ambiente (falta ANTHROPIC_API_KEY).' }
  if (!dentroDoLimite(auth.user.id)) {
    return { success: false, error: 'Muitas análises em pouco tempo. Aguarde alguns minutos.' }
  }

  const base = await carregarBase(ocorrenciaId)
  if (!base) return { success: false, error: 'Ocorrência não encontrada' }

  // Relato e resposta do RH são anonimizados JUNTOS, numa só chamada: assim a mesma pessoa recebe
  // o mesmo código (FUNC_n) nos dois textos e a restauração dos nomes é uma só.
  const SEPARADOR = '\n<<<SEPARADOR_RESPOSTA_RH>>>\n'
  const junto = anonimizarOcorrencia(`${base.descricao}${SEPARADOR}${validado.texto}`, await carregarPessoas())
  const [textoAnonimo, respostaAnonima] = junto.texto.split(SEPARADOR)
  if (respostaAnonima === undefined) return { success: false, error: 'Não foi possível preparar o texto para a IA.' }

  const contexto = montarContexto({
    funcao: base.funcao,
    dataOcorrencia: base.dataOcorrencia,
    gravidade: base.gravidade,
    textoAnonimo,
    historico: base.historico,
  })
  const mensagem = montarContextoRetorno({ contexto, respostaRhAnonima: respostaAnonima })

  try {
    const resp = await chamarFerramenta(PROMPT_RETORNO, FERRAMENTA_RETORNO, mensagem, opcoesIA())
    const retorno = lerRetorno(resp.entrada)
    if (!retorno) return { success: false, error: 'A IA devolveu uma resposta fora do formato. Tente de novo.' }

    const nomes = junto.nomes
    const restaurar = (t: string) => restaurarNomes(t, nomes)

    const { data: linha, error } = await (createAdminClient() as AnyClient)
      .from('ocorrencia_analises_ia')
      .insert({
        ocorrencia_id: ocorrenciaId,
        tipo: 'devolutiva_retorno',
        solicitada_por: auth.user.id,
        modelo: resp.modelo,
        tokens_entrada: resp.tokensEntrada,
        tokens_saida: resp.tokensSaida,
        texto_enviado: mensagem,
        mapa: nomes,
        resultado: retorno,
      })
      .select('id')
      .single()
    if (error || !linha) return { success: false, error: 'O rascunho foi feito, mas não foi possível registrá-lo. Tente de novo.' }

    return {
      success: true,
      analiseId: linha.id,
      devolutiva: restaurar(retorno.devolutiva_supervisor),
      pontos: retorno.pontos_de_atencao.map(restaurar),
    }
  } catch (e) {
    return { success: false, error: mensagemErroIA(e) }
  }
}

// ─── decisão do coordenador ───────────────────────────────────────────────────

export type ResultadoDecisao = { success: true } | { success: false; error: string }

export async function decidirAnalise(
  analiseId: string,
  dados: { decisao: 'aprovada' | 'reprovada'; devolutivaEditada?: string; motivo?: string },
): Promise<ResultadoDecisao> {
  const guard = await requireRole(['admin', 'coordenador'])
  if (!guard.success) return { success: false, error: guard.error }
  const { auth } = guard

  const admin = createAdminClient() as AnyClient
  const { data: analise } = await admin
    .from('ocorrencia_analises_ia')
    .select('id, ocorrencia_id, decisao')
    .eq('id', analiseId)
    .single()
  if (!analise) return { success: false, error: 'Análise não encontrada' }
  if (analise.decisao !== 'pendente') return { success: false, error: 'Esta análise já foi decidida' }

  // Aprovar com devolutiva: posta na conversa, em nome do coordenador, o texto que ELE editou.
  if (dados.decisao === 'aprovada' && dados.devolutivaEditada?.trim()) {
    const postada = await comentarOcorrencia(analise.ocorrencia_id, dados.devolutivaEditada)
    if (!postada.success) return { success: false, error: postada.error }
  }

  const { data: atualizadas, error } = await admin
    .from('ocorrencia_analises_ia')
    .update({
      decisao: dados.decisao,
      decidida_por: auth.user.id,
      decidida_em: new Date().toISOString(),
      motivo: dados.decisao === 'reprovada' ? (dados.motivo?.trim() || null) : null,
    })
    .eq('id', analiseId)
    .eq('decisao', 'pendente')
    .select('id')
  if (error) return { success: false, error: error.message }
  if (!atualizadas || atualizadas.length === 0) return { success: false, error: 'Esta análise já foi decidida' }

  revalidatePath('/ocorrencias')
  return { success: true }
}

// ─── histórico ────────────────────────────────────────────────────────────────

export type AnaliseHistorico = {
  id: string
  created_at: string
  tipo: 'analise' | 'devolutiva_retorno'
  decisao: 'pendente' | 'aprovada' | 'reprovada'
  categoria: string | null
}

export async function listarAnalises(ocorrenciaId: string): Promise<AnaliseHistorico[]> {
  const guard = await requireRole(['admin', 'coordenador'])
  if (!guard.success) return []

  const { data } = await (createAdminClient() as AnyClient)
    .from('ocorrencia_analises_ia')
    .select('id, created_at, tipo, decisao, resultado')
    .eq('ocorrencia_id', ocorrenciaId)
    .order('created_at', { ascending: false })
    .limit(10)

  return ((data ?? []) as { id: string; created_at: string; tipo: AnaliseHistorico['tipo']; decisao: AnaliseHistorico['decisao']; resultado: { categoria?: string } | null }[]).map(a => ({
    id: a.id,
    created_at: a.created_at,
    tipo: a.tipo,
    decisao: a.decisao,
    categoria: a.resultado?.categoria ?? null,
  }))
}
```

- [ ] **Step 2: Verificar**

Run: `npx tsc --noEmit` — Expected: sem erros. Se `requireRole` devolver `auth` com nome diferente do esperado (`guard.auth`), ajuste minimamente e informe.
Run: `npm test` — Expected: tudo passa.

- [ ] **Step 3: Commit**

```bash
git add "app/(admin)/ocorrencias/ia-actions.ts"
git commit -m "feat(ocorrencias): actions da IA (prévia, análise, devolutiva do retorno, decisão, histórico)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 6: Interface

**Files:**
- Create: `components/ocorrencias/modal-analise-ia.tsx`
- Modify: `components/ocorrencias/modal-encaminhar-rh.tsx`
- Modify: `components/ocorrencias/modal-dossie.tsx` (edições pontuais, NÃO reescrever)
- Modify: `app/(admin)/ocorrencias/page.tsx`

- [ ] **Step 1: Criar `modal-analise-ia.tsx`**

```tsx
'use client'

import { useEffect, useState, useTransition } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import {
  previaAnalise,
  analisarOcorrencia,
  rascunharDevolutivaRetorno,
  decidirAnalise,
  listarAnalises,
  type AnaliseHistorico,
} from '@/app/(admin)/ocorrencias/ia-actions'
import type { AnaliseOcorrencia } from '@/lib/ocorrencias/ia/schema'

const CATEGORIA_LABEL: Record<string, string> = {
  saude: 'Saúde', conduta: 'Conduta', desempenho: 'Desempenho',
  seguranca: 'Segurança', relacionamento: 'Relacionamento', outro: 'Outro',
}
const URGENCIA_COR: Record<string, string> = {
  baixa: 'bg-gray-100 text-gray-600', media: 'bg-amber-100 text-amber-700', alta: 'bg-red-100 text-red-700',
}
const DECISAO_LABEL: Record<string, string> = { pendente: 'Pendente', aprovada: 'Aprovada', reprovada: 'Reprovada' }

const textareaClass =
  'w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400'

export function ModalAnaliseIA({
  ocorrenciaId,
  modo,
  onClose,
  onEncaminharRH,
  onAprovada,
}: {
  ocorrenciaId: string
  modo: 'analise' | 'retorno'
  onClose: () => void
  onEncaminharRH: (consideracoes: string) => void
  onAprovada: () => void
}) {
  const [carregando, setCarregando] = useState(modo === 'analise')
  const [mensagem, setMensagem]     = useState('')
  const [iaOk, setIaOk]             = useState(true)
  const [historico, setHistorico]   = useState<AnaliseHistorico[]>([])
  const [respostaRH, setRespostaRH] = useState('')
  const [analiseId, setAnaliseId]   = useState<string | null>(null)
  const [analise, setAnalise]       = useState<AnaliseOcorrencia | null>(null)
  const [devolutiva, setDevolutiva] = useState('')
  const [consideracoes, setConsideracoes] = useState('')
  const [pontos, setPontos]         = useState<string[]>([])
  const [reprovando, setReprovando] = useState(false)
  const [motivo, setMotivo]         = useState('')
  const [erro, setErro]             = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    let ativo = true
    ;(async () => {
      const h = await listarAnalises(ocorrenciaId)
      if (ativo) setHistorico(h)
      if (modo === 'analise') {
        const p = await previaAnalise(ocorrenciaId)
        if (!ativo) return
        if (p.success) { setMensagem(p.mensagem); setIaOk(p.iaConfigurada) }
        else setErro(p.error)
        setCarregando(false)
      }
    })()
    return () => { ativo = false }
  }, [ocorrenciaId, modo])

  function handleAnalisar() {
    setErro(null)
    startTransition(async () => {
      const r = await analisarOcorrencia(ocorrenciaId)
      if (!r.success) { setErro(r.error); return }
      setAnaliseId(r.analiseId)
      setAnalise(r.analise)
      setDevolutiva(r.analise.devolutiva_supervisor)
      setConsideracoes(r.analise.email_rh)
    })
  }

  function handleRascunharRetorno() {
    setErro(null)
    startTransition(async () => {
      const r = await rascunharDevolutivaRetorno(ocorrenciaId, respostaRH)
      if (!r.success) { setErro(r.error); return }
      setAnaliseId(r.analiseId)
      setDevolutiva(r.devolutiva)
      setPontos(r.pontos)
    })
  }

  function handleAprovarDevolutiva() {
    if (!analiseId) return
    setErro(null)
    startTransition(async () => {
      const r = await decidirAnalise(analiseId, { decisao: 'aprovada', devolutivaEditada: devolutiva })
      if (!r.success) { setErro(r.error); return }
      onAprovada()
      onClose()
    })
  }

  function handleEncaminhar() {
    if (!analiseId) return
    setErro(null)
    startTransition(async () => {
      const r = await decidirAnalise(analiseId, { decisao: 'aprovada' })
      if (!r.success) { setErro(r.error); return }
      onEncaminharRH(consideracoes)
      onClose()
    })
  }

  function handleReprovar() {
    if (!analiseId) return
    setErro(null)
    startTransition(async () => {
      const r = await decidirAnalise(analiseId, { decisao: 'reprovada', motivo })
      if (!r.success) { setErro(r.error); return }
      onClose()
    })
  }

  const temResultado = modo === 'analise' ? !!analise : !!analiseId

  return (
    <Dialog.Root open onOpenChange={(aberto) => { if (!aberto) onClose() }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[60] bg-black/50" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-[61] max-h-[90vh] w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
          <Dialog.Title className="mb-1 text-sm font-bold uppercase tracking-widest text-gray-900">
            {modo === 'analise' ? 'Analisar com IA' : 'Devolutiva a partir do retorno do RH'}
          </Dialog.Title>
          <p className="mb-4 rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600">
            Sugestão da IA. A decisão é sua: nada é enviado ao supervisor nem ao RH sem a sua aprovação.
          </p>

          {erro && <p className="mb-3 text-xs text-red-500">{erro}</p>}

          {/* ── passo 1: prévia (análise) ou colar a resposta do RH (retorno) ── */}
          {!temResultado && modo === 'analise' && (
            carregando ? (
              <p className="py-8 text-center text-sm text-gray-400">Preparando a prévia…</p>
            ) : (
              <div className="space-y-3">
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  <strong>Confira o que vai para a IA.</strong> Nome, RE, posto, CPF, salário, PCD e CID não são enviados,
                  e nomes de funcionários e supervisores viram códigos (FUNC_1…). Atenção: nomes de terceiros escritos no
                  relato (&quot;a diretora Fulana&quot;, &quot;a filha&quot;) não são detectados. Se houver, edite a ocorrência antes.
                </p>
                <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700">
                  {mensagem}
                </pre>
                {!iaOk && <p className="text-xs text-red-500">A IA não está configurada neste ambiente.</p>}
                {historico.length > 0 && (
                  <p className="text-xs text-gray-400">
                    {historico.length} análise(s) anterior(es): {historico.map(h => `${DECISAO_LABEL[h.decisao]}`).join(', ')}.
                  </p>
                )}
                <div className="flex justify-end gap-3">
                  <button onClick={onClose} className="h-9 rounded-lg border border-gray-200 px-4 text-xs font-semibold uppercase tracking-widest text-gray-500 hover:bg-gray-50">
                    Cancelar
                  </button>
                  <button
                    disabled={isPending || !iaOk || !mensagem}
                    onClick={handleAnalisar}
                    className="h-9 rounded-lg bg-slate-900 px-4 text-xs font-semibold uppercase tracking-widest text-white hover:bg-slate-700 disabled:opacity-50"
                  >
                    {isPending ? 'Analisando…' : 'Enviar para análise'}
                  </button>
                </div>
              </div>
            )
          )}

          {!temResultado && modo === 'retorno' && (
            <div className="space-y-3">
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Cole a resposta que o RH enviou. Nomes de funcionários e supervisores viram códigos antes de ir à IA;
                nomes de terceiros escritos no texto não são detectados.
              </p>
              <textarea value={respostaRH} onChange={e => setRespostaRH(e.target.value)} rows={6} placeholder="Resposta do RH…" className={textareaClass} />
              <div className="flex justify-end gap-3">
                <button onClick={onClose} className="h-9 rounded-lg border border-gray-200 px-4 text-xs font-semibold uppercase tracking-widest text-gray-500 hover:bg-gray-50">
                  Cancelar
                </button>
                <button
                  disabled={isPending || !respostaRH.trim()}
                  onClick={handleRascunharRetorno}
                  className="h-9 rounded-lg bg-slate-900 px-4 text-xs font-semibold uppercase tracking-widest text-white hover:bg-slate-700 disabled:opacity-50"
                >
                  {isPending ? 'Rascunhando…' : 'Rascunhar devolutiva'}
                </button>
              </div>
            </div>
          )}

          {/* ── passo 2: resultado ── */}
          {temResultado && (
            <div className="space-y-4">
              {analise && (
                <>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-700">
                      {CATEGORIA_LABEL[analise.categoria] ?? analise.categoria}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${URGENCIA_COR[analise.urgencia] ?? ''}`}>
                      Urgência {analise.urgencia}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${analise.encaminhar_rh ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'}`}>
                      {analise.encaminhar_rh ? 'Sugere encaminhar ao RH' : 'Não precisa ir ao RH'}
                    </span>
                  </div>

                  {analise.alertas.length > 0 && (
                    <ul className="space-y-1 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                      {analise.alertas.map((a, i) => <li key={i}>⚠ {a}</li>)}
                    </ul>
                  )}

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Resumo</p>
                    <p className="mt-1 text-sm text-gray-700">{analise.resumo}</p>
                  </div>

                  {analise.resolucao_sugerida.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Resolução sugerida</p>
                      <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm text-gray-700">
                        {analise.resolucao_sugerida.map((p, i) => <li key={i}>{p}</li>)}
                      </ol>
                    </div>
                  )}

                  {analise.encaminhar_rh && analise.motivo_rh && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Por que encaminhar ao RH</p>
                      <p className="mt-1 text-sm text-gray-700">{analise.motivo_rh}</p>
                    </div>
                  )}
                </>
              )}

              {pontos.length > 0 && (
                <ul className="space-y-1 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  {pontos.map((p, i) => <li key={i}>• {p}</li>)}
                </ul>
              )}

              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-widest text-gray-400">
                  Devolutiva ao supervisor (edite antes de aprovar)
                </label>
                <textarea value={devolutiva} onChange={e => setDevolutiva(e.target.value)} rows={5} className={textareaClass} />
              </div>

              {analise?.encaminhar_rh && (
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-widest text-gray-400">
                    Considerações para o e-mail ao RH (entram no rascunho do e-mail)
                  </label>
                  <textarea value={consideracoes} onChange={e => setConsideracoes(e.target.value)} rows={4} className={textareaClass} />
                </div>
              )}

              {reprovando ? (
                <div className="space-y-2">
                  <input
                    value={motivo}
                    onChange={e => setMotivo(e.target.value)}
                    placeholder="Motivo da reprovação (opcional)"
                    className="h-9 w-full rounded-lg border border-gray-200 px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400"
                  />
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setReprovando(false)} className="h-9 rounded-lg border border-gray-200 px-4 text-xs font-semibold uppercase tracking-widest text-gray-500 hover:bg-gray-50">
                      Voltar
                    </button>
                    <button disabled={isPending} onClick={handleReprovar} className="h-9 rounded-lg bg-red-600 px-4 text-xs font-semibold uppercase tracking-widest text-white hover:bg-red-700 disabled:opacity-50">
                      {isPending ? 'Salvando…' : 'Confirmar reprovação'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap justify-end gap-2">
                  <button disabled={isPending} onClick={() => setReprovando(true)} className="h-9 rounded-lg border border-red-200 px-4 text-xs font-semibold uppercase tracking-widest text-red-600 hover:bg-red-50 disabled:opacity-50">
                    Reprovar
                  </button>
                  {analise?.encaminhar_rh && (
                    <button disabled={isPending} onClick={handleEncaminhar} className="h-9 rounded-lg bg-indigo-600 px-4 text-xs font-semibold uppercase tracking-widest text-white hover:bg-indigo-700 disabled:opacity-50">
                      Encaminhar ao RH
                    </button>
                  )}
                  <button
                    disabled={isPending || !devolutiva.trim()}
                    onClick={handleAprovarDevolutiva}
                    className="h-9 rounded-lg bg-slate-900 px-4 text-xs font-semibold uppercase tracking-widest text-white hover:bg-slate-700 disabled:opacity-50"
                  >
                    {isPending ? 'Enviando…' : 'Aprovar devolutiva'}
                  </button>
                </div>
              )}
            </div>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
```

- [ ] **Step 2: `modal-encaminhar-rh.tsx` aceita as considerações da IA.**

Adicionar o import `import { inserirConsideracoes } from '@/lib/ocorrencias/encaminhar-rh'`. Na assinatura, acrescentar a prop opcional `consideracoes?: string` (tipo e desestruturação). No `useEffect`, trocar `setCorpo(r.corpo)` por `setCorpo(consideracoes ? inserirConsideracoes(r.corpo, consideracoes) : r.corpo)`. A dependência do efeito continua `[ocorrenciaId]` (com o mesmo `// eslint-disable-next-line react-hooks/exhaustive-deps` acima da linha de dependências, se o lint reclamar).

- [ ] **Step 3: `modal-dossie.tsx` — integrar (edições pontuais; leia o arquivo antes).**

(a) Imports: acrescentar `import { ModalAnaliseIA } from './modal-analise-ia'`.

(b) Estados, junto dos outros de RH (`encaminharId`, `retornoId`…):
```tsx
  const [analiseIA, setAnaliseIA]       = useState<{ id: string; modo: 'analise' | 'retorno' } | null>(null)
  const [consideracoesIA, setConsideracoesIA] = useState('')
```

(c) Botões: no bloco de gestão da coluna direita do item (o que já mostra "Encaminhar ao RH"/"Com o RH há N dias"), ANTES de fechar o fragmento condicional externo, garantir estes dois botões extras. Concretamente, logo depois do bloco `{ehGestao && ehOcorrencia && (item.status === 'aberta' || item.status === 'em_analise') && ( ... )}` da fase 1, adicionar:

```tsx
                            {ehGestao && ehOcorrencia && (item.status === 'aberta' || item.status === 'em_analise') && (
                              <>
                                <button
                                  disabled={isPending}
                                  onClick={() => setAnaliseIA({ id: item.id, modo: 'analise' })}
                                  className="rounded-lg bg-purple-50 px-2 py-0.5 text-xs font-semibold text-purple-700 hover:bg-purple-100 disabled:opacity-50"
                                >
                                  Analisar com IA
                                </button>
                                {item.com_rh_desde && (
                                  <button
                                    disabled={isPending}
                                    onClick={() => setAnaliseIA({ id: item.id, modo: 'retorno' })}
                                    className="rounded-lg bg-purple-50 px-2 py-0.5 text-xs font-semibold text-purple-700 hover:bg-purple-100 disabled:opacity-50"
                                  >
                                    Rascunhar devolutiva do retorno
                                  </button>
                                )}
                              </>
                            )}
```

(d) Renderizar o modal, junto do `ModalEncaminharRH` (perto do fim do JSX):
```tsx
              {ehGestao && analiseIA && (
                <ModalAnaliseIA
                  ocorrenciaId={analiseIA.id.replace('ocorrencia-', '')}
                  modo={analiseIA.modo}
                  onClose={() => setAnaliseIA(null)}
                  onAprovada={() => carregar(true)}
                  onEncaminharRH={(consideracoes) => {
                    setConsideracoesIA(consideracoes)
                    setEncaminharId(analiseIA.id)
                  }}
                />
              )}
```
E no `<ModalEncaminharRH ... />` existente acrescentar a prop `consideracoes={consideracoesIA}`; no `onClose` dele, além de `setEncaminharId(null)`, limpar com `setConsideracoesIA('')`.

- [ ] **Step 4: `page.tsx`** — no topo do arquivo (depois dos imports) adicionar:
```tsx
// A análise de IA leva mais que os 10 s padrão de uma função na Vercel.
export const maxDuration = 60
```

- [ ] **Step 5: Verificar**

Run: `npx tsc --noEmit` — sem erros. Run: `npm test` — tudo passa.
Confirmar com `git diff --stat` que `modal-dossie.tsx` só ganhou linhas (e a linha `Registrado por` continua nele).

- [ ] **Step 6: Commit**

```bash
git add components/ocorrencias/modal-analise-ia.tsx components/ocorrencias/modal-encaminhar-rh.tsx components/ocorrencias/modal-dossie.tsx "app/(admin)/ocorrencias/page.tsx"
git commit -m "feat(ocorrencias): modal de análise de IA (prévia, resultado, aprovar/reprovar) e integração no dossiê

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 7: Build e verificação manual

- [ ] **Step 1:** `npm run build` — sem erros.
- [ ] **Step 2:** Confirmar com o usuário que as DUAS migrações estão aplicadas no Supabase Studio (`20260925_encaminhar_rh.sql` e `20260925_ia_ocorrencias.sql`) e que `ANTHROPIC_API_KEY` existe em Production na Vercel (já existe).
- [ ] **Step 3: QA manual (admin/coordenador)**
  1. Ocorrência aberta: botão **Analisar com IA**. A prévia mostra o texto anonimizado: sem nome, RE, CPF, posto; nomes viram FUNC_n; contagens do histórico aparecem.
  2. **Enviar para análise**: aparecem categoria, urgência, resumo, resolução, alertas, e os dois campos editáveis; nomes restaurados nos rascunhos.
  3. **Reprovar** (com motivo): nada é enviado ao supervisor; a linha em `ocorrencia_analises_ia` fica `reprovada`.
  4. **Aprovar devolutiva**: a mensagem editada aparece na Conversa em nome do coordenador e o supervisor é avisado.
  5. **Encaminhar ao RH** (quando a IA sugere): abre o modal da fase 1 com as "CONSIDERAÇÕES" da IA dentro do rascunho; o e-mail só sai ao clicar em Enviar.
  6. Com a ocorrência "Com o RH": **Rascunhar devolutiva do retorno** → colar a resposta → rascunho → aprovar.
  7. Supervisor: nenhum botão, nenhum dado de IA.
  8. `select * from ocorrencia_analises_ia` no Supabase: `texto_enviado` sem nome/CPF; tokens preenchidos.

---

## Self-Review

**Cobertura da spec (`2026-09-25-ia-ocorrencias-design.md`):**
- Botão manual + prévia do texto exato → Tasks 5 (`previaAnalise`) e 6. ✅
- Dados enviados só os combinados (texto anonimizado, função, data, gravidade, contagens) e teste de que nada além entra → Task 2 (`montarContexto` + teste do objeto contaminado), Task 5 (`carregarBase` com colunas explícitas). ✅
- Anonimização de funcionários E supervisores, restauração de nomes só no servidor → Task 2 (`anonimizarOcorrencia`, `restaurarNomes`), Task 5 (`carregarPessoas`). ✅
- Saída estruturada validada (`lerAnalise`) → Task 2. ✅
- Auditoria (`ocorrencia_analises_ia`, texto enviado, tokens, decisão) → Tasks 1 e 5. ✅
- Aprovar/reprovar; aprovar devolutiva posta o texto **editado** pelo coordenador (via `comentarOcorrencia`, que já notifica) → Task 5 (`decidirAnalise`). ✅
- Aprovar encaminhamento abre o modal da fase 1 com o rascunho da IA, sem enviar sozinho → Task 6. ✅
- Rascunhar devolutiva a partir da resposta do RH → Task 5 (`rascunharDevolutivaRetorno`) e Task 6. ✅
- Limite de uso, erro claro sem `ANTHROPIC_API_KEY`, só admin/coordenador → Task 5. ✅
- `chamarFerramenta` com opções sem mudar acordos → Task 3. ✅
- Modelo configurável por `ANTHROPIC_MODEL_OCORRENCIAS`, padrão Sonnet → Task 5. ✅
- Histórico das análises visível só à gestão → Task 5 (`listarAnalises`), Task 6 (linha na prévia). ✅

**Desvios da spec (justificados, listados no topo):** `email_rh` = bloco de considerações; `maxDuration = 60`; `temperatura: null` opcional.

**Consistência de tipos:** `AnaliseOcorrencia`/`RetornoOcorrencia` definidos em `schema.ts` (Task 2) e usados em `ia-actions.ts` (Task 5) e `modal-analise-ia.tsx` (Task 6) com os mesmos campos. `ResultadoAnalise`/`ResultadoRetorno`/`PreviaAnalise`/`AnaliseHistorico` definidos em `ia-actions.ts` e consumidos pelo modal (`r.success`, `r.analise`, `r.analiseId`, `r.devolutiva`, `r.pontos`). `inserirConsideracoes` (Task 4) é chamado em `modal-encaminhar-rh.tsx` (Task 6). `DadosContexto` (Task 2) é montado em `ia-actions.ts` com exatamente `funcao`, `dataOcorrencia`, `gravidade`, `textoAnonimo`, `historico`.

**Riscos aceitos:** nomes de terceiros no texto livre não são mascarados (a tela avisa e o envio é manual); o limite de uso é em memória por instância (melhor esforço, como nos acordos); o texto da ocorrência sai para a API da Anthropic por decisão do usuário, com prévia e auditoria.
