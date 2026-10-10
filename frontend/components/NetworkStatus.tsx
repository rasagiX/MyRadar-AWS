'use client'

import { useNetworkStatus } from '@/store/disasterStore'
import { Cloud, CloudOff, RefreshCw, Wifi } from 'lucide-react'

const CONFIG = {
  CONNECTED:    { label: 'AWS CONNECTED',  color: 'text-lime-300',   dot: 'bg-lime-400',   icon: Cloud,      glow: 'shadow-lime-400/30' },
  SYNCING:      { label: 'SYNCING',         color: 'text-cyan-300',   dot: 'bg-cyan-400',   icon: RefreshCw,  glow: 'shadow-cyan-400/30' },
  OFFLINE:      { label: 'OFFLINE MODE',   color: 'text-red-300',    dot: 'bg-red-400',    icon: CloudOff,   glow: 'shadow-red-400/30' },
  RECONNECTING: { label: 'RECONNECTING',   color: 'text-amber-300',  dot: 'bg-amber-400',  icon: Wifi,       glow: 'shadow-amber-400/30' },
} as const

export function NetworkStatus() {
  const { networkStatus, syncQueueCount, isSyncing } = useNetworkStatus()
  const cfg = CONFIG[networkStatus]
  const Icon = cfg.icon

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 border border-white/10 bg-[#08161b]/80 backdrop-blur font-mono text-[9px] uppercase tracking-wider ${cfg.color}`}>
      {/* animated dot */}
      <span className="relative flex h-2 w-2 shrink-0">
        <span className={`absolute inline-flex h-full w-full rounded-full ${cfg.dot} opacity-60 ${networkStatus !== 'OFFLINE' ? 'animate-ping' : ''}`} />
        <span className={`relative inline-flex h-2 w-2 rounded-full ${cfg.dot}`} />
      </span>
      <Icon size={11} className={isSyncing ? 'animate-spin' : ''} />
      <span>{cfg.label}</span>
      {syncQueueCount > 0 && (
        <span className="ml-1 rounded-sm bg-white/10 px-1.5 py-0.5 text-white/60">
          {syncQueueCount} queued
        </span>
      )}
    </div>
  )
}

/** Full offline banner shown in the right panel or as modal overlay */
export function OfflineBanner() {
  const { networkStatus, syncQueueCount } = useNetworkStatus()
  if (networkStatus !== 'OFFLINE') return null

  return (
    <div className="border border-red-400/30 bg-red-400/[0.06] p-4 font-mono">
      <div className="flex items-center gap-2 text-red-300 mb-3">
        <CloudOff size={14} />
        <span className="text-[10px] uppercase tracking-[0.2em] font-semibold">NEXUS OFFLINE MODE ACTIVE</span>
      </div>
      <div className="grid grid-cols-2 gap-1 text-[9px] uppercase tracking-wider">
        {[
          ['Cloud Services',   'UNAVAILABLE', 'text-red-300'],
          ['Local Operations', 'ACTIVE',      'text-lime-300'],
          ['Local Routing',    'ACTIVE',      'text-lime-300'],
          ['Local Database',   'ACTIVE',      'text-lime-300'],
          ['Local AI',         'ACTIVE',      'text-lime-300'],
          ['Pending Sync',     `${syncQueueCount} EVENTS`, 'text-amber-300'],
        ].map(([label, value, cls]) => (
          <div key={label} className="flex justify-between gap-2 py-1 border-b border-white/5">
            <span className="text-white/40">{label}</span>
            <span className={cls}>{value}</span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[9px] text-white/35 leading-relaxed">
        When the network goes down, response doesn't.
      </p>
    </div>
  )
}

/** Compact badge for the top header bar */
export function NetworkBadge() {
  const { networkStatus } = useNetworkStatus()
  const cfg = CONFIG[networkStatus]
  return (
    <div className={`flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wider ${cfg.color}`}>
      <span className="relative flex h-1.5 w-1.5">
        <span className={`absolute inline-flex h-full w-full rounded-full ${cfg.dot} ${networkStatus !== 'OFFLINE' ? 'animate-ping opacity-60' : ''}`} />
        <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      </span>
      {cfg.label}
    </div>
  )
}
