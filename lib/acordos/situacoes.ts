import type { TemplateId } from './tipos'

export interface SituacaoInfo {
  /** Pergunta/descrição em linguagem do dia a dia (o "TEMPLATES[id].titulo" é o nome técnico). */
  titulo: string
  /** Uma linha de exemplo concreto. */
  exemplo: string
  /** Direção da compensação, em poucas palavras. */
  tag: string
  /** Rótulo curto quando a situação é uma das opções de um grupo (T1/T5 em "Como vão descansar?"; T3/T2 em "Quanto do dia?"). */
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
    opcao: 'Só parte do dia: liberados a partir de uma hora',
    regra: 'Repõe com acréscimo (até 2h/dia).',
  },
  T3: {
    titulo: 'Não trabalharam o dia todo (emenda) e vão repor depois',
    exemplo: 'Sexta 05/06 ponto facultativo. Repõem cerca de 1h por dia em 8 dias úteis.',
    tag: 'Deixaram de trabalhar → repõem depois',
    opcao: 'O dia todo: não trabalharam nada nesse dia',
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

/**
 * Dispensados (ponto facultativo, pedido do cliente, acordo…): um só card; depois a pessoa diz quanto do dia
 * (T3 = o dia todo, T2 = a partir de uma hora). Os dois templates seguem separados por baixo.
 */
export const GRUPO_DISPENSA = {
  titulo: 'Foram dispensados (o dia todo ou parte do dia) e vão repor depois',
  tag: 'Deixaram de trabalhar → repõem depois',
  exemplo: 'Ponto facultativo ou pedido do cliente: dia todo, ou liberados às 12h. Repõem depois.',
  regra: 'Repõe com acréscimo (até 2h/dia).',
  /** Ordem das opções em "Quanto do dia?"; a primeira é a que entra ao clicar no card. */
  templates: ['T3', 'T2'] as TemplateId[],
}

/** Quem trabalhou a mais escolhe depois como descansa: em um dia (T5) ou em horas por vários dias (T1). */
export const GRUPO_TRABALHOU = {
  titulo: 'Trabalharam a mais (sábado, domingo, evento ou fora do horário)',
  tag: 'Trabalharam a mais → descansam depois',
  exemplo: 'Mutirão de sábado, 4h. Descansam em um dia de folga ou saem mais cedo em vários dias.',
  regra: 'Escolha a seguir como descansam.',
  templates: ['T5', 'T1'] as TemplateId[],
}
