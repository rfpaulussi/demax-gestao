import type { TemplateId } from './tipos'

export interface SituacaoInfo {
  /** Pergunta/descrição em linguagem do dia a dia (o "TEMPLATES[id].titulo" é o nome técnico). */
  titulo: string
  /** Uma linha de exemplo concreto. */
  exemplo: string
  /** Direção da compensação, em poucas palavras. */
  tag: string
  /** Rótulo curto quando a situação é uma das formas de descanso de um grupo (T1/T5). */
  opcao?: string
  /** Como compensa, em poucas palavras (os limites completos ficam no card de aviso do formulário). */
  regra: string
}

export const SITUACOES: Record<TemplateId, SituacaoInfo> = {
  T1: {
    titulo: 'Trabalharam além do horário e vão sair mais cedo depois',
    exemplo: 'Festa Junina, sábado 8h às 12h. Depois saem 1h mais cedo por 4 dias.',
    tag: 'Trabalharam a mais → descansam depois',
    opcao: 'Saem mais cedo em vários dias',
    regra: 'Sai mais cedo, em partes iguais.',
  },
  T2: {
    titulo: 'Foram liberados antes do fim do expediente e vão repor depois',
    exemplo: 'Liberados às 12h em 14/09. Repõem 50 min por dia em 6 dias.',
    tag: 'Deixaram de trabalhar → repõem depois',
    regra: 'Repõe com acréscimo (até 2h/dia).',
  },
  T3: {
    titulo: 'Não trabalharam o dia todo (emenda) e vão repor depois',
    exemplo: 'Sexta 05/06 ponto facultativo. Repõem cerca de 1h por dia em 8 dias úteis.',
    tag: 'Deixaram de trabalhar → repõem depois',
    regra: 'Repõe com acréscimo (até 2h/dia).',
  },
  T4: {
    titulo: 'Trabalham a mais agora para folgar depois',
    exemplo: '+1h por dia de 01 a 10/06 para folgar em 12/06.',
    tag: 'Trabalham a mais → folgam depois',
    regra: 'Acréscimo antes, folga depois. Prazo até 6 meses.',
  },
  T5: {
    titulo: 'Trabalharam no sábado ou domingo e ganham uma folga',
    exemplo: 'Mutirão sábado 20/06, 4h. Folga de 4h no dia 26/06.',
    tag: 'Trabalharam a mais → ganham folga',
    opcao: 'Ganham uma folga (dia inteiro ou parte das horas)',
    regra: 'Folga depois (inteira ou parcial).',
  },
}

/** Quem trabalhou a mais escolhe depois como descansa: em um dia (T5) ou em horas por vários dias (T1). */
export const GRUPO_TRABALHOU = {
  titulo: 'Trabalharam a mais (sábado, domingo, evento ou fora do horário)',
  tag: 'Trabalharam a mais → descansam depois',
  exemplo: 'Mutirão de sábado, 4h. Descansam em um dia de folga ou saem mais cedo em vários dias.',
  regra: 'Escolha a seguir como descansam.',
  templates: ['T5', 'T1'] as TemplateId[],
}
