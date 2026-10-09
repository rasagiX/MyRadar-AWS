import { Router } from 'express'
import { getShelters } from '../store.js'

const router = Router()

/** GET /api/shelters */
router.get('/', (_req, res) => {
  const data = getShelters()
  const critical = data.filter(s => s.status === 'CRITICAL').length
  const warning  = data.filter(s => s.status === 'WARNING').length
  res.json({ ok: true, data, critical, warning, total: data.length })
})

/** GET /api/shelters/:id */
router.get('/:id', (req, res) => {
  const shelter = getShelters().find(s => s.id === req.params.id)
  if (!shelter) { res.status(404).json({ ok: false, error: 'Shelter not found' }); return }
  const pct = Math.round((shelter.occupancy / shelter.capacity) * 100)
  const needs: string[] = []
  if (shelter.waterLevel    < 25) needs.push('Water')
  if (shelter.foodLevel     < 25) needs.push('Food')
  if (shelter.medicineLevel < 25) needs.push('Medicine')
  res.json({ ok: true, data: shelter, occupancyPct: pct, criticalNeeds: needs })
})

export default router
