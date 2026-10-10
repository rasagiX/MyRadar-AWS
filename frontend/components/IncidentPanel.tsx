'use client'

/**
 * IncidentPanel — Operator incident management
 *
 * Features:
 *   • Form to create a new incident (type, severity, city, description, team assignment)
 *   • Live incident list with status, severity, assigned team
 *   • Resolve / reassign buttons
 *   • Every new incident queues itself to DynamoDB via the sync pipeline
 */

import { useState, useCallback } from 'react'
import {
  Siren, Plus, CheckCircle, Clock, AlertTriangle,
  MapPin, User, FileText, ChevronDown, X, Wifi,
} from 'lucide-react'
import { useDisasterState, useDisasterDispatch, useNetworkStatus } from '@/store/disasterStore'
import type { Incident } from '@/types/disaster'
const INCIDENT_TYPES: Incident['type'][] = [
  'RESCUE_NEEDED', 'FLOOD', 'ROAD_BLOCKED', 'SHELTER_FULL',
  'SUPPLY_SHORTAGE', 'SENSOR_FAILURE', 'DEBRIS',
]
const TYPE_LABELS: Record<Incident['type'], string> = {
  RESCUE_NEEDED:    'Rescue Needed',
  FLOOD:            'Flood',
  ROAD_BLOCKED:     'Road Blocked',
  SHELTER_FULL:     'Shelter Full',
  SUPPLY_SHORTAGE:  'Supply Shortage',
  SENSOR_FAILURE:   'Sensor Failure',
  DEBRIS:           'Debris / Hazard',
}
const SEV_COLORS: Record<string, string> = {
  NORMAL:   'text-lime-300   border-lime-400/25   bg-lime-400/[0.06]',
  ELEVATED: 'text-yellow-300 border-yellow-400/25 bg-yellow-400/[0.06]',
  HIGH:     'text-amber-300  border-amber-400/25  bg-amber-400/[0.06]',
  CRITICAL: 'text-red-300    border-red-400/25    bg-red-400/[0.06]',
}
const STATUS_COLORS: Record<Incident['status'], string> = {
  OPEN:     'text-red-300    bg-red-400/[0.08]    border-red-400/25',
  ASSIGNED: 'text-amber-300  bg-amber-400/[0.08]  border-amber-400/25',
  RESOLVED: 'text-lime-300   bg-lime-400/[0.08]   border-lime-400/25',
}

const INDIA_CITIES = [
  'Mumbai', 'Patna', 'Guwahati', 'Kolkata', 'Chennai',
  'Bhubaneswar', 'Hyderabad', 'Delhi', 'Varanasi', 'Other',
]

// Coordinates for each city (used to auto-fill location)
const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  Mumbai:       { lat: 19.076,  lng: 72.877 },
  Patna:        { lat: 25.594,  lng: 85.137 },
  Guwahati:     { lat: 26.144,  lng: 91.736 },
  Kolkata:      { lat: 22.572,  lng: 88.363 },
  Chennai:      { lat: 13.052,  lng: 80.250 },
  Bhubaneswar:  { lat: 20.296,  lng: 85.824 },
  Hyderabad:    { lat: 17.385,  lng: 78.486 },
  Delhi:        { lat: 28.613,  lng: 77.209 },
  Varanasi:     { lat: 25.320,  lng: 83.005 },
  Other:        { lat: 20.593,  lng: 78.962 },
}

let _incSeq = 100   // local counter so manually created IDs don't clash with simulation

// ── Add-incident form ─────────────────────────────────────────────────────────
function AddIncidentForm({ onClose }: { onClose: () => void }) {
  const dispatch      = useDisasterDispatch()
  const { isOffline } = useNetworkStatus()
  const { rescueTeams } = useDisasterState()

  const [type,        setType]        = useState<Incident['type']>('RESCUE_NEEDED')
  const [severity,    setSeverity]    = useState<'NORMAL'|'ELEVATED'|'HIGH'|'CRITICAL'>('HIGH')
  const [city,        setCity]        = useState('Mumbai')
  const [description, setDescription] = useState('')
  const [assignedTeam,setAssignedTeam]= useState('')
  const [submitting,  setSubmitting]  = useState(false)
  const [done,        setDone]        = useState(false)

  const availableTeams = rescueTeams.filter(t => t.status === 'AVAILABLE')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!description.trim()) return
    setSubmitting(true)

    _incSeq++
    const coords     = CITY_COORDS[city] ?? CITY_COORDS['Other']
    const incidentId = `INC-MANUAL-${Date.now()}-${_incSeq}`
    const reportedAt = new Date().toLocaleTimeString('en-GB', { hour12: false })

    const incident: Incident = {
      id:           incidentId,
      type,
      severity,
      location:     { lat: coords.lat + (Math.random() - 0.5) * 0.005, lng: coords.lng + (Math.random() - 0.5) * 0.005 },
      description:  description.trim(),
      reportedAt,
      assignedTeam: assignedTeam || undefined,
      status:       assignedTeam ? 'ASSIGNED' : 'OPEN',
    }

    // 1. Add to local state (also fires alert)
    dispatch({ type: 'CREATE_CUSTOM_INCIDENT', payload: incident })

    // 2. Queue for DynamoDB sync (works offline + online)
    dispatch({
      type: 'QUEUE_OFFLINE_EVENT',
      payload: {
        eventType: 'NEW_INCIDENT',
        data: {
          incidentId,
          type,
          severity,
          description:  description.trim(),
          location:     coords,
          reportedAt,
          status:       incident.status,
          assignedTeam: assignedTeam || null,
          city,
          deviceId:     'MYRADAR-LOCAL-01',
        },
      },
    })

    // 3. If already online, trigger sync immediately
    if (!isOffline) {
      await new Promise(r => setTimeout(r, 200))
      dispatch({ type: 'RESTORE_INTERNET' })
    }

    setSubmitting(false)
    setDone(true)
    setTimeout(onClose, 1200)
  }

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 p-8">
        <CheckCircle size={28} className="text-lime-400" />
        <p className="font-mono text-[10px] uppercase tracking-wider text-lime-300">Incident created</p>
        <p className="font-mono text-[8px] text-white/30">
          {isOffline ? 'Queued for sync when online' : 'Syncing to DynamoDB…'}
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 p-4">

      {/* Offline indicator */}
      {isOffline && (
        <div className="flex items-center gap-2 border border-amber-400/25 bg-amber-400/[0.05] px-3 py-2">
          <Wifi size={10} className="text-amber-300 shrink-0" />
          <p className="font-mono text-[8px] text-amber-300">
            Offline — incident will sync to DynamoDB when connection is restored
          </p>
        </div>
      )}

      {/* Type */}
      <div>
        <label className="font-mono text-[8px] uppercase tracking-wider text-white/30 mb-1.5 block">
          Incident Type *
        </label>
        <div className="relative">
          <select
            value={type}
            onChange={e => setType(e.target.value as Incident['type'])}
            className="w-full bg-[#0a1525] border border-white/12 px-3 py-2.5 font-mono text-[10px] text-white/80 focus:outline-none focus:border-cyan-400/40 appearance-none cursor-pointer"
          >
            {INCIDENT_TYPES.map(t => (
              <option key={t} value={t}>{TYPE_LABELS[t]}</option>
            ))}
          </select>
          <ChevronDown size={11} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
        </div>
      </div>

      {/* Severity */}
      <div>
        <label className="font-mono text-[8px] uppercase tracking-wider text-white/30 mb-1.5 block">
          Severity *
        </label>
        <div className="grid grid-cols-4 gap-1">
          {(['NORMAL','ELEVATED','HIGH','CRITICAL'] as const).map(s => (
            <button
              key={s}
              type="button"
              onClick={() => setSeverity(s)}
              className={`py-2 border font-mono text-[8px] uppercase tracking-wider transition-colors ${
                severity === s ? SEV_COLORS[s] : 'border-white/10 text-white/30 hover:text-white/55'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* City */}
      <div>
        <label className="font-mono text-[8px] uppercase tracking-wider text-white/30 mb-1.5 block">
          Location (City) *
        </label>
        <div className="relative">
          <select
            value={city}
            onChange={e => setCity(e.target.value)}
            className="w-full bg-[#0a1525] border border-white/12 px-3 py-2.5 font-mono text-[10px] text-white/80 focus:outline-none focus:border-cyan-400/40 appearance-none cursor-pointer"
          >
            {INDIA_CITIES.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <ChevronDown size={11} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="font-mono text-[8px] uppercase tracking-wider text-white/30 mb-1.5 block">
          Description *
        </label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Describe the incident clearly — location, scale, immediate risks…"
          rows={3}
          className="w-full bg-[#0a1525] border border-white/12 px-3 py-2.5 font-mono text-[10px] text-white/80 placeholder:text-white/20 focus:outline-none focus:border-cyan-400/40 resize-none"
          required
        />
      </div>

      {/* Assign team */}
      <div>
        <label className="font-mono text-[8px] uppercase tracking-wider text-white/30 mb-1.5 block">
          Assign Rescue Team (optional)
        </label>
        <div className="relative">
          <select
            value={assignedTeam}
            onChange={e => setAssignedTeam(e.target.value)}
            className="w-full bg-[#0a1525] border border-white/12 px-3 py-2.5 font-mono text-[10px] text-white/80 focus:outline-none focus:border-cyan-400/40 appearance-none cursor-pointer"
          >
            <option value="">— Unassigned —</option>
            {availableTeams.map(t => (
              <option key={t.id} value={t.id}>
                {t.id} — {t.name} ({t.sector})
              </option>
            ))}
          </select>
          <ChevronDown size={11} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
        </div>
        {availableTeams.length === 0 && (
          <p className="font-mono text-[8px] text-amber-300/60 mt-1">
            No teams currently available — all deployed
          </p>
        )}
      </div>

      {/* Submit */}
      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={!description.trim() || submitting}
          className={`flex-1 flex items-center justify-center gap-2 py-3 border font-mono text-[9px] uppercase tracking-wider transition-colors ${
            description.trim() && !submitting
              ? 'border-red-400/40 bg-red-400/[0.08] text-red-300 hover:bg-red-400/14'
              : 'border-white/8 text-white/20 cursor-not-allowed'
          }`}
        >
          {submitting
            ? <><Clock size={11} className="animate-spin" /> Creating…</>
            : <><Plus size={11} /> Create Incident</>
          }
        </button>
        <button
          type="button"
          onClick={onClose}
          className="px-4 border border-white/10 font-mono text-[9px] text-white/30 hover:text-white/60 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

// ── Incident row ──────────────────────────────────────────────────────────────
function IncidentRow({ incident }: { incident: Incident }) {
  const dispatch = useDisasterDispatch()

  function resolve() {
    // Mark resolved in local state (a real app would also PATCH the backend)
    dispatch({
      type: 'QUEUE_OFFLINE_EVENT',
      payload: {
        eventType: 'INCIDENT_RESOLVED',
        data: { incidentId: incident.id, resolvedAt: new Date().toISOString() },
      },
    })
  }

  return (
    <div className={`flex flex-col gap-1.5 p-3 border-l-2 border-b border-[var(--b-faint)] ${
      incident.severity === 'CRITICAL' ? 'border-l-red-400' :
      incident.severity === 'HIGH'     ? 'border-l-amber-400' :
      'border-l-yellow-400'
    } ${incident.status === 'RESOLVED' ? 'opacity-40' : ''}`}>

      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`font-mono text-[8px] uppercase border px-1.5 py-0.5 ${SEV_COLORS[incident.severity]}`}>
              {incident.severity}
            </span>
            <span className="font-mono text-[8px] text-white/40">
              {TYPE_LABELS[incident.type] ?? incident.type}
            </span>
            <span className={`font-mono text-[7px] uppercase border px-1.5 py-0.5 ${STATUS_COLORS[incident.status]}`}>
              {incident.status}
            </span>
          </div>
          <p className="mt-1 text-[10px] text-white/75 leading-relaxed">{incident.description}</p>
        </div>
        {incident.status !== 'RESOLVED' && (
          <button
            onClick={resolve}
            title="Mark resolved"
            className="shrink-0 text-white/20 hover:text-lime-300 transition-colors mt-0.5"
          >
            <CheckCircle size={13} />
          </button>
        )}
      </div>

      {/* Meta */}
      <div className="flex items-center gap-3 font-mono text-[8px] text-white/30">
        <span className="flex items-center gap-1">
          <Clock size={9} /> {incident.reportedAt}
        </span>
        {incident.assignedTeam && (
          <span className="flex items-center gap-1 text-orange-300/70">
            <User size={9} /> {incident.assignedTeam}
          </span>
        )}
        <span className="flex items-center gap-1">
          <MapPin size={9} /> {incident.location.lat.toFixed(3)}, {incident.location.lng.toFixed(3)}
        </span>
      </div>
    </div>
  )
}

// ── Main panel ────────────────────────────────────────────────────────────────
export function IncidentPanel() {
  const { incidents, syncQueueCount } = useDisasterState()
  const { isOffline } = useNetworkStatus()
  const [showForm, setShowForm] = useState(false)
  const [filter, setFilter]     = useState<Incident['status'] | 'ALL'>('ALL')

  const open     = incidents.filter(i => i.status === 'OPEN').length
  const assigned = incidents.filter(i => i.status === 'ASSIGNED').length
  const resolved = incidents.filter(i => i.status === 'RESOLVED').length

  const filtered = filter === 'ALL'
    ? incidents
    : incidents.filter(i => i.status === filter)

  // Sort: CRITICAL first, then by reportedAt descending
  const sorted = [...filtered].sort((a, b) => {
    const sevOrder = { CRITICAL: 0, HIGH: 1, ELEVATED: 2, NORMAL: 3 }
    const sDiff = (sevOrder[a.severity] ?? 3) - (sevOrder[b.severity] ?? 3)
    if (sDiff !== 0) return sDiff
    return b.reportedAt.localeCompare(a.reportedAt)
  })

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--b-subtle)] shrink-0">
        <div className="flex items-center gap-2">
          <Siren size={14} className="text-red-400" />
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/70 font-semibold">
            Incidents
          </span>
          {syncQueueCount > 0 && (
            <span className="font-mono text-[7px] border border-amber-400/25 bg-amber-400/[0.06] text-amber-300 px-1.5 py-0.5">
              {syncQueueCount} pending sync
            </span>
          )}
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className={`flex items-center gap-1.5 px-3 py-1.5 border font-mono text-[9px] uppercase tracking-wider transition-colors ${
            showForm
              ? 'border-white/20 text-white/50'
              : 'border-red-400/35 bg-red-400/[0.07] text-red-300 hover:bg-red-400/12'
          }`}
        >
          {showForm ? <><X size={10} /> Cancel</> : <><Plus size={10} /> Add Incident</>}
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="border-b border-[var(--b-subtle)] shrink-0 overflow-y-auto max-h-[60%]">
          <div className="px-4 py-2 bg-red-400/[0.03] border-b border-red-400/10">
            <div className="flex items-center gap-2">
              <AlertTriangle size={10} className="text-red-300" />
              <span className="font-mono text-[9px] uppercase tracking-wider text-red-300 font-semibold">
                New Incident Report
              </span>
              {isOffline && (
                <span className="font-mono text-[7px] text-amber-300/70 ml-auto">
                  Will queue offline
                </span>
              )}
            </div>
          </div>
          <AddIncidentForm onClose={() => setShowForm(false)} />
        </div>
      )}

      {/* Stats strip */}
      <div className="flex border-b border-[var(--b-faint)] shrink-0">
        {([
          ['ALL',      incidents.length,  'text-white/50'],
          ['OPEN',     open,              'text-red-300'],
          ['ASSIGNED', assigned,          'text-amber-300'],
          ['RESOLVED', resolved,          'text-lime-300'],
        ] as const).map(([s, count, cls]) => (
          <button
            key={s}
            onClick={() => setFilter(s as typeof filter)}
            className={`flex-1 py-2 font-mono text-[8px] uppercase tracking-wider transition-colors border-b-2 ${
              filter === s
                ? `border-current ${cls}`
                : 'border-transparent text-white/25 hover:text-white/50'
            }`}
          >
            {s} <span className="ml-0.5 opacity-70">{count}</span>
          </button>
        ))}
      </div>

      {/* Incident list */}
      <div className="flex-1 overflow-y-auto">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
            <FileText size={22} className="text-white/15" />
            <p className="font-mono text-[9px] uppercase tracking-wider text-white/20">
              {filter === 'ALL' ? 'No incidents recorded' : `No ${filter.toLowerCase()} incidents`}
            </p>
            {filter === 'ALL' && (
              <button
                onClick={() => setShowForm(true)}
                className="flex items-center gap-1.5 border border-red-400/25 bg-red-400/[0.05] px-3 py-1.5 font-mono text-[8px] uppercase tracking-wider text-red-300 hover:bg-red-400/10 transition-colors"
              >
                <Plus size={9} /> Add First Incident
              </button>
            )}
          </div>
        ) : (
          sorted.map(incident => (
            <IncidentRow key={incident.id} incident={incident} />
          ))
        )}
      </div>
    </div>
  )
}
