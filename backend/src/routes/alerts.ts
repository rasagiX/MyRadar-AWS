import { Router } from 'express'
import { getAlerts, acknowledgeAlert } from '../store.js'

const router = Router()

/** GET /api/alerts?unacked=true */
router.get('/', (req, res) => {
  let data = getAlerts()
  if (req.query.unacked === 'true') data = data.filter(a => !a.acknowledged)
  const limit = Number(req.query.limit) || 50
  res.json({ ok: true, data: data.slice(0, limit), total: data.length })
})

/** POST /api/alerts/:id/acknowledge */
router.post('/:id/acknowledge', (req, res) => {
  const ok = acknowledgeAlert(req.params.id)
  if (!ok) { res.status(404).json({ ok: false, error: 'Alert not found' }); return }
  res.json({ ok: true, message: `Alert ${req.params.id} acknowledged` })
})

export default router
