export type ConectorMotivo = 'conforme' | 'em razão de'

export interface MotivoItem {
  id: string
  grupo: string
  /** Versão curta, para chip. */
  rotulo: string
  /** Frase que entra no documento. */
  texto: string
  conector: ConectorMotivo
}

const item = (id: string, grupo: string, texto: string, conector: ConectorMotivo, rotulo = texto): MotivoItem =>
  ({ id, grupo, rotulo, texto, conector })

export const MOTIVOS: MotivoItem[] = [
  item('decreto-municipal', 'Calendário', 'decreto municipal', 'conforme'),
  item('ponto-facultativo', 'Calendário', 'ponto facultativo municipal', 'conforme', 'ponto facultativo'),
  item('emenda-feriado', 'Calendário', 'emenda de feriado', 'conforme'),
  item('feriado-municipal', 'Calendário', 'feriado municipal', 'conforme'),
  item('luto-oficial', 'Calendário', 'luto oficial decretado', 'conforme', 'luto oficial'),

  item('determinacao-secretaria', 'Determinação da unidade', 'determinação da secretaria', 'conforme'),
  item('acordado-direcao', 'Determinação da unidade', 'acordado com a direção da unidade', 'conforme', 'acordado com a direção'),
  item('solicitacao-fiscal', 'Determinação da unidade', 'solicitação do fiscal do contrato', 'conforme', 'solicitação do fiscal'),

  item('recesso-ferias-escolares', 'Funcionamento da unidade', 'recesso ou férias escolares', 'em razão de'),
  item('unidade-fechada-eventos', 'Funcionamento da unidade', 'unidade fechada para eventos', 'em razão de'),
  item('expediente-reduzido', 'Funcionamento da unidade', 'expediente reduzido da unidade', 'em razão de', 'expediente reduzido'),
  item('jogos-selecao', 'Funcionamento da unidade', 'jogos da seleção brasileira', 'em razão de', 'jogos da seleção'),
  item('eleicoes-local-votacao', 'Funcionamento da unidade', 'eleições (unidade usada como local de votação)', 'em razão de', 'eleições (local de votação)'),

  item('falta-agua', 'Infraestrutura', 'falta de água', 'em razão de'),
  item('falta-energia', 'Infraestrutura', 'falta de energia elétrica', 'em razão de', 'falta de energia'),
  item('obra-reforma', 'Infraestrutura', 'obra ou reforma na unidade', 'em razão de', 'obra ou reforma'),
  item('dedetizacao', 'Infraestrutura', 'dedetização ou desinsetização', 'em razão de', 'dedetização'),
  item('interdicao', 'Infraestrutura', 'interdição pela Defesa Civil ou Vigilância Sanitária', 'em razão de', 'interdição (Defesa Civil/Vigilância)'),
  item('alagamento-chuva', 'Infraestrutura', 'alagamento ou chuva forte', 'em razão de'),

  item('greve-transporte', 'Outros', 'greve ou paralisação do transporte público', 'em razão de', 'greve do transporte'),
]

export const NOMES_EVENTO_SUGERIDOS: string[] = [
  'Festa Junina', 'Festa Cultural', 'Dia das Mães', 'Dia dos Pais', 'Eleições', 'Formatura',
  'Reunião de pais', 'Mutirão de limpeza', 'Limpeza pós-obra', 'Vistoria ou fiscalização',
  'Campanha de vacinação', 'Inauguração',
]

/** minúsculas, sem acento, sem pontuação e sem espaços extras */
function normaliza(s: string): string {
  return s
    .normalize('NFD').split('').filter(ch => ch.charCodeAt(0) < 128).join('')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Conector que liga o motivo à frase ("conforme decreto…" / "em razão de falta de água"). Texto livre usa "conforme". */
export function conectorDoMotivo(texto: string): ConectorMotivo {
  const t = normaliza(texto)
  if (!t) return 'conforme'
  // conector já digitado pelo usuário prevalece
  if (t.startsWith('em razao de ')) return 'em razão de'
  if (t.startsWith('conforme ')) return 'conforme'
  const achado = MOTIVOS.find(m => {
    const n = normaliza(m.texto)
    return t === n || t.startsWith(`${n} `)
  })
  return achado ? achado.conector : 'conforme'
}
