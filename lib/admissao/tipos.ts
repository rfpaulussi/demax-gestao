import type { TurnoHorarios } from '@/lib/turnos/escala'

export const MAX_LINHAS_VT = 5

export type PeriodoExperiencia = 'nenhum' | '30+30' | '45+45'
export type MotivoAdmissao = 'aumento_efetivo' | 'substituicao'
export type CartaoVT = 'nenhum' | 'bilhete_unico' | 'top' | 'outro'

/** Valores digitados pelo supervisor ficam como texto ("4,50") e só viram número onde é preciso (ver `numeroBR`). */
export interface LinhaVT {
  tipo: string
  linha: string
  empresa: string
  valor: string
  qtd: string
}

/** Tudo que o supervisor preenche no assistente. É o que vai para `solicitacoes.dados_depois.dossie` e para o rascunho. */
export interface DossieAdmissao {
  // pessoais
  nome: string
  cpf: string
  telefone: string
  email: string
  cep: string
  logradouro: string
  numero: string
  complemento: string
  bairro: string
  cidade: string
  uf: string
  // vaga
  posto_id: string
  funcao_id: string
  data_admissao: string
  periodo_experiencia: PeriodoExperiencia
  motivo: MotivoAdmissao
  substituido_id: string | null
  substituido_nome: string
  substituido_motivo: string
  substituido_data_desligamento: string
  turno_id: string
  dia_curso: number | null
  // condições (sugeridas pelo sistema, editáveis)
  contrato: string
  centro_custo: string
  sindicato: string
  cbo: string
  va: string
  vr: string
  // vale transporte
  vt_utiliza: boolean
  vt_linhas: LinhaVT[]
  vt_cartao: CartaoVT
  vt_cartao_outro: string
  // uniforme
  uniforme_calca: string
  uniforme_camisa: string
  uniforme_sapato: string
  // documentos
  docs: string[]
  tem_dependentes: boolean
  docs_dependentes: string[]
  // integração
  data_integracao: string
}

/** Dados que o sistema resolve sozinho (não digitados). Gravados junto do dossiê para a reimpressão sair igual à original. */
export interface ContextoAdmissao {
  funcao_nome: string
  posto_nome: string
  secretaria: string | null
  salario_base: number | null
  insalubridade_perc: number | null
  insalubridade_valor: number | null
  periculosidade_perc: number | null
  periculosidade_valor: number | null
  turno: (TurnoHorarios & { nome: string }) | null
  palestrante: string
}

export interface PacoteAdmissao {
  dossie: DossieAdmissao
  contexto: ContextoAdmissao
}

export const DOCUMENTOS_ADMISSAO = [
  { id: 'carteira_digital',  label: 'Carteira Profissional Digital' },
  { id: 'pis',               label: 'Cópia Cartão de Cadastro ou Certidão Negativa do PIS' },
  { id: 'rg',                label: 'Cópia Cédula de Identidade ( RG )' },
  { id: 'titulo',            label: 'Cópia Título de Eleitor ( Caso for +18 Anos )' },
  { id: 'reservista',        label: 'Cópia Certificado de Reservista' },
  { id: 'cpf',               label: 'Cópia C.P.F.' },
  { id: 'certidao',          label: 'Certidão de Nascimento Ou Certidão de Casamento.' },
  { id: 'escolaridade',      label: 'Cópia comprovante de Escolaridade.' },
  { id: 'foto',              label: '01 - Fotos 3 x 4' },
  { id: 'residencia',        label: 'Cópia Conta de luz, água ou telefone' },
  { id: 'antecedentes',      label: 'Atestado de Antecedentes ( Caso for +18 Anos )' },
  { id: 'vt',                label: 'Solicitação de Vale Transportes' },
  { id: 'conta_salario',     label: 'Conta salario' },
] as const

export const DOCUMENTOS_DEPENDENTES = [
  { id: 'dep_rg',            label: 'Cópia R.G dos dependentes.' },
  { id: 'dep_cpf',           label: 'Cópia C.P.F dos dependentes.' },
  { id: 'dep_casamento',     label: 'Cópia Certidão de Casamento' },
  { id: 'dep_nascimento',    label: 'Cópia Certidão de nascimento dos filhos menores de 14 anos.' },
  { id: 'dep_vacinas',       label: 'Cópia Atestado de vacinas dos filhos' },
  { id: 'dep_escolaridade',  label: 'Cópia comprovante de escolaridade dos filhos entre 7 e 13 anos' },
] as const

export const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
  'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const

export const TIPOS_TRANSPORTE = ['Ônibus', 'Metrô', 'Trem', 'Van / Lotação', 'Outro'] as const

export function dossieVazio(hoje: string): DossieAdmissao {
  return {
    nome: '', cpf: '', telefone: '', email: '',
    cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '',
    posto_id: '', funcao_id: '', data_admissao: '', periodo_experiencia: '45+45',
    motivo: 'aumento_efetivo',
    substituido_id: null, substituido_nome: '', substituido_motivo: '', substituido_data_desligamento: '',
    turno_id: '', dia_curso: null,
    contrato: '', centro_custo: '', sindicato: '', cbo: '', va: '', vr: '',
    vt_utiliza: true,
    vt_linhas: [{ tipo: 'Ônibus', linha: '', empresa: '', valor: '', qtd: '2' }],
    vt_cartao: 'nenhum', vt_cartao_outro: '',
    uniforme_calca: '', uniforme_camisa: '', uniforme_sapato: '',
    docs: [], tem_dependentes: false, docs_dependentes: [],
    data_integracao: hoje,
  }
}
