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

// ─── City registry ────────────────────────────────────────────────────────────
const CITY_ALIASES: Record<string, string> = {
  'delhi': 'Delhi', 'new delhi': 'Delhi', 'ncr': 'Delhi',
  'mumbai': 'Mumbai', 'bombay': 'Mumbai', 'maharashtra': 'Mumbai',
  'patna': 'Patna', 'bihar': 'Patna',
  'guwahati': 'Guwahati', 'assam': 'Guwahati', 'brahmaputra': 'Guwahati',
  'kolkata': 'Kolkata', 'calcutta': 'Kolkata', 'west bengal': 'Kolkata', 'howrah': 'Kolkata',
  'chennai': 'Chennai', 'madras': 'Chennai', 'tamil nadu': 'Chennai', 'adyar': 'Chennai',
  'bhubaneswar': 'Bhubaneswar', 'odisha': 'Bhubaneswar', 'puri': 'Bhubaneswar',
  'hyderabad': 'Hyderabad', 'telangana': 'Hyderabad', 'musi': 'Hyderabad',
  'varanasi': 'Varanasi', 'banaras': 'Varanasi',
}

function detectCity(q: string): string | null {
  const sorted = Object.keys(CITY_ALIASES).sort((a, b) => b.length - a.length)
  for (const alias of sorted) {
    if (q.includes(alias)) return CITY_ALIASES[alias]
  }
  return null
}

// ─── Rule-based local AI ──────────────────────────────────────────────────────
function localAI(query: string): string {
  const q   = query.toLowerCase()
  const sum = getSummary()
  const shelters  = getShelters()
  const teams     = getRescueTeams()
  const unalerts  = getAlerts().filter(a => !a.acknowledged)
  const city      = detectCity(q)

  // ── City-specific query ──────────────────────────────────────────────────
  if (city) {
    const cityTeams    = teams.filter(t => t.sector === city || t.sector.includes(city))
    const cityShelters = shelters.filter(s => s.sector === city || s.sector.includes(city))

    if (city === 'Delhi' && cityTeams.length === 0) {
      return `MyRadar Assessment — Delhi
Time: ${new Date().toLocaleTimeString('en-IN', { hour12: true })}

Delhi is not currently in an active flood zone.
AIIMS Delhi Mobile Medical Unit is stationed here and available for rapid deployment.

National situation: ${sum.severity} severity | Flood risk ${sum.floodRisk}%
Most critical areas right now: Guwahati (Brahmaputra), Mumbai (Mithi River), Patna (Ganga)
Average water level nationally: ${sum.averageWaterLevel.toFixed(1)}m

Delhi teams can deploy to any affected state within 6 hours.
Ask me about Mumbai, Patna, Guwahati, Kolkata, or Chennai for a full city report.`
    }

    const lines: string[] = [
      `MyRadar Assessment — ${city}`,
      `Time: ${new Date().toLocaleTimeString('en-IN', { hour12: true })}`,
      '',
    ]

    if (cityTeams.length > 0) {
      const active = cityTeams.filter(t => t.status !== 'AVAILABLE' && t.status !== 'OFFLINE')
      lines.push(`RESCUE TEAMS: ${cityTeams.length} deployed, ${active.length} active`)
      active.slice(0, 4).forEach(t => {
        lines.push(`• ${t.id}: ${t.status}${t.mission ? ' — ' + t.mission : ''}`)
      })
      lines.push('')
    }

    if (cityShelters.length > 0) {
      lines.push(`SHELTERS (${cityShelters.length}):`)
      cityShelters.forEach(s => {
        const p = Math.round((s.occupancy / s.capacity) * 100)
        const needs: string[] = []
        if (s.waterLevel < 30) needs.push(`water ${s.waterLevel.toFixed(0)}%`)
        if (s.foodLevel < 30) needs.push(`food ${s.foodLevel.toFixed(0)}%`)
        if (s.medicineLevel < 30) needs.push(`medicine ${s.medicineLevel.toFixed(0)}%`)
        lines.push(`• ${s.name}: ${p}% full (${s.status})${needs.length ? ' — NEEDS: ' + needs.join(', ') : ''}`)
      })
      lines.push('')
    }

    lines.push(`National context: ${sum.severity} | ${sum.floodRisk}% flood risk | ${sum.activeIncidents} open incidents`)
    return lines.join('\n')
  }

  // ── National situation ────────────────────────────────────────────────────
  if (q.includes('situation') || q.includes('summary') || q.includes('overall') ||
      q.includes('national') || q.includes('status')) {
    return `MyRadar National Assessment — ${new Date().toLocaleTimeString('en-IN', { hour12: true })}

NATIONAL STATUS: ${sum.severity} | Flood Risk: ${sum.floodRisk}%
Average water level: ${sum.averageWaterLevel.toFixed(1)}m
Affected population: ${sum.affectedPeople.toLocaleString('en-IN')}
${sum.blockedRoads} roads blocked | ${sum.activeIncidents} open incidents
${sum.activeTeams}/${teams.length} rescue teams deployed
${unalerts.length} unacknowledged alerts

Most critical cities: Guwahati, Mumbai, Patna
Ask "Mumbai situation" or "Patna update" for a city-specific report.`
  }

  if (q.includes('shelter') && (q.includes('safe') || q.includes('best') || q.includes('which'))) {
    const safe = [...shelters].filter(s => s.status === 'SAFE').sort((a,b) => (a.occupancy/a.capacity) - (b.occupancy/b.capacity))
    if (!safe.length) return 'WARNING: No shelters currently at SAFE status across monitored cities.'
    const best = safe[0]
    return `Safest shelter: ${best.name} (${best.sector})
Occupancy: ${best.occupancy}/${best.capacity} (${Math.round(best.occupancy/best.capacity*100)}%)
Water: ${best.waterLevel.toFixed(0)}% | Food: ${best.foodLevel.toFixed(0)}% | Medicine: ${best.medicineLevel.toFixed(0)}%
Status: ${best.status}`
  }

  if (q.includes('water') && (q.includes('level') || q.includes('sensor'))) {
    return `National water levels:
• Brahmaputra (Guwahati): ~5.1m RISING — most critical
• Ganga floodplain (Patna): ~4.2m RISING
• Mithi River (Mumbai): ~2.8m RISING
• Adyar River (Chennai): ~3.1m RISING
• Hooghly (Kolkata): ~2.4m STABLE
Average: ${sum.averageWaterLevel.toFixed(2)}m | Flood risk: ${sum.floodRisk}%`
  }

  if (q.includes('road') || q.includes('block') || q.includes('avoid')) {
    return `Roads currently blocked or flooded across India:
• NH-48 Mumbai-Pune — FLOODED (1.8m flash flood)
• Patna-Hajipur Bridge approach — BLOCKED (Ganga embankment breach)
• NH-12 Bhubaneswar — FLOODED (2.4m Mahanadi overflow)
• West Industrial Road — BLOCKED (fallen structure)
Evacuation routes: Gandhi Setu (Patna), NH-27 Guwahati Bypass, ECR Chennai remain open.`
  }

  if (q.includes('team') || q.includes('rescue') || q.includes('ndrf') || q.includes('deploy')) {
    const active = teams.filter(t => t.status !== 'AVAILABLE' && t.status !== 'OFFLINE')
    return `Rescue teams: ${active.length} active, ${teams.filter(t=>t.status==='AVAILABLE').length} available
${active.slice(0,5).map(t => `• ${t.id}: ${t.status} — ${t.mission ?? 'No mission'}`).join('\n')}`
  }

  if (q.includes('relief') || q.includes('supply') || q.includes('food') || q.includes('medicine')) {
    const critical = shelters.filter(s => s.waterLevel < 30 || s.foodLevel < 30 || s.medicineLevel < 30)
    if (!critical.length) return 'All shelter supply levels are currently adequate.'
    const top = critical.sort((a,b) => (a.waterLevel+a.foodLevel+a.medicineLevel)-(b.waterLevel+b.foodLevel+b.medicineLevel))[0]
    const needs: string[] = []
    if (top.waterLevel < 30) needs.push(`Water (${top.waterLevel.toFixed(0)}%)`)
    if (top.foodLevel < 30) needs.push(`Food (${top.foodLevel.toFixed(0)}%)`)
    if (top.medicineLevel < 30) needs.push(`Medicine (${top.medicineLevel.toFixed(0)}%)`)
    return `Priority relief delivery needed at ${top.name} (${top.sector}):
Critical supplies: ${needs.join(', ')}
Occupancy: ${top.occupancy}/${top.capacity}
Dispatch available relief vehicle immediately.`
  }

  if (q.includes('recommend') || q.includes('what should') || q.includes('next action') || q.includes('priority')) {
    return `Top recommended actions:
1. Guwahati — Brahmaputra at 5.1m, island communities need helicopter evacuation
2. Patna — Digha Colony flood depth 3.1m, NDRF Battalion 2 needs reinforcement
3. Mumbai — West Park Shelter critical supply shortage, dispatch RV-03
4. Kolkata — Salt Lake Stadium at 97% capacity, open overflow facility

Teams available for deployment: ${teams.filter(t=>t.status==='AVAILABLE').map(t=>t.id).join(', ') || 'None'}`
  }

  // Default — still useful
  return `MyRadar AI — ${sum.severity} situation | ${sum.floodRisk}% flood risk
${sum.affectedPeople.toLocaleString('en-IN')} people affected | ${sum.activeIncidents} open incidents

Ask me about a specific city: "Mumbai situation", "Patna update", "Delhi status"
Or ask: "blocked roads", "safest shelter", "relief needs", "team status", "water levels"`
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
