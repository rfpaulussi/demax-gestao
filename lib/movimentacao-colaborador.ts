'use server'

import { createClient } from '@/lib/supabase/server'
import {
  getCodigoSetor,
  REGIME_LABELS,
  REGIME_DEFAULT,
} from './movimentacao-colaborador-constants'
import type { DadosMovColaborador } from './movimentacao-colaborador-constants'

export async function getDadosMovColaborador(
  funcionarioId: string,
  funcaoAntigaId: string | null,
  funcaoNovaId: string | null,
  movCreatedAt: string | null,
  solicitacaoId?: string | null,
): Promise<DadosMovColaborador | null> {
  const supabase = createClient()

  const dataRef = movCreatedAt ? new Date(movCreatedAt) : new Date()
  const vigencia = `01/${String(dataRef.getUTCMonth() + 1).padStart(2, '0')}/${dataRef.getUTCFullYear()}`

  // Funcionário + as duas funções em paralelo
  const [funcRes, antRes, novaRes] = await Promise.all([
    supabase
      .from('funcionarios')
      .select('nome, registro, cpf, salario_base, posto_id')
      .eq('id', funcionarioId)
      .maybeSingle(),
    funcaoAntigaId
      ? supabase.from('funcoes').select('nome, insalubridade_perc').eq('id', funcaoAntigaId).maybeSingle()
      : Promise.resolve({ data: null }),
    funcaoNovaId
      ? supabase.from('funcoes').select('nome, insalubridade_perc').eq('id', funcaoNovaId).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const func = funcRes.data as {
    nome: string; registro: string | null; cpf: string | null
    salario_base: number | null; posto_id: string | null
  } | null
  if (!func) return null

  const postoId = func.posto_id

  // Posto + supervisor + regime + motivo em paralelo
  const [postoRes, supRes, regimeRes, solRes] = await Promise.all([
    postoId
      ? supabase.from('postos').select('nome').eq('id', postoId).maybeSingle()
      : Promise.resolve({ data: null }),
    postoId
      ? supabase
          .from('config_supervisores_postos')
          .select('perfis!supervisor_id(nome)')
          .eq('posto_id', postoId)
          .eq('ativo', true)
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    postoId
      ? supabase.from('config_escalas_postos').select('regime').eq('posto_id', postoId).maybeSingle()
      : Promise.resolve({ data: null }),
    solicitacaoId
      ? supabase.from('solicitacoes').select('dados_depois').eq('id', solicitacaoId).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const postoNome    = (postoRes.data  as { nome: string }  | null)?.nome ?? null
  const supNome      = (supRes.data    as { perfis?: { nome: string | null } } | null)?.perfis?.nome ?? null
  const regimeKey    = (regimeRes.data as { regime: string } | null)?.regime ?? '5x2'
  const regime       = REGIME_LABELS[regimeKey] ?? REGIME_DEFAULT
  const solDados     = (solRes.data    as { dados_depois?: Record<string, unknown> } | null)?.dados_depois ?? null
  const motivo       = (solDados?.motivo as string | null) ?? null

  const fa = antRes.data  as { nome: string; insalubridade_perc: number } | null
  const fn = novaRes.data as { nome: string; insalubridade_perc: number } | null

  return {
    registro:  func.registro,
    nome:      func.nome,
    cpf:       func.cpf,
    salario:   func.salario_base,
    posto:     postoNome,
    supervisor: supNome,
    regime,
    funcaoAtual: {
      nome:               fa?.nome ?? null,
      codigo:             getCodigoSetor(fa?.nome),
      insalubridade:      (fa?.insalubridade_perc ?? 0) > 0,
      insalubridade_perc: fa?.insalubridade_perc ?? 0,
    },
    funcaoProposta: {
      nome:               fn?.nome ?? null,
      codigo:             getCodigoSetor(fn?.nome),
      insalubridade:      (fn?.insalubridade_perc ?? 0) > 0,
      insalubridade_perc: fn?.insalubridade_perc ?? 0,
    },
    motivo,
    vigencia,
  }
}
