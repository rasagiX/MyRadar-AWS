'use client'

/**
 * DisasterMapInner — MapLibre GL 3D map loaded via CDN script tag.
 *
 * WHY CDN instead of npm package:
 *   Next.js Turbopack cannot bundle MapLibre's web worker correctly.
 *   Loading via <script> CDN tag bypasses the bundler entirely —
 *   MapLibre initialises in the browser with full worker support,
 *   giving us 3D buildings, satellite imagery, pitch, and bearing.
 *
 * Features:
 *   • Real satellite imagery (MapTiler hybrid style)
 *   • 3D building extrusion — you can see individual buildings
 *   • Flood zone fill layers with depth-based opacity
 *   • Evacuation route lines
 *   • Custom HTML markers for shelters, teams, sensors, waste
 *   • Map style switcher: Satellite / Streets / Dark
 */

import { useEffect, useRef, useCallback } from 'react'
import { useDisasterState } from '@/store/disasterStore'
import type { MapSelection } from '@/components/disaster-map'

// ── Types ─────────────────────────────────────────────────────────
export interface LayerFlags {
  floodZones?:       boolean
  shelters?:         boolean
  rescueTeams?:      boolean
  vehicles?:         boolean
  sensors?:          boolean
  wasteZones?:       boolean
  evacuationRoutes?: boolean
}

export type MapStyle = 'satellite' | 'streets' | 'dark'

const KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY

const STYLES: Record<MapStyle, string> = {
  satellite: KEY
    ? `https://api.maptiler.com/maps/hybrid/style.json?key=${KEY}`
    : 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  streets: KEY
    ? `https://api.maptiler.com/maps/streets-v2/style.json?key=${KEY}`
    : 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  dark: KEY
    ? `https://api.maptiler.com/maps/dataviz-dark/style.json?key=${KEY}`
    : 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
}

// ── Colour helpers ─────────────────────────────────────────────────
const STATUS_COLOR: Record<string, string> = {
  SAFE:'#4ade80', WARNING:'#f59e0b', CRITICAL:'#f87171',
  AVAILABLE:'#4ade80', RESPONDING:'#f59e0b', RESCUING:'#f87171',
  TRANSPORTING:'#38bdf8', RETURNING:'#22d3ee', OFFLINE:'#6b7280',
}
const TYPE_COLOR: Record<string, string> = {
  URBAN_RESCUE:'#fb923c', MEDICAL:'#f87171', FIRE:'#f59e0b',
  POLICE:'#38bdf8', DRONE:'#e879f9', LOGISTICS:'#4ade80',
}
const sensorColor = (r: number) => r > 3.5 ? '#f87171' : r > 2 ? '#f59e0b' : '#22d3ee'

// ── Custom HTML marker helper ──────────────────────────────────────
function createMarkerEl(color: string, emoji: string, label: string): HTMLElement {
  const el = document.createElement('div')
  el.style.cssText = `
    width: 36px; height: 36px; border-radius: 50%;
    background: rgba(3,8,16,0.92);
    border: 2.5px solid ${color};
    box-shadow: 0 0 0 3px rgba(255,255,255,0.06), 0 3px 16px ${color}55;
    display: flex; align-items: center; justify-content: center;
    font-size: 16px; cursor: pointer;
    transition: transform 0.15s;
    animation: markerPulse 3s ease-in-out infinite;
  `
  el.title = label
  el.textContent = emoji
  el.onmouseenter = () => { el.style.transform = 'scale(1.25)'; el.style.animation = 'none' }
  el.onmouseleave = () => { el.style.transform = 'scale(1)'; el.style.animation = 'markerPulse 3s ease-in-out infinite' }
  return el
}

// ── Props ──────────────────────────────────────────────────────────
interface Props {
  onSelect:  (sel: MapSelection) => void
  layers?:   LayerFlags
  mapStyle?: MapStyle
}

// ── Component ──────────────────────────────────────────────────────
export function DisasterMapInner({ onSelect, layers = {}, mapStyle = 'satellite' }: Props) {
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

  const containerRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef       = useRef<any>(null)
  const markersRef   = useRef<unknown[]>([])
  const loadedRef    = useRef(false)

  // Load MapLibre GL from CDN, create map, add 3D buildings
  useEffect(() => {
    if (loadedRef.current) return
    if (!containerRef.current) return
    loadedRef.current = true

    const MAPLIBRE_VERSION = '4.7.1'
    const CSS_URL = `https://unpkg.com/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.css`
    const JS_URL  = `https://unpkg.com/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.js`

    // Inject CSS
    if (!document.getElementById('maplibre-css')) {
      const link = document.createElement('link')
      link.id = 'maplibre-css'; link.rel = 'stylesheet'; link.href = CSS_URL
      document.head.appendChild(link)
    }

    // Inject JS then initialise map
    function initMap() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ml = (window as any).maplibregl
      if (!ml || !containerRef.current) return

      const map = new ml.Map({
        container:        containerRef.current,
        style:            STYLES[mapStyle],
        center:           [78.9629, 21.5],
        zoom:             4.8,
        pitch:            45,          // tilt for 3D effect
        bearing:         -10,
        antialias:        true,        // smooth 3D buildings
        attributionControl:false,
      })

      mapRef.current = map

      // Attribution control (compact)
      map.addControl(new ml.AttributionControl({ compact: true }), 'bottom-right')
      map.addControl(new ml.NavigationControl({ showCompass: true }), 'bottom-right')
      map.addControl(new ml.ScaleControl({ unit: 'metric' }), 'bottom-left')

      map.on('load', () => {
        // ── 3D building extrusion ─────────────────────────────────
        // Only works when the style has a 'building' source (MapTiler streets/hybrid do)
        if (map.getLayer('building')) {
          map.addLayer({
            id:    '3d-buildings',
            source:'composite',
            'source-layer':'building',
            filter:['==', 'extrude', 'true'],
            type:  'fill-extrusion',
            minzoom: 10,
            paint: {
              'fill-extrusion-color': [
                'interpolate', ['linear'], ['get', 'height'],
                0, '#1e3a5f', 50, '#1a4a7a', 100, '#15589a',
              ],
              'fill-extrusion-height':['interpolate',['linear'],['zoom'],10,0,14,['get','height']],
              'fill-extrusion-base':  ['interpolate',['linear'],['zoom'],10,0,14,['get','min_height']],
              'fill-extrusion-opacity': 0.85,
            },
          })
        }

        // Try MapTiler building layer name
        if (map.getSource('openmaptiles')) {
          if (!map.getLayer('3d-buildings')) {
            map.addLayer({
              id:    '3d-buildings',
              source:'openmaptiles',
              'source-layer':'building',
              type:  'fill-extrusion',
              minzoom: 12,
              paint: {
                'fill-extrusion-color': '#1a4a7a',
                'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 10],
                'fill-extrusion-base':   ['coalesce', ['get', 'render_min_height'], 0],
                'fill-extrusion-opacity': 0.80,
              },
            })
          }
        }

        // ── Flood zones ───────────────────────────────────────────
        if (showFlood && floodZones.length > 0) {
          const geojson = {
            type:'FeatureCollection',
            features: floodZones.map(z => ({
              type:'Feature',
              properties:{ depth: z.waterDepth, severity: z.severity, name: z.name, affected: z.affectedPeople },
              geometry:{ type:'Polygon', coordinates:[z.coordinates] },
            })),
          }
          map.addSource('flood', { type:'geojson', data: geojson as never })
          map.addLayer({
            id:'flood-fill', type:'fill', source:'flood',
            paint:{
              'fill-color':['interpolate',['linear'],['get','depth'],0,'#023e8a',2,'#0096c7',4,'#48cae4'],
              'fill-opacity': Math.min(0.30 + (averageWaterLevel / 5) * 0.35, 0.65),
            },
          })
          map.addLayer({
            id:'flood-border', type:'line', source:'flood',
            paint:{ 'line-color':'#22d3ee', 'line-width':2.5, 'line-opacity':0.80 },
          })
          map.on('click', 'flood-fill', (e: never) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const f = (e as any).features?.[0]?.properties
            if (f) onSelect({ title: f.name, type:`FLOOD ZONE · ${f.severity}`, detail:`Depth: ${f.depth?.toFixed(1)}m · ${Number(f.affected).toLocaleString('en-IN')} affected`, color:'cyan' })
          })
        }

        // ── Evacuation routes ─────────────────────────────────────
        if (showRoutes && routes.length > 0) {
          const routeGeo = {
            type:'FeatureCollection',
            features: routes.filter(r => !r.isBlocked && r.type === 'EVACUATION').map(r => ({
              type:'Feature',
              properties:{ risk: r.riskLevel },
              geometry:{ type:'LineString', coordinates:[
                [r.fromCoords.lng, r.fromCoords.lat],
                ...r.waypoints.map(w => [w.lng, w.lat]),
                [r.toCoords.lng, r.toCoords.lat],
              ]},
            })),
          }
          map.addSource('routes', { type:'geojson', data: routeGeo as never })
          map.addLayer({
            id:'evac-routes', type:'line', source:'routes',
            paint:{
              'line-color':['match',['get','risk'],'LOW','#84cc16','MEDIUM','#f59e0b','HIGH','#f87171','#84cc16'],
              'line-width':4, 'line-opacity':0.90,
              'line-dasharray':[3, 2],
            },
          })
        }

        // ── HTML Markers (shelters, teams, sensors, waste) ────────
        const newMarkers: unknown[] = []
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ml2 = (window as any).maplibregl

        if (showShelt) {
          shelters.forEach(s => {
            const emoji = s.status === 'CRITICAL' ? '🔴' : s.status === 'WARNING' ? '🟡' : '🏠'
            const el = createMarkerEl(STATUS_COLOR[s.status] ?? '#38bdf8', emoji, s.name)
            const pct = Math.round((s.occupancy / s.capacity) * 100)
            el.onclick = () => onSelect({ title: s.name, type:`SHELTER · ${s.status}`, detail:`${s.sector} · ${pct}% full · Water ${s.waterLevel.toFixed(0)}% · Food ${s.foodLevel.toFixed(0)}%`, color:'shelter' })
            const m = new ml2.Marker({ element: el }).setLngLat([s.location.lng, s.location.lat]).addTo(map)
            newMarkers.push(m)
          })
        }

        if (showTeams) {
          rescueTeams.filter(t => t.status !== 'OFFLINE').forEach(t => {
            const emoji = { URBAN_RESCUE:'🚨', MEDICAL:'🏥', FIRE:'🔥', POLICE:'🚔', DRONE:'🚁', LOGISTICS:'🚛' }[t.type] ?? '🚨'
            const el = createMarkerEl(t.priority === 'CRITICAL' ? '#f87171' : TYPE_COLOR[t.type] ?? '#fb923c', emoji, t.name)
            el.onclick = () => onSelect({ title:`${t.id} — ${t.name}`, type:`${t.type.replace(/_/g,' ')} · ${t.status}`, detail:`${t.sector} · Mission: ${t.mission ?? 'None'} · Battery ${t.battery.toFixed(0)}%`, color:'rescue' })
            const m = new ml2.Marker({ element: el }).setLngLat([t.location.lng, t.location.lat]).addTo(map)
            newMarkers.push(m)
          })
        }

        if (showVeh) {
          vehicles.filter(v => v.status !== 'AVAILABLE').forEach(v => {
            const el = createMarkerEl('#4ade80', '🚚', v.name)
            el.onclick = () => onSelect({ title: v.name, type:`${v.type} · ${v.status}`, detail:`${v.sector} · Cargo: ${v.cargo.join(', ') || 'Empty'} · Fuel ${v.fuelLevel}%`, color:'supply' })
            const m = new ml2.Marker({ element: el }).setLngLat([v.location.lng, v.location.lat]).addTo(map)
            newMarkers.push(m)
          })
        }

        if (showSens) {
          sensors.filter(s => s.type === 'WATER_LEVEL').forEach(s => {
            const color = sensorColor(s.reading)
            const emoji = s.reading > 3.5 ? '🌊' : s.reading > 2 ? '💧' : '📡'
            const el = createMarkerEl(color, emoji, s.name)
            el.onclick = () => onSelect({ title: s.name, type:'WATER SENSOR', detail:`${s.reading.toFixed(2)} ${s.unit} · ${s.trend} · Battery ${s.battery.toFixed(0)}%`, color: s.reading > 2.5 ? 'critical' : 'cyan' })
            const m = new ml2.Marker({ element: el }).setLngLat([s.location.lng, s.location.lat]).addTo(map)
            newMarkers.push(m)
          })
        }

        if (showWaste) {
          wasteZones.forEach(z => {
            const el = createMarkerEl('#fbbf24', '⚠️', z.description)
            el.onclick = () => onSelect({ title: z.type.replace(/_/g,' '), type:'HAZARD ZONE', detail:`${z.description} · ${z.severity}`, color:'warning' })
            const m = new ml2.Marker({ element: el }).setLngLat([z.location.lng, z.location.lat]).addTo(map)
            newMarkers.push(m)
          })
        }

        markersRef.current = newMarkers
        map.getCanvas().style.cursor = ''
      })
    }

    if ((window as never as Record<string, unknown>)['maplibregl']) {
      initMap()
    } else {
      const script = document.createElement('script')
      script.src  = JS_URL
      script.async = true
      script.onload = initMap
      document.head.appendChild(script)
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
        loadedRef.current = false
      }
    }
  // Run once on mount — map style changes handled separately
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Update map style when prop changes
  useEffect(() => {
    if (!mapRef.current) return
    mapRef.current.setStyle(STYLES[mapStyle])
  }, [mapStyle])

  return (
    <div className="map-wrap" style={{ position:'relative', width:'100%', height:'100%' }}>

      {/* Map container — MapLibre renders into this div */}
      <div ref={containerRef} style={{ width:'100%', height:'100%' }} />

      {/* Scanlines overlay — decorative, pointer-events: none */}
      <div className="map-scanlines" />

      {/* Top-left badge */}
      <div className="map-badge" style={{ pointerEvents:'none' }}>
        <span className="tag" style={{ color:'#67e8f9', fontWeight:700 }}>MyRadar</span>
        <span className="tag" style={{ color:'rgba(255,255,255,0.25)' }}>·</span>
        <span className="tag" style={{ color:'rgba(255,255,255,0.65)' }}>India · 3D Operational View</span>
        <span className="tag" style={{ color:'rgba(255,255,255,0.25)' }}>·</span>
        <span className="tag" style={{ color:'rgba(255,255,255,0.45)' }}>
          avg <span style={{ color:'#22d3ee', fontWeight:700 }}>{averageWaterLevel.toFixed(1)}m</span>
        </span>
      </div>

      {/* Bottom-right hint */}
      <div className="tag hidden lg:block" style={{ position:'absolute', bottom:40, right:16, zIndex:10, pointerEvents:'none', color:'rgba(255,255,255,0.25)' }}>
        Hold Ctrl + drag to rotate · Scroll to zoom
      </div>
    </div>
  )
}
