'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getUser } from '@/lib/auth/get-user'

type ActionResult = { success: true } | { success: false; error: string }

async function assertAdmin(): Promise<ActionResult> {
  const auth = await getUser()
  if (!auth || auth.perfil.role !== 'admin') {
    return { success: false, error: 'Acesso negado' }
  }
  return { success: true }
}

export async function criarUsuario(formData: FormData): Promise<ActionResult> {
  const guard = await assertAdmin()
  if (!guard.success) return guard

  const supabase = createAdminClient()

  const nome  = formData.get('nome') as string
  const email = formData.get('email') as string
  const role  = formData.get('role') as string
  const senha = formData.get('senha') as string

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password:      senha,
    email_confirm: true,
  })

  if (error || !data.user) {
    return { success: false, error: error?.message ?? 'Erro ao criar usuário' }
  }

  const { error: perfilError } = await supabase.from('perfis').insert({
    id:    data.user.id,
    nome,
    email,
    role: role as 'admin' | 'coordenador' | 'supervisor' | 'viewer',
    ativo: true,
  })

  if (perfilError) {
    await supabase.auth.admin.deleteUser(data.user.id)
    return { success: false, error: perfilError.message }
  }

  revalidatePath('/usuarios')
  return { success: true }
}

export async function atualizarRole(formData: FormData): Promise<ActionResult> {
  const guard = await assertAdmin()
  if (!guard.success) return guard

  const supabase  = createAdminClient()
  const perfil_id = formData.get('perfil_id') as string
  const role      = formData.get('role') as string

  const { error } = await supabase
    .from('perfis')
    .update({ role: role as 'admin' | 'coordenador' | 'supervisor' | 'viewer' })
    .eq('id', perfil_id)

  if (error) return { success: false, error: error.message }

  revalidatePath('/usuarios')
  return { success: true }
}

export async function toggleAtivo(formData: FormData): Promise<ActionResult> {
  const guard = await assertAdmin()
  if (!guard.success) return guard

  const supabase  = createAdminClient()
  const perfil_id = formData.get('perfil_id') as string
  const ativo     = formData.get('ativo') === 'true'

  const { error } = await supabase
    .from('perfis')
    .update({ ativo: !ativo })
    .eq('id', perfil_id)

  if (error) return { success: false, error: error.message }

  revalidatePath('/usuarios')
  return { success: true }
}

export async function resetarSenha(formData: FormData): Promise<ActionResult> {
  const guard = await assertAdmin()
  if (!guard.success) return guard

  const supabase  = createAdminClient()
  const perfil_id = formData.get('perfil_id') as string
  const senha     = formData.get('senha') as string

  const { error } = await supabase.auth.admin.updateUserById(perfil_id, {
    password: senha,
  })

  if (error) return { success: false, error: error.message }

  return { success: true }
}
