'use client'

/**
 * DisasterMapInner — Leaflet-based live disaster map for India.
 *
 * Uses react-leaflet which has no Web Worker requirement and works
 * perfectly with Next.js / Turbopack out of the box.
 *
 * Tile source: MapTiler (when key set) or OpenStreetMap fallback.
 */

import { useEffect } from 'react'
import {
  MapContainer, TileLayer, CircleMarker, Polygon,
  Polyline, Popup, ZoomControl, useMap,
} from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { useDisasterState } from '@/store/disasterStore'
import type { MapSelection } from '@/components/disaster-map'

// ── Export LayerFlags ─────────────────────────────────────────────
export interface LayerFlags {
  floodZones?:       boolean
  shelters?:         boolean
  rescueTeams?:      boolean
  vehicles?:         boolean
  sensors?:          boolean
  wasteZones?:       boolean
  evacuationRoutes?: boolean
}

// ── Tile URL — brighter style for visibility ──────────────────────
const KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY
const TILE_URL = KEY
  ? `https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=${KEY}`
  : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
const ATTRIBUTION = KEY
  ? '&copy; <a href="https://www.maptiler.com">MapTiler</a> &copy; <a href="https://www.openstreetmap.org">OSM</a>'
  : '&copy; <a href="https://www.openstreetmap.org">OpenStreetMap</a>'

// ── Colour helpers ────────────────────────────────────────────────
const SEV_COLOR: Record<string, string> = {
  CRITICAL: '#f87171', HIGH: '#f59e0b', ELEVATED: '#fbbf24', NORMAL: '#84cc16',
}
const STATUS_COLOR: Record<string, string> = {
  SAFE: '#4ade80', WARNING: '#f59e0b', CRITICAL: '#f87171',
  AVAILABLE: '#4ade80', RESPONDING: '#f59e0b', RESCUING: '#f87171',
  TRANSPORTING: '#38bdf8', RETURNING: '#22d3ee', OFFLINE: '#6b7280',
}
const TYPE_COLOR: Record<string, string> = {
  URBAN_RESCUE: '#fb923c', MEDICAL: '#f87171', FIRE: '#f59e0b',
  POLICE: '#38bdf8', DRONE: '#e879f9', LOGISTICS: '#4ade80',
  RELIEF: '#4ade80', AMBULANCE: '#f87171', FIRE_TRUCK: '#f59e0b',
  RESCUE: '#fb923c', BOAT: '#38bdf8',
}
const SENSOR_COLOR = (r: number) => r > 2.5 ? '#f87171' : r > 1.2 ? '#f59e0b' : '#22d3ee'

// ── Fix Leaflet default icon issue with bundlers ──────────────────
function FixLeafletIcons() {
  const map = useMap()
  useEffect(() => {
    // Leaflet tries to load marker icons from a relative URL that doesn't
    // exist in Next.js. We don't use default icons (using CircleMarker instead)
    // so this is just a safety measure.
    map.invalidateSize()
  }, [map])
  return null
}

// ── Props ─────────────────────────────────────────────────────────
interface Props {
  onSelect: (sel: MapSelection) => void
  layers?:  LayerFlags
}

// ── Component ─────────────────────────────────────────────────────
export function DisasterMapInner({ onSelect, layers = {} }: Props) {
  const {
    floodZones, rescueTeams, shelters, vehicles,
    sensors, wasteZones, routes, averageWaterLevel,
  } = useDisasterState()

  const {
    floodZones:       showFlood  = true,
    shelters:         showShelt  = true,
    rescueTeams:      showTeams  = true,
    vehicles:         showVeh    = true,
    sensors:          showSens   = true,
    wasteZones:       showWaste  = true,
    evacuationRoutes: showRoutes = true,
  } = layers

  return (
    <div className="map-wrap" style={{ position: 'relative', width: '100%', height: '100%' }}>

      <MapContainer
        center={[22.0, 80.0]}         // India centre, slightly north for better fit
        zoom={5}
        minZoom={4}
        maxZoom={18}
        style={{ width: '100%', height: '100%', background: '#e8f4f8' }}
        zoomControl={false}
        attributionControl
      >
        <FixLeafletIcons />
        <ZoomControl position="bottomright" />

        {/* Base map tiles */}
        <TileLayer url={TILE_URL} attribution={ATTRIBUTION} maxZoom={18} />

        {/* ── Flood zones ────────────────────────────────────── */}
        {showFlood && floodZones.map(zone => (
          <Polygon
            key={zone.id}
            positions={zone.coordinates.map(([lng, lat]) => [lat, lng] as [number, number])}
            pathOptions={{
              color: zone.severity === 'CRITICAL' ? '#1e40af' : '#1d4ed8',
              fillColor: zone.severity === 'CRITICAL' ? '#3b82f6' : '#60a5fa',
              fillOpacity: Math.min(0.35 + (zone.waterDepth / 6) * 0.30, 0.65),
              weight: 3,
              opacity: 0.90,
            }}
            eventHandlers={{
              click: () => onSelect({
                title: zone.name,
                type: `FLOOD ZONE · ${zone.severity}`,
                detail: `Water depth: ${zone.waterDepth.toFixed(1)}m · Affected: ${zone.affectedPeople.toLocaleString()} people · Expansion: ${zone.expansionRate}m/hr`,
                color: 'cyan',
              }),
            }}
          >
            <Popup className="leaflet-popup-dark">
              <strong>{zone.name}</strong><br />
              Depth: {zone.waterDepth.toFixed(1)}m · {zone.affectedPeople.toLocaleString()} affected
            </Popup>
          </Polygon>
        ))}

        {/* ── Evacuation routes ───────────────────────────────── */}
        {showRoutes && routes
          .filter(r => !r.isBlocked && r.type === 'EVACUATION')
          .map(r => {
            const pts: [number, number][] = [
              [r.fromCoords.lat, r.fromCoords.lng],
              ...r.waypoints.map(w => [w.lat, w.lng] as [number, number]),
              [r.toCoords.lat, r.toCoords.lng],
            ]
            const color = r.riskLevel === 'LOW' ? '#84cc16' : r.riskLevel === 'MEDIUM' ? '#f59e0b' : '#f87171'
            return (
              <Polyline
                key={r.id}
                positions={pts}
                pathOptions={{ color, weight: 3.5, opacity: 0.90, dashArray: '8 6' }}
                eventHandlers={{
                  click: () => onSelect({
                    title: `Evacuation: ${r.from} → ${r.to}`,
                    type: `EVACUATION ROUTE · ${r.riskLevel} RISK`,
                    detail: `Distance: ${r.distance} km · ETA: ${r.etaMinutes} min · Risk: ${r.riskLevel}`,
                    color: r.riskLevel === 'LOW' ? 'supply' : 'warning',
                  }),
                }}
              />
            )
          })}

        {/* ── Shelters ────────────────────────────────────────── */}
        {showShelt && shelters.map(s => {
          const pct = Math.round((s.occupancy / s.capacity) * 100)
          const color = STATUS_COLOR[s.status] ?? '#38bdf8'
          return (
            <CircleMarker
              key={s.id}
              center={[s.location.lat, s.location.lng]}
              radius={13}
              pathOptions={{ color: '#0f172a', fillColor: color, fillOpacity: 0.85, weight: 2 }}
              eventHandlers={{
                click: () => onSelect({
                  title: s.name,
                  type: `SHELTER · ${s.status}`,
                  detail: `${s.sector} · Occupancy ${pct}% (${s.occupancy}/${s.capacity}) · Water ${s.waterLevel.toFixed(0)}% · Food ${s.foodLevel.toFixed(0)}% · Medicine ${s.medicineLevel.toFixed(0)}%`,
                  color: s.status === 'CRITICAL' ? 'critical' : s.status === 'WARNING' ? 'warning' : 'shelter',
                }),
              }}
            >
              <Popup>
                <strong>{s.name}</strong><br />
                {s.sector} · {pct}% full ({s.status})
              </Popup>
            </CircleMarker>
          )
        })}

        {/* ── Rescue teams ────────────────────────────────────── */}
        {showTeams && rescueTeams.filter(t => t.status !== 'OFFLINE').map(t => {
          const color = t.priority === 'CRITICAL' ? '#f87171' : TYPE_COLOR[t.type] ?? '#fb923c'
          return (
            <CircleMarker
              key={t.id}
              center={[t.location.lat, t.location.lng]}
              radius={12}
              pathOptions={{ color: '#0f172a', fillColor: color, fillOpacity: 0.85, weight: 2 }}
              eventHandlers={{
                click: () => onSelect({
                  title: `${t.id} — ${t.name}`,
                  type: `${t.type.replace(/_/g, ' ')} · ${t.status}`,
                  detail: `${t.sector} · Mission: ${t.mission ?? 'None'} · Battery ${t.battery.toFixed(0)}%`,
                  color: 'rescue',
                }),
              }}
            >
              <Popup>
                <strong>{t.id}</strong><br />
                {t.status} · {t.sector}<br />
                {t.mission ?? 'No active mission'}
              </Popup>
            </CircleMarker>
          )
        })}

        {/* ── Vehicles (active only) ──────────────────────────── */}
        {showVeh && vehicles.filter(v => v.status !== 'AVAILABLE').map(v => (
          <CircleMarker
            key={v.id}
            center={[v.location.lat, v.location.lng]}
            radius={10}
            pathOptions={{ color: '#0f172a', fillColor: '#4ade80', fillOpacity: 0.85, weight: 2 }}
            eventHandlers={{
              click: () => onSelect({
                title: v.name,
                type: `${v.type} · ${v.status}`,
                detail: `${v.sector} · Cargo: ${v.cargo.join(', ') || 'Empty'} · Fuel ${v.fuelLevel}%`,
                color: 'supply',
              }),
            }}
          >
            <Popup><strong>{v.name}</strong><br />{v.status} · Fuel {v.fuelLevel}%</Popup>
          </CircleMarker>
        ))}

        {/* ── Water-level sensors ─────────────────────────────── */}
        {showSens && sensors.filter(s => s.type === 'WATER_LEVEL').map(s => {
          const color = SENSOR_COLOR(s.reading)
          return (
            <CircleMarker
              key={s.id}
              center={[s.location.lat, s.location.lng]}
              radius={11}
              pathOptions={{ color: '#0f172a', fillColor: color, fillOpacity: 0.85, weight: 2 }}
              eventHandlers={{
                click: () => onSelect({
                  title: s.name,
                  type: 'WATER LEVEL SENSOR',
                  detail: `Reading: ${s.reading.toFixed(2)} ${s.unit} · Trend: ${s.trend} · Battery ${s.battery.toFixed(0)}% · ${s.status}`,
                  color: s.reading > 2.5 ? 'critical' : 'cyan',
                }),
              }}
            >
              <Popup><strong>{s.id}</strong><br />{s.reading.toFixed(2)} {s.unit} · {s.trend}</Popup>
            </CircleMarker>
          )
        })}

        {/* ── Waste / hazard zones ────────────────────────────── */}
        {showWaste && wasteZones.map(z => (
          <CircleMarker
            key={z.id}
            center={[z.location.lat, z.location.lng]}
            radius={11}
            pathOptions={{ color: '#0f172a', fillColor: '#f59e0b', fillOpacity: 0.85, weight: 2 }}
            eventHandlers={{
              click: () => onSelect({
                title: z.type.replace(/_/g, ' '),
                type: 'HAZARD ZONE',
                detail: `${z.description} · Severity: ${z.severity} · Detected: ${z.detectedAt}`,
                color: 'warning',
              }),
            }}
          >
            <Popup><strong>{z.type.replace(/_/g,' ')}</strong><br />{z.description}</Popup>
          </CircleMarker>
        ))}
      </MapContainer>

      {/* ── Scan grid overlay ───────────────────────────────────── */}
      <div className="map-scanlines" />

      {/* ── Top-left badge ──────────────────────────────────────── */}
      <div className="map-badge">
        <span className="tag" style={{ color: '#67e8f9', fontWeight: 700 }}>MyRadar</span>
        <span className="tag" style={{ color: 'rgba(255,255,255,0.25)' }}>·</span>
        <span className="tag" style={{ color: 'rgba(255,255,255,0.60)' }}>India — National Operations</span>
        <span className="tag" style={{ color: 'rgba(255,255,255,0.25)' }}>·</span>
        <span className="tag" style={{ color: 'rgba(255,255,255,0.45)' }}>
          avg water{' '}
          <span style={{ color: '#22d3ee', fontWeight: 700 }}>{averageWaterLevel.toFixed(1)} m</span>
        </span>
        {!KEY && (
          <span className="tag" style={{
            color: '#f59e0b',
            background: 'rgba(245,158,11,0.10)',
            border: '1px solid rgba(245,158,11,0.25)',
            padding: '1px 6px',
            marginLeft: 6,
          }}>
            Add MapTiler key for better tiles
          </span>
        )}
      </div>

      {/* ── Bottom-right coords ─────────────────────────────────── */}
      <div
        className="tag hidden lg:block"
        style={{
          position: 'absolute', bottom: 36, right: 16,
          zIndex: 10, pointerEvents: 'none',
          color: 'rgba(255,255,255,0.25)',
        }}
      >
        20.59°N · 78.96°E · India
      </div>
    </div>
  )
}
