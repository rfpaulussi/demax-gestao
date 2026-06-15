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
export const REGIME_DEFAULT = REGIME_LABELS['5x2']

export function getCodigoSetor(nome: string | null | undefined): number | null {
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
