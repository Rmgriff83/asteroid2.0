// Ship PARTS: per-ship installable upgrades, bought in the hangar and stored
// in playerStore.shipParts[shipId] = { partId: ownedTier }. Same declarative
// declarative tier/effect schema, aggregated per ship in
// systems/modifiers.getShipStats.
//
// The first five re-export the legacy global UPGRADES verbatim (same ids,
// tiers, costs) — playerStore.load() migrates old perk purchases onto the
// selected ship by moving those ids out of the legacy perk map into `shipParts`.
import { UPGRADES } from './upgrades'

export const PARTS = [
  ...UPGRADES, // engine / gyros / tank / hold / plating
  {
    id: 'shield',
    name: 'SHIELD EMITTER',
    desc: 'Absorbs hits before the hull — recharge at stations only',
    tiers: [
      { cost: 200, effects: [{ stat: 'shieldsMax', op: 'add', value: 1 }] },
      { cost: 550, effects: [{ stat: 'shieldsMax', op: 'add', value: 1 }] },
    ],
  },
]

// legacy global-upgrade ids (migration + store filtering)
export const LEGACY_PART_IDS = UPGRADES.map((u) => u.id)

export function getPart(id) {
  return PARTS.find((p) => p.id === id) || null
}
