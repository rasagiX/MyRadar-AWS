/**
 * MyRadar Local AI — rule-based disaster intelligence assistant.
 * Handles city-specific queries, situation reports, and all operational questions.
 * Used when offline or when Bedrock is unavailable.
 */

import type { DisasterState } from '@/types/disaster'

export interface AIResponse {
  text: string
  mode: 'CLOUD' | 'LOCAL'
  confidence: 'HIGH' | 'MEDIUM' | 'LOW'
  provider?: string
}

// ── Indian city registry ──────────────────────────────────────────────────────
// Maps every city keyword/variant to a canonical name
const CITY_ALIASES: Record<string, string> = {
  // Delhi variants
  'delhi': 'Delhi', 'new delhi': 'Delhi', 'ncr': 'Delhi', 'delhi ncr': 'Delhi',
  // Mumbai variants
  'mumbai': 'Mumbai', 'bombay': 'Mumbai', 'maharashtra': 'Mumbai',
  // Patna variants
  'patna': 'Patna', 'bihar': 'Patna',
  // Guwahati variants
  'guwahati': 'Guwahati', 'assam': 'Guwahati', 'brahmaputra': 'Guwahati',
  // Kolkata variants
  'kolkata': 'Kolkata', 'calcutta': 'Kolkata', 'west bengal': 'Kolkata', 'howrah': 'Kolkata',
  // Chennai variants
  'chennai': 'Chennai', 'madras': 'Chennai', 'tamil nadu': 'Chennai', 'adyar': 'Chennai',
  // Bhubaneswar / Odisha
  'bhubaneswar': 'Bhubaneswar', 'odisha': 'Bhubaneswar', 'puri': 'Bhubaneswar', 'mahanadi': 'Bhubaneswar',
  // Hyderabad
  'hyderabad': 'Hyderabad', 'telangana': 'Hyderabad', 'musi': 'Hyderabad',
  // Varanasi
  'varanasi': 'Varanasi', 'banaras': 'Varanasi', 'kashi': 'Varanasi',
}

/** Return the canonical city name if the query mentions a city, else null */
function detectCity(query: string): string | null {
  const q = query.toLowerCase()
  // Longest-match first so "new delhi" beats "delhi"
  const sorted = Object.keys(CITY_ALIASES).sort((a, b) => b.length - a.length)
  for (const alias of sorted) {
    if (q.includes(alias)) return CITY_ALIASES[alias]
  }
  return null
}

// ── helpers ───────────────────────────────────────────────────────────────────
function pct(occupancy: number, capacity: number) {
  return Math.round((occupancy / capacity) * 100)
}

function waterLabel(level: number): string {
  if (level > 4) return 'CATASTROPHIC'
  if (level > 3) return 'EXTREME'
  if (level > 2) return 'CRITICAL'
  if (level > 1) return 'HIGH'
  if (level > 0.5) return 'MODERATE'
  return 'LOW'
}

// ── City-specific situation report ────────────────────────────────────────────
function handleCityQuery(city: string, state: DisasterState): string {
  // Special case: Delhi is not in our flood zone data (it's used as the AI team base)
  if (city === 'Delhi') {
    const teams = state.rescueTeams.filter(t => t.sector === 'Delhi')
    const sensors = state.sensors.filter(s => s.name.toLowerCase().includes('delhi'))
    if (teams.length === 0 && sensors.length === 0) {
      return `MyRadar Assessment — Delhi

Delhi is not currently in an active flood zone based on monitored data.

AIIMS Delhi Mobile Medical Unit (MED-01) is stationed in Delhi and available for rapid deployment.

Current national situation:
• Severity: ${state.severity} | Flood Risk: ${state.floodRisk}%
• ${state.floodZones.length} active flood zones across India
• Most critical areas: Guwahati (Brahmaputra, ${state.floodZones.find(z => z.name.includes('Brahmaputra'))?.waterDepth.toFixed(1) ?? 'N/A'}m), Mumbai coast, Bihar Ganga plains

Delhi teams can be dispatched to any affected state within 6 hours.
Ask me about a specific affected city — Mumbai, Patna, Guwahati, Kolkata, Chennai.`
    }
  }

  // Find matching flood zones
  const zones = state.floodZones.filter(z =>
    z.name.toLowerCase().includes(city.toLowerCase()) ||
    z.name.toLowerCase().includes(city.toLowerCase().slice(0, 4))
  )

  // Find matching shelters
  const shelters = state.shelters.filter(s => s.sector === city || s.sector.toLowerCase().includes(city.toLowerCase()))

  // Find matching rescue teams
  const teams = state.rescueTeams.filter(t => t.sector === city || t.sector.toLowerCase().includes(city.toLowerCase()))

  // Find matching sensors
  const sensors = state.sensors.filter(s =>
    s.name.toLowerCase().includes(city.toLowerCase()) ||
    s.name.toLowerCase().includes(city.toLowerCase().slice(0, 4))
  )

  // Find matching incidents
  const incidents = state.incidents.filter(i => {
    const desc = i.description.toLowerCase()
    return desc.includes(city.toLowerCase()) || desc.includes(city.toLowerCase().slice(0, 4))
  })

  // No data at all
  if (zones.length === 0 && shelters.length === 0 && teams.length === 0) {
    return `MyRadar Assessment — ${city}

No active flood monitoring data for ${city} in the current scenario.

National situation: Severity ${state.severity} | ${state.floodZones.length} active zones
Currently monitored cities: Mumbai, Patna, Guwahati, Kolkata, Chennai, Bhubaneswar, Hyderabad

Ask about one of those cities for a detailed situation report.`
  }

  const lines: string[] = []
  lines.push(`MyRadar Assessment — ${city}`)
  lines.push(`Time: ${new Date().toLocaleTimeString('en-IN', { hour12: true })}`)
  lines.push('')

  // Flood zone data
  if (zones.length > 0) {
    const z = zones[0]
    lines.push(`FLOOD STATUS: ${z.severity}`)
    lines.push(`Water depth: ${z.waterDepth.toFixed(2)}m (${waterLabel(z.waterDepth)})`)
    lines.push(`Affected population: ${z.affectedPeople.toLocaleString('en-IN')} people`)
    lines.push(`Expansion rate: ${z.expansionRate}m/hr`)
    lines.push('')
  }

  // Sensor readings
  if (sensors.length > 0) {
    const s = sensors[0]
    lines.push(`SENSOR: ${s.name}`)
    lines.push(`Reading: ${s.reading.toFixed(2)}${s.unit} — ${s.trend} | Battery: ${s.battery.toFixed(0)}%`)
    lines.push('')
  }

  // Active incidents
  if (incidents.length > 0) {
    lines.push(`ACTIVE INCIDENTS (${incidents.length}):`)
    incidents.slice(0, 3).forEach(i => {
      lines.push(`• [${i.status}] ${i.description}`)
    })
    lines.push('')
  }

  // Rescue teams
  if (teams.length > 0) {
    const active = teams.filter(t => t.status !== 'AVAILABLE' && t.status !== 'OFFLINE')
    lines.push(`RESCUE TEAMS: ${teams.length} deployed, ${active.length} active`)
    active.slice(0, 3).forEach(t => {
      lines.push(`• ${t.id} (${t.name}): ${t.status}${t.mission ? ' — ' + t.mission : ''}`)
    })
    lines.push('')
  }

  // Shelter status
  if (shelters.length > 0) {
    lines.push(`SHELTERS (${shelters.length}):`)
    shelters.forEach(s => {
      const p = pct(s.occupancy, s.capacity)
      const needs: string[] = []
      if (s.waterLevel < 30) needs.push(`water ${s.waterLevel.toFixed(0)}%`)
      if (s.foodLevel < 30) needs.push(`food ${s.foodLevel.toFixed(0)}%`)
      if (s.medicineLevel < 30) needs.push(`medicine ${s.medicineLevel.toFixed(0)}%`)
      lines.push(`• ${s.name}: ${p}% full (${s.status})${needs.length ? ' — NEEDS: ' + needs.join(', ') : ''}`)
    })
    lines.push('')
  }

  // Recommendation
  const criticalZone = zones.find(z => z.severity === 'CRITICAL')
  const criticalShelter = shelters.find(s => s.status === 'CRITICAL')
  if (criticalZone || criticalShelter) {
    lines.push('RECOMMENDED ACTIONS:')
    if (criticalZone) lines.push(`• Immediate evacuation from flood zone (depth ${criticalZone.waterDepth.toFixed(1)}m)`)
    if (criticalShelter) lines.push(`• Emergency resupply to ${criticalShelter.name}`)
    const available = state.rescueTeams.find(t => t.status === 'AVAILABLE')
    if (available) lines.push(`• Deploy ${available.id} (${available.name}) immediately`)
  }

  return lines.join('\n')
}

// ── Overall national situation ────────────────────────────────────────────────
function handleSituation(state: DisasterState): string {
  const blocked = state.roads.filter(r => r.status === 'BLOCKED' || r.status === 'FLOODED').length
  const criticalShelters = state.shelters.filter(s => s.status === 'CRITICAL').length
  const maxWaterSensor = state.sensors
    .filter(s => s.type === 'WATER_LEVEL')
    .sort((a, b) => b.reading - a.reading)[0]
  const activeTeams = state.rescueTeams.filter(r => r.status !== 'AVAILABLE' && r.status !== 'OFFLINE').length
  const worstZone = [...state.floodZones].sort((a, b) => b.waterDepth - a.waterDepth)[0]
  const totalAffected = state.floodZones.reduce((a, z) => a + z.affectedPeople, 0)

  return `MyRadar National Flood Assessment — ${new Date().toLocaleTimeString('en-IN', { hour12: true })}

NATIONAL STATUS: ${state.severity} | Flood Risk: ${state.floodRisk}%
Total affected: ${totalAffected.toLocaleString('en-IN')} people across ${state.floodZones.length} flood zones
Average water level: ${state.averageWaterLevel.toFixed(1)}m | ${blocked} roads blocked

WORST AFFECTED ZONE:
• ${worstZone?.name ?? 'N/A'} — ${worstZone?.waterDepth.toFixed(1) ?? 'N/A'}m (${worstZone?.severity ?? 'N/A'})
• ${worstZone?.affectedPeople.toLocaleString('en-IN') ?? '0'} people at risk

HIGHEST SENSOR READING:
• ${maxWaterSensor?.name ?? 'N/A'}: ${maxWaterSensor?.reading.toFixed(2) ?? 'N/A'}m (${maxWaterSensor?.trend ?? 'N/A'})

RESPONSE STATUS:
• ${activeTeams}/${state.rescueTeams.length} rescue teams deployed
• ${criticalShelters} shelters at critical capacity
• ${state.activeIncidentCount} open incidents

Ask me about a specific city — e.g. "Mumbai situation" or "Patna update".`
}

// ── Shelter query ─────────────────────────────────────────────────────────────
function handleShelter(state: DisasterState, city: string | null): string {
  const pool = city
    ? state.shelters.filter(s => s.sector.toLowerCase().includes(city.toLowerCase()))
    : state.shelters

  if (pool.length === 0 && city) {
    return `No shelters currently tracked in ${city}. Check Mumbai, Patna, Kolkata, Chennai, Guwahati.`
  }

  const safe = pool.filter(s => s.status === 'SAFE').sort((a, b) => pct(a.occupancy, a.capacity) - pct(b.occupancy, b.capacity))
  if (safe.length === 0) {
    const all = pool.sort((a, b) => pct(a.occupancy, a.capacity) - pct(b.occupancy, b.capacity))
    return `WARNING: No SAFE shelters in ${city ?? 'any location'}. Best available:\n` +
      all.slice(0, 3).map(s => `• ${s.name} (${s.status}): ${pct(s.occupancy, s.capacity)}% full`).join('\n')
  }

  const best = safe[0]
  const available = best.capacity - best.occupancy
  return `Safest shelter${city ? ' in ' + city : ''}: ${best.name} (${best.sector})
Capacity: ${best.occupancy}/${best.capacity} (${pct(best.occupancy, best.capacity)}% occupied)
${available.toLocaleString('en-IN')} spaces available
Supplies — Water: ${best.waterLevel.toFixed(0)}% | Food: ${best.foodLevel.toFixed(0)}% | Medicine: ${best.medicineLevel.toFixed(0)}%
Status: ${best.status}`
}

// ── Blocked roads ─────────────────────────────────────────────────────────────
function handleBlockedRoads(state: DisasterState, city: string | null): string {
  const blocked = state.roads.filter(r => r.status === 'BLOCKED' || r.status === 'FLOODED')
  if (blocked.length === 0) return 'All monitored roads are currently passable.'
  const filtered = city
    ? blocked.filter(r => r.name.toLowerCase().includes(city.toLowerCase()) || state.incidents.some(i => i.description.toLowerCase().includes(city.toLowerCase())))
    : blocked
  const list = (filtered.length > 0 ? filtered : blocked)
  return `${list.length} blocked/flooded road${list.length !== 1 ? 's' : ''}${city ? ' near ' + city : ''}:\n` +
    list.map(r => `• ${r.name} — ${r.status}${r.blockedReason ? ` (${r.blockedReason})` : ''}${r.waterDepth > 0 ? ` [${r.waterDepth.toFixed(1)}m water]` : ''}`).join('\n') +
    '\n\nEvacuation routing engine will avoid these roads automatically.'
}

// ── Rescue team query ─────────────────────────────────────────────────────────
function handleRescueTeam(state: DisasterState, query: string, city: string | null): string {
  // Specific team by ID
  const teamMatch = query.match(/(?:NDRF|SDRF|ARMY|COAST|FIRE|MED|R)-(\w+)/i)
  if (teamMatch) {
    const teamId = teamMatch[0].toUpperCase()
    const team = state.rescueTeams.find(t => t.id === teamId)
    if (team) {
      return `${team.id} — ${team.name}
Status: ${team.status}
Sector: ${team.sector}
Mission: ${team.mission ?? 'None assigned'}
Battery/Fuel: ${team.battery.toFixed(0)}%${team.priority ? '\nPriority: ' + team.priority : ''}`
    }
  }

  const pool = city
    ? state.rescueTeams.filter(t => t.sector.toLowerCase().includes(city.toLowerCase()))
    : state.rescueTeams

  const active = pool.filter(t => t.status !== 'AVAILABLE' && t.status !== 'OFFLINE')
  const available = pool.filter(t => t.status === 'AVAILABLE')

  return `Rescue teams${city ? ' in ' + city : ''}: ${pool.length} total
Active: ${active.length} | Available: ${available.length}
${active.slice(0, 5).map(t => `• ${t.id}: ${t.status} — ${t.mission ?? 'No mission'}`).join('\n')}${
  available.length > 0 ? '\n\nAvailable for deployment:\n' + available.map(t => `• ${t.id} (${t.name}) — ${t.sector}, battery ${t.battery.toFixed(0)}%`).join('\n') : ''
}`
}

// ── Relief / supply ───────────────────────────────────────────────────────────
function handleRelief(state: DisasterState, city: string | null): string {
  const pool = city
    ? state.shelters.filter(s => s.sector.toLowerCase().includes(city.toLowerCase()))
    : state.shelters

  const critical = pool
    .filter(s => s.waterLevel < 30 || s.foodLevel < 30 || s.medicineLevel < 30)
    .sort((a, b) => (a.waterLevel + a.foodLevel + a.medicineLevel) - (b.waterLevel + b.foodLevel + b.medicineLevel))

  if (critical.length === 0) {
    return `All shelter supply levels are adequate${city ? ' in ' + city : ''}.`
  }

  const top = critical[0]
  const needs: string[] = []
  if (top.waterLevel < 30) needs.push(`Water (${top.waterLevel.toFixed(0)}%)`)
  if (top.foodLevel < 30) needs.push(`Food (${top.foodLevel.toFixed(0)}%)`)
  if (top.medicineLevel < 30) needs.push(`Medicine (${top.medicineLevel.toFixed(0)}%)`)

  const vehicle = state.vehicles.find(v => v.type === 'RELIEF' && v.status === 'AVAILABLE')

  return `Priority relief delivery needed:
Destination: ${top.name} (${top.sector})
Critical supplies: ${needs.join(', ')}
Occupancy: ${top.occupancy.toLocaleString('en-IN')}/${top.capacity.toLocaleString('en-IN')} (${pct(top.occupancy, top.capacity)}%)
${vehicle ? `Recommended vehicle: ${vehicle.id} — ${vehicle.name} (AVAILABLE, fuel ${vehicle.fuelLevel}%)` : 'WARNING: No relief vehicles currently available'}`
}

// ── Water levels ──────────────────────────────────────────────────────────────
function handleWater(state: DisasterState, city: string | null): string {
  const sensors = state.sensors
    .filter(s => s.type === 'WATER_LEVEL')
    .filter(s => city ? s.name.toLowerCase().includes(city.toLowerCase().slice(0, 4)) : true)
    .sort((a, b) => b.reading - a.reading)

  if (sensors.length === 0 && city) {
    return `No water sensors registered for ${city}.\nNational average: ${state.averageWaterLevel.toFixed(2)}m | Risk: ${state.floodRisk}%`
  }

  const list = (sensors.length > 0 ? sensors : state.sensors.filter(s => s.type === 'WATER_LEVEL').sort((a, b) => b.reading - a.reading))
  return `Water level readings${city ? ' — ' + city : ' (all sensors)'}:
${list.map(s => `• ${s.name}: ${s.reading.toFixed(2)}m (${s.trend}) | Battery: ${s.battery.toFixed(0)}%`).join('\n')}

National average: ${state.averageWaterLevel.toFixed(2)}m | Flood risk: ${state.floodRisk}%`
}

// ── Offline sync ──────────────────────────────────────────────────────────────
function handleOfflineChanges(state: DisasterState): string {
  const q = state.syncQueue
  if (q.length === 0) return 'No offline events pending sync. System is fully synchronised.'
  return `${q.length} events recorded while offline:
${q.slice(0, 8).map(e => `• [${e.timestamp.slice(11, 19)}] ${e.eventType}`).join('\n')}${q.length > 8 ? `\n... and ${q.length - 8} more.` : ''}

These will synchronise automatically when AWS connection is restored.`
}

// ── Incidents ─────────────────────────────────────────────────────────────────
function handleIncidents(state: DisasterState, city: string | null): string {
  const pool = city
    ? state.incidents.filter(i => i.description.toLowerCase().includes(city.toLowerCase().slice(0, 4)))
    : state.incidents

  const open = pool.filter(i => i.status !== 'RESOLVED')
  if (open.length === 0) {
    return city
      ? `No active incidents in ${city} at this time.`
      : 'No open incidents in the system.'
  }

  return `Active incidents${city ? ' in ' + city : ''} (${open.length}):
${open.slice(0, 6).map(i => `• [${i.severity}] ${i.description} — ${i.status}${i.assignedTeam ? ' | Team: ' + i.assignedTeam : ''}`).join('\n')}`
}

// ── Smart fallback ────────────────────────────────────────────────────────────
function handleGeneral(query: string, state: DisasterState): string {
  const q = query.toLowerCase()

  // "What is happening in X" / "update on X" / "X situation" — catch-all
  const city = detectCity(q)
  if (city) return handleCityQuery(city, state)

  // Numbers / stats
  if (q.includes('how many') || q.includes('count') || q.includes('number')) {
    return `Current counts:
• Flood zones: ${state.floodZones.length}
• Active teams: ${state.rescueTeams.filter(t => t.status !== 'AVAILABLE' && t.status !== 'OFFLINE').length}/${state.rescueTeams.length}
• Shelters: ${state.shelters.length} (${state.shelters.filter(s => s.status === 'CRITICAL').length} critical)
• Open incidents: ${state.activeIncidentCount}
• Blocked roads: ${state.roads.filter(r => r.status !== 'CLEAR').length}
• Affected people: ${state.floodZones.reduce((a, z) => a + z.affectedPeople, 0).toLocaleString('en-IN')}`
  }

  // "What should I do" / "recommend"
  if (q.includes('recommend') || q.includes('what should') || q.includes('next step') || q.includes('action')) {
    const criticalShelter = state.shelters.find(s => s.status === 'CRITICAL')
    const worstZone = [...state.floodZones].sort((a, b) => b.waterDepth - a.waterDepth)[0]
    const availTeam = state.rescueTeams.find(t => t.status === 'AVAILABLE')

    return `Top recommended actions right now:
${worstZone ? `1. Immediate attention: ${worstZone.name} (depth ${worstZone.waterDepth.toFixed(1)}m, ${worstZone.affectedPeople.toLocaleString('en-IN')} affected)` : ''}
${criticalShelter ? `2. Emergency resupply: ${criticalShelter.name} — critically low on supplies` : ''}
${availTeam ? `3. Deploy ${availTeam.id} (${availTeam.name}) — currently available in ${availTeam.sector}` : ''}
4. Monitor Brahmaputra sensor — highest reading at ${state.sensors.filter(s => s.type === 'WATER_LEVEL').sort((a, b) => b.reading - a.reading)[0]?.reading.toFixed(2) ?? 'N/A'}m`
  }

  // Default: give a useful overview + hint
  return `MyRadar AI — I understood your query but need more context to answer precisely.

Current overview:
• Status: ${state.severity} | Risk: ${state.floodRisk}%
• Worst zone: ${[...state.floodZones].sort((a, b) => b.waterDepth - a.waterDepth)[0]?.name ?? 'N/A'}
• Teams deployed: ${state.rescueTeams.filter(t => t.status !== 'AVAILABLE' && t.status !== 'OFFLINE').length}/${state.rescueTeams.length}

Try asking:
• "Mumbai situation" or "Patna update" — city-specific reports
• "Which shelter is safest?" — shelter status
• "Blocked roads" — road conditions
• "National situation" — full overview
• "Recommend next action" — AI recommendations`
}

// ── Main entry point ──────────────────────────────────────────────────────────
export function queryLocalAI(query: string, state: DisasterState): AIResponse {
  const q = query.toLowerCase().trim()
  const city = detectCity(q)

  let text: string

  // City-specific: highest priority — catches "Delhi situation", "what is happening in Mumbai" etc.
  if (city && (q.includes('situation') || q.includes('update') || q.includes('happen') ||
               q.includes('status') || q.includes('what') || q.includes('how') ||
               q.includes('tell') || q.includes('report') || q.includes('flood'))) {
    text = handleCityQuery(city, state)
  }
  // Overall situation
  else if (q.includes('national') || q.includes('overall') || q.includes('summary') ||
    (q.includes('situation') && !city) || (q.includes('status') && !city)) {
    text = handleSituation(state)
  }
  // Shelter queries
  else if (q.includes('shelter') || q.includes('camp') || q.includes('refuge')) {
    text = handleShelter(state, city)
  }
  // Road / evacuation
  else if (q.includes('block') || q.includes('road') || q.includes('route') ||
           q.includes('avoid') || q.includes('drive') || q.includes('evacuate')) {
    text = handleBlockedRoads(state, city)
  }
  // Rescue teams
  else if (q.includes('team') || q.includes('rescue') || q.includes('ndrf') ||
           q.includes('sdrf') || q.includes('deploy') || /\b[A-Z]+-\d+\b/.test(query)) {
    text = handleRescueTeam(state, query, city)
  }
  // Relief / supplies
  else if (q.includes('relief') || q.includes('supply') || q.includes('food') ||
           q.includes('medicine') || q.includes('deliver')) {
    text = handleRelief(state, city)
  }
  // Water levels
  else if (q.includes('water') || q.includes('sensor') || q.includes('level') ||
           q.includes('river') || q.includes('rain')) {
    text = handleWater(state, city)
  }
  // Incidents
  else if (q.includes('incident') || q.includes('emergency') || q.includes('rescue needed') ||
           q.includes('trapped')) {
    text = handleIncidents(state, city)
  }
  // Offline sync
  else if (q.includes('offline') || q.includes('sync') || q.includes('queue') ||
           q.includes('changed') || q.includes('while') || q.includes('missed')) {
    text = handleOfflineChanges(state)
  }
  // Critical / urgent
  else if (q.includes('critical') || q.includes('urgent') || q.includes('priority') ||
           q.includes('worst') || q.includes('most') || q.includes('dangerous')) {
    text = handleSituation(state)
  }
  // If city was detected but didn't match above patterns, still answer about city
  else if (city) {
    text = handleCityQuery(city, state)
  }
  // City was detected but not in our flood database
  else if (city) {
    text = `MyRadar Assessment — ${city}\n\n${city} is not currently in an active flood monitoring zone.\n\nNational status: ${state.severity} severity | ${state.floodRisk}% risk\nAvg water level: ${state.averageWaterLevel.toFixed(1)}m\n\nActively monitored: Mumbai, Patna, Guwahati, Kolkata, Chennai, Bhubaneswar, Hyderabad\n\nFor ${city}: No IMD Red/Orange alert issued. Standard monsoon precautions advised.\nNearest NDRF battalion can be deployed within 4-6 hours if situation escalates.`
  }
  // Smart fallback
  else {
    text = handleGeneral(query, state)
  }

  return { text, mode: 'LOCAL', confidence: 'HIGH' }
}

/** Suggested queries shown in the AI panel */
export const SUGGESTED_QUERIES = [
  'What is the situation in Mumbai?',
  'What is happening in Patna?',
  'Delhi situation update',
  'Which shelter is safest?',
  'Which roads are blocked?',
  'Where should relief go next?',
  'What is the national situation?',
  'What is the most critical problem?',
  'Recommend the next action',
]
