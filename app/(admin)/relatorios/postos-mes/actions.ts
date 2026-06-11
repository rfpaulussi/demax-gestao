'use server'

import { createClient } from '@/lib/supabase/server'

export interface EfetivoMesRow {
  funcionario_id: string
  nome: string
  cpf: string | null
  funcao: string
  status: string
  posto_id: string
  posto_nome: string
  secretaria: string
  supervisor: string
}

function lastDay(mes: number, ano: number): string {
  const d = new Date(ano, mes, 0)
  return `${ano}-${String(mes).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export async function buscarEfetivoMes(mes: number, ano: number): Promise<EfetivoMesRow[]> {
  const supabase = createClient()

  const inicio = `${ano}-${String(mes).padStart(2, '0')}-01`
  const fim    = lastDay(mes, ano)

  // Employees active during the month
  const { data: funcs } = await supabase
    .from('funcionarios')
    .select('id, nome, cpf, funcao_id, posto_id, status, data_admissao, data_desligamento, funcoes!funcao_id(nome)')
    .lte('data_admissao', fim)
    .or(`data_desligamento.is.null,data_desligamento.gte.${inicio}`)
    .order('nome')
    .range(0, 1499)

  if (!funcs || funcs.length === 0) return []

  const ids = funcs.map(f => f.id)

  // Get most recent posto change per employee up to fim
  const [{ data: historico }, { data: postos }, { data: configs }] = await Promise.all([
    supabase
      .from('historico_funcionarios')
      .select('funcionario_id, data_evento, dados_novos')
      .eq('tipo', 'mudanca_posto')
      .lte('data_evento', fim)
      .in('funcionario_id', ids)
      .order('data_evento', { ascending: false }),
    supabase.from('postos').select('id, nome, secretaria'),
    supabase
      .from('config_supervisores_postos')
      .select('posto_id, perfis!supervisor_id(nome)')
      .eq('ativo', true),
  ])

  // Latest posto change per funcionario (already sorted DESC)
  const postoOverride = new Map<string, string>()
  for (const h of historico ?? []) {
    if (!postoOverride.has(h.funcionario_id)) {
      const pid = (h.dados_novos as { posto_id?: string } | null)?.posto_id
      if (pid) postoOverride.set(h.funcionario_id, pid)
    }
  }

  const postoById = new Map<string, { nome: string; secretaria: string | null }>(
    (postos ?? []).map(p => [p.id, { nome: p.nome, secretaria: p.secretaria }])
  )

  const supByPosto = new Map<string, string>()
  for (const c of configs ?? []) {
    if (!supByPosto.has(c.posto_id)) {
      supByPosto.set(c.posto_id, (c.perfis as unknown as { nome: string } | null)?.nome ?? '—')
    }
  }

  return funcs.map(f => {
    const postoId = postoOverride.get(f.id) ?? f.posto_id ?? ''
    const posto   = postoById.get(postoId)
    return {
      funcionario_id: f.id,
      nome: f.nome,
      cpf: f.cpf,
      funcao: (f.funcoes as unknown as { nome: string } | null)?.nome ?? '—',
      status: f.status ?? '—',
      posto_id: postoId,
      posto_nome: posto?.nome ?? '—',
      secretaria: posto?.secretaria ?? '—',
      supervisor: supByPosto.get(postoId) ?? '—',
    }
  })
}
