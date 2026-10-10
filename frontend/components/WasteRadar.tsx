'use client'

import { useState } from 'react'
import { useDisasterState } from '@/store/disasterStore'
import { useSimulationControls } from '@/store/disasterStore'
import { Search, AlertTriangle, Trash2, Trees, Building2, Construction, Upload } from 'lucide-react'
import type { WasteZone } from '@/types/disaster'
import { getMockDetectionResult } from '@/services/aws/s3'

const TYPE_CONFIG: Record<WasteZone['type'], { label: string; icon: React.ComponentType<{ size?: number; className?: string }>; color: string }> = {
  DEBRIS:           { label: 'Debris Zone',        icon: Trash2,       color: 'text-amber-300' },
  BLOCKED_ROAD:     { label: 'Blocked Road',        icon: Construction, color: 'text-red-300' },
  HAZARDOUS:        { label: 'Hazardous Zone',      icon: AlertTriangle,color: 'text-red-400' },
  FALLEN_STRUCTURE: { label: 'Fallen Structure',    icon: Building2,    color: 'text-orange-300' },
  GARBAGE:          { label: 'Garbage / Debris',    icon: Trees,        color: 'text-lime-300' },
}

const SEV_COLOR: Record<WasteZone['severity'], string> = {
  LOW:      'border-white/15 text-white/40',
  MEDIUM:   'border-amber-400/30 text-amber-300',
  HIGH:     'border-orange-400/30 text-orange-300',
  CRITICAL: 'border-red-400/40 text-red-300',
}

function WasteCard({ zone }: { zone: WasteZone }) {
  const tc = TYPE_CONFIG[zone.type]
  const Icon = tc.icon
  return (
    <div className={`flex gap-2.5 border p-2.5 ${SEV_COLOR[zone.severity]} bg-white/[0.015]`}>
      <Icon size={13} className={`shrink-0 mt-0.5 ${tc.color}`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[9px] text-white/60">{tc.label}</span>
          <span className={`font-mono text-[7px] uppercase border px-1 py-0.5 ${SEV_COLOR[zone.severity]}`}>
            {zone.severity}
          </span>
        </div>
        <p className="mt-0.5 text-[9px] text-white/55 leading-relaxed">{zone.description}</p>
        <div className="mt-1 flex items-center gap-2 font-mono text-[7px] text-white/25">
          <span>Detected {zone.detectedAt}</span>
          <span className="text-white/15">·</span>
          <span>{zone.location.lat.toFixed(4)}°N {Math.abs(zone.location.lng).toFixed(4)}°W</span>
        </div>
      </div>
    </div>
  )
}

interface DetectionAnimState {
  running: boolean
  step: 'idle' | 'uploading' | 'analyzing' | 'complete'
  result: string | null
}

export function WasteRadar() {
  const { wasteZones } = useDisasterState()
  const { detectDebris } = useSimulationControls()
  const [anim, setAnim] = useState<DetectionAnimState>({ running: false, step: 'idle', result: null })

  const byType = wasteZones.reduce<Record<string, number>>((acc, z) => {
    acc[z.type] = (acc[z.type] ?? 0) + 1
    return acc
  }, {})

  const critical = wasteZones.filter(z => z.severity === 'CRITICAL').length
  const high = wasteZones.filter(z => z.severity === 'HIGH').length

  async function runScan() {
    setAnim({ running: true, step: 'uploading', result: null })
    await sleep(900)
    setAnim(a => ({ ...a, step: 'analyzing' }))
    await sleep(1400)
    const res = getMockDetectionResult()
    const summary = res.objects.map(o => `${(o.confidence * 100).toFixed(0)}% · ${o.description}`).join('\n')
    setAnim({ running: false, step: 'complete', result: summary })
    detectDebris()   // also adds a zone to the map
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/8 shrink-0">
        <div className="flex items-center gap-2">
          <Search size={13} className="text-white/40" />
          <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/60">Flood Waste Radar</span>
        </div>
        <div className="flex items-center gap-2 font-mono text-[8px]">
          {critical > 0 && <span className="text-red-300">{critical} CRITICAL</span>}
          <span className="text-white/40">{wasteZones.length} zones</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-px border border-white/8 bg-white/8">
          {[
            ['Total Detections', String(wasteZones.length)],
            ['Critical Zones',   String(critical)],
            ['High Risk',        String(high)],
            ['Blocked Roads',    String(byType['BLOCKED_ROAD'] ?? 0)],
            ['Debris Fields',    String(byType['DEBRIS'] ?? 0)],
            ['Hazardous',        String(byType['HAZARDOUS'] ?? 0)],
          ].map(([k, v]) => (
            <div key={k} className="bg-[#0b1c22] p-2.5">
              <p className="font-mono text-[7px] uppercase tracking-wider text-white/30">{k}</p>
              <p className="font-mono text-lg text-white/90 mt-1">{v}</p>
            </div>
          ))}
        </div>

        {/* AWS architecture callout */}
        <div className="border border-white/8 p-3 font-mono text-[8px] text-white/35">
          <p className="text-cyan-300 mb-2 uppercase tracking-wider">AWS Pipeline</p>
          {['Drone/Aerial Image', 'Amazon S3 Upload', 'Lambda Trigger', 'Image Analysis (Rekognition)', 'Debris / Flood Detection', 'Waste Zone Map Update'].map((step, i, arr) => (
            <div key={step} className="flex items-center gap-1.5">
              <span>{step}</span>
              {i < arr.length - 1 && <span className="text-white/20 ml-auto">↓</span>}
            </div>
          ))}
        </div>

        {/* Scan trigger */}
        <div className="border border-cyan-400/15 p-3">
          <p className="font-mono text-[8px] uppercase tracking-wider text-white/30 mb-2">Simulate Drone Scan</p>

          {anim.step === 'uploading' && (
            <div className="flex items-center gap-2 font-mono text-[9px] text-cyan-300 mb-2">
              <Upload size={11} className="animate-bounce" /> Uploading to Amazon S3…
            </div>
          )}
          {anim.step === 'analyzing' && (
            <div className="flex items-center gap-2 font-mono text-[9px] text-amber-300 mb-2">
              <Search size={11} className="animate-spin" /> Analyzing image…
            </div>
          )}
          {anim.step === 'complete' && anim.result && (
            <div className="border border-lime-400/20 bg-lime-400/[0.04] p-2.5 mb-2 font-mono text-[8px] text-white/60">
              <p className="text-lime-300 mb-1">Analysis Complete ✓</p>
              {anim.result.split('\n').map((line, i) => <p key={i}>{line}</p>)}
            </div>
          )}

          <button
            onClick={runScan}
            disabled={anim.running}
            className={`w-full py-2 font-mono text-[9px] uppercase tracking-wider border flex items-center justify-center gap-2 transition-colors ${
              anim.running
                ? 'border-white/10 text-white/20 cursor-not-allowed'
                : 'border-amber-400/30 text-amber-300 hover:bg-amber-400/[0.06]'
            }`}
          >
            <Search size={10} />
            {anim.running ? 'Scanning…' : 'Run Aerial Scan'}
          </button>
        </div>

        {/* Zone list */}
        <div>
          <p className="font-mono text-[9px] uppercase tracking-wider text-white/40 mb-2">Detected Zones</p>
          <div className="flex flex-col gap-1.5">
            {wasteZones.map(z => <WasteCard key={z.id} zone={z} />)}
          </div>
        </div>
      </div>
    </div>
  )
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }
