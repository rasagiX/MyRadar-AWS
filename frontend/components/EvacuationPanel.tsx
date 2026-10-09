'use client'

import { useState, useMemo } from 'react'
import { useDisasterState } from '@/store/disasterStore'
import { Route, ChevronRight, AlertTriangle, CheckCircle, Clock, Navigation } from 'lucide-react'
import { calculateLocalRoute, scoreRoute } from '@/services/local/routing'
import type { Shelter, Route as RouteType } from '@/types/disaster'

const RISK_COLOR: Record<string, string> = {
  LOW:      'text-lime-300 border-lime-400/30',
  MEDIUM:   'text-amber-300 border-amber-400/30',
  HIGH:     'text-red-300 border-red-400/30',
  CRITICAL: 'text-red-400 border-red-500/40',
}

const ZONE_ORIGINS = [
  { id: 'Z1', name: 'Mumbai',    coords: { lat: 19.076, lng: 72.877 } },
  { id: 'Z2', name: 'Chennai',   coords: { lat: 13.052, lng: 80.250 } },
  { id: 'Z3', name: 'Patna',     coords: { lat: 25.594, lng: 85.137 } },
  { id: 'Z4', name: 'Guwahati',  coords: { lat: 26.144, lng: 91.736 } },
  { id: 'Z5', name: 'Kolkata',   coords: { lat: 22.572, lng: 88.363 } },
  { id: 'Z6', name: 'Bhubaneswar',coords: { lat: 20.296, lng: 85.824 } },
  { id: 'Z7', name: 'Hyderabad', coords: { lat: 17.385, lng: 78.486 } },
]

function RouteCard({ route, primary = false }: { route: RouteType; primary?: boolean }) {
  const rc = RISK_COLOR[route.riskLevel]
  return (
    <div className={`border p-3 ${primary ? 'border-lime-400/25 bg-lime-400/[0.04]' : 'border-white/10 bg-white/[0.02]'}`}>
      {primary && (
        <p className="font-mono text-[8px] uppercase tracking-wider text-lime-300 mb-1.5">✓ RECOMMENDED ROUTE</p>
      )}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 font-mono text-[9px] text-white/70">
          <Navigation size={10} />
          {route.from} <ChevronRight size={9} className="text-white/30" /> {route.to}
        </div>
        <span className={`font-mono text-[8px] uppercase border px-1.5 py-0.5 ${rc}`}>
          {route.riskLevel}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[
          ['Distance', `${route.distance} km`],
          ['ETA', `${route.etaMinutes} min`],
          ['Waypoints', `${route.waypoints.length}`],
        ].map(([k, v]) => (
          <div key={k}>
            <p className="font-mono text-[7px] uppercase tracking-wider text-white/25">{k}</p>
            <p className="font-mono text-[11px] text-white/80 mt-0.5">{v}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function ShelterOption({ shelter, selected, onSelect }: {
  shelter: Shelter; selected: boolean; onSelect: () => void
}) {
  const pct = Math.round((shelter.occupancy / shelter.capacity) * 100)
  const available = shelter.capacity - shelter.occupancy
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left p-2.5 border transition-colors ${selected ? 'border-cyan-400/40 bg-cyan-400/[0.06]' : 'border-white/8 hover:border-white/20'}`}
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-[9px] text-white/70">{shelter.name}</span>
        <span className={`font-mono text-[8px] ${shelter.status === 'SAFE' ? 'text-lime-300' : shelter.status === 'WARNING' ? 'text-amber-300' : 'text-red-300'}`}>
          {shelter.status}
        </span>
      </div>
      <div className="mt-1.5 flex items-center gap-2">
        <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
          <div
            className={`h-full ${pct > 90 ? 'bg-red-400' : pct > 75 ? 'bg-amber-400' : 'bg-lime-400'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="font-mono text-[7px] text-white/30">{available} free</span>
      </div>
    </button>
  )
}

export function EvacuationPanel() {
  const { roads, shelters, routes: precomputedRoutes } = useDisasterState()
  const [fromZone, setFromZone] = useState(ZONE_ORIGINS[0])  // default Mumbai
  const [toShelter, setToShelter] = useState<Shelter | null>(null)
  const [calculating, setCalculating] = useState(false)
  const [calculatedRoute, setCalculatedRoute] = useState<RouteType | null>(null)

  const blockedCount = roads.filter(r => r.status === 'BLOCKED' || r.status === 'FLOODED').length
  const safeRoutes = precomputedRoutes.filter(r => r.type === 'EVACUATION' && !r.isBlocked)

  const sortedShelters = useMemo(() =>
    [...shelters].sort((a, b) => {
      const pctA = a.occupancy / a.capacity
      const pctB = b.occupancy / b.capacity
      return pctA - pctB
    }), [shelters])

  async function handleCalculate() {
    if (!toShelter) return
    setCalculating(true)
    // Small async delay for visual feedback
    await new Promise(r => setTimeout(r, 600))
    const result = calculateLocalRoute(
      fromZone.coords,
      toShelter.location,
      roads,
      'EVACUATION',
    )
    if (result) {
      result.from = fromZone.name
      result.to = toShelter.name
    }
    setCalculatedRoute(result)
    setCalculating(false)
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/8 shrink-0">
        <div className="flex items-center gap-2">
          <Route size={13} className="text-white/40" />
          <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/60">Evacuation Brain</span>
        </div>
        <div className="flex items-center gap-1.5 font-mono text-[8px] text-red-300">
          <AlertTriangle size={10} />
          {blockedCount} roads blocked
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {/* Route calculator */}
        <div className="border border-white/8 p-3 flex flex-col gap-3">
          <p className="font-mono text-[9px] uppercase tracking-wider text-white/40">Calculate Evacuation Route</p>

          {/* From zone */}
          <div>
            <p className="font-mono text-[8px] uppercase tracking-wider text-white/25 mb-1">From Zone</p>
            <div className="flex gap-1 flex-wrap">
              {ZONE_ORIGINS.map(z => (
                <button
                  key={z.id}
                  onClick={() => { setFromZone(z); setCalculatedRoute(null) }}
                  className={`px-2 py-1 font-mono text-[8px] border transition-colors ${fromZone.id === z.id ? 'border-cyan-400/40 text-cyan-300 bg-cyan-400/10' : 'border-white/10 text-white/40 hover:text-white/60'}`}
                >
                  {z.name}
                </button>
              ))}
            </div>
          </div>

          {/* To shelter */}
          <div>
            <p className="font-mono text-[8px] uppercase tracking-wider text-white/25 mb-1">To Shelter</p>
            <div className="flex flex-col gap-1">
              {sortedShelters.map(s => (
                <ShelterOption
                  key={s.id}
                  shelter={s}
                  selected={toShelter?.id === s.id}
                  onSelect={() => { setToShelter(s); setCalculatedRoute(null) }}
                />
              ))}
            </div>
          </div>

          <button
            onClick={handleCalculate}
            disabled={!toShelter || calculating}
            className={`w-full py-2.5 font-mono text-[9px] uppercase tracking-wider transition-colors flex items-center justify-center gap-2 ${
              toShelter && !calculating
                ? 'bg-lime-400/15 border border-lime-400/40 text-lime-300 hover:bg-lime-400/20'
                : 'border border-white/10 text-white/20 cursor-not-allowed'
            }`}
          >
            {calculating ? (
              <><Clock size={11} className="animate-spin" /> Calculating…</>
            ) : (
              <><Navigation size={11} /> Calculate Route</>
            )}
          </button>
        </div>

        {/* Calculated route result */}
        {calculatedRoute && (
          <div className="flex flex-col gap-2">
            <p className="font-mono text-[9px] uppercase tracking-wider text-white/40">Route Result</p>
            <RouteCard route={calculatedRoute} primary />
            <div className="border border-white/8 p-2.5">
              <p className="font-mono text-[8px] uppercase tracking-wider text-white/25 mb-1.5">AI Routing Source</p>
              <div className="flex items-center gap-1.5 font-mono text-[9px] text-lime-300">
                <CheckCircle size={10} />
                Local Dijkstra Engine (offline-capable)
              </div>
              <p className="mt-1 font-mono text-[8px] text-white/30">
                Routes via {blockedCount} blocked road{blockedCount !== 1 ? 's' : ''} avoided automatically
              </p>
            </div>
          </div>
        )}

        {/* Pre-computed live routes */}
        <div>
          <p className="font-mono text-[9px] uppercase tracking-wider text-white/40 mb-2">
            Live Evacuation Routes ({safeRoutes.length})
          </p>
          <div className="flex flex-col gap-2">
            {safeRoutes.map((r, i) => (
              <RouteCard key={r.id} route={r} primary={i === 0} />
            ))}
          </div>
        </div>

        {/* Blocked roads warning */}
        {blockedCount > 0 && (
          <div className="border border-red-400/20 bg-red-400/[0.04] p-3">
            <p className="font-mono text-[9px] uppercase tracking-wider text-red-300 mb-2">
              Blocked / Flooded Roads
            </p>
            {roads
              .filter(r => r.status === 'BLOCKED' || r.status === 'FLOODED')
              .map(r => (
                <div key={r.id} className="flex items-center justify-between py-1 border-b border-white/5 last:border-0">
                  <span className="font-mono text-[9px] text-white/60">{r.name}</span>
                  <span className="font-mono text-[8px] text-red-300">{r.status}</span>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  )
}
