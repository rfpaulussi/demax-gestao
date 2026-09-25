import { anonimizarPedido, type PessoaRef } from '@/lib/acordos/ia/anonimizar'

export type { PessoaRef }

export interface OcorrenciaAnonima {
  /** Texto que pode ir à API: sem CPF, e-mail, telefone nem nomes de funcionários/supervisores. */
  texto: string
  /** 'FUNC_1' -> nome real. Fica só no servidor. */
  nomes: Record<string, string>
}

/**
 * Reaproveita o anonimizador dos acordos (CPF, e-mail, telefone e nomes viram códigos FUNC_n).
 * Limite conhecido: nomes de terceiros escritos no texto livre e que não estão na lista de pessoas
 * ("a diretora Fulana", "a filha") NÃO são detectados. Por isso o envio é manual, com prévia.
 */
export function anonimizarOcorrencia(texto: string, pessoas: PessoaRef[]): OcorrenciaAnonima {
  const { texto: anon, mapa } = anonimizarPedido(texto, pessoas)
  const nomePorId = new Map(pessoas.map(p => [p.id, p.nome]))
  const nomes: Record<string, string> = {}
  for (const [codigo, id] of Object.entries(mapa)) nomes[codigo] = nomePorId.get(id) ?? codigo
  return { texto: anon, nomes }
}

/** Volta dos códigos FUNC_n para os nomes reais. Código desconhecido fica como está. */
export function restaurarNomes(texto: string, nomes: Record<string, string>): string {
  return texto.replace(/FUNC_\d+/g, codigo => nomes[codigo] ?? codigo)
}
