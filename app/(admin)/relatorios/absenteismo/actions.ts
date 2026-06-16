'use server'

import { createClient } from '@/lib/supabase/server'

export interface AusenciaRow {
  id: string
  funcionario_nome: string
  registro: string | null
  posto_nome: string
  secretaria: string
  tipo_ausencia: 'falta' | 'atestado' | 'suspensao'
  data: string
  dias: number
  justificativa: string
}

export interface FeriasRow {
  id: string
  funcionario_nome: string
  registro: string | null
  posto_nome: string
  secretaria: string
  data_inicio: string
  data_fim: string
  data_efetiva: string
  dias_no_mes: number
}

export interface AbsenteismoKpis {
  total_ocorrencias: number
  total_dias: number
  pct_absenteismo: number
  total_funcionarios: number
  dias_uteis: number
}

export interface FeriasKpis {
  total_funcionarios: number
  total_dias: number
}

function parseDateUTC(iso: string): number {
  const s = iso.slice(0, 10)
  const [y, m, d] = s.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

function clipDias(dataInicio: string, dataFim: string, mesInicio: string, mesFim: string): number {
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
): Promise<{ absRows: AusenciaRow[]; feriasRows: FeriasRow[]; kpisAbs: AbsenteismoKpis; kpisFerias: FeriasKpis }> {
  const supabase = createClient()

  const pad = (n: number) => String(n).padStart(2, '0')
  const inicio = `${ano}-${pad(mes)}-01`
  const fim    = `${ano}-${pad(mes)}-${new Date(ano, mes, 0).getDate()}`

  const [
    { data: faltas },
    { data: atestados },
    { data: suspensoes },
    { data: ferias },
    { count: countAtivos },
  ] = await Promise.all([
    supabase
      .from('faltas')
      .select(`
        id, data_falta, tipo, dias, observacao,
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
      .from('advertencias')
      .select(`
        id, data_ocorrencia, descricao, dias_suspensao,
        funcionarios!funcionario_id ( nome, registro, posto_id, postos!posto_id ( nome, secretaria ) )
      `)
      .eq('grau', 'suspensao')
      .gt('dias_suspensao', 0)
      .gte('data_ocorrencia', inicio)
      .lte('data_ocorrencia', fim)
      .order('data_ocorrencia'),

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
      .select('*', { count: 'exact', head: true })
      .eq('status', 'ativo'),
  ])

  type FuncJoin     = { nome: string; registro: string | null; postos: { nome: string; secretaria: string | null } | null }
  type FuncJoinAdv  = { nome: string; registro: string | null; posto_id: string | null; postos: { nome: string; secretaria: string | null } | null }
  type PostoJoin    = { nome: string; secretaria: string | null }

  const absRows: AusenciaRow[] = []

  for (const f of faltas ?? []) {
    const func = f.funcionarios as unknown as FuncJoin | null
    absRows.push({
      id:               f.id,
      funcionario_nome: func?.nome ?? '—',
      registro:         func?.registro ?? null,
      posto_nome:       func?.postos?.nome ?? '—',
      secretaria:       func?.postos?.secretaria ?? '—',
      tipo_ausencia:    'falta',
      data:             f.data_falta,
      dias:             f.dias,
      justificativa:    f.observacao ?? '—',
    })
  }

  for (const a of atestados ?? []) {
    const func  = a.funcionarios as unknown as FuncJoin | null
    const posto = a.postos as unknown as PostoJoin | null
    const d = clipDias(a.data_inicio, a.data_fim, inicio, fim)
    if (d <= 0) continue
    absRows.push({
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

  for (const s of suspensoes ?? []) {
    const func = s.funcionarios as unknown as FuncJoinAdv | null
    absRows.push({
      id:               s.id,
      funcionario_nome: func?.nome ?? '—',
      registro:         func?.registro ?? null,
      posto_nome:       func?.postos?.nome ?? '—',
      secretaria:       func?.postos?.secretaria ?? '—',
      tipo_ausencia:    'suspensao',
      data:             s.data_ocorrencia ?? '',
      dias:             s.dias_suspensao ?? 0,
      justificativa:    s.descricao ?? '—',
    })
  }

  absRows.sort((a, b) => a.tipo_ausencia.localeCompare(b.tipo_ausencia) || a.data.localeCompare(b.data))

  // Férias: deduplicar por funcionario_id (manter a com mais dias no mês)
  type FeriasEntry = NonNullable<typeof ferias>[0]
  const feriasSeen = new Map<string, FeriasEntry>()
  for (const v of ferias ?? []) {
    const fid = (v as unknown as { funcionario_id: string }).funcionario_id
    if (!fid) continue
    const existing = feriasSeen.get(fid)
    if (!existing) {
      feriasSeen.set(fid, v)
    } else {
      const dNew = clipDias(v.data_inicio!, v.data_fim!, inicio, fim)
      const dOld = clipDias(existing.data_inicio!, existing.data_fim!, inicio, fim)
      if (dNew > dOld) feriasSeen.set(fid, v)
    }
  }

  const feriasRows: FeriasRow[] = []
  for (const v of Array.from(feriasSeen.values())) {
    const func = v.funcionarios as unknown as FuncJoin | null
    const d = clipDias(v.data_inicio!, v.data_fim!, inicio, fim)
    if (d <= 0) continue
    const dataEfetiva = v.data_inicio! < inicio ? inicio : v.data_inicio!
    feriasRows.push({
      id:               v.id,
      funcionario_nome: func?.nome ?? '—',
      registro:         func?.registro ?? null,
      posto_nome:       func?.postos?.nome ?? '—',
      secretaria:       func?.postos?.secretaria ?? '—',
      data_inicio:      v.data_inicio!,
      data_fim:         v.data_fim!,
      data_efetiva:     dataEfetiva,
      dias_no_mes:      d,
    })
  }
  feriasRows.sort((a, b) => a.funcionario_nome.localeCompare(b.funcionario_nome))

  const totalFuncionarios = countAtivos ?? 0
  const du   = diasUteis(mes, ano)
  const tDias = absRows.reduce((s, r) => s + r.dias, 0)
  const base  = totalFuncionarios * du
  const pct   = base > 0 ? (tDias / base) * 100 : 0

  return {
    absRows,
    feriasRows,
    kpisAbs: {
      total_ocorrencias:  absRows.length,
      total_dias:         tDias,
      pct_absenteismo:    Math.round(pct * 100) / 100,
      total_funcionarios: totalFuncionarios,
      dias_uteis:         du,
    },
    kpisFerias: {
      total_funcionarios: feriasRows.length,
      total_dias:         feriasRows.reduce((s, r) => s + r.dias_no_mes, 0),
    },
  }
}
