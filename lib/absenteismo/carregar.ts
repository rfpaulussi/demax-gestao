// lib/absenteismo/carregar.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import { obterRegimesPorFuncionario } from '@/lib/turnos/regime-funcionario'
import { addDias } from './datas'
import type {
  AfastamentoIn, AtestadoIn, DadosAbsenteismo, FaltaIn, FeriasIn, FuncionarioCalc, SuspensaoIn,
} from './tipos'

type Pagina<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>

type FuncRow = {
  id: string
  nome: string
  registro: string | null
  status: string | null
  posto_id: string | null
  data_admissao: string | null
  data_desligamento: string | null
  postos: { nome: string; secretaria: string | null } | null
}
type FaltaRow = {
  id: string; funcionario_id: string; data_falta: string; data_fim: string | null
  dias: number; tipo: string; observacao: string | null; confirmada_em: string | null
}
type AtestadoRow = {
  id: string; funcionario_id: string; data_inicio: string; data_fim: string
  cid_codigo: string | null; sem_cid: boolean | null; motivo: string | null
}
type AfastRow = {
  id: string; funcionario_id: string; data_inicio: string
  data_fim_prevista: string | null; data_fim_real: string | null; motivo: string | null
}
type FeriasRow = { id: string; funcionario_id: string; data_inicio: string | null; data_fim: string | null }
type AdvRow = { id: string; funcionario_id: string; data_ocorrencia: string | null; dias_suspensao: number | null }
type SupRow = { posto_id: string; supervisor_id: string; perfis: { nome: string } | null }

const STATUS_FORA = ['desligado', 'rescisao_indireta']

/**
 * Carrega tudo que o motor precisa para o intervalo [inicio, fim] (pode ser vários meses, para a série).
 * Regra de quadro: status desligado/rescisão indireta SEM data de desligamento fica fora (`fora_do_quadro`).
 * Regime de cada funcionário resolvido no fim do intervalo (obterRegimesPorFuncionario).
 */
export async function carregarDados(
  supabase: SupabaseClient<Database>,
  janela: { inicio: string; fim: string },
): Promise<DadosAbsenteismo> {
  const { inicio, fim } = janela
  const folgaIni = addDias(inicio, -1)
  const folgaFim = addDias(fim, 1)

  const [funcRows, faltaRows, atestadoRows, afastRows, feriasRows, advRows, supRes, escalaRes] = await Promise.all([
    fetchAllRows<FuncRow>((from, to) =>
      supabase
        .from('funcionarios')
        .select('id, nome, registro, status, posto_id, data_admissao, data_desligamento, postos!posto_id ( nome, secretaria )')
        .or(`data_desligamento.is.null,data_desligamento.gte.${inicio}`)
        .order('id')
        .range(from, to) as unknown as Pagina<FuncRow>,
    ),
    fetchAllRows<FaltaRow>((from, to) =>
      supabase
        .from('faltas')
        .select('id, funcionario_id, data_falta, data_fim, dias, tipo, observacao, confirmada_em')
        .lte('data_falta', fim)
        .or(`data_fim.gte.${inicio},and(data_fim.is.null,data_falta.gte.${addDias(inicio, -60)})`)
        .order('id')
        .range(from, to) as unknown as Pagina<FaltaRow>,
    ),
    fetchAllRows<AtestadoRow>((from, to) =>
      supabase
        .from('atestados')
        .select('id, funcionario_id, data_inicio, data_fim, cid_codigo, sem_cid, motivo')
        .lte('data_inicio', folgaFim)
        .gte('data_fim', folgaIni)
        .order('id')
        .range(from, to) as unknown as Pagina<AtestadoRow>,
    ),
    fetchAllRows<AfastRow>((from, to) =>
      supabase
        .from('afastamentos')
        .select('id, funcionario_id, data_inicio, data_fim_prevista, data_fim_real, motivo')
        .lte('data_inicio', fim)
        .or(`data_fim_real.is.null,data_fim_real.gte.${inicio}`)
        .order('id')
        .range(from, to) as unknown as Pagina<AfastRow>,
    ),
    fetchAllRows<FeriasRow>((from, to) =>
      supabase
        .from('ferias')
        .select('id, funcionario_id, data_inicio, data_fim')
        .not('data_inicio', 'is', null)
        .not('data_fim', 'is', null)
        .not('status', 'in', '(cancelado,disponivel)')
        .lte('data_inicio', fim)
        .gte('data_fim', inicio)
        .order('id')
        .range(from, to) as unknown as Pagina<FeriasRow>,
    ),
    fetchAllRows<AdvRow>((from, to) =>
      supabase
        .from('advertencias')
        .select('id, funcionario_id, data_ocorrencia, dias_suspensao')
        .eq('grau', 'suspensao')
        .gt('dias_suspensao', 0)
        .gte('data_ocorrencia', addDias(inicio, -30))
        .lte('data_ocorrencia', fim)
        .order('id')
        .range(from, to) as unknown as Pagina<AdvRow>,
    ),
    supabase
      .from('config_supervisores_postos')
      .select('posto_id, supervisor_id, perfis!supervisor_id ( nome )')
      .eq('ativo', true),
    supabase.from('config_escalas_postos').select('posto_id, regime'),
  ])
  if (supRes.error) throw new Error(supRes.error.message)
  if (escalaRes.error) throw new Error(escalaRes.error.message)

  const supPorPosto = new Map<string, { id: string; nome: string }>()
  for (const s of (supRes.data ?? []) as unknown as SupRow[]) {
    if (!supPorPosto.has(s.posto_id)) supPorPosto.set(s.posto_id, { id: s.supervisor_id, nome: s.perfis?.nome ?? '—' })
  }
  const postoConfig = new Map<string, string>()
  for (const e of escalaRes.data ?? []) postoConfig.set(e.posto_id, e.regime)

  const postoPorFunc = new Map<string, string | null>()
  for (const f of funcRows) postoPorFunc.set(f.id, f.posto_id)
  const regimes = await obterRegimesPorFuncionario(supabase, funcRows.map(f => f.id), postoConfig, postoPorFunc, fim)

  const funcionarios: FuncionarioCalc[] = funcRows.map(f => {
    const sup = f.posto_id ? supPorPosto.get(f.posto_id) : undefined
    return {
      id: f.id,
      nome: f.nome,
      registro: f.registro,
      admissao: f.data_admissao,
      desligamento: f.data_desligamento,
      fora_do_quadro: STATUS_FORA.includes(f.status ?? '') && !f.data_desligamento,
      regime: regimes.get(f.id) ?? '5x2',
      posto_id: f.posto_id,
      posto_nome: f.postos?.nome ?? '—',
      secretaria: f.postos?.secretaria ?? '—',
      supervisor_id: sup?.id ?? null,
      supervisor: sup?.nome ?? '—',
    }
  })

  const faltas: FaltaIn[] = faltaRows.map(f => ({
    id: f.id, funcionario_id: f.funcionario_id, data_falta: f.data_falta, data_fim: f.data_fim,
    dias: f.dias, tipo: f.tipo, confirmada: f.confirmada_em !== null, observacao: f.observacao,
  }))
  const atestados: AtestadoIn[] = atestadoRows.map(a => ({
    id: a.id, funcionario_id: a.funcionario_id, data_inicio: a.data_inicio, data_fim: a.data_fim,
    cid_codigo: a.cid_codigo, sem_cid: a.sem_cid === true, motivo: a.motivo,
  }))
  const afastamentos: AfastamentoIn[] = afastRows.map(a => ({
    id: a.id, funcionario_id: a.funcionario_id, data_inicio: a.data_inicio,
    data_fim_prevista: a.data_fim_prevista, data_fim_real: a.data_fim_real, motivo: a.motivo,
  }))
  const ferias: FeriasIn[] = feriasRows.flatMap(x =>
    x.data_inicio && x.data_fim
      ? [{ id: x.id, funcionario_id: x.funcionario_id, data_inicio: x.data_inicio, data_fim: x.data_fim }]
      : [],
  )
  const suspensoes: SuspensaoIn[] = advRows.flatMap(a =>
    a.data_ocorrencia && a.dias_suspensao
      ? [{ id: a.id, funcionario_id: a.funcionario_id, data_inicio: a.data_ocorrencia, dias: a.dias_suspensao }]
      : [],
  )

  return { funcionarios, faltas, atestados, afastamentos, ferias, suspensoes }
}
