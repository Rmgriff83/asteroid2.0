<script setup>
// Hull-tint picker (SHIP tab of the cargo/ship terminal): curated accent
// swatches. A pick re-tints the whole ship — cockpit, this terminal, exterior
// hull, flame, thrust trail, minimap marker — and persists per ship. Mirrors
// StoreScreen's component-emits pattern so the store stays EventBus-free.
import { computed } from 'vue'
import { playerStore } from '../stores/playerStore'
import { EventBus } from '../game/EventBus'
import { getShip } from '../game/data/ships'
import { ACCENTS, ACCENT_ORDER } from '../game/data/accents'

const current = computed(
  () => playerStore.shipAccents[playerStore.selectedShip] ?? getShip(playerStore.selectedShip).accent
)

function pick(key) {
  playerStore.setShipAccent(playerStore.selectedShip, key)
  EventBus.emit('ship-changed', playerStore.selectedShip)
}
</script>

<template>
  <div class="tint">
    <div class="tint-head">
      <span class="tint-label">HULL TINT</span>
      <span class="tint-name">{{ ACCENTS[current].name }}</span>
    </div>
    <div class="swatches">
      <button
        v-for="key in ACCENT_ORDER"
        :key="key"
        class="swatch"
        :class="{ on: key === current }"
        :data-accent="key"
        :title="ACCENTS[key].name"
        :style="{
          background: ACCENTS[key].css,
          '--sw-rgb': ACCENTS[key].rgb,
          '--sw-bright': ACCENTS[key].bright,
          '--sw-dim': ACCENTS[key].dim,
        }"
        @pointerup="pick(key)"
      ></button>
    </div>
    <div class="tint-hint">applies to hull, exhaust and all ship displays · saved per ship</div>
  </div>
</template>

<style scoped>
.tint {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.tint-head {
  display: flex;
  align-items: baseline;
  gap: 14px;
}

.tint-label {
  font-size: 11px;
  letter-spacing: 2px;
  color: #6f7a74;
}

.tint-name {
  font-size: 15px;
  letter-spacing: 1px;
  color: var(--mint);
  font-weight: 700;
}

.swatches {
  display: grid;
  grid-template-columns: repeat(4, 40px);
  gap: 14px 18px;
}

.swatch {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 2px solid transparent;
  padding: 0;
  cursor: pointer;
  box-shadow: 0 0 8px rgba(var(--sw-rgb), 0.5);
}

.swatch.on {
  border-color: var(--sw-bright);
  outline: 1px solid var(--sw-dim);
  outline-offset: 3px;
}

.tint-hint {
  font-size: 10px;
  letter-spacing: 1px;
  color: #5a635d;
}
</style>
