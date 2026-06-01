// Roles do sistema Demax
// Espelha o CHECK constraint de perfis.role no schema

export const ROLES = ['admin', 'coordenador', 'supervisor', 'viewer'] as const
export type Role = (typeof ROLES)[number]

// Subconjunto com acesso de gestão total (espelha is_admin_or_coord() do RLS)
export const ROLES_GESTAO = ['admin', 'coordenador'] as const satisfies readonly Role[]
export type RoleGestao = (typeof ROLES_GESTAO)[number]

// Type guards
export function isAdminOrCoord(role: Role | null | undefined): role is RoleGestao {
  return role === 'admin' || role === 'coordenador'
}

export function isSupervisor(role: Role | null | undefined): role is 'supervisor' {
  return role === 'supervisor'
}

export function isViewer(role: Role | null | undefined): role is 'viewer' {
  return role === 'viewer'
}

// Labels para exibição na UI
export const ROLE_LABELS: Record<Role, string> = {
  admin:       'Administrador',
  coordenador: 'Coordenador',
  supervisor:  'Supervisor',
  viewer:      'Visualizador',
}

// Permissões por role (o que cada role pode fazer além da leitura)
export const ROLE_PERMISSIONS: Record<Role, { canWrite: boolean; canManageUsers: boolean }> = {
  admin:       { canWrite: true,  canManageUsers: true  },
  coordenador: { canWrite: true,  canManageUsers: false },
  supervisor:  { canWrite: false, canManageUsers: false },
  viewer:      { canWrite: false, canManageUsers: false },
}
