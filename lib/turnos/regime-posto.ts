import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Regime configurado do posto (config_escalas_postos), ou null se não configurado.
 *
 * config_escalas_postos só é legível por admin/coordenador (RLS). Com o client de sessão,
 * supervisor/viewer recebem null sem erro e telas caem no padrão 5x2 — daí o client admin.
 * O dado não é sensível; o chamador é responsável por já ter autenticado e escopado o postoId.
 */
export async function buscarRegimePosto(postoId: string | null | undefined): Promise<string | null> {
  if (!postoId) return null
  const { data } = await createAdminClient()
    .from('config_escalas_postos')
    .select('regime')
    .eq('posto_id', postoId)
    .maybeSingle()
  return (data as { regime: string | null } | null)?.regime ?? null
}
