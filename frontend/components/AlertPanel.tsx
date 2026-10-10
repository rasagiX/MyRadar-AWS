'use client'

import { useDisasterState, useDisasterDispatch } from '@/store/disasterStore'
import { AlertTriangle, Bell, CheckCircle, Info, Siren, Truck, Home } from 'lucide-react'
import type { Alert } from '@/types/disaster'

const SEVERITY_CONFIG = {
  CRITICAL: { color: 'border-red-500 text-red-300',   bg: 'bg-red-500/[0.06]',   dot: 'bg-red-400',    icon: AlertTriangle },
  WARNING:  { color: 'border-amber-400 text-amber-300', bg: 'bg-amber-400/[0.06]', dot: 'bg-amber-400',  icon: AlertTriangle },
  INFO:     { color: 'border-cyan-400 text-cyan-300',   bg: 'bg-cyan-400/[0.05]',  dot: 'bg-cyan-400',   icon: Info },
  RESCUE:   { color: 'border-orange-400 text-orange-300', bg: 'bg-orange-400/[0.05]', dot: 'bg-orange-400', icon: Siren },
  SHELTER:  { color: 'border-sky-400 text-sky-300',    bg: 'bg-sky-400/[0.05]',   dot: 'bg-sky-400',    icon: Home },
  SUPPLY:   { color: 'border-lime-400 text-lime-300',  bg: 'bg-lime-400/[0.05]',  dot: 'bg-lime-400',   icon: Truck },
} as const

function AlertRow({ alert, onAck }: { alert: Alert; onAck: (id: string) => void }) {
  const cfg = SEVERITY_CONFIG[alert.severity]
  const Icon = cfg.icon
  return (
    <div className={`flex gap-2.5 border-l-2 p-2.5 ${cfg.color} ${cfg.bg} ${alert.acknowledged ? 'opacity-40' : ''} transition-opacity`}>
      <Icon size={12} className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[8px] uppercase tracking-wider opacity-80">{alert.severity}</span>
          <span className="font-mono text-[8px] text-white/30">{alert.timestamp}</span>
        </div>
        <p className="mt-0.5 text-[10px] leading-relaxed text-white/75">{alert.message}</p>
      </div>
      {!alert.acknowledged && (
        <button
          onClick={() => onAck(alert.id)}
          title="Acknowledge"
          className="shrink-0 text-white/20 hover:text-lime-300 transition-colors"
        >
          <CheckCircle size={12} />
        </button>
      )}
    </div>
  )
}

export function AlertPanel({ maxItems = 12 }: { maxItems?: number }) {
  const { alerts } = useDisasterState()
  const dispatch = useDisasterDispatch()
  const unacked = alerts.filter(a => !a.acknowledged)
  const visible = alerts.slice(0, maxItems)

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
        <div className="flex items-center gap-2">
          <Bell size={13} className="text-white/40" />
          <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/60">Live Alerts</span>
        </div>
        <div className="flex items-center gap-2">
          {unacked.length > 0 && (
            <span className="rounded-sm bg-red-400/20 px-1.5 py-0.5 font-mono text-[8px] text-red-300">
              {unacked.length} ACTIVE
            </span>
          )}
          <span className="font-mono text-[8px] text-cyan-300">{alerts.length}</span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto flex flex-col gap-px">
        {visible.length === 0 ? (
          <div className="p-4 text-center font-mono text-[9px] uppercase tracking-wider text-white/20">
            No active alerts
          </div>
        ) : (
          visible.map(alert => (
            <AlertRow
              key={alert.id}
              alert={alert}
              onAck={(id) => dispatch({ type: 'ACKNOWLEDGE_ALERT', payload: id })}
            />
          ))
        )}
      </div>
    </div>
  )
}

/** Compact ticker version for the bottom bar */
export function AlertTicker() {
  const { alerts } = useDisasterState()
  const recent = alerts.slice(0, 6)
  return (
    <div className="flex items-center gap-6 overflow-hidden">
      <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.2em] text-cyan-300">
        Live Activity
      </span>
      {recent.map(a => {
        const cfg = SEVERITY_CONFIG[a.severity]
        const textColor = cfg.color.includes('text-') ? cfg.color.split(' ').find(c => c.startsWith('text-')) ?? 'text-white/50' : 'text-white/50'
        return (
          <span key={a.id} className="flex shrink-0 items-center gap-2 font-mono text-[9px] uppercase tracking-wider text-white/45">
            <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${cfg.dot}`} />
            <span className="text-white/30">{a.timestamp}</span>
            <span className={textColor}>{a.severity}</span>
            <span className="max-w-[200px] truncate">{a.message}</span>
          </span>
        )
      })}
    </div>
  )
}
