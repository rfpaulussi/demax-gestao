'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/auth/get-user'

export async function marcarTodasLidas() {
  const auth = await getUser()
  if (!auth || !['admin', 'coordenador'].includes(auth.perfil.role ?? '')) return
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any).from('log_supervisor_acoes').update({ lido: true }).eq('lido', false)
}

export async function excluirNotificacoesLidas() {
  const auth = await getUser()
  if (!auth || !['admin', 'coordenador'].includes(auth.perfil.role ?? '')) return
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any).from('log_supervisor_acoes').delete().eq('lido', true)
}

export async function excluirNotificacaoIndividual(id: string) {
  const auth = await getUser()
  if (!auth || !['admin', 'coordenador'].includes(auth.perfil.role ?? '')) return
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any).from('log_supervisor_acoes').delete().eq('id', id)
}

export async function marcarSolicitacoesLidasSupervisor() {
  const auth = await getUser()
  if (!auth || auth.perfil.role !== 'supervisor') return
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any
  await supabase
    .from('solicitacoes')
    .update({ lida_supervisor: true })
    .eq('supervisor_id', auth.perfil.id)
    .neq('status', 'pendente')
    .eq('lida_supervisor', false)
}

export async function marcarAlertasSupervisorLidos() {
  const auth = await getUser()
  if (!auth || auth.perfil.role !== 'supervisor') return
  // `alertas_supervisor` é tabela nova (Task 1), ainda não presente em types/database.ts
  // até alguém regerar os tipos do Supabase — `as any` aqui, mesmo padrão já usado em
  // `marcarSolicitacoesLidasSupervisor` logo acima nesta mesma função/arquivo.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any
  await supabase
    .from('alertas_supervisor')
    .update({ lido: true })
    .eq('supervisor_id', auth.perfil.id)
    .eq('lido', false)
}
