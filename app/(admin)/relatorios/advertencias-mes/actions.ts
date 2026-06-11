'use server'

import { createClient } from '@/lib/supabase/server'

export interface AdvertenciaMesRow {
  id: string
  data_ocorrencia: string
  funcionario_nome: string
  registro: string | null
  posto_nome: string
  secretaria: string
  supervisor: string
  grau: string
  descricao: string
  dias_suspensao: number | null
  status: string
}

export interface AdvertenciaKpis {
  total_advertencias: number
  total_suspensoes: number
  total_dias_suspensos: number
}

export async function buscarAdvertenciasMes(
  mes: number,
  ano: number,
): Promise<{ rows: AdvertenciaMesRow[]; kpis: AdvertenciaKpis }> {
  const supabase = createClient()

  const pad = (n: number) => String(n).padStart(2, '0')
  const inicio = `${ano}-${pad(mes)}-01`
  const fim    = `${ano}-${pad(mes)}-${new Date(ano, mes, 0).getDate()}`

  const [{ data: advertencias }, { data: configs }] = await Promise.all([
    supabase
      .from('advertencias')
      .select(`
        id, data_ocorrencia, grau, tipo, descricao, dias_suspensao, status,
        funcionarios!funcionario_id ( nome, registro, posto_id, postos!posto_id ( nome, secretaria ) )
      `)
      .gte('data_ocorrencia', inicio)
      .lte('data_ocorrencia', fim)
      .order('data_ocorrencia', { ascending: true }),
    supabase
      .from('config_supervisores_postos')
      .select('posto_id, perfis!supervisor_id ( nome )')
      .eq('ativo', true),
  ])

  const supByPosto = new Map<string, string>()
  for (const c of configs ?? []) {
    if (!supByPosto.has(c.posto_id)) {
      supByPosto.set(c.posto_id, (c.perfis as unknown as { nome: string } | null)?.nome ?? '—')
    }
  }

  type FuncJoin = {
    nome: string
    registro: string | null
    posto_id: string | null
    postos: { nome: string; secretaria: string | null } | null
  }

  const rows: AdvertenciaMesRow[] = (advertencias ?? []).map(a => {
    const func     = a.funcionarios as unknown as FuncJoin | null
    const postoId  = func?.posto_id ?? ''
    return {
      id:               a.id,
      data_ocorrencia:  a.data_ocorrencia ?? '',
      funcionario_nome: func?.nome ?? '—',
      registro:         func?.registro ?? null,
      posto_nome:       func?.postos?.nome ?? '—',
      secretaria:       func?.postos?.secretaria ?? '—',
      supervisor:       supByPosto.get(postoId) ?? '—',
      grau:             a.grau ?? a.tipo ?? '—',
      descricao:        a.descricao ?? '—',
      dias_suspensao:   a.dias_suspensao ?? null,
      status:           a.status ?? '—',
    }
  })

  const kpis: AdvertenciaKpis = {
    total_advertencias:  rows.length,
    total_suspensoes:    rows.filter(r => r.grau === 'suspensao').length,
    total_dias_suspensos: rows.reduce((s, r) => s + (r.dias_suspensao ?? 0), 0),
  }

  return { rows, kpis }
}
