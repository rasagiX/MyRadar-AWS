import { Router } from 'express'
import { z } from 'zod'
import { getRescueTeams, updateTeamStatus } from '../store.js'

const router = Router()

const UpdateStatusSchema = z.object({
  status:  z.enum(['AVAILABLE','RESPONDING','RESCUING','TRANSPORTING','RETURNING','OFFLINE']),
  mission: z.string().optional(),
})

/** GET /api/rescue-teams */
router.get('/', (_req, res) => {
  const data   = getRescueTeams()
  const active = data.filter(t => t.status !== 'AVAILABLE' && t.status !== 'OFFLINE').length
  res.json({ ok: true, data, active, total: data.length })
})

/** GET /api/rescue-teams/:id */
router.get('/:id', (req, res) => {
  const team = getRescueTeams().find(t => t.id === req.params.id)
  if (!team) { res.status(404).json({ ok: false, error: 'Team not found' }); return }
  res.json({ ok: true, data: team })
})

/** PATCH /api/rescue-teams/:id/status */
router.patch('/:id/status', (req, res) => {
  const parsed = UpdateStatusSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: 'Invalid body', details: parsed.error.flatten() })
    return
  }
  const ok = updateTeamStatus(req.params.id, parsed.data.status, parsed.data.mission)
  if (!ok) { res.status(404).json({ ok: false, error: 'Team not found' }); return }
  res.json({ ok: true, message: `Team ${req.params.id} updated to ${parsed.data.status}` })
})

export default router
