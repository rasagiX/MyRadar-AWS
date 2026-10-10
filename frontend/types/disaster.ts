// ─── Core disaster domain types ───────────────────────────────────────────────

export type Severity = 'NORMAL' | 'ELEVATED' | 'HIGH' | 'CRITICAL'
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
export type NetworkStatus = 'CONNECTED' | 'SYNCING' | 'OFFLINE' | 'RECONNECTING'
export type DataMode = 'DEMO' | 'AWS'

export interface GeoPoint {
  lat: number
  lng: number
}

export interface Sensor {
  id: string
  name: string
  type: 'WATER_LEVEL' | 'RAINFALL' | 'TEMPERATURE' | 'RIVER_LEVEL' | 'AIR_QUALITY' | 'STRUCTURAL'
  location: GeoPoint
  reading: number
  unit: string
  trend: 'RISING' | 'FALLING' | 'STABLE'
  battery: number
  status: 'ONLINE' | 'OFFLINE' | 'DEGRADED'
  lastUpdated: string
  history: number[]
}

export interface Shelter {
  id: string
  name: string
  location: GeoPoint
  capacity: number
  occupancy: number
  waterLevel: number   // 0-100 %
  foodLevel: number    // 0-100 %
  medicineLevel: number // 0-100 %
  status: 'SAFE' | 'WARNING' | 'CRITICAL'
  sector: string
}

export type TeamStatus = 'AVAILABLE' | 'RESPONDING' | 'RESCUING' | 'TRANSPORTING' | 'RETURNING' | 'OFFLINE'
export type TeamType = 'URBAN_RESCUE' | 'MEDICAL' | 'FIRE' | 'POLICE' | 'DRONE' | 'LOGISTICS'

export interface RescueTeam {
  id: string
  name: string
  type: TeamType
  location: GeoPoint
  status: TeamStatus
  mission: string | null
  targetBuilding: string | null
  priority: RiskLevel | null
  battery: number      // fuel/battery %
  sector: string
}

export interface Vehicle {
  id: string
  name: string
  type: 'RELIEF' | 'AMBULANCE' | 'FIRE_TRUCK' | 'RESCUE' | 'DRONE'
  location: GeoPoint
  status: 'AVAILABLE' | 'EN_ROUTE' | 'DELIVERING' | 'RETURNING'
  cargo: string[]
  fuelLevel: number
  sector: string
}

export type RoadStatus = 'CLEAR' | 'CONGESTED' | 'BLOCKED' | 'FLOODED' | 'CLOSED'

export interface Road {
  id: string
  name: string
  from: GeoPoint
  to: GeoPoint
  status: RoadStatus
  waterDepth: number  // meters
  riskLevel: RiskLevel
  isEvacuationRoute: boolean
  blockedReason?: string
}

export interface Building {
  id: string
  name: string
  type: 'RESIDENTIAL' | 'HOSPITAL' | 'SHELTER' | 'OFFICE' | 'CRITICAL_INFRA'
  location: GeoPoint
  occupants: number
  floodDepth: number  // meters
  status: 'HEALTHY' | 'AT_RISK' | 'FLOODED' | 'CRITICAL' | 'EVACUATED'
  sector: string
  floors: number
}

export interface FloodZone {
  id: string
  name: string
  severity: Severity
  waterDepth: number   // meters
  affectedPeople: number
  expansionRate: number // m/hr
  coordinates: [number, number][]
}

export interface WasteZone {
  id: string
  type: 'DEBRIS' | 'BLOCKED_ROAD' | 'HAZARDOUS' | 'FALLEN_STRUCTURE' | 'GARBAGE'
  location: GeoPoint
  severity: RiskLevel
  description: string
  detectedAt: string
  imageUrl?: string
}

export interface SupplyCenter {
  id: string
  name: string
  location: GeoPoint
  inventory: {
    water: number    // liters
    food: number     // kg
    medicine: number // units
    blankets: number
    fuel: number     // liters
    equipment: number
  }
  status: 'OPERATIONAL' | 'LOW_STOCK' | 'CRITICAL' | 'OFFLINE'
}

export interface ReliefRequest {
  id: string
  targetId: string     // shelter or hospital id
  targetName: string
  required: string[]
  priority: RiskLevel
  assignedVehicle: string | null
  status: 'PENDING' | 'ASSIGNED' | 'EN_ROUTE' | 'DELIVERED'
  estimatedArrival?: string
}

export interface Route {
  id: string
  from: string
  to: string
  fromCoords: GeoPoint
  toCoords: GeoPoint
  waypoints: GeoPoint[]
  distance: number   // km
  etaMinutes: number
  riskLevel: RiskLevel
  type: 'EVACUATION' | 'RELIEF' | 'RESCUE'
  isBlocked: boolean
  alternativeRouteId?: string
}

export interface Alert {
  id: string
  severity: 'CRITICAL' | 'WARNING' | 'INFO' | 'RESCUE' | 'SHELTER' | 'SUPPLY'
  title: string
  message: string
  timestamp: string
  location?: GeoPoint
  acknowledged: boolean
  relatedEntityId?: string
}

export interface Incident {
  id: string
  type: 'FLOOD' | 'RESCUE_NEEDED' | 'ROAD_BLOCKED' | 'SHELTER_FULL' | 'SUPPLY_SHORTAGE' | 'SENSOR_FAILURE' | 'DEBRIS'
  severity: Severity
  location: GeoPoint
  description: string
  reportedAt: string
  resolvedAt?: string
  assignedTeam?: string
  status: 'OPEN' | 'ASSIGNED' | 'RESOLVED'
}

export interface DisasterEvent {
  id: string
  type: string
  payload: Record<string, unknown>
  timestamp: string
  deviceId: string
  version: number
  synced: boolean
}

export interface CriticalInfrastructure {
  id: string
  name: string
  type: 'HOSPITAL' | 'POWER_PLANT' | 'WATER_TREATMENT' | 'BRIDGE' | 'EMERGENCY_CENTER' | 'FUEL_DEPOT'
  location: GeoPoint
  status: 'OPERATIONAL' | 'DEGRADED' | 'OFFLINE' | 'AT_RISK'
  priority: number  // 1 = highest
}

export interface SyncQueueItem {
  id: string
  eventType: string
  payload: Record<string, unknown>
  timestamp: string
  deviceId: string
  version: number
  retryCount: number
}

// ─── Top-level disaster state ──────────────────────────────────────────────────
export interface DisasterState {
  // Meta
  severity: Severity
  floodRisk: number          // 0-100 %
  affectedPeople: number
  averageWaterLevel: number  // meters
  simulationTime: number     // seconds elapsed
  simulationRunning: boolean
  simulationSpeed: number    // 1 | 2 | 5 | 10
  networkStatus: NetworkStatus
  dataMode: DataMode
  lastSyncAt: string | null
  syncQueueCount: number
  activeIncidentCount: number

  // Entities
  sensors: Sensor[]
  shelters: Shelter[]
  rescueTeams: RescueTeam[]
  vehicles: Vehicle[]
  roads: Road[]
  buildings: Building[]
  floodZones: FloodZone[]
  wasteZones: WasteZone[]
  supplyCenters: SupplyCenter[]
  reliefRequests: ReliefRequest[]
  routes: Route[]
  alerts: Alert[]
  incidents: Incident[]
  criticalInfrastructure: CriticalInfrastructure[]
  syncQueue: SyncQueueItem[]
  /** True when the Express backend WebSocket is connected */
  backendConnected?: boolean
}
