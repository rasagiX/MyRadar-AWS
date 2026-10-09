import { Router } from 'express'
import { getSensors } from '../store.js'

const router = Router()

/** GET /api/sensors — all sensors */
router.get('/', (_req, res) => {
  res.json({ ok: true, data: getSensors(), count: getSensors().length })
})

/** GET /api/sensors/:id — single sensor */
router.get('/:id', (req, res) => {
  const sensor = getSensors().find(s => s.id === req.params.id)
  if (!sensor) { res.status(404).json({ ok: false, error: 'Sensor not found' }); return }
  res.json({ ok: true, data: sensor })
})

/** GET /api/sensors/:id/history — sparkline data */
router.get('/:id/history', (req, res) => {
  const sensor = getSensors().find(s => s.id === req.params.id)
  if (!sensor) { res.status(404).json({ ok: false, error: 'Sensor not found' }); return }
  const points = sensor.history.map((value, i) => ({
    time: new Date(Date.now() - (sensor.history.length - 1 - i) * 5 * 60 * 1000).toISOString(),
    value,
  }))
  res.json({ ok: true, sensorId: sensor.id, unit: sensor.unit, data: points })
})

export default router
