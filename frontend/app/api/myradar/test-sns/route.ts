/**
 * GET /api/myradar/test-sns
 * Direct SNS smoke test — shows exact error if publish fails.
 * Open in browser after restarting dev server.
 */
import { NextResponse } from 'next/server'
import { PublishCommand, ListSubscriptionsByTopicCommand } from '@aws-sdk/client-sns'
import { snsClient, SNS_TOPIC_ARN, AWS_ENABLED } from '@/lib/awsClients'

export async function GET() {
  const info = {
    AWS_ENABLED,
    SNS_TOPIC_ARN,
    HAS_KEY:    !!process.env.AWS_ACCESS_KEY_ID,
    KEY_PREFIX: process.env.AWS_ACCESS_KEY_ID?.slice(0, 8),
    REGION:     process.env.AWS_REGION,
  }

  if (!AWS_ENABLED) {
    return NextResponse.json({ ok: false, reason: 'AWS_ENABLED is false', info })
  }

  if (!SNS_TOPIC_ARN) {
    return NextResponse.json({ ok: false, reason: 'SNS_TOPIC_ARN is empty in .env.local', info })
  }

  // Step 1: Check subscriptions
  let subscriptions: unknown[] = []
  try {
    const subs = await snsClient.send(new ListSubscriptionsByTopicCommand({ TopicArn: SNS_TOPIC_ARN }))
    subscriptions = subs.Subscriptions?.map(s => ({
      endpoint: s.Endpoint,
      protocol: s.Protocol,
      status:   s.SubscriptionArn === 'PendingConfirmation' ? '⚠️ PENDING — check email inbox and click confirm link' : '✅ CONFIRMED',
    })) ?? []
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, step: 'ListSubscriptions', error: msg, info })
  }

  // Step 2: Try publishing
  try {
    const result = await snsClient.send(new PublishCommand({
      TopicArn: SNS_TOPIC_ARN,
      Subject:  '🧪 MyRadar SNS Test — working!',
      Message:  [
        'MyRadar SNS Test Message',
        '',
        'If you received this, SNS email alerts are working correctly.',
        '',
        `Sent at: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`,
        'From: MyRadar Disaster Intelligence Platform',
      ].join('\n'),
    }))

    return NextResponse.json({
      ok:            true,
      messageId:     result.MessageId,
      subscriptions,
      info,
      next:          'Check your email inbox (and spam folder) for the test message.',
    })
  } catch (err) {
    const msg  = err instanceof Error ? err.message : String(err)
    const name = err instanceof Error ? err.name    : 'UnknownError'
    return NextResponse.json({
      ok:            false,
      step:          'Publish',
      error:         msg,
      errorType:     name,
      subscriptions,
      info,
    }, { status: 500 })
  }
}
