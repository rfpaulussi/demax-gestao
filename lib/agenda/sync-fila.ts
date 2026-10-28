// Envio das filas offline (check-ins e fotos guardados no aparelho). Só é usada no cliente.
// Roda em qualquer tela do sistema (ver SincronizadorOffline), não só na agenda.

import { anexarFotoCheckin, registrarCheckin } from '@/app/(admin)/agenda/geo-actions'
import { listarFotosPendentes, removerFotoPendente, salvarFotoPendente } from '@/lib/agenda/fila-fotos'
import { listarCheckinsPendentes, removerCheckinPendente, salvarCheckinPendente, type CheckinPendente } from '@/lib/agenda/fila-checkins'
import { comTempoLimite } from '@/lib/agenda/rede'

/** Disparado em `window` ao fim de cada rodada de envio: quem mostra a fila atualiza a tela. */
export const EVENTO_FILA = 'agenda-fila-atualizada'
export type DetalheEventoFila = { enviou: boolean; falhas: string[] }

/** Envia a foto de um check-in. Lança erro se não chegar ao servidor (sem sinal ou tempo limite). */
export async function enviarFotoCheckin(checkinId: string, blob: Blob): Promise<{ ok: true } | { ok: false; erro: string }> {
  const fd = new FormData()
  fd.append('checkinId', checkinId)
  fd.append('foto', new File([blob], 'foto.jpg', { type: 'image/jpeg' }))
  return comTempoLimite(anexarFotoCheckin(fd))
}

/** Envia os check-ins guardados sem sinal, na ordem em que foram feitos. Para no primeiro erro de rede. */
async function processarCheckins(): Promise<{ enviou: boolean; falhas: string[] }> {
  const itens = await listarCheckinsPendentes()
  const falhas: string[] = []
  let enviou = false
  for (const item of itens) {
    if (item.recusado) continue // recusado: aguarda decisão do supervisor
    if (item.precisaJustificar && !item.justificativa) continue // aguarda o supervisor justificar
    let r: Awaited<ReturnType<typeof registrarCheckin>>
    try {
      r = await comTempoLimite(registrarCheckin({
        postoId: item.postoId, tipo: item.tipo, latitude: item.latitude, longitude: item.longitude,
        precisaoM: item.precisaoM, justificativa: item.justificativa, localId: item.localId, capturadoEm: item.capturadoEm,
      }))
    } catch {
      break // ainda sem sinal: o check-in continua guardado
    }
    if (r.ok) {
      enviou = true
      await removerCheckinPendente(item.localId)
      if (item.foto) {
        try {
          const rf = await enviarFotoCheckin(r.checkinId, item.foto)
          if (!rf.ok && !/já tem foto/i.test(rf.erro)) falhas.push(rf.erro)
        } catch {
          await salvarFotoPendente(r.checkinId, item.foto) // foto segue na fila de fotos
        }
      }
    } else if (r.precisaJustificar) {
      await salvarCheckinPendente({ ...item, precisaJustificar: true, distancia: r.distancia, justificativa: undefined })
    } else {
      // Recusado pelo servidor: não insiste, mas também não apaga. Fica visível com o motivo.
      await salvarCheckinPendente({ ...item, recusado: r.erro })
    }
  }
  return { enviou, falhas }
}

/** Envia as fotos guardadas sem sinal. Para no primeiro erro de rede e tenta de novo depois. */
async function processarFotos(): Promise<{ enviou: boolean; falhas: string[] }> {
  const itens = await listarFotosPendentes()
  const falhas: string[] = []
  let enviou = false
  for (const item of itens) {
    let r: { ok: true } | { ok: false; erro: string }
    try {
      r = await enviarFotoCheckin(item.checkinId, item.blob)
    } catch {
      break // ainda sem sinal: a foto continua guardada
    }
    if (r.ok) enviou = true
    else if (!/já tem foto/i.test(r.erro)) falhas.push(r.erro)
    await removerFotoPendente(item.checkinId) // enviada, ou recusada pelo servidor (não adianta insistir)
  }
  return { enviou, falhas }
}

let sincronizando = false

/**
 * Uma rodada de envio das duas filas. Só uma roda por vez em toda a página (a agenda e o sincronizador
 * global chamam a mesma função). Devolve null se já havia outra rodada ou se o armazenamento local falhou.
 */
export async function sincronizarFilas(): Promise<DetalheEventoFila | null> {
  if (sincronizando) return null
  sincronizando = true
  try {
    const c = await processarCheckins()
    const f = await processarFotos()
    const detalhe: DetalheEventoFila = { enviou: c.enviou || f.enviou, falhas: [...c.falhas, ...f.falhas] }
    window.dispatchEvent(new CustomEvent<DetalheEventoFila>(EVENTO_FILA, { detail: detalhe }))
    return detalhe
  } catch {
    return null // IndexedDB indisponível: nada a reenviar
  } finally {
    sincronizando = false
  }
}

/** Libera um check-in recusado para nova tentativa (ex.: depois de acertar o relógio do aparelho). */
export async function tentarDeNovo(item: CheckinPendente): Promise<void> {
  await salvarCheckinPendente({ ...item, recusado: undefined })
  window.dispatchEvent(new CustomEvent<DetalheEventoFila>(EVENTO_FILA, { detail: { enviou: false, falhas: [] } }))
  void sincronizarFilas()
}

/** Descarta de vez um check-in guardado (decisão do supervisor). */
export async function descartarCheckin(localId: string): Promise<void> {
  await removerCheckinPendente(localId)
  window.dispatchEvent(new CustomEvent<DetalheEventoFila>(EVENTO_FILA, { detail: { enviou: false, falhas: [] } }))
}
