/**
 * Offline sync queue.
 * Events created while offline are stored here.
 * On reconnect, processQueue() replays them against the AWS layer.
 */

import { dbPut, dbGetAll, dbDelete, dbClear } from './database'
import type { SyncQueueItem } from '@/types/disaster'

export async function enqueue(item: SyncQueueItem): Promise<void> {
  await dbPut('syncQueue', item)
}

export async function enqueueMany(items: SyncQueueItem[]): Promise<void> {
  for (const item of items) {
    await dbPut('syncQueue', item)
  }
}

export async function dequeue(id: string): Promise<void> {
  await dbDelete('syncQueue', id)
}

export async function getAllQueued(): Promise<SyncQueueItem[]> {
  return dbGetAll<SyncQueueItem>('syncQueue')
}

export async function clearQueue(): Promise<void> {
  await dbClear('syncQueue')
}

/** Process the queue against a handler function (called per item). */
export async function processQueue(
  handler: (item: SyncQueueItem) => Promise<void>,
  onProgress?: (processed: number, total: number) => void,
): Promise<{ processed: number; failed: number }> {
  const items = await getAllQueued()
  let processed = 0
  let failed = 0
  for (const item of items) {
    try {
      await handler(item)
      await dequeue(item.id)
      processed++
      onProgress?.(processed, items.length)
    } catch {
      failed++
      // Increment retry count and re-save
      await dbPut('syncQueue', { ...item, retryCount: item.retryCount + 1 })
    }
  }
  return { processed, failed }
}
