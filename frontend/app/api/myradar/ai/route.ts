/**
 * POST /api/myradar/ai
 *
 * Body: { query: string, context?: object }
 *
 * AWS path: Amazon Bedrock (Claude 3 Sonnet)
 * Demo path: local rule-based engine
 */

import { NextRequest, NextResponse } from 'next/server'
import { AWS_ENABLED, bedrockClient, BEDROCK_MODEL } from '@/lib/awsClients'
import { InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime'

interface ReqBody { query: string; context?: Record<string, unknown> }

// ── Local rule engine (used when Bedrock not enabled) ──────────────
function localAnswer(query: string, ctx?: Record<string, unknown>): string {
  const q = query.toLowerCase()

  if (q.includes('situation') || q.includes('summary') || q.includes('overall')) {
    const risk = (ctx?.floodRisk as number) ?? 32
    const affected = (ctx?.affectedPeople as number) ?? 12480
    const wl = (ctx?.averageWaterLevel as number) ?? 1.2
    return `MyRadar System Assessment — ${new Date().toLocaleTimeString()}

Severity: ${(ctx?.severity as string) ?? 'HIGH'} | Flood Risk: ${risk}%
Average water level: ${wl.toFixed(1)} m | Affected: ${affected.toLocaleString()}
Active incidents: ${(ctx?.activeIncidents as number) ?? 7}
Teams deployed: ${(ctx?.activeTeams as number) ?? 8}
${(ctx?.topAlerts as string[])?.slice(0,3).map((a: string) => `• ${a}`).join('\n') ?? ''}`
  }

  if (q.includes('shelter') && (q.includes('safe') || q.includes('best'))) {
    return `Safest shelter: Riverside Community Center (Sector 3)\nOccupancy: 53% (420/800)\nWater: 55% · Food: 72% · Medicine: 68%\nStatus: SAFE`
  }

  if (q.includes('road') || q.includes('block')) {
    return `3 major routes blocked or flooded across India:\n• NH-48 Mumbai-Pune — FLOODED (1.8m)\n• Patna-Hajipur Bridge — BLOCKED (Ganga embankment breach)\n• NH-12 Bhubaneswar — FLOODED (2.4m Mahanadi overflow)\nGandhi Setu Patna and NH-27 Guwahati Bypass remain open.`
  }

  if (q.includes('water') || q.includes('level') || q.includes('flood')) {
    return `Average water level: ${(ctx?.averageWaterLevel as number)?.toFixed(2) ?? '1.20'} m\nFlood risk: ${(ctx?.floodRisk as number) ?? 32}%\nSensor W-07 reading 2.70 m (RISING) — highest in network.`
  }

  if (q.includes('relief') || q.includes('supply')) {
    return `Priority relief delivery needed at West Park Shelter (SH-05):\nCritical: Water (18%), Food (22%), Medicine (15%)\nOccupancy: 98% (492/500)\nDispatch RV-02 (AVAILABLE) immediately.`
  }

  if (q.includes('team') || q.includes('rescue')) {
    return `8 teams currently deployed:\n• R-01: RESCUING — Building 19 extraction\n• R-07: RESCUING — Building 22 extraction\n• R-11: RESPONDING — Gas leak Zone 5\n2 teams AVAILABLE: R-03, R-08`
  }

  return `MyRadar AI — Severity: ${(ctx?.severity as string) ?? 'HIGH'}\nFlood risk ${(ctx?.floodRisk as number) ?? 32}% | Water ${(ctx?.averageWaterLevel as number)?.toFixed(1) ?? '1.2'} m\n\nAsk about: situation · shelters · roads · water levels · relief · rescue teams`
}

export async function POST(req: NextRequest) {
  const body = await req.json() as ReqBody
  const { query, context } = body

  if (!query?.trim()) {
    return NextResponse.json({ ok: false, error: 'query is required' }, { status: 400 })
  }

  // ── Bedrock path ─────────────────────────────────────────────────
  if (AWS_ENABLED) {
    try {
      const systemPrompt = `You are MyRadar AI, an expert disaster response intelligence assistant.
You have access to live data from sensors, rescue teams, shelters, and flood zones.
Be concise, factual, and actionable. Use the provided context.
Current context: ${JSON.stringify(context ?? {})}`

      const payload = {
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 512,
        system: systemPrompt,
        messages: [{ role: 'user', content: query }],
      }

      const command = new InvokeModelCommand({
        modelId: BEDROCK_MODEL,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify(payload),
      })

      const response = await bedrockClient.send(command)
      const decoded  = JSON.parse(new TextDecoder().decode(response.body)) as {
        content: Array<{ type: string; text: string }>
      }
      const text = decoded.content?.[0]?.text ?? 'No response from Bedrock.'

      return NextResponse.json({ ok: true, data: { text, mode: 'CLOUD', confidence: 'HIGH' } })
    } catch (err) {
      console.error('[ai] Bedrock error:', err)
      // Fall through to local
    }
  }

  // ── Local fallback ────────────────────────────────────────────────
  const text = localAnswer(query, context)
  return NextResponse.json({ ok: true, data: { text, mode: 'LOCAL', confidence: 'HIGH' } })
}
