/**
 * IndexedDB cache layer for offline-first persistence.
 *
 * persistState()  — snapshot current DisasterState to IDB (called every ~5 s + on key changes)
 * restoreState()  — hydrate state from IDB on app load (returns null if nothing cached)
 *
 * Step coverage:
 *   Step 3 — restoreState() hydrates app after reload while offline
 *   Step 4/5 — incidents array is persisted; survives reload
 */

import { dbPutMany, dbGetAll, dbSetMeta, dbGetMeta, dbClear, dbPut } from './database'
import type { DisasterState, Incident, SyncQueueItem } from '@/types/disaster'
import type { StoreName } from './database'

// ── Which arrays to cache and which IDB store to use ─────────────────────────
// NOTE: reliefRequests and incidents both need separate IDB stores
// so they don't overwrite each other.
const CACHE_MAP: Array<{ key: keyof DisasterState; store: StoreName }> = [
  { key: 'sensors',               store: 'sensors'               },
  { key: 'shelters',              store: 'shelters'               },
  { key: 'rescueTeams',           store: 'rescueTeams'            },
  { key: 'vehicles',              store: 'vehicles'               },
  { key: 'roads',                 store: 'roads'                  },
  { key: 'buildings',             store: 'buildings'              },
  { key: 'floodZones',            store: 'floodZones'             },
  { key: 'wasteZones',            store: 'wasteZones'             },
  { key: 'routes',                store: 'routes'                 },
  { key: 'alerts',                store: 'alerts'                 },
  { key: 'incidents',             store: 'incidents'              },
  { key: 'criticalInfrastructure',store: 'criticalInfrastructure' },
]

/** Write the full disaster state snapshot to IndexedDB. */
export async function persistState(state: DisasterState): Promise<void> {
  try {
    await Promise.all(
      CACHE_MAP.map(async ({ key, store }) => {
        const items = state[key] as Array<{ id: string }> | undefined
        if (!Array.isArray(items)) return
        await dbClear(store)
        if (items.length > 0) await dbPutMany(store, items)
      }),
    )

    // Persist sync queue separately (additive, not replaced)
    for (const item of state.syncQueue) {
      await dbPut('syncQueue', item)
    }

    await dbSetMeta('lastSnapshot', {
      severity:           state.severity,
      floodRisk:          state.floodRisk,
      affectedPeople:     state.affectedPeople,
      averageWaterLevel:  state.averageWaterLevel,
      activeIncidentCount:state.activeIncidentCount,
      lastSyncAt:         state.lastSyncAt,
      savedAt:            new Date().toISOString(),
    })
  } catch (err) {
    // Best-effort — never crash the UI
    console.warn('[cache] persistState failed:', err)
  }
}

/** Persist a single new incident immediately (step 4/5). */
export async function persistIncident(incident: Incident): Promise<void> {
  try {
    await dbPut('incidents', incident)
  } catch (err) {
    console.warn('[cache] persistIncident failed:', err)
  }
}

/** Persist a single sync queue item immediately (step 6). */
export async function persistSyncItem(item: SyncQueueItem): Promise<void> {
  try {
    await dbPut('syncQueue', item)
  } catch (err) {
    console.warn('[cache] persistSyncItem failed:', err)
  }
}

// ── Restore ───────────────────────────────────────────────────────────────────

interface SnapshotMeta {
  severity: string
  floodRisk: number
  affectedPeople: number
  averageWaterLevel: number
  activeIncidentCount: number
  lastSyncAt: string | null
  savedAt: string
}

/** Read back all cached state from IndexedDB. Returns null if nothing is cached. */
export async function restoreState(): Promise<Partial<DisasterState> | null> {
  try {
    const [
      sensors, shelters, rescueTeams, vehicles,
      roads, buildings, floodZones, wasteZones,
      routes, alerts, incidents, criticalInfrastructure,
      syncQueue, meta,
    ] = await Promise.all([
      dbGetAll<DisasterState['sensors'][number]>           ('sensors'),
      dbGetAll<DisasterState['shelters'][number]>          ('shelters'),
      dbGetAll<DisasterState['rescueTeams'][number]>       ('rescueTeams'),
      dbGetAll<DisasterState['vehicles'][number]>          ('vehicles'),
      dbGetAll<DisasterState['roads'][number]>             ('roads'),
      dbGetAll<DisasterState['buildings'][number]>         ('buildings'),
      dbGetAll<DisasterState['floodZones'][number]>        ('floodZones'),
      dbGetAll<DisasterState['wasteZones'][number]>        ('wasteZones'),
      dbGetAll<DisasterState['routes'][number]>            ('routes'),
      dbGetAll<DisasterState['alerts'][number]>            ('alerts'),
      dbGetAll<Incident>                                   ('incidents'),
      dbGetAll<DisasterState['criticalInfrastructure'][number]>('criticalInfrastructure'),
      dbGetAll<SyncQueueItem>                              ('syncQueue'),
      dbGetMeta<SnapshotMeta>                              ('lastSnapshot'),
    ])

    // If there's nothing stored, signal to start fresh
    if (sensors.length === 0 && incidents.length === 0) return null

    return {
      sensors,
      shelters,
      rescueTeams,
      vehicles,
      roads,
      buildings,
      floodZones,
      wasteZones,
      routes,
      alerts,
      incidents,
      criticalInfrastructure,
      syncQueue,
      syncQueueCount:      syncQueue.length,
      // Restore scalar meta if available
      ...(meta ? {
        severity:            meta.severity as DisasterState['severity'],
        floodRisk:           meta.floodRisk,
        affectedPeople:      meta.affectedPeople,
        averageWaterLevel:   meta.averageWaterLevel,
        activeIncidentCount: meta.activeIncidentCount,
        lastSyncAt:          meta.lastSyncAt,
      } : {}),
    }
  } catch (err) {
    console.warn('[cache] restoreState failed:', err)
    return null
  }
}

/** Clear everything — called by Reset Scenario. */
export async function clearCache(): Promise<void> {
  try {
    await Promise.all(
      CACHE_MAP.map(({ store }) => dbClear(store)),
    )
    await dbClear('syncQueue')
    await dbClear('meta')
  } catch {
    // Best-effort
  }
}
