/**
 * Cargos que não fazem parte do efetivo contratual (edital).
 * Os nomes devem corresponder EXATAMENTE ao campo funcoes.nome no banco.
 */
export const FUNCOES_FORA_DO_EFETIVO = [
  'JOVEM APRENDIZ',
  'LIMPADOR DE VIDROS',
] as const

export type FuncaoForaDoEfetivo = (typeof FUNCOES_FORA_DO_EFETIVO)[number]
