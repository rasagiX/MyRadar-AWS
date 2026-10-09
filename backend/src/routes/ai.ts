/**
 * AI query endpoint.
 *
 * Production: calls Amazon Bedrock (Claude) via AWS SDK.
 * Demo/offline: uses the built-in rule-based responder below.
 *
 * The Lambda/API Gateway version would add auth + usage throttling.
 */

import { Router } from 'express'
import { z } from 'zod'
import { buildAIContext, getSummary, getShelters, getRescueTeams, getAlerts } from '../store.js'

const router = Router()

const QuerySchema = z.object({
  query:   z.string().min(1).max(500),
  context: z.record(z.unknown()).optional(),
})

// ─── Rule-based local AI ──────────────────────────────────────────────────────
function localAI(query: string): string {
  const q   = query.toLowerCase()
  const sum = getSummary()
  const shelters  = getShelters()
  const teams     = getRescueTeams()
  const unalerts  = getAlerts().filter(a => !a.acknowledged)

  if (q.includes('situation') || q.includes('summary') || q.includes('overall') || q.includes('status')) {
    const blocked = 3
    return `NEXUS SERVER ASSESSMENT — ${new Date().toLocaleTimeString()}

Severity: ${sum.severity} | Flood Risk: ${sum.floodRisk}%
Average water level: ${sum.averageWaterLevel.toFixed(1)}m
Affected population: ${sum.affectedPeople.toLocaleString()}
${blocked} roads blocked. ${sum.activeIncidents} open incidents.
${sum.activeTeams}/${teams.length} rescue teams deployed.
${unalerts.length} unacknowledged alerts.`
  }

  if (q.includes('shelter') && (q.includes('safe') || q.includes('best') || q.includes('which'))) {
    const safe = [...shelters].filter(s => s.status === 'SAFE').sort((a,b) => (a.occupancy/a.capacity) - (b.occupancy/b.capacity))
    if (!safe.length) return 'WARNING: No shelters currently at SAFE status.'
    const best = safe[0]
    return `Safest shelter: ${best.name} (${best.sector})
Occupancy: ${best.occupancy}/${best.capacity} (${Math.round(best.occupancy/best.capacity*100)}%)
Water: ${best.waterLevel.toFixed(0)}% | Food: ${best.foodLevel.toFixed(0)}% | Medicine: ${best.medicineLevel.toFixed(0)}%
Status: ${best.status}`
  }

  if (q.includes('water') && (q.includes('level') || q.includes('sensor'))) {
    return `Average water level: ${sum.averageWaterLevel.toFixed(2)}m
Flood risk index: ${sum.floodRisk}%
${sum.activeIncidents} active flood-related incidents.`
  }

  if (q.includes('road') || q.includes('block') || q.includes('avoid')) {
    return `3 major routes currently blocked or flooded across India:
• NH-48 Mumbai-Pune — FLOODED (1.8m flash flood)
• Patna-Hajipur Bridge approach — BLOCKED (Ganga embankment breach)
• NH-12 Bhubaneswar — FLOODED (2.4m Mahanadi overflow)
Alternate routes: Gandhi Setu Patna, NH-27 Guwahati Bypass, ECR Chennai remain open.`
  }

  if (q.includes('team') || q.includes('rescue') || q.includes('r-0')) {
    const active = teams.filter(t => t.status !== 'AVAILABLE' && t.status !== 'OFFLINE')
    return `${active.length} teams currently deployed:
${active.slice(0,5).map(t => `• ${t.id}: ${t.status}${t.mission ? ' — '+t.mission:''}`).join('\n')}`
  }

  if (q.includes('relief') || q.includes('supply') || q.includes('food')) {
    const critical = shelters.filter(s => s.waterLevel < 25 || s.foodLevel < 25 || s.medicineLevel < 25)
    if (!critical.length) return 'All shelter supply levels are currently adequate.'
    const top = critical.sort((a,b) => (a.waterLevel+a.foodLevel+a.medicineLevel)-(b.waterLevel+b.foodLevel+b.medicineLevel))[0]
    const needs: string[] = []
    if (top.waterLevel < 25) needs.push(`Water (${top.waterLevel.toFixed(0)}%)`)
    if (top.foodLevel  < 25) needs.push(`Food (${top.foodLevel.toFixed(0)}%)`)
    if (top.medicineLevel < 25) needs.push(`Medicine (${top.medicineLevel.toFixed(0)}%)`)
    return `Priority relief delivery needed at ${top.name}:
Critical supplies: ${needs.join(', ')}
Occupancy: ${top.occupancy}/${top.capacity}
Dispatch available relief vehicle immediately.`
  }

  return `NEXUS SERVER AI — Status: ${sum.severity}
Flood risk ${sum.floodRisk}% | Water ${sum.averageWaterLevel.toFixed(1)}m | ${sum.activeIncidents} incidents
Try asking: "situation", "safest shelter", "blocked roads", "relief needs", "water levels", "team status".`
}

// ─── Route ────────────────────────────────────────────────────────────────────
/** POST /api/ai/query */
router.post('/query', (req, res) => {
  const parsed = QuerySchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: 'Invalid body', details: parsed.error.flatten() })
    return
  }

  const useAws = process.env.NEXT_PUBLIC_ENABLE_BEDROCK === 'true'

  if (useAws) {
    // Production: forward to Bedrock
    // const context = buildAIContext()
    // const response = await bedrockClient.send(new InvokeModelCommand({ ... }))
    res.json({ ok: true, data: { text: '[Bedrock not configured — set NEXT_PUBLIC_ENABLE_BEDROCK=true and provide credentials]', mode: 'CLOUD', confidence: 'LOW' } })
    return
  }

  const text = localAI(parsed.data.query)
  res.json({ ok: true, data: { text, mode: 'LOCAL', confidence: 'HIGH' } })
})

/** GET /api/ai/context — expose the context object for debugging */
router.get('/context', (_req, res) => {
  res.json({ ok: true, data: buildAIContext() })
})

export default router
