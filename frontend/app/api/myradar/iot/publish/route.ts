/**
 * POST /api/myradar/iot/publish
 *
 * Publishes sensor telemetry from the simulation to AWS IoT Core via MQTT.
 * Each sensor reading becomes a message on topic: myradar/sensors/{sensorId}
 *
 * Body: {
 *   sensors: Array<{
 *     id:          string
 *     type:        string
 *     reading:     number
 *     unit:        string
 *     trend:       string
 *     battery:     number
 *     status:      string
 *     location:    { lat: number, lng: number }
 *     lastUpdated: string
 *   }>
 * }
 *
 * Setup (one-time, in AWS Console):
 *   1. IoT Core → Settings → copy the endpoint hostname
 *   2. Paste into AWS_IOT_ENDPOINT in .env.local (no https://)
 *   3. IAM → your user → Attach policies → AWSIoTDataAccess
 */

import { NextRequest, NextResponse } from 'next/server'
import { PublishCommand as IoTPublishCommand } from '@aws-sdk/client-iot-data-plane'
import { iotClient, IOT_TOPIC, AWS_ENABLED } from '@/lib/awsClients'

interface SensorPayload {
  id:          string
  type:        string
  reading:     number
  unit:        string
  trend:       string
  battery:     number
  status:      string
  location:    { lat: number; lng: number }
  lastUpdated: string
}

interface PublishBody {
  sensors: SensorPayload[]
}

export async function POST(req: NextRequest) {
  const body = await req.json() as PublishBody
  const { sensors } = body

  if (!Array.isArray(sensors) || sensors.length === 0) {
    return NextResponse.json({ ok: false, error: 'sensors array is required' }, { status: 400 })
  }

  const iotEndpoint = process.env.AWS_IOT_ENDPOINT

  // ── Demo / no IoT endpoint: log and return ────────────────────────────────
  if (!AWS_ENABLED || !iotEndpoint) {
    console.log(`[IoT/demo] would publish ${sensors.length} sensors to ${IOT_TOPIC}/*`)
    return NextResponse.json({
      ok:        true,
      source:    'demo',
      published: sensors.length,
      message:   'IoT not configured. Set AWS_IOT_ENDPOINT in .env.local to publish real MQTT messages.',
    })
  }

  // ── Publish each sensor to its own MQTT topic ─────────────────────────────
  let published = 0
  let failed    = 0
  const errors: string[] = []

  for (const sensor of sensors) {
    const topic   = `${IOT_TOPIC}/${sensor.id}`
    const payload = JSON.stringify({
      disaster_id: `SENSOR#${sensor.id}`,   // DynamoDB partition key written by IoT rule
      eventType:   'SENSOR_READING',         // makes it queryable via verify endpoint
      sensorId:    sensor.id,
      type:        sensor.type,
      reading:     sensor.reading,
      unit:        sensor.unit,
      trend:       sensor.trend,
      battery:     sensor.battery,
      status:      sensor.status,
      location:    sensor.location,
      lastUpdated: sensor.lastUpdated,
      publishedAt: new Date().toISOString(),
      source:      'myradar-simulation',
    })

    try {
      await iotClient.send(new IoTPublishCommand({
        topic,
        payload: Buffer.from(payload),
        qos:     1,   // at-least-once delivery
      }))
      published++
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(`${sensor.id}: ${msg}`)
      failed++
    }
  }

  return NextResponse.json({
    ok:        failed === 0,
    source:    'aws',
    published,
    failed,
    errors:    errors.length > 0 ? errors : undefined,
    topic:     `${IOT_TOPIC}/*`,
    serverTime:new Date().toISOString(),
  })
}

export async function GET() {
  return NextResponse.json({
    ok:          true,
    configured:  !!(AWS_ENABLED && process.env.AWS_IOT_ENDPOINT),
    endpoint:    process.env.AWS_IOT_ENDPOINT ? `${process.env.AWS_IOT_ENDPOINT.slice(0, 20)}...` : '(not set)',
    topicPrefix: IOT_TOPIC,
    hint: process.env.AWS_IOT_ENDPOINT
      ? `IoT endpoint configured. Sensors publish to ${IOT_TOPIC}/{sensorId}`
      : 'Set AWS_IOT_ENDPOINT in .env.local. AWS Console → IoT Core → Settings.',
  })
}
