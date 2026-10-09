import { NextRequest, NextResponse } from 'next/server'
import { AWS_ENABLED, ddb, DDB_TABLE } from '@/lib/awsClients'
import { PutCommand } from '@aws-sdk/lib-dynamodb'
import type { SyncQueueItem } from '@/types/disaster'

interface SyncBody {
  events:   SyncQueueItem[]
  deviceId: string
  timestamp:string
}

export async function POST(req: NextRequest) {
  const body = await req.json() as SyncBody
  const { events = [], deviceId } = body

  if (!Array.isArray(events)) {
    return NextResponse.json({ ok: false, error: 'events must be an array' }, { status: 400 })
  }

  let processed = 0
  let failed    = 0

  if (AWS_ENABLED) {
    for (const event of events) {
      try {
        await ddb.send(new PutCommand({
          TableName: DDB_TABLE,
          Item: {
            pk:        `SYNC#${event.id}`,
            sk:        event.timestamp,
            eventType: event.eventType,
            payload:   event.payload,
            deviceId,
            version:   event.version,
            syncedAt:  new Date().toISOString(),
          },
        }))
        processed++
      } catch (err) {
        console.error('[sync] DynamoDB error for event', event.id, err)
        failed++
      }
    }
  } else {
    // Demo: just acknowledge everything
    processed = events.length
  }

  return NextResponse.json({
    ok:        true,
    source:    AWS_ENABLED ? 'aws' : 'demo',
    received:  events.length,
    processed,
    failed,
    serverTime:new Date().toISOString(),
  })
}
