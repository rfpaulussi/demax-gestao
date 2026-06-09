'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type InsalubridadeStatus = 'pendente' | 'enviado' | 'pago'
export type InsalubridadeOrigem = 'manual' | 'cobertura'

export interface InsalubridadeCobertura {
  id: string
  funcionario_id: string
  mes: number
  ano: number
  data_cobertura: string
  agente_ausente_id: string | null
  agente_ausente_nome: string | null
  posto_id: string | null
  origem: InsalubridadeOrigem
  cobertura_id: string | null
  percentual: number
  observacao: string | null
  status: InsalubridadeStatus
  criado_por: string | null
  created_at: string
  funcionarios: {
    id: string
    nome: string
    funcoes: { nome: string } | null
    postos: { id: string; nome: string; secretaria: string | null } | null
  } | null
}

export interface InsalubridadeGrupo {
  funcionario_id: string
  funcionario_nome: string
  funcao: string | null
  posto_id: string | null
  posto_nome: string | null
  secretaria: string | null
  supervisor_nome: string | null
  total_dias: number
  status: InsalubridadeStatus | 'misto'
  origens: InsalubridadeOrigem[]
  registros: InsalubridadeCobertura[]
}

export interface FuncOpt {
  id: string
  nome: string
  postos: { id: string; nome: string; secretaria: string | null } | null
}

const INS_SELECT = `
  id, funcionario_id, mes, ano, data_cobertura,
  agente_ausente_id, agente_ausente_nome, posto_id,
  origem, cobertura_id, percentual, observacao, status, created_at,
  funcionarios!funcionario_id (
    id, nome,
    funcoes!funcao_id ( nome ),
    postos!posto_id ( id, nome, secretaria )
  )
`

export async function buscarInsalubridades(
  mes: number,
  ano: number,
  filtros?: { status?: string; secretaria?: string }
): Promise<InsalubridadeGrupo[]> {
  const supabase = createClient()

  const { data: raw } = await supabase
    .from('insalubridade_coberturas')
    .select(INS_SELECT)
    .eq('mes', mes)
    .eq('ano', ano)
    .order('data_cobertura', { ascending: true })

  let registros = (raw ?? []) as unknown as InsalubridadeCobertura[]

  if (filtros?.secretaria) {
    registros = registros.filter(
      r => r.funcionarios?.postos?.secretaria === filtros.secretaria
    )
  }

  // Build supervisor map
  const postoIds = Array.from(new Set(registros.map(r => r.funcionarios?.postos?.id).filter(Boolean))) as string[]
  const supervisorMap: Record<string, string> = {}

  if (postoIds.length > 0) {
    const { data: supData } = await supabase
      .from('config_supervisores_postos')
      .select('posto_id, perfis!supervisor_id(nome)')
      .in('posto_id', postoIds)
      .eq('ativo', true)

    for (const s of supData ?? []) {
      const nome = (s as unknown as { posto_id: string; perfis: { nome: string | null } | null }).perfis?.nome
      if (nome) supervisorMap[(s as unknown as { posto_id: string }).posto_id] = nome
    }
  }

  // Group by funcionario_id
  const grouped = new Map<string, InsalubridadeGrupo>()

  for (const r of registros) {
    const fid = r.funcionario_id
    if (!grouped.has(fid)) {
      const postoId = r.funcionarios?.postos?.id ?? null
      grouped.set(fid, {
        funcionario_id: fid,
        funcionario_nome: r.funcionarios?.nome ?? '—',
        funcao: (r.funcionarios?.funcoes as unknown as { nome: string } | null)?.nome ?? null,
        posto_id: postoId,
        posto_nome: r.funcionarios?.postos?.nome ?? null,
        secretaria: r.funcionarios?.postos?.secretaria ?? null,
        supervisor_nome: postoId ? (supervisorMap[postoId] ?? null) : null,
        total_dias: 0,
        status: r.status,
        origens: [],
        registros: [],
      })
    }
    const g = grouped.get(fid)!
    g.total_dias += 1
    g.registros.push(r)
    if (!g.origens.includes(r.origem)) g.origens.push(r.origem)
    if (g.status !== r.status) g.status = 'misto'
  }

  let result = Array.from(grouped.values())

  if (filtros?.status && filtros.status !== 'misto') {
    result = result.filter(g => g.registros.some(r => r.status === filtros.status))
  } else if (filtros?.status === 'misto') {
    result = result.filter(g => g.status === 'misto')
  }

  return result
}

export async function criarInsalubridade(formData: FormData) {
  const supabase = createClient()

  const dataCobertura = formData.get('data_cobertura') as string
  const [ano, mes] = dataCobertura.split('-').map(Number)

  await supabase.from('insalubridade_coberturas').insert({
    funcionario_id: formData.get('funcionario_id') as string,
    mes,
    ano,
    data_cobertura: dataCobertura,
    agente_ausente_id: (formData.get('agente_ausente_id') as string) || null,
    agente_ausente_nome: (formData.get('agente_ausente_nome') as string) || null,
    posto_id: (formData.get('posto_id') as string) || null,
    origem: 'manual',
    percentual: 40,
    observacao: (formData.get('observacao') as string) || null,
    status: 'pendente',
  })

  revalidatePath('/insalubridade')
}

export async function importarDasCoberturas(
  mes: number,
  ano: number
): Promise<{ importados: number }> {
  const supabase = createClient()

  const { data: postosInsalubres } = await supabase
    .from('postos')
    .select('id')
    .gt('cota_insalubridade', 0)

  const postoIds = (postosInsalubres ?? []).map((p: { id: string }) => p.id)
  if (postoIds.length === 0) return { importados: 0 }

  const mesStr = String(mes).padStart(2, '0')
  const startOfMonth = `${ano}-${mesStr}-01`
  const daysInMonth = new Date(ano, mes, 0).getDate()
  const endOfMonth = `${ano}-${mesStr}-${String(daysInMonth).padStart(2, '0')}`

  const { data: coberturas } = await supabase
    .from('coberturas_temporarias')
    .select('id, funcionario_id, posto_destino_id, data_inicio, data_prev_retorno, data_retorno_real')
    .in('posto_destino_id', postoIds)
    .gte('data_inicio', startOfMonth)
    .lte('data_inicio', endOfMonth)

  const toInsert: Array<{
    funcionario_id: string
    mes: number
    ano: number
    data_cobertura: string
    posto_id: string
    origem: 'cobertura'
    cobertura_id: string
    percentual: number
    status: 'pendente'
  }> = []

  for (const cob of coberturas ?? []) {
    if (!cob.data_inicio) continue
    const endDateStr = cob.data_retorno_real ?? cob.data_prev_retorno ?? cob.data_inicio

    const start = new Date(cob.data_inicio + 'T12:00:00')
    const end = new Date(endDateStr + 'T12:00:00')
    const endClamped = new Date(Math.min(end.getTime(), new Date(endOfMonth + 'T12:00:00').getTime()))

    for (const d = new Date(start); d <= endClamped; d.setDate(d.getDate() + 1)) {
      const dateStr = new Date(d).toISOString().split('T')[0]
      toInsert.push({
        funcionario_id: cob.funcionario_id,
        mes,
        ano,
        data_cobertura: dateStr,
        posto_id: cob.posto_destino_id,
        origem: 'cobertura',
        cobertura_id: cob.id,
        percentual: 40,
        status: 'pendente',
      })
    }
  }

  if (toInsert.length === 0) return { importados: 0 }

  const { data: inserted } = await supabase
    .from('insalubridade_coberturas')
    .upsert(toInsert, { onConflict: 'funcionario_id,data_cobertura', ignoreDuplicates: true })
    .select('id')

  revalidatePath('/insalubridade')
  return { importados: (inserted ?? []).length }
}

export async function marcarEnviado(
  funcionarioId: string,
  mes: number,
  ano: number
) {
  const supabase = createClient()
  await supabase
    .from('insalubridade_coberturas')
    .update({ status: 'enviado' })
    .eq('funcionario_id', funcionarioId)
    .eq('mes', mes)
    .eq('ano', ano)
    .eq('status', 'pendente')
  revalidatePath('/insalubridade')
}

export async function enviarTodosRH(mes: number, ano: number) {
  const supabase = createClient()
  await supabase
    .from('insalubridade_coberturas')
    .update({ status: 'enviado' })
    .eq('mes', mes)
    .eq('ano', ano)
    .eq('status', 'pendente')
  revalidatePath('/insalubridade')
}

export async function removerDia(id: string) {
  const supabase = createClient()
  await supabase.from('insalubridade_coberturas').delete().eq('id', id)
  revalidatePath('/insalubridade')
}

export async function buscarFuncionariosParaDeclaracao(): Promise<FuncOpt[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('funcionarios')
    .select('id, nome, postos!posto_id(id, nome, secretaria)')
    .in('status', ['ativo', 'ferias', 'afastado'])
    .order('nome')
  return (data ?? []) as unknown as FuncOpt[]
}

export async function buscarAgentesPorPosto(postoId: string): Promise<FuncOpt[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('funcionarios')
    .select('id, nome, postos!posto_id(id, nome, secretaria)')
    .eq('posto_id', postoId)
    .eq('status', 'ativo')
    .order('nome')
  return (data ?? []) as unknown as FuncOpt[]
}

export async function buscarAgentesHigienizacao(postoId?: string): Promise<FuncOpt[]> {
  const supabase = createClient()
  let q = supabase
    .from('funcionarios')
    .select('id, nome, postos!posto_id(id, nome, secretaria), funcoes!funcao_id(nome)')
    .in('status', ['ativo', 'afastado'])
    .order('nome')

  if (postoId) {
    q = q.eq('posto_id', postoId)
  }

  const { data } = await q
  // Filter by funcao name containing "Agente" client-side since ilike on joined table isn't straightforward
  const all = (data ?? []) as unknown as Array<FuncOpt & { funcoes: { nome: string } | null }>
  return all.filter(f => {
    const fnome = (f.funcoes?.nome ?? '').toUpperCase()
    return fnome.includes('AGENTE') || fnome.includes('HIGIENIZA')
  })
}
