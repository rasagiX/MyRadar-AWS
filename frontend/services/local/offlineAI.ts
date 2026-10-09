/**
 * Offline AI — rule-based local assistant.
 * Used when network is unavailable and Amazon Bedrock is unreachable.
 * Produces deterministic answers from the current DisasterState.
 */

import type { DisasterState } from '@/types/disaster'

export interface AIResponse {
  text: string
  mode: 'CLOUD' | 'LOCAL'
  confidence: 'HIGH' | 'MEDIUM' | 'LOW'
}

function pct(occupancy: number, capacity: number) {
  return Math.round((occupancy / capacity) * 100)
}

function waterTrend(level: number): string {
  if (level > 3) return 'EXTREME'
  if (level > 2) return 'CRITICAL'
  if (level > 1) return 'HIGH'
  return 'MODERATE'
}

// ─── Query matchers ───────────────────────────────────────────────────────────
function handleSituation(state: DisasterState): string {
  const blocked = state.roads.filter(r => r.status === 'BLOCKED' || r.status === 'FLOODED').length
  const criticalShelters = state.shelters.filter(s => s.status === 'CRITICAL').length
  const maxWater = Math.max(...state.sensors.filter(s => s.type === 'WATER_LEVEL').map(s => s.reading))
  const teams = state.rescueTeams.filter(r => r.status !== 'AVAILABLE' && r.status !== 'OFFLINE').length

  return `NEXUS LOCAL ASSESSMENT — ${new Date().toLocaleTimeString()}

Flood conditions are ${waterTrend(state.averageWaterLevel)} across ${state.floodZones.length} active flood zones.
Average water level: ${state.averageWaterLevel.toFixed(1)}m. Peak sensor reading: ${maxWater.toFixed(1)}m.
${blocked} road${blocked !== 1 ? 's are' : ' is'} currently blocked or flooded.
${criticalShelters} shelter${criticalShelters !== 1 ? 's are' : ' is'} at critical capacity.
${teams} of ${state.rescueTeams.length} rescue teams are actively deployed.
${state.activeIncidentCount} open incident${state.activeIncidentCount !== 1 ? 's' : ''} require attention.
Flood risk index: ${state.floodRisk}%.`
}

function handleShelter(state: DisasterState): string {
  const safe = state.shelters
    .filter(s => s.status === 'SAFE')
    .sort((a, b) => pct(a.occupancy, a.capacity) - pct(b.occupancy, b.capacity))
  if (safe.length === 0) {
    return 'WARNING: No safe shelters currently available. All shelters are at WARNING or CRITICAL status. Consider overflow protocols.'
  }
  const best = safe[0]
  const available = best.capacity - best.occupancy
  return `Safest shelter: ${best.name} (${best.sector}).
Capacity: ${best.occupancy}/${best.capacity} (${pct(best.occupancy, best.capacity)}% occupied).
${available} spaces available.
Supplies — Water: ${best.waterLevel.toFixed(0)}% | Food: ${best.foodLevel.toFixed(0)}% | Medicine: ${best.medicineLevel.toFixed(0)}%.
Status: ${best.status}.`
}

function handleBlockedRoads(state: DisasterState): string {
  const blocked = state.roads.filter(r => r.status === 'BLOCKED' || r.status === 'FLOODED')
  if (blocked.length === 0) return 'All monitored roads are currently passable.'
  return `${blocked.length} blocked/flooded road${blocked.length !== 1 ? 's' : ''}:\n` +
    blocked.map(r => `• ${r.name} — ${r.status}${r.blockedReason ? ` (${r.blockedReason})` : ''}${r.waterDepth > 0 ? ` [${r.waterDepth}m water]` : ''}`).join('\n')
}

function handleRescueTeam(state: DisasterState, query: string): string {
  const teamMatch = query.match(/R-(\d+)/i)
  if (teamMatch) {
    const team = state.rescueTeams.find(t => t.id === `R-${teamMatch[1]}`)
    if (team) {
      return `Team ${team.id} (${team.name}):
Status: ${team.status}
Location: ${team.sector}
Mission: ${team.mission ?? 'None assigned'}
Battery/Fuel: ${team.battery.toFixed(0)}%`
    }
  }
  const available = state.rescueTeams.filter(r => r.status === 'AVAILABLE')
  if (available.length === 0) return 'All rescue teams are currently deployed. No available teams.'
  const best = available[0]
  return `Recommended next deployment: ${best.id} — ${best.name}.
Status: ${best.status} | Sector: ${best.sector} | Battery: ${best.battery.toFixed(0)}%.`
}

function handleRelief(state: DisasterState): string {
  const critical = state.shelters
    .filter(s => s.waterLevel < 25 || s.foodLevel < 25 || s.medicineLevel < 25)
    .sort((a, b) => (a.waterLevel + a.foodLevel + a.medicineLevel) - (b.waterLevel + b.foodLevel + b.medicineLevel))
  if (critical.length === 0) return 'All shelter supply levels are currently adequate.'
  const top = critical[0]
  const needed = []
  if (top.waterLevel < 25) needed.push(`Water (${top.waterLevel.toFixed(0)}%)`)
  if (top.foodLevel < 25) needed.push(`Food (${top.foodLevel.toFixed(0)}%)`)
  if (top.medicineLevel < 25) needed.push(`Medicine (${top.medicineLevel.toFixed(0)}%)`)
  return `Priority relief delivery needed:
Destination: ${top.name} (${top.sector})
Critical supplies: ${needed.join(', ')}
Occupancy: ${top.occupancy}/${top.capacity}
Assign available relief vehicle immediately.`
}

function handleWater(state: DisasterState): string {
  const sensors = state.sensors.filter(s => s.type === 'WATER_LEVEL').sort((a, b) => b.reading - a.reading)
  if (sensors.length === 0) return 'No water level sensors in database.'
  return `Current water level readings (${sensors.length} sensors):
${sensors.map(s => `• ${s.id}: ${s.reading.toFixed(2)}m — ${s.trend} [Battery: ${s.battery.toFixed(0)}%]`).join('\n')}
Average: ${state.averageWaterLevel.toFixed(2)}m`
}

function handleOfflineChanges(state: DisasterState): string {
  const q = state.syncQueue
  if (q.length === 0) return 'No offline events pending sync. System is current.'
  return `${q.length} events recorded while offline:
${q.slice(0, 8).map(e => `• [${e.timestamp.slice(11, 19)}] ${e.eventType}`).join('\n')}${q.length > 8 ? `\n... and ${q.length - 8} more.` : ''}
These will synchronize automatically when AWS connection is restored.`
}

function handleDefault(state: DisasterState): string {
  return `NEXUS LOCAL AI — Query not matched to a specific handler.

Current status: Severity ${state.severity} | Flood Risk ${state.floodRisk}%
Active incidents: ${state.activeIncidentCount}
Pending sync: ${state.syncQueueCount} events

Try asking: "situation", "safest shelter", "blocked roads", "where should relief go", "water levels", "offline changes".`
}

// ─── Main entry point ─────────────────────────────────────────────────────────
export function queryLocalAI(query: string, state: DisasterState): AIResponse {
  const q = query.toLowerCase()

  let text: string

  if (q.includes('situation') || q.includes('summary') || q.includes('status') || q.includes('overall')) {
    text = handleSituation(state)
  } else if (q.includes('shelter') && (q.includes('safe') || q.includes('best') || q.includes('which'))) {
    text = handleShelter(state)
  } else if (q.includes('block') || q.includes('road') || q.includes('avoid')) {
    text = handleBlockedRoads(state)
  } else if (q.includes('team') || q.includes('rescue') || q.includes('r-0') || q.includes('r-1')) {
    text = handleRescueTeam(state, query)
  } else if (q.includes('relief') || q.includes('supply') || q.includes('food') || q.includes('water') && q.includes('shelter')) {
    text = handleRelief(state)
  } else if (q.includes('water level') || q.includes('flood level') || q.includes('sensor')) {
    text = handleWater(state)
  } else if (q.includes('offline') || q.includes('sync') || q.includes('changed') || q.includes('while')) {
    text = handleOfflineChanges(state)
  } else if (q.includes('critical') || q.includes('urgent') || q.includes('priority') || q.includes('problem')) {
    text = handleSituation(state)
  } else {
    text = handleDefault(state)
  }

  return { text, mode: 'LOCAL', confidence: 'HIGH' }
}

/** Canned suggested queries for the UI */
export const SUGGESTED_QUERIES = [
  'What is the current situation?',
  'Which shelter is safest?',
  'Which roads are blocked?',
  'Where should the next relief go?',
  'What are the water levels?',
  'Where should Team R-07 go?',
  'What happened while we were offline?',
  'What is the most critical problem right now?',
  'Summarize the disaster.',
]
