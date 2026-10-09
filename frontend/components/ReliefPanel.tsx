'use client'

import { useDisasterState } from '@/store/disasterStore'
import { Truck, Package, AlertTriangle, ChevronRight, CheckCircle } from 'lucide-react'
import type { Shelter, ReliefRequest } from '@/types/disaster'

function SupplyBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="flex justify-between mb-0.5">
        <span className="font-mono text-[7px] uppercase tracking-wider text-white/30">{label}</span>
        <span className={`font-mono text-[8px] ${value < 25 ? 'text-red-300' : value < 50 ? 'text-amber-300' : 'text-white/60'}`}>
          {value.toFixed(0)}%
        </span>
      </div>
      <div className="h-1 bg-white/10 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  )
}

function ShelterCard({ shelter }: { shelter: Shelter }) {
  const pct = Math.round((shelter.occupancy / shelter.capacity) * 100)
  const needs: string[] = []
  if (shelter.waterLevel < 30) needs.push('Water')
  if (shelter.foodLevel < 30) needs.push('Food')
  if (shelter.medicineLevel < 30) needs.push('Medicine')

  return (
    <div className={`border p-3 ${shelter.status === 'CRITICAL' ? 'border-red-400/25 bg-red-400/[0.03]' : shelter.status === 'WARNING' ? 'border-amber-400/20 bg-amber-400/[0.02]' : 'border-white/8'}`}>
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="font-mono text-[9px] text-white/70">{shelter.id} · {shelter.name}</p>
          <p className="font-mono text-[8px] text-white/30">{shelter.sector}</p>
        </div>
        <div className="text-right">
          <span className={`font-mono text-[8px] uppercase ${shelter.status === 'CRITICAL' ? 'text-red-300' : shelter.status === 'WARNING' ? 'text-amber-300' : 'text-lime-300'}`}>
            {shelter.status}
          </span>
          <p className="font-mono text-[8px] text-white/30 mt-0.5">{shelter.occupancy}/{shelter.capacity}</p>
        </div>
      </div>

      {/* Occupancy bar */}
      <div className="h-1.5 bg-white/8 rounded-full overflow-hidden mb-2">
        <div
          className={`h-full rounded-full ${pct > 90 ? 'bg-red-400' : pct > 75 ? 'bg-amber-400' : 'bg-lime-400'}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flex flex-col gap-1">
        <SupplyBar label="Water" value={shelter.waterLevel} color={shelter.waterLevel < 25 ? 'bg-red-400' : shelter.waterLevel < 50 ? 'bg-amber-400' : 'bg-cyan-400'} />
        <SupplyBar label="Food" value={shelter.foodLevel} color={shelter.foodLevel < 25 ? 'bg-red-400' : shelter.foodLevel < 50 ? 'bg-amber-400' : 'bg-lime-400'} />
        <SupplyBar label="Medicine" value={shelter.medicineLevel} color={shelter.medicineLevel < 25 ? 'bg-red-400' : shelter.medicineLevel < 50 ? 'bg-amber-400' : 'bg-purple-400'} />
      </div>

      {needs.length > 0 && (
        <div className="mt-2 flex items-center gap-1.5 border-t border-white/5 pt-2">
          <AlertTriangle size={9} className="text-red-400 shrink-0" />
          <span className="font-mono text-[8px] text-red-300">Needs: {needs.join(', ')}</span>
        </div>
      )}
    </div>
  )
}

const STATUS_CONFIG: Record<ReliefRequest['status'], { label: string; color: string }> = {
  PENDING:    { label: 'PENDING',    color: 'text-white/40 border-white/15' },
  ASSIGNED:   { label: 'ASSIGNED',  color: 'text-amber-300 border-amber-400/25' },
  EN_ROUTE:   { label: 'EN ROUTE',  color: 'text-cyan-300 border-cyan-400/25' },
  DELIVERED:  { label: 'DELIVERED', color: 'text-lime-300 border-lime-400/25' },
}

function ReliefRequestCard({ req }: { req: ReliefRequest }) {
  const sc = STATUS_CONFIG[req.status]
  const prioColor = req.priority === 'CRITICAL' ? 'text-red-300' : req.priority === 'HIGH' ? 'text-amber-300' : 'text-white/50'
  return (
    <div className="border border-white/8 p-3">
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="font-mono text-[9px] text-white/70">{req.targetName}</p>
          <p className={`font-mono text-[8px] ${prioColor}`}>Priority: {req.priority}</p>
        </div>
        <span className={`font-mono text-[7px] uppercase tracking-wider border px-1.5 py-0.5 ${sc.color}`}>
          {sc.label}
        </span>
      </div>
      <div className="flex flex-wrap gap-1 mb-2">
        {req.required.map(item => (
          <span key={item} className="px-1.5 py-0.5 border border-white/10 font-mono text-[7px] text-white/50">
            {item}
          </span>
        ))}
      </div>
      {req.assignedVehicle && (
        <div className="flex items-center gap-1.5 font-mono text-[8px] text-lime-300">
          <Truck size={9} />
          {req.assignedVehicle}
          {req.estimatedArrival && <span className="text-white/30">· ETA {req.estimatedArrival}</span>}
        </div>
      )}
    </div>
  )
}

export function ReliefPanel() {
  const { shelters, reliefRequests, vehicles, supplyCenters } = useDisasterState()

  const criticalShelters = shelters.filter(s => s.status === 'CRITICAL')
  const warningShelters = safeShelters(shelters)
  const available = vehicles.filter(v => v.type === 'RELIEF' && v.status === 'AVAILABLE')

  const nextDelivery = reliefRequests.find(r => r.status === 'PENDING') ??
    reliefRequests.find(r => r.status === 'ASSIGNED')

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/8 shrink-0">
        <div className="flex items-center gap-2">
          <Truck size={13} className="text-white/40" />
          <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/60">ReliefRoute</span>
        </div>
        <div className="flex items-center gap-2 font-mono text-[8px]">
          <span className="text-lime-300">{available.length} vehicles free</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {/* Next recommended delivery */}
        {nextDelivery && (
          <div className="border border-cyan-400/20 bg-cyan-400/[0.03] p-3">
            <p className="font-mono text-[8px] uppercase tracking-wider text-cyan-300 mb-2">
              ▶ Next Recommended Delivery
            </p>
            <div className="flex items-center justify-between mb-1">
              <span className="font-mono text-[10px] text-white/80">{nextDelivery.targetName}</span>
              <span className="font-mono text-[8px] text-red-300">{nextDelivery.priority}</span>
            </div>
            <div className="flex flex-wrap gap-1 mb-2">
              {nextDelivery.required.map(item => (
                <span key={item} className="flex items-center gap-1 border border-cyan-400/25 px-1.5 py-0.5 font-mono text-[7px] text-cyan-300">
                  <Package size={8} />{item}
                </span>
              ))}
            </div>
            {available.length > 0 && (
              <div className="flex items-center gap-1.5 font-mono text-[8px] text-lime-300">
                <CheckCircle size={9} />
                Assign: {available[0].id} — {available[0].name}
              </div>
            )}
          </div>
        )}

        {/* Supply centers */}
        <div>
          <p className="font-mono text-[9px] uppercase tracking-wider text-white/40 mb-2">Supply Centers</p>
          {supplyCenters.map(sc => (
            <div key={sc.id} className="border border-white/8 p-2.5 mb-1.5">
              <div className="flex justify-between mb-1">
                <span className="font-mono text-[9px] text-white/70">{sc.name}</span>
                <span className={`font-mono text-[8px] ${sc.status === 'OPERATIONAL' ? 'text-lime-300' : sc.status === 'LOW_STOCK' ? 'text-amber-300' : 'text-red-300'}`}>
                  {sc.status}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1 font-mono text-[7px] text-white/40">
                <span>Water {(sc.inventory.water / 1000).toFixed(0)}kL</span>
                <span>Food {sc.inventory.food}kg</span>
                <span>Med {sc.inventory.medicine}u</span>
              </div>
            </div>
          ))}
        </div>

        {/* Active relief requests */}
        <div>
          <p className="font-mono text-[9px] uppercase tracking-wider text-white/40 mb-2">
            Relief Requests ({reliefRequests.length})
          </p>
          {reliefRequests.map(r => (
            <div key={r.id} className="mb-1.5">
              <ReliefRequestCard req={r} />
            </div>
          ))}
        </div>

        {/* All shelters */}
        <div>
          <p className="font-mono text-[9px] uppercase tracking-wider text-white/40 mb-2">
            Shelter Status
            {criticalShelters.length > 0 && (
              <span className="ml-2 text-red-300">{criticalShelters.length} CRITICAL</span>
            )}
          </p>
          {[...criticalShelters, ...warningShelters].map(s => (
            <div key={s.id} className="mb-2">
              <ShelterCard shelter={s} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function safeShelters(shelters: Shelter[]) {
  return shelters.filter(s => s.status !== 'CRITICAL').sort((a, b) => {
    const scoreA = a.waterLevel + a.foodLevel + a.medicineLevel
    const scoreB = b.waterLevel + b.foodLevel + b.medicineLevel
    return scoreA - scoreB
  })
}
