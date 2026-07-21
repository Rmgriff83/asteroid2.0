// Store-aware stats lookup: the one-liner every screen and scene uses.
// (modifiers.getShipStats stays pure; this module owns the playerStore read
// so there is no playerStore ↔ modifiers import cycle.)
import { playerStore } from '../../stores/playerStore'
import { getShip } from '../data/ships'
import { getShipStats } from './modifiers'

export function shipStats(shipId = playerStore.selectedShip) {
  return getShipStats(getShip(shipId), {
    parts: playerStore.shipParts[shipId],
    augmentIds: playerStore.shipAugments[shipId],
  })
}
