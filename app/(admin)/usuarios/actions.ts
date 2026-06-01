'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'

export async function criarUsuario(formData: FormData) {
  const supabase = createAdminClient()

  const nome  = formData.get('nome') as string
  const email = formData.get('email') as string
  const role  = formData.get('role') as string
  const senha = formData.get('senha') as string

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password:       senha,
    email_confirm:  true,
  })

  if (error || !data.user) {
    throw new Error(error?.message ?? 'Erro ao criar usuário')
  }

  await supabase.from('perfis').insert({
    id:    data.user.id,
    nome,
    email,
    role: role as 'admin' | 'coordenador' | 'supervisor' | 'viewer',
    ativo: true,
  })

  revalidatePath('/usuarios')
}

export async function atualizarRole(formData: FormData) {
  const supabase = createAdminClient()

  const perfil_id = formData.get('perfil_id') as string
  const role      = formData.get('role') as string

  await supabase
    .from('perfis')
    .update({ role: role as 'admin' | 'coordenador' | 'supervisor' | 'viewer' })
    .eq('id', perfil_id)

  revalidatePath('/usuarios')
}

export async function toggleAtivo(formData: FormData) {
  const supabase = createAdminClient()

  const perfil_id = formData.get('perfil_id') as string
  const ativo     = formData.get('ativo') === 'true'

  await supabase
    .from('perfis')
    .update({ ativo: !ativo })
    .eq('id', perfil_id)

  revalidatePath('/usuarios')
}
