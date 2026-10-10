'use client'

/**
 * OperationsPanel — Operator Control Centre
 *
 * Provides all 6 required features:
 *   1. Water-level slider (0.0–5.0 m)          → SET_WATER_LEVEL
 *   2. Flood zone update                        → happens inside applySetWaterLevel
 *   3. Road block / reopen per road             → SET_ROAD_STATUS
 *   4. Evacuation routes recalculate            → EvacuationPanel watches road changes
 *   5. Affected population + shelter metrics    → derived inside applySetWaterLevel
 *   6. Reset Scenario button (with confirmation)→ RESET_SCENARIO
 */

import { useState, useCallback, useRef } from 'react'
import {
  Droplets, Route, RotateCcw, AlertTriangle,
  CheckCircle, Lock, Unlock, ChevronDown, ChevronUp,
  Gauge, Users, TrendingUp, TrendingDown,
} from 'lucide-react'
import { useDisasterState, useSimulationControls } from '@/store/disasterStore'
import type { Road } from '@/types/disaster'

// ── colour helpers ────────────────────────────────────────────────────────────
const levelTextColor = (v: number) =>
  v > 3.5 ? 'text-red-400' : v > 2.5 ? 'text-amber-300' : v > 1.5 ? 'text-yellow-300' : 'text-cyan-300'

const levelTrackColor = (v: number) =>
  v > 3.5 ? '#f87171' : v > 2.5 ? '#f59e0b' : v > 1.5 ? '#fbbf24' : '#22d3ee'

const roadStatusTextColor = (s: Road['status']) =>
  s === 'CLEAR' ? 'text-lime-300' : s === 'FLOODED' ? 'text-cyan-300' : 'text-red-300'

const roadStatusBorderBg = (s: Road['status']) =>
  s === 'CLEAR'
    ? 'border-lime-400/20 bg-lime-400/[0.04]'
    : s === 'FLOODED'
    ? 'border-cyan-400/20 bg-cyan-400/[0.04]'
    : 'border-red-400/20 bg-red-400/[0.04]'

// ══ Water-Level Slider ════════════════════════════════════════════════════════
function WaterSlider() {
  const { averageWaterLevel, floodRisk, severity, affectedPeople, sensors, floodZones } =
    useDisasterState()
  const { setWaterLevel } = useSimulationControls()

  // Local value for smooth drag; committed to store on mouseup/touchend
  const [local, setLocal] = useState<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const displayed = local ?? averageWaterLevel
  const pct = Math.min((displayed / 5) * 100, 100)
  const trackColor = levelTrackColor(displayed)

  function onInput(e: React.ChangeEvent<HTMLInputElement>) {
    setLocal(parseFloat(e.target.value))
  }
  function commit() {
    const v = parseFloat(inputRef.current?.value ?? String(displayed))
    setWaterLevel(v)
    setLocal(null)
  }

  const waterSensors = sensors.filter(s => s.type === 'WATER_LEVEL')
  const totalZoneAffected = floodZones.reduce((a, z) => a + z.affectedPeople, 0)

  return (
    <section className="flex flex-col gap-3 p-4 border border-white/8 bg-[#0d1b2e]/60">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Droplets size={14} className="text-cyan-400" />
          <span className="font-mono text-[10px] uppercase tracking-wider text-white/65 font-semibold">
            Water Level
          </span>
        </div>
        <span className={`font-mono text-[15px] font-bold tabular-nums ${levelTextColor(displayed)}`}>
          {displayed.toFixed(1)} m
        </span>
      </div>

      {/* Slider — native range input styled with CSS */}
      <div className="relative flex items-center h-6">
        {/* Custom track */}
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-2 rounded-full bg-white/10 overflow-hidden pointer-events-none">
          <div
            className="h-full rounded-full transition-all duration-75"
            style={{ width: `${pct}%`, background: trackColor }}
          />
        </div>
        {/* Native input — fully opaque for interaction, styled to hide default appearance */}
        <input
          ref={inputRef}
          type="range"
          min={0} max={5} step={0.1}
          value={displayed}
          onChange={onInput}
          onMouseUp={commit}
          onTouchEnd={commit}
          className="relative w-full h-6 appearance-none bg-transparent cursor-pointer z-10
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:w-5
            [&::-webkit-slider-thumb]:h-5
            [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:border-2
            [&::-webkit-slider-thumb]:border-white
            [&::-webkit-slider-thumb]:shadow-lg
            [&::-webkit-slider-thumb]:transition-transform
            [&::-webkit-slider-thumb]:hover:scale-110
            [&::-moz-range-thumb]:w-5
            [&::-moz-range-thumb]:h-5
            [&::-moz-range-thumb]:rounded-full
            [&::-moz-range-thumb]:border-2
            [&::-moz-range-thumb]:border-white
            [&::-moz-range-thumb]:bg-white"
          style={
            { '--thumb-color': trackColor,
            } as React.CSSProperties
          }
          aria-label="Water level in metres"
        />
      </div>

      {/* Scale labels */}
      <div className="flex justify-between px-0.5">
        {['0m','1m','2m','3m','4m','5m'].map(l => (
          <span key={l} className="font-mono text-[8px] text-white/25">{l}</span>
        ))}
      </div>

      {/* Preset buttons */}
      <div className="grid grid-cols-5 gap-1">
        {([
          ['Normal',   0.5,  'border-lime-400/25   text-lime-300'],
          ['Alert',    1.5,  'border-yellow-400/25 text-yellow-300'],
          ['Warning',  2.5,  'border-amber-400/25  text-amber-300'],
          ['Critical', 3.5,  'border-red-400/25    text-red-300'],
          ['Extreme',  4.5,  'border-red-600/40    text-red-400'],
        ] as const).map(([label, val, cls]) => (
          <button
            key={label}
            onClick={() => { setLocal(null); setWaterLevel(val) }}
            className={`py-1.5 border font-mono text-[7px] uppercase tracking-wider transition-all
              hover:opacity-90 ${cls}
              ${Math.abs(displayed - val) < 0.3 ? 'opacity-100 ring-1 ring-current' : 'opacity-60'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Derived metrics — update instantly with slider */}
      <div className="grid grid-cols-3 gap-px bg-white/5 border border-white/5">
        {([
          ['Flood Risk',  `${floodRisk}%`,
            floodRisk > 75 ? 'text-red-300' : floodRisk > 50 ? 'text-amber-300' : 'text-lime-400'],
          ['Severity',    severity,
            severity === 'CRITICAL' ? 'text-red-400' : severity === 'HIGH' ? 'text-amber-300' : 'text-yellow-300'],
          ['Affected',    totalZoneAffected > 0
            ? `${(totalZoneAffected / 100000).toFixed(1)}L`
            : `${(affectedPeople / 100000).toFixed(1)}L`,
            'text-white/70'],
        ] as const).map(([lbl, val, cls]) => (
          <div key={lbl} className="bg-[#0d1b2e] px-3 py-2.5">
            <p className="font-mono text-[7px] uppercase tracking-wider text-white/25">{lbl}</p>
            <p className={`font-mono text-[12px] font-bold mt-1 ${cls}`}>{val}</p>
          </div>
        ))}
      </div>

      {/* Flood zone depths */}
      {floodZones.length > 0 && (
        <div>
          <p className="font-mono text-[8px] uppercase tracking-wider text-white/25 mb-1.5">
            Flood Zone Depths
          </p>
          <div className="flex flex-col gap-1">
            {floodZones.map(z => (
              <div key={z.id} className="flex items-center justify-between py-1 border-b border-white/5 last:border-0 gap-2">
                <span className="font-mono text-[9px] text-white/55 truncate">{z.name}</span>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="w-16 h-1 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${Math.min((z.waterDepth / 6) * 100, 100)}%`, background: levelTrackColor(z.waterDepth) }}
                    />
                  </div>
                  <span className={`font-mono text-[9px] font-bold w-10 text-right ${levelTextColor(z.waterDepth)}`}>
                    {z.waterDepth.toFixed(1)}m
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Live sensor readings */}
      {waterSensors.length > 0 && (
        <div>
          <p className="font-mono text-[8px] uppercase tracking-wider text-white/25 mb-1.5">
            Sensor Readings
          </p>
          <div className="flex flex-col gap-1">
            {waterSensors.map(s => (
              <div key={s.id} className="flex items-center justify-between py-0.5">
                <span className="font-mono text-[9px] text-white/50 truncate">{s.name}</span>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {s.trend === 'RISING'
                    ? <TrendingUp size={10} className="text-red-400" />
                    : s.trend === 'FALLING'
                    ? <TrendingDown size={10} className="text-lime-400" />
                    : <span className="text-white/25 text-[9px]">→</span>
                  }
                  <span className={`font-mono text-[10px] font-bold tabular-nums ${levelTextColor(s.reading)}`}>
                    {s.reading.toFixed(2)} m
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

// ══ Road Manager ══════════════════════════════════════════════════════════════
function RoadManager() {
  const { roads } = useDisasterState()
  const { setRoadStatus } = useSimulationControls()
  const [expanded, setExpanded] = useState(true)
  const [reason, setReason] = useState('')

  const blockedCount = roads.filter(r => r.status !== 'CLEAR').length

  const block  = useCallback((id: string) => { setRoadStatus(id, 'BLOCKED',  reason || 'Operator closure'); setReason('') }, [setRoadStatus, reason])
  const flood  = useCallback((id: string) => { setRoadStatus(id, 'FLOODED',  reason || 'Flood water');      setReason('') }, [setRoadStatus, reason])
  const reopen = useCallback((id: string) => { setRoadStatus(id, 'CLEAR') },                                                 [setRoadStatus])

  return (
    <section className="flex flex-col border border-white/8 bg-[#0d1b2e]/60">

      {/* Collapsible header */}
      <button
        className="flex items-center justify-between px-4 py-3"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex items-center gap-2">
          <Route size={14} className="text-amber-400" />
          <span className="font-mono text-[10px] uppercase tracking-wider text-white/65 font-semibold">
            Road Manager
          </span>
          <span className={`font-mono text-[8px] border px-1.5 py-0.5
            ${blockedCount > 0
              ? 'border-red-400/25 text-red-300 bg-red-400/[0.05]'
              : 'border-lime-400/20 text-lime-300'}`}>
            {blockedCount} BLOCKED
          </span>
        </div>
        {expanded
          ? <ChevronUp size={13} className="text-white/30" />
          : <ChevronDown size={13} className="text-white/30" />}
      </button>

      {expanded && (
        <div className="px-3 pb-3 flex flex-col gap-2">

          {/* Optional reason */}
          <input
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Closure reason (optional)"
            className="w-full bg-[#0a1525] border border-white/10 px-3 py-2
              font-mono text-[10px] text-white/70 placeholder:text-white/20
              focus:outline-none focus:border-cyan-400/35 rounded-sm"
          />

          {/* Road list */}
          <div className="flex flex-col gap-1.5">
            {roads.map(road => (
              <div key={road.id}
                className={`flex items-start gap-2 p-2.5 border rounded-sm ${roadStatusBorderBg(road.status)}`}>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-[10px] text-white/85 font-medium">{road.name}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className={`font-mono text-[8px] font-bold uppercase ${roadStatusTextColor(road.status)}`}>
                      {road.status}
                    </span>
                    {road.riskLevel && (
                      <span className="font-mono text-[7px] text-white/30">
                        risk: {road.riskLevel}
                      </span>
                    )}
                    {road.waterDepth > 0 && (
                      <span className="font-mono text-[8px] text-cyan-300/70">
                        {road.waterDepth.toFixed(1)}m
                      </span>
                    )}
                    {road.blockedReason && road.status !== 'CLEAR' && (
                      <span className="font-mono text-[7px] text-white/30 truncate">
                        · {road.blockedReason}
                      </span>
                    )}
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  {road.status !== 'CLEAR' ? (
                    <button
                      onClick={() => reopen(road.id)}
                      className="flex items-center gap-1 px-2 py-1.5
                        border border-lime-400/30 bg-lime-400/[0.07] text-lime-300
                        hover:bg-lime-400/15 transition-colors rounded-sm
                        font-mono text-[8px] uppercase tracking-wide"
                    >
                      <Unlock size={10} /> Open
                    </button>
                  ) : (
                    <div className="flex gap-1">
                      <button
                        onClick={() => block(road.id)}
                        className="flex items-center gap-1 px-2 py-1.5
                          border border-red-400/25 bg-red-400/[0.07] text-red-300
                          hover:bg-red-400/15 transition-colors rounded-sm
                          font-mono text-[8px] uppercase tracking-wide"
                      >
                        <Lock size={10} /> Block
                      </button>
                      <button
                        onClick={() => flood(road.id)}
                        className="flex items-center gap-1 px-2 py-1.5
                          border border-cyan-400/25 bg-cyan-400/[0.07] text-cyan-300
                          hover:bg-cyan-400/15 transition-colors rounded-sm
                          font-mono text-[8px] uppercase tracking-wide"
                      >
                        <Droplets size={10} /> Flood
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Auto-recalc note */}
          <div className="flex items-center gap-1.5 border border-white/6 px-2.5 py-2 rounded-sm">
            <CheckCircle size={9} className="text-lime-400 shrink-0" />
            <p className="font-mono text-[8px] text-white/30">
              Evacuation routes recalculate automatically after road changes
            </p>
          </div>
        </div>
      )}
    </section>
  )
}

// ══ Shelter Metrics ═══════════════════════════════════════════════════════════
function ShelterMetrics() {
  const { shelters } = useDisasterState()
  const critical = shelters.filter(s => s.status === 'CRITICAL').length
  const warning  = shelters.filter(s => s.status === 'WARNING').length
  const safe     = shelters.filter(s => s.status === 'SAFE').length
  const totalOcc = shelters.reduce((a, s) => a + s.occupancy, 0)
  const totalCap = shelters.reduce((a, s) => a + s.capacity, 0)
  const pct      = totalCap > 0 ? Math.round((totalOcc / totalCap) * 100) : 0

  return (
    <section className="flex flex-col gap-2 p-4 border border-white/8 bg-[#0d1b2e]/60">
      <div className="flex items-center gap-2 mb-1">
        <Users size={14} className="text-sky-400" />
        <span className="font-mono text-[10px] uppercase tracking-wider text-white/65 font-semibold">
          Shelter Metrics
        </span>
      </div>

      {/* Overall bar */}
      <div>
        <div className="flex justify-between mb-1">
          <span className="font-mono text-[8px] text-white/35 uppercase tracking-wider">
            Overall Capacity
          </span>
          <span className={`font-mono text-[9px] font-bold ${pct > 90 ? 'text-red-300' : pct > 75 ? 'text-amber-300' : 'text-lime-300'}`}>
            {pct}% — {totalOcc.toLocaleString()} / {totalCap.toLocaleString()}
          </span>
        </div>
        <div className="h-2 bg-white/8 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${pct > 90 ? 'bg-red-400' : pct > 75 ? 'bg-amber-400' : 'bg-lime-400'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Status pills */}
      <div className="grid grid-cols-3 gap-1">
        {([
          ['CRITICAL', critical, 'border-red-400/25 text-red-300   bg-red-400/[0.06]'],
          ['WARNING',  warning,  'border-amber-400/25 text-amber-300 bg-amber-400/[0.06]'],
          ['SAFE',     safe,     'border-lime-400/20 text-lime-300  bg-lime-400/[0.05]'],
        ] as const).map(([label, count, cls]) => (
          <div key={label} className={`border px-2 py-2 text-center rounded-sm ${cls}`}>
            <p className={`font-mono text-[18px] font-bold`}>{count}</p>
            <p className="font-mono text-[7px] uppercase tracking-wider opacity-70 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Per-shelter bars */}
      <div className="flex flex-col gap-2 mt-1">
        {shelters.map(s => {
          const p = Math.round((s.occupancy / s.capacity) * 100)
          return (
            <div key={s.id}>
              <div className="flex justify-between mb-0.5">
                <span className="font-mono text-[9px] text-white/60 truncate">{s.name}</span>
                <span className={`font-mono text-[8px] ${
                  s.status === 'CRITICAL' ? 'text-red-300' : s.status === 'WARNING' ? 'text-amber-300' : 'text-lime-300'}`}>
                  {p}%
                </span>
              </div>
              <div className="h-1 bg-white/8 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    p > 90 ? 'bg-red-400' : p > 75 ? 'bg-amber-400' : 'bg-lime-400'}`}
                  style={{ width: `${p}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

// ══ Reset Scenario ════════════════════════════════════════════════════════════
function ResetSection() {
  const { reset } = useSimulationControls()
  const [confirming, setConfirming] = useState(false)

  function handle() {
    if (!confirming) { setConfirming(true); return }
    reset()
    setConfirming(false)
  }

  return (
    <section className="flex flex-col gap-3 p-4 border border-white/8 bg-[#0d1b2e]/60">
      <div className="flex items-center gap-2">
        <RotateCcw size={14} className="text-white/40" />
        <span className="font-mono text-[10px] uppercase tracking-wider text-white/65 font-semibold">
          Reset Scenario
        </span>
      </div>
      <p className="font-mono text-[9px] text-white/35 leading-relaxed">
        Restores all sensors, flood zones, roads, shelters and rescue teams to
        their initial state. Clears all alerts and sync queue.
      </p>

      {confirming && (
        <div className="flex items-start gap-2 border border-amber-400/25 bg-amber-400/[0.05] px-3 py-2 rounded-sm">
          <AlertTriangle size={11} className="text-amber-300 shrink-0 mt-0.5" />
          <p className="font-mono text-[8px] text-amber-300 leading-relaxed">
            All simulation progress will be lost. Click Confirm Reset to proceed.
          </p>
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={handle}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 border
            font-mono text-[9px] uppercase tracking-wider transition-colors ${
            confirming
              ? 'border-amber-400/50 bg-amber-400/10 text-amber-300 hover:bg-amber-400/18'
              : 'border-white/15 text-white/45 hover:border-white/30 hover:text-white/70'
          }`}
        >
          <RotateCcw size={11} />
          {confirming ? 'Confirm Reset' : 'Reset Scenario'}
        </button>
        {confirming && (
          <button
            onClick={() => setConfirming(false)}
            className="px-4 py-2.5 border border-white/10 font-mono text-[9px] text-white/35
              hover:text-white/60 hover:border-white/20 transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
    </section>
  )
}

// ══ Main panel ════════════════════════════════════════════════════════════════
export function OperationsPanel() {
  const { floodRisk, affectedPeople } = useDisasterState()

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/8 shrink-0">
        <div className="flex items-center gap-2">
          <Gauge size={14} className="text-white/50" />
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/70 font-semibold">
            Operations Control
          </span>
        </div>
        <div className="flex items-center gap-3 font-mono text-[9px]">
          <span className={floodRisk > 70 ? 'text-red-300' : floodRisk > 45 ? 'text-amber-300' : 'text-lime-300'}>
            Risk {floodRisk}%
          </span>
          <span className="text-white/30">
            {(affectedPeople / 100000).toFixed(1)}L affected
          </span>
        </div>
      </div>

      {/* Scrollable sections */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
        <WaterSlider />
        <RoadManager />
        <ShelterMetrics />
        <ResetSection />
      </div>
    </div>
  )
}
