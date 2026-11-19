// lib/absenteismo/composicao.ts
import type { ClasseTaxa } from './classificar'
import type { ResultadoCalculo } from './tipos'

export const ORDEM_CLASSES: ClasseTaxa[] = ['falta_injustificada', 'falta_justificada', 'atestado', 'outras']

export const ROTULO_CLASSE: Record<ClasseTaxa, string> = {
  falta_injustificada: 'Faltas injustificadas',
  falta_justificada: 'Faltas justificadas',
  atestado: 'Atestados médicos',
  outras: 'Outras (atrasos etc.)',
}

export interface FatiaComposicao {
  classe: ClasseTaxa
  rotulo: string
  jornadas: number
  episodios: number
  /** participação nas jornadas perdidas, em % */
  pct_jornadas: number
}

export function composicao(r: ResultadoCalculo): FatiaComposicao[] {
  const total = r.jornadas_perdidas
  return ORDEM_CLASSES.map(classe => ({
    classe,
    rotulo: ROTULO_CLASSE[classe],
    jornadas: r.perdidas_por_classe[classe],
    episodios: r.episodios_por_classe[classe],
    pct_jornadas: total > 0 ? (r.perdidas_por_classe[classe] / total) * 100 : 0,
  }))
}
