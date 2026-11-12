import { cookies } from 'next/headers'
import { getSetor } from './config'

const MAX_AGE = 60 * 60 * 24 * 180 // 180 dias

export function setorEstaAutenticado(slug: string): boolean {
  const setor = getSetor(slug)
  if (!setor) return false
  const token = process.env[setor.tokenEnv]
  if (!token) return false
  return cookies().get(setor.cookieName)?.value === token
}

export function autenticarSetor(slug: string) {
  const setor = getSetor(slug)
  if (!setor) throw new Error('Setor desconhecido.')
  const token = process.env[setor.tokenEnv]!
  cookies().set(setor.cookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: `/${slug}`,
    maxAge: MAX_AGE,
  })
}
