// Delivery/courier mission generation (handoff §13, v1 scope: deliveries only).
// Offers are seeded per (station, dayIndex) so they rotate daily but are
// stable within a day. Destinations are REAL seed-generated stations found by
// deterministic ray-walk — they always exist when the player arrives.
import { hash32 } from '../utils/rng'
import { mulberry32 } from '../utils/rng'
import { generatePanel } from '../galaxy/panelGen'
import { RESOURCES } from './resources'

const COMMON = ['ferrite', 'silicate', 'ice']

// walk a deterministic ray from the origin until another station appears
function findDestination(galaxySeed, fromPx, fromPy, rng, authored) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const ang = rng() * Math.PI * 2
    const dirX = Math.cos(ang)
    const dirY = Math.sin(ang)
    for (let d = 40; d < 220; d += 2) {
      for (const side of [0, 2, -2]) {
        const px = Math.round(fromPx + dirX * d - dirY * side)
        const py = Math.round(fromPy + dirY * d + dirX * side)
        if (px === fromPx && py === fromPy) continue
        const spec = generatePanel(galaxySeed, px, py, authored)
        if (spec.station) {
          return { stationId: spec.station.id, name: spec.station.name, px, py }
        }
      }
    }
  }
  return null
}

export function generateOffers(galaxySeed, station, originPx, originPy, authored) {
  const dayIndex = Math.floor(Date.now() / 86400000)
  const seed = hash32(hash32(galaxySeed, hash32(originPx, originPy)), dayIndex)
  const rng = mulberry32(seed)
  const offers = []
  const count = 2 + Math.floor(rng() * 2)
  for (let i = 0; i < count; i++) {
    const dest = findDestination(galaxySeed, originPx, originPy, rng, authored)
    if (!dest) continue
    const resource = COMMON[Math.floor(rng() * COMMON.length)]
    const qty = 30 + Math.floor(rng() * 70) // inventory-scale quantities
    const dist = Math.hypot(dest.px - originPx, dest.py - originPy)
    const kind = rng() < 0.6 ? 'courier' : 'supply'
    const reward = Math.round(qty * (RESOURCES[resource]?.price ?? 2) * 2 + dist * 0.8)
    offers.push({
      id: `m:${seed}:${i}`,
      kind, // courier = goods provided at origin; supply = bring your own
      resource,
      qty,
      from: { stationId: station.id, name: station.name, px: originPx, py: originPy },
      to: dest,
      reward,
    })
  }
  return offers
}
