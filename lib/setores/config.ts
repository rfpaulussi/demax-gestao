export type SetorConsulta = {
  slug: string
  titulo: string
  cookieName: string
  pinEnv: string
  tokenEnv: string
}

export const SETORES_CONSULTA: SetorConsulta[] = [
  {
    slug: 'ambulatorio',
    titulo: 'Ambulatório',
    cookieName: 'amb_auth',
    pinEnv: 'AMBULATORIO_PIN',
    tokenEnv: 'AMBULATORIO_TOKEN',
  },
  {
    slug: 'seguranca-trabalho',
    titulo: 'Segurança do Trabalho',
    cookieName: 'seg_auth',
    pinEnv: 'SEGURANCA_PIN',
    tokenEnv: 'SEGURANCA_TOKEN',
  },
]

export function getSetor(slug: string): SetorConsulta | undefined {
  return SETORES_CONSULTA.find((s) => s.slug === slug)
}
