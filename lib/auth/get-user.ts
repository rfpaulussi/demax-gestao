import { createClient } from '@/lib/supabase/server'
import type { Perfil } from '@/types'
import type { User } from '@supabase/supabase-js'

export type AuthUser = {
  user: User
  perfil: Perfil
}

export async function getUser(): Promise<AuthUser | null> {
  const supabase = createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) return null

  const { data: perfil, error: perfilError } = await supabase
    .from('perfis')
    .select('*')
    .eq('id', user.id)
    .single()

  if (perfilError || !perfil) return null

  return { user, perfil }
}
