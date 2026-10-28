// Regras de mudança em agenda já publicada (compartilhadas entre servidor e telas).

/** Mudanças que o supervisor pode fazer por semana depois de publicar. Passou disso: pede aprovação da gestão. */
export const LIMITE_MUDANCAS_SEMANA = 3

export const CATEGORIAS_MOTIVO = [
  { id: 'emergencia', rotulo: 'Emergência / ocorrência no posto' },
  { id: 'ausencia', rotulo: 'Ausência ou cobertura' },
  { id: 'direcao', rotulo: 'Pedido da direção / secretaria' },
  { id: 'feriado', rotulo: 'Feriado, clima ou fechamento' },
  { id: 'outro', rotulo: 'Outro (descrever)' },
] as const

export type CategoriaMotivo = (typeof CATEGORIAS_MOTIVO)[number]['id']

/**
 * Monta o motivo gravado no bloco e na linha do tempo. Com categoria, o texto só é obrigatório em "outro".
 * Sem categoria (gestão, telas antigas), exige texto de ao menos 5 caracteres.
 */
export function montarMotivo(categoria: string | undefined, texto: string | undefined): { ok: true; motivo: string } | { ok: false; erro: string } {
  const t = (texto ?? '').trim().slice(0, 300)
  if (!categoria) {
    return t.length >= 5 ? { ok: true, motivo: t } : { ok: false, erro: 'Agenda publicada: informe o motivo' }
  }
  const cat = CATEGORIAS_MOTIVO.find(c => c.id === categoria)
  if (!cat) return { ok: false, erro: 'Motivo inválido' }
  if (cat.id === 'outro' && t.length < 5) return { ok: false, erro: 'Descreva o motivo (ao menos 5 caracteres)' }
  return { ok: true, motivo: t ? `${cat.rotulo}: ${t}` : cat.rotulo }
}

export type ResumoMudancas = {
  usadas: number
  extras: number // mudanças extras já aprovadas pela gestão
  limite: number
  pedidoPendente: boolean
}

export const restantes = (r: Pick<ResumoMudancas, 'usadas' | 'extras' | 'limite'>) => r.limite + r.extras - r.usadas
