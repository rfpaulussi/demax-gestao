import { createClient } from '@/lib/supabase/server'

const CONTRATO_ID = 'c73a81ae-0104-4c05-b7d6-e6266f6be1b2'

export type PostoRow = {
  id: string
  nome: string
  secretaria: string
  efetivo_previsto: number
  cota_insalubridade: number
  ativo: boolean
  efetivo_atual: number
  supervisor_nome: string | null
}

type ConfigRow = {
  posto_id: string
  supervisor_id: string
  perfis: { id: string; nome: string | null } | null
}

export async function getPostosData(): Promise<PostoRow[]> {
  const supabase = createClient()

  const [{ data: postos }, { data: funcionarios }, { data: config }] = await Promise.all([
    supabase
      .from('postos')
      .select('id, nome, secretaria, efetivo_previsto, cota_insalubridade, ativo')
      .eq('contrato_id', CONTRATO_ID)
      .eq('ativo', true)
      .order('secretaria', { ascending: true })
      .order('nome', { ascending: true }),
    supabase
      .from('funcionarios')
      .select('id, posto_id, status')
      .in('status', ['ativo', 'afastado', 'ferias']),
    supabase
      .from('config_supervisores_postos')
      .select('posto_id, supervisor_id, perfis!supervisor_id(id, nome)')
      .eq('ativo', true),
  ])

  const efetivoMap = new Map<string, number>()
  for (const f of funcionarios ?? []) {
    if (f.posto_id) {
      efetivoMap.set(f.posto_id, (efetivoMap.get(f.posto_id) ?? 0) + 1)
    }
  }

  const supervisorMap = new Map<string, string>()
  for (const row of (config ?? []) as unknown as ConfigRow[]) {
    if (!supervisorMap.has(row.posto_id) && row.perfis?.nome) {
      supervisorMap.set(row.posto_id, row.perfis.nome)
    }
  }

  return (postos ?? []).map(p => ({
    id: p.id,
    nome: p.nome,
    secretaria: p.secretaria ?? '',
    efetivo_previsto: p.efetivo_previsto ?? 0,
    cota_insalubridade: p.cota_insalubridade ?? 0,
    ativo: p.ativo ?? true,
    efetivo_atual: efetivoMap.get(p.id) ?? 0,
    supervisor_nome: supervisorMap.get(p.id) ?? null,
  }))
}
