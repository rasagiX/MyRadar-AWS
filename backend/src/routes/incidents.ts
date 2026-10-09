import { Router } from 'express'
import { z } from 'zod'
import { getIncidents, createIncident } from '../store.js'

const router = Router()

const CreateIncidentSchema = z.object({
  type:        z.string(),
  severity:    z.enum(['NORMAL','ELEVATED','HIGH','CRITICAL']),
  location:    z.object({ lat: z.number(), lng: z.number() }),
  description: z.string().min(1),
  status:      z.enum(['OPEN','ASSIGNED','RESOLVED']).default('OPEN'),
  assignedTeam: z.string().optional(),
})

/** GET /api/incidents */
router.get('/', (req, res) => {
  let data = getIncidents()
  if (req.query.status) data = data.filter(i => i.status === req.query.status)
  res.json({ ok: true, data, total: data.length })
})

/** POST /api/incidents */
router.post('/', (req, res) => {
  const parsed = CreateIncidentSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: 'Invalid body', details: parsed.error.flatten() })
    return
  }
  const incident = createIncident(parsed.data)
  res.status(201).json({ ok: true, data: incident })
})

export default router
