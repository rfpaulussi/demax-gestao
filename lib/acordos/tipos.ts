export const DIAS_SEMANA = [
  'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira',
  'Sexta-feira', 'Sábado', 'Domingo',
] as const
export type DiaSemana = (typeof DIAS_SEMANA)[number]

/** Um dia da semana de um turno. Horários 'HH:MM' ou '' quando não se aplica. */
export interface DiaTurno { folga: boolean; e1: string; s1: string; e2: string; s2: string }
export type SemanaTurno = Record<DiaSemana, DiaTurno>

export type TemplateId = 'T1' | 'T2' | 'T3' | 'T4' | 'T5'
export type PapelMovimento = 'origem' | 'quitacao'

/** `minutos` com sinal: + trabalhou a mais/acréscimo; − dispensa/redução/folga. */
export interface Movimento {
  funcionarioId: string
  data: string
  minutos: number
  papel: PapelMovimento
}

export interface CamposAcordo {
  template: TemplateId
  dataEvento?: string
  nomeEvento?: string
  periodoInicio?: string        // 'HH:MM' (opcional, T1/T5)
  periodoFim?: string
  minutosOrigem?: number        // T1/T5: horas extras digitadas (quando não há período)
  horaDispensa?: string         // T2: horário em que foram dispensados
  motivo?: string               // T2/T3/T4
  dataFolga?: string            // T3/T4/T5 (em revezamento: a folga mais cedo)
  /** Revezamento: cada funcionário com a sua data de folga (T3/T4/T5). Ausente = todos folgam em `dataFolga`. */
  folgasPorFuncionario?: Record<string, string>
  datasAjuste: string[]         // T1 redução; T2/T3/T4 acréscimo; T5 vazio
  prazoLimite?: string          // T4 obrigatório; demais quando cruza o mês
}

export interface FuncionarioCalc {
  id: string
  nome: string
  status: string
  regime: string
  semana: SemanaTurno
  semTurno: boolean
}

export type NivelAchado = 'erro' | 'aviso'
export interface Achado {
  nivel: NivelAchado
  codigo: string
  mensagem: string
  funcionarioId?: string
}
