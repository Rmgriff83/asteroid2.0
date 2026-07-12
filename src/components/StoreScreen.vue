<script setup>
import { playerStore } from '../stores/playerStore'
import { EventBus } from '../game/EventBus'
import { SHIPS } from '../game/data/ships'
import { PERKS } from '../game/data/perks'
import { UPGRADES } from '../game/data/upgrades'
import ShipPreview from './ShipPreview.vue'

function back() {
  playerStore.screen = playerStore.storeReturnsTo === 'game' ? 'game' : 'menu'
  // returning to game keeps paused=true so the pause overlay reappears
}

function shipState(ship) {
  if (playerStore.selectedShip === ship.id) return 'selected'
  if (playerStore.ownedShips.includes(ship.id)) return 'owned'
  return 'locked'
}

function onShipTap(ship) {
  const state = shipState(ship)
  if (state === 'owned') {
    playerStore.selectShip(ship.id)
    EventBus.emit('ship-changed', ship.id)
  } else if (state === 'locked' && playerStore.buyShip(ship.id, ship.cost)) {
    playerStore.selectShip(ship.id)
    EventBus.emit('ship-changed', ship.id)
  }
}

function perkLevel(perk) {
  return playerStore.perks[perk.id] || 0
}

function nextTier(perk) {
  return perk.tiers[perkLevel(perk)] || null
}

function onPerkBuy(perk) {
  if (playerStore.buyPerkTier(perk)) {
    EventBus.emit('perks-updated')
  }
}
</script>

<template>
  <div class="screen store">
    <header class="bar">
      <button class="retro-btn small" @pointerup="back">&lt; Back</button>
      <span class="points-chip">¢ {{ playerStore.credits }}</span>
    </header>

    <div class="scroller">
      <h2 class="section-h">// SHIPS</h2>
      <div class="ship-grid">
        <button
          v-for="ship in SHIPS"
          :key="ship.id"
          class="card ship-card"
          :class="shipState(ship)"
          @pointerup="onShipTap(ship)"
        >
          <ShipPreview :ship="ship" :size="64" />
          <span class="name">{{ ship.name }}</span>
          <span class="hold-spec">{{ ship.cargoSlots }} slots × {{ ship.stackCap }}</span>
          <span class="status">
            <template v-if="shipState(ship) === 'selected'">ACTIVE</template>
            <template v-else-if="shipState(ship) === 'owned'">OWNED</template>
            <template v-else>¢ {{ ship.cost }}</template>
          </span>
        </button>
      </div>

      <h2 class="section-h">// BLASTER PERKS</h2>
      <div class="perk-list">
        <div v-for="perk in PERKS" :key="perk.id" class="card perk-card">
          <div class="perk-info">
            <span class="name">{{ perk.name }}</span>
            <span class="desc">{{ perk.desc }}</span>
            <span class="pips">
              <i
                v-for="(t, i) in perk.tiers"
                :key="i"
                class="pip"
                :class="{ on: i < perkLevel(perk) }"
              ></i>
            </span>
          </div>
          <button
            v-if="nextTier(perk)"
            class="retro-btn small"
            :disabled="playerStore.credits < nextTier(perk).cost"
            @pointerup="onPerkBuy(perk)"
          >
            ¢ {{ nextTier(perk).cost }}
          </button>
          <span v-else class="maxed">MAX</span>
        </div>
      </div>

      <h2 class="section-h">// SHIP UPGRADES</h2>
      <div class="perk-list">
        <div v-for="perk in UPGRADES" :key="perk.id" class="card perk-card">
          <div class="perk-info">
            <span class="name">{{ perk.name }}</span>
            <span class="desc">{{ perk.desc }}</span>
            <span class="pips">
              <i
                v-for="(t, i) in perk.tiers"
                :key="i"
                class="pip"
                :class="{ on: i < perkLevel(perk) }"
              ></i>
            </span>
          </div>
          <button
            v-if="nextTier(perk)"
            class="retro-btn small"
            :disabled="playerStore.credits < nextTier(perk).cost"
            @pointerup="onPerkBuy(perk)"
          >
            ¢ {{ nextTier(perk).cost }}
          </button>
          <span v-else class="maxed">MAX</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.store {
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

.retro-btn.small {
  font-size: 12px;
  padding: 8px 16px;
  letter-spacing: 0.2em;
}

.scroller {
  flex: 1;
  overflow-y: auto;
  touch-action: pan-y;
  padding: 4px 2px 24px;
}

.section-h {
  font-size: 13px;
  letter-spacing: 0.4em;
  color: var(--ice);
  margin: 18px 0 10px;
  text-shadow: 0 0 8px rgba(157, 184, 255, 0.5);
}

.ship-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
  gap: 10px;
}

.card {
  font-family: 'Space Mono', monospace;
  background: rgba(234, 246, 255, 0.03);
  border: 1px solid var(--line);
  color: var(--ink);
  padding: 12px 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}

.ship-card.selected {
  border-color: var(--mint);
  box-shadow: 0 0 12px rgba(125, 255, 216, 0.3), inset 0 0 12px rgba(125, 255, 216, 0.08);
}

.ship-card.locked {
  opacity: 0.75;
}

.name {
  font-weight: 700;
  font-size: 13px;
  letter-spacing: 0.2em;
}

.status {
  font-size: 11px;
  color: var(--amber);
  letter-spacing: 0.15em;
}

.hold-spec {
  font-size: 10px;
  color: var(--ice);
  opacity: 0.75;
  letter-spacing: 0.08em;
}

.ship-card.selected .status {
  color: var(--mint);
}

.perk-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.perk-card {
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  gap: 14px;
  cursor: default;
}

.perk-info {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
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
</style>
