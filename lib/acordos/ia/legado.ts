import type { TemplateId } from '../tipos'

/** Como a IA leu o texto de um acordo antigo (só leitura: nada disso é gravado sem revisão). */
export interface ClassificacaoLegado {
  situacao: TemplateId | null
  /** 'descanso' = o texto manda quem trabalhou a mais reduzir/folgar; 'reposicao' = manda repor com acréscimo. */
  direcao_texto: 'descanso' | 'reposicao' | 'indefinida'
  /** O texto diz que trabalharam num dia/evento além do horário normal. */
  trabalhou_a_mais: boolean
  data_evento: string | null
  data_folga: string | null
  /** O texto ainda tem campos em branco entre colchetes. */
  tem_campos_em_branco: boolean
  resumo: string
}

export const NOME_FERRAMENTA_LEGADO = 'classificar_acordo_antigo'

const STR = { type: ['string', 'null'] }

export const FERRAMENTA_LEGADO = {
  name: NOME_FERRAMENTA_LEGADO,
  description: 'Classifica o texto de um acordo de compensação de horas já emitido. Só descreve o que o texto diz; nunca inventa.',
  input_schema: {
    type: 'object' as const,
    properties: {
      situacao: {
        type: ['string', 'null'],
        enum: ['T1', 'T2', 'T3', 'T4', 'T5', null],
        description:
          'T1 = trabalharam além do horário e saem mais cedo em vários dias. T5 = trabalharam num dia e ganham folga em outro. ' +
          'T2 = liberados antes do fim do expediente e repõem depois. T3 = não trabalharam o dia todo (emenda) e repõem depois. ' +
          'T4 = trabalham a mais agora (banco de horas) para folgar depois. null se não der para saber.',
      },
      direcao_texto: {
        type: 'string',
        enum: ['descanso', 'reposicao', 'indefinida'],
        description:
          '"descanso" se o texto faz quem trabalhou a mais reduzir a jornada ou folgar; "reposicao" se o texto faz os funcionários trabalharem A MAIS (acréscimo) para repor horas de um dia em que NÃO trabalharam ou saíram mais cedo; "indefinida" se não der para saber. Trabalhar a mais ANTES para folgar depois (banco de horas com dia de folga marcado) NÃO é reposição: use "descanso".',
      },
      trabalhou_a_mais: { type: 'boolean', description: 'true se o texto diz que os funcionários trabalharam num dia ou evento além do horário normal.' },
      data_evento: { ...STR, description: 'Data do dia trabalhado ou da dispensa, AAAA-MM-DD.' },
      data_folga: { ...STR, description: 'Data da folga, AAAA-MM-DD.' },
      tem_campos_em_branco: { type: 'boolean', description: 'true se sobrou algo como [DATA] ou [MOTIVO] no texto.' },
      resumo: { type: 'string', description: 'Uma frase curta (até 160 caracteres) dizendo o que o acordo faz.' },
    },
    required: ['situacao', 'direcao_texto', 'trabalhou_a_mais', 'resumo'],
  },
}

export const PROMPT_LEGADO = `Você lê o texto de acordos de compensação de horas já emitidos por uma empresa de limpeza e áreas verdes e os classifica. Responda SEMPRE chamando a ferramenta ${NOME_FERRAMENTA_LEGADO}.

Regras:
- Descreva só o que o texto diz. Não invente datas nem motivos; use null quando não estiver escrito.
- Datas do texto (DD/MM/AAAA) viram AAAA-MM-DD.
- Regra de direção do direito do trabalho: quem trabalhou a mais DESCANSA (redução de jornada ou folga); quem deixou de trabalhar REPÕE (acréscimo de jornada). Acordos antigos podem ter errado essa direção: registre em direcao_texto o que o texto de fato diz, sem corrigir.
- O texto pode conter campos em branco como [DATA] ou [MOTIVO]: marque tem_campos_em_branco.`

const ehStr = (v: unknown): v is string => typeof v === 'string'

export function lerLegado(bruto: unknown): ClassificacaoLegado | null {
  if (!bruto || typeof bruto !== 'object' || Array.isArray(bruto)) return null
  const o = bruto as Record<string, unknown>
  const dir = o.direcao_texto === 'descanso' || o.direcao_texto === 'reposicao' ? o.direcao_texto : 'indefinida'
  const data = (v: unknown) => (ehStr(v) && /^\d{4}-\d{2}-\d{2}$/.test(v.trim()) ? v.trim() : null)
  return {
    situacao: ['T1', 'T2', 'T3', 'T4', 'T5'].includes(o.situacao as string) ? (o.situacao as TemplateId) : null,
    direcao_texto: dir,
    trabalhou_a_mais: o.trabalhou_a_mais === true,
    data_evento: data(o.data_evento),
    data_folga: data(o.data_folga),
    tem_campos_em_branco: o.tem_campos_em_branco === true,
    resumo: ehStr(o.resumo) ? o.resumo.trim().slice(0, 200) : '',
  }
}

/**
 * Acordo que provavelmente saiu com a direção trocada: o texto diz que trabalharam a mais
 * e, em vez de descansar, manda repor com acréscimo, sem folga nenhuma. Precisa de revisão do RH.
 */
export function possivelmenteInvertido(c: ClassificacaoLegado): boolean {
  // Banco de horas legítimo também "repõe com acréscimo", mas o acréscimo vem ANTES de uma folga marcada.
  // Invertido é trabalhar a mais e, em vez de descansar, ainda ter que trabalhar mais (sem nenhuma folga no texto).
  return c.trabalhou_a_mais && c.direcao_texto === 'reposicao' && !c.data_folga
}
