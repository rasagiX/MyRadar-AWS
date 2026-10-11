/**
 * SNS alert helper — called from DisasterStore when critical thresholds are crossed.
 * Runs client-side; makes a POST to the Next.js API route which calls SNS server-side.
 *
 * Debounced per alertKey so the same sensor doesn't fire every tick.
 */

interface AlertPayload {
  severity:    'CRITICAL' | 'WARNING' | 'INFO' | 'RESCUE' | 'SHELTER' | 'SUPPLY'
  title:       string
  message:     string
  sensor?:     string
  waterLevel?: number
  location?:   string
}

// Track last-published time per key to debounce (minimum 5 min between same alert)
const _lastPublished: Record<string, number> = {}
const DEBOUNCE_MS = 5 * 60 * 1000   // 5 minutes

export async function publishSNSAlert(
  payload: AlertPayload,
  alertKey: string,
): Promise<void> {
  // Debounce — don't spam the same alert
  const now = Date.now()
  if (_lastPublished[alertKey] && now - _lastPublished[alertKey] < DEBOUNCE_MS) {
    return
  }
  _lastPublished[alertKey] = now

  try {
    await fetch('/api/myradar/alerts/notify', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
      signal:  AbortSignal.timeout(8_000),
    })
  } catch {
    // Fire-and-forget — never crash the simulation
  }
}

/**
 * Publish sensor telemetry to IoT Core via the API route.
 * Called every 10 seconds from DisasterProvider.
 * Runs client-side; actual IoT publish happens in the API route (server-side).
 */
export async function publishIoTSensors(
  sensors: Array<{
    id: string; type: string; reading: number; unit: string
    trend: string; battery: number; status: string
    location: { lat: number; lng: number }; lastUpdated: string
  }>,
): Promise<void> {
  // Only push water-level sensors to IoT (they're the critical ones)
  const waterSensors = sensors.filter(s => s.type === 'WATER_LEVEL')
  if (waterSensors.length === 0) return

  try {
    await fetch('/api/myradar/iot/publish', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ sensors: waterSensors }),
      signal:  AbortSignal.timeout(10_000),
    })
  } catch {
    // Fire-and-forget
  }
}
