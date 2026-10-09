/**
 * DynamoDB data service — proxied through Next.js API routes.
 * Never calls AWS SDK directly from the browser.
 */

import type { Shelter, RescueTeam, Incident, Alert, SyncQueueItem } from '@/types/disaster'

async function apiPost<T>(path: string, body: unknown): Promise<T | null> {
  try {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(6_000),
    })
    if (!res.ok) throw new Error(`${path} → ${res.status}`)
    return res.json() as Promise<T>
  } catch (err) {
    console.warn('[dynamodb proxy]', err)
    return null
  }
}

async function apiPatch<T>(path: string, body: unknown): Promise<T | null> {
  try {
    const res = await fetch(path, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(6_000),
    })
    if (!res.ok) throw new Error(`${path} → ${res.status}`)
    return res.json() as Promise<T>
  } catch (err) {
    console.warn('[dynamodb proxy patch]', err)
    return null
  }
}

export async function saveShelter(s: Shelter)          { await apiPost('/api/myradar/shelters', s) }
export async function saveRescueTeam(t: RescueTeam)    { await apiPatch('/api/myradar/teams', { id: t.id, status: t.status, mission: t.mission }) }
export async function saveIncident(i: Incident)        { await apiPost('/api/myradar/summary', i) }
export async function saveAlert(a: Alert)              { void a /* alerts written by simulation */ }

export async function syncEvents(events: SyncQueueItem[]): Promise<void> {
  await apiPost('/api/myradar/sync', {
    events,
    deviceId:  'MYRADAR-LOCAL-01',
    timestamp: new Date().toISOString(),
  })
}

/** Fetch live server summary (used by SyncPanel + background polling) */
export async function fetchServerSummary(): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch('/api/myradar/summary', { signal: AbortSignal.timeout(4_000) })
    if (!res.ok) return null
    const { data } = await res.json() as { data: Record<string, unknown> }
    return data
  } catch {
    return null
  }
}
