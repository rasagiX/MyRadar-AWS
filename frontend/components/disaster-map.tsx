'use client'

import { useEffect, useMemo, useState } from 'react'
import Map, { Layer, Marker, NavigationControl, Source, type MapLayerMouseEvent } from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'
import { Crosshair, Droplets, LocateFixed, ShieldAlert, Truck } from 'lucide-react'

export type MapSelection = { title: string; type: string; detail: string; color: string }

const floodZones = {
  type: 'FeatureCollection' as const,
  features: [
    { type: 'Feature' as const, properties: {}, geometry: { type: 'Polygon' as const, coordinates: [[[-74.021, 40.704], [-74.004, 40.707], [-74.003, 40.718], [-74.019, 40.722], [-74.021, 40.704]]] } },
    { type: 'Feature' as const, properties: {}, geometry: { type: 'Polygon' as const, coordinates: [[[-74.014, 40.728], [-73.994, 40.729], [-73.994, 40.739], [-74.012, 40.741], [-74.014, 40.728]]] } },
  ],
}

const route = { type: 'Feature' as const, properties: {}, geometry: { type: 'LineString' as const, coordinates: [[-74.014, 40.715], [-74.009, 40.721], [-74.002, 40.726], [-73.997, 40.735]] } }

const markers = [
  { id: 'zone-4', lng: -74.013, lat: 40.714, tone: 'critical', icon: Droplets, title: 'FLOOD ZONE', detail: 'Water Level 1.8m · 4,820 affected' },
  { id: 'team-r07', lng: -74.004, lat: 40.722, tone: 'rescue', icon: ShieldAlert, title: 'RESCUE TEAM R-07', detail: 'Zone 3 · Active response' },
  { id: 'supply', lng: -73.998, lat: 40.735, tone: 'supply', icon: Truck, title: 'SUPPLY CENTER', detail: 'Warehouse B · 82% stocked' },
  { id: 'shelter', lng: -74.008, lat: 40.729, tone: 'shelter', icon: Crosshair, title: 'CENTRAL SHELTER', detail: 'Capacity 68% · 1,240 spaces' },
]

export function DisasterMap({ onSelect }: { onSelect: (selection: MapSelection) => void }) {
  const [time, setTime] = useState(0)
  useEffect(() => { const id = window.setInterval(() => setTime((value) => value + 1), 1800); return () => window.clearInterval(id) }, [])
  const waterOpacity = 0.25 + (time % 3) * 0.035
  const mapStyle = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
  const floodLayer = useMemo(() => ({ id: 'flood-fill', type: 'fill' as const, paint: { 'fill-color': '#00a9c7', 'fill-opacity': waterOpacity, 'fill-outline-color': '#20d7e7' } }), [waterOpacity])
  const routeLayer = { id: 'evacuation-route', type: 'line' as const, paint: { 'line-color': '#d9fb66', 'line-width': 3, 'line-opacity': 0.9, 'line-dasharray': [1, 1.4] } }
  const handleMapClick = (event: MapLayerMouseEvent) => { if (!event.features?.length) onSelect({ title: 'OPERATIONAL GRID', type: 'MAP LOCATION', detail: 'Select a marker or zone to inspect live intelligence.', color: 'cyan' }) }
  return (
    <div className="relative h-full min-h-[520px] overflow-hidden bg-[#07151b]">
      <Map initialViewState={{ longitude: -74.007, latitude: 40.724, zoom: 13.6, pitch: 52, bearing: -16 }} mapStyle={mapStyle} onClick={handleMapClick} interactiveLayerIds={['flood-fill']} attributionControl={false}>
        <NavigationControl position="bottom-right" showCompass={true} showZoom={true} />
        <Source id="flood" type="geojson" data={floodZones}><Layer {...floodLayer} /></Source>
        <Source id="route" type="geojson" data={route}><Layer {...routeLayer} /></Source>
        {markers.map(({ id, lng, lat, tone, icon: Icon, title, detail }) => (
          <Marker key={id} longitude={lng} latitude={lat} anchor="center" onClick={(event) => { event.originalEvent.stopPropagation(); onSelect({ title, type: tone === 'critical' ? 'FLOOD ZONE' : 'LIVE ASSET', detail, color: tone }) }}>
            <button aria-label={title} className={`map-marker marker-${tone}`}><Icon size={15} strokeWidth={2.5} /></button>
          </Marker>
        ))}
      </Map>
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(42,214,230,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(42,214,230,0.04)_1px,transparent_1px)] bg-[size:48px_48px] mix-blend-screen" />
      <div className="absolute left-5 top-5 flex items-center gap-2 border border-cyan-400/20 bg-[#061219]/85 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-cyan-200 backdrop-blur"><LocateFixed size={13} /> Live operational map <span className="text-white/30">//</span> 3D terrain</div>
      <div className="absolute bottom-5 left-5 flex flex-wrap gap-3 border border-white/10 bg-[#061219]/90 px-3 py-2 font-mono text-[9px] uppercase tracking-wider text-white/65 backdrop-blur"><span><i className="legend-dot bg-red-400" />Critical</span><span><i className="legend-dot bg-orange-400" />Rescue</span><span><i className="legend-dot bg-lime-300" />Evacuation</span><span><i className="legend-dot bg-cyan-300" />Shelter</span></div>
    </div>
  )
}

export function MapDetail({ selection, onClose }: { selection: MapSelection | null; onClose: () => void }) {
  if (!selection) return null
  return <div className="map-detail absolute bottom-20 left-5 z-10 w-[min(300px,calc(100%-40px))] border border-cyan-300/30 bg-[#071820]/95 p-4 shadow-2xl backdrop-blur-xl"><div className="mb-4 flex items-start justify-between"><div><p className="font-mono text-[9px] uppercase tracking-[0.2em] text-cyan-300">Selected intelligence</p><h3 className="mt-1 text-sm font-semibold tracking-wide text-white">{selection.title}</h3></div><button onClick={onClose} className="text-white/40 hover:text-white" aria-label="Close details">×</button></div><p className="font-mono text-[10px] uppercase tracking-wider text-white/45">{selection.type}</p><p className="mt-2 text-xs leading-relaxed text-white/75">{selection.detail}</p><div className="mt-4 h-1 bg-white/10"><div className="h-full w-3/4 bg-cyan-300" /></div><p className="mt-2 font-mono text-[9px] uppercase tracking-widest text-cyan-200">Telemetry synced · 04 sec ago</p></div>
}

export const mapAssets = markers
export { route }

// Map provider is intentionally isolated here so Amazon Location Service can replace MapLibre without changing panels.
// AWS service contracts belong in /services/aws when live telemetry is connected.
export function MapLegend() { return null }
