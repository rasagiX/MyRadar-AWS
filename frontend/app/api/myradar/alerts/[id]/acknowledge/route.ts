/**
 * POST /api/myradar/alerts/[id]/acknowledge
 * Marks an alert as acknowledged — both locally (demo) and in DynamoDB (AWS).
 */

import { NextRequest, NextResponse } from 'next/server'
import { AWS_ENABLED, ddb, DDB_TABLE } from '@/lib/awsClients'
import { UpdateCommand } from '@aws-sdk/lib-dynamodb'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  if (!id) {
    return NextResponse.json({ ok: false, error: 'Alert ID required' }, { status: 400 })
  }

  if (AWS_ENABLED) {
    try {
      await ddb.send(new UpdateCommand({
        TableName: DDB_TABLE,
        Key: { pk: `ALERT#${id}`, sk: 'META' },
        UpdateExpression: 'SET acknowledged = :t, acknowledgedAt = :ts',
        ExpressionAttributeValues: {
          ':t':  true,
          ':ts': new Date().toISOString(),
        },
      }))
      return NextResponse.json({ ok: true, source: 'aws', id })
    } catch (err) {
      console.error('[alerts/acknowledge] DynamoDB error:', err)
    }
  }

  // Demo mode — just acknowledge in memory (state is managed client-side)
  return NextResponse.json({ ok: true, source: 'demo', id, acknowledged: true })
}
