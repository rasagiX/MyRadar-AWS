/**
 * GET /api/myradar/verify?id=INC-xxxx
 *   — look up a specific incident or sync event by its ID
 *
 * GET /api/myradar/verify?type=INCIDENT&limit=10
 *   — list the most recent incident records in DynamoDB
 *
 * GET /api/myradar/verify?type=NEW_INCIDENT&limit=10
 *   — list the most recent NEW_INCIDENT sync events
 *
 * Used in step 4 of the incident sync verification flow.
 */

import { NextRequest, NextResponse } from 'next/server'
import { GetCommand, ScanCommand } from '@aws-sdk/lib-dynamodb'
import { AWS_ENABLED, ddb, DDB_TABLE } from '@/lib/awsClients'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id    = searchParams.get('id')
  const type  = searchParams.get('type')    // INCIDENT | NEW_INCIDENT | <any eventType>
  const limit = Math.min(Number(searchParams.get('limit') ?? '20'), 100)

  if (!AWS_ENABLED) {
    return NextResponse.json({
      ok:      false,
      source:  'demo',
      message: 'AWS_ENABLED is false. Set AWS_ENABLED=true and provide credentials in .env.local to verify DynamoDB.',
      hint:    'In demo mode events are acknowledged but not written to DynamoDB.',
    }, { status: 200 })
  }

  // ── Look up a specific event/incident by ID ────────────────────────────────
  if (id) {
    // Try both the raw event key and the incident-specific key
    const keys = [id, `INC#${id.replace(/^INC#/, '')}`]
    const results = await Promise.all(
      keys.map(k =>
        ddb.send(new GetCommand({ TableName: DDB_TABLE, Key: { disaster_id: k } }))
          .catch(() => null)
      )
    )
    const items = results.map(r => r?.Item).filter(Boolean)

    return NextResponse.json({
      ok:        true,
      source:    'aws',
      table:     DDB_TABLE,
      queriedId: id,
      found:     items.length > 0,
      items,
    })
  }

  // ── Scan for recent events of a given type ─────────────────────────────────
  if (type) {
    try {
      const result = await ddb.send(new ScanCommand({
        TableName:        DDB_TABLE,
        FilterExpression: 'eventType = :t',
        ExpressionAttributeValues: { ':t': type },
        Limit:            limit,
      }))

      return NextResponse.json({
        ok:     true,
        source: 'aws',
        table:  DDB_TABLE,
        type,
        count:  result.Items?.length ?? 0,
        items:  result.Items ?? [],
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return NextResponse.json({
        ok:    false,
        source:'aws',
        error: msg,
        hint:  'Check AWS credentials and that the DynamoDB table exists with partition key "disaster_id" (String).',
      }, { status: 500 })
    }
  }

  // ── No params: return table health check ──────────────────────────────────
  try {
    const probe = await ddb.send(new ScanCommand({ TableName: DDB_TABLE, Limit: 1 }))
    return NextResponse.json({
      ok:         true,
      source:     'aws',
      table:      DDB_TABLE,
      accessible: true,
      sampleItem: probe.Items?.[0] ?? null,
      hint:       'Table is accessible. Use ?id=<eventId> or ?type=NEW_INCIDENT to query.',
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({
      ok:         false,
      source:     'aws',
      table:      DDB_TABLE,
      accessible: false,
      error:      msg,
      hint:       'Ensure the table exists, credentials are set, and the partition key is "disaster_id" (String).',
    }, { status: 500 })
  }
}
