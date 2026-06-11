'use server'

import { createClient } from '@/lib/supabase/server'

export interface CoberturaInsalubreRow {
  id: string
  supervisor: string
  posto_nome: string
  secretaria: string
  colaborador_nome: string
  colaborador_funcao: string
  agente_ausente: string
  data_inicio: string
  dias: number
  motivo: string
}

type RawCobertura = {
  id: string
  funcionario_id: string
  data_cobertura: string
  agente_ausente_nome: string | null
  observacao: string | null
  funcionarios: { nome: string; funcoes: { nome: string } | null } | null
  postos: { id: string; nome: string; secretaria: string | null } | null
}

export async function buscarCoberturasInsalubresRelatorio(
  mes: number,
  ano: number,
): Promise<CoberturaInsalubreRow[]> {
  const supabase = createClient()

  const [cobResult, configs] = await Promise.all([
    supabase
      .from('insalubridade_coberturas')
      .select(`
        id, funcionario_id, data_cobertura, agente_ausente_nome, observacao,
        funcionarios!funcionario_id ( nome, funcoes!funcao_id ( nome ) ),
        postos!posto_id ( id, nome, secretaria )
      `)
      .eq('mes', mes)
      .eq('ano', ano)
      .order('data_cobertura'),
    supabase
      .from('config_supervisores_postos')
      .select('posto_id, perfis!supervisor_id ( nome )')
      .eq('ativo', true),
  ])

  const coberturas = (cobResult.data ?? []) as unknown as RawCobertura[]

  const supByPosto = new Map<string, string>()
  for (const c of configs.data ?? []) {
    if (!supByPosto.has(c.posto_id)) {
      supByPosto.set(c.posto_id, (c.perfis as unknown as { nome: string } | null)?.nome ?? '—')
    }
  }

  // Group by (funcionario_id, agente_ausente_nome, posto_id, observacao)
  type Group = { first: RawCobertura; datas: string[] }
  const grouped = new Map<string, Group>()

  for (const r of coberturas) {
    const postoId = r.postos?.id ?? ''
    const key = `${r.funcionario_id}|${r.agente_ausente_nome ?? ''}|${postoId}|${r.observacao ?? ''}`
    if (!grouped.has(key)) {
      grouped.set(key, { first: r, datas: [r.data_cobertura] })
    } else {
      grouped.get(key)!.datas.push(r.data_cobertura)
    }
  }

  return Array.from(grouped.values())
    .map(({ first, datas }) => {
      datas.sort()
      const postoId = first.postos?.id ?? ''
      return {
        id:                first.id,
        supervisor:        supByPosto.get(postoId) ?? '—',
        posto_nome:        first.postos?.nome ?? '—',
        secretaria:        first.postos?.secretaria ?? '—',
        colaborador_nome:  first.funcionarios?.nome ?? '—',
        colaborador_funcao: first.funcionarios?.funcoes?.nome ?? '—',
        agente_ausente:    first.agente_ausente_nome ?? '—',
        data_inicio:       datas[0],
        dias:              datas.length,
        motivo:            first.observacao ?? '—',
      }
    })
    .sort((a, b) => a.supervisor.localeCompare(b.supervisor))
}
