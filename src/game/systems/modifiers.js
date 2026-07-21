// Aggregates a ship's full loadout into one stats object. Gameplay code only
// ever reads this object — parts/augments never leak into object logic.
// Ship feel parameters live here as data: they are upgrade targets, not code
// constants (handoff §10).
//
// Layering (adds before muls within each source, so purchase order never
// matters): DEFAULT_STATS → ship base stats → per-ship PARTS tiers →
// equipped AUGMENT boosts → `handling` applied LAST as a feel multiplier
// on turn/thrust/drag (so parts stay ship-relative).
//
// This module stays PURE (no store imports — playerStore imports it).
// Store-aware convenience lives in systems/shipStats.js.
import { PARTS } from '../data/parts'
import { getAugment } from '../data/augments'

export const DEFAULT_STATS = {
  // blaster
  destroyFraction: 0.15, // share of asteroid mass vaporized per hit
  splitCountMin: 2,
  splitCountMax: 4,
  childSizeBias: 1.0, // >1 = chunkier children
  fireRate: 3, // shots per second
  bulletSpeed: 420,
  bulletLife: 1.1, // seconds (~460px range in the 1280×800 panel)

  // ship feel (the four core feel params + boost)
  drag: 0.8, // damping factor per second — LIGHT drag, tune by playtest
  turnRate: 4.5, // rad/s
  thrust: 380, // px/s^2
  maxSpeed: 340,
  boostMult: 2.6,
  boostMaxSpeed: 620,

  // survival / logistics
  hullMax: 3,
  fuelMax: 40,
  massMax: 200, // cargo mass capacity (MU)
  mineYield: 1, // pickup multiplier

  // hull-dependent (seeded from the ship def)
  shieldsMax: 0, // hits absorbed before hull — repair-only
  seats: 0, // passenger berths (future passenger missions)
  handling: 1, // feel multiplier: turn/thrust/drag
}

// loadout = { parts, augmentIds } — every field optional
export function getShipStats(shipDef, { parts, augmentIds } = {}) {
  const stats = { ...DEFAULT_STATS }
  stats.shieldsMax += shipDef?.shieldsMax ?? 0
  stats.seats += shipDef?.seats ?? 0
  stats.handling = shipDef?.handling ?? 1
  // per-ship base spreads (class identity): additive deltas over defaults,
  // applied before any loadout so parts stay relative
  for (const [stat, delta] of Object.entries(shipDef?.stats ?? {})) {
    stats[stat] += delta
  }

  const adds = []
  const muls = []
  const collect = (effects) => {
    for (const effect of effects) {
      ;(effect.op === 'mul' ? muls : adds).push(effect)
    }
  }
  for (const def of PARTS) {
    const level = parts?.[def.id] || 0
    for (let t = 0; t < Math.min(level, def.tiers.length); t++) collect(def.tiers[t].effects)
  }
  for (const id of augmentIds || []) {
    const aug = getAugment(id)
    if (aug) collect(aug.boosts)
  }
  // adds before muls so the result is independent of purchase order
  for (const e of adds) stats[e.stat] += e.value
  for (const e of muls) stats[e.stat] *= e.value

  // handling shapes FEEL last: nimble hulls turn, accelerate, and stop
  // faster; heavy haulers drift
  stats.turnRate *= stats.handling
  stats.thrust *= stats.handling
  stats.drag *= stats.handling

  stats.destroyFraction = Math.min(stats.destroyFraction, 0.85)
  stats.splitCountMin = Math.max(1, Math.round(stats.splitCountMin))
  stats.splitCountMax = Math.max(stats.splitCountMin, Math.round(stats.splitCountMax))
  return stats
}
