// Motivo da visita extra (fora do plano do dia), informado pelo supervisor comum no check-in.
// Compartilhado entre servidor e telas. Mesmo padrão de lib/agenda/justificativas.ts.

export const TIPOS_MOTIVO_EXTRA = [
  { id: 'reposicao', rotulo: 'Reposição de visita planejada', exigeTexto: false },
  { id: 'emergencia', rotulo: 'Emergência / ocorrência', exigeTexto: false },
  { id: 'direcao', rotulo: 'Pedido da direção / secretaria', exigeTexto: false },
  { id: 'cobertura', rotulo: 'Cobertura de posto', exigeTexto: false },
  { id: 'outro', rotulo: 'Outro (descrever)', exigeTexto: true },
] as const

export type MotivoExtra = (typeof TIPOS_MOTIVO_EXTRA)[number]['id']

export const ROTULO_MOTIVO_EXTRA: Record<string, string> = Object.fromEntries(TIPOS_MOTIVO_EXTRA.map(m => [m.id, m.rotulo]))

export const exigeTextoMotivoExtra = (motivo: string) => TIPOS_MOTIVO_EXTRA.find(m => m.id === motivo)?.exigeTexto ?? false
