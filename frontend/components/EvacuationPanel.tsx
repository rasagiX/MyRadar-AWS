'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { useDisasterState } from '@/store/disasterStore'
import {
  Route, ChevronRight, AlertTriangle, CheckCircle,
  Clock, Navigation, RefreshCw, Zap,
} from 'lucide-react'
import { calculateLocalRoute } from '@/services/local/routing'
import type { Shelter, Route as RouteType } from '@/types/disaster'

// ── India evacuation zone origins ────────────────────────────────
const ZONE_ORIGINS = [
  { id: 'Z1', name: 'Mumbai',      coords: { lat: 19.076, lng: 72.877 } },
  { id: 'Z2', name: 'Chennai',     coords: { lat: 13.052, lng: 80.250 } },
  { id: 'Z3', name: 'Patna',       coords: { lat: 25.594, lng: 85.137 } },
  { id: 'Z4', name: 'Guwahati',    coords: { lat: 26.144, lng: 91.736 } },
  { id: 'Z5', name: 'Kolkata',     coords: { lat: 22.572, lng: 88.363 } },
  { id: 'Z6', name: 'Bhubaneswar', coords: { lat: 20.296, lng: 85.824 } },
  { id: 'Z7', name: 'Hyderabad',   coords: { lat: 17.385, lng: 78.486 } },
]

const RISK_COLOR: Record<string, string> = {
  LOW:      'text-lime-300  border-lime-400/30',
  MEDIUM:   'text-amber-300 border-amber-400/30',
  HIGH:     'text-red-300   border-red-400/30',
  CRITICAL: 'text-red-400   border-red-500/40',
}

function RouteCard({ route, primary = false }: { route: RouteType; primary?: boolean }) {
  const rc = RISK_COLOR[route.riskLevel]
  return (
    <div className={`border p-3 ${primary ? 'border-lime-400/25 bg-lime-400/[0.04]' : 'border-white/8 bg-white/[0.02]'}`}>
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
          ['ETA',      `${route.etaMinutes} min`],
          ['Risk',     route.riskLevel],
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
        <span className="font-mono text-[10px] text-white/80 font-medium">{shelter.name}</span>
        <span className={`font-mono text-[8px] ${shelter.status === 'SAFE' ? 'text-lime-300' : shelter.status === 'WARNING' ? 'text-amber-300' : 'text-red-300'}`}>
          {shelter.status}
        </span>
      </div>
      <div className="mt-1.5 flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${pct > 90 ? 'bg-red-400' : pct > 75 ? 'bg-amber-400' : 'bg-lime-400'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="font-mono text-[8px] text-white/40">{available.toLocaleString()} free</span>
      </div>
    </button>
  )
}

export function EvacuationPanel() {
  const { roads, shelters, routes: precomputedRoutes } = useDisasterState()
  const [fromZone,        setFromZone]        = useState(ZONE_ORIGINS[0])
  const [toShelter,       setToShelter]       = useState<Shelter | null>(null)
  const [calculating,     setCalculating]     = useState(false)
  const [calculatedRoute, setCalculatedRoute] = useState<RouteType | null>(null)
  const [autoRecalcMsg,   setAutoRecalcMsg]   = useState<string | null>(null)

  // Track blocked-road count to detect changes
  const blockedCount   = roads.filter(r => r.status === 'BLOCKED' || r.status === 'FLOODED').length
  const prevBlocked    = useRef(blockedCount)
  const safeRoutes     = precomputedRoutes.filter(r => r.type === 'EVACUATION' && !r.isBlocked)

  const sortedShelters = useMemo(() =>
    [...shelters].sort((a, b) => (a.occupancy / a.capacity) - (b.occupancy / b.capacity)),
    [shelters],
  )

  // ── Auto-recalculate when a road is blocked while a route is shown ──────────
  useEffect(() => {
    const newBlocked = roads.filter(r => r.status === 'BLOCKED' || r.status === 'FLOODED').length
    if (newBlocked > prevBlocked.current && calculatedRoute && toShelter) {
      // A road was just blocked — recalculate silently
      const newRoute = calculateLocalRoute(fromZone.coords, toShelter.location, roads, 'EVACUATION')
      if (newRoute) {
        newRoute.from = fromZone.name
        newRoute.to   = toShelter.name
        setCalculatedRoute(newRoute)
        setAutoRecalcMsg(`Road closure detected — route recalculated. New risk: ${newRoute.riskLevel}`)
        // Clear the banner after 5 s
        setTimeout(() => setAutoRecalcMsg(null), 5000)
      }
    }
    prevBlocked.current = newBlocked
  }, [roads, calculatedRoute, toShelter, fromZone])

  async function handleCalculate() {
    if (!toShelter) return
    setCalculating(true)
    setAutoRecalcMsg(null)
    await new Promise(r => setTimeout(r, 400))
    const result = calculateLocalRoute(fromZone.coords, toShelter.location, roads, 'EVACUATION')
    if (result) {
      result.from = fromZone.name
      result.to   = toShelter.name
    }
    setCalculatedRoute(result)
    setCalculating(false)
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/8 shrink-0">
        <div className="flex items-center gap-2">
          <Route size={14} className="text-lime-400" />
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/70 font-semibold">
            Evacuation Brain
          </span>
        </div>
        <div className="flex items-center gap-1.5 font-mono text-[9px] text-red-300">
          <AlertTriangle size={11} />
          {blockedCount} roads blocked
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">

        {/* Auto-recalc banner */}
        {autoRecalcMsg && (
          <div className="flex items-center gap-2 border border-amber-400/30 bg-amber-400/[0.06] px-3 py-2">
            <RefreshCw size={11} className="text-amber-300 shrink-0" />
            <p className="font-mono text-[9px] text-amber-300">{autoRecalcMsg}</p>
          </div>
        )}

        {/* Route calculator card */}
        <div className="border border-white/8 bg-white/[0.02] p-4 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Zap size={12} className="text-cyan-400" />
            <p className="font-mono text-[9px] uppercase tracking-wider text-white/50">
              Calculate Evacuation Route
            </p>
          </div>

          {/* From zone */}
          <div>
            <p className="font-mono text-[8px] uppercase tracking-wider text-white/30 mb-2">From City / Zone</p>
            <div className="flex gap-1 flex-wrap">
              {ZONE_ORIGINS.map(z => (
                <button
                  key={z.id}
                  onClick={() => { setFromZone(z); setCalculatedRoute(null); setAutoRecalcMsg(null) }}
                  className={`px-2.5 py-1 font-mono text-[9px] border transition-colors rounded-sm ${
                    fromZone.id === z.id
                      ? 'border-cyan-400/50 text-cyan-300 bg-cyan-400/10'
                      : 'border-white/10 text-white/45 hover:text-white/70 hover:border-white/25'
                  }`}
                >
                  {z.name}
                </button>
              ))}
            </div>
          </div>

          {/* To shelter */}
          <div>
            <p className="font-mono text-[8px] uppercase tracking-wider text-white/30 mb-2">Destination Shelter</p>
            <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
              {sortedShelters.map(s => (
                <ShelterOption
                  key={s.id}
                  shelter={s}
                  selected={toShelter?.id === s.id}
                  onSelect={() => { setToShelter(s); setCalculatedRoute(null); setAutoRecalcMsg(null) }}
                />
              ))}
            </div>
          </div>

          {/* Calculate button */}
          <button
            onClick={handleCalculate}
            disabled={!toShelter || calculating}
            className={`w-full py-3 font-mono text-[10px] uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
              toShelter && !calculating
                ? 'bg-lime-400/15 border border-lime-400/40 text-lime-300 hover:bg-lime-400/22'
                : 'border border-white/8 text-white/20 cursor-not-allowed'
            }`}
          >
            {calculating
              ? <><Clock size={12} className="animate-spin" /> Calculating…</>
              : <><Navigation size={12} /> Calculate Optimal Route</>
            }
          </button>
        </div>

        {/* Calculated route */}
        {calculatedRoute && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="font-mono text-[9px] uppercase tracking-wider text-white/40">Route Result</p>
              <button
                onClick={handleCalculate}
                className="flex items-center gap-1 font-mono text-[8px] text-cyan-300/60 hover:text-cyan-300 transition-colors"
              >
                <RefreshCw size={9} /> Refresh
              </button>
            </div>
            <RouteCard route={calculatedRoute} primary />
            <div className="border border-white/8 p-2.5">
              <p className="font-mono text-[8px] uppercase tracking-wider text-white/25 mb-1.5">
                Routing Engine
              </p>
              <div className="flex items-center gap-1.5 font-mono text-[9px] text-lime-300">
                <CheckCircle size={10} />
                Local Dijkstra — offline-capable
              </div>
              <p className="mt-1 font-mono text-[8px] text-white/30">
                {blockedCount} blocked road{blockedCount !== 1 ? 's' : ''} avoided automatically
              </p>
            </div>
          </div>
        )}

        {/* Live precomputed routes */}
        {safeRoutes.length > 0 && (
          <div>
            <p className="font-mono text-[9px] uppercase tracking-wider text-white/40 mb-2">
              Live Safe Routes ({safeRoutes.length})
            </p>
            <div className="flex flex-col gap-2">
              {safeRoutes.map((r, i) => (
                <RouteCard key={r.id} route={r} primary={i === 0 && !calculatedRoute} />
              ))}
            </div>
          </div>
        )}

        {/* Blocked roads list */}
        {blockedCount > 0 && (
          <div className="border border-red-400/20 bg-red-400/[0.03] p-3">
            <p className="font-mono text-[9px] uppercase tracking-wider text-red-300 mb-2">
              ⚠ Blocked / Flooded Roads ({blockedCount})
            </p>
            <div className="flex flex-col gap-1">
              {roads
                .filter(r => r.status === 'BLOCKED' || r.status === 'FLOODED')
                .map(r => (
                  <div key={r.id} className="flex items-center justify-between py-1 border-b border-white/5 last:border-0">
                    <span className="font-mono text-[9px] text-white/65">{r.name}</span>
                    <div className="flex items-center gap-2">
                      {r.waterDepth > 0 && (
                        <span className="font-mono text-[8px] text-cyan-300">{r.waterDepth.toFixed(1)}m</span>
                      )}
                      <span className={`font-mono text-[8px] ${r.status === 'FLOODED' ? 'text-cyan-300' : 'text-red-300'}`}>
                        {r.status}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
