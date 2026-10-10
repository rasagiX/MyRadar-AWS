/**
 * Amazon S3 abstraction — aerial/drone imagery for Waste Radar.
 *
 * Architecture: Drone → S3 → Lambda trigger → image analysis → WasteZone records
 *
 * In DEMO mode: returns simulated detection results.
 * In AWS mode: uploads to S3, retrieves pre-signed analysis URLs.
 */

export interface WasteDetectionResult {
  imageKey: string
  detectedAt: string
  objects: Array<{
    type: 'debris' | 'blocked_road' | 'hazardous' | 'fallen_structure' | 'garbage'
    confidence: number
    boundingBox?: { x: number; y: number; width: number; height: number }
    description: string
  }>
}

const IS_DEMO = process.env.NEXT_PUBLIC_DATA_MODE !== 'aws'

/** Simulate the analysis pipeline (demo mode) */
export function getMockDetectionResult(): WasteDetectionResult {
  const types = ['debris', 'blocked_road', 'hazardous', 'fallen_structure', 'garbage'] as const
  const numObjects = 2 + Math.floor(Math.random() * 4)
  const objects = Array.from({ length: numObjects }, (_, i) => ({
    type: types[i % types.length],
    confidence: parseFloat((0.72 + Math.random() * 0.26).toFixed(2)),
    description: [
      'Large debris pile blocking emergency access',
      'Road impassable due to floodwater',
      'Suspected chemical containers in flood water',
      'Partial building collapse detected',
      'Accumulated flood garbage and debris',
    ][i % 5],
  }))
  return {
    imageKey: `drone-scan-${Date.now()}.jpg`,
    detectedAt: new Date().toISOString(),
    objects,
  }
}

/** Upload a drone image and trigger analysis pipeline */
export async function uploadDroneImage(_file: File): Promise<string | null> {
  if (IS_DEMO) {
    // Simulate a 2-second upload
    await new Promise(r => setTimeout(r, 2000))
    return `demo-key-${Date.now()}.jpg`
  }

  const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '/api/nexus'
  try {
    const form = new FormData()
    form.append('file', _file)
    const res = await fetch(`${API_BASE}/upload-image`, { method: 'POST', body: form })
    if (!res.ok) throw new Error(`Upload failed ${res.status}`)
    const { key } = await res.json() as { key: string }
    return key
  } catch {
    return null
  }
}

/** Poll for analysis results for an uploaded image */
export async function getAnalysisResult(key: string): Promise<WasteDetectionResult | null> {
  if (IS_DEMO) return getMockDetectionResult()

  const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '/api/nexus'
  try {
    const res = await fetch(`${API_BASE}/analysis-result?key=${encodeURIComponent(key)}`)
    if (!res.ok) throw new Error(`Analysis API ${res.status}`)
    return res.json() as Promise<WasteDetectionResult>
  } catch {
    return null
  }
}
