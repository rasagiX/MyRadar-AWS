/**
 * GET /api/myradar/iot/latest?sensor=W-01
 *
 * Reads the latest telemetry for a sensor from DynamoDB
 * (written by the IoT Core → Lambda → DynamoDB rule).
 *
 * GET /api/myradar/iot/latest   — returns latest reading for all sensors
 *
 * IoT Core Rule (set up in AWS Console):
 *   Rule query:  SELECT * FROM 'myradar/sensors/+'
 *   Action:      DynamoDB → myradar-disaster
 *                Hash key: disaster_id = ${sensorId}   (use ${topic(2)} in rule SQL)
 *                Range key: (none)
 *
 * This means every MQTT publish from the simulation or a real device
 * automatically lands in DynamoDB and can be read back here.
 */

import { NextRequest, NextResponse } from 'next/server'
import { GetCommand, ScanCommand } from '@aws-sdk/lib-dynamodb'
import { AWS_ENABLED, ddb, DDB_TABLE } from '@/lib/awsClients'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const sensorId = searchParams.get('sensor')

  if (!AWS_ENABLED) {
    return NextResponse.json({
      ok:     false,
      source: 'demo',
      message:'AWS_ENABLED is false. Set AWS_ENABLED=true and configure IoT Core to see real sensor data.',
    })
  }

  // ── Single sensor ─────────────────────────────────────────────────────────
  if (sensorId) {
    try {
      const result = await ddb.send(new GetCommand({
        TableName: DDB_TABLE,
        Key: { disaster_id: `SENSOR#${sensorId}` },
      }))
      return NextResponse.json({
        ok:     true,
        source: 'aws',
        sensor: sensorId,
        found:  !!result.Item,
        data:   result.Item ?? null,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return NextResponse.json({ ok: false, error: msg }, { status: 500 })
    }
  }

  // ── All sensors ───────────────────────────────────────────────────────────
  try {
    const result = await ddb.send(new ScanCommand({
      TableName:        DDB_TABLE,
      FilterExpression: 'begins_with(disaster_id, :prefix)',
      ExpressionAttributeValues: { ':prefix': 'SENSOR#' },
      Limit: 50,
    }))
    return NextResponse.json({
      ok:     true,
      source: 'aws',
      count:  result.Items?.length ?? 0,
      items:  result.Items ?? [],
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
