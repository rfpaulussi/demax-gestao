import type { TemplateId } from './tipos'

export type CorSituacao = 'blue' | 'amber' | 'orange' | 'indigo' | 'green'

export interface SituacaoInfo {
  /** Pergunta/descrição em linguagem do dia a dia (o "TEMPLATES[id].titulo" é o nome técnico). */
  titulo: string
  /** Uma linha de exemplo concreto. */
  exemplo: string
  /** Direção da compensação, em poucas palavras. */
  tag: string
  cor: CorSituacao
}

export const SITUACOES: Record<TemplateId, SituacaoInfo> = {
  T1: {
    titulo: 'Trabalharam além do horário e vão sair mais cedo depois',
    exemplo: 'Festa Junina, sábado 8h às 12h. Depois saem 1h mais cedo por 4 dias.',
    tag: 'Trabalharam a mais → descansam depois',
    cor: 'blue',
  },
  T2: {
    titulo: 'Foram liberados antes do fim do expediente e vão repor depois',
    exemplo: 'Liberados às 12h em 14/09. Repõem 50 min por dia em 6 dias.',
    tag: 'Deixaram de trabalhar → repõem depois',
    cor: 'amber',
  },
  T3: {
    titulo: 'Não trabalharam o dia todo (emenda) e vão repor depois',
    exemplo: 'Sexta 05/06 ponto facultativo. Repõem cerca de 1h por dia em 8 dias úteis.',
    tag: 'Deixaram de trabalhar → repõem depois',
    cor: 'orange',
  },
  T4: {
    titulo: 'Trabalham a mais agora para folgar depois',
    exemplo: '+1h por dia de 01 a 10/06 para folgar em 12/06.',
    tag: 'Trabalham a mais → folgam depois',
    cor: 'indigo',
  },
  T5: {
    titulo: 'Trabalharam no sábado ou domingo e ganham uma folga',
    exemplo: 'Mutirão sábado 20/06, 4h. Folga de 4h no dia 26/06.',
    tag: 'Trabalharam a mais → ganham folga',
    cor: 'green',
  },
}
