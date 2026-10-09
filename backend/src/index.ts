import 'dotenv/config'
import http from 'http'
import { WebSocketServer, WebSocket } from 'ws'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import rateLimit from 'express-rate-limit'

import sensorsRouter    from './routes/sensors.js'
import sheltersRouter   from './routes/shelters.js'
import rescueRouter     from './routes/rescue.js'
import alertsRouter     from './routes/alerts.js'
import incidentsRouter  from './routes/incidents.js'
import syncRouter       from './routes/sync.js'
import aiRouter         from './routes/ai.js'
import { getSummary, getSensors, getAlerts } from './store.js'

const app    = express()
const server = http.createServer(app)
const PORT   = Number(process.env.PORT) || 4000

// ─── Allowed origins ──────────────────────────────────────────────────────────
const ALLOWED = [
  process.env.FRONTEND_URL   || 'http://localhost:3000',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
]

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }))
app.use(cors({
  origin: (origin, cb) => {
    // Allow no-origin requests (same-host, curl) and listed origins
    if (!origin || ALLOWED.includes(origin)) cb(null, true)
    else cb(new Error(`CORS blocked: ${origin}`))
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Device-Id'],
}))
app.use(express.json({ limit: '2mb' }))
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'))

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: req => req.path === '/api/health',
})
app.use('/api/', limiter)

// ─── Health ───────────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'MyRadar Backend',
    timestamp: new Date().toISOString(),
    uptime: Math.round(process.uptime()),
    wsClients: wss.clients.size,
  })
})

// ─── Summary ──────────────────────────────────────────────────────────────────
app.get('/api/summary',         (_req, res) => res.json({ ok: true, data: getSummary() }))
// Also expose under /api/myradar/* so the frontend can hit either prefix
app.get('/api/myradar/summary', (_req, res) => res.json({ ok: true, data: getSummary() }))

// ─── Domain routes (both prefixes) ───────────────────────────────────────────
const ROUTE_MAP: Array<[string, express.Router]> = [
  ['/api/sensors',            sensorsRouter],
  ['/api/myradar/sensors',    sensorsRouter],
  ['/api/shelters',           sheltersRouter],
  ['/api/myradar/shelters',   sheltersRouter],
  ['/api/rescue-teams',       rescueRouter],
  ['/api/myradar/teams',      rescueRouter],
  ['/api/alerts',             alertsRouter],
  ['/api/myradar/alerts',     alertsRouter],
  ['/api/incidents',          incidentsRouter],
  ['/api/myradar/incidents',  incidentsRouter],
  ['/api/sync',               syncRouter],
  ['/api/myradar/sync',       syncRouter],
  ['/api/ai',                 aiRouter],
  ['/api/myradar/ai',         aiRouter],
]
for (const [path, router] of ROUTE_MAP) app.use(path, router)

// ─── 404 / Error ──────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ ok: false, error: 'Not found' }))
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[ERROR]', err.message)
  res.status(500).json({ ok: false, error: 'Internal server error' })
})

// ─── WebSocket server ─────────────────────────────────────────────────────────
const wss = new WebSocketServer({ server, path: '/ws' })

type WsMessage =
  | { type: 'SUMMARY';  data: ReturnType<typeof getSummary> }
  | { type: 'SENSORS';  data: ReturnType<typeof getSensors> }
  | { type: 'ALERT';    data: ReturnType<typeof getAlerts>[number] }
  | { type: 'PING' }

function broadcast(msg: WsMessage) {
  const payload = JSON.stringify(msg)
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload)
    }
  }
}

wss.on('connection', (ws) => {
  console.log(`[WS] client connected  (total: ${wss.clients.size})`)

  // Send full snapshot on connect so client is immediately up-to-date
  ws.send(JSON.stringify({ type: 'SUMMARY', data: getSummary() }))
  ws.send(JSON.stringify({ type: 'SENSORS', data: getSensors() }))

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString()) as { type: string }
      if (msg.type === 'PING') ws.send(JSON.stringify({ type: 'PONG' }))
    } catch { /* ignore malformed */ }
  })

  ws.on('close', () => console.log(`[WS] client disconnected (total: ${wss.clients.size})`))
  ws.on('error', (err) => console.error('[WS] error:', err.message))
})

// ─── Push live data every 2 s ─────────────────────────────────────────────────
setInterval(() => {
  if (wss.clients.size === 0) return
  broadcast({ type: 'SUMMARY', data: getSummary() })
  broadcast({ type: 'SENSORS', data: getSensors() })
}, 2000)

// ─── Start ────────────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`\n🚀  MyRadar Backend  →  http://localhost:${PORT}/api`)
  console.log(`🔌  WebSocket        →  ws://localhost:${PORT}/ws`)
  console.log(`🌐  Frontend origin  →  ${ALLOWED[0]}`)
  console.log(`📦  Environment      →  ${process.env.NODE_ENV ?? 'development'}\n`)
})
