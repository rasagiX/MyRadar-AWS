'use client'

import { useEffect, useState, useCallback } from 'react'
import { useDisasterState, useNetworkStatus } from '@/store/disasterStore'
import {
  RefreshCw, CloudOff, Cloud, CheckCircle,
  Clock, AlertTriangle, Server, Wifi, WifiOff, Zap,
} from 'lucide-react'
import { checkHealth, fetchSummary, type BackendSummary, type HealthResponse } from '@/services/apiClient'

// ─── Backend status poller ────────────────────────────────────────────────────
function useBackendStatus() {
  const [health,  setHealth]  = useState<HealthResponse | null>(null)
  const [summary, setSummary] = useState<BackendSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const { networkStatus } = useNetworkStatus()

  const refresh = useCallback(async () => {
    if (networkStatus === 'OFFLINE') { setHealth(null); setSummary(null); return }
    const [h, s] = await Promise.all([checkHealth(), fetchSummary()])
    setHealth(h)
    setSummary(s)
    setLoading(false)
  }, [networkStatus])

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, 4_000)
    return () => clearInterval(id)
  }, [refresh])

  return { health, summary, loading }
}

// ─── Small row ────────────────────────────────────────────────────────────────
function Row({ label, value, cls = '' }: { label: string; value: string; cls?: string }) {
  return (
    <div className="flex items-center justify-between py-1 border-b border-[var(--b-faint)] last:border-0">
      <span className="tag text-white/30">{label}</span>
      <span className={`tag font-medium ${cls || 'text-white/65'}`}>{value}</span>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export function SyncPanel() {
  const { networkStatus, syncQueueCount, lastSyncAt, failInternet, restoreInternet, isSyncing } = useNetworkStatus()
  const { syncQueue, backendConnected } = useDisasterState()
  const { health, summary, loading } = useBackendStatus()

  const isOffline       = networkStatus === 'OFFLINE'
  const backendReachable = !isOffline && health !== null

  const statusLabel = isOffline ? 'OFFLINE MODE' : isSyncing ? 'SYNCING…' : backendReachable ? 'CONNECTED' : 'LOCAL ONLY'
  const statusCls   = isOffline ? 'text-red-300' : isSyncing ? 'text-cyan-300 animate-pulse' : backendReachable ? 'text-lime-400' : 'text-amber-300'
  const StatusIcon  = isOffline ? CloudOff : isSyncing ? RefreshCw : backendReachable ? Cloud : Wifi

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="intel-hdr">
        <div>
          <div className="intel-hdr-sub">Backend Sync</div>
          <div className="intel-hdr-title">AWS Connection Status</div>
        </div>
        <div className={`flex items-center gap-1.5 tag ${statusCls}`}>
          <StatusIcon size={11} className={isSyncing ? 'animate-spin' : ''} />
          {statusLabel}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">

        {/* ── Connection card ─────────────────────────────────────────────── */}
        <div className={`m-3 border p-3 ${
          isOffline        ? 'border-red-400/20 bg-red-400/[0.03]' :
          backendReachable ? 'border-lime-400/15 bg-lime-400/[0.03]' :
                             'border-amber-400/15 bg-amber-400/[0.03]'
        }`}>
          <div className="flex items-center gap-2 mb-3">
            <StatusIcon size={16} className={`${statusCls} flex-shrink-0`} />
            <div>
              <p className={`tag font-semibold ${statusCls}`}>
                {isOffline
                  ? '⚠ MYRADAR OFFLINE MODE'
                  : isSyncing
                  ? '⟳ SYNCHRONIZING…'
                  : backendReachable
                  ? '✓ BACKEND CONNECTED'
                  : '⚡ SIMULATION ONLY'}
              </p>
              <p className="tag text-white/30 mt-0.5">
                {isOffline
                  ? 'When the network goes down, response doesn\'t.'
                  : backendReachable
                  ? `Express API · port ${process.env.NEXT_PUBLIC_BACKEND_URL?.split(':').pop() ?? '4000'}`
                  : 'Set NEXT_PUBLIC_BACKEND_URL to connect backend'}
              </p>
            </div>
          </div>

          {/* Service grid */}
          <div className="grid grid-cols-2 gap-px bg-[var(--b-faint)]">
            {[
              ['Express API',   backendReachable ? 'ONLINE'  : 'OFFLINE', backendReachable ? 'sb-ok' : 'sb-crit'],
              ['WebSocket',     backendConnected  ? 'LIVE'   : 'POLLING', backendConnected  ? 'sb-ok' : 'sb-warn'],
              ['AWS DynamoDB',  'DEMO MODE',  'sb-warn'],
              ['AWS Bedrock',   'DEMO MODE',  'sb-warn'],
              ['Local DB',      'ACTIVE',     'sb-ok'],
              ['Local AI',      'ACTIVE',     'sb-ok'],
              ['Sync Queue',    `${syncQueueCount} EVENTS`, syncQueueCount > 0 ? 'sb-warn' : 'sb-ok'],
              ['Local Routing', 'ACTIVE',     'sb-ok'],
            ].map(([lbl, val, cls]) => (
              <div key={lbl} className="bg-[var(--c-card)] px-2.5 py-2">
                <p className="tag text-white/25 mb-1">{lbl}</p>
                <span className={`sbadge ${cls}`}>{val}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Backend health ──────────────────────────────────────────────── */}
        {backendReachable && health && (
          <div className="mx-3 mb-3 border border-[var(--b-subtle)] p-3">
            <div className="flex items-center gap-2 mb-2">
              <Server size={11} className="text-cyan-400" />
              <span className="tag text-cyan-300/70">Backend Health</span>
            </div>
            <Row label="Service"    value={health.service} />
            <Row label="Uptime"     value={`${health.uptime}s`} cls="text-lime-400" />
            <Row label="WS Clients" value={String(health.wsClients)} cls="text-cyan-300" />
            <Row label="Timestamp"  value={new Date(health.timestamp).toLocaleTimeString()} />
          </div>
        )}

        {/* ── Live server summary ─────────────────────────────────────────── */}
        {backendReachable && summary && (
          <div className="mx-3 mb-3 border border-[var(--b-subtle)] p-3">
            <div className="flex items-center gap-2 mb-2">
              <Zap size={11} className="text-amber-400" />
              <span className="tag text-amber-300/70">Server State</span>
            </div>
            <Row label="Severity"     value={summary.severity}                                       cls={summary.severity === 'CRITICAL' ? 'text-red-300' : 'text-amber-300'} />
            <Row label="Flood Risk"   value={`${summary.floodRisk}%`}                                cls={summary.floodRisk > 70 ? 'text-red-300' : 'text-amber-300'} />
            <Row label="Water Level"  value={`${summary.averageWaterLevel.toFixed(2)} m`}            cls="text-cyan-300" />
            <Row label="Affected"     value={summary.affectedPeople.toLocaleString()}                />
            <Row label="Incidents"    value={String(summary.activeIncidents)}                        cls={summary.activeIncidents > 3 ? 'text-red-300' : 'text-white/65'} />
            <Row label="Active Teams" value={String(summary.activeTeams)}                            cls="text-orange-300" />
            <Row label="Last Updated" value={new Date(summary.lastUpdated).toLocaleTimeString()}     />
          </div>
        )}

        {/* ── Sync queue ──────────────────────────────────────────────────── */}
        {syncQueue.length > 0 && (
          <div className="mx-3 mb-3 border border-amber-400/15 bg-amber-400/[0.03] p-3">
            <div className="flex items-center gap-2 mb-2">
              <Clock size={11} className="text-amber-400" />
              <span className="tag text-amber-300">Pending Sync — {syncQueue.length} events</span>
            </div>
            <div className="flex flex-col gap-px max-h-40 overflow-y-auto">
              {syncQueue.map(item => (
                <div key={item.id} className="flex items-center justify-between py-1 border-b border-[var(--b-faint)] last:border-0">
                  <span className="tag text-white/50">{item.eventType}</span>
                  <span className="tag text-white/25">{item.timestamp.slice(11, 19)}</span>
                </div>
              ))}
            </div>
            {!isOffline && (
              <div className="mt-2 flex items-center gap-1.5 tag text-lime-400">
                <CheckCircle size={9} /> Will sync automatically on restore
              </div>
            )}
          </div>
        )}

        {/* ── Controls ────────────────────────────────────────────────────── */}
        <div className="mx-3 mb-3 flex flex-col gap-2">
          {isOffline ? (
            <button onClick={restoreInternet}
              className="sim-btn border border-lime-400/20 text-lime-400 justify-center w-full">
              <Wifi size={10} /> Restore AWS Connection
            </button>
          ) : (
            <button onClick={failInternet}
              className="sim-btn border border-red-400/20 text-red-300 justify-center w-full">
              <WifiOff size={10} /> Simulate Network Failure
            </button>
          )}

          {/* Architecture diagram */}
          <div className="border border-[var(--b-subtle)] p-3 mt-1">
            <p className="tag text-cyan-300/60 mb-2">Sync Architecture</p>
            {[
              ['MyRadar Frontend',  'React + Local Simulation'],
              ['WebSocket',         'ws://localhost:4000/ws'],
              ['HTTP Polling',      '/api/* every 5 s'],
              ['Express Backend',   'Port 4000'],
              ['AWS DynamoDB',      'Operational data'],
              ['AWS IoT Core',      'Sensor telemetry'],
              ['AWS Bedrock',       'AI assistant'],
            ].map(([svc, desc]) => (
              <div key={svc} className="flex items-center gap-2 py-0.5">
                <span className="tag text-white/45 w-36 flex-shrink-0">{svc}</span>
                <span className="tag text-white/20">→</span>
                <span className="tag text-white/30">{desc}</span>
              </div>
            ))}
          </div>

          {/* Conflict resolution note */}
          <div className="border border-[var(--b-subtle)] p-2.5">
            <div className="flex items-center gap-1.5 tag text-white/25 mb-1">
              <AlertTriangle size={9} /> Conflict Resolution
            </div>
            <p className="tag text-white/20 leading-relaxed">
              Offline events use timestamp + deviceId + version for
              last-write-wins resolution on reconnect.
            </p>
          </div>

          <p className="tag text-white/20 text-center">
            Last sync: {lastSyncAt ? new Date(lastSyncAt).toLocaleTimeString() : 'never'}
          </p>
        </div>
      </div>
    </div>
  )
}
