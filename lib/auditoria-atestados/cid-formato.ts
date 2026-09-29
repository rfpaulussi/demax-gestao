// lib/auditoria-atestados/cid-formato.ts

/** CID-10 no formato do sistema: letra + 2 dígitos, com subcódigo opcional (A00 ou A00.0). */
export const CID_FORMATO = /^[A-Z]\d{2}(\.\d{1,2})?$/

export const cidFormatoValido = (codigo: string): boolean => CID_FORMATO.test(codigo)
