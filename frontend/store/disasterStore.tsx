'use client'

/**
 * MyRadar Global Disaster Store
 *
 * Architecture:
 *   LocalSimulation ──tick──▶ store state ◀──MERGE_BACKEND── BackendPolling
 *
 * The simulation keeps all panels alive even when the backend is down.
 * When the backend (Express) is running, a WebSocket push + 5-second
 * HTTP poll merges authoritative server data into the local state.
 * On network restore, the offline sync queue is flushed to the backend.
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
} from '@/lib/simulation'
import {
  connectLiveSocket, fetchSummary, fetchSensors,
  fetchShelters, fetchTeams, fetchAlerts, flushSyncQueue,
  type BackendSummary, type WsPushMessage,
} from '@/services/apiClient'

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
  /** Merge authoritative data pushed from the Express backend */
  | { type: 'MERGE_BACKEND'; payload: Partial<{
      summary:     BackendSummary
      sensors:     Sensor[]
      shelters:    Shelter[]
      rescueTeams: RescueTeam[]
      alerts:      Alert[]
    }>
  }
  | { type: 'SET_BACKEND_CONNECTED'; payload: boolean }

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
      // Exposed in state so the SyncPanel can display backend connectivity
      return { ...state, backendConnected: action.payload }

    // ── Backend merge: authoritative data replaces simulation values ──────────
    case 'MERGE_BACKEND': {
      const p = action.payload
      const s = p.summary

      // Merge sensors: update readings for IDs that exist locally
      const sensors = p.sensors
        ? state.sensors.map(local => {
            const srv = p.sensors!.find(x => x.id === local.id)
            return srv ? { ...local, reading: srv.reading, trend: srv.trend, battery: srv.battery, status: srv.status, lastUpdated: srv.lastUpdated } : local
          })
        : state.sensors

      // Merge shelters: same strategy
      const shelters = p.shelters
        ? state.shelters.map(local => {
            const srv = p.shelters!.find(x => x.id === local.id)
            return srv ? { ...local, ...srv } : local
          })
        : state.shelters

      // Merge teams: same
      const rescueTeams = p.rescueTeams
        ? state.rescueTeams.map(local => {
            const srv = p.rescueTeams!.find(x => x.id === local.id)
            return srv ? { ...local, ...srv } : local
          })
        : state.rescueTeams

      // Prepend new alerts from server that aren't already in local state
      const existingIds = new Set(state.alerts.map(a => a.id))
      const newAlerts = p.alerts
        ? p.alerts.filter(a => !existingIds.has(a.id))
        : []

      return {
        ...state,
        sensors,
        shelters,
        rescueTeams,
        alerts: newAlerts.length ? [...newAlerts, ...state.alerts].slice(0, 50) : state.alerts,
        // Merge top-level summary fields if backend has them
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

  const speedRef   = useRef(state.simulationSpeed)
  const runningRef = useRef(state.simulationRunning)
  const queueRef   = useRef(state.syncQueue)
  const netRef     = useRef(state.networkStatus)

  useEffect(() => { speedRef.current   = state.simulationSpeed   }, [state.simulationSpeed])
  useEffect(() => { runningRef.current = state.simulationRunning }, [state.simulationRunning])
  useEffect(() => { queueRef.current   = state.syncQueue         }, [state.syncQueue])
  useEffect(() => { netRef.current     = state.networkStatus     }, [state.networkStatus])

  // ── Simulation loop ──────────────────────────────────────────────────────
  useEffect(() => {
    const id = window.setInterval(() => {
      if (!runningRef.current) return
      for (let i = 0; i < speedRef.current; i++) dispatch({ type: 'TICK' })
    }, 1000)
    return () => clearInterval(id)
  }, [])

  // ── Auto-complete sync after 3 s ─────────────────────────────────────────
  useEffect(() => {
    if (state.networkStatus !== 'SYNCING') return
    const id = window.setTimeout(() => dispatch({ type: 'COMPLETE_SYNC' }), 3000)
    return () => clearTimeout(id)
  }, [state.networkStatus])

  // ── Flush offline queue when connection is restored ──────────────────────
  useEffect(() => {
    if (state.networkStatus !== 'SYNCING') return
    const queue = queueRef.current
    if (queue.length === 0) return

    flushSyncQueue(queue).then(result => {
      if (result) {
        console.log(`[sync] flushed ${result.processed}/${result.received} events to backend`)
      }
    }).catch(err => console.warn('[sync] flush failed:', err))
  }, [state.networkStatus])

  // ── WebSocket live push ──────────────────────────────────────────────────
  useEffect(() => {
    const cleanup = connectLiveSocket(
      (msg: WsPushMessage) => {
        if (netRef.current === 'OFFLINE') return   // ignore when offline
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

  // ── HTTP polling fallback (5 s) — used when WS isn't available ──────────
  useEffect(() => {
    async function poll() {
      if (netRef.current === 'OFFLINE') return

      const [summary, sensors, shelters, teams, alerts] = await Promise.allSettled([
        fetchSummary(),
        fetchSensors(),
        fetchShelters(),
        fetchTeams(),
        fetchAlerts(),
      ])

      const payload: Parameters<typeof dispatch>[0] & { type: 'MERGE_BACKEND' } = {
        type: 'MERGE_BACKEND',
        payload: {
          summary:     summary.status  === 'fulfilled' && summary.value  ? summary.value  : undefined,
          sensors:     sensors.status  === 'fulfilled' && sensors.value  ? sensors.value  : undefined,
          shelters:    shelters.status === 'fulfilled' && shelters.value ? shelters.value : undefined,
          rescueTeams: teams.status    === 'fulfilled' && teams.value    ? teams.value    : undefined,
          alerts:      alerts.status   === 'fulfilled' && alerts.value   ? alerts.value   : undefined,
        },
      }
      dispatch(payload)
    }

    poll()                          // immediate on mount
    const id = setInterval(poll, 5_000)
    return () => clearInterval(id)
  }, [])

  return <Ctx.Provider value={{ state, dispatch }}>{children}</Ctx.Provider>
}

// ─── Hooks ────────────────────────────────────────────────────────────────────
export function useDisasterState() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useDisasterState must be used inside DisasterProvider')
  return ctx.state
}

export function useDisasterDispatch() {
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
    failInternet:    useCallback(() => dispatch({ type: 'FAIL_INTERNET'     }), [dispatch]),
    restoreInternet: useCallback(() => dispatch({ type: 'RESTORE_INTERNET'  }), [dispatch]),
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
    simulateFlood:  useCallback(() => dispatch({ type: 'SIMULATE_FLOOD'         }), [dispatch]),
    raiseWater:     useCallback(() => dispatch({ type: 'RAISE_WATER_LEVEL'      }), [dispatch]),
    blockRoad:      useCallback(() => dispatch({ type: 'BLOCK_ROAD'             }), [dispatch]),
    createIncident: useCallback(() => dispatch({ type: 'CREATE_RESCUE_INCIDENT' }), [dispatch]),
    fillShelter:    useCallback(() => dispatch({ type: 'FILL_SHELTER'           }), [dispatch]),
    detectDebris:   useCallback(() => dispatch({ type: 'DETECT_DEBRIS'         }), [dispatch]),
    reset:          useCallback(() => dispatch({ type: 'RESET_SCENARIO'        }), [dispatch]),
  }
}
