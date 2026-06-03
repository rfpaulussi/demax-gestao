'use server'

import { createClient } from '@/lib/supabase/server'
import type { SupervisorRelatorio, FeriasItem } from '@/components/ferias/relatorio-supervisor-pdf'

export interface BuscarFeriasRelatorioResult {
  supervisores: SupervisorRelatorio[]
  mesAno: string
  totalRegistros: number
  error?: string
}

export interface SupervisorOption {
  id: string
  nome: string
}

export async function buscarSupervisoresAtivos(): Promise<SupervisorOption[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('config_supervisores_postos')
    .select(`
      supervisor_id,
      perfis!config_supervisores_postos_supervisor_id_fkey (
        id,
        nome_completo
      )
    `)
    .eq('ativo', true)

  if (error || !data) return []

  const mapa = new Map<string, string>()
  for (const row of data) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const perfil = row.perfis as any
    if (perfil?.id && perfil?.nome_completo) {
      mapa.set(perfil.id, perfil.nome_completo)
    }
  }

  return Array.from(mapa.entries())
    .map(([id, nome]) => ({ id, nome }))
    .sort((a, b) => a.nome.localeCompare(b.nome))
}

export async function buscarFeriasParaRelatorio(
  mes: number,
  ano: number,
  supervisorId?: string,
): Promise<BuscarFeriasRelatorioResult> {
  const supabase = createClient()
  const mesAno = `${String(mes).padStart(2, '0')}/${ano}`

  const dataInicio = new Date(ano, mes - 1, 1).toISOString().split('T')[0]
  const dataFim    = new Date(ano, mes, 0).toISOString().split('T')[0]

  try {
    // Etapa 1 — férias do período com funcionário, posto e função
    const { data, error } = await supabase
      .from('ferias')
      .select(`
        id,
        status,
        data_inicio,
        data_fim,
        dias_direito,
        dias_utilizados,
        numero_periodo,
        periodo_inicio,
        periodo_fim,
        limite_gozo,
        observacao,
        funcionarios (
          id,
          registro,
          nome,
          posto_id,
          funcoes ( nome ),
          postos (
            id,
            nome,
            secretaria
          )
        )
      `)
      .in('status', ['agendado', 'aprovado', 'em_curso'])
      .gte('data_inicio', dataInicio)
      .lte('data_inicio', dataFim)
      .order('data_inicio', { ascending: true })

    if (error) {
      console.error('[buscarFeriasParaRelatorio] step1:', error)
      return { supervisores: [], mesAno, totalRegistros: 0, error: error.message }
    }

    if (!data || data.length === 0) {
      return { supervisores: [], mesAno, totalRegistros: 0 }
    }

    // Coleta posto_ids únicos
    const postoIdsSet = new Set<string>()
    for (const r of data) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const id = (r.funcionarios as any)?.postos?.id
      if (id) postoIdsSet.add(id)
    }
    const postoIds = Array.from(postoIdsSet)

    // Etapa 2 — supervisor de cada posto
    const { data: cspData, error: cspError } = await supabase
      .from('config_supervisores_postos')
      .select(`
        posto_id,
        supervisor_id,
        perfis!config_supervisores_postos_supervisor_id_fkey (
          id,
          nome_completo
        )
      `)
      .in('posto_id', postoIds)
      .eq('ativo', true)

    if (cspError) {
      console.error('[buscarFeriasParaRelatorio] step2:', cspError)
      return { supervisores: [], mesAno, totalRegistros: 0, error: cspError.message }
    }

    // Mapa posto_id → supervisor
    const mapaPostoSup = new Map<string, { supId: string; supNome: string }>()
    for (const csp of cspData ?? []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const perfil = csp.perfis as any
      if (perfil?.id) {
        mapaPostoSup.set(csp.posto_id, {
          supId:   perfil.id,
          supNome: perfil.nome_completo ?? 'Sem supervisor',
        })
      }
    }

    // Agrupa por supervisor
    const mapaSuper = new Map<string, { nome: string; itens: FeriasItem[] }>()

    for (const row of data) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const func  = row.funcionarios as any
      if (!func) continue

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const posto   = func.postos as any
      const postoId = posto?.id
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const funcao  = func.funcoes as any

      const sup = postoId
        ? mapaPostoSup.get(postoId) ?? { supId: 'sem_supervisor', supNome: 'Sem supervisor' }
        : { supId: 'sem_supervisor', supNome: 'Sem supervisor' }

      if (supervisorId && sup.supId !== supervisorId) continue

      if (!mapaSuper.has(sup.supId)) {
        mapaSuper.set(sup.supId, { nome: sup.supNome, itens: [] })
      }

      const item: FeriasItem = {
        funcionario_nome: func.nome ?? '',
        registro:         func.registro ?? '',
        cargo:            funcao?.nome ?? '—',
        posto_nome:       posto?.nome ?? '—',
        secretaria:       posto?.secretaria ?? '—',
        data_inicio:      row.data_inicio ?? '',
        data_fim:         row.data_fim ?? '',
        dias_direito:     row.dias_direito ?? 30,
        dias_utilizados:  row.dias_utilizados ?? null,
        numero_periodo:   row.numero_periodo ?? 1,
        periodo_inicio:   row.periodo_inicio ?? '',
        periodo_fim:      row.periodo_fim ?? '',
        limite_gozo:      row.limite_gozo ?? null,
        status:           row.status ?? 'agendado',
        observacao:       row.observacao ?? null,
      }

      mapaSuper.get(sup.supId)!.itens.push(item)
    }

    const supervisores: SupervisorRelatorio[] = Array.from(mapaSuper.values())
      .map(s => ({
        supervisor_nome: s.nome,
        itens: s.itens.sort((a, b) =>
          new Date(a.data_inicio).getTime() - new Date(b.data_inicio).getTime()
        ),
      }))
      .sort((a, b) => a.supervisor_nome.localeCompare(b.supervisor_nome))

    const totalRegistros = supervisores.reduce((acc, s) => acc + s.itens.length, 0)

    return { supervisores, mesAno, totalRegistros }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    console.error('[buscarFeriasParaRelatorio] erro inesperado:', err)
    return {
      supervisores: [],
      mesAno,
      totalRegistros: 0,
      error: err?.message ?? 'Erro desconhecido',
    }
  }
}
