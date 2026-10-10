/**
 * MyRadar India — Mock disaster data
 *
 * Scenario: Severe flooding across multiple Indian states during monsoon season.
 * Affected regions: Mumbai (Maharashtra), Chennai (Tamil Nadu), Kolkata (West Bengal),
 * Patna (Bihar), Guwahati (Assam), Bhubaneswar (Odisha), Hyderabad (Telangana)
 *
 * All coordinates are real Indian city locations.
 */

import type {
  Sensor, Shelter, RescueTeam, Vehicle, Road, Building,
  FloodZone, WasteZone, SupplyCenter, ReliefRequest, Route,
  Alert, Incident, CriticalInfrastructure, DisasterState,
} from '@/types/disaster'

// ─── Sensors — placed at flood-prone river deltas and coastal cities ──────────
export const INITIAL_SENSORS: Sensor[] = [
  // Mumbai — Mithi River flooding
  { id: 'W-01', name: 'Mithi River Sensor',        type: 'WATER_LEVEL', location: { lat: 19.076, lng: 72.877 }, reading: 2.8, unit: 'm', trend: 'RISING',  battery: 82, status: 'ONLINE',   lastUpdated: '14:30:00', history: [1.2, 1.6, 2.0, 2.4, 2.8] },
  // Chennai — Adyar River
  { id: 'W-02', name: 'Adyar River Sensor',         type: 'WATER_LEVEL', location: { lat: 13.052, lng: 80.250 }, reading: 3.1, unit: 'm', trend: 'RISING',  battery: 68, status: 'ONLINE',   lastUpdated: '14:31:00', history: [1.5, 1.9, 2.3, 2.7, 3.1] },
  // Patna — Ganga River
  { id: 'W-03', name: 'Ganga Flood Sensor',         type: 'WATER_LEVEL', location: { lat: 25.594, lng: 85.137 }, reading: 4.2, unit: 'm', trend: 'RISING',  battery: 74, status: 'ONLINE',   lastUpdated: '14:32:00', history: [2.5, 2.9, 3.4, 3.8, 4.2] },
  // Guwahati — Brahmaputra
  { id: 'W-04', name: 'Brahmaputra Sensor',         type: 'WATER_LEVEL', location: { lat: 26.144, lng: 91.736 }, reading: 5.1, unit: 'm', trend: 'RISING',  battery: 55, status: 'ONLINE',   lastUpdated: '14:33:00', history: [3.0, 3.5, 4.0, 4.6, 5.1] },
  // Kolkata — Hooghly River
  { id: 'W-05', name: 'Hooghly River Sensor',       type: 'WATER_LEVEL', location: { lat: 22.572, lng: 88.363 }, reading: 2.4, unit: 'm', trend: 'STABLE',  battery: 90, status: 'ONLINE',   lastUpdated: '14:29:00', history: [2.1, 2.2, 2.3, 2.4, 2.4] },
  // Bhubaneswar — Mahanadi
  { id: 'W-06', name: 'Mahanadi Delta Sensor',      type: 'WATER_LEVEL', location: { lat: 20.296, lng: 85.824 }, reading: 3.7, unit: 'm', trend: 'RISING',  battery: 62, status: 'ONLINE',   lastUpdated: '14:34:00', history: [2.0, 2.5, 3.0, 3.4, 3.7] },
  // Hyderabad — Hussain Sagar
  { id: 'W-07', name: 'Musi River Sensor',          type: 'WATER_LEVEL', location: { lat: 17.385, lng: 78.486 }, reading: 1.9, unit: 'm', trend: 'RISING',  battery: 78, status: 'ONLINE',   lastUpdated: '14:31:30', history: [0.8, 1.1, 1.4, 1.7, 1.9] },
  // Nationwide rainfall
  { id: 'R-01', name: 'IMD Rainfall Mumbai',        type: 'RAINFALL',    location: { lat: 19.120, lng: 72.860 }, reading: 92.4, unit: 'mm/hr', trend: 'RISING', battery: 71, status: 'ONLINE', lastUpdated: '14:31:50', history: [45, 58, 70, 82, 92] },
  { id: 'R-02', name: 'IMD Rainfall Chennai',       type: 'RAINFALL',    location: { lat: 13.080, lng: 80.270 }, reading: 78.2, unit: 'mm/hr', trend: 'RISING', battery: 65, status: 'ONLINE', lastUpdated: '14:30:20', history: [30, 45, 58, 68, 78] },
  // Temperature
  { id: 'T-01', name: 'Temp Sensor Delhi',          type: 'TEMPERATURE', location: { lat: 28.613, lng: 77.209 }, reading: 34.2, unit: '°C',    trend: 'STABLE', battery: 95, status: 'ONLINE', lastUpdated: '14:30:30', history: [32, 33, 34, 34.1, 34.2] },
  // Structural — key bridges
  { id: 'S-01', name: 'Howrah Bridge Sensor',       type: 'STRUCTURAL',  location: { lat: 22.585, lng: 88.347 }, reading: 76.4, unit: '%',     trend: 'FALLING',battery: 48, status: 'DEGRADED',lastUpdated: '14:28:11', history: [95, 90, 86, 81, 76] },
  // Air quality
  { id: 'A-01', name: 'Air Quality Mumbai',         type: 'AIR_QUALITY', location: { lat: 19.060, lng: 72.860 }, reading: 168,  unit: 'AQI',   trend: 'RISING', battery: 82, status: 'ONLINE', lastUpdated: '14:31:00', history: [90, 110, 130, 150, 168] },
]

// ─── Shelters — real school/stadium locations across flood-hit cities ─────────
export const INITIAL_SHELTERS: Shelter[] = [
  { id: 'SH-01', name: 'NSCI Dome Mumbai',              location: { lat: 19.018, lng: 72.856 }, capacity: 5000, occupancy: 3840, waterLevel: 65, foodLevel: 58, medicineLevel: 42, status: 'WARNING',  sector: 'Mumbai' },
  { id: 'SH-02', name: 'Jawaharlal Nehru Stadium',      location: { lat: 13.005, lng: 80.252 }, capacity: 8000, occupancy: 4200, waterLevel: 72, foodLevel: 68, medicineLevel: 61, status: 'SAFE',     sector: 'Chennai' },
  { id: 'SH-03', name: 'Patna Sahib Relief Camp',       location: { lat: 25.619, lng: 85.144 }, capacity: 3000, occupancy: 2860, waterLevel: 28, foodLevel: 32, medicineLevel: 21, status: 'CRITICAL', sector: 'Patna' },
  { id: 'SH-04', name: 'Guwahati Sports Complex',       location: { lat: 26.155, lng: 91.720 }, capacity: 2500, occupancy: 980,  waterLevel: 88, foodLevel: 82, medicineLevel: 76, status: 'SAFE',     sector: 'Guwahati' },
  { id: 'SH-05', name: 'Salt Lake Stadium Kolkata',     location: { lat: 22.578, lng: 88.397 }, capacity: 6000, occupancy: 5820, waterLevel: 19, foodLevel: 24, medicineLevel: 16, status: 'CRITICAL', sector: 'Kolkata' },
  { id: 'SH-06', name: 'Barabati Stadium Cuttack',      location: { lat: 20.469, lng: 85.882 }, capacity: 4000, occupancy: 2100, waterLevel: 84, foodLevel: 78, medicineLevel: 70, status: 'SAFE',     sector: 'Odisha' },
  { id: 'SH-07', name: 'Hyderabad Exhibition Centre',   location: { lat: 17.421, lng: 78.460 }, capacity: 3500, occupancy: 1240, waterLevel: 91, foodLevel: 87, medicineLevel: 83, status: 'SAFE',     sector: 'Hyderabad' },
  { id: 'SH-08', name: 'Varanasi Relief Centre',        location: { lat: 25.320, lng: 83.005 }, capacity: 2000, occupancy: 1780, waterLevel: 45, foodLevel: 38, medicineLevel: 29, status: 'WARNING',  sector: 'Varanasi' },
]

// ─── Rescue Teams ─────────────────────────────────────────────────────────────
export const INITIAL_RESCUE_TEAMS: RescueTeam[] = [
  { id: 'NDRF-01', name: 'NDRF Battalion 4 Mumbai',   type: 'URBAN_RESCUE', location: { lat: 19.076, lng: 72.877 }, status: 'RESCUING',   mission: 'Dharavi slum extraction',     targetBuilding: 'B-03', priority: 'CRITICAL', battery: 68, sector: 'Mumbai' },
  { id: 'NDRF-02', name: 'NDRF Battalion 2 Patna',    type: 'URBAN_RESCUE', location: { lat: 25.594, lng: 85.137 }, status: 'RESCUING',   mission: 'Ganga embankment breach rescue', targetBuilding: 'B-06', priority: 'CRITICAL', battery: 72, sector: 'Patna' },
  { id: 'NDRF-03', name: 'NDRF Battalion 6 Assam',    type: 'URBAN_RESCUE', location: { lat: 26.144, lng: 91.736 }, status: 'RESPONDING', mission: 'Brahmaputra island evacuation', targetBuilding: null,   priority: 'HIGH',     battery: 81, sector: 'Guwahati' },
  { id: 'SDRF-01', name: 'SDRF Maharashtra',          type: 'MEDICAL',      location: { lat: 19.025, lng: 72.842 }, status: 'RESPONDING', mission: 'Medical triage Bandra',       targetBuilding: null,   priority: 'HIGH',     battery: 76, sector: 'Mumbai' },
  { id: 'SDRF-02', name: 'SDRF Tamil Nadu',           type: 'FIRE',         location: { lat: 13.082, lng: 80.270 }, status: 'AVAILABLE',  mission: null,                          targetBuilding: null,   priority: null,       battery: 95, sector: 'Chennai' },
  { id: 'SDRF-03', name: 'SDRF West Bengal',          type: 'URBAN_RESCUE', location: { lat: 22.572, lng: 88.363 }, status: 'TRANSPORTING',mission: 'Evacuating Howrah residents', targetBuilding: null,   priority: 'HIGH',     battery: 54, sector: 'Kolkata' },
  { id: 'ARMY-01', name: 'Army Corps of Engineers 1', type: 'LOGISTICS',    location: { lat: 25.610, lng: 85.150 }, status: 'RETURNING',  mission: 'SH-03 supply delivery done',  targetBuilding: null,   priority: 'LOW',      battery: 38, sector: 'Patna' },
  { id: 'ARMY-02', name: 'Army Rescue Helicopter 1',  type: 'DRONE',        location: { lat: 26.200, lng: 91.700 }, status: 'RESCUING',   mission: 'Aerial survey Brahmaputra',   targetBuilding: null,   priority: 'HIGH',     battery: 44, sector: 'Guwahati' },
  { id: 'COAST-01',name: 'Coast Guard Mumbai',        type: 'URBAN_RESCUE', location: { lat: 18.922, lng: 72.834 }, status: 'RESCUING',   mission: 'Marine Drive flood rescue',   targetBuilding: null,   priority: 'CRITICAL', battery: 62, sector: 'Mumbai' },
  { id: 'FIRE-01', name: 'Mumbai Fire Brigade',       type: 'FIRE',         location: { lat: 19.040, lng: 72.860 }, status: 'RESPONDING', mission: 'Gas line rupture Andheri',    targetBuilding: null,   priority: 'CRITICAL', battery: 71, sector: 'Mumbai' },
  { id: 'MED-01',  name: 'AIIMS Delhi Mobile Unit',   type: 'MEDICAL',      location: { lat: 28.568, lng: 77.210 }, status: 'AVAILABLE',  mission: null,                          targetBuilding: null,   priority: null,       battery: 100,sector: 'Delhi' },
  { id: 'NDRF-04', name: 'NDRF Battalion 8 Odisha',   type: 'URBAN_RESCUE', location: { lat: 20.296, lng: 85.824 }, status: 'AVAILABLE',  mission: null,                          targetBuilding: null,   priority: null,       battery: 97, sector: 'Odisha' },
]

// ─── Vehicles ─────────────────────────────────────────────────────────────────
export const INITIAL_VEHICLES: Vehicle[] = [
  { id: 'RV-01', name: 'Relief Truck Mumbai 1',    type: 'RELIEF',    location: { lat: 19.050, lng: 72.870 }, status: 'DELIVERING', cargo: ['Water', 'Food'],          fuelLevel: 62, sector: 'Mumbai' },
  { id: 'RV-02', name: 'Relief Truck Patna 1',     type: 'RELIEF',    location: { lat: 25.600, lng: 85.130 }, status: 'EN_ROUTE',   cargo: ['Medicine', 'Blankets'],   fuelLevel: 75, sector: 'Patna' },
  { id: 'RV-03', name: 'Relief Truck Kolkata 1',   type: 'RELIEF',    location: { lat: 22.580, lng: 88.380 }, status: 'EN_ROUTE',   cargo: ['Water', 'Medicine'],      fuelLevel: 55, sector: 'Kolkata' },
  { id: 'AM-01', name: 'Ambulance Mumbai 1',       type: 'AMBULANCE', location: { lat: 19.065, lng: 72.860 }, status: 'DELIVERING', cargo: ['Medical'],                fuelLevel: 48, sector: 'Mumbai' },
  { id: 'AM-02', name: 'Ambulance Chennai 1',      type: 'AMBULANCE', location: { lat: 13.060, lng: 80.255 }, status: 'AVAILABLE',  cargo: ['Medical'],                fuelLevel: 88, sector: 'Chennai' },
  { id: 'BOAT-01',name: 'NDRF Rescue Boat 1',     type: 'RESCUE',    location: { lat: 25.590, lng: 85.140 }, status: 'EN_ROUTE',   cargo: [],                         fuelLevel: 80, sector: 'Patna' },
  { id: 'BOAT-02',name: 'NDRF Rescue Boat 2',     type: 'RESCUE',    location: { lat: 26.140, lng: 91.730 }, status: 'DELIVERING', cargo: [],                         fuelLevel: 65, sector: 'Guwahati' },
  { id: 'RV-04', name: 'Relief Truck Odisha 1',   type: 'RELIEF',    location: { lat: 20.300, lng: 85.830 }, status: 'RETURNING',  cargo: [],                         fuelLevel: 40, sector: 'Odisha' },
]

// ─── Roads ────────────────────────────────────────────────────────────────────
export const INITIAL_ROADS: Road[] = [
  { id: 'RD-01', name: 'NH-48 Mumbai-Pune',        from: { lat: 19.076, lng: 72.877 }, to: { lat: 18.520, lng: 73.856 }, status: 'FLOODED',   waterDepth: 1.8, riskLevel: 'CRITICAL', isEvacuationRoute: false, blockedReason: 'Flash flood 1.8m' },
  { id: 'RD-02', name: 'Patna-Hajipur Bridge',     from: { lat: 25.612, lng: 85.137 }, to: { lat: 25.690, lng: 85.215 }, status: 'BLOCKED',   waterDepth: 0.5, riskLevel: 'HIGH',     isEvacuationRoute: false, blockedReason: 'Embankment breach' },
  { id: 'RD-03', name: 'NH-27 Guwahati Bypass',    from: { lat: 26.144, lng: 91.736 }, to: { lat: 26.200, lng: 91.800 }, status: 'CLEAR',     waterDepth: 0,   riskLevel: 'LOW',      isEvacuationRoute: true },
  { id: 'RD-04', name: 'VIP Road Kolkata',         from: { lat: 22.545, lng: 88.370 }, to: { lat: 22.620, lng: 88.420 }, status: 'CLEAR',     waterDepth: 0,   riskLevel: 'LOW',      isEvacuationRoute: true },
  { id: 'RD-05', name: 'ECR Chennai',              from: { lat: 12.900, lng: 80.230 }, to: { lat: 13.080, lng: 80.270 }, status: 'CONGESTED', waterDepth: 0.2, riskLevel: 'MEDIUM',   isEvacuationRoute: true },
  { id: 'RD-06', name: 'Expressway Hyderabad',     from: { lat: 17.350, lng: 78.450 }, to: { lat: 17.450, lng: 78.550 }, status: 'CLEAR',     waterDepth: 0,   riskLevel: 'LOW',      isEvacuationRoute: true },
  { id: 'RD-07', name: 'NH-12 Bhubaneswar',        from: { lat: 20.260, lng: 85.800 }, to: { lat: 20.350, lng: 85.870 }, status: 'FLOODED',   waterDepth: 2.4, riskLevel: 'CRITICAL', isEvacuationRoute: false, blockedReason: 'Mahanadi overflow' },
  { id: 'RD-08', name: 'Varanasi Ghats Road',      from: { lat: 25.290, lng: 82.990 }, to: { lat: 25.350, lng: 83.020 }, status: 'BLOCKED',   waterDepth: 1.1, riskLevel: 'HIGH',     isEvacuationRoute: false, blockedReason: 'Ganga flooding' },
  { id: 'RD-09', name: 'Andheri-Kurla Link Road',  from: { lat: 19.100, lng: 72.850 }, to: { lat: 19.060, lng: 72.880 }, status: 'BLOCKED',   waterDepth: 0.9, riskLevel: 'HIGH',     isEvacuationRoute: false, blockedReason: 'Waterlogging' },
]

// ─── Buildings ────────────────────────────────────────────────────────────────
export const INITIAL_BUILDINGS: Building[] = [
  { id: 'B-01', name: 'KEM Hospital Mumbai',          type: 'HOSPITAL',       location: { lat: 19.002, lng: 72.842 }, occupants: 1200, floodDepth: 0,   status: 'HEALTHY',  sector: 'Mumbai',   floors: 8 },
  { id: 'B-02', name: 'Dharavi Community Centre',     type: 'RESIDENTIAL',    location: { lat: 19.042, lng: 72.855 }, occupants: 840,  floodDepth: 1.6, status: 'CRITICAL', sector: 'Mumbai',   floors: 3 },
  { id: 'B-03', name: 'Andheri Slum Housing',         type: 'RESIDENTIAL',    location: { lat: 19.113, lng: 72.869 }, occupants: 2400, floodDepth: 1.2, status: 'CRITICAL', sector: 'Mumbai',   floors: 2 },
  { id: 'B-04', name: 'AIIMS Patna',                  type: 'HOSPITAL',       location: { lat: 25.620, lng: 85.165 }, occupants: 560,  floodDepth: 0.3, status: 'AT_RISK',  sector: 'Patna',    floors: 6 },
  { id: 'B-05', name: 'Brahmaputra Riverside Colony', type: 'RESIDENTIAL',    location: { lat: 26.140, lng: 91.720 }, occupants: 1800, floodDepth: 2.8, status: 'CRITICAL', sector: 'Guwahati', floors: 3 },
  { id: 'B-06', name: 'Digha Colony Patna',           type: 'RESIDENTIAL',    location: { lat: 25.580, lng: 85.120 }, occupants: 320,  floodDepth: 3.1, status: 'CRITICAL', sector: 'Patna',    floors: 2 },
  { id: 'B-07', name: 'Howrah Station Area',          type: 'CRITICAL_INFRA', location: { lat: 22.585, lng: 88.342 }, occupants: 4500, floodDepth: 0.8, status: 'AT_RISK',  sector: 'Kolkata',  floors: 4 },
  { id: 'B-08', name: 'Chennai Central Office',       type: 'OFFICE',         location: { lat: 13.082, lng: 80.275 }, occupants: 200,  floodDepth: 0,   status: 'HEALTHY',  sector: 'Chennai',  floors: 12 },
  { id: 'B-09', name: 'Puri Coastal Housing',         type: 'RESIDENTIAL',    location: { lat: 19.810, lng: 85.831 }, occupants: 680,  floodDepth: 1.4, status: 'FLOODED',  sector: 'Odisha',   floors: 2 },
  { id: 'B-10', name: 'Guwahati Power Grid',          type: 'CRITICAL_INFRA', location: { lat: 26.150, lng: 91.750 }, occupants: 45,   floodDepth: 0.4, status: 'AT_RISK',  sector: 'Guwahati', floors: 2 },
]

// ─── Flood Zones — major Indian river basins and coastal areas ────────────────
export const INITIAL_FLOOD_ZONES: FloodZone[] = [
  {
    id: 'FZ-01', name: 'Mumbai Coastal Flood',
    severity: 'CRITICAL', waterDepth: 2.8, affectedPeople: 284000, expansionRate: 0.4,
    coordinates: [[72.800,18.900],[72.900,18.900],[72.950,19.100],[72.850,19.150],[72.780,19.050],[72.800,18.900]],
  },
  {
    id: 'FZ-02', name: 'Ganga Floodplain Bihar',
    severity: 'CRITICAL', waterDepth: 4.2, affectedPeople: 520000, expansionRate: 0.6,
    coordinates: [[84.800,25.400],[85.500,25.400],[85.600,25.800],[84.900,25.900],[84.700,25.600],[84.800,25.400]],
  },
  {
    id: 'FZ-03', name: 'Brahmaputra Valley Assam',
    severity: 'CRITICAL', waterDepth: 5.1, affectedPeople: 380000, expansionRate: 0.8,
    coordinates: [[91.400,26.000],[92.200,26.000],[92.300,26.400],[91.500,26.500],[91.300,26.200],[91.400,26.000]],
  },
  {
    id: 'FZ-04', name: 'Chennai Adyar Flood',
    severity: 'HIGH', waterDepth: 2.1, affectedPeople: 142000, expansionRate: 0.2,
    coordinates: [[80.180,12.950],[80.320,12.950],[80.340,13.080],[80.200,13.090],[80.170,13.020],[80.180,12.950]],
  },
  {
    id: 'FZ-05', name: 'Mahanadi Delta Odisha',
    severity: 'HIGH', waterDepth: 3.2, affectedPeople: 196000, expansionRate: 0.35,
    coordinates: [[85.600,20.100],[86.000,20.100],[86.200,20.400],[85.800,20.500],[85.550,20.300],[85.600,20.100]],
  },
  {
    id: 'FZ-06', name: 'Kolkata Howrah Waterlogging',
    severity: 'HIGH', waterDepth: 1.8, affectedPeople: 210000, expansionRate: 0.15,
    coordinates: [[88.280,22.480],[88.420,22.480],[88.440,22.640],[88.300,22.660],[88.260,22.560],[88.280,22.480]],
  },
]

// ─── Waste Zones ──────────────────────────────────────────────────────────────
export const INITIAL_WASTE_ZONES: WasteZone[] = [
  { id: 'WZ-01', type: 'DEBRIS',           location: { lat: 19.042, lng: 72.855 }, severity: 'HIGH',     description: 'Debris from collapsed slum structures in Dharavi', detectedAt: '14:15:00' },
  { id: 'WZ-02', type: 'BLOCKED_ROAD',     location: { lat: 25.612, lng: 85.130 }, severity: 'CRITICAL', description: 'NH-31 blocked by flood debris near Patna',          detectedAt: '14:18:00' },
  { id: 'WZ-03', type: 'HAZARDOUS',        location: { lat: 19.113, lng: 72.877 }, severity: 'CRITICAL', description: 'Chemical factory flooded in MIDC Andheri',          detectedAt: '14:22:00' },
  { id: 'WZ-04', type: 'FALLEN_STRUCTURE', location: { lat: 26.140, lng: 91.720 }, severity: 'HIGH',     description: 'Partially collapsed building near Brahmaputra',     detectedAt: '14:25:00' },
  { id: 'WZ-05', type: 'GARBAGE',          location: { lat: 22.572, lng: 88.360 }, severity: 'MEDIUM',   description: 'Flood debris and solid waste accumulation Howrah',  detectedAt: '14:28:00' },
  { id: 'WZ-06', type: 'DEBRIS',           location: { lat: 20.296, lng: 85.824 }, severity: 'HIGH',     description: 'Storm debris blocking Mahanadi relief route',        detectedAt: '14:30:00' },
  { id: 'WZ-07', type: 'HAZARDOUS',        location: { lat: 25.580, lng: 85.120 }, severity: 'CRITICAL', description: 'Sewage contamination in Patna flood water',          detectedAt: '14:32:00' },
]

// ─── Supply Centers ───────────────────────────────────────────────────────────
export const INITIAL_SUPPLY_CENTERS: SupplyCenter[] = [
  {
    id: 'SC-01', name: 'NDRF Warehouse Mumbai',
    location: { lat: 19.200, lng: 72.970 },
    inventory: { water: 120000, food: 28000, medicine: 4200, blankets: 12000, fuel: 35000, equipment: 580 },
    status: 'OPERATIONAL',
  },
  {
    id: 'SC-02', name: 'Army Depot Patna',
    location: { lat: 25.650, lng: 85.200 },
    inventory: { water: 85000, food: 18000, medicine: 2800, blankets: 8500, fuel: 22000, equipment: 340 },
    status: 'OPERATIONAL',
  },
  {
    id: 'SC-03', name: 'State Relief Kolkata',
    location: { lat: 22.640, lng: 88.440 },
    inventory: { water: 42000, food: 9500, medicine: 1400, blankets: 4200, fuel: 11000, equipment: 180 },
    status: 'LOW_STOCK',
  },
  {
    id: 'SC-04', name: 'ODRAF Depot Bhubaneswar',
    location: { lat: 20.380, lng: 85.890 },
    inventory: { water: 58000, food: 12000, medicine: 1800, blankets: 5500, fuel: 14000, equipment: 220 },
    status: 'OPERATIONAL',
  },
]

// ─── Relief Requests ──────────────────────────────────────────────────────────
export const INITIAL_RELIEF_REQUESTS: ReliefRequest[] = [
  { id: 'RR-01', targetId: 'SH-05', targetName: 'Salt Lake Stadium Kolkata', required: ['Water', 'Food', 'Medicine'], priority: 'CRITICAL', assignedVehicle: 'RV-03', status: 'EN_ROUTE',  estimatedArrival: '15:30:00' },
  { id: 'RR-02', targetId: 'SH-03', targetName: 'Patna Sahib Relief Camp',   required: ['Food', 'Medicine'],          priority: 'HIGH',     assignedVehicle: 'RV-02', status: 'EN_ROUTE',  estimatedArrival: '15:15:00' },
  { id: 'RR-03', targetId: 'SH-01', targetName: 'NSCI Dome Mumbai',          required: ['Water'],                     priority: 'MEDIUM',   assignedVehicle: null,    status: 'PENDING' },
  { id: 'RR-04', targetId: 'SH-08', targetName: 'Varanasi Relief Centre',    required: ['Food', 'Blankets'],          priority: 'HIGH',     assignedVehicle: null,    status: 'PENDING' },
]

// ─── Routes ───────────────────────────────────────────────────────────────────
export const INITIAL_ROUTES: Route[] = [
  {
    id: 'RT-01', from: 'Dharavi', to: 'NSCI Dome Mumbai',
    fromCoords: { lat: 19.042, lng: 72.855 }, toCoords: { lat: 19.018, lng: 72.856 },
    waypoints: [{ lat: 19.030, lng: 72.856 }],
    distance: 3.2, etaMinutes: 12, riskLevel: 'MEDIUM', type: 'EVACUATION', isBlocked: false, alternativeRouteId: 'RT-02',
  },
  {
    id: 'RT-02', from: 'Digha Colony', to: 'Patna Sahib Camp',
    fromCoords: { lat: 25.580, lng: 85.120 }, toCoords: { lat: 25.619, lng: 85.144 },
    waypoints: [{ lat: 25.598, lng: 85.130 }],
    distance: 5.8, etaMinutes: 22, riskLevel: 'HIGH', type: 'EVACUATION', isBlocked: false,
  },
  {
    id: 'RT-03', from: 'SC-01', to: 'SH-05',
    fromCoords: { lat: 19.200, lng: 72.970 }, toCoords: { lat: 22.578, lng: 88.397 },
    waypoints: [],
    distance: 1860, etaMinutes: 1440, riskLevel: 'LOW', type: 'RELIEF', isBlocked: false,
  },
]

// ─── Alerts ───────────────────────────────────────────────────────────────────
export const INITIAL_ALERTS: Alert[] = [
  { id: 'AL-01', severity: 'CRITICAL', title: 'Extreme Flood Warning',    message: 'Brahmaputra breached banks at Guwahati. 3.8 lakh people at risk. Immediate evacuation ordered.', timestamp: '14:32:00', acknowledged: false, relatedEntityId: 'FZ-03' },
  { id: 'AL-02', severity: 'CRITICAL', title: 'Mumbai Coastal Alert',     message: 'IMD issues Red Alert for Mumbai. Mithi River at 2.8m, rising. Dharavi, Kurla evacuation urgent.', timestamp: '14:30:00', acknowledged: false, relatedEntityId: 'FZ-01' },
  { id: 'AL-03', severity: 'WARNING',  title: 'Patna Road Blocked',       message: 'Patna-Hajipur bridge approach flooded. Alternate route via Gandhi Setu activated.',                timestamp: '14:28:00', acknowledged: false, relatedEntityId: 'RD-02' },
  { id: 'AL-04', severity: 'RESCUE',   title: 'NDRF Deployed Patna',      message: 'NDRF Battalion 2 conducting rescue ops at Digha Colony. 320 people trapped, 1.8m water.',         timestamp: '14:26:00', acknowledged: false, relatedEntityId: 'NDRF-02' },
  { id: 'AL-05', severity: 'SHELTER',  title: 'Kolkata Shelter Critical', message: 'Salt Lake Stadium at 97% capacity. Requesting overflow arrangements at Netaji Indoor Stadium.',  timestamp: '14:24:00', acknowledged: false, relatedEntityId: 'SH-05' },
  { id: 'AL-06', severity: 'SUPPLY',   title: 'Kolkata Supply Shortage',  message: 'SC-03 Kolkata at low stock. Water and food for 48 hours only. Emergency resupply requested.',     timestamp: '14:22:00', acknowledged: false, relatedEntityId: 'SC-03' },
  { id: 'AL-07', severity: 'WARNING',  title: 'Howrah Bridge Degraded',   message: 'Structural sensor on Howrah Bridge at 76.4% integrity. Load restrictions imposed.',               timestamp: '14:20:00', acknowledged: true,  relatedEntityId: 'S-01' },
  { id: 'AL-08', severity: 'CRITICAL', title: 'Chemical Hazard Andheri',  message: 'MIDC chemical plant flooded. Hazmat team deployed. 1km evacuation radius enforced.',               timestamp: '14:18:00', acknowledged: false, relatedEntityId: 'WZ-03' },
]

// ─── Incidents ────────────────────────────────────────────────────────────────
export const INITIAL_INCIDENTS: Incident[] = [
  { id: 'INC-01', type: 'RESCUE_NEEDED',  severity: 'CRITICAL', location: { lat: 19.042, lng: 72.855 }, description: '2,400 residents trapped in Dharavi, water depth 1.6m.',          reportedAt: '14:20:00', assignedTeam: 'NDRF-01', status: 'ASSIGNED' },
  { id: 'INC-02', type: 'FLOOD',          severity: 'CRITICAL', location: { lat: 26.140, lng: 91.720 }, description: 'Brahmaputra Island community flooded, helicopter rescue needed.',  reportedAt: '14:18:00', assignedTeam: 'ARMY-02', status: 'ASSIGNED' },
  { id: 'INC-03', type: 'ROAD_BLOCKED',   severity: 'HIGH',     location: { lat: 25.612, lng: 85.130 }, description: 'NH-31 Patna completely blocked, 800 vehicles stranded.',          reportedAt: '14:25:00', status: 'OPEN' },
  { id: 'INC-04', type: 'SHELTER_FULL',   severity: 'HIGH',     location: { lat: 22.578, lng: 88.397 }, description: 'Salt Lake Stadium Kolkata near capacity, overflow needed.',       reportedAt: '14:22:00', status: 'ASSIGNED' },
  { id: 'INC-05', type: 'RESCUE_NEEDED',  severity: 'CRITICAL', location: { lat: 25.580, lng: 85.120 }, description: '320 people trapped at Digha Colony, water level 3.1m.',          reportedAt: '14:27:00', assignedTeam: 'NDRF-02', status: 'ASSIGNED' },
  { id: 'INC-06', type: 'DEBRIS',         severity: 'HIGH',     location: { lat: 19.113, lng: 72.869 }, description: 'Building collapse in Andheri, rescue access blocked.',           reportedAt: '14:14:00', status: 'OPEN' },
  { id: 'INC-07', type: 'SUPPLY_SHORTAGE',severity: 'HIGH',     location: { lat: 22.578, lng: 88.397 }, description: 'Critical food/water shortage at Kolkata relief camps.',          reportedAt: '14:23:00', status: 'ASSIGNED' },
  { id: 'INC-08', type: 'FLOOD',          severity: 'CRITICAL', location: { lat: 19.810, lng: 85.831 }, description: 'Puri coastal area flooded, cyclone surge 2.4m.',                 reportedAt: '14:10:00', status: 'OPEN' },
]

// ─── Critical Infrastructure ──────────────────────────────────────────────────
export const INITIAL_CRITICAL_INFRA: CriticalInfrastructure[] = [
  { id: 'CI-01', name: 'KEM Hospital Mumbai',        type: 'HOSPITAL',         location: { lat: 19.002, lng: 72.842 }, status: 'OPERATIONAL', priority: 1 },
  { id: 'CI-02', name: 'AIIMS Patna',                type: 'HOSPITAL',         location: { lat: 25.620, lng: 85.165 }, status: 'AT_RISK',     priority: 1 },
  { id: 'CI-03', name: 'Guwahati Power Station',     type: 'POWER_PLANT',      location: { lat: 26.150, lng: 91.750 }, status: 'AT_RISK',     priority: 1 },
  { id: 'CI-04', name: 'Patna Water Treatment',      type: 'WATER_TREATMENT',  location: { lat: 25.595, lng: 85.110 }, status: 'OFFLINE',     priority: 1 },
  { id: 'CI-05', name: 'Howrah Bridge',              type: 'BRIDGE',           location: { lat: 22.585, lng: 88.347 }, status: 'DEGRADED',    priority: 2 },
  { id: 'CI-06', name: 'Gandhi Setu Patna',          type: 'BRIDGE',           location: { lat: 25.640, lng: 85.090 }, status: 'OPERATIONAL', priority: 1 },
  { id: 'CI-07', name: 'NDRF HQ New Delhi',          type: 'EMERGENCY_CENTER', location: { lat: 28.613, lng: 77.209 }, status: 'OPERATIONAL', priority: 1 },
  { id: 'CI-08', name: 'Mumbai Fuel Depot',          type: 'FUEL_DEPOT',       location: { lat: 19.200, lng: 72.970 }, status: 'OPERATIONAL', priority: 2 },
]

// ─── Initial state ────────────────────────────────────────────────────────────
export function createInitialState(): DisasterState {
  return {
    severity: 'CRITICAL',
    floodRisk: 78,
    affectedPeople: 1734000,   // 17.34 lakh across all states
    averageWaterLevel: 3.2,
    simulationTime: 0,
    simulationRunning: false,
    simulationSpeed: 1,
    networkStatus: 'CONNECTED',
    dataMode: 'DEMO',
    lastSyncAt: new Date().toISOString(),
    syncQueueCount: 0,
    activeIncidentCount: 8,
    backendConnected: false,

    sensors:               INITIAL_SENSORS,
    shelters:              INITIAL_SHELTERS,
    rescueTeams:           INITIAL_RESCUE_TEAMS,
    vehicles:              INITIAL_VEHICLES,
    roads:                 INITIAL_ROADS,
    buildings:             INITIAL_BUILDINGS,
    floodZones:            INITIAL_FLOOD_ZONES,
    wasteZones:            INITIAL_WASTE_ZONES,
    supplyCenters:         INITIAL_SUPPLY_CENTERS,
    reliefRequests:        INITIAL_RELIEF_REQUESTS,
    routes:                INITIAL_ROUTES,
    alerts:                INITIAL_ALERTS,
    incidents:             INITIAL_INCIDENTS,
    criticalInfrastructure:INITIAL_CRITICAL_INFRA,
    syncQueue:             [],
  } satisfies DisasterState
}
