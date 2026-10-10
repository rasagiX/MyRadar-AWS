/**
 * POST /api/myradar/sync
 *
 * Receives offline-queued events from the client and writes them to DynamoDB.
 * Idempotent: uses ConditionExpression so duplicate event IDs are silently skipped.
 *
 * DynamoDB table schema required:
 *   Table name : myradar-disaster   (or DYNAMODB_TABLE env var)
 *   Partition key: disaster_id  (String)
 *   Sort key: none
 *   Billing: On-demand (PAY_PER_REQUEST)
 */

import { NextRequest, NextResponse } from 'next/server'
import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb'
import { PutCommand } from '@aws-sdk/lib-dynamodb'
import { AWS_ENABLED, ddb, DDB_TABLE } from '@/lib/awsClients'
import type { SyncQueueItem } from '@/types/disaster'

interface SyncBody {
  events:    SyncQueueItem[]
  deviceId:  string
  timestamp: string
}

export async function POST(req: NextRequest) {
  // ── Parse body ──────────────────────────────────────────────────────────────
  let body: SyncBody
  try {
    body = await req.json() as SyncBody
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const { events, deviceId } = body

  // ── Validate ────────────────────────────────────────────────────────────────
  if (
    !Array.isArray(events) ||
    typeof deviceId !== 'string' ||
    events.some(e =>
      !e || typeof e.id !== 'string' || !e.id ||
      typeof e.eventType !== 'string' ||
      !e.payload || typeof e.payload !== 'object' ||
      typeof e.timestamp !== 'string',
    )
  ) {
    return NextResponse.json({ ok: false, error: 'Invalid sync payload' }, { status: 400 })
  }

  // ── Demo mode (no AWS creds) ─────────────────────────────────────────────────
  // Return success so the client clears its queue — events logged only.
  if (!AWS_ENABLED) {
    console.log(`[sync/demo] received ${events.length} events from ${deviceId}:`,
      events.map(e => `${e.eventType}:${e.id}`).join(', '))
    return NextResponse.json({
      ok:         true,
      source:     'demo',
      received:   events.length,
      processed:  events.length,
      failed:     0,
      serverTime: new Date().toISOString(),
    })
  }

  // ── AWS mode: write each event to DynamoDB ───────────────────────────────────
  let processed = 0
  let failed    = 0
  const errors: string[] = []

  for (const event of events) {
    try {
      // Build the base item shared by all event types
      const baseItem = {
        disaster_id:     event.id,          // Partition key
        eventType:       event.eventType,
        payload:         event.payload,
        deviceId,                           // from POST body (MYRADAR-LOCAL-01)
        version:         event.version ?? 1,
        eventTimestamp:  event.timestamp,
        syncedAt:        new Date().toISOString(),
      }

      // For NEW_INCIDENT events, also write a dedicated incident record so
      // it can be queried separately from the event log.
      if (event.eventType === 'NEW_INCIDENT') {
        const p = event.payload as Record<string, unknown>
        const incidentItem = {
          disaster_id:  `INC#${p.incidentId as string}`,
          eventType:    'INCIDENT',
          incidentId:   p.incidentId,
          type:         p.type,
          severity:     p.severity,
          description:  p.description,
          location:     p.location,
          reportedAt:   p.reportedAt,
          status:       p.status,
          deviceId,
          syncedAt:     new Date().toISOString(),
          sourceEventId:event.id,
        }

        // Write the incident record (idempotent)
        await ddb.send(new PutCommand({
          TableName: DDB_TABLE,
          Item: incidentItem,
          ConditionExpression: 'attribute_not_exists(disaster_id)',
        })).catch(err => {
          if (!(err instanceof ConditionalCheckFailedException)) throw err
          // Already exists — idempotent, that's fine
        })
      }

      // Always write the raw event log entry
      await ddb.send(new PutCommand({
        TableName: DDB_TABLE,
        Item: baseItem,
        ConditionExpression: 'attribute_not_exists(disaster_id)',
      }))

      processed++
    } catch (err) {
      if (err instanceof ConditionalCheckFailedException) {
        // Duplicate — treat as success (idempotent design)
        processed++
      } else {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`[sync] DynamoDB write failed for event ${event.id}:`, msg)
        errors.push(`${event.id}: ${msg}`)
        failed++
      }
    }
  }

  return NextResponse.json({
    ok:         failed === 0,
    source:     'aws',
    received:   events.length,
    processed,
    failed,
    errors:     errors.length > 0 ? errors : undefined,
    serverTime: new Date().toISOString(),
  })
}
