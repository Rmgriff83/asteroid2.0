// Establishing a planetary base — shared by the in-flight ESTABLISH action
// (UIScene → GameScene) and anything else that ever needs it. The purchase
// happens from the SHIP, before landing: the base interior always opens on
// an existing base. Costs cargo resources, not credits.
import { playerStore } from '../../stores/playerStore'
import { addPermanentKey } from './WorldDiffs'
import { syncSiloNotifications } from '../../services/notifications'

export const BUILD_COST = { ferrite: 15, silicate: 8 }
export const RATE_PER_HOUR = 6
export const CAPACITY = 24

export function canAffordBase() {
  return Object.entries(BUILD_COST).every(
    ([type, qty]) => (playerStore.cargo[type] || 0) >= qty
  )
}

// spends the cargo cost and creates the base record; returns it (or null)
export function establishBase(panelKey, resourceType) {
  if (!canAffordBase()) return null
  if (playerStore.bases.some((b) => b.panelKey === panelKey)) return null
  for (const [type, qty] of Object.entries(BUILD_COST)) {
    playerStore.cargo[type] -= qty
  }
  const id = `base:${panelKey}`
  const base = {
    id,
    panelKey,
    resourceType,
    ratePerHour: RATE_PER_HOUR,
    capacity: CAPACITY,
    lastCollected: Date.now(),
    trinkets: {}, // per-base decoration placements
  }
  playerStore.bases.push(base)
  playerStore.unlockedNodes.push(id) // bases are fast-travel nodes
  addPermanentKey(panelKey) // base panels never evict
  playerStore.save()
  syncSiloNotifications(playerStore.bases)
  return base
}
