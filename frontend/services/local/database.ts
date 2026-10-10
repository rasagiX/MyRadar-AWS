/**
 * Local IndexedDB wrapper for offline-first persistence.
 * All reads/writes go through this module so the rest of the app
 * never touches IDB directly.
 */

const DB_NAME = 'nexus-disaster-db'
const DB_VERSION = 1

const STORES = [
  'roads', 'buildings', 'shelters', 'rescueTeams', 'vehicles',
  'supplies', 'incidents', 'sensors', 'floodZones', 'wasteZones',
  'criticalInfrastructure', 'routes', 'alerts', 'syncQueue', 'meta',
] as const

export type StoreName = typeof STORES[number]

let _db: IDBDatabase | null = null

function openDB(): Promise<IDBDatabase> {
  if (_db) return Promise.resolve(_db)
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      for (const name of STORES) {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath: 'id' })
        }
      }
    }
    request.onsuccess = (event) => {
      _db = (event.target as IDBOpenDBRequest).result
      resolve(_db)
    }
    request.onerror = () => reject(request.error)
  })
}

export async function dbPut<T extends { id: string }>(store: StoreName, item: T): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite')
    tx.objectStore(store).put(item)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function dbPutMany<T extends { id: string }>(store: StoreName, items: T[]): Promise<void> {
  if (items.length === 0) return
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite')
    const os = tx.objectStore(store)
    for (const item of items) os.put(item)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function dbGet<T>(store: StoreName, id: string): Promise<T | undefined> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly')
    const req = tx.objectStore(store).get(id)
    req.onsuccess = () => resolve(req.result as T | undefined)
    req.onerror = () => reject(req.error)
  })
}

export async function dbGetAll<T>(store: StoreName): Promise<T[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly')
    const req = tx.objectStore(store).getAll()
    req.onsuccess = () => resolve(req.result as T[])
    req.onerror = () => reject(req.error)
  })
}

export async function dbDelete(store: StoreName, id: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite')
    tx.objectStore(store).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function dbClear(store: StoreName): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite')
    tx.objectStore(store).clear()
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

/** Persist a top-level metadata value (e.g. lastSyncAt) */
export async function dbSetMeta(key: string, value: unknown): Promise<void> {
  await dbPut('meta', { id: key, value })
}

export async function dbGetMeta<T>(key: string): Promise<T | undefined> {
  const row = await dbGet<{ id: string; value: T }>('meta', key)
  return row?.value
}
