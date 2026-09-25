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
