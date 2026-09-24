export type HorarioTermo = {
  nome: string | null
  escala: string | null
  entrada: string | null
  saidaSegQui: string | null
  entradaSex: string | null
  saidaSex: string | null
  almocoInicio: string | null
  almocoFim: string | null
  entradaSab: string | null
  saidaSab: string | null
}

export type TermoLinhaDiff = {
  rotulo: string          // ex.: 'Posto de Trabalho'
  antes: string           // texto já formatado
  depois: string
  mudou: boolean
}

export type TermoTipo =
  | 'transferencia' | 'mudanca_funcao' | 'promocao' | 'mudanca_horario'
  | 'desligamento' | 'afastamento' | 'retorno_afastamento' | 'alteracao_salario' | 'outro'

export type TermoData = {
  chave: string                 // 'sol:<id>', 'mov:<id>' ou 'dia:<funcionario>:<AAAA-MM-DD>'
  codigo: string                // MOV-XXXXXXXX
  tipo: TermoTipo
  titulo: string                // ex.: TERMO DE TRANSFERÊNCIA DE COLABORADOR
  tiposIncluidos: string[]      // ex.: ['transferencia','mudanca_funcao','mudanca_horario']
  colaborador: {
    id: string; nome: string; registro: string | null
    funcao: string | null; admissao: string | null
  }
  diffs: TermoLinhaDiff[]
  efetivacao: string | null     // ISO date
  solicitadoPor: string | null
  solicitadoEm: string | null   // ISO datetime
  aprovadoPor: string | null
  aprovadoEm: string | null
  motivo: string | null
  supervisorOrigem: string | null
  supervisorDestino: string | null
  emitidoEm: string             // ISO datetime
  manual: boolean               // termo sem solicitação (lançamento direto)
  registradoPor: string | null  // manual: quem lançou
  registradoEm: string | null   // manual: data/hora do lançamento
  exigeTermo: boolean
}
