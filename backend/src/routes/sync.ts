import { Router } from 'express'
import { z } from 'zod'
import { processSyncEvents, getSyncQueue } from '../store.js'

const router = Router()

const SyncSchema = z.object({
  events:    z.array(z.object({
    id:        z.string(),
    eventType: z.string(),
    payload:   z.record(z.unknown()),
    timestamp: z.string(),
    deviceId:  z.string(),
    version:   z.number(),
    retryCount:z.number(),
  })),
  deviceId:  z.string(),
  timestamp: z.string(),
})

/** POST /api/sync — receive offline events from client */
router.post('/', (req, res) => {
  const parsed = SyncSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: 'Invalid payload', details: parsed.error.flatten() })
    return
  }
  const { events, deviceId } = parsed.data
  const processed = processSyncEvents(events)
  res.json({
    ok: true,
    received: events.length,
    processed,
    failed: events.length - processed,
    deviceId,
    serverTime: new Date().toISOString(),
  })
})

/** GET /api/sync/queue — view pending server-side queue */
router.get('/queue', (_req, res) => {
  res.json({ ok: true, data: getSyncQueue(), count: getSyncQueue().length })
})

export default router
