'use client'

import { useState } from 'react'
import { useDisasterState } from '@/store/disasterStore'
import { Activity, Battery, TrendingUp, TrendingDown, Minus, Wifi, WifiOff, AlertTriangle } from 'lucide-react'
import type { Sensor } from '@/types/disaster'

const TYPE_LABELS: Record<Sensor['type'], string> = {
  WATER_LEVEL:  'Water Level',
  RAINFALL:     'Rainfall',
  TEMPERATURE:  'Temperature',
  RIVER_LEVEL:  'River Level',
  AIR_QUALITY:  'Air Quality',
  STRUCTURAL:   'Structural',
}

const TYPE_COLOR: Record<Sensor['type'], string> = {
  WATER_LEVEL:  'text-cyan-300',
  RAINFALL:     'text-blue-300',
  TEMPERATURE:  'text-orange-300',
  RIVER_LEVEL:  'text-sky-300',
  AIR_QUALITY:  'text-lime-300',
  STRUCTURAL:   'text-amber-300',
}

function TrendIcon({ trend }: { trend: Sensor['trend'] }) {
  if (trend === 'RISING') return <TrendingUp size={11} className="text-red-400" />
  if (trend === 'FALLING') return <TrendingDown size={11} className="text-lime-400" />
  return <Minus size={11} className="text-white/30" />
}

function StatusIcon({ status }: { status: Sensor['status'] }) {
  if (status === 'ONLINE') return <Wifi size={10} className="text-lime-400" />
  if (status === 'DEGRADED') return <AlertTriangle size={10} className="text-amber-400" />
  return <WifiOff size={10} className="text-red-400" />
}

function MiniSparkline({ history }: { history: number[] }) {
  if (history.length < 2) return null
  const min = Math.min(...history)
  const max = Math.max(...history)
  const range = max - min || 1
  const w = 60
  const h = 20
  const pts = history.map((v, i) => {
    const x = (i / (history.length - 1)) * w
    const y = h - ((v - min) / range) * (h - 2) - 1
    return `${x},${y}`
  }).join(' ')

  return (
    <svg width={w} height={h} className="overflow-visible opacity-60">
      <polyline points={pts} fill="none" stroke="#22d3ee" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

function SensorCard({ sensor, onClick }: { sensor: Sensor; onClick: () => void }) {
  const typeColor = TYPE_COLOR[sensor.type]
  return (
    <button
      onClick={onClick}
      className="w-full text-left border border-white/8 bg-[#0b1c22] p-3 hover:border-cyan-400/30 hover:bg-cyan-400/[0.03] transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className={`font-mono text-[8px] uppercase tracking-wider ${typeColor}`}>
            {sensor.id}
          </p>
          <p className="mt-0.5 font-mono text-base font-semibold text-white leading-none">
            {sensor.reading.toFixed(2)}
            <span className="ml-1 text-[9px] font-normal text-white/40">{sensor.unit}</span>
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <TrendIcon trend={sensor.trend} />
          <StatusIcon status={sensor.status} />
        </div>
      </div>
      <div className="mt-2 flex items-end justify-between gap-2">
        <MiniSparkline history={sensor.history} />
        <div className="flex items-center gap-1 font-mono text-[8px] text-white/30">
          <Battery size={9} />
          {sensor.battery.toFixed(0)}%
        </div>
      </div>
      <p className="mt-1 font-mono text-[8px] text-white/25">{TYPE_LABELS[sensor.type]} · {sensor.lastUpdated}</p>
    </button>
  )
}

function SensorDetail({ sensor, onClose }: { sensor: Sensor; onClose: () => void }) {
  return (
    <div className="border border-cyan-300/20 bg-[#071820]/95 p-4">
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="font-mono text-[8px] uppercase tracking-[0.2em] text-cyan-300">Sensor Detail</p>
          <h3 className="mt-1 text-sm font-semibold text-white">{sensor.name}</h3>
        </div>
        <button onClick={onClose} className="text-white/30 hover:text-white font-mono text-lg leading-none">×</button>
      </div>

      <div className="grid grid-cols-2 gap-px border border-white/8 bg-white/8 mb-4">
        {[
          ['Reading', `${sensor.reading.toFixed(2)} ${sensor.unit}`],
          ['Trend', sensor.trend],
          ['Battery', `${sensor.battery.toFixed(0)}%`],
          ['Status', sensor.status],
          ['Type', TYPE_LABELS[sensor.type]],
          ['Updated', sensor.lastUpdated],
        ].map(([k, v]) => (
          <div key={k} className="bg-[#0b1c22] px-3 py-2">
            <p className="font-mono text-[8px] uppercase tracking-wider text-white/35">{k}</p>
            <p className="mt-1 font-mono text-[10px] text-white/80">{v}</p>
          </div>
        ))}
      </div>

      <p className="font-mono text-[9px] uppercase tracking-wider text-white/30 mb-2">History</p>
      <div className="flex items-end gap-1 h-12">
        {sensor.history.map((v, i) => {
          const max = Math.max(...sensor.history)
          const pct = max > 0 ? (v / max) * 100 : 0
          return (
            <div key={i} className="flex-1 flex flex-col items-center justify-end h-full gap-0.5">
              <div
                className="w-full bg-cyan-400/40 min-h-[2px] transition-all"
                style={{ height: `${pct}%` }}
              />
            </div>
          )
        })}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <div
          className="h-1.5 flex-1 bg-white/10 rounded-full overflow-hidden"
        >
          <div
            className={`h-full transition-all ${sensor.battery > 50 ? 'bg-lime-400' : sensor.battery > 20 ? 'bg-amber-400' : 'bg-red-400'}`}
            style={{ width: `${sensor.battery}%` }}
          />
        </div>
        <span className="font-mono text-[8px] text-white/30">{sensor.battery.toFixed(0)}%</span>
      </div>
    </div>
  )
}

export function SensorPanel() {
  const { sensors } = useDisasterState()
  const [selected, setSelected] = useState<Sensor | null>(null)
  const [filter, setFilter] = useState<Sensor['type'] | 'ALL'>('ALL')

  const filtered = filter === 'ALL' ? sensors : sensors.filter(s => s.type === filter)
  const online = sensors.filter(s => s.status === 'ONLINE').length
  const degraded = sensors.filter(s => s.status === 'DEGRADED').length

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/8 shrink-0">
        <div className="flex items-center gap-2">
          <Activity size={13} className="text-white/40" />
          <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/60">Sensors</span>
        </div>
        <div className="flex items-center gap-2 font-mono text-[8px]">
          <span className="text-lime-300">{online} ONLINE</span>
          {degraded > 0 && <span className="text-amber-300">{degraded} DEGRADED</span>}
        </div>
      </div>

      {/* Type filter */}
      <div className="flex gap-px overflow-x-auto p-2 shrink-0 border-b border-white/8">
        {(['ALL', 'WATER_LEVEL', 'RAINFALL', 'TEMPERATURE', 'AIR_QUALITY', 'STRUCTURAL'] as const).map(t => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={`shrink-0 px-2 py-1 font-mono text-[7px] uppercase tracking-wider transition-colors ${
              filter === t
                ? 'bg-cyan-400/15 text-cyan-300 border border-cyan-400/30'
                : 'text-white/30 hover:text-white/60 border border-transparent'
            }`}
          >
            {t === 'ALL' ? 'All' : TYPE_LABELS[t].split(' ')[0]}
          </button>
        ))}
      </div>

      {/* Detail or grid */}
      {selected ? (
        <div className="overflow-y-auto p-3">
          <SensorDetail sensor={selected} onClose={() => setSelected(null)} />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-3 grid grid-cols-1 gap-1.5">
          {filtered.map(sensor => (
            <SensorCard key={sensor.id} sensor={sensor} onClick={() => setSelected(sensor)} />
          ))}
        </div>
      )}
    </div>
  )
}
