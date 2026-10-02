/** Apelido usado na assinatura do supervisor no comunicado (chave = primeiro nome, sem acento e minúsculo). */
const APELIDOS: Record<string, string> = {
  crislaine: 'Crisl.',
  christian: 'Chris.',
  herbert:   'Heb.',
  pedro:     'Pedro',
  silvanir:  'Sil.',
  rose:      'Ros.',
  braz:      'Braz',
}

/** Assinatura abreviada a partir do nome completo do perfil; sem apelido cadastrado, usa o primeiro nome. */
export function assinaturaAbreviada(nome: string | null | undefined): string | null {
  const primeiro = nome?.trim().split(/\s+/)[0]
  if (!primeiro) return null
  const chave = primeiro.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  return APELIDOS[chave] ?? primeiro
}
