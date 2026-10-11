'use client'

/**
 * IoTPanel — shows real-time IoT Core + SNS integration status.
 *
 * - Live sensor readings being published to MQTT
 * - SNS alert log with manual send button
 * - Setup instructions when not yet configured
 */

import { useState, useEffect, useCallback } from 'react'
import {
  Wifi, Bell, Activity, CheckCircle, AlertTriangle,
  Send, RefreshCw, Radio, Zap,
} from 'lucide-react'
import { useDisasterState, useNetworkStatus } from '@/store/disasterStore'

// ── Types ─────────────────────────────────────────────────────────
interface IoTStatus {
  configured: boolean
  endpoint:   string
  topicPrefix:string
}
interface SNSStatus {
  configured:    boolean
  SNS_TOPIC_ARN: string
}
interface SentAlert { time: string; title: string; severity: string; ok: boolean }

// ── Health hooks ──────────────────────────────────────────────────
function useIoTStatus() {
  const [status, setStatus] = useState<IoTStatus | null>(null)
  const refresh = useCallback(async () => {
    try {
      const r = await fetch('/api/myradar/iot/publish')
      const d = await r.json() as IoTStatus
      setStatus(d)
    } catch { /* ignore */ }
  }, [])
  useEffect(() => { refresh(); const id = setInterval(refresh, 15_000); return () => clearInterval(id) }, [refresh])
  return status
}

function useSNSStatus() {
  const [status, setStatus] = useState<SNSStatus | null>(null)
  const refresh = useCallback(async () => {
    try {
      const r = await fetch('/api/myradar/alerts/notify')
      const d = await r.json() as SNSStatus
      setStatus(d)
    } catch { /* ignore */ }
  }, [])
  useEffect(() => { refresh() }, [refresh])
  return status
}

// ── Row helper ────────────────────────────────────────────────────
function Row({ label, value, cls = 'text-white/60' }: { label: string; value: string; cls?: string }) {
  return (
    <div className="flex items-center justify-between py-1 border-b border-[var(--b-faint)] last:border-0">
      <span className="tag text-white/30">{label}</span>
      <span className={`tag font-medium ${cls}`}>{value}</span>
    </div>
  )
}

// ── Setup card ────────────────────────────────────────────────────
function SetupCard({ title, steps }: { title: string; steps: string[] }) {
  return (
    <div className="border border-amber-400/15 bg-amber-400/[0.03] p-3 rounded-sm">
      <p className="tag text-amber-300 mb-2">{title}</p>
      <ol className="flex flex-col gap-1.5">
        {steps.map((step, i) => (
          <li key={i} className="flex gap-2">
            <span className="tag text-amber-300/60 shrink-0">{i + 1}.</span>
            <span className="tag text-white/40 leading-relaxed">{step}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

// ── Main panel ────────────────────────────────────────────────────
export function IoTPanel() {
  const { sensors, averageWaterLevel, floodRisk, severity } = useDisasterState()
  const { isOffline } = useNetworkStatus()
  const iotStatus = useIoTStatus()
  const snsStatus = useSNSStatus()

  const [sentAlerts,   setSentAlerts]   = useState<SentAlert[]>([])
  const [sending,      setSending]      = useState(false)
  const [publishing,   setPublishing]   = useState(false)
  const [lastPublished,setLastPublished]= useState<string | null>(null)

  const waterSensors = sensors.filter(s => s.type === 'WATER_LEVEL')
  const criticalSensors = waterSensors.filter(s => s.reading > 3.5)

  // Manual SNS test send
  async function sendTestAlert() {
    setSending(true)
    try {
      const res = await fetch('/api/myradar/alerts/notify', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          severity:   floodRisk > 75 ? 'CRITICAL' : 'WARNING',
          title:      `MyRadar Test Alert — ${severity} conditions`,
          message:    `National flood risk is ${floodRisk}%. Average water level: ${averageWaterLevel.toFixed(2)}m. This is a test notification from MyRadar.`,
          waterLevel: averageWaterLevel,
          location:   'India — National Operations',
        }),
      })
      const d = await res.json() as { ok: boolean }
      setSentAlerts(prev => [{
        time:     new Date().toLocaleTimeString('en-IN', { hour12: true }),
        title:    `Test Alert — ${severity}`,
        severity: floodRisk > 75 ? 'CRITICAL' : 'WARNING',
        ok:       d.ok,
      }, ...prev.slice(0, 9)])
    } catch {
      setSentAlerts(prev => [{ time: new Date().toLocaleTimeString(), title: 'Test Alert', severity: 'ERROR', ok: false }, ...prev.slice(0, 9)])
    } finally {
      setSending(false)
    }
  }

  // Manual IoT publish
  async function publishNow() {
    setPublishing(true)
    try {
      const res = await fetch('/api/myradar/iot/publish', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ sensors: waterSensors }),
      })
      const d = await res.json() as { ok: boolean; published: number; source: string }
      setLastPublished(
        d.ok
          ? `✓ ${d.published} sensors → ${d.source === 'aws' ? 'IoT Core (MQTT)' : 'demo mode'}`
          : '✗ Publish failed',
      )
    } catch {
      setLastPublished('✗ Network error')
    } finally {
      setPublishing(false)
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--b-subtle)] shrink-0">
        <div className="flex items-center gap-2">
          <Radio size={14} className="text-cyan-400" />
          <span className="tag-sm text-white/70 font-semibold">IoT + SNS</span>
        </div>
        <div className={`tag flex items-center gap-1.5 ${isOffline ? 'text-red-300' : 'text-lime-300'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${isOffline ? 'bg-red-400' : 'bg-lime-400'}`} />
          {isOffline ? 'OFFLINE' : 'CONNECTED'}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">

        {/* ── IoT Core Section ─────────────────────────────────────── */}
        <div className="border border-[var(--b-subtle)] p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Zap size={13} className="text-cyan-400" />
              <span className="tag text-cyan-300/80 font-semibold">AWS IoT Core</span>
            </div>
            <span className={`tag border px-1.5 py-0.5 ${iotStatus?.configured ? 'border-lime-400/25 text-lime-300' : 'border-amber-400/25 text-amber-300'}`}>
              {iotStatus ? (iotStatus.configured ? 'ACTIVE' : 'NOT CONFIGURED') : '…'}
            </span>
          </div>

          {iotStatus && (
            <div className="flex flex-col gap-0.5 mb-3">
              <Row label="Endpoint"     value={iotStatus.endpoint}    cls={iotStatus.configured ? 'text-white/60' : 'text-white/30'} />
              <Row label="Topic prefix" value={iotStatus.topicPrefix} />
              <Row label="Sensors"      value={`${waterSensors.length} water-level sensors`} />
              <Row label="Publish rate" value="Every 10 seconds" cls="text-cyan-300" />
            </div>
          )}

          {/* Live sensor readings */}
          <p className="tag text-white/25 mb-1.5">Live sensor → MQTT</p>
          <div className="flex flex-col gap-1 mb-3">
            {waterSensors.slice(0, 5).map(s => (
              <div key={s.id} className="flex items-center justify-between py-0.5">
                <span className="tag text-white/50">{s.name}</span>
                <div className="flex items-center gap-2">
                  <span className="tag text-white/30">myradar/sensors/{s.id}</span>
                  <span className={`tag font-bold tabular-nums ${s.reading > 3.5 ? 'text-red-300' : s.reading > 2 ? 'text-amber-300' : 'text-cyan-300'}`}>
                    {s.reading.toFixed(2)}m
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Publish button */}
          <div className="flex items-center gap-2">
            <button
              onClick={publishNow}
              disabled={publishing || isOffline}
              className={`flex items-center gap-1.5 px-3 py-1.5 border tag transition-colors ${
                publishing || isOffline
                  ? 'border-white/8 text-white/20 cursor-not-allowed'
                  : 'border-cyan-400/25 text-cyan-300 hover:bg-cyan-400/[0.06]'
              }`}
            >
              <RefreshCw size={9} className={publishing ? 'animate-spin' : ''} />
              {publishing ? 'Publishing…' : 'Publish Now'}
            </button>
            {lastPublished && (
              <span className={`tag ${lastPublished.startsWith('✓') ? 'text-lime-300' : 'text-red-300'}`}>
                {lastPublished}
              </span>
            )}
          </div>

          {/* Setup instructions if not configured */}
          {iotStatus && !iotStatus.configured && (
            <div className="mt-3">
              <SetupCard
                title="Configure IoT Core"
                steps={[
                  'AWS Console → IoT Core → Settings → copy the endpoint hostname',
                  'Paste into AWS_IOT_ENDPOINT in frontend/.env.local (no https://)',
                  'IAM → your user → Attach → AWSIoTDataAccess policy',
                  'Restart dev server — sensors will publish to MQTT every 10s',
                ]}
              />
            </div>
          )}
        </div>

        {/* ── SNS Section ──────────────────────────────────────────── */}
        <div className="border border-[var(--b-subtle)] p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Bell size={13} className="text-orange-400" />
              <span className="tag text-orange-300/80 font-semibold">Amazon SNS Alerts</span>
            </div>
            <span className={`tag border px-1.5 py-0.5 ${snsStatus?.configured ? 'border-lime-400/25 text-lime-300' : 'border-amber-400/25 text-amber-300'}`}>
              {snsStatus ? (snsStatus.configured ? 'ACTIVE' : 'NOT CONFIGURED') : '…'}
            </span>
          </div>

          {snsStatus && (
            <div className="flex flex-col gap-0.5 mb-3">
              <Row label="Topic ARN" value={snsStatus.SNS_TOPIC_ARN} cls={snsStatus.configured ? 'text-white/60' : 'text-white/30'} />
              <Row label="Auto-alerts" value="Sensor > 3.5m or shelter CRITICAL" cls="text-orange-300" />
              <Row label="Debounce" value="5 minutes per alert" />
            </div>
          )}

          {/* Critical sensors warning */}
          {criticalSensors.length > 0 && (
            <div className="flex items-start gap-2 border border-red-400/20 bg-red-400/[0.04] px-2.5 py-2 mb-3">
              <AlertTriangle size={11} className="text-red-300 shrink-0 mt-0.5" />
              <p className="tag text-red-300 leading-relaxed">
                {criticalSensors.length} sensor{criticalSensors.length > 1 ? 's' : ''} above 3.5m — SNS alert will auto-fire
              </p>
            </div>
          )}

          {/* Manual send button */}
          <div className="flex items-center gap-2 mb-3">
            <button
              onClick={sendTestAlert}
              disabled={sending || isOffline}
              className={`flex items-center gap-1.5 px-3 py-1.5 border tag transition-colors ${
                sending || isOffline
                  ? 'border-white/8 text-white/20 cursor-not-allowed'
                  : 'border-orange-400/25 text-orange-300 hover:bg-orange-400/[0.06]'
              }`}
            >
              <Send size={9} />
              {sending ? 'Sending…' : 'Send Test Alert'}
            </button>
          </div>

          {/* Alert log */}
          {sentAlerts.length > 0 && (
            <div>
              <p className="tag text-white/25 mb-1.5">Alert Log</p>
              <div className="flex flex-col gap-1">
                {sentAlerts.map((a, i) => (
                  <div key={i} className="flex items-center justify-between py-0.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {a.ok
                        ? <CheckCircle size={9} className="text-lime-400 shrink-0" />
                        : <AlertTriangle size={9} className="text-red-400 shrink-0" />
                      }
                      <span className="tag text-white/55 truncate">{a.title}</span>
                    </div>
                    <span className="tag text-white/25 ml-2 shrink-0">{a.time}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Setup instructions if not configured */}
          {snsStatus && !snsStatus.configured && (
            <div className="mt-2">
              <SetupCard
                title="Configure SNS Alerts"
                steps={[
                  'AWS Console → SNS → Topics → Create topic → Standard',
                  'Name: myradar-flood-alerts → Create → copy the Topic ARN',
                  'Paste into SNS_TOPIC_ARN in frontend/.env.local',
                  'Subscribe phone: Topics → myradar-flood-alerts → Create subscription → SMS → +91xxxxxxxxxx',
                  'Subscribe email: Protocol: Email → your@email.com → confirm the link in the email',
                  'Restart dev server — alerts fire automatically on CRITICAL conditions',
                ]}
              />
            </div>
          )}
        </div>

        {/* ── Architecture note ─────────────────────────────────────── */}
        <div className="border border-[var(--b-faint)] p-3">
          <p className="tag text-white/25 mb-2">Data Flow</p>
          {[
            ['Simulation tick (1s)',       '→ sensor readings update'],
            ['IoT publish (10s)',           '→ MQTT myradar/sensors/+'],
            ['IoT Core Rule',              '→ DynamoDB (SENSOR# records)'],
            ['Sensor > 3.5m',             '→ SNS publish → SMS + Email'],
            ['Shelter CRITICAL',          '→ SNS publish → SMS + Email'],
            ['Manual "Send Test Alert"',  '→ SNS publish immediately'],
          ].map(([src, dst]) => (
            <div key={src} className="flex items-start gap-2 py-0.5">
              <span className="tag text-white/40 w-44 shrink-0">{src}</span>
              <span className="tag text-white/20">{dst}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
