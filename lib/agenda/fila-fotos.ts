// Fila local de fotos de check-in que não subiram por falta de sinal.
// Guardada no navegador (IndexedDB): a foto fica no aparelho até o envio confirmar.
// Só é usada no cliente.

const NOME_BANCO = 'agenda-fila-fotos'
const STORE = 'fotos'

export type FotoPendente = { checkinId: string; blob: Blob; criadoEm: number }

function disponivel(): boolean {
  return typeof indexedDB !== 'undefined'
}

function abrir(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(NOME_BANCO, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'checkinId' })
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

/** Guarda a foto de um check-in para envio posterior. Uma foto por check-in (a última vale). */
export async function salvarFotoPendente(checkinId: string, blob: Blob): Promise<void> {
  if (!disponivel()) throw new Error('Este aparelho não permite guardar a foto localmente.')
  const item: FotoPendente = { checkinId, blob, criadoEm: Date.now() }
  await operar('readwrite', store => store.put(item))
}

export async function listarFotosPendentes(): Promise<FotoPendente[]> {
  if (!disponivel()) return []
  try {
    return await operar<FotoPendente[]>('readonly', store => store.getAll())
  } catch {
    return []
  }
}

export async function removerFotoPendente(checkinId: string): Promise<void> {
  if (!disponivel()) return
  await operar('readwrite', store => store.delete(checkinId))
}
