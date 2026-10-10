/**
 * POST /api/myradar/ai
 *
 * Priority chain:
 *   1. Google Gemini   (if GEMINI_API_KEY is set)
 *   2. Amazon Bedrock  (if AWS_ENABLED and model access granted)
 *   3. Local rule-based engine (always available, offline-capable)
 *
 * Body: { query: string, context?: object }
 */

import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { AWS_ENABLED, bedrockClient, BEDROCK_MODEL } from '@/lib/awsClients'
import { InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime'

interface ReqBody { query: string; context?: Record<string, unknown> }

// ── Gemini client ─────────────────────────────────────────────────
const GEMINI_KEY   = process.env.GEMINI_API_KEY
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? 'gemini-1.5-flash'   // fast + free tier

// ── Bedrock helpers ───────────────────────────────────────────────
function isNovaModel(id: string)  { return id.startsWith('amazon.nova')  }
function isTitanModel(id: string) { return id.startsWith('amazon.titan') }

function buildBedrockPayload(modelId: string, system: string, user: string): string {
  if (isNovaModel(modelId)) {
    return JSON.stringify({
      system:   [{ text: system }],
      messages: [{ role: 'user', content: [{ text: user }] }],
      inferenceConfig: { max_new_tokens: 600, temperature: 0.3, top_p: 0.9 },
    })
  }
  if (isTitanModel(modelId)) {
    return JSON.stringify({
      inputText: `System: ${system}\n\nUser: ${user}\n\nAssistant:`,
      textGenerationConfig: { maxTokenCount: 600, temperature: 0.3, topP: 0.9 },
    })
  }
  // Claude
  return JSON.stringify({
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: 600,
    system,
    messages: [{ role: 'user', content: user }],
  })
}

function extractBedrockText(modelId: string, body: Uint8Array): string {
  const d = JSON.parse(new TextDecoder().decode(body)) as Record<string, unknown>
  if (isNovaModel(modelId)) {
    const out = d.output as { message?: { content?: Array<{ text?: string }> } } | undefined
    return out?.message?.content?.[0]?.text ?? ''
  }
  if (isTitanModel(modelId)) {
    const r = d.results as Array<{ outputText?: string }> | undefined
    return r?.[0]?.outputText?.trim() ?? ''
  }
  const c = d.content as Array<{ text?: string }> | undefined
  return c?.[0]?.text ?? ''
}

// ── City registry ─────────────────────────────────────────────────
const CITY_ALIASES: Record<string, string> = {
  'delhi':'Delhi','new delhi':'Delhi','ncr':'Delhi',
  'mumbai':'Mumbai','bombay':'Mumbai',
  'patna':'Patna','bihar':'Patna',
  'guwahati':'Guwahati','assam':'Guwahati','brahmaputra':'Guwahati',
  'kolkata':'Kolkata','calcutta':'Kolkata','howrah':'Kolkata',
  'chennai':'Chennai','madras':'Chennai','adyar':'Chennai',
  'bhubaneswar':'Bhubaneswar','odisha':'Bhubaneswar',
  'hyderabad':'Hyderabad','telangana':'Hyderabad',
  'varanasi':'Varanasi','banaras':'Varanasi',
  'agra':'Agra','mathura':'Agra',
  'lucknow':'Lucknow','up':'Lucknow','uttar pradesh':'Lucknow',
  'prayagraj':'Prayagraj','allahabad':'Prayagraj',
  'kanpur':'Kanpur',
  'jaipur':'Jaipur','rajasthan':'Jaipur',
  'ajmer':'Ajmer',
  'jodhpur':'Jodhpur',
  'kota':'Kota','rajsamand':'Kota',
  'udaipur':'Udaipur',
  'ahmedabad':'Ahmedabad','gujarat':'Ahmedabad','surat':'Ahmedabad',
  'pune':'Pune','nashik':'Pune',
  'bengaluru':'Bengaluru','bangalore':'Bengaluru','karnataka':'Bengaluru',
  'kochi':'Kochi','kerala':'Kochi','thiruvananthapuram':'Kochi',
  'vijayawada':'Vijayawada','andhra':'Vijayawada','andhra pradesh':'Vijayawada',
  'bhopal':'Bhopal','madhya pradesh':'Bhopal','indore':'Bhopal',
  'ranchi':'Ranchi','jharkhand':'Ranchi',
  'raipur':'Raipur','chhattisgarh':'Raipur',
  'nagpur':'Nagpur',
  'srinagar':'Srinagar','kashmir':'Srinagar','jammu':'Srinagar',
  'shimla':'Shimla','himachal':'Shimla','himachal pradesh':'Shimla',
  'dehradun':'Dehradun','uttarakhand':'Dehradun','haridwar':'Dehradun',
  'amritsar':'Amritsar','punjab':'Amritsar','ludhiana':'Amritsar',
  'chandigarh':'Chandigarh',
  'gurgaon':'Gurgaon','gurugram':'Gurgaon','noida':'Gurgaon','faridabad':'Gurgaon',
}
function detectCity(q: string): string | null {
  return Object.keys(CITY_ALIASES).sort((a,b)=>b.length-a.length).find(k=>q.includes(k)) ? CITY_ALIASES[Object.keys(CITY_ALIASES).sort((a,b)=>b.length-a.length).find(k=>q.includes(k))!] : null
}

// ── Local rule engine ─────────────────────────────────────────────
function localAnswer(query: string, ctx?: Record<string, unknown>): string {
  const q        = query.toLowerCase()
  const city     = detectCity(q)
  const severity = (ctx?.severity as string) ?? 'HIGH'
  const risk     = (ctx?.floodRisk as number) ?? 32
  const water    = (ctx?.averageWaterLevel as number) ?? 1.2
  const affected = (ctx?.affectedPeople as number) ?? 12480
  const alerts   = (ctx?.topAlerts as string[]) ?? []

  const CITY_DATA: Record<string, {flood:string;sensor:string;shelter:string;team:string}> = {
    Delhi:       {flood:'Not in active flood zone',     sensor:'No flood sensor',            shelter:'AIIMS Delhi: available',           team:'MED-01: AVAILABLE — ready to deploy'},
    Mumbai:      {flood:'2.8m CRITICAL — Mithi River',  sensor:'Mithi River: 2.8m RISING',   shelter:'NSCI Dome: 77% (WARNING)',         team:'NDRF-01: RESCUING Dharavi | COAST-01: Marine Drive'},
    Patna:       {flood:'4.2m CRITICAL — Ganga breach', sensor:'Ganga Sensor: 4.2m RISING',  shelter:'Patna Sahib: 95% (CRITICAL)',      team:'NDRF-02: RESCUING Digha Colony'},
    Guwahati:    {flood:'5.1m CRITICAL — Brahmaputra',  sensor:'Brahmaputra: 5.1m RISING',   shelter:'Guwahati Complex: 39% (SAFE)',     team:'NDRF-03: island evacuation | ARMY-02: aerial'},
    Kolkata:     {flood:'2.4m HIGH — Hooghly',          sensor:'Hooghly: 2.4m STABLE',       shelter:'Salt Lake: 97% (CRITICAL)',        team:'SDRF-03: evacuating Howrah'},
    Chennai:     {flood:'3.1m HIGH — Adyar',            sensor:'Adyar: 3.1m RISING',         shelter:'JN Stadium: 53% (SAFE)',           team:'SDRF-02: AVAILABLE'},
    Bhubaneswar: {flood:'3.7m HIGH — Mahanadi',         sensor:'Mahanadi: 3.7m RISING',      shelter:'Barabati: 53% (SAFE)',             team:'NDRF-04: AVAILABLE'},
    Hyderabad:   {flood:'1.9m ELEVATED — Musi',         sensor:'Musi: 1.9m RISING',          shelter:'Exhibition Centre: 35% (SAFE)',    team:'No teams assigned'},
    Varanasi:    {flood:'Ganga rising, monitoring',     sensor:'No direct sensor',           shelter:'Varanasi Relief: 89% (WARNING)',   team:'No teams assigned'},
  }

  if (city && CITY_DATA[city]) {
    const d = CITY_DATA[city]
    return `MyRadar — ${city}\n\nFLOOD: ${d.flood}\nSENSOR: ${d.sensor}\nSHELTER: ${d.shelter}\nRESCUE: ${d.team}\n\nNational: ${severity} | ${risk}% risk${alerts.length ? '\n' + alerts.slice(0,2).map(a=>'• '+a).join('\n') : ''}`
  }
  if (q.includes('situation')||q.includes('national')||q.includes('summary')||q.includes('status'))
    return `MyRadar National — ${severity} | ${risk}% risk\nWater: ${water.toFixed(1)}m | ${affected.toLocaleString('en-IN')} affected\nWorst: Guwahati 5.1m, Patna 4.2m, Mumbai 2.8m\n${alerts.slice(0,3).map(a=>'• '+a).join('\n')}`
  if (q.includes('shelter')) return `Safest: Guwahati (39%), JN Chennai (53%)\nCritical: Patna Sahib (95%), Salt Lake Kolkata (97%)`
  if (q.includes('road')||q.includes('block')) return `Blocked: NH-48 Mumbai-Pune (1.8m), Patna-Hajipur Bridge, NH-12 Bhubaneswar (2.4m)\nOpen: Gandhi Setu, NH-27 Guwahati, ECR Chennai`
  if (q.includes('water')||q.includes('sensor')) return `Sensors: Brahmaputra 5.1m↑, Ganga 4.2m↑, Adyar 3.1m↑, Mithi 2.8m↑, Hooghly 2.4m→\nAvg: ${water.toFixed(2)}m`
  if (q.includes('team')||q.includes('rescue')) return `Active: NDRF-01 Mumbai, NDRF-02 Patna, NDRF-03 Guwahati\nAvailable: SDRF-02 Chennai, NDRF-04 Bhubaneswar`
  if (q.includes('relief')||q.includes('supply')) return `Priority: Patna Sahib (Water 28%), Salt Lake Kolkata (Water 19%), NSCI Mumbai (Water 65%)`
  if (q.includes('recommend')||q.includes('action')) return `1. Guwahati helicopter evacuation (5.1m)\n2. Reinforce Patna NDRF-02\n3. Resupply Kolkata Salt Lake\n4. Mumbai West Park emergency supplies`

  // City detected but not in active flood monitoring
  if (city) {
    return `MyRadar — ${city}\n\n${city} is not in an active flood monitoring zone in the current scenario.\n\nNational status: ${severity} severity | ${risk}% flood risk\nActively monitored cities: Mumbai, Patna, Guwahati, Kolkata, Chennai, Bhubaneswar, Hyderabad\n\nFor ${city}: no IMD flood alert issued. Yamuna/Ganga levels normal in your region.\nNearest NDRF battalion available for deployment if needed.`
  }

  return `MyRadar AI — ${severity} | ${risk}% risk | ${affected.toLocaleString('en-IN')} affected\nAsk: "Mumbai situation" · "Patna update" · "national situation" · "recommend action" · "blocked roads"`
}

// ── System prompt (shared by all AI backends) ─────────────────────
function buildSystemPrompt(ctx?: Record<string, unknown>): string {
  return `You are MyRadar AI — a disaster response intelligence assistant for India flood emergencies.
You have real-time access to flood sensors, rescue teams (NDRF/SDRF/Army/Coast Guard), shelters, and incident data.

Current live context:
- Severity: ${ctx?.severity ?? 'HIGH'} | Flood Risk: ${ctx?.floodRisk ?? 32}%
- Avg water level: ${ctx?.averageWaterLevel ?? 1.2}m | Affected: ${(ctx?.affectedPeople as number ?? 12480).toLocaleString('en-IN')}
- Active incidents: ${ctx?.activeIncidents ?? 7} | Active teams: ${ctx?.activeTeams ?? 8}
- Shelter summary: ${ctx?.shelterSummary ?? 'Multiple shelters active'}
- Top alerts: ${(ctx?.topAlerts as string[] ?? []).slice(0,3).join('; ') || 'None'}

City flood levels: Guwahati(Brahmaputra) 5.1m↑, Patna(Ganga) 4.2m↑, Chennai(Adyar) 3.1m↑, Mumbai(Mithi) 2.8m↑, Kolkata(Hooghly) 2.4m→

Rules:
- For city questions: give flood level, rescue teams, shelter status, key risks
- Be concise and actionable (under 300 words)
- Use bullet points for lists
- If asked about Delhi: explain it has no active flood zone, MED-01 is available for deployment
- Always suggest a concrete next action`
}

// ── Route handler ─────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const body = await req.json() as ReqBody
  const { query, context } = body

  if (!query?.trim()) {
    return NextResponse.json({ ok: false, error: 'query is required' }, { status: 400 })
  }

  const systemPrompt = buildSystemPrompt(context)

  // ── 1. Google Gemini ───────────────────────────────────────────────────────
  if (GEMINI_KEY) {
    try {
      const genAI = new GoogleGenerativeAI(GEMINI_KEY)
      const model = genAI.getGenerativeModel({
        model: GEMINI_MODEL,
        systemInstruction: systemPrompt,
      })

      const result = await model.generateContent(query)
      const text   = result.response.text()

      if (text?.trim()) {
        return NextResponse.json({
          ok:   true,
          data: { text, mode: 'CLOUD' as const, confidence: 'HIGH' as const, provider: 'Gemini' },
        })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[ai] Gemini error:', msg)
      // Fall through to Bedrock
    }
  }

  // ── 2. Amazon Bedrock (fallback) ───────────────────────────────────────────
  if (AWS_ENABLED) {
    const modelChain = [
      BEDROCK_MODEL,
      'amazon.nova-pro-v1:0',
      'amazon.nova-lite-v1:0',
      'amazon.nova-micro-v1:0',
      'amazon.titan-text-express-v1',
    ].filter((v, i, arr) => arr.indexOf(v) === i)

    for (const modelId of modelChain) {
      try {
        const cmd = new InvokeModelCommand({
          modelId,
          contentType: 'application/json',
          accept:      'application/json',
          body:        buildBedrockPayload(modelId, systemPrompt, query),
        })
        const res  = await bedrockClient.send(cmd)
        const text = extractBedrockText(modelId, res.body)
        if (text.trim()) {
          return NextResponse.json({
            ok:   true,
            data: { text, mode: 'CLOUD' as const, confidence: 'HIGH' as const, provider: `Bedrock/${modelId}` },
          })
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        if (msg.includes('Operation not allowed') || msg.includes('AccessDenied') || msg.includes('not authorized')) {
          continue  // try next model
        }
        console.error(`[ai] Bedrock ${modelId}:`, msg)
      }
    }
  }

  // ── 3. Local rule engine (always works, offline-capable) ──────────────────
  const text = localAnswer(query, context)
  return NextResponse.json({
    ok:   true,
    data: { text, mode: 'LOCAL' as const, confidence: 'HIGH' as const, provider: 'Local' },
  })
}
