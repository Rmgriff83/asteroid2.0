<script setup>
// THE HANGAR: the full ship editor. Big live preview (augmentations shown),
// ship buying/selection, per-ship PARTS with tier pips, AUGMENT equip cards
// (higher tiers blueprint-gated — found in the fringe), and the paint panel.
// Editing operates on the VIEWED ship, which may differ from the flown one.
import { computed, ref } from 'vue'
import { playerStore } from '../stores/playerStore'
import { EventBus } from '../game/EventBus'
import { SHIPS, getShip, SHIP_CLASSES } from '../game/data/ships'
import { PARTS } from '../game/data/parts'
import { AUGMENTS, augmentStrokes } from '../game/data/augments'
import { getShipStats } from '../game/systems/modifiers'
import ShipPreview from './ShipPreview.vue'
import ShipTintPanel from './ShipTintPanel.vue'

const viewedId = ref(playerStore.selectedShip)
const viewedShip = computed(() => getShip(viewedId.value))
const viewedOwned = computed(() => playerStore.ownedShips.includes(viewedId.value))

function back() {
  playerStore.screen = playerStore.hangarReturnsTo === 'game' ? 'game' : 'menu'
  // returning to game keeps paused=true so the pause overlay reappears
}

// ---- ships ----
function shipState(ship) {
  if (playerStore.selectedShip === ship.id) return 'selected'
  if (playerStore.ownedShips.includes(ship.id)) return 'owned'
  return 'locked'
}

function onShipTap(ship) {
  viewedId.value = ship.id
}

function buyOrSelect() {
  const ship = viewedShip.value
  const state = shipState(ship)
  if (state === 'owned') {
    playerStore.selectShip(ship.id)
    EventBus.emit('ship-changed', ship.id)
  } else if (state === 'locked' && playerStore.buyShip(ship.id, ship.cost)) {
    playerStore.selectShip(ship.id)
    EventBus.emit('ship-changed', ship.id)
  }
}

// ---- stats readout: base hull vs full loadout ----
const loadout = computed(() => ({
  parts: playerStore.shipParts[viewedId.value],
  augmentIds: playerStore.shipAugments[viewedId.value],
}))
const stats = computed(() => getShipStats(viewedShip.value, loadout.value))
const baseStats = computed(() => getShipStats(viewedShip.value))

const statRows = computed(() => {
  const s = stats.value
  const b = baseStats.value
  const row = (label, cur, base, fmt = (v) => Math.round(v)) => ({
    label,
    value: fmt(cur),
    delta: Math.abs(cur - base) > 1e-9 ? (cur > base ? '+' : '') + fmt(cur - base) : null,
  })
  return [
    row('HULL', s.hullMax, b.hullMax),
    row('SHIELDS', s.shieldsMax, b.shieldsMax),
    row('SEATS', s.seats, b.seats),
    row('HANDLING', s.handling, b.handling, (v) => v.toFixed(2)),
    row('TOP SPEED', s.maxSpeed, b.maxSpeed),
    row('THRUST', s.thrust, b.thrust),
    row('TURN', s.turnRate, b.turnRate, (v) => v.toFixed(1)),
    row('MASS CAP', s.massMax, b.massMax),
    row('FUEL', s.fuelMax, b.fuelMax),
  ]
})

// selector grouped by class, in class order
const shipGroups = computed(() =>
  Object.entries(SHIP_CLASSES)
    .map(([key, meta]) => ({ key, meta, ships: SHIPS.filter((s) => s.shipClass === key) }))
    .filter((g) => g.ships.length)
)

const overloaded = computed(() => playerStore.cargoMass() > stats.value.massMax)

// ---- parts (per-ship) ----
function partLevel(part) {
  return playerStore.shipParts[viewedId.value]?.[part.id] || 0
}

function partNextTier(part) {
  return part.tiers[partLevel(part)] || null
}

function onPartBuy(part) {
  if (playerStore.buyPartTier(viewedId.value, part)) {
    EventBus.emit('loadout-changed')
  }
}

// ---- augments ----
function augState(aug) {
  if ((playerStore.shipAugments[viewedId.value] || []).includes(aug.id)) return 'equipped'
  if (playerStore.ownedAugments.includes(aug.id)) return 'owned'
  if (aug.blueprint && !playerStore.foundBlueprints.includes(aug.blueprint)) return 'locked'
  return 'buyable'
}

function onAugTap(aug) {
  const state = augState(aug)
  if (state === 'locked') return
  if (state === 'buyable') {
    if (!playerStore.buyAugment(aug)) return
    playerStore.setAugmentEquipped(viewedId.value, aug.id, true)
  } else {
    playerStore.setAugmentEquipped(viewedId.value, aug.id, state !== 'equipped')
  }
  EventBus.emit('loadout-changed')
  EventBus.emit('ship-changed', playerStore.selectedShip) // redraw layers
}

// mini layer-only preview for augment cards (unit space → tiny svg)
function augMiniStrokes(aug) {
  return augmentStrokes({ verts: [[-14, -10], [14, -10], [14, 10], [-14, 10]] }, aug)
}

function miniPoints(s) {
  return s.points.map(([x, y]) => `${x},${y}`).join(' ')
}
</script>

<template>
  <div class="screen hangar">
    <header class="bar">
      <button class="retro-btn small" @pointerup="back">&lt; Back</button>
      <h2 class="heading">HANGAR</h2>
      <span class="points-chip">¢ {{ playerStore.credits }}</span>
    </header>

    <div class="deck">
      <!-- left: the ship on the pad -->
      <div class="pad">
        <div class="preview-well">
          <ShipPreview :ship="viewedShip" :size="260" show-augments />
        </div>

        <div class="pad-head">
          <span class="ship-name">{{ viewedShip.name }}</span>
          <span class="class-badge">{{ SHIP_CLASSES[viewedShip.shipClass]?.name }}</span>
          <button
            v-if="shipState(viewedShip) !== 'selected'"
            class="retro-btn small"
            :disabled="shipState(viewedShip) === 'locked' && playerStore.credits < viewedShip.cost"
            @pointerup="buyOrSelect"
          >
            {{ shipState(viewedShip) === 'owned' ? 'FLY THIS SHIP' : `BUY · ¢${viewedShip.cost}` }}
          </button>
          <span v-else class="active-tag">ACTIVE SHIP</span>
        </div>
        <p class="class-blurb">{{ SHIP_CLASSES[viewedShip.shipClass]?.blurb }}</p>
        <p v-if="overloaded" class="overload">⚠ OVERLOADED — current cargo exceeds this hull's mass cap</p>

        <table class="stats">
          <tbody>
            <tr v-for="r in statRows" :key="r.label">
              <td class="s-label">{{ r.label }}</td>
              <td class="s-value">{{ r.value }}</td>
              <td class="s-delta">{{ r.delta ?? '' }}</td>
            </tr>
            <tr>
              <td class="s-label">CARGO</td>
              <td class="s-value">{{ viewedShip.cargoSlots }} × {{ viewedShip.stackCap }}</td>
              <td class="s-delta"></td>
            </tr>
          </tbody>
        </table>

        <div class="ship-groups">
          <div v-for="g in shipGroups" :key="g.key" class="ship-group">
            <span class="group-label">{{ g.meta.name }}</span>
            <div class="ship-row">
              <button
                v-for="ship in g.ships"
                :key="ship.id"
                class="mini-ship"
                :class="[shipState(ship), { viewing: ship.id === viewedId }]"
                :data-ship="ship.id"
                @pointerup="onShipTap(ship)"
              >
                <ShipPreview :ship="ship" :size="44" />
                <span class="mini-status">
                  {{ shipState(ship) === 'selected' ? '●' : shipState(ship) === 'owned' ? '○' : '¢' + ship.cost }}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- right: editor panels -->
      <div class="panels">
        <h2 class="section-h">// PARTS <span class="dim-note">installed on {{ viewedShip.name }}</span></h2>
        <div class="perk-list">
          <div v-for="part in PARTS" :key="part.id" class="card perk-card" :class="{ dim: !viewedOwned }">
            <div class="perk-info">
              <span class="name">{{ part.name }}</span>
              <span class="desc">{{ part.desc }}</span>
              <span class="pips">
                <i v-for="(t, i) in part.tiers" :key="i" class="pip" :class="{ on: i < partLevel(part) }"></i>
              </span>
            </div>
            <button
              v-if="viewedOwned && partNextTier(part)"
              class="retro-btn small"
              :disabled="playerStore.credits < partNextTier(part).cost"
              @pointerup="onPartBuy(part)"
            >
              ¢ {{ partNextTier(part).cost }}
            </button>
            <span v-else-if="viewedOwned" class="maxed">MAX</span>
            <span v-else class="maxed dim-note">BUY SHIP FIRST</span>
          </div>
        </div>

        <h2 class="section-h">// AUGMENTS <span class="dim-note">weapons &amp; hull mods · own once · equip on any ship</span></h2>
        <div class="perk-list">
          <div
            v-for="aug in AUGMENTS"
            :key="aug.id"
            class="card perk-card aug-card"
            :class="augState(aug)"
          >
            <svg class="aug-mini" width="46" height="34" viewBox="-22 -14 44 28">
              <template v-for="(s, i) in augMiniStrokes(aug)" :key="i">
                <component
                  :is="s.closed ? 'polygon' : 'polyline'"
                  :points="miniPoints(s)"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.4"
                />
              </template>
            </svg>
            <div class="perk-info">
              <span class="name">{{ aug.name }}</span>
              <span class="desc">{{ aug.desc }}</span>
              <span v-if="augState(aug) === 'locked'" class="bp-lock">
                BLUEPRINT REQUIRED — found in the fringe
              </span>
            </div>
            <button
              v-if="augState(aug) === 'buyable'"
              class="retro-btn small"
              :disabled="playerStore.credits < aug.price || !viewedOwned"
              @pointerup="onAugTap(aug)"
            >
              ¢ {{ aug.price }}
            </button>
            <button
              v-else-if="augState(aug) !== 'locked'"
              class="retro-btn small"
              :class="{ equipped: augState(aug) === 'equipped' }"
              :disabled="!viewedOwned"
              @pointerup="onAugTap(aug)"
            >
              {{ augState(aug) === 'equipped' ? 'UNEQUIP' : 'EQUIP' }}
            </button>
            <span v-else class="maxed lock-ico">▲</span>
          </div>
        </div>

        <h2 class="section-h">// PAINT</h2>
        <div class="card paint-card">
          <ShipTintPanel :ship-id="viewedId" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.hangar {
  background: var(--panel);
  justify-content: flex-start;
  align-items: stretch;
  gap: 10px;
}

.bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.heading {
  font-size: 18px;
  letter-spacing: 0.4em;
  text-shadow: 0 0 12px rgba(125, 255, 216, 0.7);
}

.retro-btn.small {
  font-size: 12px;
  padding: 8px 16px;
  letter-spacing: 0.2em;
}

.deck {
  flex: 1;
  min-height: 0;
  display: flex;
  gap: 16px;
}

.pad {
  flex: 0 0 42%;
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
  overflow-y: auto;
  padding-bottom: 16px;
}

.preview-well {
  display: flex;
  justify-content: center;
  padding: 8px 0 0;
  filter: drop-shadow(0 0 18px rgba(125, 255, 216, 0.15));
}

.pad-head {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
}

.ship-name {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 0.3em;
}

.active-tag {
  color: var(--mint);
  font-size: 11px;
  letter-spacing: 0.25em;
}

.overload {
  color: var(--amber);
  font-size: 11px;
  letter-spacing: 0.1em;
  text-align: center;
  margin: 0;
}

.stats {
  border-collapse: collapse;
  margin: 0 auto;
  font-size: 12px;
}

.stats td {
  padding: 3px 12px;
}

.s-label {
  color: var(--ice);
  opacity: 0.75;
  letter-spacing: 0.15em;
  font-size: 10px;
}

.s-value {
  text-align: right;
  font-weight: 700;
}

.s-delta {
  color: var(--mint);
  font-size: 11px;
  min-width: 40px;
}

.class-badge {
  font-size: 10px;
  letter-spacing: 0.3em;
  color: var(--ice);
  border: 1px solid var(--ice);
  padding: 2px 8px;
  opacity: 0.85;
}

.class-blurb {
  text-align: center;
  font-size: 11px;
  color: var(--ice);
  opacity: 0.65;
  letter-spacing: 0.08em;
  margin: 0;
}

.ship-groups {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px 16px;
  margin-top: 4px;
}

.ship-group {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
}

.group-label {
  font-size: 8px;
  letter-spacing: 0.3em;
  color: var(--ice);
  opacity: 0.6;
}

.ship-row {
  display: flex;
  justify-content: center;
  gap: 8px;
}

.mini-ship {
  font-family: 'Space Mono', monospace;
  background: rgba(234, 246, 255, 0.03);
  border: 1px solid var(--line);
  color: var(--ink);
  padding: 6px 6px 3px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  cursor: pointer;
}

.mini-ship.viewing {
  border-color: var(--ice);
}

.mini-ship.selected {
  border-color: var(--mint);
  box-shadow: 0 0 10px rgba(125, 255, 216, 0.25);
}

.mini-status {
  font-size: 9px;
  color: var(--amber);
  letter-spacing: 0.1em;
}

.mini-ship.selected .mini-status {
  color: var(--mint);
}

.panels {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  touch-action: pan-y;
  padding: 0 2px 24px;
}

.section-h {
  font-size: 13px;
  letter-spacing: 0.4em;
  color: var(--ice);
  margin: 14px 0 10px;
  text-shadow: 0 0 8px rgba(157, 184, 255, 0.5);
}

.dim-note {
  font-size: 9px;
  letter-spacing: 0.15em;
  opacity: 0.55;
  text-shadow: none;
}

.perk-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.card {
  font-family: 'Space Mono', monospace;
  background: rgba(234, 246, 255, 0.03);
  border: 1px solid var(--line);
  color: var(--ink);
  padding: 12px 10px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.perk-card {
  flex-direction: row;
  justify-content: space-between;
  gap: 14px;
}

.perk-card.dim {
  opacity: 0.55;
}

.perk-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
}

.name {
  font-weight: 700;
  font-size: 13px;
  letter-spacing: 0.2em;
}

.desc {
  font-size: 11px;
  opacity: 0.7;
}

.pips {
  display: flex;
  gap: 5px;
}

.pip {
  width: 14px;
  height: 5px;
  border: 1px solid var(--line);
  display: inline-block;
}

.pip.on {
  background: var(--mint);
  border-color: var(--mint);
  box-shadow: 0 0 6px rgba(125, 255, 216, 0.7);
}

.maxed {
  color: var(--mint);
  font-size: 12px;
  letter-spacing: 0.25em;
}

.aug-mini {
  color: var(--ice);
  flex: none;
}

.aug-card.equipped {
  border-color: var(--mint);
  box-shadow: inset 0 0 12px rgba(125, 255, 216, 0.08);
}

.aug-card.equipped .aug-mini {
  color: var(--mint);
}

.aug-card.locked {
  opacity: 0.55;
}

.bp-lock {
  font-size: 10px;
  color: var(--amber);
  letter-spacing: 0.12em;
}

.lock-ico {
  color: var(--amber);
}

.retro-btn.small.equipped {
  color: var(--mint);
}

.paint-card {
  padding: 16px;
}

@media (max-width: 900px) {
  .deck {
    flex-direction: column;
    overflow-y: auto;
  }

  .pad {
    flex: none;
    overflow: visible;
  }

  .panels {
    overflow: visible;
  }
}
</style>
