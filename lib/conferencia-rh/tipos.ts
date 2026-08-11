/** Uma linha da aba LISTAGEM da planilha do RH, já parseada no browser. */
export type LinhaRH = {
  re: string
  nome: string
  funcao: string
  admissao: string | null       // ISO yyyy-mm-dd
  afastadoEm: string | null     // ISO yyyy-mm-dd, null = ativo
  codigoSupervisor: number
}

/** Um funcionário vindo do nosso banco, já achatado pra comparação. */
export type FuncionarioSistema = {
  id: string
  registro: string | null
  nome: string
  funcao: string | null
  afastado: boolean
  supervisorNome: string | null
}

export type TipoDivergencia =
  | 'so_no_rh'
  | 'so_no_sistema'
  | 'nome_diferente'
  | 're_divergente'
  | 'funcao_diferente'
  | 'afastado_diferente'
  | 'supervisor_diferente'

export type Divergencia = {
  chave: string
  tipos: TipoDivergencia[]
  rh: { re: string | null; nome: string | null; funcao: string | null; afastado: boolean | null; supervisor: string | null }
  sistema: { id: string | null; re: string | null; nome: string | null; funcao: string | null; afastado: boolean | null; supervisor: string | null }
}

export type CelulaResumo = { rh: number; sistema: number }

export type LinhaResumo = {
  funcao: string
  porSupervisor: Record<string, CelulaResumo>  // chave = apelido do supervisor
  afastados: CelulaResumo
  total: CelulaResumo
}

export type ResultadoComparacao = {
  resumo: LinhaResumo[]
  totalGeral: LinhaResumo
  divergencias: Divergencia[]
  codigosSemSupervisorVinculado: number[]
  linhasIgnoradas: number
}
