// lib/absenteismo/tipos.ts
import type { ClasseDisponibilidade, ClasseTaxa } from './classificar'

export interface FuncionarioCalc {
  id: string
  nome: string
  registro: string | null
  admissao: string | null
  desligamento: string | null
  /** status desligado/rescisão indireta sem data de desligamento: fora do quadro. */
  fora_do_quadro: boolean
  regime: string
  posto_id: string | null
  posto_nome: string
  secretaria: string
  supervisor_id: string | null
  supervisor: string
}

export interface FaltaIn {
  id: string
  funcionario_id: string
  data_falta: string
  data_fim: string | null
  dias: number
  tipo: string
  /** true quando `faltas.confirmada_em` está preenchido (confirmada pelo supervisor). */
  confirmada: boolean
  observacao: string | null
}

export interface AtestadoIn {
  id: string
  funcionario_id: string
  data_inicio: string
  data_fim: string
  cid_codigo: string | null
  sem_cid: boolean
  motivo: string | null
}

export interface AfastamentoIn {
  id: string
  funcionario_id: string
  data_inicio: string
  data_fim_prevista: string | null
  data_fim_real: string | null
  motivo: string | null
}

export interface FeriasIn {
  id: string
  funcionario_id: string
  data_inicio: string
  data_fim: string
}

/** Advertência de grau suspensão: `dias` jornadas programadas a partir de `data_inicio`. */
export interface SuspensaoIn {
  id: string
  funcionario_id: string
  data_inicio: string
  dias: number
}

export interface DadosAbsenteismo {
  funcionarios: FuncionarioCalc[]
  faltas: FaltaIn[]
  atestados: AtestadoIn[]
  afastamentos: AfastamentoIn[]
  ferias: FeriasIn[]
  suspensoes: SuspensaoIn[]
}

export interface EntradaCalculo extends DadosAbsenteismo {
  inicio: string
  fim: string
}

export interface Episodio {
  /** id do registro de origem (falta) ou do primeiro atestado do episódio. */
  id: string
  funcionario_id: string
  classe: ClasseTaxa
  /** primeiro e último dia do episódio dentro do período. */
  inicio: string
  fim: string
  /** jornadas programadas perdidas por este episódio (pode ser 0 se cair em dia fora da escala). */
  jornadas: number
  /** só faltas: confirmada pelo supervisor. null para atestado. */
  confirmada: boolean | null
  origem_ids: string[]
}

export interface PorFuncionario {
  programadas: number
  perdidas: number
  episodios: number
}

export interface ResultadoCalculo {
  inicio: string
  fim: string
  dias_corridos: number
  quadro_medio: number
  jornadas_programadas: number
  jornadas_perdidas: number
  perdidas_por_classe: Record<ClasseTaxa, number>
  episodios: Episodio[]
  episodios_por_classe: Record<ClasseTaxa, number>
  funcionarios_afetados: number
  funcionarios_reincidentes: number
  /** dias CORRIDOS-pessoa indisponíveis por classe (fora da taxa). */
  disponibilidade_dias: Record<ClasseDisponibilidade, number>
  /** soma de `disponibilidade_dias`. */
  indisponiveis_dias_pessoa: number
  /** jornadas programadas em suspensão disciplinar (fora da taxa). */
  suspensao_jornadas: number
  por_funcionario: Record<string, PorFuncionario>
}
