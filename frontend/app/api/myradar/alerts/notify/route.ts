/**
 * POST /api/myradar/alerts/notify
 *
 * Publishes a flood alert to Amazon SNS.
 * Subscribed phones receive an SMS; subscribed emails receive an email.
 *
 * Body: {
 *   severity:    'CRITICAL' | 'WARNING' | 'INFO'
 *   title:       string
 *   message:     string
 *   sensor?:     string   — sensor ID that triggered this
 *   waterLevel?: number   — current reading in metres
 *   location?:   string   — city / zone name
 * }
 *
 * Setup (one-time, in AWS Console):
 *   1. SNS → Topics → Create topic → Standard → name: myradar-flood-alerts
 *   2. Copy the ARN → paste into SNS_TOPIC_ARN in .env.local
 *   3. Subscribe phone:  Topics → myradar-flood-alerts → Create subscription
 *                        Protocol: SMS | Endpoint: +91xxxxxxxxxx
 *   4. Subscribe email:  Protocol: Email | Endpoint: you@email.com → confirm link
 */

import { NextRequest, NextResponse } from 'next/server'
import { PublishCommand } from '@aws-sdk/client-sns'
import { snsClient, SNS_TOPIC_ARN, AWS_ENABLED } from '@/lib/awsClients'

interface NotifyBody {
  severity:    'CRITICAL' | 'WARNING' | 'INFO' | 'RESCUE' | 'SHELTER' | 'SUPPLY'
  title:       string
  message:     string
  sensor?:     string
  waterLevel?: number
  location?:   string
}

// Map severity to SMS subject prefix
const SEVERITY_EMOJI: Record<string, string> = {
  CRITICAL: '🚨 CRITICAL',
  WARNING:  '⚠️ WARNING',
  RESCUE:   '🆘 RESCUE',
  SHELTER:  '🏠 SHELTER',
  SUPPLY:   '📦 SUPPLY',
  INFO:     'ℹ️ INFO',
}

export async function POST(req: NextRequest) {
  const body = await req.json() as NotifyBody
  const { severity, title, message, sensor, waterLevel, location } = body

  if (!title || !message) {
    return NextResponse.json({ ok: false, error: 'title and message are required' }, { status: 400 })
  }

  // ── Demo mode: log but don't publish ──────────────────────────────────────
  if (!AWS_ENABLED || !SNS_TOPIC_ARN) {
    const logMsg = `[SNS/demo] ${severity}: ${title} — ${message}`
    console.log(logMsg)
    return NextResponse.json({
      ok:      true,
      source:  'demo',
      message: 'SNS not configured. Set SNS_TOPIC_ARN in .env.local to enable real SMS/email alerts.',
      logged:  logMsg,
    })
  }

  // ── Build SMS message ─────────────────────────────────────────────────────
  const prefix  = SEVERITY_EMOJI[severity] ?? `[${severity}]`
  const locPart = location ? ` | Location: ${location}` : ''
  const wlPart  = waterLevel != null ? ` | Water: ${waterLevel.toFixed(2)}m` : ''
  const snsPart = sensor ? ` | Sensor: ${sensor}` : ''

  const smsBody = [
    `${prefix} — MyRadar Flood Alert`,
    `${title}`,
    `${message}${locPart}${wlPart}${snsPart}`,
    `Time: ${new Date().toLocaleTimeString('en-IN', { hour12: true, timeZone: 'Asia/Kolkata' })} IST`,
    'MyRadar Disaster Intelligence | myradar.app',
  ].join('\n')

  // ── Publish to SNS ────────────────────────────────────────────────────────
  try {
    const result = await snsClient.send(new PublishCommand({
      TopicArn: SNS_TOPIC_ARN,
      Subject:  `${prefix}: ${title}`,   // used in email subject line
      Message:  smsBody,
      MessageAttributes: {
        severity: { DataType: 'String', StringValue: severity },
        source:   { DataType: 'String', StringValue: 'myradar-sensor' },
      },
    }))

    console.log(`[SNS] published ${severity} alert, MessageId: ${result.MessageId}`)
    return NextResponse.json({
      ok:        true,
      source:    'aws',
      messageId: result.MessageId,
      severity,
      title,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[SNS] publish failed:', msg)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}

// ── GET /api/myradar/alerts/notify — health check ─────────────────────────────
export async function GET() {
  return NextResponse.json({
    ok:            true,
    configured:    !!(AWS_ENABLED && SNS_TOPIC_ARN),
    SNS_TOPIC_ARN: SNS_TOPIC_ARN ? `${SNS_TOPIC_ARN.slice(0, 30)}...` : '(not set)',
    hint: SNS_TOPIC_ARN
      ? 'SNS topic configured. POST to this endpoint to send an alert.'
      : 'Set SNS_TOPIC_ARN in .env.local. See AWS Console → SNS → Topics.',
  })
}
