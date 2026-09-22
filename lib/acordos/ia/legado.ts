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
  /** 'baixa' quando o texto é ambíguo ou incompleto demais para classificar com segurança. */
  confianca: 'alta' | 'baixa'
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
          'T2 = TRABALHARAM PARTE do dia (ex.: só até 12h em vez do dia inteiro) e foram liberados/dispensados antes do fim do expediente; repõem depois com acréscimo. ' +
          'T3 = NÃO TRABALHARAM NADA naquele dia (dispensa total, emenda, ponto facultativo), e esse dia sem trabalho vem ANTES das datas de acréscimo/reposição; repõem depois com acréscimo. ' +
          'Se o texto menciona um horário até o qual trabalharam naquele dia (ex.: "até as 12h"), é T2, não T3. ' +
          'T4 = trabalham a mais (acréscimo) em dias ANTES de uma data de folga/emenda futura marcada — a ordem cronológica é acréscimo primeiro, depois a folga. Mesmo que o texto use a palavra "emenda de feriado" para a folga, se o acréscimo vem ANTES dela no tempo, é T4, não T3. ' +
          'T5 = um único dia trabalhado (ou poucos, sem "acréscimo diário") que gera uma folga em outra data; não confundir com T4, que é acréscimo de jornada em VÁRIOS dias (banco de horas) antes da folga. null se não der para saber.',
      },
      direcao_texto: {
        type: 'string',
        enum: ['descanso', 'reposicao', 'indefinida'],
        description:
          '"descanso" se o texto faz quem trabalhou a mais reduzir a jornada ou folgar; "reposicao" se o texto faz os funcionários trabalharem A MAIS (acréscimo de jornada) em algum momento, seja para repor horas de um dia em que NÃO trabalharam ou saíram mais cedo, seja como banco de horas antes de uma folga futura; "indefinida" se não der para saber.',
      },
      trabalhou_a_mais: {
        type: 'boolean',
        description:
          'true se o texto diz que os funcionários trabalharam num dia ou evento além do horário normal — procure frases como ' +
          '"X horas laboradas no referido evento" ou "trabalharam no dia X (evento)", mesmo que o texto, em seguida, descreva ' +
          'incorretamente a compensação como um NOVO acréscimo (isso não muda o fato de que já trabalharam a mais).',
      },
      data_evento: { ...STR, description: 'Data do dia trabalhado ou da dispensa, AAAA-MM-DD.' },
      data_folga: { ...STR, description: 'Data da folga, AAAA-MM-DD.' },
      tem_campos_em_branco: { type: 'boolean', description: 'true se sobrou algo como [DATA] ou [MOTIVO] no texto.' },
      confianca: {
        type: 'string',
        enum: ['alta', 'baixa'],
        description: '"baixa" quando o texto é curto demais, ambíguo ou mistura duas datas/eventos sem deixar claro qual é o dia trabalhado e qual é o dia de compensação. "alta" quando o texto é claro.',
      },
      resumo: { type: 'string', description: 'Uma frase curta (até 160 caracteres) dizendo o que o acordo faz.' },
    },
    required: ['situacao', 'direcao_texto', 'trabalhou_a_mais', 'confianca', 'resumo'],
  },
}

export const PROMPT_LEGADO = `Você lê o texto de acordos de compensação de horas já emitidos por uma empresa de limpeza e áreas verdes e os classifica. Responda SEMPRE chamando a ferramenta ${NOME_FERRAMENTA_LEGADO}.

Regras:
- Descreva só o que o texto diz. Não invente datas nem motivos; use null quando não estiver escrito.
- Datas do texto (DD/MM/AAAA) viram AAAA-MM-DD.
- Regra de direção do direito do trabalho: quem trabalhou a mais DESCANSA (redução de jornada ou folga); quem deixou de trabalhar REPÕE (acréscimo de jornada). Acordos antigos podem ter errado essa direção: registre em direcao_texto o que o texto de fato diz, sem corrigir.
- O texto pode conter campos em branco como [DATA] ou [MOTIVO]: marque tem_campos_em_branco.
- Se o texto for curto, ambíguo ou não deixar claro a direção (quem trabalhou a mais e quem repõe), marque confianca "baixa" e, se preciso, situacao null — não force um rótulo.`

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
    confianca: o.confianca === 'baixa' ? 'baixa' : 'alta',
    resumo: ehStr(o.resumo) ? o.resumo.trim().slice(0, 200) : '',
  }
}

/**
 * Acordo que provavelmente saiu com a direção trocada (o bug conhecido do "T1 antigo"): o texto diz
 * que TRABALHARAM A MAIS e a situação é T1 (sai mais cedo) ou T5 (ganha folga) — nas duas, quem
 * trabalhou a mais deveria DESCANSAR — mas o texto manda REPOR com acréscimo. T2/T3/T4 usam acréscimo
 * por definição (não é inversão nelas). Sem `trabalhou_a_mais`, o texto já descreve o caso oposto
 * (não trabalhou, repõe), que é a direção certa mesmo com a situação rotulada errado. Precisa de
 * revisão do RH.
 */
export function possivelmenteInvertido(c: ClassificacaoLegado): boolean {
  return c.trabalhou_a_mais && (c.situacao === 'T1' || c.situacao === 'T5') && c.direcao_texto === 'reposicao'
}
