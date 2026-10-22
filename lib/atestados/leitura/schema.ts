import { dataValida } from './normalizar'
import type { LeituraAtestado } from './tipos'

export const NOME_FERRAMENTA_ATESTADO = 'preencher_atestado'

const STR = { type: ['string', 'null'] }

/** Definição da ferramenta (tool use): a IA é obrigada a responder neste formato. */
export const FERRAMENTA_ATESTADO = {
  name: NOME_FERRAMENTA_ATESTADO,
  description:
    'Registra os campos lidos de um atestado médico. Preencha só o que está escrito no papel; use null quando não aparece ou está ilegível. Nunca invente.',
  input_schema: {
    type: 'object' as const,
    properties: {
      tipo_documento: { type: 'string', enum: ['atestado_medico', 'outro'] },
      paciente_nome: { ...STR, description: 'Nome do paciente como está no papel.' },
      paciente_cpf: { ...STR, description: 'CPF do paciente, só dígitos.' },
      paciente_menor: { type: ['boolean', 'null'], description: 'true se a idade ou nascimento mostra paciente com menos de 18 anos.' },
      mae_nome: { ...STR, description: 'Nome da mãe, se constar no papel.' },
      data_inicio: { ...STR, description: 'AAAA-MM-DD. Início do afastamento.' },
      origem_data_inicio: { type: ['string', 'null'], enum: ['explicita', 'emissao', null] },
      dias: { type: ['integer', 'null'], description: 'Dias de afastamento, número inteiro.' },
      cid: { ...STR, description: 'Código CID como impresso, em maiúsculas (ex.: J39.9).' },
      observacao: { ...STR, description: 'Algo estranho ou ilegível que o supervisor deva conferir.' },
    },
    // paciente_menor fica de fora de propósito: a IA não deve ser forçada a chutar.
    required: ['tipo_documento', 'paciente_nome', 'data_inicio', 'dias', 'cid', 'origem_data_inicio'],
  },
}

const texto = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 200) : null)
// 0, negativo e valores enormes passam aqui; quem barra (1..365) é prepararPreenchimento.
const inteiro = (v: unknown): number | null => (typeof v === 'number' && Number.isInteger(v) ? v : null)
const booleano = (v: unknown): boolean | null => (typeof v === 'boolean' ? v : null)
const data = (v: unknown): string | null => {
  const t = texto(v)
  return t && dataValida(t) ? t : null
}
const cpf = (v: unknown): string | null => {
  const t = texto(v)
  const digitos = t ? t.replace(/\D/g, '') : ''
  return digitos.length === 11 ? digitos : null
}

/** A resposta da IA não é confiável: valida campo a campo. null = não é nem um objeto. */
export function lerExtracaoAtestado(entrada: unknown): LeituraAtestado | null {
  if (!entrada || typeof entrada !== 'object' || Array.isArray(entrada)) return null
  const e = entrada as Record<string, unknown>
  const origem = e.origem_data_inicio
  return {
    tipoDocumento: e.tipo_documento === 'atestado_medico' ? 'atestado_medico' : 'outro',
    pacienteNome: texto(e.paciente_nome),
    pacienteCpf: cpf(e.paciente_cpf),
    pacienteMenor: booleano(e.paciente_menor),
    maeNome: texto(e.mae_nome),
    dataInicio: data(e.data_inicio),
    origemDataInicio: origem === 'explicita' || origem === 'emissao' ? origem : null,
    dias: inteiro(e.dias),
    cid: texto(e.cid),
    observacao: texto(e.observacao),
  }
}
