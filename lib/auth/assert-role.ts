import { getUser, type AuthUser } from '@/lib/auth/get-user'
import type { Role } from '@/types/roles'

export type RoleGuardResult =
  | { success: true; auth: AuthUser }
  | { success: false; error: string }

/**
 * Verifica se o usuário autenticado tem um dos roles permitidos.
 * Não lança — devolve um resultado compatível com o padrão local
 * `{ success: false; error: string }` já usado em várias actions.
 */
export async function requireRole(roles: Role[]): Promise<RoleGuardResult> {
  const auth = await getUser()
  if (!auth) return { success: false, error: 'Não autenticado' }
  if (auth.perfil.ativo === false) return { success: false, error: 'Usuário inativo' }
  if (!roles.includes(auth.perfil.role as Role)) {
    return { success: false, error: 'Acesso negado' }
  }
  return { success: true, auth }
}

/**
 * Variante que lança em vez de devolver — para actions que já seguem
 * o padrão "throw new Error(...)".
 */
export async function assertRole(roles: Role[]): Promise<AuthUser> {
  const guard = await requireRole(roles)
  if (!guard.success) throw new Error(guard.error)
  return guard.auth
}
