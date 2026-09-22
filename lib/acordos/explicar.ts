export type OrigemRegra = 'lei' | 'sistema' | 'cadastro'

export interface Explicacao {
  origem: OrigemRegra
  /** Em uma frase: por que o sistema barra ou avisa. */
  porque: string
  /** Botão de correção que o modal sabe fazer. */
  acao?: 'recalcular_dias'
}

/**
 * Por que cada bloqueio existe e de quem é a regra: lei (CLT), regra do próprio sistema ou dado de cadastro.
 * Convenção coletiva pode mudar os limites da CLT: o RH valida.
 */
const EXPLICACOES: Record<string, Explicacao> = {
  LIMITE_JORNADA: {
    origem: 'lei',
    porque: 'Com o acréscimo, a jornada do dia passaria de 10h. O limite diário é legal (CLT, art. 59).',
    acao: 'recalcular_dias',
  },
  LIMITE_ACRESCIMO: {
    origem: 'lei',
    porque: 'O acréscimo por acordo de compensação vai até 2h por dia (CLT, art. 59). Espalhe as horas em mais dias.',
    acao: 'recalcular_dias',
  },
  DIVISAO: {
    origem: 'sistema',
    porque: 'Regra do sistema, não da lei: as horas são divididas em minutos iguais por dia. Escolha uma quantidade de dias que divida certo.',
    acao: 'recalcular_dias',
  },
  ORIGEM_LIMITE: {
    origem: 'lei',
    porque: 'Não se trabalha mais de 10h num mesmo dia (CLT, art. 59). Confira o período ou as horas informadas.',
  },
  PRAZO_LONGO: {
    origem: 'lei',
    porque: 'Compensação em banco de horas tem prazo máximo de 6 meses (CLT, art. 59, §5º).',
  },
  PRAZO_OBRIGATORIO: {
    origem: 'lei',
    porque: 'Quando a compensação passa para outro mês ela vira banco de horas, que exige prazo máximo (até 6 meses).',
  },
  PRAZO_ANTES: {
    origem: 'sistema',
    porque: 'O prazo limite não pode ser anterior à última data do acordo.',
  },
  ORDEM_DATAS: {
    origem: 'sistema',
    porque: 'Quem trabalhou a mais descansa depois; quem deixou de trabalhar repõe depois. No banco de horas, os acréscimos vêm antes da folga.',
  },
  DIA_DE_FOLGA: {
    origem: 'cadastro',
    porque: 'O dia escolhido já é folga na escala cadastrada do funcionário. Escolha outro dia ou corrija o horário dele.',
    acao: 'recalcular_dias',
  },
  REGIME_NAO_ELEGIVEL: {
    origem: 'lei',
    porque: 'Só escalas 5x2 e 5x1 entram neste acordo. 12x36 e jovem aprendiz ficam de fora (o RH valida a regra de cada um).',
  },
  TURNO_FORA_44H: {
    origem: 'cadastro',
    porque: 'O turno cadastrado não soma 44h por semana. É um aviso: confira o cadastro do horário do funcionário.',
  },
  SEM_TURNO: {
    origem: 'cadastro',
    porque: 'O funcionário não tem horário cadastrado; o cálculo usou o padrão 5x2 de 44h.',
  },
  FERIADO: {
    origem: 'sistema',
    porque: 'A data cai em feriado ou ponto facultativo do calendário de Mogi. Feriado de verdade já é dia de folga e não gera compensação.',
  },
  SEM_HORAS_A_COMPENSAR: {
    origem: 'sistema',
    porque: 'O horário informado cai dentro do horário normal do turno, então não há horas a compensar.',
  },
  FOLGA_SEM_DATA: {
    origem: 'sistema',
    porque: 'No revezamento cada funcionário precisa de uma data de folga.',
  },
  FOLGA_MAIOR: {
    origem: 'sistema',
    porque: 'A folga não pode ser maior que a jornada do dia escolhido.',
  },
}

export function explicacaoDe(codigo: string): Explicacao | null {
  return EXPLICACOES[codigo] ?? null
}

export const ROTULO_ORIGEM: Record<OrigemRegra, string> = {
  lei: 'Regra legal',
  sistema: 'Regra do sistema',
  cadastro: 'Dado de cadastro',
}
