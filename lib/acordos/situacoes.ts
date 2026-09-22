import type { TemplateId } from './tipos'

export type CorSituacao = 'blue' | 'amber' | 'orange' | 'indigo' | 'green'

export interface SituacaoInfo {
  /** Pergunta/descrição em linguagem do dia a dia (o "TEMPLATES[id].titulo" é o nome técnico). */
  titulo: string
  /** Uma linha de exemplo concreto. */
  exemplo: string
  /** Direção da compensação, em poucas palavras. */
  tag: string
  /** Rótulo curto quando a situação é uma das formas de descanso de um grupo (T1/T5). */
  opcao?: string
  /** Como compensa e quais limites valem, em uma frase curta. */
  regra: string
  cor: CorSituacao
}

export const SITUACOES: Record<TemplateId, SituacaoInfo> = {
  T1: {
    titulo: 'Trabalharam além do horário e vão sair mais cedo depois',
    exemplo: 'Festa Junina, sábado 8h às 12h. Depois saem 1h mais cedo por 4 dias.',
    tag: 'Trabalharam a mais → descansam depois',
    opcao: 'Saem mais cedo em vários dias',
    regra: 'Sai mais cedo em dias úteis, em partes iguais. Só compensa em tempo.',
    cor: 'blue',
  },
  T2: {
    titulo: 'Foram liberados antes do fim do expediente e vão repor depois',
    exemplo: 'Liberados às 12h em 14/09. Repõem 50 min por dia em 6 dias.',
    tag: 'Deixaram de trabalhar → repõem depois',
    regra: 'Repõe com acréscimo em dias úteis: até 2h por dia, jornada até 10h.',
    cor: 'amber',
  },
  T3: {
    titulo: 'Não trabalharam o dia todo (emenda) e vão repor depois',
    exemplo: 'Sexta 05/06 ponto facultativo. Repõem cerca de 1h por dia em 8 dias úteis.',
    tag: 'Deixaram de trabalhar → repõem depois',
    regra: 'Repõe com acréscimo em dias úteis: até 2h por dia, jornada até 10h.',
    cor: 'orange',
  },
  T4: {
    titulo: 'Trabalham a mais agora para folgar depois',
    exemplo: '+1h por dia de 01 a 10/06 para folgar em 12/06.',
    tag: 'Trabalham a mais → folgam depois',
    regra: 'Acréscimos antes, folga depois. Prazo máximo obrigatório (até 6 meses).',
    cor: 'indigo',
  },
  T5: {
    titulo: 'Trabalharam no sábado ou domingo e ganham uma folga',
    exemplo: 'Mutirão sábado 20/06, 4h. Folga de 4h no dia 26/06.',
    tag: 'Trabalharam a mais → ganham folga',
    opcao: 'Ganham uma folga (dia inteiro ou parte das horas)',
    regra: 'Folga em dia posterior, inteira ou só parte das horas. Só compensa em tempo.',
    cor: 'green',
  },
}

/** Quem trabalhou a mais escolhe depois como descansa: em um dia (T5) ou em horas por vários dias (T1). */
export const GRUPO_TRABALHOU = {
  titulo: 'Trabalharam a mais (sábado, domingo, evento ou fora do horário)',
  tag: 'Trabalharam a mais → descansam depois',
  exemplo: 'Mutirão de sábado, 4h. Descansam em um dia de folga ou saem mais cedo em vários dias.',
  regra: 'Você escolhe a seguir como descansam. Só compensa em tempo.',
  cor: 'blue' as CorSituacao,
  templates: ['T5', 'T1'] as TemplateId[],
}
