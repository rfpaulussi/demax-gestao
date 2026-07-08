'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/auth/get-user'

export async function gerarSnapshot(): Promise<{ error?: string }> {
  const auth = await getUser()
  if (!auth || !['admin', 'coordenador'].includes(auth.perfil.role ?? '')) {
    return { error: 'Sem permissão para gerar snapshot.' }
  }

  const supabase = createClient()

  const now = new Date()
  const mesReferencia = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split('T')[0]

  const [
    { data: postos,     error: postosErr },
    { data: funcionarios, error: funcsErr },
    { data: coberturas, error: cobErr },
  ] = await Promise.all([
    supabase
      .from('postos')
      .select('id, efetivo_previsto')
      .eq('ativo', true),
    supabase
      .from('funcionarios')
      .select('id, nome, registro, posto_id')
      .eq('status', 'ativo'),
    supabase
      .from('coberturas_temporarias')
      .select('funcionario_id, posto_destino_id')
      .eq('status', 'ativa'),
  ])

  if (postosErr) return { error: postosErr.message }
  if (funcsErr)  return { error: funcsErr.message }
  if (cobErr)    return { error: cobErr.message }

  if (!postos?.length) {
    revalidatePath('/medicao')
    return {}
  }

  // Funcionário em cobertura ativa → conta no posto de destino
  const coberturaMap = new Map<string, string>()
  for (const c of coberturas ?? []) {
    coberturaMap.set(c.funcionario_id, c.posto_destino_id)
  }

  type FuncEntry = { id: string; nome: string; registro: string | null }
  const byPosto = new Map<string, FuncEntry[]>()
  for (const f of funcionarios ?? []) {
    if (!f.posto_id) continue
    const postoEfetivo = coberturaMap.get(f.id) ?? f.posto_id
    if (!byPosto.has(postoEfetivo)) byPosto.set(postoEfetivo, [])
    byPosto.get(postoEfetivo)!.push({ id: f.id, nome: f.nome, registro: f.registro ?? null })
  }

  const { error: deleteError } = await supabase
    .from('logs_alocacoes_mensais')
    .delete()
    .eq('mes_referencia', mesReferencia)

  if (deleteError) return { error: deleteError.message }

  const rows = postos.map(p => ({
    posto_id:           p.id,
    mes_referencia:     mesReferencia,
    efetivo_previsto:   p.efetivo_previsto ?? 0,
    efetivo_real:       byPosto.get(p.id)?.length ?? 0,
    nomes_funcionarios: byPosto.get(p.id) ?? [],
  }))

  const { error: insertError } = await supabase.from('logs_alocacoes_mensais').insert(rows)
  if (insertError) return { error: insertError.message }

  revalidatePath('/medicao')
  return {}
}
