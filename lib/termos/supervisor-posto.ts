import type { createAdminClient } from '@/lib/supabase/admin'

/** Supervisor(es) ATUAL(is) por posto (config_supervisores_postos, ativo), em lote. Vários => 'A / B'. */
export async function supervisoresAtuaisPorPosto(
  admin: ReturnType<typeof createAdminClient>,
  postoIds: string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  const ids = Array.from(new Set(postoIds.filter(Boolean)))
  const nomes = new Map<string, string[]>()
  for (let i = 0; i < ids.length; i += 150) {
    const { data } = await admin
      .from('config_supervisores_postos')
      .select('posto_id, perfis!supervisor_id(nome)')
      .in('posto_id', ids.slice(i, i + 150))
      .neq('ativo', false)
    for (const r of (data ?? []) as unknown as { posto_id: string; perfis: { nome: string | null } | null }[]) {
      if (!r.perfis?.nome) continue
      const l = nomes.get(r.posto_id) ?? []
      l.push(r.perfis.nome)
      nomes.set(r.posto_id, l)
    }
  }
  nomes.forEach((l, k) => out.set(k, Array.from(new Set(l)).sort().join(' / ')))
  return out
}
