import { createAdminClient } from '@/lib/supabase/admin'
import { hojeBR } from '@/lib/agenda/datas'

// As colunas de localização (migração 20261012) ainda não estão em types/database.ts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = { from: (table: string) => any }

export type PostoOpt = {
  id: string
  nome: string
  secretaria: string | null
  tem_local: boolean
}

type P = {
  id: string; nome: string; secretaria: string | null; ativo: boolean | null
  latitude?: number | null; longitude?: number | null
}

async function buscar(admin: AnyClient, supervisorId: string, hoje: string, colunas: string) {
  return Promise.all([
    admin
      .from('config_supervisores_postos')
      .select(`posto_id, postos(${colunas})`)
      .eq('supervisor_id', supervisorId)
      .eq('ativo', true),
    admin
      .from('coberturas_temporarias')
      .select(`posto_destino_id, postos:posto_destino_id(${colunas})`)
      .eq('supervisor_destino_id', supervisorId)
      .eq('status', 'ativa')
      .lte('data_inicio', hoje),
  ])
}

/** Postos que o supervisor atende: vínculos ativos + coberturas (empréstimos) ativas recebidas. */
export async function postosDoSupervisor(supervisorId: string): Promise<PostoOpt[]> {
  const admin = createAdminClient() as unknown as AnyClient
  const hoje = hojeBR()

  // Com a coluna de localização; se a migração 20261012 ainda não rodou, cai para o select simples.
  let [cfg, emp] = await buscar(admin, supervisorId, hoje, 'id, nome, secretaria, ativo, latitude, longitude')
  if (cfg.error || emp.error) {
    ;[cfg, emp] = await buscar(admin, supervisorId, hoje, 'id, nome, secretaria, ativo')
  }

  const mapa = new Map<string, PostoOpt>()
  const add = (p: P | null | undefined) => {
    if (p && p.ativo !== false) {
      mapa.set(p.id, { id: p.id, nome: p.nome, secretaria: p.secretaria, tem_local: p.latitude != null && p.longitude != null })
    }
  }
  for (const r of (cfg.data ?? []) as { postos: P | null }[]) add(r.postos)
  for (const r of (emp.data ?? []) as { postos: P | null }[]) add(r.postos)
  return Array.from(mapa.values()).sort((a, b) => a.nome.localeCompare(b.nome))
}
