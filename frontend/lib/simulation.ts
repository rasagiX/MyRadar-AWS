import type { DisasterState, Alert, Incident, Sensor, SyncQueueItem } from '@/types/disaster'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function timeString(): string {
  return new Date().toLocaleTimeString('en-GB', { hour12: false })
}

function makeAlertId(): string {
  return `AL-${Date.now()}`
}

function makeIncidentId(): string {
  return `INC-${Date.now()}`
}

function makeSyncItem(type: string, payload: Record<string, unknown>): SyncQueueItem {
  return {
    id: `SQ-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    eventType: type,
    payload,
    timestamp: new Date().toISOString(),
    deviceId: 'NEXUS-LOCAL-01',
    version: 1,
    retryCount: 0,
  }
}

// ─── Simulation tick ──────────────────────────────────────────────────────────
// Called every second (or faster based on simulationSpeed).
// Returns an immutable copy of the updated state.
export function simulationTick(state: DisasterState): DisasterState {
  const t = state.simulationTime
  const speed = state.simulationSpeed

  // Clone top-level arrays so we don't mutate
  let sensors = state.sensors.map(s => ({ ...s }))
  let shelters = state.shelters.map(s => ({ ...s }))
  let rescueTeams = state.rescueTeams.map(r => ({ ...r }))
  let roads = state.roads.map(r => ({ ...r }))
  let buildings = state.buildings.map(b => ({ ...b }))
  let floodZones = state.floodZones.map(f => ({ ...f }))
  let alerts = [...state.alerts]
  let incidents = [...state.incidents]
  let syncQueue = [...state.syncQueue]
  const isOffline = state.networkStatus === 'OFFLINE'

  // Scale deltas by speed
  const dt = speed * 0.02  // per-second delta factor

  // ── 1. Water level sensors rise over time ─────────────────────────────────
  sensors = sensors.map(sensor => {
    if (sensor.type !== 'WATER_LEVEL') return sensor
    const rise = (Math.random() * 0.04 + 0.01) * dt
    const newReading = clamp(sensor.reading + rise, 0, 5)
    const newHistory = [...sensor.history.slice(-9), newReading]
    return {
      ...sensor,
      reading: parseFloat(newReading.toFixed(2)),
      trend: newReading > sensor.reading ? 'RISING' : 'STABLE',
      history: newHistory,
      lastUpdated: timeString(),
    }
  })

  // Rainfall sensor
  sensors = sensors.map(sensor => {
    if (sensor.type !== 'RAINFALL') return sensor
    const delta = (Math.random() * 1.5 - 0.3) * dt
    const newReading = clamp(sensor.reading + delta, 0, 120)
    return { ...sensor, reading: parseFloat(newReading.toFixed(1)), trend: delta > 0 ? 'RISING' : delta < 0 ? 'FALLING' : 'STABLE', lastUpdated: timeString() }
  })

  // Battery drain
  sensors = sensors.map(sensor => ({
    ...sensor,
    battery: clamp(sensor.battery - 0.002 * dt, 0, 100),
  }))

  // Mark sensors offline if battery dead
  sensors = sensors.map(sensor => ({
    ...sensor,
    status: sensor.battery < 5 ? 'OFFLINE' : sensor.status,
  }))

  // ── 2. Flood zones expand ─────────────────────────────────────────────────
  floodZones = floodZones.map(zone => {
    const depthIncrease = zone.expansionRate * 0.001 * dt
    const newDepth = clamp(zone.waterDepth + depthIncrease, 0, 6)
    const newSeverity = newDepth > 3 ? 'CRITICAL' : newDepth > 2 ? 'CRITICAL' : newDepth > 1 ? 'HIGH' : 'ELEVATED'
    return {
      ...zone,
      waterDepth: parseFloat(newDepth.toFixed(2)),
      affectedPeople: Math.round(zone.affectedPeople * (1 + 0.0008 * dt)),
      severity: newSeverity,
    }
  })

  // ── 3. Buildings accumulate flood depth ───────────────────────────────────
  buildings = buildings.map(building => {
    if (building.floodDepth === 0 && Math.random() > 0.002 * dt) return building
    const increase = (Math.random() * 0.05) * dt
    const newDepth = clamp(building.floodDepth + increase, 0, 4)
    const newStatus =
      newDepth > 2.5 ? 'CRITICAL' :
      newDepth > 1.5 ? 'CRITICAL' :
      newDepth > 0.5 ? 'FLOODED' :
      newDepth > 0.1 ? 'AT_RISK' : building.status
    return { ...building, floodDepth: parseFloat(newDepth.toFixed(2)), status: newStatus }
  })

  // ── 4. Shelters fill up ───────────────────────────────────────────────────
  shelters = shelters.map(shelter => {
    const occupancyIncrease = Math.round(Math.random() * 2 * dt)
    const newOccupancy = clamp(shelter.occupancy + occupancyIncrease, 0, shelter.capacity)
    const waterDrain = (0.05 + Math.random() * 0.05) * dt
    const foodDrain = (0.03 + Math.random() * 0.03) * dt
    const medDrain = (0.02 + Math.random() * 0.02) * dt
    const newWater = clamp(shelter.waterLevel - waterDrain, 0, 100)
    const newFood = clamp(shelter.foodLevel - foodDrain, 0, 100)
    const newMed = clamp(shelter.medicineLevel - medDrain, 0, 100)
    const pct = newOccupancy / shelter.capacity
    const newStatus = pct > 0.95 ? 'CRITICAL' : pct > 0.80 ? 'WARNING' : 'SAFE'
    return {
      ...shelter,
      occupancy: newOccupancy,
      waterLevel: parseFloat(newWater.toFixed(1)),
      foodLevel: parseFloat(newFood.toFixed(1)),
      medicineLevel: parseFloat(newMed.toFixed(1)),
      status: newStatus,
    }
  })

  // ── 5. Roads can get blocked ──────────────────────────────────────────────
  roads = roads.map(road => {
    if (road.status === 'FLOODED' || road.status === 'BLOCKED') return road
    if (Math.random() < 0.0003 * dt) {
      const newAlert: Alert = {
        id: makeAlertId(), severity: 'WARNING', title: 'Road Blocked',
        message: `${road.name} has become blocked due to flooding.`,
        timestamp: timeString(), acknowledged: false, relatedEntityId: road.id,
      }
      alerts = [newAlert, ...alerts.slice(0, 49)]
      if (isOffline) syncQueue = [makeSyncItem('ROAD_STATUS', { roadId: road.id, status: 'BLOCKED' }), ...syncQueue]
      return { ...road, status: 'BLOCKED' as const, blockedReason: 'Flood overflow' }
    }
    return road
  })

  // ── 6. Rescue teams drift ─────────────────────────────────────────────────
  rescueTeams = rescueTeams.map(team => {
    const drift = 0.00005 * dt
    return {
      ...team,
      location: {
        lat: team.location.lat + (Math.random() - 0.5) * drift,
        lng: team.location.lng + (Math.random() - 0.5) * drift,
      },
      battery: clamp(team.battery - 0.003 * dt, 5, 100),
    }
  })

  // ── 7. Derive aggregate stats ──────────────────────────────────────────────
  const waterSensors = sensors.filter(s => s.type === 'WATER_LEVEL')
  const avgWaterLevel = waterSensors.length
    ? parseFloat((waterSensors.reduce((a, s) => a + s.reading, 0) / waterSensors.length).toFixed(2))
    : state.averageWaterLevel

  const totalAffected = floodZones.reduce((a, z) => a + z.affectedPeople, 0)
  const maxWater = waterSensors.reduce((a, s) => Math.max(a, s.reading), 0)
  const blockedRoads = roads.filter(r => r.status === 'BLOCKED' || r.status === 'FLOODED').length
  const newFloodRisk = clamp(
    Math.round((avgWaterLevel / 4) * 80 + (blockedRoads / roads.length) * 20),
    0, 100,
  )

  const severity =
    newFloodRisk > 85 ? 'CRITICAL' :
    newFloodRisk > 65 ? 'HIGH' :
    newFloodRisk > 40 ? 'ELEVATED' : 'NORMAL'

  // ── 8. Periodic alerts ────────────────────────────────────────────────────
  if (t > 0 && t % Math.round(30 / speed) === 0) {
    const criticalShelter = shelters.find(s => s.status === 'CRITICAL')
    if (criticalShelter) {
      const newAlert: Alert = {
        id: makeAlertId(), severity: 'SHELTER', title: 'Shelter Critical',
        message: `${criticalShelter.name} is at critical capacity (${criticalShelter.occupancy}/${criticalShelter.capacity}).`,
        timestamp: timeString(), acknowledged: false, relatedEntityId: criticalShelter.id,
      }
      alerts = [newAlert, ...alerts.slice(0, 49)]
    }
  }

  if (maxWater > 3 && t % Math.round(45 / speed) === 0) {
    const newAlert: Alert = {
      id: makeAlertId(), severity: 'CRITICAL', title: 'Extreme Flood Warning',
      message: `Water sensor recording ${maxWater.toFixed(1)}m. EXTREME FLOOD CONDITIONS.`,
      timestamp: timeString(), acknowledged: false,
    }
    alerts = [newAlert, ...alerts.slice(0, 49)]
  }

  // Keep alerts capped at 50
  alerts = alerts.slice(0, 50)

  return {
    ...state,
    simulationTime: t + 1,
    sensors,
    shelters,
    rescueTeams,
    roads,
    buildings,
    floodZones,
    alerts,
    incidents,
    syncQueue,
    averageWaterLevel: avgWaterLevel,
    affectedPeople: totalAffected,
    floodRisk: newFloodRisk,
    severity,
    activeIncidentCount: incidents.filter(i => i.status !== 'RESOLVED').length,
    syncQueueCount: syncQueue.length,
  }
}

// ─── Demo button actions ──────────────────────────────────────────────────────
export function applySimulateFlood(state: DisasterState): DisasterState {
  const newAlert: Alert = {
    id: makeAlertId(), severity: 'CRITICAL', title: 'FLOOD SIMULATION ACTIVATED',
    message: 'Catastrophic flooding detected across Sectors 4 and 5. All response protocols engaged.',
    timestamp: timeString(), acknowledged: false,
  }
  return {
    ...state,
    simulationRunning: true,
    floodRisk: clamp(state.floodRisk + 25, 0, 100),
    averageWaterLevel: clamp(state.averageWaterLevel + 0.8, 0, 5),
    affectedPeople: state.affectedPeople + 3200,
    sensors: state.sensors.map(s =>
      s.type === 'WATER_LEVEL' ? { ...s, reading: clamp(s.reading + 0.8, 0, 5), trend: 'RISING' as const } : s,
    ),
    floodZones: state.floodZones.map(z => ({
      ...z, waterDepth: clamp(z.waterDepth + 0.7, 0, 6), severity: 'CRITICAL' as const, affectedPeople: Math.round(z.affectedPeople * 1.3),
    })),
    alerts: [newAlert, ...state.alerts.slice(0, 49)],
  }
}

export function applyRaiseWaterLevel(state: DisasterState): DisasterState {
  const newAlert: Alert = {
    id: makeAlertId(), severity: 'CRITICAL', title: 'Water Level Rising',
    message: 'Manual water level increase applied. All sectors notified.',
    timestamp: timeString(), acknowledged: false,
  }
  return {
    ...state,
    averageWaterLevel: clamp(state.averageWaterLevel + 0.5, 0, 5),
    sensors: state.sensors.map(s =>
      s.type === 'WATER_LEVEL' ? { ...s, reading: clamp(s.reading + 0.5, 0, 5), trend: 'RISING' as const } : s,
    ),
    alerts: [newAlert, ...state.alerts.slice(0, 49)],
  }
}

export function applyBlockRoad(state: DisasterState): DisasterState {
  const clearRoad = state.roads.find(r => r.status === 'CLEAR')
  if (!clearRoad) return state
  const newAlert: Alert = {
    id: makeAlertId(), severity: 'WARNING', title: 'Road Blocked',
    message: `${clearRoad.name} has been blocked. Evacuation routes recalculating.`,
    timestamp: timeString(), acknowledged: false, relatedEntityId: clearRoad.id,
  }
  return {
    ...state,
    roads: state.roads.map(r =>
      r.id === clearRoad.id ? { ...r, status: 'BLOCKED' as const, blockedReason: 'Emergency closure' } : r,
    ),
    alerts: [newAlert, ...state.alerts.slice(0, 49)],
  }
}

export function applyCreateRescueIncident(state: DisasterState): DisasterState {
  const newIncident: Incident = {
    id: makeIncidentId(), type: 'RESCUE_NEEDED', severity: 'CRITICAL',
    location: { lat: 40.715 + (Math.random() - 0.5) * 0.01, lng: -74.010 + (Math.random() - 0.5) * 0.01 },
    description: `New rescue incident: residents trapped in flooded structure, Sector ${Math.floor(Math.random() * 5) + 2}.`,
    reportedAt: timeString(), status: 'OPEN',
  }
  const newAlert: Alert = {
    id: makeAlertId(), severity: 'RESCUE', title: 'New Rescue Incident',
    message: newIncident.description, timestamp: timeString(), acknowledged: false, location: newIncident.location,
  }
  return {
    ...state,
    incidents: [newIncident, ...state.incidents],
    alerts: [newAlert, ...state.alerts.slice(0, 49)],
    activeIncidentCount: state.activeIncidentCount + 1,
  }
}

export function applyFillShelter(state: DisasterState): DisasterState {
  const target = state.shelters.find(s => s.status !== 'CRITICAL')
  if (!target) return state
  const newAlert: Alert = {
    id: makeAlertId(), severity: 'SHELTER', title: 'Shelter Critical',
    message: `${target.name} has reached critical capacity.`,
    timestamp: timeString(), acknowledged: false, relatedEntityId: target.id,
  }
  return {
    ...state,
    shelters: state.shelters.map(s =>
      s.id === target.id ? { ...s, occupancy: s.capacity, waterLevel: 12, foodLevel: 8, medicineLevel: 5, status: 'CRITICAL' as const } : s,
    ),
    alerts: [newAlert, ...state.alerts.slice(0, 49)],
  }
}

export function applyDetectDebris(state: DisasterState): DisasterState {
  const newWaste = {
    id: `WZ-${Date.now()}`, type: 'DEBRIS' as const,
    location: { lat: 40.714 + (Math.random() - 0.5) * 0.02, lng: -74.010 + (Math.random() - 0.5) * 0.02 },
    severity: 'HIGH' as const,
    description: `New debris zone detected via aerial scan. Area marked hazardous.`,
    detectedAt: timeString(),
  }
  const newAlert: Alert = {
    id: makeAlertId(), severity: 'WARNING', title: 'Debris Detected',
    message: `Waste Radar detected new debris zone. Hazard map updated.`,
    timestamp: timeString(), acknowledged: false, location: newWaste.location,
  }
  return {
    ...state,
    wasteZones: [newWaste, ...state.wasteZones],
    alerts: [newAlert, ...state.alerts.slice(0, 49)],
  }
}

export function applyFailInternet(state: DisasterState): DisasterState {
  return {
    ...state,
    networkStatus: 'OFFLINE',
    syncQueueCount: state.syncQueue.length,
  }
}

export function applyRestoreInternet(state: DisasterState): DisasterState {
  return {
    ...state,
    networkStatus: 'SYNCING',
  }
}

export function applyCompleteSyncInternet(state: DisasterState): DisasterState {
  return {
    ...state,
    networkStatus: 'CONNECTED',
    syncQueue: [],
    syncQueueCount: 0,
    lastSyncAt: new Date().toISOString(),
  }
}

export function applyResetScenario(state: DisasterState): DisasterState {
  // Import lazily to avoid circular deps
  const { createInitialState } = require('./mockData')
  const fresh = createInitialState()
  return {
    ...fresh,
    networkStatus: state.networkStatus,
    dataMode: state.dataMode,
  }
}

export function applyQueueOfflineEvent(state: DisasterState, type: string, payload: Record<string, unknown>): DisasterState {
  const item = makeSyncItem(type, payload)
  const newQueue = [item, ...state.syncQueue]
  return { ...state, syncQueue: newQueue, syncQueueCount: newQueue.length }
}
