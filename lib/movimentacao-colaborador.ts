'use server'

import { createClient } from '@/lib/supabase/server'

// ─── Lookups ──────────────────────────────────────────────────────────────────

const SETOR_PREFIXES: [string, number][] = [
  ['AGENTE DE HIGIENIZAÇÃO A', 45],
  ['AGENTE DE HIGIENIZAÇÃO B', 66],
  ['AGENTE DE HIGIENIZAÇÃO C', 67],
  ['AJUDANTE DE LIMPEZA',       1],
  ['AUXILIAR ADMINISTRATIVO',  12],
  ['ENCARREGADO',              12],
  ['JOVEM APRENDIZ',            1],
  ['LIDER DE LIMPEZA',         12],
  ['LÍDER DE LIMPEZA',         12],
  ['LIMPADOR',                 14],
  ['SUPERVISOR',               12],
]

export const REGIME_LABELS: Record<string, { escala: string; horario: string }> = {
  '5x2':   { escala: 'Segunda a Sexta',       horario: '07:00 às 17:00'          },
  '5x1':   { escala: 'Escala 5x1',            horario: 'Conforme turno do posto' },
  '12x36': { escala: '12x36',                 horario: '07:00 às 19:00'          },
}
const REGIME_DEFAULT = REGIME_LABELS['5x2']

function getCodigoSetor(nome: string | null | undefined): number | null {
  if (!nome) return null
  const n = nome.normalize('NFC').toUpperCase().trim()
  for (const [prefix, code] of SETOR_PREFIXES) {
    if (n.startsWith(prefix.normalize('NFC').toUpperCase())) return code
  }
  return null
}

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type DadosFuncaoMov = {
  nome: string | null
  codigo: number | null
  insalubridade: boolean
  insalubridade_perc: number
}

export type DadosMovColaborador = {
  registro: string | null
  nome: string
  cpf: string | null
  salario: number | null
  posto: string | null
  supervisor: string | null
  regime: { escala: string; horario: string }
  funcaoAtual: DadosFuncaoMov
  funcaoProposta: DadosFuncaoMov
  motivo: string | null
  vigencia: string
}

// ─── Server action ────────────────────────────────────────────────────────────

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
      .single(),
    funcaoAntigaId
      ? supabase.from('funcoes').select('nome, insalubridade_perc').eq('id', funcaoAntigaId).single()
      : Promise.resolve({ data: null }),
    funcaoNovaId
      ? supabase.from('funcoes').select('nome, insalubridade_perc').eq('id', funcaoNovaId).single()
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
      ? supabase.from('postos').select('nome').eq('id', postoId).single()
      : Promise.resolve({ data: null }),
    postoId
      ? supabase
          .from('config_supervisores_postos')
          .select('perfis!supervisor_id(nome)')
          .eq('posto_id', postoId)
          .eq('ativo', true)
          .limit(1)
          .single()
      : Promise.resolve({ data: null }),
    postoId
      ? supabase.from('config_escalas_postos').select('regime').eq('posto_id', postoId).single()
      : Promise.resolve({ data: null }),
    solicitacaoId
      ? supabase.from('solicitacoes').select('dados_depois').eq('id', solicitacaoId).single()
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
