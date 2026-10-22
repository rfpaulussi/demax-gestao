import type { CandidatoFuncionario } from './casar-funcionario'

/** O que a IA leu do papel, já validado por `lerExtracaoAtestado`. */
export interface LeituraAtestado {
  tipoDocumento: 'atestado_medico' | 'outro'
  pacienteNome: string | null
  /** Só dígitos (11). Usado apenas para casar com o cadastro; nunca sai do servidor. */
  pacienteCpf: string | null
  pacienteMenor: boolean | null
  maeNome: string | null
  /** AAAA-MM-DD */
  dataInicio: string | null
  origemDataInicio: 'explicita' | 'emissao' | null
  dias: number | null
  /** Como está impresso no papel (ex.: "J399"). Normalizado depois. */
  cid: string | null
  observacao: string | null
}

/** Aviso por campo; `null` = sem aviso. Os campos com aviso ficam em amarelo no modal. */
export interface AvisosPreenchimento {
  dataInicio: string | null
  dias: string | null
  cid: string | null
}

/** Valores iniciais do modal "Registrar Atestado". Strings vazias = não preencher. */
export interface Preenchimento {
  dataInicio: string
  dias: string
  dataFim: string
  cidCodigo: string
  avisos: AvisosPreenchimento
}

export interface DocumentoLido {
  tipo: 'atestado_medico' | 'outro'
  observacao: string | null
  pacienteNome: string | null
  pacienteMenor: boolean | null
  maeNome: string | null
}

export type RespostaLeitura =
  | {
      ok: true
      documento: DocumentoLido
      preenchimento: Preenchimento
      candidatos: CandidatoFuncionario[]
      /** id do candidato pré-selecionado (nota alta e folga sobre o segundo), ou null. */
      automatico: string | null
    }
  | { ok: false; erro: string }
