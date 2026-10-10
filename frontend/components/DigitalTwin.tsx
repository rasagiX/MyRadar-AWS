'use client'

import { useState } from 'react'
import { useDisasterState } from '@/store/disasterStore'
import { Boxes, Zap, Droplets, Hospital, Home, Building2, Shield, AlertTriangle, CheckCircle } from 'lucide-react'
import type { Building, CriticalInfrastructure } from '@/types/disaster'

// ─── Visual config ────────────────────────────────────────────────────────────
const BUILDING_STATUS_CONFIG = {
  HEALTHY:   { color: 'border-lime-400/30 bg-lime-400/[0.05]',    label: 'HEALTHY',   dot: 'bg-lime-400',   icon: CheckCircle },
  AT_RISK:   { color: 'border-amber-400/30 bg-amber-400/[0.05]',  label: 'AT RISK',   dot: 'bg-amber-400',  icon: AlertTriangle },
  FLOODED:   { color: 'border-cyan-400/30 bg-cyan-400/[0.05]',    label: 'FLOODED',   dot: 'bg-cyan-400',   icon: Droplets },
  CRITICAL:  { color: 'border-red-400/35 bg-red-400/[0.06]',      label: 'CRITICAL',  dot: 'bg-red-400',    icon: AlertTriangle },
  EVACUATED: { color: 'border-white/15 bg-white/[0.02]',          label: 'EVACUATED', dot: 'bg-white/30',   icon: Shield },
}

const INFRA_STATUS_CONFIG = {
  OPERATIONAL: { color: 'text-lime-300',  dot: 'bg-lime-400' },
  DEGRADED:    { color: 'text-amber-300', dot: 'bg-amber-400' },
  OFFLINE:     { color: 'text-red-300',   dot: 'bg-red-400' },
  AT_RISK:     { color: 'text-orange-300',dot: 'bg-orange-400' },
}

const INFRA_ICON: Record<CriticalInfrastructure['type'], React.ComponentType<{ size?: number }>> = {
  HOSPITAL:        Hospital,
  POWER_PLANT:     Zap,
  WATER_TREATMENT: Droplets,
  BRIDGE:          Building2,
  EMERGENCY_CENTER:Shield,
  FUEL_DEPOT:      Home,
}

// ─── 3D building representation (CSS perspective) ─────────────────────────────
function Building3D({ building, selected, onClick }: {
  building: Building; selected: boolean; onClick: () => void
}) {
  const sc = BUILDING_STATUS_CONFIG[building.status]
  // Height proportional to floors (1–12 floors mapped to 24–96px)
  const h = Math.min(24 + building.floors * 8, 96)
  // Width: random-ish but deterministic per building
  const seed = building.id.charCodeAt(building.id.length - 1)
  const w = 28 + (seed % 4) * 8

  // Flood fill height
  const floodH = building.floodDepth > 0 ? Math.min((building.floodDepth / 3) * h, h) : 0

  return (
    <button
      onClick={onClick}
      title={building.name}
      className={`relative border shrink-0 transition-all hover:scale-110 hover:z-10 ${sc.color} ${selected ? 'ring-1 ring-cyan-400 scale-110 z-10' : ''}`}
      style={{ width: w, height: h, perspective: '200px' }}
    >
      {/* Flood water fill */}
      {floodH > 0 && (
        <div
          className="absolute bottom-0 left-0 right-0 bg-cyan-500/30 border-t border-cyan-400/50 transition-all"
          style={{ height: floodH }}
        />
      )}
      {/* Status dot */}
      <span className={`absolute top-1 right-1 h-1.5 w-1.5 rounded-full ${sc.dot}`} />
      {/* Floor lines */}
      {Array.from({ length: building.floors - 1 }).map((_, i) => (
        <div
          key={i}
          className="absolute left-0 right-0 border-t border-white/5"
          style={{ bottom: ((i + 1) / building.floors) * 100 + '%' }}
        />
      ))}
    </button>
  )
}

function BuildingDetail({ building, onClose }: { building: Building; onClose: () => void }) {
  const sc = BUILDING_STATUS_CONFIG[building.status]
  const { rescueTeams } = useDisasterState()
  const nearby = rescueTeams
    .filter(t => t.sector === building.sector && (t.status === 'RESCUING' || t.status === 'AVAILABLE'))
    .slice(0, 2)

  const Icon = sc.icon

  return (
    <div className="border border-cyan-300/20 bg-[#071820]/95 p-4 mt-3">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`flex h-8 w-8 items-center justify-center border ${sc.color}`}>
            <Icon size={14} />
          </div>
          <div>
            <p className="font-mono text-[8px] uppercase tracking-[0.2em] text-cyan-300">Digital Twin Object</p>
            <h3 className="text-sm font-semibold text-white">{building.name}</h3>
          </div>
        </div>
        <button onClick={onClose} className="text-white/30 hover:text-white font-mono text-lg">×</button>
      </div>

      <div className="grid grid-cols-2 gap-px border border-white/8 bg-white/8 mb-3">
        {[
          ['Status',      sc.label],
          ['Occupants',   String(building.occupants)],
          ['Flood Depth', `${building.floodDepth.toFixed(1)}m`],
          ['Sector',      building.sector],
          ['Floors',      String(building.floors)],
          ['Type',        building.type.replace('_', ' ')],
        ].map(([k, v]) => (
          <div key={k} className="bg-[#0b1c22] px-3 py-2">
            <p className="font-mono text-[7px] uppercase tracking-wider text-white/25">{k}</p>
            <p className="mt-0.5 font-mono text-[10px] text-white/80">{v}</p>
          </div>
        ))}
      </div>

      {building.floodDepth > 0 && (
        <div className="border border-cyan-400/15 bg-cyan-400/[0.04] p-2.5 mb-3">
          <p className="font-mono text-[8px] text-cyan-300">Flood depth {building.floodDepth.toFixed(2)}m</p>
          <div className="mt-1 h-2 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-cyan-400/60 transition-all" style={{ width: `${Math.min((building.floodDepth / 3) * 100, 100)}%` }} />
          </div>
        </div>
      )}

      {nearby.length > 0 && (
        <div>
          <p className="font-mono text-[8px] uppercase tracking-wider text-white/25 mb-1.5">Nearby Rescue Teams</p>
          {nearby.map(t => (
            <div key={t.id} className="flex items-center justify-between py-1 border-b border-white/5 font-mono text-[8px]">
              <span className="text-white/60">{t.id} · {t.name}</span>
              <span className="text-amber-300">{t.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function DigitalTwin() {
  const { buildings, criticalInfrastructure, floodZones, rescueTeams } = useDisasterState()
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null)
  const [showLayer, setShowLayer] = useState<'buildings' | 'infra' | 'flood'>('buildings')

  const criticalBuildings = buildings.filter(b => b.status === 'CRITICAL').length
  const floodedBuildings = buildings.filter(b => b.status === 'FLOODED').length

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/8 shrink-0">
        <div className="flex items-center gap-2">
          <Boxes size={13} className="text-white/40" />
          <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/60">Digital Twin</span>
        </div>
        <div className="flex items-center gap-2 font-mono text-[8px]">
          {criticalBuildings > 0 && <span className="text-red-300">{criticalBuildings} CRITICAL</span>}
          {floodedBuildings > 0 && <span className="text-cyan-300">{floodedBuildings} FLOODED</span>}
        </div>
      </div>

      {/* Layer tabs */}
      <div className="flex border-b border-white/8 shrink-0">
        {(['buildings', 'infra', 'flood'] as const).map(l => (
          <button
            key={l}
            onClick={() => setShowLayer(l)}
            className={`flex-1 py-2 font-mono text-[8px] uppercase tracking-wider transition-colors ${showLayer === l ? 'text-cyan-300 border-b border-cyan-400/50 bg-cyan-400/[0.04]' : 'text-white/30 hover:text-white/55'}`}
          >
            {l === 'buildings' ? 'Buildings' : l === 'infra' ? 'Infrastructure' : 'Flood Zones'}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {showLayer === 'buildings' && (
          <div className="p-4">
            {/* 3D skyline view */}
            <div className="border border-white/8 bg-[#040e14] p-4 mb-4">
              <p className="font-mono text-[8px] uppercase tracking-wider text-white/20 mb-3">City Skyline — Flood View</p>
              <div className="flex items-end gap-2 overflow-x-auto pb-2" style={{ minHeight: 100 }}>
                {buildings.map(b => (
                  <Building3D
                    key={b.id}
                    building={b}
                    selected={selectedBuilding?.id === b.id}
                    onClick={() => setSelectedBuilding(prev => prev?.id === b.id ? null : b)}
                  />
                ))}
              </div>
              {/* Ground line */}
              <div className="h-px bg-white/10 mt-1" />
              <div className="flex items-center justify-between mt-1.5 font-mono text-[7px] text-white/15">
                <span>SECTOR 4 ←</span><span>→ SECTOR 7</span>
              </div>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-2 mb-3">
              {Object.entries(BUILDING_STATUS_CONFIG).map(([status, cfg]) => (
                <div key={status} className="flex items-center gap-1 font-mono text-[7px] text-white/40">
                  <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                  {cfg.label}
                </div>
              ))}
            </div>

            {/* Building detail */}
            {selectedBuilding && (
              <BuildingDetail building={selectedBuilding} onClose={() => setSelectedBuilding(null)} />
            )}

            {/* Building list */}
            <p className="font-mono text-[8px] uppercase tracking-wider text-white/25 mb-2">All Objects ({buildings.length})</p>
            <div className="flex flex-col gap-1">
              {buildings.map(b => {
                const sc = BUILDING_STATUS_CONFIG[b.status]
                const Icon = sc.icon
                return (
                  <button
                    key={b.id}
                    onClick={() => setSelectedBuilding(prev => prev?.id === b.id ? null : b)}
                    className={`flex items-center gap-2 border p-2 text-left transition-colors hover:border-white/20 ${selectedBuilding?.id === b.id ? 'border-cyan-400/30 bg-cyan-400/[0.04]' : 'border-white/6'}`}
                  >
                    <Icon size={11} className={sc.dot.replace('bg-', 'text-').replace('-400', '-300').replace('-300', '-300')} />
                    <span className="flex-1 font-mono text-[9px] text-white/65 truncate">{b.name}</span>
                    <span className="font-mono text-[7px] text-white/30">{b.sector}</span>
                    <span className={`font-mono text-[7px] uppercase border px-1 py-0.5 ${sc.color}`}>{sc.label}</span>
                    {b.floodDepth > 0 && (
                      <span className="font-mono text-[7px] text-cyan-300">{b.floodDepth.toFixed(1)}m</span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {showLayer === 'infra' && (
          <div className="p-4 flex flex-col gap-2">
            <p className="font-mono text-[9px] uppercase tracking-wider text-white/40 mb-1">Critical Infrastructure</p>
            {criticalInfrastructure.sort((a, b) => a.priority - b.priority).map(ci => {
              const sc = INFRA_STATUS_CONFIG[ci.status]
              const Icon = INFRA_ICON[ci.type]
              return (
                <div key={ci.id} className="flex items-center gap-3 border border-white/8 p-3">
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center border ${sc.color} border-current/25 bg-current/5`}>
                    <Icon size={15} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-[9px] text-white/70">{ci.name}</p>
                    <p className="font-mono text-[8px] text-white/30">{ci.type.replace('_', ' ')}</p>
                  </div>
                  <div className="flex items-center gap-1.5 font-mono text-[8px]">
                    <span className={`h-1.5 w-1.5 rounded-full ${sc.dot}`} />
                    <span className={sc.color}>{ci.status}</span>
                  </div>
                </div>
              )
            })}

            {/* Active rescue teams */}
            <p className="font-mono text-[9px] uppercase tracking-wider text-white/40 mt-3 mb-1">
              Active Rescue Assets
            </p>
            {rescueTeams
              .filter(t => t.status !== 'OFFLINE')
              .map(t => (
                <div key={t.id} className="flex items-center justify-between border border-white/6 p-2.5">
                  <div>
                    <span className="font-mono text-[9px] text-white/65">{t.id}</span>
                    <span className="font-mono text-[8px] text-white/30 ml-2">{t.sector}</span>
                  </div>
                  <span className={`font-mono text-[8px] ${t.status === 'RESCUING' ? 'text-red-300' : t.status === 'AVAILABLE' ? 'text-lime-300' : 'text-amber-300'}`}>
                    {t.status}
                  </span>
                </div>
              ))}
          </div>
        )}

        {showLayer === 'flood' && (
          <div className="p-4 flex flex-col gap-3">
            {floodZones.map(z => (
              <div
                key={z.id}
                className={`border p-3 ${z.severity === 'CRITICAL' ? 'border-cyan-500/40 bg-cyan-500/[0.05]' : z.severity === 'HIGH' ? 'border-cyan-400/25 bg-cyan-400/[0.03]' : 'border-white/10'}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-[9px] text-white/70">{z.name}</span>
                  <span className={`font-mono text-[8px] uppercase ${z.severity === 'CRITICAL' ? 'text-cyan-300' : z.severity === 'HIGH' ? 'text-sky-300' : 'text-blue-300'}`}>
                    {z.severity}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 font-mono text-[8px]">
                  <div>
                    <p className="text-white/25 text-[7px] uppercase tracking-wider">Depth</p>
                    <p className="text-cyan-300 mt-0.5">{z.waterDepth.toFixed(2)}m</p>
                  </div>
                  <div>
                    <p className="text-white/25 text-[7px] uppercase tracking-wider">Affected</p>
                    <p className="text-white/70 mt-0.5">{z.affectedPeople.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-white/25 text-[7px] uppercase tracking-wider">Rate</p>
                    <p className="text-amber-300 mt-0.5">{z.expansionRate} m/hr</p>
                  </div>
                </div>
                <div className="mt-2 h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-cyan-400/60"
                    style={{ width: `${Math.min((z.waterDepth / 5) * 100, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
