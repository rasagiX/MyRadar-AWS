/**
 * GET /api/myradar/sensors
 *
 * Returns all sensor readings.
 * AWS path: DynamoDB scan on pk = SENSOR#*
 * Demo path: returns seed sensor data with a small drift applied.
 */

import { NextResponse } from 'next/server'
import { AWS_ENABLED, ddb, DDB_TABLE } from '@/lib/awsClients'
import { ScanCommand } from '@aws-sdk/lib-dynamodb'

export async function GET() {
  if (AWS_ENABLED) {
    try {
      const result = await ddb.send(new ScanCommand({
        TableName: DDB_TABLE,
        FilterExpression: 'begins_with(pk, :prefix)',
        ExpressionAttributeValues: { ':prefix': 'SENSOR#' },
      }))
      return NextResponse.json({ ok: true, source: 'aws', data: result.Items ?? [] })
    } catch (err) {
      console.error('[sensors] DynamoDB error:', err)
    }
  }

  // Demo: return seed readings with tiny random drift so values "move"
  const drift = (base: number, range: number) =>
    parseFloat((base + (Math.random() - 0.5) * range).toFixed(2))

  return NextResponse.json({
    ok: true,
    source: 'demo',
    data: [
      { id: 'W-01', type: 'WATER_LEVEL', reading: drift(1.2, 0.1), unit: 'm', trend: 'STABLE', battery: 91, status: 'ONLINE', lastUpdated: new Date().toISOString() },
      { id: 'W-02', type: 'WATER_LEVEL', reading: drift(1.8, 0.15), unit: 'm', trend: 'RISING', battery: 76, status: 'ONLINE', lastUpdated: new Date().toISOString() },
      { id: 'W-07', type: 'WATER_LEVEL', reading: drift(2.7, 0.1), unit: 'm', trend: 'RISING', battery: 82, status: 'ONLINE', lastUpdated: new Date().toISOString() },
      { id: 'R-01', type: 'RAINFALL', reading: drift(48.2, 2), unit: 'mm/hr', trend: 'RISING', battery: 68, status: 'ONLINE', lastUpdated: new Date().toISOString() },
      { id: 'T-01', type: 'TEMPERATURE', reading: drift(28.4, 0.2), unit: '°C', trend: 'STABLE', battery: 95, status: 'ONLINE', lastUpdated: new Date().toISOString() },
      { id: 'S-01', type: 'STRUCTURAL', reading: drift(87.3, 0.5), unit: '%', trend: 'FALLING', battery: 55, status: 'DEGRADED', lastUpdated: new Date().toISOString() },
    ],
  })
}
