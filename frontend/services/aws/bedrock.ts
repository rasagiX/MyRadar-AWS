/**
 * Bedrock / AI service — calls the Next.js API route which
 * either forwards to AWS Bedrock or uses the local rule engine.
 */

import { queryLocalAI, type AIResponse } from '@/services/local/offlineAI'
import type { DisasterState } from '@/types/disaster'

function buildContext(state: DisasterState) {
  return {
    severity:           state.severity,
    floodRisk:          state.floodRisk,
    affectedPeople:     state.affectedPeople,
    averageWaterLevel:  state.averageWaterLevel,
    activeIncidents:    state.activeIncidentCount,
    activeTeams:        state.rescueTeams.filter(t => t.status !== 'AVAILABLE' && t.status !== 'OFFLINE').length,
    blockedRoads:       state.roads.filter(r => r.status === 'BLOCKED' || r.status === 'FLOODED').length,
    shelterSummary:     state.shelters.map(s => `${s.name}: ${s.occupancy}/${s.capacity} (${s.status})`).join('; '),
    topAlerts:          state.alerts.filter(a => !a.acknowledged).slice(0, 5).map(a => `[${a.severity}] ${a.message}`),
  }
}

export async function queryDisasterAI(query: string, state: DisasterState): Promise<AIResponse> {
  // Always use local engine when offline
  if (state.networkStatus === 'OFFLINE') {
    return queryLocalAI(query, state)
  }

  try {
    const res = await fetch('/api/myradar/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, context: buildContext(state) }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) throw new Error(`AI API ${res.status}`)
    const { data } = await res.json() as { data: AIResponse }
    return data
  } catch {
    return queryLocalAI(query, state)
  }
}
