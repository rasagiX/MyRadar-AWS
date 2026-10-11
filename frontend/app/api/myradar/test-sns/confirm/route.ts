/**
 * GET /api/myradar/test-sns/confirm
 *
 * Programmatically confirms a pending SNS email subscription
 * using the SubscribeURL token from the confirmation email.
 *
 * Usage:
 *   1. Find the confirmation email from AWS
 *   2. Right-click "Confirm subscription" → Copy link address
 *   3. That URL contains a Token parameter
 *   4. Paste just the Token value as ?token=xxxxx to this route
 *
 * OR: use ?auto=true to re-subscribe and get AWS to resend the email
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  ConfirmSubscriptionCommand,
  SubscribeCommand,
  ListSubscriptionsByTopicCommand,
  UnsubscribeCommand,
} from '@aws-sdk/client-sns'
import { snsClient, SNS_TOPIC_ARN, AWS_ENABLED } from '@/lib/awsClients'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const token   = searchParams.get('token')
  const resubscribe = searchParams.get('resub') === 'true'
  const email   = searchParams.get('email') ?? 'aggrashi974@gmail.com'

  if (!AWS_ENABLED || !SNS_TOPIC_ARN) {
    return NextResponse.json({
      ok: false,
      error: 'AWS_ENABLED or SNS_TOPIC_ARN not set',
    })
  }

  // ── Option A: confirm with token from confirmation email URL ──────────────
  if (token) {
    try {
      const result = await snsClient.send(new ConfirmSubscriptionCommand({
        TopicArn:                     SNS_TOPIC_ARN,
        Token:                        token,
        AuthenticateOnUnsubscribe:    'false',
      }))
      return NextResponse.json({
        ok:              true,
        confirmed:       true,
        subscriptionArn: result.SubscriptionArn,
        message:         '✅ Subscription confirmed! SNS emails will now be delivered.',
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return NextResponse.json({ ok: false, error: msg }, { status: 500 })
    }
  }

  // ── Option B: delete pending and re-subscribe (resends confirmation email) ─
  if (resubscribe) {
    try {
      // Delete any pending subscriptions for this email
      const subs = await snsClient.send(new ListSubscriptionsByTopicCommand({
        TopicArn: SNS_TOPIC_ARN,
      }))
      for (const sub of subs.Subscriptions ?? []) {
        if (sub.Endpoint === email && sub.SubscriptionArn === 'PendingConfirmation') {
          // Can't unsubscribe a pending sub via API — just re-subscribe
          // AWS will send a new confirmation email
        }
      }

      // Re-subscribe (sends a fresh confirmation email)
      await snsClient.send(new SubscribeCommand({
        TopicArn: SNS_TOPIC_ARN,
        Protocol: 'email',
        Endpoint: email,
      }))

      return NextResponse.json({
        ok:      true,
        message: `✅ New confirmation email sent to ${email}. Check inbox AND spam folder within 60 seconds.`,
        steps: [
          `1. Open Gmail → search: from:sns.amazonaws.com`,
          `2. Check Spam folder too`,
          `3. Click "Confirm subscription" link in the email`,
          `4. Then run: http://localhost:3000/api/myradar/test-sns`,
        ],
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return NextResponse.json({ ok: false, error: msg }, { status: 500 })
    }
  }

  // ── Default: show current subscription status ─────────────────────────────
  try {
    const subs = await snsClient.send(new ListSubscriptionsByTopicCommand({
      TopicArn: SNS_TOPIC_ARN,
    }))
    return NextResponse.json({
      ok:            true,
      subscriptions: subs.Subscriptions?.map(s => ({
        endpoint: s.Endpoint,
        protocol: s.Protocol,
        status:   s.SubscriptionArn === 'PendingConfirmation'
          ? 'PENDING — email not yet confirmed'
          : 'CONFIRMED',
        arn: s.SubscriptionArn,
      })),
      actions: {
        resend_email:    `http://localhost:3000/api/myradar/test-sns/confirm?resub=true&email=${email}`,
        confirm_by_token:`http://localhost:3000/api/myradar/test-sns/confirm?token=PASTE_TOKEN_HERE`,
      },
      hint: 'To confirm: find the AWS email in Gmail (check spam), right-click "Confirm subscription", copy the URL, extract the Token= parameter, then use the confirm_by_token URL above.',
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
