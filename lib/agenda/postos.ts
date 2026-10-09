import { createAdminClient } from '@/lib/supabase/admin'
import { hojeBR } from '@/lib/agenda/datas'

// As colunas de localização (migrações 20261012/20261016) ainda não estão em types/database.ts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = { from: (table: string) => any }

export type PostoOpt = {
  id: string
  nome: string
  secretaria: string | null
  tem_local: boolean
  a_conferir: boolean // localização importada/marcada por GPS e ainda não confirmada pela coordenação
}

type P = {
  id: string; nome: string; secretaria: string | null; ativo: boolean | null
  latitude?: number | null; longitude?: number | null; geo_confirmado?: boolean | null
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

  // Do mais completo ao mais simples: colunas novas só existem depois das migrações.
  const tentativas = [
    'id, nome, secretaria, ativo, latitude, longitude, geo_confirmado',
    'id, nome, secretaria, ativo, latitude, longitude',
    'id, nome, secretaria, ativo',
  ]
  let [cfg, emp] = await buscar(admin, supervisorId, hoje, tentativas[0])
  for (let i = 1; i < tentativas.length && (cfg.error || emp.error); i++) {
    ;[cfg, emp] = await buscar(admin, supervisorId, hoje, tentativas[i])
  }

  const mapa = new Map<string, PostoOpt>()
  const add = (p: P | null | undefined) => {
    // "AFASTADO - X" agrupa funcionários afastados: não é local físico, não entra na agenda.
    if (p && p.ativo !== false && !/^afastado/i.test(p.nome)) {
      const tem = p.latitude != null && p.longitude != null
      mapa.set(p.id, {
        id: p.id, nome: p.nome, secretaria: p.secretaria,
        tem_local: tem,
        a_conferir: tem && p.geo_confirmado === false,
      })
    }
  }
  for (const r of (cfg.data ?? []) as { postos: P | null }[]) add(r.postos)
  for (const r of (emp.data ?? []) as { postos: P | null }[]) add(r.postos)
  return Array.from(mapa.values()).sort((a, b) => a.nome.localeCompare(b.nome))
}
