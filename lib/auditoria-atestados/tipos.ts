// lib/auditoria-atestados/tipos.ts

export type LinhaSesmt = {
  matriculaRaw: string      // valor bruto da coluna "Matrícula", ex "001-000-107622"
  nome: string               // coluna "Empregado"
  dataInicio: string         // ISO yyyy-mm-dd, da coluna "Data"
  diasTexto: string          // valor bruto da coluna "Afastamento", ex "15 dias"
  motivo: string             // coluna "Motivo"
  cidTexto: string           // coluna "CID Abonado", ex "A09 - Diarréia..." ou "Sem CID"
  dataRetorno: string        // ISO yyyy-mm-dd, da coluna "Data Retorno"
}

export type AtestadoSistema = {
  id: string
  funcionarioId: string
  funcionarioNome: string
  registro: string
  dataInicio: string
  dataFim: string
  cidCodigo: string | null
  cidDescricao: string | null
  origemOcupacional: string | null
}

export type CampoDivergente = 'data_inicio' | 'data_fim' | 'cid' | 'origem_ocupacional'

export type LinhaResultado =
  | {
      status: 'confere'
      sesmt: LinhaSesmt
      sistema: AtestadoSistema
    }
  | {
      status: 'divergencia'
      sesmt: LinhaSesmt
      sistema: AtestadoSistema
      camposDivergentes: CampoDivergente[]
    }
  | {
      status: 'nao_lancado'
      sesmt: LinhaSesmt
      // Presentes apenas quando a matrícula foi resolvida a um funcionário real —
      // permite oferecer "Lançar atestado" pré-preenchido direto na tela de auditoria.
      funcionarioId: string
      postoId: string | null
    }
  | {
      status: 'matricula_nao_encontrada'
      sesmt: LinhaSesmt
    }
  | {
      status: 'ambiguo'
      sesmt: LinhaSesmt
      candidatos: AtestadoSistema[]
    }
  | {
      status: 'sem_sesmt'
      sistema: AtestadoSistema
    }

export type ResultadoAuditoria = {
  linhas: LinhaResultado[]
  cids: { codigo: string; descricao: string }[]
  contadores: {
    confere: number
    divergencia: number
    naoLancado: number
    matriculaNaoEncontrada: number
    ambiguo: number
    semSesmt: number
  }
}
