/**
 * MyRadar API Client
 *
 * Single entry-point for all data fetches.
 *
 * Priority chain (browser-side):
 *   1. Express backend at NEXT_PUBLIC_BACKEND_URL (ws://localhost:4000)
 *   2. Next.js built-in API routes at /api/myradar/*
 *   3. Local demo data (offline / no backend running)
 *
 * Server-side (API routes, SSR): uses BACKEND_URL env var directly.
 */

import type { Sensor, Shelter, RescueTeam, Alert, Incident, SyncQueueItem } from '@/types/disaster'

// ─── Config ───────────────────────────────────────────────────────────────────
// Public: readable in browser. Set to http://localhost:4000 in .env.local
const BACKEND = (
  typeof window !== 'undefined'
    ? process.env.NEXT_PUBLIC_BACKEND_URL
    : process.env.BACKEND_URL
) ?? ''

/** Build a URL that prefers the backend, falls back to the Next.js route */
function url(backendPath: string, nextPath: string): string {
  return BACKEND ? `${BACKEND}${backendPath}` : nextPath
}

// ─── Generic helpers ──────────────────────────────────────────────────────────
async function get<T>(backendPath: string, nextPath: string): Promise<T | null> {
  const endpoint = url(backendPath, nextPath)
  try {
    const res = await fetch(endpoint, {
      next: { revalidate: 0 },          // always fresh in Next.js cache
      signal: AbortSignal.timeout(6_000),
    })
    if (!res.ok) throw new Error(`GET ${endpoint} → ${res.status}`)
    const body = await res.json() as { ok: boolean; data: T }
    return body.data ?? null
  } catch (err) {
    console.warn('[apiClient GET]', endpoint, err)
    return null
  }
}

async function post<T>(backendPath: string, nextPath: string, body: unknown): Promise<T | null> {
  const endpoint = url(backendPath, nextPath)
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8_000),
    })
    if (!res.ok) throw new Error(`POST ${endpoint} → ${res.status}`)
    return (await res.json()) as T
  } catch (err) {
    console.warn('[apiClient POST]', endpoint, err)
    return null
  }
}

async function patch<T>(backendPath: string, body: unknown): Promise<T | null> {
  const endpoint = BACKEND ? `${BACKEND}${backendPath}` : `/api/myradar${backendPath}`
  try {
    const res = await fetch(endpoint, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(6_000),
    })
    if (!res.ok) throw new Error(`PATCH ${endpoint} → ${res.status}`)
    return (await res.json()) as T
  } catch (err) {
    console.warn('[apiClient PATCH]', endpoint, err)
    return null
  }
}

// ─── Health check ─────────────────────────────────────────────────────────────
export interface HealthResponse {
  status: string; service: string; timestamp: string; uptime: number; wsClients: number
}

export async function checkHealth(): Promise<HealthResponse | null> {
  return get<HealthResponse>('/api/health', '/api/myradar/summary')
}

// ─── Summary ──────────────────────────────────────────────────────────────────
export interface BackendSummary {
  severity: string; floodRisk: number; affectedPeople: number
  averageWaterLevel: number; activeIncidents: number
  blockedRoads: number; activeShelters: number; activeTeams: number
  lastUpdated: string
}

export async function fetchSummary(): Promise<BackendSummary | null> {
  return get<BackendSummary>('/api/summary', '/api/myradar/summary')
}

// ─── Sensors ──────────────────────────────────────────────────────────────────
export async function fetchSensors(): Promise<Sensor[] | null> {
  return get<Sensor[]>('/api/sensors', '/api/myradar/sensors')
}

// ─── Shelters ─────────────────────────────────────────────────────────────────
export async function fetchShelters(): Promise<Shelter[] | null> {
  return get<Shelter[]>('/api/shelters', '/api/myradar/shelters')
}

// ─── Rescue teams ─────────────────────────────────────────────────────────────
export async function fetchTeams(): Promise<RescueTeam[] | null> {
  return get<RescueTeam[]>('/api/rescue-teams', '/api/myradar/teams')
}

export async function patchTeamStatus(
  id: string, status: string, mission?: string,
): Promise<void> {
  await patch(`/api/rescue-teams/${id}/status`, { status, mission })
}

// ─── Alerts ───────────────────────────────────────────────────────────────────
export async function fetchAlerts(unackedOnly = false): Promise<Alert[] | null> {
  const q = unackedOnly ? '?unacked=true' : ''
  return get<Alert[]>(`/api/alerts${q}`, '/api/myradar/alerts')
}

export async function acknowledgeAlertRemote(id: string): Promise<void> {
  await post(`/api/alerts/${id}/acknowledge`, `/api/myradar/alerts/${id}/acknowledge`, {})
}

// ─── Incidents ────────────────────────────────────────────────────────────────
export async function fetchIncidents(): Promise<Incident[] | null> {
  return get<Incident[]>('/api/incidents', '/api/myradar/incidents')
}

export async function createIncidentRemote(
  incident: Omit<Incident, 'id' | 'reportedAt'>,
): Promise<Incident | null> {
  const res = await post<{ ok: boolean; data: Incident }>(
    '/api/incidents', '/api/myradar/incidents', incident,
  )
  return res?.data ?? null
}

// ─── Sync ─────────────────────────────────────────────────────────────────────
export interface SyncResult {
  ok: boolean; received: number; processed: number; failed: number; serverTime: string
}

export async function flushSyncQueue(
  events: SyncQueueItem[],
  deviceId = 'MYRADAR-LOCAL-01',
): Promise<SyncResult | null> {
  return post<SyncResult>(
    '/api/sync', '/api/myradar/sync',
    { events, deviceId, timestamp: new Date().toISOString() },
  )
}

// ─── AI ───────────────────────────────────────────────────────────────────────
export interface AIResult { text: string; mode: 'CLOUD' | 'LOCAL'; confidence: 'HIGH' | 'MEDIUM' | 'LOW' }

export async function queryAI(
  query: string,
  context: Record<string, unknown>,
): Promise<AIResult | null> {
  const res = await post<{ ok: boolean; data: AIResult }>(
    '/api/ai/query', '/api/myradar/ai',
    { query, context },
  )
  return res?.data ?? null
}

// ─── WebSocket live-push client ───────────────────────────────────────────────
export type WsPushMessage =
  | { type: 'SUMMARY'; data: BackendSummary }
  | { type: 'SENSORS'; data: Sensor[] }
  | { type: 'ALERT';   data: Alert }
  | { type: 'PONG' }

/**
 * Connect to the backend WebSocket and call `onMessage` for each push.
 * Returns a cleanup function.
 *
 * Falls back silently if no backend URL is configured (demo mode).
 */
export function connectLiveSocket(
  onMessage: (msg: WsPushMessage) => void,
  onStatusChange?: (connected: boolean) => void,
): () => void {
  if (!BACKEND) {
    // No backend configured — demo mode runs fully on simulation
    return () => {}
  }

  const wsUrl = BACKEND.replace(/^http/, 'ws') + '/ws'
  let ws: WebSocket | null = null
  let pingInterval: ReturnType<typeof setInterval> | null = null
  let reconnectTimeout: ReturnType<typeof setTimeout> | null = null
  let destroyed = false

  function connect() {
    if (destroyed) return
    ws = new WebSocket(wsUrl)

    ws.onopen = () => {
      console.log('[WS] connected to', wsUrl)
      onStatusChange?.(true)
      pingInterval = setInterval(() => ws?.send(JSON.stringify({ type: 'PING' })), 20_000)
    }

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as WsPushMessage
        if (msg.type !== 'PONG') onMessage(msg)
      } catch { /* ignore malformed frames */ }
    }

    ws.onclose = () => {
      console.log('[WS] disconnected — reconnecting in 3 s')
      onStatusChange?.(false)
      if (pingInterval) clearInterval(pingInterval)
      if (!destroyed) reconnectTimeout = setTimeout(connect, 3_000)
    }

    ws.onerror = (err) => {
      console.warn('[WS] error', err)
      ws?.close()
    }
  }

  connect()

  return () => {
    destroyed = true
    if (pingInterval)    clearInterval(pingInterval)
    if (reconnectTimeout)clearTimeout(reconnectTimeout)
    ws?.close()
  }
}
