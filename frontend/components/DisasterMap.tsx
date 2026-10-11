'use client'

import dynamic from 'next/dynamic'
import type { MapSelection } from '@/components/disaster-map'
import type { LayerFlags, MapStyle } from '@/components/DisasterMapInner'

export type { LayerFlags, MapStyle }

const Inner = dynamic(
  () => import('@/components/DisasterMapInner').then(m => ({ default: m.DisasterMapInner })),
  {
    ssr: false,
    loading: () => (
      <div className="map-wrap flex items-center justify-center"
           style={{ background: '#0d1b2e' }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
          <span className="tag text-cyan-400/60">Loading map…</span>
        </div>
      </div>
    ),
  },
)

interface Props {
  onSelect:  (sel: MapSelection) => void
  layers?:   LayerFlags
  mapStyle?: MapStyle
}

export function DisasterMapLive(props: Props) {
  return <Inner {...props} />
}
