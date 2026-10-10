/**
 * Amazon Location Service abstraction — maps, geocoding, routing.
 *
 * In DEMO mode: uses local Dijkstra routing (services/local/routing.ts).
 * In AWS mode: calls Amazon Location Service route calculator via API.
 *
 * The abstraction ensures the UI never cares which backend provides routes.
 */

import { calculateLocalRoute, scoreRoute } from '@/services/local/routing'
import type { Route, Road, GeoPoint } from '@/types/disaster'

const IS_DEMO = process.env.NEXT_PUBLIC_DATA_MODE !== 'aws'
const ENABLE_LOCATION = process.env.NEXT_PUBLIC_ENABLE_LOCATION === 'true'
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '/api/nexus'

export async function calculateRoute(
  from: GeoPoint,
  to: GeoPoint,
  roads: Road[],
  type: Route['type'] = 'EVACUATION',
  offline = false,
): Promise<Route | null> {
  // Always use local routing in demo or offline mode
  if (IS_DEMO || !ENABLE_LOCATION || offline) {
    return calculateLocalRoute(from, to, roads, type)
  }

  try {
    const res = await fetch(`${API_BASE}/route`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, type }),
      signal: AbortSignal.timeout(8_000),
    })
    if (!res.ok) throw new Error(`Location API ${res.status}`)
    return res.json() as Promise<Route>
  } catch {
    // Graceful degradation to local routing
    return calculateLocalRoute(from, to, roads, type)
  }
}

export { scoreRoute }
