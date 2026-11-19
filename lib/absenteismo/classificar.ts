// lib/absenteismo/classificar.ts
// Camada de mapeamento gerencial. Não altera nenhum registro de origem.

/** Classes que entram na taxa de absenteísmo (ausência não programada). */
export type ClasseTaxa = 'falta_injustificada' | 'falta_justificada' | 'atestado' | 'outras'

/** Classes de disponibilidade: ficam FORA da taxa (aba Disponibilidade). */
export type ClasseDisponibilidade =
  | 'afastamento_inss'
  | 'licenca_legal'
  | 'afastamento_outros'
  | 'atestado_prolongado'
  | 'ferias'

export type ClasseFalta = ClasseTaxa | 'suspensao'

/** Dias de atestado pagos pela empresa; do 16º dia em diante é previdenciário. Igual a DIAS_COBERTURA_ATESTADO do fechamento. */
export const LIMITE_DIAS_ATESTADO_EMPRESA = 15

const FALTA_MAP: Record<string, ClasseFalta> = {
  sem_justificativa: 'falta_injustificada',
  falta_injustificada: 'falta_injustificada',
  sem_atestado: 'falta_injustificada',
  justificada: 'falta_justificada',
  falta_justificada: 'falta_justificada',
  declaracao: 'falta_justificada',
  com_atestado: 'falta_justificada',
  atraso: 'outras',
  suspensao: 'suspensao',
}

export function classificarFalta(tipo: string): ClasseFalta {
  return FALTA_MAP[tipo] ?? 'outras'
}

function normalizar(texto: string | null): string {
  return (texto ?? '')
    .normalize('NFD')
    .toLowerCase()
    .replace(/[^\x00-\x7f]/g, '') // NFD separa o acento da letra; tira todo char não ASCII (inclui os acentos)
    .replace(/[^a-z0-9]+/g, ' ') // qualquer separador (hífen, barra, pontuação) vira um espaço
    .trim()
}

export function classificarAfastamento(
  motivo: string | null,
): 'afastamento_inss' | 'licenca_legal' | 'afastamento_outros' {
  const m = normalizar(motivo)
  if (/\binss\b/.test(m)) return 'afastamento_inss'
  if (/maternidade|paternidade/.test(m)) return 'licenca_legal'
  return 'afastamento_outros'
}
