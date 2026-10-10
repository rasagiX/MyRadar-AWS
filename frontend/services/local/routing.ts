/**
 * Local routing engine — runs entirely in the browser with no network.
 * Uses a weighted graph + Dijkstra to find safe evacuation routes.
 *
 * Graph nodes  = GeoPoints (lat/lng)
 * Graph edges  = Road segments, weighted by risk/flood status
 */

import type { Road, GeoPoint, Route, RiskLevel } from '@/types/disaster'

// ─── Cost weights ─────────────────────────────────────────────────────────────
const ROAD_COST: Record<string, number> = {
  CLEAR: 1,
  CONGESTED: 3,
  BLOCKED: 999,
  FLOODED: 999,
  CLOSED: 999,
}

const RISK_COST: Record<RiskLevel, number> = {
  LOW: 0,
  MEDIUM: 2,
  HIGH: 5,
  CRITICAL: 20,
}

interface GraphNode {
  id: string
  point: GeoPoint
}

interface GraphEdge {
  from: string
  to: string
  cost: number
  road: Road
}

function nodeId(p: GeoPoint): string {
  return `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`
}

function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const sin1 = Math.sin(dLat / 2)
  const sin2 = Math.sin(dLng / 2)
  const aa = sin1 * sin1 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * sin2 * sin2
  return R * 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa))
}

function buildGraph(roads: Road[]): { nodes: Map<string, GraphNode>; edges: Map<string, GraphEdge[]> } {
  const nodes = new Map<string, GraphNode>()
  const edges = new Map<string, GraphEdge[]>()

  for (const road of roads) {
    const fromId = nodeId(road.from)
    const toId = nodeId(road.to)

    nodes.set(fromId, { id: fromId, point: road.from })
    nodes.set(toId, { id: toId, point: road.to })

    const baseCost = ROAD_COST[road.status] ?? 1
    const riskCost = RISK_COST[road.riskLevel] ?? 0
    const dist = haversineKm(road.from, road.to)
    const cost = (baseCost + riskCost) * dist

    // bidirectional edges
    for (const [fId, tId] of [[fromId, toId], [toId, fromId]]) {
      const existing = edges.get(fId) ?? []
      existing.push({ from: fId, to: tId, cost, road })
      edges.set(fId, existing)
    }
  }

  return { nodes, edges }
}

/** Dijkstra — returns ordered node IDs or null if no path found */
function dijkstra(
  startId: string,
  endId: string,
  edges: Map<string, GraphEdge[]>,
): string[] | null {
  const dist = new Map<string, number>()
  const prev = new Map<string, string>()
  const visited = new Set<string>()
  const queue: Array<{ id: string; cost: number }> = []

  dist.set(startId, 0)
  queue.push({ id: startId, cost: 0 })

  while (queue.length > 0) {
    // Simple priority pop (small enough for ~50 nodes)
    queue.sort((a, b) => a.cost - b.cost)
    const { id: current } = queue.shift()!

    if (visited.has(current)) continue
    visited.add(current)
    if (current === endId) break

    const neighbors = edges.get(current) ?? []
    for (const edge of neighbors) {
      if (visited.has(edge.to)) continue
      const newCost = (dist.get(current) ?? Infinity) + edge.cost
      if (newCost < (dist.get(edge.to) ?? Infinity)) {
        dist.set(edge.to, newCost)
        prev.set(edge.to, current)
        queue.push({ id: edge.to, cost: newCost })
      }
    }
  }

  if (!dist.has(endId) || dist.get(endId) === Infinity) return null

  // Reconstruct path
  const path: string[] = []
  let current: string | undefined = endId
  while (current) {
    path.unshift(current)
    current = prev.get(current)
  }
  return path
}

/** Find nearest node in the graph to a given geo-point */
function nearestNode(
  point: GeoPoint,
  nodes: Map<string, GraphNode>,
): string {
  let bestId = ''
  let bestDist = Infinity
  for (const [id, node] of nodes) {
    const d = haversineKm(point, node.point)
    if (d < bestDist) { bestDist = d; bestId = id }
  }
  return bestId
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function calculateLocalRoute(
  from: GeoPoint,
  to: GeoPoint,
  roads: Road[],
  type: Route['type'] = 'EVACUATION',
): Route | null {
  const { nodes, edges } = buildGraph(roads)
  if (nodes.size === 0) return null

  const startId = nearestNode(from, nodes)
  const endId = nearestNode(to, nodes)
  if (!startId || !endId || startId === endId) return null

  const pathIds = dijkstra(startId, endId, edges)
  if (!pathIds) return null

  const waypoints = pathIds
    .slice(1, -1)
    .map(id => nodes.get(id)!.point)

  let totalDist = 0
  for (let i = 0; i < pathIds.length - 1; i++) {
    const a = nodes.get(pathIds[i])!.point
    const b = nodes.get(pathIds[i + 1])!.point
    totalDist += haversineKm(a, b)
  }

  // Determine route risk from constituent roads
  const routeEdges = edges.get(startId) ?? []
  const maxRisk = routeEdges.reduce<RiskLevel>((worst, e) => {
    const order: RiskLevel[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
    return order.indexOf(e.road.riskLevel) > order.indexOf(worst) ? e.road.riskLevel : worst
  }, 'LOW')

  return {
    id: `LOCAL-${Date.now()}`,
    from: 'Origin',
    to: 'Destination',
    fromCoords: from,
    toCoords: to,
    waypoints,
    distance: parseFloat(totalDist.toFixed(2)),
    etaMinutes: Math.round((totalDist / 40) * 60), // assume 40 km/h avg
    riskLevel: maxRisk,
    type,
    isBlocked: false,
  }
}

/** Score a route — lower is safer */
export function scoreRoute(route: Route, roads: Road[]): number {
  const riskOrder: Record<RiskLevel, number> = { LOW: 0, MEDIUM: 1, HIGH: 3, CRITICAL: 10 }
  let score = route.distance * 0.5 + route.etaMinutes * 0.3
  score += riskOrder[route.riskLevel] * 2
  if (route.isBlocked) score += 1000
  return parseFloat(score.toFixed(2))
}
