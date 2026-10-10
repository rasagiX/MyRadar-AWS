'use client'

/**
 * MyRadar — Live Disaster Map
 *
 * Uses dynamic import to ensure maplibre-gl config (worker disable)
 * runs before the library initialises. This is the only reliable way
 * to prevent "Worker failed to load" in Next.js + Turbopack.
 */

import dynamic from 'next/dynamic'
import type { MapSelection } from '@/components/disaster-map'
import type { LayerFlags } from '@/components/DisasterMapInner'

// Re-export so page.tsx can import from one place
export type { LayerFlags }

// Dynamically import the inner map — no SSR, deferred until client hydration
// By the time this loads, the browser env is fully ready for WebWorker config
const Inner = dynamic(
  () => import('@/components/DisasterMapInner').then(m => ({ default: m.DisasterMapInner })),
  {
    ssr: false,
    loading: () => (
      <div className="map-wrap flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
          <span className="tag text-cyan-400/60">Initialising map…</span>
        </div>
      </div>
    ),
  },
)

interface Props {
  onSelect: (sel: MapSelection) => void
  layers?:  LayerFlags
}

export function DisasterMapLive(props: Props) {
  return <Inner {...props} />
}
