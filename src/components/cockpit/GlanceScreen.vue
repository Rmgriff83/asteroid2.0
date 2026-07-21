<script setup>
// STOWED glance view: the cargo console on the dashboard — cargo summary plus
// the ship's status readouts (credits, sector, dock state) as one screen.
// ▸ OPEN expands to the full terminal; RESUME leaves the cockpit. Authored in
// stage units (480×300): type sizes are deliberately large so the console
// stays legible at phone cover scale (~0.48).
import { computed } from 'vue'
import { playerStore } from '../../stores/playerStore'
import { ITEMS, RARITY_COLORS } from '../../game/data/resources'
import { getShip } from '../../game/data/ships'
import { shipStats } from '../../game/systems/shipStats'
import { resolveSector, sectorOf } from '../../game/galaxy/sectorProps'
import { getAuthored } from '../../game/galaxy/authored'
import { worldState } from '../../game/systems/WorldDiffs'
import ItemIcon from '../ItemIcon.vue'

const GRID_MAX = 24
const CHIP_MAX = 4

const emit = defineEmits(['open', 'exit'])

const shipDef = computed(() => getShip(playerStore.selectedShip))
const mods = computed(() => shipStats())

const stacks = computed(() =>
  Object.entries(playerStore.cargo)
    .filter(([type, qty]) => qty > 0 && ITEMS[type])
    .sort((a, b) => b[1] - a[1])
)

const chips = computed(() =>
  stacks.value.slice(0, CHIP_MAX).map(([type, qty]) => ({
    type,
    qty,
    icon: ITEMS[type].icon,
    dot: RARITY_COLORS[ITEMS[type].rarity],
  }))
)

const overflow = computed(() => Math.max(0, stacks.value.length - CHIP_MAX))

// same block math as the terminal: stacks split into per-slot blocks
const usedSlots = computed(() => {
  const cap = playerStore.stackCap()
  return stacks.value.reduce((n, [, qty]) => n + Math.ceil(qty / cap), 0)
})
const slotCount = computed(() => playerStore.slotCount())
const lockedCount = computed(() => GRID_MAX - slotCount.value)

const massUsed = computed(() => playerStore.cargoMass())
const massPct = computed(() => Math.min(100, (massUsed.value / mods.value.massMax) * 100))

// ship status (merged from the old dash instrument cluster)
const docked = computed(() => !!playerStore.dockedStation)
const sector = computed(() => {
  const { sx, sy } = sectorOf(playerStore.currentPanel.px, playerStore.currentPanel.py)
  return resolveSector(worldState.galaxySeed, sx, sy, getAuthored())
})
</script>

<template>
  <div class="glance">
    <div class="head">
      <span class="title">{{ shipDef.name }} <span class="sys">:: CARGO.SYS</span></span>
      <div class="head-btns">
        <button class="btn open" @pointerup="emit('open')">▸ OPEN</button>
        <button class="btn resume" @pointerup="emit('exit')">RESUME</button>
      </div>
    </div>

    <div class="chips">
      <div v-for="c in chips" :key="c.type" class="chip">
        <i class="rdot" :style="{ background: c.dot }"></i>
        <ItemIcon class="cicon" :icon="c.icon" :size="18" />
        <span class="qty">{{ c.qty }}</span>
      </div>
      <div v-if="overflow" class="chip more">+{{ overflow }}</div>
      <div v-if="!chips.length" class="chip more empty">HOLD EMPTY</div>
    </div>

    <div class="foot">
      <span class="label">
        SLOTS <b>{{ usedSlots }} / {{ slotCount }}</b>
        <template v-if="lockedCount"> +{{ lockedCount }}L</template>
      </span>
      <div class="mass">
        <span class="label">MASS <b>{{ massUsed.toFixed(0) }} / {{ mods.massMax }}</b></span>
        <div class="track"><i :style="{ width: massPct + '%' }"></i></div>
      </div>
    </div>

    <!-- status strip: the credits/sector/dock readouts, one console -->
    <div class="status">
      <span class="cr">¢ {{ playerStore.credits }}</span>
      <span class="sector">{{ sector.name.toUpperCase() }}</span>
      <span class="dock" :class="{ on: docked }">{{ docked ? '● DOCKED' : '○ ADRIFT' }}</span>
      <span class="leds">
        <i class="led warn" style="animation-delay: 0.9s"></i>
        <i class="led" style="animation-delay: 1.8s"></i>
        <i class="led" style="animation-delay: 2.7s"></i>
      </span>
    </div>
  </div>
</template>

<style scoped>
.glance {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  padding: 16px 20px 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: linear-gradient(180deg, rgba(10, 24, 20, 0.55), rgba(4, 10, 10, 0.25));
  box-shadow: inset 0 0 40px rgba(0, 0, 0, 0.7), inset 0 0 24px rgba(var(--ck-accent-rgb, 95, 217, 160), 0.08);
}

.head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.title {
  font-size: 24px;
  font-weight: 700;
  color: #e6ebe8;
  letter-spacing: 1px;
  white-space: nowrap;
}

.title .sys {
  color: var(--ck-accent, #5fd9a0);
}

.head-btns {
  display: flex;
  gap: 8px;
}

.btn {
  font-family: inherit;
  font-size: 17px;
  letter-spacing: 1px;
  padding: 7px 12px;
  background: transparent;
  cursor: pointer;
  white-space: nowrap;
}

.btn.open {
  color: var(--ck-accent, #5fd9a0);
  border: 1px solid var(--ck-accent-dim, #2f8f70);
}

.btn.open:hover {
  color: var(--ck-accent-bright, #8ce8bc);
  box-shadow: 0 0 10px rgba(var(--ck-accent-rgb, 95, 217, 160), 0.25);
}

.btn.resume {
  color: #6f7a74;
  border: 1px solid #2b3733;
}

.btn.resume:hover {
  color: #dfe4e0;
}

.chips {
  display: flex;
  gap: 8px;
}

.chip {
  flex: 1;
  min-width: 0;
  position: relative;
  border: 1px solid var(--ck-green-border-dim, #2b5647);
  padding: 7px 6px 5px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.chip .rdot {
  position: absolute;
  top: 5px;
  left: 6px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.chip .qty {
  font-size: 20px;
  font-weight: 700;
  color: #dfe4e0;
}

.chip.more {
  justify-content: center;
  color: #3f6e5c;
  font-size: 20px;
  font-weight: 700;
}

.chip.more.empty {
  font-size: 14px;
  letter-spacing: 1px;
}

.foot {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 16px;
}

.label {
  font-size: 14px;
  letter-spacing: 1px;
  color: #6f7a74;
  white-space: nowrap;
}

.label b {
  color: #dfe4e0;
  font-size: 18px;
  margin: 0 2px;
}

.mass {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.track {
  height: 7px;
  background: rgba(255, 255, 255, 0.06);
}

.track i {
  display: block;
  height: 100%;
  background: var(--ck-accent, #5fd9a0);
  box-shadow: 0 0 8px rgba(var(--ck-accent-rgb, 95, 217, 160), 0.6);
}

.status {
  margin-top: auto;
  display: flex;
  align-items: center;
  gap: 14px;
  border-top: 1px solid #1d2b26;
  padding-top: 10px;
  font-size: 14px;
  letter-spacing: 1px;
  white-space: nowrap;
}

.status .cr {
  color: var(--ck-accent, #5fd9a0);
  font-weight: 700;
  font-size: 17px;
}

.status .sector {
  color: #6f7a74;
  overflow: hidden;
  text-overflow: ellipsis;
}

.status .dock {
  color: #6f7a74;
}

.status .dock.on {
  color: var(--ck-accent, #5fd9a0);
}

.status .leds {
  margin-left: auto;
  display: flex;
  gap: 7px;
}

.led {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--ck-accent, #5fd9a0);
  animation: led-blink 2.8s steps(1) infinite;
}

.led.warn {
  background: var(--ck-warn, #e0a850);
}

@keyframes led-blink {
  0%, 78% { opacity: 1; }
  79%, 88% { opacity: 0.25; }
  89%, 100% { opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
  .led {
    animation: none;
  }
}
</style>
