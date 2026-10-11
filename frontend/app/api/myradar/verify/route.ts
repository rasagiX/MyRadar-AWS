/**
 * GET /api/myradar/verify
 *
 * Query DynamoDB to verify what has been written.
 *
 * ?id=INC-xxxx          — look up specific event or incident by ID
 * ?type=NEW_INCIDENT     — list recent incident events
 * ?type=SENSOR_READING   — list sensor readings from IoT Core
 * ?type=INCIDENT         — list dedicated incident records
 * ?prefix=SENSOR#        — scan by disaster_id prefix
 * (no params)            — table health check + counts by type
 */

import { NextRequest, NextResponse } from 'next/server'
import { GetCommand, ScanCommand } from '@aws-sdk/lib-dynamodb'
import { AWS_ENABLED, ddb, DDB_TABLE } from '@/lib/awsClients'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id     = searchParams.get('id')
  const type   = searchParams.get('type')
  const prefix = searchParams.get('prefix')
  const limit  = Math.min(Number(searchParams.get('limit') ?? '20'), 100)

  if (!AWS_ENABLED) {
    return NextResponse.json({
      ok:      false,
      source:  'demo',
      message: 'AWS_ENABLED is false. Set AWS_ENABLED=true and credentials in .env.local.',
    })
  }

  // ── Look up by specific ID ─────────────────────────────────────────────────
  if (id) {
    const keys = [id, `INC#${id.replace(/^INC#/, '')}`, `SENSOR#${id.replace(/^SENSOR#/, '')}`]
    const results = await Promise.all(
      keys.map(k =>
        ddb.send(new GetCommand({ TableName: DDB_TABLE, Key: { disaster_id: k } }))
          .catch(() => null)
      )
    )
    const items = results.map(r => r?.Item).filter(Boolean)
    return NextResponse.json({ ok: true, source: 'aws', table: DDB_TABLE, queriedId: id, found: items.length > 0, items })
  }

  // ── Scan by disaster_id prefix (e.g. prefix=SENSOR#) ─────────────────────
  if (prefix) {
    try {
      const result = await ddb.send(new ScanCommand({
        TableName:        DDB_TABLE,
        FilterExpression: 'begins_with(disaster_id, :p)',
        ExpressionAttributeValues: { ':p': prefix },
        Limit: limit,
      }))
      return NextResponse.json({
        ok:    true,
        source:'aws',
        table: DDB_TABLE,
        prefix,
        count: result.Items?.length ?? 0,
        items: result.Items ?? [],
      })
    } catch (err) {
      return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
    }
  }

  // ── Scan by eventType ─────────────────────────────────────────────────────
  if (type) {
    try {
      const result = await ddb.send(new ScanCommand({
        TableName:        DDB_TABLE,
        FilterExpression: 'eventType = :t',
        ExpressionAttributeValues: { ':t': type },
        Limit: limit,
      }))
      return NextResponse.json({
        ok:    true,
        source:'aws',
        table: DDB_TABLE,
        type,
        count: result.Items?.length ?? 0,
        items: result.Items ?? [],
      })
    } catch (err) {
      const msg = (err as Error).message
      return NextResponse.json({
        ok:    false,
        source:'aws',
        error: msg,
        hint:  'Check AWS credentials and that the DynamoDB table exists with partition key "disaster_id" (String).',
      }, { status: 500 })
    }
  }

  // ── Table health check + item counts ─────────────────────────────────────
  try {
    // Scan a small sample to show what's in the table
    const probe = await ddb.send(new ScanCommand({ TableName: DDB_TABLE, Limit: 50 }))
    const items = probe.Items ?? []

    // Count by eventType
    const counts: Record<string, number> = {}
    for (const item of items) {
      const t = (item.eventType as string) ?? 'unknown'
      counts[t] = (counts[t] ?? 0) + 1
    }

    return NextResponse.json({
      ok:            true,
      source:        'aws',
      table:         DDB_TABLE,
      accessible:    true,
      sampleCount:   items.length,
      countsByType:  counts,
      queries: {
        sensor_readings: `${req.nextUrl.origin}/api/myradar/verify?prefix=SENSOR%23&limit=10`,
        incidents:       `${req.nextUrl.origin}/api/myradar/verify?type=INCIDENT&limit=10`,
        sync_events:     `${req.nextUrl.origin}/api/myradar/verify?type=NEW_INCIDENT&limit=10`,
        all_sensors:     `${req.nextUrl.origin}/api/myradar/verify?type=SENSOR_READING&limit=10`,
      },
    })
  } catch (err) {
    const msg = (err as Error).message
    return NextResponse.json({
      ok:         false,
      source:     'aws',
      table:      DDB_TABLE,
      accessible: false,
      error:      msg,
      hint:       'Ensure the table exists with partition key "disaster_id" (String) and credentials are correct.',
    }, { status: 500 })
  }
}
