/**
 * GET  /api/myradar/alerts           — all alerts (query: ?unacked=true&limit=N)
 * POST /api/myradar/alerts            — create a new alert (internal use)
 * POST /api/myradar/alerts/[id]/acknowledge — acknowledge an alert
 *
 * AWS path: DynamoDB scan on pk = ALERT#*
 * Demo path: returns seed alerts with timestamps refreshed
 */

import { NextRequest, NextResponse } from 'next/server'
import { AWS_ENABLED, ddb, DDB_TABLE } from '@/lib/awsClients'
import { ScanCommand, PutCommand } from '@aws-sdk/lib-dynamodb'

function shortId() { return Math.random().toString(36).slice(2, 10).toUpperCase() }

function demoAlerts() {
  return [
    { id: 'AL-01', severity: 'CRITICAL', title: 'Extreme Flood Warning',    message: 'Brahmaputra breached banks at Guwahati. 3.8 lakh people at risk.', timestamp: new Date().toLocaleTimeString('en-GB',{hour12:false}), acknowledged: false },
    { id: 'AL-02', severity: 'CRITICAL', title: 'Mumbai Coastal Alert',     message: 'IMD issues Red Alert for Mumbai. Mithi River at 2.8m, rising.',    timestamp: new Date().toLocaleTimeString('en-GB',{hour12:false}), acknowledged: false },
    { id: 'AL-03', severity: 'WARNING',  title: 'Patna Road Blocked',       message: 'Patna-Hajipur bridge approach flooded. Alternate route via Gandhi Setu.', timestamp: new Date().toLocaleTimeString('en-GB',{hour12:false}), acknowledged: false },
    { id: 'AL-04', severity: 'RESCUE',   title: 'NDRF Deployed Patna',      message: 'NDRF Battalion 2 conducting rescue ops at Digha Colony. 320 trapped.',   timestamp: new Date().toLocaleTimeString('en-GB',{hour12:false}), acknowledged: false },
    { id: 'AL-05', severity: 'SHELTER',  title: 'Kolkata Shelter Critical', message: 'Salt Lake Stadium at 97% capacity. Overflow arrangements needed.',        timestamp: new Date().toLocaleTimeString('en-GB',{hour12:false}), acknowledged: false },
    { id: 'AL-06', severity: 'SUPPLY',   title: 'Supply Shortage Kolkata',  message: 'SC-03 at low stock. Water and food for 48h only. Emergency resupply.',    timestamp: new Date().toLocaleTimeString('en-GB',{hour12:false}), acknowledged: true  },
    { id: 'AL-07', severity: 'WARNING',  title: 'Howrah Bridge Degraded',   message: 'Structural sensor at 76.4% integrity. Load restrictions imposed.',         timestamp: new Date().toLocaleTimeString('en-GB',{hour12:false}), acknowledged: true  },
    { id: 'AL-08', severity: 'CRITICAL', title: 'Chemical Hazard Andheri',  message: 'MIDC chemical plant flooded. 1km evacuation radius enforced.',             timestamp: new Date().toLocaleTimeString('en-GB',{hour12:false}), acknowledged: false },
  ]
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const unackedOnly = searchParams.get('unacked') === 'true'
  const limit = Number(searchParams.get('limit') || '50')

  if (AWS_ENABLED) {
    try {
      const result = await ddb.send(new ScanCommand({
        TableName: DDB_TABLE,
        FilterExpression: 'begins_with(pk, :prefix)',
        ExpressionAttributeValues: { ':prefix': 'ALERT#' },
        Limit: limit,
      }))
      let data = result.Items ?? []
      if (unackedOnly) data = data.filter((a: Record<string,unknown>) => !a.acknowledged)
      return NextResponse.json({ ok: true, source: 'aws', data, total: data.length })
    } catch (err) {
      console.error('[alerts] DynamoDB error:', err)
    }
  }

  let data = demoAlerts()
  if (unackedOnly) data = data.filter(a => !a.acknowledged)
  return NextResponse.json({ ok: true, source: 'demo', data: data.slice(0, limit), total: data.length })
}

export async function POST(req: NextRequest) {
  const body = await req.json() as { severity: string; title: string; message: string }
  const alert = {
    id: `AL-${shortId()}`,
    severity: body.severity ?? 'INFO',
    title: body.title ?? 'System Alert',
    message: body.message ?? '',
    timestamp: new Date().toLocaleTimeString('en-GB', { hour12: false }),
    acknowledged: false,
  }

  if (AWS_ENABLED) {
    try {
      await ddb.send(new PutCommand({
        TableName: DDB_TABLE,
        Item: { pk: `ALERT#${alert.id}`, sk: 'META', ...alert, createdAt: new Date().toISOString() },
      }))
      return NextResponse.json({ ok: true, source: 'aws', data: alert }, { status: 201 })
    } catch (err) {
      console.error('[alerts POST] DynamoDB error:', err)
    }
  }

  return NextResponse.json({ ok: true, source: 'demo', data: alert }, { status: 201 })
}
