import { createHash } from 'node:crypto'

/** Município do contrato: restringe a busca do Google e confere se o resultado caiu na cidade certa. */
export const CIDADE_PADRAO = 'Mogi das Cruzes'
export const UF_PADRAO = 'SP'

/** Minúsculas, sem acento, sem pontuação solta e com espaços colapsados: dois textos "iguais" geram o mesmo hash. */
export function normalizarEndereco(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[,;.\-–—/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Impressão digital do endereço já geocodificado. Mudou o texto, mudou o hash; só então vale chamar o Google de novo. */
export function hashEndereco(texto: string): string {
  return createHash('sha256').update(normalizarEndereco(texto)).digest('hex').slice(0, 32)
}

/** Limpa o texto digitado antes de enviar: sem quebras de linha e com tamanho limitado. */
export function limparEnderecoBusca(texto: string): string {
  return texto.replace(/\s+/g, ' ').trim().slice(0, 300)
}
