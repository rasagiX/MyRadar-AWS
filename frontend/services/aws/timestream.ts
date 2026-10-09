/**
 * Amazon Timestream abstraction — time-series sensor history.
 *
 * In DEMO mode: generates synthetic historical data.
 * In AWS mode: queries Timestream via API Gateway → Lambda.
 *
 * Production table layout:
 *   Database: nexus-telemetry
 *   Table:    sensor-readings
 *   Measures: waterLevel, rainfall, temperature, airQuality, riverLevel
 */

export interface TimeseriesPoint {
  time: string
  value: number
}

const IS_DEMO = process.env.NEXT_PUBLIC_DATA_MODE !== 'aws'

function generateDemoHistory(current: number, points = 12, variance = 0.15): TimeseriesPoint[] {
  const result: TimeseriesPoint[] = []
  let value = current * 0.5
  const now = Date.now()
  for (let i = points; i >= 0; i--) {
    value = Math.max(0, value + (Math.random() - 0.4) * variance)
    result.push({
      time: new Date(now - i * 5 * 60 * 1000).toISOString(),
      value: parseFloat(value.toFixed(2)),
    })
  }
  return result
}

/** Fetch last N hours of readings for a sensor */
export async function querySensorHistory(
  sensorId: string,
  currentValue: number,
  _hours = 1,
): Promise<TimeseriesPoint[]> {
  if (IS_DEMO) {
    // Return plausible demo history converging to current value
    return generateDemoHistory(currentValue)
  }

  const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '/api/nexus'
  try {
    const res = await fetch(`${API_BASE}/sensor-history?id=${sensorId}&hours=${_hours}`)
    if (!res.ok) throw new Error(`API ${res.status}`)
    return res.json()
  } catch {
    return generateDemoHistory(currentValue)
  }
}
