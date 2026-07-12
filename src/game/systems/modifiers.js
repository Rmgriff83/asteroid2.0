// Aggregates owned perk/upgrade tiers into one stats object. Gameplay code
// only ever reads this object — perks/upgrades never leak into object logic.
// Ship feel parameters live here as data: they are upgrade targets, not code
// constants (handoff §10).
import { PERKS } from '../data/perks'
import { UPGRADES } from '../data/upgrades'

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
}

export function getModifiers(perkLevels) {
  const stats = { ...DEFAULT_STATS }
  const adds = []
  const muls = []
  for (const def of [...PERKS, ...UPGRADES]) {
    const level = perkLevels?.[def.id] || 0
    for (let t = 0; t < Math.min(level, def.tiers.length); t++) {
      for (const effect of def.tiers[t].effects) {
        ;(effect.op === 'mul' ? muls : adds).push(effect)
      }
    }
  }
  // adds before muls so the result is independent of purchase order
  for (const e of adds) stats[e.stat] += e.value
  for (const e of muls) stats[e.stat] *= e.value

  stats.destroyFraction = Math.min(stats.destroyFraction, 0.85)
  stats.splitCountMin = Math.max(1, Math.round(stats.splitCountMin))
  stats.splitCountMax = Math.max(stats.splitCountMin, Math.round(stats.splitCountMax))
  return stats
}
