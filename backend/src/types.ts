// Shared domain types mirrored from the frontend (kept in sync manually).
// In a monorepo setup these would live in packages/shared.

export type Severity    = 'NORMAL' | 'ELEVATED' | 'HIGH' | 'CRITICAL'
export type RiskLevel   = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
export type NetworkStatus = 'CONNECTED' | 'SYNCING' | 'OFFLINE' | 'RECONNECTING'

export interface GeoPoint { lat: number; lng: number }

export interface Sensor {
  id: string; name: string
  type: 'WATER_LEVEL'|'RAINFALL'|'TEMPERATURE'|'RIVER_LEVEL'|'AIR_QUALITY'|'STRUCTURAL'
  location: GeoPoint; reading: number; unit: string
  trend: 'RISING'|'FALLING'|'STABLE'; battery: number
  status: 'ONLINE'|'OFFLINE'|'DEGRADED'; lastUpdated: string; history: number[]
}

export interface Shelter {
  id: string; name: string; location: GeoPoint
  capacity: number; occupancy: number
  waterLevel: number; foodLevel: number; medicineLevel: number
  status: 'SAFE'|'WARNING'|'CRITICAL'; sector: string
}

export interface RescueTeam {
  id: string; name: string
  type: 'URBAN_RESCUE'|'MEDICAL'|'FIRE'|'POLICE'|'DRONE'|'LOGISTICS'
  location: GeoPoint; status: 'AVAILABLE'|'RESPONDING'|'RESCUING'|'TRANSPORTING'|'RETURNING'|'OFFLINE'
  mission: string|null; targetBuilding: string|null; priority: RiskLevel|null
  battery: number; sector: string
}

export interface Alert {
  id: string; severity: 'CRITICAL'|'WARNING'|'INFO'|'RESCUE'|'SHELTER'|'SUPPLY'
  title: string; message: string; timestamp: string
  location?: GeoPoint; acknowledged: boolean; relatedEntityId?: string
}

export interface Incident {
  id: string; type: string; severity: Severity
  location: GeoPoint; description: string; reportedAt: string
  resolvedAt?: string; assignedTeam?: string; status: 'OPEN'|'ASSIGNED'|'RESOLVED'
}

export interface SyncQueueItem {
  id: string; eventType: string; payload: Record<string,unknown>
  timestamp: string; deviceId: string; version: number; retryCount: number
}

export interface SyncPayload {
  events: SyncQueueItem[]
  deviceId: string
  timestamp: string
}

export interface DisasterSummary {
  severity: Severity
  floodRisk: number
  affectedPeople: number
  averageWaterLevel: number
  activeIncidents: number
  blockedRoads: number
  activeShelters: number
  activeTeams: number
  lastUpdated: string
}

export interface AIQueryRequest { query: string; context: Record<string,unknown> }
export interface AIQueryResponse { text: string; mode: 'CLOUD'|'LOCAL'; confidence: 'HIGH'|'MEDIUM'|'LOW' }
