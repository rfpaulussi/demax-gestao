// CPF com ou sem pontuação/espaços; também pega 11 dígitos seguidos (remoção a mais é aceitável).
const PADRAO_CPF = /(?<!\d)\d{3}[.\s]?\d{3}[.\s]?\d{3}[-.\s]?\d{2}(?!\d)/g

/** Troca qualquer CPF do texto livre por '[CPF omitido]', para o CPF não sair do servidor. */
export function removerCpf(texto: string | null): string | null {
  if (texto === null) return null
  return texto.replace(PADRAO_CPF, '[CPF omitido]')
}
