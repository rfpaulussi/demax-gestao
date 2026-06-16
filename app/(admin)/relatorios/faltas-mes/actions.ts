'use server'

import { createClient } from '@/lib/supabase/server'

export interface FaltaMesRow {
  id: string
  data_falta: string
  funcionario_nome: string
  registro: string | null
  posto_nome: string
  secretaria: string
  supervisor: string
  tipo: string
  dias: number
  tem_documento: boolean
  justificativa: string
}

export interface FaltaMesKpis {
  total_faltas: number
  total_dias: number
  com_documento: number
  sem_documento: number
}

export async function buscarFaltasMes(
  mes: number,
  ano: number,
): Promise<{ rows: FaltaMesRow[]; kpis: FaltaMesKpis }> {
  const supabase = createClient()

  const pad = (n: number) => String(n).padStart(2, '0')
  const inicio = `${ano}-${pad(mes)}-01`
  const fim    = `${ano}-${pad(mes)}-${new Date(ano, mes, 0).getDate()}`

  const [{ data: faltas }, { data: configs }] = await Promise.all([
    supabase
      .from('faltas')
      .select(`
        id, data_falta, tipo, dias, observacao,
        funcionarios!funcionario_id ( nome, registro, posto_id, postos!posto_id ( nome, secretaria ) )
      `)
      .gte('data_falta', inicio)
      .lte('data_falta', fim)
      .order('data_falta', { ascending: true }),
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

  const rows: FaltaMesRow[] = (faltas ?? []).map(f => {
    const func    = f.funcionarios as unknown as FuncJoin | null
    const postoId = func?.posto_id ?? ''
    return {
      id:               f.id,
      data_falta:       f.data_falta,
      funcionario_nome: func?.nome ?? '—',
      registro:         func?.registro ?? null,
      posto_nome:       func?.postos?.nome ?? '—',
      secretaria:       func?.postos?.secretaria ?? '—',
      supervisor:       supByPosto.get(postoId) ?? '—',
      tipo:             f.tipo,
      dias:             f.dias,
      tem_documento:    f.tipo === 'com_atestado',
      justificativa:    f.observacao ?? '—',
    }
  })

  const kpis: FaltaMesKpis = {
    total_faltas:   rows.length,
    total_dias:     rows.reduce((s, r) => s + r.dias, 0),
    com_documento:  rows.filter(r => r.tem_documento).length,
    sem_documento:  rows.filter(r => !r.tem_documento).length,
  }

  return { rows, kpis }
}
