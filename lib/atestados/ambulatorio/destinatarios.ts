const EMAIL = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/

/** Lê `RESEND_TO_AMBULATORIO`: endereços separados por vírgula; vazios e inválidos saem. */
export function lerDestinatarios(valor: string | undefined | null): string[] {
  if (!valor) return []
  return valor
    .split(',')
    .map(e => e.trim())
    .filter(e => EMAIL.test(e))
}

/**
 * Para quem o e-mail vai. Só em produção da Vercel usa o ambulatório (`RESEND_TO_AMBULATORIO`).
 * Em preview e no dev local o e-mail vai para quem está logado, marcado como teste, de modo que
 * um atestado de teste nunca chega ao ambulatório.
 */
export function destinosAmbulatorio(emailUsuario: string | null | undefined): { para: string[]; teste: boolean } {
  if (process.env.VERCEL_ENV !== 'production') {
    return { para: lerDestinatarios(emailUsuario), teste: true }
  }
  return { para: lerDestinatarios(process.env.RESEND_TO_AMBULATORIO), teste: false }
}
