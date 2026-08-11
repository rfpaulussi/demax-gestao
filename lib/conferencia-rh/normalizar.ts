/** Normaliza nome pra comparação: maiúsculas, sem acento, espaços colapsados. */
export function normalizarNome(nome: string | null | undefined): string {
  return (nome ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** Normaliza RE/registro pra comparação: só dígitos, sem zeros à esquerda. */
export function normalizarRE(re: string | number | null | undefined): string {
  const digitos = String(re ?? '').replace(/\D/g, '')
  return digitos.replace(/^0+(?=\d)/, '')
}
