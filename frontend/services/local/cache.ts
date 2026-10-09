/**
 * In-memory + IndexedDB cache for disaster state.
 * Used to hydrate the UI when the app starts offline.
 */

import { dbPutMany, dbGetAll, dbSetMeta, dbGetMeta, dbClear } from './database'
import type { DisasterState } from '@/types/disaster'

type CacheKey = keyof DisasterState

const CACHEABLE_ARRAYS: Array<keyof DisasterState> = [
  'sensors', 'shelters', 'rescueTeams', 'vehicles',
  'roads', 'buildings', 'floodZones', 'wasteZones',
  'supplyCenters', 'reliefRequests', 'routes', 'alerts',
  'incidents', 'criticalInfrastructure',
]

const STORE_MAP: Record<string, string> = {
  sensors: 'sensors',
  shelters: 'shelters',
  rescueTeams: 'rescueTeams',
  vehicles: 'vehicles',
  roads: 'roads',
  buildings: 'buildings',
  floodZones: 'floodZones',
  wasteZones: 'wasteZones',
  supplyCenters: 'supplies',
  reliefRequests: 'incidents',   // reuse store
  routes: 'routes',
  alerts: 'alerts',
  incidents: 'incidents',
  criticalInfrastructure: 'criticalInfrastructure',
}

/** Persist a snapshot of the entire state to IndexedDB */
export async function persistState(state: DisasterState): Promise<void> {
  try {
    await Promise.all(
      CACHEABLE_ARRAYS.map(async (key) => {
        const storeKey = STORE_MAP[key as string] as import('./database').StoreName
        const items = state[key] as Array<{ id: string }>
        if (storeKey && Array.isArray(items)) {
          await dbClear(storeKey)
          await dbPutMany(storeKey, items)
        }
      }),
    )
    await dbSetMeta('lastSnapshot', {
      severity: state.severity,
      floodRisk: state.floodRisk,
      affectedPeople: state.affectedPeople,
      averageWaterLevel: state.averageWaterLevel,
      lastSyncAt: state.lastSyncAt,
      savedAt: new Date().toISOString(),
    })
  } catch {
    // Silently fail - offline cache is best-effort
  }
}

/** Restore state fragments from IndexedDB */
export async function restoreState(): Promise<Partial<DisasterState> | null> {
  try {
    const [sensors, shelters, rescueTeams, vehicles, roads, buildings,
      floodZones, wasteZones, routes, alerts, criticalInfrastructure] = await Promise.all([
      dbGetAll('sensors'),
      dbGetAll('shelters'),
      dbGetAll('rescueTeams'),
      dbGetAll('vehicles'),
      dbGetAll('roads'),
      dbGetAll('buildings'),
      dbGetAll('floodZones'),
      dbGetAll('wasteZones'),
      dbGetAll('routes'),
      dbGetAll('alerts'),
      dbGetAll('criticalInfrastructure'),
    ])

    const meta = await dbGetMeta<{ severity: string; floodRisk: number; affectedPeople: number; averageWaterLevel: number }>('lastSnapshot')

    if (sensors.length === 0) return null

    return {
      sensors: sensors as DisasterState['sensors'],
      shelters: shelters as DisasterState['shelters'],
      rescueTeams: rescueTeams as DisasterState['rescueTeams'],
      vehicles: vehicles as DisasterState['vehicles'],
      roads: roads as DisasterState['roads'],
      buildings: buildings as DisasterState['buildings'],
      floodZones: floodZones as DisasterState['floodZones'],
      wasteZones: wasteZones as DisasterState['wasteZones'],
      routes: routes as DisasterState['routes'],
      alerts: alerts as DisasterState['alerts'],
      criticalInfrastructure: criticalInfrastructure as DisasterState['criticalInfrastructure'],
      ...(meta ?? {}),
    } as Partial<DisasterState>
  } catch {
    return null
  }
}
