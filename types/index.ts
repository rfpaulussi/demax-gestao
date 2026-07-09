// Ponto central de tipos do Demax Gestão
// Re-exporta database.ts e roles.ts; define tipos de domínio compostos

export type { Database, Json, Tables, TablesInsert, TablesUpdate } from './database'
export {
  ROLES,
  ROLES_GESTAO,
  ROLE_LABELS,
  ROLE_PERMISSIONS,
  isAdminOrCoord,
  isSupervisor,
  isViewer,
} from './roles'
export type { Role, RoleGestao } from './roles'

// ----------------------------------------------------------
// Aliases diretos para as Rows das tabelas mais usadas
// ----------------------------------------------------------
import type { Tables } from './database'

export type Funcao                  = Tables<'funcoes'>
export type CustoFuncao             = Tables<'custos_funcoes'>
export type Contrato                = Tables<'contratos'>
export type Posto                   = Tables<'postos'>
export type Perfil                  = Tables<'perfis'>
export type ConfigSupervisorPosto   = Tables<'config_supervisores_postos'>
export type Funcionario             = Tables<'funcionarios'>
export type CoberturaTemporaria     = Tables<'coberturas_temporarias'>
export type Ferias                  = Tables<'ferias'>
export type Advertencia             = Tables<'advertencias'>
export type CoberturaInsalubre      = Tables<'coberturas_insalubres'>
export type LogAlocacaoMensal       = Tables<'logs_alocacoes_mensais'>
export type Ocorrencia              = Tables<'ocorrencias'>
export type Transferencia           = Tables<'transferencias'>
export type ComposicaoPosto         = Tables<'composicao_postos'>
export type Atestado                = Tables<'atestados'>
export type Solicitacao             = Tables<'solicitacoes'>
export type Movimentacao            = Tables<'movimentacoes'>
export type TurnoPosto              = Tables<'turnos_postos'>
export type HorarioFuncionario      = Tables<'horarios_funcionarios'>
export type ConvencaoColetiva       = Tables<'convencoes_coletivas'>
export type ConvencaoValorFuncao    = Tables<'convencao_valores_funcoes'>

// ----------------------------------------------------------
// Tipos de domínio compostos (joins comuns no app)
// ----------------------------------------------------------

/** Funcionário com sua função e posto já resolvidos */
export type FuncionarioCompleto = Funcionario & {
  funcao: Funcao | null
  posto: Posto | null
}

/** Funcionário com apenas a função (para listagens de custo) */
export type FuncionarioComFuncao = Funcionario & {
  funcao: Funcao | null
}

/** Funcionário com apenas o posto (para listagens operacionais) */
export type FuncionarioComPosto = Funcionario & {
  posto: Posto | null
}

/** Posto com contrato vinculado */
export type PostoComContrato = Posto & {
  contrato: Contrato | null
}

/** Posto com lista de funcionários ativos */
export type PostoComFuncionarios = Posto & {
  funcionarios: Funcionario[]
}

/** Função com tabela de custos embutida */
export type FuncaoComCustos = Funcao & {
  custos: CustoFuncao | null
}

/** Posto com sua composição de funções */
export type PostoComComposicao = Posto & {
  composicao_postos: Array<ComposicaoPosto & { funcao: Funcao }>
}

/** Cobertura temporária com funcionário, posto destino e posto origem */
export type CoberturaComFuncionario = CoberturaTemporaria & {
  funcionario: Funcionario
  posto_destino: Posto
  posto_origem: Posto | null
}

/** Cobertura insalubre com funcionário e posto */
export type CoberturaInsalubreCompleta = CoberturaInsalubre & {
  funcionario: Funcionario
  posto: Posto
}

/** Advertência com funcionário e quem registrou */
export type AdvertenciaComFuncionario = Advertencia & {
  funcionario: Funcionario
  criador: Perfil | null
}

/** Férias com funcionário */
export type FeriasComFuncionario = Ferias & {
  funcionario: Funcionario
}

/** Ocorrência com posto e supervisor */
export type OcorrenciaCompleta = Ocorrencia & {
  posto: Posto
  supervisor: Perfil
}

/** Transferência com todos os relacionamentos */
export type TransferenciaCompleta = Transferencia & {
  funcionario: Funcionario
  posto_origem: Posto
  posto_destino: Posto
  criador: Perfil | null
}

/** Transferência com status e relacionamentos para gestão de aprovação */
export type TransferenciaComStatus = TransferenciaCompleta

/** Supervisor com seus postos vinculados */
export type SupervisorComPostos = Perfil & {
  postos: Posto[]
}

/** Log de alocação com posto */
export type LogAlocacaoComPosto = LogAlocacaoMensal & {
  posto: Posto
}

// ----------------------------------------------------------
// Tipos utilitários de estado de UI / formulários
// ----------------------------------------------------------

/** Status possíveis de um funcionário (espelha CHECK do schema) */
export type StatusFuncionario = 'ativo' | 'afastado' | 'ferias' | 'desligado'

/** Urgência de cobertura temporária */
export type UrgenciaCobertura = 'baixa' | 'media' | 'alta'

/** Status de cobertura temporária */
export type StatusCobertura = 'ativa' | 'encerrada'

/** Grau de insalubridade (espelha CHECK do schema) */
export type GrauInsalubridade = 'minimo' | 'medio' | 'maximo'

/** Status de advertência */
export type StatusAdvertencia = 'pendente' | 'gerada' | 'entregue'

/** Status de férias */
export type StatusFerias = 'agendada' | 'em_curso' | 'concluida'

/** Gravidade de ocorrência */
export type GravidadeOcorrencia = 'baixa' | 'media' | 'alta'

/** Status de ocorrência */
export type StatusOcorrencia = 'aberta' | 'em_analise' | 'encerrada'

/** Tipos de solicitação que requerem aprovação */
export type TipoSolicitacao =
  | 'desligamento'
  | 'transferencia'
  | 'mudanca_funcao'
  | 'promocao'
  | 'alteracao_salario'
  | 'mudanca_supervisor'
  | 'afastamento'
  | 'retorno_afastamento'
  | 'rescisao_indireta'
  | 'admissao'

/** Status de solicitação */
export type StatusSolicitacao = 'pendente' | 'aprovada' | 'rejeitada'

/** Turno com posto vinculado (para listagens) */
export type TurnoComPosto = TurnoPosto & {
  posto: Posto | null
}

/** Horário vigente de um funcionário com turno completo */
export type HorarioVigente = HorarioFuncionario & {
  turno: TurnoPosto
}

/** Convenção coletiva com valores por função */
export type ConvencaoComValores = ConvencaoColetiva & {
  valores: ConvencaoValorFuncao[]
}

/** Status de convenção coletiva */
export type StatusConvencao = 'rascunho' | 'publicada' | 'aplicada'
