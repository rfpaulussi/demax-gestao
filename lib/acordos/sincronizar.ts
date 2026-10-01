export interface MovExistente { id: string; funcionario_id: string; data: string; minutos: number; papel: string; status: string }
export interface MovNovo { funcionario_id: string; data: string; minutos: number; papel: 'origem' | 'quitacao' }

export interface PlanoSincronizacao {
  apagar: string[]
  atualizar: { id: string; minutos: number }[]
  inserir: MovNovo[]
  /** Movimentos já cumpridos/verificados que a edição alteraria ("AAAA-MM-DD (status)"). Se houver, nada deve ser salvo. */
  travados: string[]
}

const chave = (m: { funcionario_id: string; data: string; papel: string }) => `${m.funcionario_id}|${String(m.data).slice(0, 10)}|${m.papel}`

/**
 * Compara os movimentos gravados com os que a edição gera. Só mexe nos 'previsto';
 * qualquer outro status (cumprido, não cumprido, dispensado) é intocável.
 */
export function planejarSincronizacao(existentes: MovExistente[], novos: MovNovo[]): PlanoSincronizacao {
  const novosPorChave = new Map(novos.map(m => [chave(m), m]))
  const existentesPorChave = new Map(existentes.map(m => [chave(m), m]))
  const plano: PlanoSincronizacao = { apagar: [], atualizar: [], inserir: [], travados: [] }
  for (const e of existentes) {
    const n = novosPorChave.get(chave(e))
    const mudou = !n || n.minutos !== e.minutos
    if (!mudou) continue
    if (e.status !== 'previsto') { plano.travados.push(`${String(e.data).slice(0, 10)} (${e.status})`); continue }
    if (!n) plano.apagar.push(e.id)
    else plano.atualizar.push({ id: e.id, minutos: n.minutos })
  }
  plano.inserir = novos.filter(m => !existentesPorChave.has(chave(m)))
  return plano
}
