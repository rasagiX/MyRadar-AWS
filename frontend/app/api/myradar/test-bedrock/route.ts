/**
 * GET /api/myradar/test-bedrock
 * Tries every available Bedrock model and returns which one works.
 * Open this in your browser to diagnose model access issues.
 */
import { NextResponse } from 'next/server'
import { bedrockClient, BEDROCK_MODEL, AWS_ENABLED, DDB_TABLE } from '@/lib/awsClients'
import { InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime'

// Build payload for each model family
function payload(modelId: string, prompt: string): string {
  if (modelId.startsWith('amazon.nova')) {
    return JSON.stringify({
      system:   [{ text: 'You are a test assistant.' }],
      messages: [{ role: 'user', content: [{ text: prompt }] }],
      inferenceConfig: { max_new_tokens: 20 },
    })
  }
  if (modelId.startsWith('amazon.titan')) {
    return JSON.stringify({
      inputText: `User: ${prompt}\nAssistant:`,
      textGenerationConfig: { maxTokenCount: 20, temperature: 0 },
    })
  }
  // Claude
  return JSON.stringify({
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: 20,
    messages: [{ role: 'user', content: prompt }],
  })
}

// Extract text from each model family response
function extract(modelId: string, body: Uint8Array): string {
  const d = JSON.parse(new TextDecoder().decode(body)) as Record<string, unknown>
  if (modelId.startsWith('amazon.nova')) {
    const out = d.output as { message?: { content?: Array<{ text?: string }> } } | undefined
    return out?.message?.content?.[0]?.text ?? JSON.stringify(d)
  }
  if (modelId.startsWith('amazon.titan')) {
    const r = d.results as Array<{ outputText?: string }> | undefined
    return r?.[0]?.outputText?.trim() ?? JSON.stringify(d)
  }
  const c = d.content as Array<{ text?: string }> | undefined
  return c?.[0]?.text ?? JSON.stringify(d)
}

export async function GET() {
  const info = {
    AWS_ENABLED,
    BEDROCK_MODEL,
    DDB_TABLE,
    AWS_REGION:  process.env.AWS_REGION,
    HAS_KEY:     !!process.env.AWS_ACCESS_KEY_ID,
    HAS_SECRET:  !!process.env.AWS_SECRET_ACCESS_KEY,
    KEY_PREFIX:  process.env.AWS_ACCESS_KEY_ID?.slice(0, 8),
  }

  if (!AWS_ENABLED) {
    return NextResponse.json({
      ok:     false,
      reason: 'AWS_ENABLED is false in .env.local',
      info,
    })
  }

  const models = [
    'amazon.nova-pro-v1:0',
    'amazon.nova-lite-v1:0',
    'amazon.nova-micro-v1:0',
    'amazon.titan-text-express-v1',
  ]

  const results: Record<string, string> = {}

  for (const modelId of models) {
    try {
      const cmd = new InvokeModelCommand({
        modelId,
        contentType: 'application/json',
        accept:      'application/json',
        body:        payload(modelId, 'Reply with exactly: OK'),
      })
      const res  = await bedrockClient.send(cmd)
      const text = extract(modelId, res.body)
      results[modelId] = `✅ WORKS — "${text.trim()}"`
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      results[modelId] = `❌ ${msg}`
    }
  }

  const working = Object.entries(results).filter(([, v]) => v.startsWith('✅')).map(([k]) => k)

  return NextResponse.json({
    ok:           working.length > 0,
    workingModels:working,
    allResults:   results,
    info,
    recommendation: working[0]
      ? `Set BEDROCK_MODEL_ID=${working[0]} in .env.local`
      : 'Go to AWS Bedrock Console → Model access → Enable Amazon Nova models',
  })
}
