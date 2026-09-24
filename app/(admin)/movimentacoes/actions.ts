'use server'

import { revalidatePath } from 'next/cache'
import { getUser } from '@/lib/auth/get-user'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { carregarTermo } from '@/lib/termos/carregar-termo'
import type { TermoData } from '@/lib/termos/tipos'

type Res = { success: boolean; error?: string }

const CHAVE_RE = /^(sol|mov):[0-9a-f-]{36}$/i

async function funcionarioDaChave(chave: string): Promise<string | null> {
  // Client com RLS: se o usuário não enxerga a movimentação, retorna null.
  const supabase = createClient()
  const [prefixo, id] = chave.split(':')
  const q = supabase.from('movimentacoes').select('funcionario_id')
  const { data } = await (prefixo === 'sol' ? q.eq('solicitacao_id', id) : q.eq('id', id)).limit(1)
  return data?.[0]?.funcionario_id ?? null
}

async function protocolarUm(chave: string, userId: string, observacao?: string): Promise<Res> {
  if (!CHAVE_RE.test(chave)) return { success: false, error: 'Termo inválido.' }
  const funcionarioId = await funcionarioDaChave(chave)
  if (!funcionarioId) return { success: false, error: 'Termo não encontrado ou sem acesso.' }
  const admin = createAdminClient()
  const { error } = await admin.from('termos_protocolo').upsert(
    {
      chave_termo: chave,
      funcionario_id: funcionarioId,
      protocolado_por: userId,
      protocolado_em: new Date().toISOString(),
      observacao: observacao?.trim() || null,
    },
    { onConflict: 'chave_termo' },
  )
  if (error) return { success: false, error: error.message }
  return { success: true }
}

function podeProtocolar(role: string | null | undefined): boolean {
  return role === 'admin' || role === 'coordenador' || role === 'supervisor'
}

export async function protocolarTermo(chave: string, observacao?: string): Promise<Res> {
  const auth = await getUser()
  if (!auth) return { success: false, error: 'Não autenticado.' }
  if (!podeProtocolar(auth.perfil.role)) return { success: false, error: 'Sem permissão.' }
  const r = await protocolarUm(chave, auth.perfil.id, observacao)
  if (r.success) {
    revalidatePath('/movimentacoes')
    revalidatePath('/efetivo')
  }
  return r
}

export async function protocolarTermos(
  chaves: string[],
): Promise<{ success: boolean; ok: number; falhas: number; error?: string }> {
  const auth = await getUser()
  if (!auth) return { success: false, ok: 0, falhas: 0, error: 'Não autenticado.' }
  if (!podeProtocolar(auth.perfil.role)) return { success: false, ok: 0, falhas: 0, error: 'Sem permissão.' }
  let ok = 0
  let falhas = 0
  let primeiroErro: string | undefined
  for (const c of chaves.slice(0, 200)) {
    const r = await protocolarUm(c, auth.perfil.id)
    if (r.success) ok++
    else {
      falhas++
      primeiroErro = primeiroErro ?? r.error
    }
  }
  revalidatePath('/movimentacoes')
  revalidatePath('/efetivo')
  return {
    success: ok > 0,
    ok,
    falhas,
    error: falhas > 0 ? `${falhas} termo(s) não protocolado(s): ${primeiroErro ?? ''}` : undefined,
  }
}

export async function desfazerProtocolo(chave: string): Promise<Res> {
  const auth = await getUser()
  if (!auth) return { success: false, error: 'Não autenticado.' }
  if (auth.perfil.role !== 'admin' && auth.perfil.role !== 'coordenador') {
    return { success: false, error: 'Sem permissão.' }
  }
  if (!CHAVE_RE.test(chave)) return { success: false, error: 'Termo inválido.' }
  const admin = createAdminClient()
  const { error } = await admin.from('termos_protocolo').delete().eq('chave_termo', chave)
  if (error) return { success: false, error: error.message }
  revalidatePath('/movimentacoes')
  revalidatePath('/efetivo')
  return { success: true }
}

/** Carrega os dados completos de um termo para gerar o PDF no cliente. */
export async function obterTermo(chave: string): Promise<TermoData | null> {
  return carregarTermo(chave)
}
