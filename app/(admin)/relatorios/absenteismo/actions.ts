'use server'

import { createClient } from '@/lib/supabase/server'

export interface AusenciaRow {
  id: string
  funcionario_nome: string
  registro: string | null
  posto_nome: string
  secretaria: string
  tipo_ausencia: 'falta' | 'atestado' | 'ferias'
  data: string
  dias: number
  justificativa: string
}

export interface AbsenteismoKpis {
  total_ausencias: number
  total_dias: number
  pct_absenteismo: number
  total_funcionarios: number
  dias_uteis: number
}

function parseDateUTC(iso: string): number {
  const s = iso.slice(0, 10)
  const [y, m, d] = s.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

function diasNoMes(dataInicio: string, dataFim: string, mesInicio: string, mesFim: string): number {
  const start = Math.max(parseDateUTC(dataInicio), parseDateUTC(mesInicio))
  const end   = Math.min(parseDateUTC(dataFim),    parseDateUTC(mesFim))
  if (end < start) return 0
  return Math.round((end - start) / 86400000) + 1
}

function diasUteis(mes: number, ano: number): number {
  let count = 0
  const d = new Date(Date.UTC(ano, mes - 1, 1))
  while (d.getUTCMonth() === mes - 1) {
    const dow = d.getUTCDay()
    if (dow !== 0 && dow !== 6) count++
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return count
}

export async function buscarAbsenteismo(
  mes: number,
  ano: number,
): Promise<{ rows: AusenciaRow[]; kpis: AbsenteismoKpis }> {
  const supabase = createClient()

  const pad = (n: number) => String(n).padStart(2, '0')
  const inicio = `${ano}-${pad(mes)}-01`
  const fim    = `${ano}-${pad(mes)}-${new Date(ano, mes, 0).getDate()}`

  const [{ data: faltas }, { data: atestados }, { data: ferias }, { data: totalFuncs }] = await Promise.all([
    supabase
      .from('faltas')
      .select(`
        id, data_falta, tipo, dias, justificativa, observacao,
        funcionarios!funcionario_id ( nome, registro, postos!posto_id ( nome, secretaria ) )
      `)
      .gte('data_falta', inicio)
      .lte('data_falta', fim)
      .order('data_falta'),
    supabase
      .from('atestados')
      .select(`
        id, data_inicio, data_fim, motivo,
        funcionarios!funcionario_id ( nome, registro ),
        postos!posto_id ( nome, secretaria )
      `)
      .lte('data_inicio', fim)
      .gte('data_fim',    inicio)
      .order('data_inicio'),
    supabase
      .from('ferias')
      .select(`
        id, funcionario_id, data_inicio, data_fim, observacao,
        funcionarios!funcionario_id ( nome, registro, postos!posto_id ( nome, secretaria ) )
      `)
      .lte('data_inicio', fim)
      .gte('data_fim',    inicio)
      .not('status', 'eq', 'cancelado')
      .order('data_inicio'),
    supabase
      .from('funcionarios')
      .select('id', { count: 'exact', head: true })
      .in('status', ['ativo', 'ferias', 'afastado']),
  ])

  type FuncJoin = { nome: string; registro: string | null; postos: { nome: string; secretaria: string | null } | null }
  type PostoJoin = { nome: string; secretaria: string | null }

  const rows: AusenciaRow[] = []

  for (const f of faltas ?? []) {
    const func = f.funcionarios as unknown as FuncJoin | null
    rows.push({
      id:               f.id,
      funcionario_nome: func?.nome ?? '—',
      registro:         func?.registro ?? null,
      posto_nome:       func?.postos?.nome ?? '—',
      secretaria:       func?.postos?.secretaria ?? '—',
      tipo_ausencia:    'falta',
      data:             f.data_falta,
      dias:             f.dias,
      justificativa:    f.justificativa ?? f.observacao ?? '—',
    })
  }

  for (const a of atestados ?? []) {
    const func  = a.funcionarios as unknown as FuncJoin | null
    const posto = a.postos as unknown as PostoJoin | null
    const d = diasNoMes(a.data_inicio, a.data_fim, inicio, fim)
    if (d <= 0) continue
    rows.push({
      id:               a.id,
      funcionario_nome: func?.nome ?? '—',
      registro:         func?.registro ?? null,
      posto_nome:       posto?.nome ?? '—',
      secretaria:       posto?.secretaria ?? '—',
      tipo_ausencia:    'atestado',
      data:             a.data_inicio,
      dias:             d,
      justificativa:    a.motivo ?? '—',
    })
  }

  type FeriasEntry = NonNullable<typeof ferias>[0]
  // Deduplicar férias por funcionario_id: manter a entrada com mais dias no mês
  const feriasSeen = new Map<string, FeriasEntry>()
  for (const v of ferias ?? []) {
    const fid = (v as unknown as { funcionario_id: string }).funcionario_id
    if (!fid) continue
    const existing = feriasSeen.get(fid)
    if (!existing) {
      feriasSeen.set(fid, v)
    } else {
      const dNew = diasNoMes(v.data_inicio!, v.data_fim!, inicio, fim)
      const dOld = diasNoMes(existing.data_inicio!, existing.data_fim!, inicio, fim)
      if (dNew > dOld) feriasSeen.set(fid, v)
    }
  }

  for (const v of Array.from(feriasSeen.values())) {
    const func = v.funcionarios as unknown as FuncJoin | null
    const d = diasNoMes(v.data_inicio!, v.data_fim!, inicio, fim)
    if (d <= 0) continue
    // inicioEfetivo: primeiro dia das férias que cai dentro do mês
    const inicioEfetivo = v.data_inicio! < inicio ? inicio : v.data_inicio!
    rows.push({
      id:               v.id,
      funcionario_nome: func?.nome ?? '—',
      registro:         func?.registro ?? null,
      posto_nome:       func?.postos?.nome ?? '—',
      secretaria:       func?.postos?.secretaria ?? '—',
      tipo_ausencia:    'ferias',
      data:             inicioEfetivo,
      dias:             d,
      justificativa:    v.observacao ?? '—',
    })
  }

  rows.sort((a, b) => a.tipo_ausencia.localeCompare(b.tipo_ausencia) || a.data.localeCompare(b.data))

  const totalDias         = rows.reduce((s, r) => s + r.dias, 0)
  const totalFuncionarios = (totalFuncs as { count: number } | null)?.count ?? 0
  const du                = diasUteis(mes, ano)
  const base              = totalFuncionarios * du
  const pct               = base > 0 ? (totalDias / base) * 100 : 0

  return {
    rows,
    kpis: {
      total_ausencias:    rows.length,
      total_dias:         totalDias,
      pct_absenteismo:    Math.round(pct * 10) / 10,
      total_funcionarios: totalFuncionarios,
      dias_uteis:         du,
    },
  }
}
