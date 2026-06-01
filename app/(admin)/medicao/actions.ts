'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function gerarSnapshot() {
  const supabase = createClient()

  const now = new Date()
  const mesReferencia = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split('T')[0]

  const [{ data: postos }, { data: funcionarios }] = await Promise.all([
    supabase
      .from('postos')
      .select('id, efetivo_previsto')
      .eq('ativo', true),
    supabase
      .from('funcionarios')
      .select('id, nome, posto_id')
      .eq('status', 'ativo'),
  ])

  if (!postos?.length) {
    revalidatePath('/medicao')
    return
  }

  const byPosto = new Map<string, { id: string; nome: string }[]>()
  for (const f of funcionarios ?? []) {
    if (!f.posto_id) continue
    if (!byPosto.has(f.posto_id)) byPosto.set(f.posto_id, [])
    byPosto.get(f.posto_id)!.push({ id: f.id, nome: f.nome })
  }

  await supabase
    .from('logs_alocacoes_mensais')
    .delete()
    .eq('mes_referencia', mesReferencia)

  const rows = postos.map(p => ({
    posto_id:           p.id,
    mes_referencia:     mesReferencia,
    efetivo_previsto:   p.efetivo_previsto ?? 0,
    efetivo_real:       byPosto.get(p.id)?.length ?? 0,
    nomes_funcionarios: byPosto.get(p.id) ?? [],
  }))

  await supabase.from('logs_alocacoes_mensais').insert(rows)

  revalidatePath('/medicao')
}
