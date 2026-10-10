'use client'

import { useSimulationControls, useNetworkStatus } from '@/store/disasterStore'
import {
  Play, Pause, RotateCcw, CloudRain, Droplets, Route,
  Siren, Users, Search, WifiOff, Wifi, RefreshCw,
  ChevronRight,
} from 'lucide-react'

const SPEED_OPTIONS = [1, 2, 5, 10] as const

export function SimulationControls() {
  const {
    simulationRunning, simulationSpeed, simulationTime,
    play, pause, setSpeed,
    simulateFlood, raiseWater, blockRoad, createIncident,
    fillShelter, detectDebris, reset,
  } = useSimulationControls()

  const { networkStatus, failInternet, restoreInternet } = useNetworkStatus()
  const isOffline = networkStatus === 'OFFLINE'

  const elapsed = `T+${String(Math.floor(simulationTime / 60)).padStart(2, '0')}:${String(simulationTime % 60).padStart(2, '0')}`

  return (
    <div className="flex flex-col gap-3 p-4 border border-white/8 bg-[#0a1820]/80">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/40">
          Simulation Controls
        </span>
        <span className="font-mono text-[9px] text-cyan-300">{elapsed}</span>
      </div>

      {/* Play / Pause + Speed */}
      <div className="flex items-center gap-2">
        <button
          onClick={simulationRunning ? pause : play}
          className={`flex items-center gap-1.5 px-3 py-2 border font-mono text-[9px] uppercase tracking-wider transition-colors ${
            simulationRunning
              ? 'border-amber-400/40 bg-amber-400/10 text-amber-300'
              : 'border-lime-400/40 bg-lime-400/10 text-lime-300'
          }`}
        >
          {simulationRunning ? <Pause size={11} /> : <Play size={11} />}
          {simulationRunning ? 'PAUSE' : 'PLAY'}
        </button>

        <div className="flex gap-px">
          {SPEED_OPTIONS.map(s => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={`px-2 py-2 border font-mono text-[9px] uppercase tracking-wider transition-colors ${
                simulationSpeed === s
                  ? 'border-cyan-400/50 bg-cyan-400/10 text-cyan-300'
                  : 'border-white/10 text-white/30 hover:text-white/60'
              }`}
            >
              {s}×
            </button>
          ))}
        </div>

        <button
          onClick={reset}
          title="Reset scenario"
          className="ml-auto p-2 border border-white/10 text-white/30 hover:text-white/60 transition-colors"
        >
          <RotateCcw size={12} />
        </button>
      </div>

      {/* Demo action buttons */}
      <div className="grid grid-cols-2 gap-1.5">
        <DemoButton icon={CloudRain} label="Simulate Flood" onClick={simulateFlood} tone="critical" />
        <DemoButton icon={Droplets} label="Raise Water" onClick={raiseWater} tone="warning" />
        <DemoButton icon={Route} label="Block Road" onClick={blockRoad} tone="warning" />
        <DemoButton icon={Siren} label="New Incident" onClick={createIncident} tone="rescue" />
        <DemoButton icon={Users} label="Fill Shelter" onClick={fillShelter} tone="shelter" />
        <DemoButton icon={Search} label="Detect Debris" onClick={detectDebris} tone="info" />
      </div>

      {/* Network failure controls */}
      <div className="border-t border-white/8 pt-3 flex gap-2">
        {!isOffline ? (
          <button
            onClick={failInternet}
            className="flex flex-1 items-center justify-center gap-1.5 border border-red-400/30 bg-red-400/[0.06] px-3 py-2 font-mono text-[9px] uppercase tracking-wider text-red-300 hover:bg-red-400/10 transition-colors"
          >
            <WifiOff size={11} /> Fail Internet
          </button>
        ) : (
          <button
            onClick={restoreInternet}
            className="flex flex-1 items-center justify-center gap-1.5 border border-lime-400/30 bg-lime-400/[0.06] px-3 py-2 font-mono text-[9px] uppercase tracking-wider text-lime-300 hover:bg-lime-400/10 transition-colors"
          >
            <Wifi size={11} /> Restore Internet
          </button>
        )}
        <button
          onClick={restoreInternet}
          className="flex items-center gap-1.5 border border-white/10 px-3 py-2 font-mono text-[9px] uppercase tracking-wider text-white/40 hover:text-cyan-300 transition-colors"
          title="Force sync"
        >
          <RefreshCw size={11} />
        </button>
      </div>
    </div>
  )
}

function DemoButton({
  icon: Icon, label, onClick, tone,
}: {
  icon: React.ComponentType<{ size?: number }>
  label: string
  onClick: () => void
  tone: 'critical' | 'warning' | 'rescue' | 'shelter' | 'info'
}) {
  const colors = {
    critical: 'border-red-400/25 text-red-300 hover:bg-red-400/10',
    warning:  'border-amber-400/25 text-amber-300 hover:bg-amber-400/10',
    rescue:   'border-orange-400/25 text-orange-300 hover:bg-orange-400/10',
    shelter:  'border-sky-400/25 text-sky-300 hover:bg-sky-400/10',
    info:     'border-cyan-400/25 text-cyan-300 hover:bg-cyan-400/10',
  }
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 border px-2 py-1.5 font-mono text-[8px] uppercase tracking-wider transition-colors ${colors[tone]}`}
    >
      <Icon size={10} />
      <span className="truncate">{label}</span>
      <ChevronRight size={9} className="ml-auto shrink-0 opacity-40" />
    </button>
  )
}
