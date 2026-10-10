'use client'

import { useState, useCallback, useEffect } from 'react'
import {
  Activity, AlertTriangle, Bell, Boxes, Bot,
  ChevronRight, CloudRain, Droplets, Eye, Home,
  Layers3, Menu, Route, Search, Siren, Sliders, Truck,
  Users, X, RefreshCw, Play, Pause, RotateCcw,
  WifiOff, Wifi, Shield, Radio, Radar,
} from 'lucide-react'

import { useDisasterState, useNetworkStatus, useSimulationControls } from '@/store/disasterStore'
import { OfflineBanner } from '@/components/NetworkStatus'
import { AlertTicker }   from '@/components/AlertPanel'
import { SensorPanel }   from '@/components/SensorPanel'
import { EvacuationPanel } from '@/components/EvacuationPanel'
import { RescuePanel }   from '@/components/RescuePanel'
import { ReliefPanel }   from '@/components/ReliefPanel'
import { WasteRadar }    from '@/components/WasteRadar'
import { DigitalTwin }   from '@/components/DigitalTwin'
import { DisasterAI }    from '@/components/DisasterAI'
import { SyncPanel }       from '@/components/SyncPanel'
import { OperationsPanel } from '@/components/OperationsPanel'
import { IncidentPanel }   from '@/components/IncidentPanel'
import { DisasterMapLive, type LayerFlags } from '@/components/DisasterMap'
import type { MapSelection } from '@/components/disaster-map'

// ─── Nav config ──────────────────────────────────────────────────────────────
type NavId = 'overview' | 'evacuation' | 'rescue' | 'relief'
           | 'waste' | 'twin' | 'sensors' | 'ai' | 'sync' | 'ops' | 'incidents'

interface NavItem {
  id:       NavId
  label:    string
  icon:     React.ComponentType<{ size?: number; className?: string }>
  section?: string
  badge?:   'teams' | 'alerts' | 'sync'
}

const NAV: NavItem[] = [
  { id: 'overview',   label: 'Overview',      icon: Home,       section: 'OPERATIONS' },
  { id: 'evacuation', label: 'Evacuation',    icon: Route },
  { id: 'rescue',     label: 'Rescue Mesh',   icon: Siren,      badge: 'teams' },
  { id: 'relief',     label: 'Relief Route',  icon: Truck },
  { id: 'incidents',  label: 'Incidents',     icon: AlertTriangle, badge: 'alerts' },
  { id: 'ops',        label: 'Operations',    icon: Sliders },
  { id: 'waste',      label: 'Waste Radar',   icon: Search,     section: 'INTELLIGENCE' },
  { id: 'twin',       label: 'Digital Twin',  icon: Boxes },
  { id: 'sensors',    label: 'Sensors',       icon: Activity },
  { id: 'ai',         label: 'MyRadar AI',    icon: Bot,        section: 'SYSTEM' },
  { id: 'sync',       label: 'AWS Sync',      icon: RefreshCw,  badge: 'sync' },
]

// ─── Layer keys ───────────────────────────────────────────────────────────────
type LayerKey = keyof LayerFlags
const LAYER_LABELS: Record<LayerKey, string> = {
  floodZones:'Flood Zones', shelters:'Shelters', rescueTeams:'Teams',
  vehicles:'Vehicles', sensors:'Sensors', wasteZones:'Waste', evacuationRoutes:'Routes',
}
const DEFAULT_LAYERS: LayerFlags = {
  floodZones:true, shelters:true, rescueTeams:true,
  vehicles:true, sensors:true, wasteZones:true, evacuationRoutes:true,
}

// ─── Live clock ───────────────────────────────────────────────────────────────
function LiveClock() {
  const [t, setT] = useState('')
  useEffect(() => {
    const tick = () => setT(new Date().toLocaleTimeString('en-GB', { hour12: false }))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])
  return <span className="tag text-white/40 tabular-nums">{t} UTC</span>
}

// ─── Network badge ────────────────────────────────────────────────────────────
function NetBadge() {
  const { networkStatus, syncQueueCount, isSyncing } = useNetworkStatus()
  const MAP = {
    CONNECTED:    { label: 'AWS Connected',  dot: 'bg-lime-400',  cls: 'text-lime-300  border-lime-400/20',  pulse: true },
    SYNCING:      { label: 'Syncing…',       dot: 'bg-cyan-400',  cls: 'text-cyan-300  border-cyan-400/20',  pulse: true },
    OFFLINE:      { label: 'Offline Mode',   dot: 'bg-red-400',   cls: 'text-red-300   border-red-400/25',   pulse: false },
    RECONNECTING: { label: 'Reconnecting',   dot: 'bg-amber-400', cls: 'text-amber-300 border-amber-400/20', pulse: true },
  } as const
  const cfg = MAP[networkStatus]
  return (
    <div className={`net-badge ${cfg.cls}`}>
      <span className={`net-dot ${cfg.dot} ${cfg.pulse ? 'net-pulse' : ''}`} />
      <span className="tag">{cfg.label}</span>
      {syncQueueCount > 0 && <span className="tag opacity-50">· {syncQueueCount}</span>}
    </div>
  )
}

// ─── Header metrics strip ─────────────────────────────────────────────────────
function HeaderMetrics() {
  const {
    severity, floodRisk, affectedPeople, averageWaterLevel,
    rescueTeams, alerts,
  } = useDisasterState()

  const activeTeams = rescueTeams.filter(t => t.status !== 'AVAILABLE' && t.status !== 'OFFLINE').length
  const unacked     = alerts.filter(a => !a.acknowledged).length
  const sevColor    = { CRITICAL:'#f87171', HIGH:'#f59e0b', ELEVATED:'#fbbf24', NORMAL:'#84cc16' }[severity] ?? '#84cc16'
  const riskColor   = floodRisk > 70 ? '#f87171' : floodRisk > 45 ? '#f59e0b' : '#84cc16'

  return (
    <div className="mr-metrics">
      {[
        { lbl:'Event',       val:'Urban Flood',                       color:'rgba(221,229,239,0.65)' },
        { lbl:'Severity',    val: severity,                           color: sevColor },
        { lbl:'Flood Risk',  val:`${floodRisk}%`,                     color: riskColor },
        { lbl:'Water Level', val:`${averageWaterLevel.toFixed(1)} m`, color:'#22d3ee' },
        { lbl:'Affected',    val: affectedPeople.toLocaleString(),    color:'rgba(221,229,239,0.70)' },
        { lbl:'Teams Active',val: String(activeTeams),                color:'#fb923c' },
        { lbl:'Alerts',      val: String(unacked),                    color: unacked > 2 ? '#f87171' : '#84cc16' },
      ].map(m => (
        <div key={m.lbl} className="mr-metric">
          <span className="mr-metric-lbl">{m.lbl}</span>
          <span className="mr-metric-val" style={{ color: m.color }}>{m.val}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Map popup card ───────────────────────────────────────────────────────────
function MapPopup({ sel, onClose }: { sel: MapSelection; onClose: () => void }) {
  const ACCENT: Record<string, string> = {
    critical:'#f87171', warning:'#f59e0b', rescue:'#fb923c',
    shelter:'#38bdf8', supply:'#4ade80', cyan:'#22d3ee',
  }
  const accent = ACCENT[sel.color] ?? '#22d3ee'

  return (
    <div className="map-popup">
      <div className="map-popup-top" style={{ borderTop: `2px solid ${accent}` }}>
        <div className="map-popup-type">{sel.type}</div>
        <div className="map-popup-title">{sel.title}</div>
      </div>
      <div className="map-popup-body">{sel.detail}</div>
      <div className="map-popup-foot">
        <span className="tag text-cyan-300/50">telemetry · live</span>
        <button
          onClick={onClose}
          className="text-white/30 hover:text-white/80 transition-colors text-lg leading-none font-mono"
          aria-label="Close"
        >×</button>
      </div>
    </div>
  )
}

// ─── Simulation HUD (inside overview panel) ───────────────────────────────────
function SimHUD() {
  const {
    simulationRunning, simulationSpeed, simulationTime,
    play, pause, setSpeed,
    simulateFlood, raiseWater, blockRoad,
    createIncident, fillShelter, detectDebris, reset,
  } = useSimulationControls()
  const { networkStatus, failInternet, restoreInternet } = useNetworkStatus()

  const elapsed = `T+${String(Math.floor(simulationTime / 60)).padStart(2,'0')}:${String(simulationTime % 60).padStart(2,'0')}`
  const isOffline = networkStatus === 'OFFLINE'

  return (
    <div className="sim-hud">
      {/* title row */}
      <div className="flex items-center justify-between mb-2">
        <span className="sim-hud-title">Simulation Engine</span>
        <span className="tag text-cyan-300/50">{elapsed}</span>
      </div>

      {/* play/pause + speed */}
      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={simulationRunning ? pause : play}
          className={`flex items-center gap-1.5 px-3 py-1.5 border text-[9px] uppercase tracking-wide transition-colors ${
            simulationRunning
              ? 'border-amber-400/25 text-amber-300 bg-amber-400/[0.05]'
              : 'border-lime-400/25 text-lime-400  bg-lime-400/[0.05]'
          }`}
        >
          {simulationRunning ? <Pause size={10}/> : <Play size={10}/>}
          {simulationRunning ? 'Pause' : 'Play'}
        </button>
        <div className="flex gap-px">
          {([1,2,5,10] as const).map(s => (
            <button key={s} onClick={() => setSpeed(s)}
              className={`sim-spd ${simulationSpeed === s ? 'active' : ''}`}>
              {s}×
            </button>
          ))}
        </div>
        <button onClick={reset} title="Reset scenario"
          className="ml-auto text-white/25 hover:text-white/60 transition-colors">
          <RotateCcw size={13}/>
        </button>
      </div>

      {/* action buttons 2-col */}
      <div className="grid grid-cols-2 gap-1 mb-2">
        {[
          { label:'Simulate Flood', fn: simulateFlood, cls:'text-red-300  border-red-400/20',     icon: CloudRain },
          { label:'Raise Water',    fn: raiseWater,    cls:'text-cyan-300 border-cyan-400/20',    icon: Droplets },
          { label:'Block Road',     fn: blockRoad,     cls:'text-amber-300 border-amber-400/20',  icon: Route },
          { label:'New Incident',   fn: createIncident,cls:'text-orange-300 border-orange-400/20',icon: Siren },
          { label:'Fill Shelter',   fn: fillShelter,   cls:'text-sky-300  border-sky-400/20',     icon: Users },
          { label:'Detect Debris',  fn: detectDebris,  cls:'text-yellow-300 border-yellow-400/20',icon: Search },
        ].map(({ label, fn, cls, icon: Icon }) => (
          <button key={label} onClick={fn}
            className={`sim-btn border ${cls}`}>
            <Icon size={9}/><span className="truncate">{label}</span>
          </button>
        ))}
      </div>

      {/* network toggle */}
      <div className="flex gap-2 pt-2 border-t border-[var(--b-faint)]">
        {!isOffline ? (
          <button onClick={failInternet}
            className="sim-btn border border-red-400/20 text-red-300 flex-1 justify-center">
            <WifiOff size={9}/> Kill Internet
          </button>
        ) : (
          <button onClick={restoreInternet}
            className="sim-btn border border-lime-400/20 text-lime-400 flex-1 justify-center">
            <Wifi size={9}/> Restore Internet
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Overview panel ───────────────────────────────────────────────────────────
function OverviewPanel({ onNav }: { onNav:(id:NavId)=>void }) {
  const {
    severity, floodRisk, affectedPeople, averageWaterLevel,
    rescueTeams, shelters, roads, alerts,
    activeIncidentCount, wasteZones,
  } = useDisasterState()

  const active   = rescueTeams.filter(t => t.status !== 'AVAILABLE' && t.status !== 'OFFLINE').length
  const blocked  = roads.filter(r => r.status === 'BLOCKED' || r.status === 'FLOODED').length
  const unacked  = alerts.filter(a => !a.acknowledged).length
  const safeSh   = shelters.filter(s => s.status === 'SAFE').length

  const sevColor = {
    CRITICAL:'text-red-400', HIGH:'text-amber-300',
    ELEVATED:'text-yellow-300', NORMAL:'text-lime-400',
  }[severity] ?? 'text-white'

  const fillCls  = floodRisk > 70 ? 'pg-red' : floodRisk > 45 ? 'pg-amber' : 'pg-green'

  return (
    <div className="flex flex-col h-full overflow-y-auto">

      {/* severity banner */}
      <div className="sev-banner">
        <div className="sev-label">Disaster Status</div>
        <div className={`sev-value ${sevColor}`}>{severity}</div>
        <div className="flex items-center gap-2 mt-1.5">
          <span className="tag text-white/30">Flood Risk</span>
          <span className={`tag font-bold ${floodRisk > 70 ? 'text-red-300' : floodRisk > 45 ? 'text-amber-300' : 'text-lime-400'}`}>
            {floodRisk}%
          </span>
          <div className="flex-1 sev-bar">
            <div className={`sev-fill ${fillCls}`} style={{ width:`${floodRisk}%` }}/>
          </div>
        </div>
      </div>

      {/* metrics */}
      <div className="stats-grid">
        {([
          ['Affected',      affectedPeople.toLocaleString(), Users,         'text-white/80'],
          ['Active Teams',  String(active),                  Siren,         'text-orange-300'],
          ['Water Level',   `${averageWaterLevel.toFixed(1)}m`, CloudRain,  floodRisk > 50 ? 'text-red-300' : 'text-cyan-300'],
          ['Roads Blocked', String(blocked),                 Route,         blocked > 3 ? 'text-red-300' : 'text-amber-300'],
          ['Safe Shelters', String(safeSh),                  Home,          'text-lime-400'],
          ['Alerts',        String(unacked),                  Bell,          unacked > 2 ? 'text-red-300' : 'text-amber-300'],
          ['Incidents',     String(activeIncidentCount),     AlertTriangle, 'text-red-300'],
          ['Waste Zones',   String(wasteZones.length),       Search,        'text-amber-300'],
        ] as const).map(([lbl, val, Icon, cls]) => (
          <div key={lbl} className="stat-cell">
            <div className="stat-lbl">
              <span>{lbl}</span>
              <Icon size={10} className="opacity-40"/>
            </div>
            <div className={`stat-val ${cls}`}>{val}</div>
          </div>
        ))}
      </div>

      {/* offline banner */}
      <OfflineBanner/>

      {/* recent alerts */}
      <div className="psec">
        <span className="psec-t">Recent Alerts</span>
        <span className="psec-v">{alerts.length} total</span>
      </div>
      {alerts.slice(0, 5).map(a => {
        const dotCls = {
          CRITICAL:'bg-red-400', WARNING:'bg-amber-400', INFO:'bg-sky-400',
          RESCUE:'bg-orange-400', SHELTER:'bg-sky-400', SUPPLY:'bg-green-400',
        }[a.severity] ?? 'bg-white/30'
        const txtCls = {
          CRITICAL:'text-red-300', WARNING:'text-amber-300', INFO:'text-sky-300',
          RESCUE:'text-orange-300', SHELTER:'text-sky-300', SUPPLY:'text-green-300',
        }[a.severity] ?? 'text-white/50'
        return (
          <div key={a.id} className={`alert-row ar-${a.severity} ${a.acknowledged ? 'opacity-35' : ''}`}>
            <span className={`alert-dot ${dotCls}`}/>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className={`alert-sev ${txtCls}`}>{a.severity}</span>
                <span className="alert-time">{a.timestamp}</span>
              </div>
              <p className="alert-msg truncate">{a.message}</p>
            </div>
          </div>
        )
      })}

      {/* quick-access grid */}
      <div className="psec mt-1">
        <span className="psec-t">Quick Access</span>
      </div>
      <div className="qa-grid">
        {([
          ['Evacuation','evacuation', Route,   'text-lime-400'],
          ['Rescue',    'rescue',     Siren,   'text-orange-300'],
          ['Relief',    'relief',     Truck,   'text-cyan-300'],
          ['AI Query',  'ai',         Bot,     'text-violet-300'],
        ] as const).map(([lbl, id, Icon, cls]) => (
          <button key={id} onClick={() => onNav(id)}
            className="qa-cell">
            <Icon size={14} className={cls}/>
            <span className={`text-[11px] font-medium ${cls}`}>{lbl}</span>
            <ChevronRight size={10} className="ml-auto text-white/20"/>
          </button>
        ))}
      </div>

      {/* sim HUD */}
      <SimHUD/>
    </div>
  )
}

// ─── Panel router ─────────────────────────────────────────────────────────────
function PanelContent({ id, onNav }: { id: NavId; onNav:(x:NavId)=>void }) {
  switch (id) {
    case 'overview':   return <OverviewPanel onNav={onNav}/>
    case 'evacuation': return <EvacuationPanel/>
    case 'rescue':     return <RescuePanel/>
    case 'relief':     return <ReliefPanel/>
    case 'incidents':  return <IncidentPanel/>
    case 'ops':        return <OperationsPanel/>
    case 'waste':      return <WasteRadar/>
    case 'twin':       return <DigitalTwin/>
    case 'sensors':    return <SensorPanel/>
    case 'ai':         return <DisasterAI/>
    case 'sync':       return <SyncPanel/>
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function Page() {
  const [active,       setActive]       = useState<NavId>('overview')
  const [panelOpen,    setPanelOpen]    = useState(true)
  const [mobileNav,    setMobileNav]    = useState(false)
  const [mapSel,       setMapSel]       = useState<MapSelection | null>(null)
  const [layers,       setLayers]       = useState<LayerFlags>(DEFAULT_LAYERS)
  const [showLayers,   setShowLayers]   = useState(false)
  // track layer panel top offset based on how many ctrl buttons are shown
  const layerPanelTop = '10.5rem'

  const { rescueTeams, alerts, syncQueueCount, incidents } = useDisasterState()
  const { networkStatus } = useNetworkStatus()
  const isOffline = networkStatus === 'OFFLINE'

  const badges: Record<string, number> = {
    teams:  rescueTeams.filter(t => t.status !== 'AVAILABLE' && t.status !== 'OFFLINE').length,
    alerts: incidents.filter(i => i.status !== 'RESOLVED').length,   // open incidents count
    sync:   syncQueueCount,
  }

  const goNav = useCallback((id: NavId) => {
    setActive(id); setPanelOpen(true); setMobileNav(false)
  }, [])

  const toggleLayer = useCallback((k: LayerKey) => {
    setLayers((p: LayerFlags) => ({ ...p, [k]: !p[k] }))
  }, [])

  return (
    <div className="flex flex-col h-screen overflow-hidden"
         style={{ background:'var(--c-bg)', color:'var(--t1)' }}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="mr-header">

        {/* Brand */}
        <div className="mr-brand">
          <button className="text-white/40 hover:text-white md:hidden mr-1"
            onClick={() => setMobileNav(v => !v)} aria-label="Toggle nav">
            {mobileNav ? <X size={16}/> : <Menu size={16}/>}
          </button>
          <div className="mr-brand-icon"><Radar size={15}/></div>
          <div>
            <div className="mr-brand-name">MyRadar</div>
            <div className="mr-brand-sub">Disaster Intelligence</div>
          </div>
        </div>

        {/* Metrics */}
        <HeaderMetrics/>

        {/* Right */}
        <div className="mr-header-right">
          <LiveClock/>
          <NetBadge/>
          {isOffline && (
            <span className="hidden sm:flex items-center gap-1.5 px-2 py-1
              border border-red-400/25 bg-red-400/[0.06] tag text-red-300">
              ⚠ OFFLINE
            </span>
          )}
          <button onClick={() => goNav('ai')}
            className="flex items-center gap-1.5 px-3 py-1.5
              border border-cyan-400/25 bg-cyan-400/[0.05]
              tag text-cyan-300 hover:bg-cyan-400/10 transition-colors">
            <Bot size={11}/> AI
          </button>
          <button onClick={() => setPanelOpen(v => !v)}
            className="md:hidden text-white/40 hover:text-white"
            aria-label="Toggle panel">
            <Eye size={16}/>
          </button>
        </div>
      </header>

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden min-h-0">

        {/* Left nav */}
        <nav className={`mr-nav
          ${mobileNav
            ? 'flex absolute z-40 top-[56px] bottom-0 left-0'
            : 'hidden md:flex'
          }`}
        >
          {NAV.map((item, idx) => {
            const Icon       = item.icon
            const prevItem   = NAV[idx - 1]
            const showSec    = item.section && item.section !== prevItem?.section
            const badgeCount = item.badge ? (badges[item.badge] ?? 0) : 0
            return (
              <div key={item.id}>
                {showSec && <div className="nav-section">{item.section}</div>}
                {idx > 0 && !showSec && item.section !== prevItem?.section && (
                  <div className="nav-sep"/>
                )}
                <button
                  onClick={() => goNav(item.id)}
                  className={`nav-btn w-full ${active === item.id ? 'active' : ''}`}
                >
                  <Icon size={15} className="flex-shrink-0 opacity-70"/>
                  <span>{item.label}</span>
                  {badgeCount > 0 && (
                    <span className={`nav-badge ${
                      item.badge === 'sync' ? 'nav-badge-cyan' :
                      item.badge === 'teams' ? 'nav-badge-red' :
                      'nav-badge-red'
                    }`}>
                      {badgeCount}
                    </span>
                  )}
                </button>
              </div>
            )
          })}

          <div className="mt-auto">
            <div className="nav-sep"/>
            <button className="nav-btn w-full opacity-40 hover:opacity-70">
              <Radio size={14} className="flex-shrink-0"/><span>Radio</span>
            </button>
            <button className="nav-btn w-full opacity-40 hover:opacity-70">
              <Shield size={14} className="flex-shrink-0"/><span>Monitor</span>
            </button>
          </div>
        </nav>

        {/* ── Map ─────────────────────────────────────────────────────────── */}
        {/*
          IMPORTANT: the section must be flex-1 with overflow-hidden
          and the map-wrap inside fills 100% via CSS (.map-wrap { width:100%; height:100% })
        */}
        <section className="relative flex-1 overflow-hidden min-w-0 min-h-0">
          <DisasterMapLive onSelect={setMapSel} layers={layers}/>

          {/* Offline overlay */}
          {isOffline && (
            <>
              <div className="map-offline-bar"/>
              <div className="map-offline-badge">
                <p className="tag text-red-300 mb-0.5">⚠ AWS Offline</p>
                <p className="tag text-white/30">Local operations active</p>
              </div>
            </>
          )}

          {/* Map popup */}
          {mapSel && <MapPopup sel={mapSel} onClose={() => setMapSel(null)}/>}

          {/* Map controls */}
          <div className="map-ctrl-group">
            <button onClick={() => setShowLayers(v => !v)}
              className={`map-ctrl ${showLayers ? 'active' : ''}`}>
              <Layers3 size={11}/> Layers
            </button>
            <button onClick={() => goNav('twin')}
              className={`map-ctrl ${active === 'twin' ? 'active' : ''}`}>
              <Boxes size={11}/> Twin
            </button>
            <button onClick={() => goNav('evacuation')}
              className={`map-ctrl ${active === 'evacuation' ? 'active' : ''}`}>
              <Route size={11}/> Evac
            </button>
            <button onClick={() => goNav('waste')}
              className={`map-ctrl ${active === 'waste' ? 'active' : ''}`}>
              <Search size={11}/> Waste
            </button>
          </div>

          {/* Layer toggle panel */}
          {showLayers && (
            <div className="layer-panel" style={{ top: layerPanelTop }}>
              <p className="tag text-white/25 mb-2">Map Layers</p>
              {(Object.keys(layers) as LayerKey[]).map((k: LayerKey) => (
                <div key={String(k)} className="layer-row" onClick={() => toggleLayer(k)}>
                  <div className={`layer-box ${layers[k] ? 'on' : ''}`}>
                    {layers[k] && (
                      <span className="text-cyan-300 text-[8px] leading-none">✓</span>
                    )}
                  </div>
                  <span className={`tag ${layers[k] ? 'text-white/65' : 'text-white/25'}`}>
                    {LAYER_LABELS[k]}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Map legend */}
          <div className="map-legend">
            {[
              ['bg-red-400',    'Critical'],
              ['bg-orange-400', 'Rescue'],
              ['bg-amber-400',  'Warning'],
              ['bg-lime-400',   'Safe Route'],
              ['bg-sky-400',    'Shelter'],
              ['bg-cyan-500',   'Flood Zone'],
              ['bg-yellow-500', 'Waste'],
            ].map(([cls, lbl]) => (
              <span key={lbl} className="flex items-center tag text-white/45">
                <i className={`ldot ${cls}`}/>{lbl}
              </span>
            ))}
          </div>
        </section>

        {/* ── Right intel panel ──────────────────────────────────────────── */}
        <aside className={`intel-panel ${panelOpen ? 'open' : ''}`}>
          <div className="intel-hdr">
            <div>
              <div className="intel-hdr-sub">
                {NAV.find(n => n.id === active)?.label ?? 'Intelligence'}
              </div>
              <div className="intel-hdr-title">Operational View</div>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 tag text-white/25">
                <span className="w-1.5 h-1.5 rounded-full bg-lime-400 net-pulse inline-block"/>
                live
              </span>
              <button onClick={() => setPanelOpen(false)}
                className="text-white/25 hover:text-white/70 md:hidden">
                <X size={14}/>
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-hidden flex flex-col min-h-0">
            <PanelContent id={active} onNav={goNav}/>
          </div>
        </aside>
      </div>

      {/* ── Ticker ──────────────────────────────────────────────────────────── */}
      <footer className="mr-ticker">
        <AlertTicker/>
      </footer>
    </div>
  )
}
