// Justificativa de visita planejada sem check-in ("Fechar o dia"). Compartilhado entre servidor e telas.

export const TIPOS_JUSTIFICATIVA = [
  { id: 'fui_sem_registro', rotulo: 'Fui ao posto, mas não registrei o check-in', exigeTexto: true },
  { id: 'emergencia', rotulo: 'Emergência / ocorrência em outro posto', exigeTexto: false },
  { id: 'ausencia', rotulo: 'Ausência ou cobertura', exigeTexto: false },
  { id: 'direcao', rotulo: 'Pedido da direção / secretaria', exigeTexto: false },
  { id: 'feriado', rotulo: 'Feriado, clima ou posto fechado', exigeTexto: false },
  { id: 'outro', rotulo: 'Outro (descrever)', exigeTexto: true },
] as const

export type TipoJustificativa = (typeof TIPOS_JUSTIFICATIVA)[number]['id']

export const ROTULO_JUSTIFICATIVA: Record<string, string> = Object.fromEntries(TIPOS_JUSTIFICATIVA.map(t => [t.id, t.rotulo]))

/** Rótulo curto para gráficos e tabelas. */
export const ROTULO_CURTO_JUSTIFICATIVA: Record<string, string> = {
  fui_sem_registro: 'Foi, mas não registrou',
  emergencia: 'Emergência / ocorrência',
  ausencia: 'Ausência ou cobertura',
  direcao: 'Pedido da direção',
  feriado: 'Feriado, clima ou fechado',
  outro: 'Outro motivo',
  sem_motivo: 'Sem justificativa',
}

export const exigeTextoJustificativa = (tipo: string) => TIPOS_JUSTIFICATIVA.find(t => t.id === tipo)?.exigeTexto ?? false

/** Dias para trás em que o supervisor ainda pode justificar (além de hoje). */
export const DIAS_PARA_JUSTIFICAR = 6
