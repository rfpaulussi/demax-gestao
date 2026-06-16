'use server'

import { createClient } from '@/lib/supabase/server'

export interface DesligamentoRow {
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

export interface DesligamentoKpis {
  total: number
  voluntaria: number
  demissao: number
  reprova_experiencia: number
  judicial: number
  outros: number
}

export async function buscarDesligamentos(
  mes: number,
  ano: number,
): Promise<{ rows: DesligamentoRow[]; kpis: DesligamentoKpis }> {
  const supabase = createClient()
  const pad = (n: number) => String(n).padStart(2, '0')
  const inicio = `${ano}-${pad(mes)}-01`
  const fim    = `${ano}-${pad(mes)}-${new Date(ano, mes, 0).getDate()}`

  type FuncRaw = {
    id: string
    nome: string
    registro: string | null
    data_admissao: string | null
    data_desligamento: string | null
    tipo_desligamento: string | null
    motivo_desligamento: string | null
    posto_id: string | null
    postos: { nome: string; secretaria: string | null } | null
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [{ data: funcsRaw }, { data: configs }] = await Promise.all([
    supabase
      .from('funcionarios')
      .select(`
        id, nome, registro, data_admissao, data_desligamento,
        tipo_desligamento, motivo_desligamento, posto_id,
        postos!posto_id ( nome, secretaria )
      `)
      .eq('status', 'desligado')
      .gte('data_desligamento', inicio)
      .lte('data_desligamento', fim)
      .order('data_desligamento', { ascending: false })
      .range(0, 999) as unknown as Promise<{ data: FuncRaw[] | null; error: unknown }>,
    supabase
      .from('config_supervisores_postos')
      .select('posto_id, perfis!supervisor_id ( nome )')
      .eq('ativo', true),
  ])

  const funcs = funcsRaw

  const supByPosto = new Map<string, string>()
  for (const c of configs ?? []) {
    if (!supByPosto.has(c.posto_id)) {
      supByPosto.set(c.posto_id, (c.perfis as unknown as { nome: string } | null)?.nome ?? '—')
    }
  }

  const rows: DesligamentoRow[] = (funcs ?? []).map(f => {
    const postoId = f.posto_id ?? ''

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
      posto_nome:          f.postos?.nome ?? '—',
      secretaria:          f.postos?.secretaria ?? '—',
      supervisor:          supByPosto.get(postoId) ?? '—',
      data_admissao:       f.data_admissao ?? null,
      data_desligamento:   f.data_desligamento ?? null,
      tempo_casa_dias:     tempoCasaDias,
      tipo_desligamento:   f.tipo_desligamento ?? null,
      motivo_desligamento: f.motivo_desligamento ?? null,
    }
  })

  const kpis: DesligamentoKpis = {
    total:               rows.length,
    voluntaria:          rows.filter(r => r.tipo_desligamento === 'voluntaria').length,
    demissao:            rows.filter(r => r.tipo_desligamento === 'demissao').length,
    reprova_experiencia: rows.filter(r => r.tipo_desligamento === 'reprova_experiencia').length,
    judicial:            rows.filter(r => r.tipo_desligamento === 'judicial').length,
    outros:              rows.filter(r => !r.tipo_desligamento || r.tipo_desligamento === 'outros').length,
  }

  return { rows, kpis }
}
