import { addDias } from '../acordos/tempo'
import { pascoa } from './pascoa'

export type TipoFeriado = 'nacional' | 'estadual' | 'municipal' | 'facultativo'

export interface FeriadoItem {
  data: string
  nome: string
  tipo: TipoFeriado
  ate_hora: string | null
  base_legal: string | null
}

const item = (
  data: string, nome: string, tipo: TipoFeriado, base_legal: string | null = null, ate_hora: string | null = null,
): FeriadoItem => ({ data, nome, tipo, ate_hora, base_legal })

/** Feriados de lei (nacionais, estadual, municipais). Não inclui pontos facultativos. */
export function gerarFeriadosDoAno(ano: number): FeriadoItem[] {
  const y = String(ano)
  return [
    item(`${y}-01-01`, 'Confraternização Universal', 'nacional', 'Lei Federal 662/49'),
    item(addDias(pascoa(ano), -2), 'Paixão de Cristo (Sexta-feira Santa)', 'municipal', 'Lei Municipal 3.433/89'),
    item(`${y}-04-21`, 'Tiradentes', 'nacional', 'Lei Federal 662/49'),
    item(`${y}-05-01`, 'Dia do Trabalho', 'nacional', 'Lei Federal 662/49'),
    item(`${y}-07-09`, 'Revolução Constitucionalista', 'estadual', 'Lei Estadual SP'),
    item(`${y}-07-26`, "N. Sra. de Sant'Ana (padroeira)", 'municipal', 'Lei Municipal 3.433/89'),
    item(`${y}-09-01`, 'Aniversário da Cidade', 'municipal', 'Lei Municipal 3.433/89'),
    item(`${y}-09-07`, 'Independência do Brasil', 'nacional', 'Lei Federal 662/49'),
    item(`${y}-10-12`, 'Nossa Senhora Aparecida', 'nacional', 'Lei Federal 6.802/80'),
    item(`${y}-11-02`, 'Finados', 'nacional', 'Lei Federal 662/49'),
    item(`${y}-11-15`, 'Proclamação da República', 'nacional', 'Lei Federal 662/49'),
    item(`${y}-11-20`, 'Dia da Consciência Negra', 'nacional', 'Lei Federal 14.759/2023 e Lei Municipal 3.433/89'),
    item(`${y}-12-25`, 'Natal', 'nacional', 'Lei Federal 662/49'),
  ]
}

const DEC = 'Decreto Municipal 24.034/2025'

/** Pontos facultativos da Prefeitura em 2026. CONFERIR NO DECRETO ORIGINAL antes de aplicar em produção. */
export const FACULTATIVOS_2026: FeriadoItem[] = [
  item('2026-01-02', 'Ponto facultativo', 'facultativo', DEC),
  item('2026-02-16', 'Ponto facultativo (Carnaval)', 'facultativo', DEC),
  item('2026-02-17', 'Ponto facultativo (Carnaval)', 'facultativo', DEC),
  item('2026-02-18', 'Ponto facultativo (Quarta-feira de Cinzas)', 'facultativo', DEC, '13:00'),
  item('2026-04-20', 'Ponto facultativo', 'facultativo', DEC),
  item('2026-06-04', 'Corpus Christi (consta no calendário administrativo)', 'facultativo', DEC),
  item('2026-06-05', 'Ponto facultativo', 'facultativo', DEC),
  item('2026-07-10', 'Ponto facultativo', 'facultativo', DEC),
  item('2026-08-31', 'Ponto facultativo', 'facultativo', DEC),
  item('2026-10-30', 'Dia do Servidor Público (consta no calendário administrativo)', 'facultativo', DEC),
  item('2026-12-24', 'Ponto facultativo', 'facultativo', DEC),
  item('2026-12-31', 'Ponto facultativo', 'facultativo', DEC),
]

/** Feriados de lei do ano + facultativos conhecidos desse ano (hoje só 2026). */
export function feriadosParaAno(ano: number): FeriadoItem[] {
  return [...gerarFeriadosDoAno(ano), ...(ano === 2026 ? FACULTATIVOS_2026 : [])]
}
