import { NextResponse } from 'next/server'
import { NextRequest } from 'next/server'
import { AWS_ENABLED, ddb, DDB_TABLE } from '@/lib/awsClients'
import { ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'

export async function GET() {
  if (AWS_ENABLED) {
    try {
      const result = await ddb.send(new ScanCommand({
        TableName: DDB_TABLE,
        FilterExpression: 'begins_with(pk, :prefix)',
        ExpressionAttributeValues: { ':prefix': 'TEAM#' },
      }))
      return NextResponse.json({ ok: true, source: 'aws', data: result.Items ?? [] })
    } catch (err) {
      console.error('[teams] DynamoDB error:', err)
    }
  }
  return NextResponse.json({ ok: true, source: 'demo', data: [] })
}

export async function PATCH(req: NextRequest) {
  const body = await req.json() as { id: string; status: string; mission?: string }
  if (!body.id || !body.status) {
    return NextResponse.json({ ok: false, error: 'id and status required' }, { status: 400 })
  }

  if (AWS_ENABLED) {
    try {
      await ddb.send(new UpdateCommand({
        TableName: DDB_TABLE,
        Key: { pk: `TEAM#${body.id}`, sk: 'META' },
        UpdateExpression: 'SET #s = :s, mission = :m, updatedAt = :t',
        ExpressionAttributeNames: { '#s': 'status' },
        ExpressionAttributeValues: {
          ':s': body.status,
          ':m': body.mission ?? null,
          ':t': new Date().toISOString(),
        },
      }))
      return NextResponse.json({ ok: true, source: 'aws', updated: body.id })
    } catch (err) {
      console.error('[teams PATCH] DynamoDB error:', err)
    }
  }

  return NextResponse.json({ ok: true, source: 'demo', updated: body.id })
}
