'use client'

import { useState } from 'react'
import { useDisasterState, useDisasterDispatch } from '@/store/disasterStore'
import { Siren, Shield, Plane, Stethoscope, Flame, User, ChevronRight, Radio } from 'lucide-react'
import type { RescueTeam } from '@/types/disaster'

const TYPE_CONFIG: Record<RescueTeam['type'], { label: string; icon: React.ComponentType<{ size?: number }>; color: string }> = {
  URBAN_RESCUE: { label: 'Urban Rescue',  icon: Siren,       color: 'text-orange-300' },
  MEDICAL:      { label: 'Medical',       icon: Stethoscope, color: 'text-red-300' },
  FIRE:         { label: 'Fire',          icon: Flame,       color: 'text-amber-300' },
  POLICE:       { label: 'Police',        icon: Shield,      color: 'text-blue-300' },
  DRONE:        { label: 'Drone',         icon: Plane,       color: 'text-cyan-300' },
  LOGISTICS:    { label: 'Logistics',     icon: User,        color: 'text-lime-300' },
}

const STATUS_COLOR: Record<RescueTeam['status'], string> = {
  AVAILABLE:    'text-lime-300 bg-lime-400/10 border-lime-400/25',
  RESPONDING:   'text-amber-300 bg-amber-400/10 border-amber-400/25',
  RESCUING:     'text-red-300 bg-red-400/10 border-red-400/25',
  TRANSPORTING: 'text-sky-300 bg-sky-400/10 border-sky-400/25',
  RETURNING:    'text-cyan-300 bg-cyan-400/10 border-cyan-400/25',
  OFFLINE:      'text-white/25 bg-white/5 border-white/10',
}

function TeamCard({ team, onClick }: { team: RescueTeam; onClick: () => void }) {
  const tc = TYPE_CONFIG[team.type]
  const Icon = tc.icon
  return (
    <button
      onClick={onClick}
      className="w-full text-left border border-white/8 bg-[#0b1c22] p-3 hover:border-orange-400/25 hover:bg-orange-400/[0.02] transition-colors"
    >
      <div className="flex items-start gap-2.5">
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center border ${STATUS_COLOR[team.status]}`}>
          <Icon size={14} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[10px] font-semibold text-white/90">{team.id}</span>
            <span className={`font-mono text-[7px] uppercase tracking-wider border px-1.5 py-0.5 ${STATUS_COLOR[team.status]}`}>
              {team.status}
            </span>
          </div>
          <p className="mt-0.5 font-mono text-[9px] text-white/40">{tc.label} · {team.sector}</p>
          {team.mission && (
            <p className="mt-1 text-[9px] text-white/60 truncate">{team.mission}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          <ChevronRight size={11} className="text-white/20" />
          <span className="font-mono text-[7px] text-white/25">{team.battery.toFixed(0)}%</span>
        </div>
      </div>
      {team.priority && (
        <div className={`mt-2 flex items-center gap-1 font-mono text-[7px] uppercase tracking-wider border-t border-white/5 pt-2 ${team.priority === 'CRITICAL' ? 'text-red-400' : team.priority === 'HIGH' ? 'text-amber-300' : 'text-white/30'}`}>
          Priority: {team.priority}
        </div>
      )}
    </button>
  )
}

function TeamDetail({ team, onClose }: { team: RescueTeam; onClose: () => void }) {
  const dispatch = useDisasterDispatch()
  const tc = TYPE_CONFIG[team.type]
  const Icon = tc.icon

  const NEXT_STATUSES: RescueTeam['status'][] = ['AVAILABLE', 'RESPONDING', 'RESCUING', 'TRANSPORTING', 'RETURNING']

  return (
    <div className="border border-orange-400/20 bg-[#0d1e28]/95 p-4">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={`flex h-9 w-9 items-center justify-center border ${STATUS_COLOR[team.status]}`}>
            <Icon size={16} />
          </div>
          <div>
            <p className="font-mono text-[8px] uppercase tracking-[0.2em] text-orange-300">Rescue Asset</p>
            <h3 className="text-sm font-semibold text-white">{team.name}</h3>
          </div>
        </div>
        <button onClick={onClose} className="text-white/30 hover:text-white font-mono text-lg">×</button>
      </div>

      <div className="grid grid-cols-2 gap-px border border-white/8 bg-white/8 mb-4">
        {[
          ['Team ID',   team.id],
          ['Type',      tc.label],
          ['Status',    team.status],
          ['Sector',    team.sector],
          ['Battery',   `${team.battery.toFixed(0)}%`],
          ['Priority',  team.priority ?? 'None'],
        ].map(([k, v]) => (
          <div key={k} className="bg-[#0b1c22] px-3 py-2">
            <p className="font-mono text-[7px] uppercase tracking-wider text-white/25">{k}</p>
            <p className="mt-0.5 font-mono text-[10px] text-white/80">{v}</p>
          </div>
        ))}
      </div>

      {team.mission && (
        <div className="border border-amber-400/15 bg-amber-400/[0.04] p-2.5 mb-3">
          <p className="font-mono text-[7px] uppercase tracking-wider text-amber-300 mb-1">Current Mission</p>
          <p className="text-[10px] text-white/70 leading-relaxed">{team.mission}</p>
        </div>
      )}

      {/* Quick status update */}
      <p className="font-mono text-[8px] uppercase tracking-wider text-white/25 mb-2">Update Status</p>
      <div className="flex flex-wrap gap-1">
        {NEXT_STATUSES.map(s => (
          <button
            key={s}
            onClick={() => {
              dispatch({ type: 'UPDATE_RESCUE_TEAM_STATUS', payload: { id: team.id, status: s } })
              onClose()
            }}
            className={`px-2 py-1 font-mono text-[7px] uppercase border transition-colors ${
              team.status === s
                ? STATUS_COLOR[s]
                : 'border-white/10 text-white/30 hover:text-white/60'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-1.5 font-mono text-[8px] text-white/25">
        <Radio size={9} />
        Telemetry active · {new Date().toLocaleTimeString('en-GB', { hour12: false })}
      </div>
    </div>
  )
}

export function RescuePanel() {
  const { rescueTeams } = useDisasterState()
  const [selected, setSelected] = useState<RescueTeam | null>(null)
  const [filter, setFilter] = useState<RescueTeam['status'] | 'ALL'>('ALL')

  const filtered = filter === 'ALL' ? rescueTeams : rescueTeams.filter(t => t.status === filter)
  const active = rescueTeams.filter(t => t.status !== 'AVAILABLE' && t.status !== 'OFFLINE').length
  const available = rescueTeams.filter(t => t.status === 'AVAILABLE').length

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/8 shrink-0">
        <div className="flex items-center gap-2">
          <Siren size={13} className="text-white/40" />
          <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/60">RescueMesh</span>
        </div>
        <div className="flex items-center gap-3 font-mono text-[8px]">
          <span className="text-red-300">{active} ACTIVE</span>
          <span className="text-lime-300">{available} FREE</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-px overflow-x-auto p-2 shrink-0 border-b border-white/8">
        {(['ALL', 'AVAILABLE', 'RESCUING', 'RESPONDING', 'TRANSPORTING', 'RETURNING'] as const).map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`shrink-0 px-2 py-1 font-mono text-[7px] uppercase tracking-wider transition-colors ${
              filter === s ? 'bg-orange-400/10 text-orange-300 border border-orange-400/25' : 'text-white/30 hover:text-white/55 border border-transparent'
            }`}
          >
            {s === 'ALL' ? 'All' : s}
          </button>
        ))}
      </div>

      {/* Detail or list */}
      {selected ? (
        <div className="overflow-y-auto p-3">
          <TeamDetail team={selected} onClose={() => setSelected(null)} />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-1.5">
          {filtered.map(team => (
            <TeamCard key={team.id} team={team} onClick={() => setSelected(team)} />
          ))}
        </div>
      )}
    </div>
  )
}
