'use client'

/**
 * MyRadar Global Disaster Store — offline-first edition
 *
 * Data flow:
 *   IDB ──hydrate──▶  store  ◀──MERGE_BACKEND──  backend poll/WS
 *                      │
 *                   simulation tick
 *                      │
 *                   persist to IDB every 5 s
 *
 * Offline-first guarantees:
 *   • On mount: restore from IndexedDB if network is unavailable
 *   • On incident creation: write to IDB + IDB syncQueue immediately
 *   • On network restore (SYNCING): drain IDB syncQueue to backend
 *   • On reset: wipe IDB cache
 */

import React, {
  createContext, useContext, useReducer,
  useEffect, useRef, useCallback,
} from 'react'
import type { DisasterState, Sensor, Shelter, RescueTeam, Alert } from '@/types/disaster'
import { createInitialState } from '@/lib/mockData'
import {
  simulationTick,
  applySimulateFlood, applyRaiseWaterLevel, applyBlockRoad,
  applyCreateRescueIncident, applyFillShelter, applyDetectDebris,
  applyFailInternet, applyRestoreInternet, applyCompleteSyncInternet,
  applyResetScenario, applyQueueOfflineEvent,
  applySetWaterLevel, applySetRoadStatus,
} from '@/lib/simulation'
import {
  connectLiveSocket, fetchSummary, fetchSensors,
  fetchShelters, fetchTeams, fetchAlerts, flushSyncQueue,
  type BackendSummary, type WsPushMessage,
} from '@/services/apiClient'
import {
  persistState, clearCache, restoreState,
} from '@/services/local/cache'
import { getAllQueued, clearQueue } from '@/services/local/syncQueue'

// ─── Actions ──────────────────────────────────────────────────────────────────
export type DisasterAction =
  | { type: 'TICK' }
  | { type: 'SET_SIMULATION_RUNNING'; payload: boolean }
  | { type: 'SET_SIMULATION_SPEED';   payload: number }
  | { type: 'SIMULATE_FLOOD' }
  | { type: 'RAISE_WATER_LEVEL' }
  | { type: 'BLOCK_ROAD' }
  | { type: 'CREATE_RESCUE_INCIDENT' }
  | { type: 'FILL_SHELTER' }
  | { type: 'DETECT_DEBRIS' }
  | { type: 'FAIL_INTERNET' }
  | { type: 'RESTORE_INTERNET' }
  | { type: 'COMPLETE_SYNC' }
  | { type: 'RESET_SCENARIO' }
  | { type: 'QUEUE_OFFLINE_EVENT';       payload: { eventType: string; data: Record<string, unknown> } }
  | { type: 'UPDATE_RESCUE_TEAM_STATUS'; payload: { id: string; status: string; mission?: string } }
  | { type: 'ACKNOWLEDGE_ALERT';         payload: string }
  | { type: 'SET_DATA_MODE';             payload: 'DEMO' | 'AWS' }
  | { type: 'MERGE_BACKEND'; payload: Partial<{
      summary:     BackendSummary
      sensors:     Sensor[]
      shelters:    Shelter[]
      rescueTeams: RescueTeam[]
      alerts:      Alert[]
    }> }
  | { type: 'SET_BACKEND_CONNECTED'; payload: boolean }
  | { type: 'SET_WATER_LEVEL';   payload: number }
  | { type: 'SET_ROAD_STATUS';   payload: { id: string; status: 'CLEAR' | 'BLOCKED' | 'FLOODED'; reason?: string } }
  /** Hydrate store from IndexedDB snapshot on app load */
  | { type: 'HYDRATE_FROM_IDB'; payload: Partial<DisasterState> }
  /** Create a fully-specified incident from the operator form */
  | { type: 'CREATE_CUSTOM_INCIDENT'; payload: import('@/types/disaster').Incident }

// ─── Reducer ──────────────────────────────────────────────────────────────────
function reducer(state: DisasterState, action: DisasterAction): DisasterState {
  switch (action.type) {

    case 'TICK':
      return state.simulationRunning ? simulationTick(state) : state

    case 'SET_SIMULATION_RUNNING': return { ...state, simulationRunning: action.payload }
    case 'SET_SIMULATION_SPEED':   return { ...state, simulationSpeed: action.payload }
    case 'SIMULATE_FLOOD':         return applySimulateFlood(state)
    case 'RAISE_WATER_LEVEL':      return applyRaiseWaterLevel(state)
    case 'BLOCK_ROAD':             return applyBlockRoad(state)
    case 'CREATE_RESCUE_INCIDENT': return applyCreateRescueIncident(state)
    case 'FILL_SHELTER':           return applyFillShelter(state)
    case 'DETECT_DEBRIS':          return applyDetectDebris(state)
    case 'FAIL_INTERNET':          return applyFailInternet(state)
    case 'RESTORE_INTERNET':       return applyRestoreInternet(state)
    case 'COMPLETE_SYNC':          return applyCompleteSyncInternet(state)
    case 'RESET_SCENARIO':         return applyResetScenario(state)
    case 'SET_WATER_LEVEL':        return applySetWaterLevel(state, action.payload)
    case 'SET_ROAD_STATUS':        return applySetRoadStatus(state, action.payload)

    case 'CREATE_CUSTOM_INCIDENT': {
      const incident = action.payload
      return {
        ...state,
        incidents:           [incident, ...state.incidents],
        activeIncidentCount: state.activeIncidentCount + 1,
        alerts: [{
          id:        `AL-FORM-${Date.now()}`,
          severity:  incident.severity === 'CRITICAL' ? 'CRITICAL' : incident.severity === 'HIGH' ? 'WARNING' : 'INFO',
          title:     `New ${incident.type.replace(/_/g, ' ')} Incident`,
          message:   incident.description,
          timestamp: incident.reportedAt,
          acknowledged: false,
          location:  incident.location,
          relatedEntityId: incident.id,
        }, ...state.alerts.slice(0, 49)],
      }
    }

    case 'QUEUE_OFFLINE_EVENT':
      return applyQueueOfflineEvent(state, action.payload.eventType, action.payload.data)

    case 'UPDATE_RESCUE_TEAM_STATUS': {
      const { id, status, mission } = action.payload
      const next: DisasterState = {
        ...state,
        rescueTeams: state.rescueTeams.map(t =>
          t.id === id ? { ...t, status: status as typeof t.status, mission: mission ?? t.mission } : t,
        ),
      }
      if (state.networkStatus === 'OFFLINE') {
        return applyQueueOfflineEvent(next, 'TEAM_STATUS_UPDATE', { teamId: id, status, mission })
      }
      return next
    }

    case 'ACKNOWLEDGE_ALERT':
      return {
        ...state,
        alerts: state.alerts.map(a => a.id === action.payload ? { ...a, acknowledged: true } : a),
      }

    case 'SET_DATA_MODE':
      return { ...state, dataMode: action.payload }

    case 'SET_BACKEND_CONNECTED':
      return { ...state, backendConnected: action.payload }

    // ── Hydrate from IndexedDB ────────────────────────────────────────────────
    // Merges cached arrays over the seed state, keeping simulation scalars
    // from the snapshot if available.
    case 'HYDRATE_FROM_IDB': {
      const p = action.payload
      return {
        ...state,
        // Arrays: use cached version if non-empty, otherwise keep seed
        sensors:               p.sensors?.length               ? p.sensors               : state.sensors,
        shelters:              p.shelters?.length               ? p.shelters              : state.shelters,
        rescueTeams:           p.rescueTeams?.length            ? p.rescueTeams           : state.rescueTeams,
        vehicles:              p.vehicles?.length               ? p.vehicles              : state.vehicles,
        roads:                 p.roads?.length                  ? p.roads                 : state.roads,
        buildings:             p.buildings?.length              ? p.buildings             : state.buildings,
        floodZones:            p.floodZones?.length             ? p.floodZones            : state.floodZones,
        wasteZones:            p.wasteZones?.length             ? p.wasteZones            : state.wasteZones,
        routes:                p.routes?.length                 ? p.routes                : state.routes,
        alerts:                p.alerts?.length                 ? p.alerts                : state.alerts,
        incidents:             p.incidents?.length              ? p.incidents             : state.incidents,
        criticalInfrastructure:p.criticalInfrastructure?.length ? p.criticalInfrastructure: state.criticalInfrastructure,
        syncQueue:             p.syncQueue?.length              ? p.syncQueue             : state.syncQueue,
        syncQueueCount:        p.syncQueue?.length              ?? state.syncQueueCount,
        // Scalars from snapshot meta (if present)
        ...(p.severity            ? { severity:            p.severity            } : {}),
        ...(p.floodRisk           ? { floodRisk:           p.floodRisk           } : {}),
        ...(p.affectedPeople      ? { affectedPeople:      p.affectedPeople      } : {}),
        ...(p.averageWaterLevel   ? { averageWaterLevel:   p.averageWaterLevel   } : {}),
        ...(p.activeIncidentCount ? { activeIncidentCount: p.activeIncidentCount } : {}),
        ...(p.lastSyncAt          ? { lastSyncAt:          p.lastSyncAt          } : {}),
      }
    }

    // ── Backend merge ─────────────────────────────────────────────────────────
    case 'MERGE_BACKEND': {
      const p = action.payload
      const s = p.summary

      const sensors = p.sensors
        ? state.sensors.map(local => {
            const srv = p.sensors!.find(x => x.id === local.id)
            return srv ? { ...local, reading: srv.reading, trend: srv.trend, battery: srv.battery, status: srv.status, lastUpdated: srv.lastUpdated } : local
          })
        : state.sensors

      const shelters = p.shelters
        ? state.shelters.map(local => {
            const srv = p.shelters!.find(x => x.id === local.id)
            return srv ? { ...local, ...srv } : local
          })
        : state.shelters

      const rescueTeams = p.rescueTeams
        ? state.rescueTeams.map(local => {
            const srv = p.rescueTeams!.find(x => x.id === local.id)
            return srv ? { ...local, ...srv } : local
          })
        : state.rescueTeams

      const existingIds = new Set(state.alerts.map(a => a.id))
      const newAlerts = p.alerts ? p.alerts.filter(a => !existingIds.has(a.id)) : []

      return {
        ...state,
        sensors, shelters, rescueTeams,
        alerts: newAlerts.length ? [...newAlerts, ...state.alerts].slice(0, 50) : state.alerts,
        ...(s ? {
          severity:           s.severity as DisasterState['severity'],
          floodRisk:          s.floodRisk,
          affectedPeople:     s.affectedPeople,
          averageWaterLevel:  s.averageWaterLevel,
          activeIncidentCount:s.activeIncidents,
          lastSyncAt:         s.lastUpdated,
        } : {}),
      }
    }

    default:
      return state
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────
interface CtxValue { state: DisasterState; dispatch: React.Dispatch<DisasterAction> }
const Ctx = createContext<CtxValue | null>(null)

// ─── Provider ─────────────────────────────────────────────────────────────────
export function DisasterProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, createInitialState)

  const speedRef     = useRef(state.simulationSpeed)
  const runningRef   = useRef(state.simulationRunning)
  const netRef       = useRef(state.networkStatus)
  const stateRef     = useRef(state)   // always current state for async callbacks
  const hydratedRef  = useRef(false)   // prevent double-hydration

  useEffect(() => { speedRef.current   = state.simulationSpeed   }, [state.simulationSpeed])
  useEffect(() => { runningRef.current = state.simulationRunning }, [state.simulationRunning])
  useEffect(() => { netRef.current     = state.networkStatus     }, [state.networkStatus])
  useEffect(() => { stateRef.current   = state                   }, [state])

  // ── STEP 3: Hydrate from IndexedDB on mount ────────────────────────────────
  // Runs once immediately after first render. If IDB has a snapshot, merge it
  // so the user sees their last session even while offline.
  useEffect(() => {
    if (hydratedRef.current) return
    hydratedRef.current = true

    restoreState().then(cached => {
      if (!cached) return   // nothing stored yet — seed data is fine
      console.log('[idb] hydrating from snapshot, incidents:', cached.incidents?.length ?? 0)
      dispatch({ type: 'HYDRATE_FROM_IDB', payload: cached })
    }).catch(err => console.warn('[idb] hydration failed:', err))
  }, [])

  // ── Simulation loop ──────────────────────────────────────────────────────
  useEffect(() => {
    const id = window.setInterval(() => {
      if (!runningRef.current) return
      for (let i = 0; i < speedRef.current; i++) dispatch({ type: 'TICK' })
    }, 1000)
    return () => clearInterval(id)
  }, [])

  // ── STEP 3/5: Persist state snapshot to IDB every 5 s ─────────────────────
  // This ensures a reload (online or offline) always loads the latest state.
  useEffect(() => {
    const id = window.setInterval(() => {
      persistState(stateRef.current).catch(() => {})
    }, 5_000)
    return () => clearInterval(id)
  }, [])

  // Also persist immediately on key changes (incidents, roads, syncQueue)
  const incidentCount = state.incidents.length
  const syncQCount    = state.syncQueue.length
  useEffect(() => {
    persistState(stateRef.current).catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incidentCount, syncQCount])

  // ── STEP 4: Auto-complete sync — waits for flush to finish ───────────────
  // IMPORTANT: do NOT set a fixed 3-second timeout here — that races with
  // the flush effect below. Instead, COMPLETE_SYNC is dispatched by the
  // flush effect itself after the queue drains successfully.
  // The 3-second timer is kept only as a safety fallback in case the
  // flush errors out and never dispatches COMPLETE_SYNC itself.
  useEffect(() => {
    if (state.networkStatus !== 'SYNCING') return
    // Safety fallback: if flush didn't finish in 12 s, complete anyway
    const id = window.setTimeout(() => dispatch({ type: 'COMPLETE_SYNC' }), 12_000)
    return () => clearTimeout(id)
  }, [state.networkStatus])

  // ── STEP 6: Flush IDB sync queue to backend on network restore ─────────────
  useEffect(() => {
    if (state.networkStatus !== 'SYNCING') return

    async function flush() {
      let totalProcessed = 0
      let totalFailed    = 0

      // 1. Flush in-memory queue first
      const memQueue = stateRef.current.syncQueue
      if (memQueue.length > 0) {
        const result = await flushSyncQueue(memQueue).catch(() => null)
        if (result) {
          totalProcessed += result.processed
          totalFailed    += result.failed
          console.log(`[sync] memory queue: ${result.processed}/${result.received} sent`)
        } else {
          totalFailed += memQueue.length
        }
      }

      // 2. Drain durable IDB queue (events from previous offline sessions)
      const idbItems = await getAllQueued().catch(() => [])
      if (idbItems.length > 0) {
        console.log(`[sync] IDB queue: ${idbItems.length} events`)
        const result = await flushSyncQueue(idbItems).catch(() => null)
        if (result) {
          totalProcessed += result.processed
          totalFailed    += result.failed
          console.log(`[sync] IDB queue: ${result.processed}/${result.received} sent`)
          if (result.failed === 0) {
            await clearQueue().catch(() => {})
          }
        } else {
          totalFailed += idbItems.length
        }
      }

      // 3. Complete sync — only after all writes are done
      console.log(`[sync] complete: ${totalProcessed} processed, ${totalFailed} failed`)
      dispatch({ type: 'COMPLETE_SYNC' })
    }

    flush()
  }, [state.networkStatus])

  // ── WebSocket live push ──────────────────────────────────────────────────
  useEffect(() => {
    const cleanup = connectLiveSocket(
      (msg: WsPushMessage) => {
        if (netRef.current === 'OFFLINE') return
        switch (msg.type) {
          case 'SUMMARY':
            dispatch({ type: 'MERGE_BACKEND', payload: { summary: msg.data } })
            break
          case 'SENSORS':
            dispatch({ type: 'MERGE_BACKEND', payload: { sensors: msg.data } })
            break
          case 'ALERT':
            dispatch({ type: 'MERGE_BACKEND', payload: { alerts: [msg.data] } })
            break
        }
      },
      (connected) => dispatch({ type: 'SET_BACKEND_CONNECTED', payload: connected }),
    )
    return cleanup
  }, [])

  // ── HTTP polling fallback (5 s) ───────────────────────────────────────────
  useEffect(() => {
    async function poll() {
      if (netRef.current === 'OFFLINE') return

      const [summary, sensors, shelters, teams, alerts] = await Promise.allSettled([
        fetchSummary(), fetchSensors(), fetchShelters(), fetchTeams(), fetchAlerts(),
      ])

      dispatch({
        type: 'MERGE_BACKEND',
        payload: {
          summary:     summary.status     === 'fulfilled' && summary.value     ? summary.value     : undefined,
          sensors:     sensors.status     === 'fulfilled' && sensors.value     ? sensors.value     : undefined,
          shelters:    shelters.status    === 'fulfilled' && shelters.value    ? shelters.value    : undefined,
          rescueTeams: teams.status       === 'fulfilled' && teams.value       ? teams.value       : undefined,
          alerts:      alerts.status      === 'fulfilled' && alerts.value      ? alerts.value      : undefined,
        },
      })
    }

    poll()
    const id = setInterval(poll, 5_000)
    return () => clearInterval(id)
  }, [])

  return <Ctx.Provider value={{ state, dispatch }}>{children}</Ctx.Provider>
}

// ─── Side-effect middleware ────────────────────────────────────────────────────
// The two useEffects in DisasterProvider already handle:
//   • 5-second periodic persist
//   • immediate persist on incidents/syncQueue count changes
// useDisasterDispatch therefore just exposes the raw ctx dispatch.

// ─── Hooks ────────────────────────────────────────────────────────────────────
export function useDisasterState(): DisasterState {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useDisasterState must be used inside DisasterProvider')
  return ctx.state
}

export function useDisasterDispatch(): React.Dispatch<DisasterAction> {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useDisasterDispatch must be used inside DisasterProvider')
  return ctx.dispatch
}

export function useDisasterSlice<T>(selector: (s: DisasterState) => T): T {
  return selector(useDisasterState())
}

export function useNetworkStatus() {
  const { networkStatus, syncQueueCount, lastSyncAt } = useDisasterState()
  const dispatch = useDisasterDispatch()
  return {
    networkStatus, syncQueueCount, lastSyncAt,
    isOnline:  networkStatus === 'CONNECTED',
    isOffline: networkStatus === 'OFFLINE',
    isSyncing: networkStatus === 'SYNCING',
    failInternet:    useCallback(() => dispatch({ type: 'FAIL_INTERNET'    }), [dispatch]),
    restoreInternet: useCallback(() => dispatch({ type: 'RESTORE_INTERNET' }), [dispatch]),
  }
}

export function useSimulationControls() {
  const { simulationRunning, simulationSpeed, simulationTime } = useDisasterState()
  const dispatch = useDisasterDispatch()
  return {
    simulationRunning, simulationSpeed, simulationTime,
    play:           useCallback(() => dispatch({ type: 'SET_SIMULATION_RUNNING', payload: true  }), [dispatch]),
    pause:          useCallback(() => dispatch({ type: 'SET_SIMULATION_RUNNING', payload: false }), [dispatch]),
    setSpeed:       useCallback((s: number) => dispatch({ type: 'SET_SIMULATION_SPEED', payload: s }), [dispatch]),
    simulateFlood:  useCallback(() => dispatch({ type: 'SIMULATE_FLOOD'          }), [dispatch]),
    raiseWater:     useCallback(() => dispatch({ type: 'RAISE_WATER_LEVEL'       }), [dispatch]),
    blockRoad:      useCallback(() => dispatch({ type: 'BLOCK_ROAD'              }), [dispatch]),
    createIncident: useCallback(() => dispatch({ type: 'CREATE_RESCUE_INCIDENT'  }), [dispatch]),
    fillShelter:    useCallback(() => dispatch({ type: 'FILL_SHELTER'            }), [dispatch]),
    detectDebris:   useCallback(() => dispatch({ type: 'DETECT_DEBRIS'          }), [dispatch]),
    reset: useCallback(() => {
      dispatch({ type: 'RESET_SCENARIO' })
      // Wipe IDB so next reload also starts fresh
      clearCache().catch(() => {})
    }, [dispatch]),
    setWaterLevel: useCallback(
      (level: number) => dispatch({ type: 'SET_WATER_LEVEL', payload: level }),
      [dispatch],
    ),
    setRoadStatus: useCallback(
      (id: string, status: 'CLEAR' | 'BLOCKED' | 'FLOODED', reason?: string) =>
        dispatch({ type: 'SET_ROAD_STATUS', payload: { id, status, reason } }),
      [dispatch],
    ),
  }
}
