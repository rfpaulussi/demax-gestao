export function normalizarNome(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim()
}

export function extrairNomes(texto: string): string[] {
  const vistos = new Set<string>()
  const nomes: string[] = []
  for (const linha of texto.split(/\r?\n/)) {
    const nome = linha.trim()
    if (!nome) continue
    const chave = normalizarNome(nome)
    if (!chave || vistos.has(chave)) continue
    vistos.add(chave)
    nomes.push(nome)
  }
  return nomes
}
