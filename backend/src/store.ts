/**
 * In-memory store for the backend.
 * In production this would be backed by DynamoDB + Timestream.
 * All mutating operations here mirror the frontend simulation
 * so the backend can serve a consistent picture to multiple clients.
 */

import { v4 as uuid } from 'uuid'
import type {
  Sensor, Shelter, RescueTeam, Alert, Incident,
  SyncQueueItem, DisasterSummary, Severity,
} from './types.js'

// ─── Seed data ────────────────────────────────────────────────────────────────

const sensors: Sensor[] = [
  { id:'W-01', name:'Mithi River Sensor',     type:'WATER_LEVEL', location:{lat:19.076,lng:72.877}, reading:2.8, unit:'m',     trend:'RISING', battery:82, status:'ONLINE',   lastUpdated:ts(), history:[1.2,1.6,2.0,2.4,2.8] },
  { id:'W-02', name:'Adyar River Sensor',     type:'WATER_LEVEL', location:{lat:13.052,lng:80.250}, reading:3.1, unit:'m',     trend:'RISING', battery:68, status:'ONLINE',   lastUpdated:ts(), history:[1.5,1.9,2.3,2.7,3.1] },
  { id:'W-03', name:'Ganga Flood Sensor',     type:'WATER_LEVEL', location:{lat:25.594,lng:85.137}, reading:4.2, unit:'m',     trend:'RISING', battery:74, status:'ONLINE',   lastUpdated:ts(), history:[2.5,2.9,3.4,3.8,4.2] },
  { id:'W-04', name:'Brahmaputra Sensor',     type:'WATER_LEVEL', location:{lat:26.144,lng:91.736}, reading:5.1, unit:'m',     trend:'RISING', battery:55, status:'ONLINE',   lastUpdated:ts(), history:[3.0,3.5,4.0,4.6,5.1] },
  { id:'W-05', name:'Hooghly River Sensor',   type:'WATER_LEVEL', location:{lat:22.572,lng:88.363}, reading:2.4, unit:'m',     trend:'STABLE', battery:90, status:'ONLINE',   lastUpdated:ts(), history:[2.1,2.2,2.3,2.4,2.4] },
  { id:'R-01', name:'IMD Rainfall Mumbai',    type:'RAINFALL',    location:{lat:19.120,lng:72.860}, reading:92.4,unit:'mm/hr', trend:'RISING', battery:71, status:'ONLINE',   lastUpdated:ts(), history:[45,58,70,82,92]  },
  { id:'T-01', name:'Temp Sensor Delhi',      type:'TEMPERATURE', location:{lat:28.613,lng:77.209}, reading:34.2,unit:'°C',   trend:'STABLE', battery:95, status:'ONLINE',   lastUpdated:ts(), history:[32,33,34,34.1,34.2]},
  { id:'S-01', name:'Howrah Bridge Sensor',   type:'STRUCTURAL',  location:{lat:22.585,lng:88.347}, reading:76.4,unit:'%',    trend:'FALLING',battery:48, status:'DEGRADED', lastUpdated:ts(), history:[95,90,86,81,76]   },
]

const shelters: Shelter[] = [
  { id:'SH-01', name:'NSCI Dome Mumbai',            location:{lat:19.018,lng:72.856}, capacity:5000, occupancy:3840, waterLevel:65, foodLevel:58, medicineLevel:42, status:'WARNING',  sector:'Mumbai'   },
  { id:'SH-02', name:'Jawaharlal Nehru Stadium',    location:{lat:13.005,lng:80.252}, capacity:8000, occupancy:4200, waterLevel:72, foodLevel:68, medicineLevel:61, status:'SAFE',     sector:'Chennai'  },
  { id:'SH-03', name:'Patna Sahib Relief Camp',     location:{lat:25.619,lng:85.144}, capacity:3000, occupancy:2860, waterLevel:28, foodLevel:32, medicineLevel:21, status:'CRITICAL', sector:'Patna'    },
  { id:'SH-04', name:'Guwahati Sports Complex',     location:{lat:26.155,lng:91.720}, capacity:2500, occupancy:980,  waterLevel:88, foodLevel:82, medicineLevel:76, status:'SAFE',     sector:'Guwahati' },
  { id:'SH-05', name:'Salt Lake Stadium Kolkata',   location:{lat:22.578,lng:88.397}, capacity:6000, occupancy:5820, waterLevel:19, foodLevel:24, medicineLevel:16, status:'CRITICAL', sector:'Kolkata'  },
  { id:'SH-06', name:'Barabati Stadium Cuttack',    location:{lat:20.469,lng:85.882}, capacity:4000, occupancy:2100, waterLevel:84, foodLevel:78, medicineLevel:70, status:'SAFE',     sector:'Odisha'   },
]

const rescueTeams: RescueTeam[] = [
  { id:'NDRF-01', name:'NDRF Battalion 4 Mumbai',  type:'URBAN_RESCUE', location:{lat:19.076,lng:72.877}, status:'RESCUING',    mission:'Dharavi slum extraction',        targetBuilding:'B-02', priority:'CRITICAL', battery:68, sector:'Mumbai'   },
  { id:'NDRF-02', name:'NDRF Battalion 2 Patna',   type:'URBAN_RESCUE', location:{lat:25.594,lng:85.137}, status:'RESCUING',    mission:'Ganga embankment breach rescue', targetBuilding:'B-06', priority:'CRITICAL', battery:72, sector:'Patna'    },
  { id:'NDRF-03', name:'NDRF Battalion 6 Assam',   type:'URBAN_RESCUE', location:{lat:26.144,lng:91.736}, status:'RESPONDING',  mission:'Brahmaputra island evacuation',  targetBuilding:null,   priority:'HIGH',     battery:81, sector:'Guwahati' },
  { id:'SDRF-01', name:'SDRF Maharashtra',         type:'MEDICAL',      location:{lat:19.025,lng:72.842}, status:'RESPONDING',  mission:'Medical triage Bandra',          targetBuilding:null,   priority:'HIGH',     battery:76, sector:'Mumbai'   },
  { id:'SDRF-03', name:'SDRF West Bengal',         type:'URBAN_RESCUE', location:{lat:22.572,lng:88.363}, status:'AVAILABLE',   mission:null,                             targetBuilding:null,   priority:null,       battery:95, sector:'Kolkata'  },
  { id:'ARMY-02', name:'Army Rescue Helicopter 1', type:'DRONE',        location:{lat:26.200,lng:91.700}, status:'RESCUING',    mission:'Aerial survey Brahmaputra',      targetBuilding:null,   priority:'HIGH',     battery:44, sector:'Guwahati' },
  { id:'COAST-01',name:'Coast Guard Mumbai',       type:'URBAN_RESCUE', location:{lat:18.922,lng:72.834}, status:'RESCUING',    mission:'Marine Drive flood rescue',      targetBuilding:null,   priority:'CRITICAL', battery:62, sector:'Mumbai'   },
]

const alerts: Alert[] = [
  { id:'AL-01', severity:'CRITICAL', title:'Water Level Critical',    message:'Water level exceeded 2.5m in Sector 4. Immediate evacuation required.', timestamp:ts(), acknowledged:false, relatedEntityId:'FZ-01' },
  { id:'AL-02', severity:'WARNING',  title:'Road Blocked',            message:'RD-02 blocked by debris. Evacuation routes recalculated.',               timestamp:ts(), acknowledged:false, relatedEntityId:'RD-02' },
  { id:'AL-03', severity:'RESCUE',   title:'Rescue Operation Active', message:'Team R-07 assigned to Building 19. Critical extraction in progress.',    timestamp:ts(), acknowledged:false, relatedEntityId:'R-07'  },
  { id:'AL-04', severity:'SHELTER',  title:'Shelter Capacity Warning',message:'West Park Shelter at 98% capacity. Overflow protocol activated.',         timestamp:ts(), acknowledged:false, relatedEntityId:'SH-05' },
  { id:'AL-05', severity:'SUPPLY',   title:'Critical Supply Shortage',message:'SH-05 water supply at 18%. Relief vehicle dispatched.',                  timestamp:ts(), acknowledged:false, relatedEntityId:'SH-05' },
]

const incidents: Incident[] = [
  { id:'INC-01', type:'RESCUE_NEEDED',   severity:'CRITICAL', location:{lat:40.715,lng:-74.010}, description:'Residents trapped in Building 19, Sector 4. Water depth 1.8m.', reportedAt:ts(), assignedTeam:'R-01', status:'ASSIGNED' },
  { id:'INC-02', type:'FLOOD',           severity:'CRITICAL', location:{lat:40.710,lng:-74.015}, description:'Water treatment plant flooded. Critical infrastructure at risk.',  reportedAt:ts(), status:'OPEN' },
  { id:'INC-03', type:'ROAD_BLOCKED',    severity:'HIGH',     location:{lat:40.716,lng:-74.018}, description:'Sector 5 access route blocked by fallen structure.',               reportedAt:ts(), status:'OPEN' },
  { id:'INC-04', type:'SHELTER_FULL',    severity:'HIGH',     location:{lat:40.728,lng:-74.019}, description:'West Park Shelter approaching full capacity.',                     reportedAt:ts(), status:'ASSIGNED' },
  { id:'INC-05', type:'RESCUE_NEEDED',   severity:'CRITICAL', location:{lat:40.713,lng:-74.008}, description:'Residents trapped in Building 22, flood depth 2.1m.',             reportedAt:ts(), assignedTeam:'R-07', status:'ASSIGNED' },
]

const syncQueue: SyncQueueItem[] = []

// ─── Live counters ────────────────────────────────────────────────────────────
let averageWaterLevel = 3.2
let floodRisk = 78
let affectedPeople = 1734000
let severity: Severity = 'CRITICAL'

// Simulate slow drift so backend values are always slightly different from reset
setInterval(() => {
  sensors.forEach(s => {
    if (s.type === 'WATER_LEVEL') {
      s.reading = parseFloat((s.reading + (Math.random() * 0.02 - 0.005)).toFixed(2))
      s.trend   = s.reading > 2 ? 'RISING' : 'STABLE'
      s.history = [...s.history.slice(-9), s.reading]
      s.lastUpdated = ts()
    }
    s.battery = Math.max(0, s.battery - 0.001)
  })
  const wl = sensors.filter(s => s.type === 'WATER_LEVEL')
  averageWaterLevel = parseFloat((wl.reduce((a,s) => a + s.reading, 0) / (wl.length||1)).toFixed(2))
  floodRisk = Math.min(100, Math.round((averageWaterLevel / 4) * 80 + 10))
  affectedPeople = Math.round(affectedPeople * (1 + 0.0001))
  severity = floodRisk > 85 ? 'CRITICAL' : floodRisk > 65 ? 'HIGH' : floodRisk > 40 ? 'ELEVATED' : 'NORMAL'
}, 2000)

// ─── Accessors & mutators ─────────────────────────────────────────────────────
export function getSummary(): DisasterSummary {
  return {
    severity, floodRisk, affectedPeople, averageWaterLevel,
    activeIncidents: incidents.filter(i => i.status !== 'RESOLVED').length,
    blockedRoads: 3,
    activeShelters: shelters.filter(s => s.status !== 'CRITICAL').length,
    activeTeams: rescueTeams.filter(t => t.status !== 'AVAILABLE' && t.status !== 'OFFLINE').length,
    lastUpdated: new Date().toISOString(),
  }
}

export function getSensors()      { return sensors }
export function getShelters()     { return shelters }
export function getRescueTeams()  { return rescueTeams }
export function getAlerts()       { return [...alerts].sort((a,b) => b.timestamp.localeCompare(a.timestamp)) }
export function getIncidents()    { return incidents }
export function getSyncQueue()    { return syncQueue }

export function acknowledgeAlert(id: string): boolean {
  const a = alerts.find(x => x.id === id)
  if (!a) return false
  a.acknowledged = true
  return true
}

export function updateTeamStatus(id: string, status: RescueTeam['status'], mission?: string): boolean {
  const t = rescueTeams.find(x => x.id === id)
  if (!t) return false
  t.status  = status
  t.mission = mission ?? t.mission
  return true
}

export function createIncident(data: Omit<Incident,'id'|'reportedAt'>): Incident {
  const incident: Incident = { ...data, id: `INC-${uuid().slice(0,6).toUpperCase()}`, reportedAt: ts() }
  incidents.push(incident)
  // Create matching alert
  alerts.unshift({ id:`AL-${uuid().slice(0,6).toUpperCase()}`, severity:'RESCUE', title:'New Incident', message:data.description, timestamp:ts(), acknowledged:false })
  return incident
}

export function processSyncEvents(items: SyncQueueItem[]): number {
  let processed = 0
  for (const item of items) {
    try {
      switch (item.eventType) {
        case 'TEAM_STATUS_UPDATE': {
          const { teamId, status, mission } = item.payload as { teamId:string; status:RescueTeam['status']; mission?:string }
          updateTeamStatus(teamId, status, mission)
          break
        }
        case 'ROAD_STATUS': {
          // Road status updates – just log for now, add road store if needed
          break
        }
        default:
          break
      }
      processed++
    } catch { /* log in production */ }
  }
  return processed
}

export function buildAIContext() {
  const s = getSummary()
  return {
    severity: s.severity, floodRisk: s.floodRisk, affectedPeople: s.affectedPeople,
    averageWaterLevel: s.averageWaterLevel, activeIncidents: s.activeIncidents,
    blockedRoads: s.blockedRoads,
    shelterSummary: shelters.map(x => `${x.name}: ${x.occupancy}/${x.capacity} (${x.status})`).join('; '),
    rescueTeamSummary: rescueTeams.map(x => `${x.id}: ${x.status}${x.mission ? ' — '+x.mission:''}`).join('; '),
    topAlerts: alerts.filter(a => !a.acknowledged).slice(0,5).map(a => `[${a.severity}] ${a.message}`),
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function ts() { return new Date().toLocaleTimeString('en-GB', { hour12:false }) }
