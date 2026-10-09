import { NextResponse } from 'next/server'
import { AWS_ENABLED, ddb, DDB_TABLE } from '@/lib/awsClients'
import { ScanCommand } from '@aws-sdk/lib-dynamodb'

export async function GET() {
  if (AWS_ENABLED) {
    try {
      const result = await ddb.send(new ScanCommand({
        TableName: DDB_TABLE,
        FilterExpression: 'begins_with(pk, :prefix)',
        ExpressionAttributeValues: { ':prefix': 'SHELTER#' },
      }))
      return NextResponse.json({ ok: true, source: 'aws', data: result.Items ?? [] })
    } catch (err) {
      console.error('[shelters] DynamoDB error:', err)
    }
  }

  return NextResponse.json({ ok: true, source: 'demo', data: [] })
}
