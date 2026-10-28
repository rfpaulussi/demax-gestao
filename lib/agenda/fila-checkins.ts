// Fila local de check-ins feitos sem sinal. Ficam no aparelho (IndexedDB) até o servidor confirmar.
// Só é usada no cliente.

const NOME_BANCO = 'agenda-fila-checkins'
const STORE = 'checkins'

export type CheckinPendente = {
  localId: string // id gerado no aparelho: o servidor usa para não duplicar
  postoId: string
  tipo: 'entrada' | 'saida'
  latitude: number
  longitude: number
  precisaoM: number | null
  capturadoEm: string // ISO: momento do GPS
  justificativa?: string
  precisaJustificar?: boolean // servidor pediu justificativa (fora do raio)
  distancia?: number
  foto?: Blob // foto tirada enquanto o check-in estava pendente
  focoId?: string // supervisor de apoio: atividade da visita
  atividadeObs?: string
  postoNome?: string // para listar o posto enquanto o check-in não foi enviado
  recusado?: string // motivo da recusa do servidor: fica guardado (nunca apagado sozinho) até o supervisor decidir
}

function disponivel(): boolean {
  return typeof indexedDB !== 'undefined'
}

function abrir(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(NOME_BANCO, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'localId' })
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function operar<T>(modo: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await abrir()
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, modo)
    const req = fn(tx.objectStore(STORE))
    tx.oncomplete = () => { db.close(); resolve(req.result) }
    tx.onerror = () => { db.close(); reject(tx.error) }
    tx.onabort = () => { db.close(); reject(tx.error ?? new Error('Transação cancelada')) }
  })
}

/** Guarda (ou atualiza) um check-in pendente. */
export async function salvarCheckinPendente(item: CheckinPendente): Promise<void> {
  if (!disponivel()) throw new Error('Este aparelho não permite guardar o check-in localmente.')
  await operar('readwrite', store => store.put(item))
}

/** Pendentes na ordem em que foram capturados. */
export async function listarCheckinsPendentes(): Promise<CheckinPendente[]> {
  if (!disponivel()) return []
  try {
    const itens = await operar<CheckinPendente[]>('readonly', store => store.getAll())
    return itens.sort((a, b) => a.capturadoEm.localeCompare(b.capturadoEm))
  } catch {
    return []
  }
}

export async function removerCheckinPendente(localId: string): Promise<void> {
  if (!disponivel()) return
  await operar('readwrite', store => store.delete(localId))
}
