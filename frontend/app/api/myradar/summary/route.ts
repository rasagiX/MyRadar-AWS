/**
 * GET /api/myradar/summary
 *
 * Returns live disaster summary.
 * When AWS_ENABLED=true: reads from DynamoDB.
 * Otherwise: returns a computed summary from the simulation seed data.
 */

import { NextResponse } from 'next/server'
import { AWS_ENABLED, ddb, DDB_TABLE } from '@/lib/awsClients'
import { GetCommand } from '@aws-sdk/lib-dynamodb'

export async function GET() {
  if (AWS_ENABLED) {
    try {
      const result = await ddb.send(new GetCommand({
        TableName: DDB_TABLE,
        Key: { pk: 'DISASTER#CURRENT', sk: 'SUMMARY' },
      }))
      if (result.Item) {
        return NextResponse.json({ ok: true, source: 'aws', data: result.Item })
      }
    } catch (err) {
      console.error('[summary] DynamoDB error:', err)
    }
  }

  // Demo fallback
  return NextResponse.json({
    ok: true,
    source: 'demo',
    data: {
      severity: 'HIGH',
      floodRisk: 32,
      affectedPeople: 12480,
      averageWaterLevel: 1.2,
      activeIncidents: 7,
      blockedRoads: 3,
      activeShelters: 4,
      activeTeams: 8,
      lastUpdated: new Date().toISOString(),
    },
  })
}
