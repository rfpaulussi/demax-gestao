'use server'

import { createClient } from '@/lib/supabase/server'

export interface DesligadoRow {
  id: string
  nome: string
  registro: string | null
  posto_nome: string
  secretaria: string
  supervisor: string
  data_admissao: string | null
  data_desligamento: string | null
  tempo_casa_dias: number | null
  tipo_desligamento: string | null
  motivo_desligamento: string | null
}

export interface DesligadoKpis {
  total: number
  voluntaria: number
  demissao: number
  reprova_experiencia: number
  judicial: number
  outros: number
}

export async function buscarDesligados(
  dataInicio?: string,
  dataFim?: string,
): Promise<{ rows: DesligadoRow[]; kpis: DesligadoKpis }> {
  const supabase = createClient()

  const [{ data: funcs }, { data: configs }] = await Promise.all([
    supabase
      .from('funcionarios')
      .select(`
        id, nome, registro, data_admissao, data_desligamento,
        tipo_desligamento, motivo_desligamento, posto_id,
        postos!posto_id ( nome, secretaria )
      `)
      .eq('status', 'desligado')
      .gte('data_desligamento', dataInicio ?? '2000-01-01')
      .lte('data_desligamento', dataFim ?? new Date().toISOString().slice(0, 10))
      .order('data_desligamento', { ascending: false })
      .range(0, 1999),
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

  type PostoJoin = { nome: string; secretaria: string | null } | null

  const rows: DesligadoRow[] = (funcs ?? []).map(f => {
    const posto   = f.postos as unknown as PostoJoin
    const postoId = f.posto_id ?? ''
    const raw     = f as unknown as Record<string, unknown>

    let tempoCasaDias: number | null = null
    if (f.data_admissao && f.data_desligamento) {
      const admissao     = new Date(f.data_admissao)
      const desligamento = new Date(f.data_desligamento)
      tempoCasaDias = Math.floor((desligamento.getTime() - admissao.getTime()) / (1000 * 60 * 60 * 24))
    }

    return {
      id:                  f.id,
      nome:                f.nome,
      registro:            f.registro ?? null,
      posto_nome:          posto?.nome ?? '—',
      secretaria:          posto?.secretaria ?? '—',
      supervisor:          supByPosto.get(postoId) ?? '—',
      data_admissao:       f.data_admissao ?? null,
      data_desligamento:   f.data_desligamento ?? null,
      tempo_casa_dias:     tempoCasaDias,
      tipo_desligamento:   raw.tipo_desligamento as string | null,
      motivo_desligamento: raw.motivo_desligamento as string | null,
    }
  })

  const kpis: DesligadoKpis = {
    total:               rows.length,
    voluntaria:          rows.filter(r => r.tipo_desligamento === 'voluntaria').length,
    demissao:            rows.filter(r => r.tipo_desligamento === 'demissao').length,
    reprova_experiencia: rows.filter(r => r.tipo_desligamento === 'reprova_experiencia').length,
    judicial:            rows.filter(r => r.tipo_desligamento === 'judicial').length,
    outros:              rows.filter(r => !r.tipo_desligamento || r.tipo_desligamento === 'outros').length,
  }

  return { rows, kpis }
}
