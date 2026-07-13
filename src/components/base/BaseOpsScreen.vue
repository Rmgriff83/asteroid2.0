<script setup>
// The base ops console — silo management in the outpost binnacle. You're
// standing INSIDE the base (establishing happens from the ship, before
// landing), so a base always exists here. Authored in stage units (~480×320):
// type sizes are deliberately large so it stays legible at phone cover scale.
// Passive mining is TIMESTAMPS, never simulated: stored = min(capacity,
// elapsed × rate), reconstructed on demand.
import { computed, onBeforeUnmount, ref } from 'vue'
import { playerStore } from '../../stores/playerStore'
import { RESOURCES, ITEMS } from '../../game/data/resources'
import { BASE_TRINKETS } from '../../game/data/baseTrinkets'
import { storedFor, msToFull } from '../../game/systems/baseYield'
import { syncSiloNotifications } from '../../services/notifications'
import TrinketArt from './TrinketArt.vue'

const props = defineProps({
  panelKey: { type: String, required: true },
  resourceType: { type: String, default: 'ferrite' },
})

const emit = defineEmits(['liftoff'])

const tab = ref('ops') // 'ops' | 'supply' (supply arrives with the trinket drop)

const base = computed(() => playerStore.bases.find((b) => b.panelKey === props.panelKey))

// tick so the silo readout refreshes while you linger (30s, matches the
// in-flight planet label cadence). Clamped: a build/collect can stamp
// lastCollected AFTER our tick, and floor() of a hair-negative hour is -1.
const now = ref(Date.now())
const ticker = setInterval(() => (now.value = Date.now()), 30000)
onBeforeUnmount(() => clearInterval(ticker))

const stored = computed(() =>
  base.value ? Math.max(0, storedFor(base.value, Math.max(now.value, base.value.lastCollected))) : 0
)

const cargoSpace = computed(() =>
  base.value ? playerStore.maxAddable(base.value.resourceType) : 0
)

const fullIn = computed(() => {
  if (!base.value) return ''
  const ms = msToFull(base.value)
  if (ms <= 0) return 'SILO FULL'
  const totalM = Math.ceil(ms / 60000)
  const h = Math.floor(totalM / 60)
  const m = totalM % 60
  return `FULL IN ${h > 0 ? `${h}H ` : ''}${m}M`
})

function collect() {
  const b = base.value
  if (!b || stored.value <= 0) return
  const taken = Math.min(stored.value, cargoSpace.value)
  if (taken <= 0) return
  playerStore.addCargo(b.resourceType, taken)
  if (taken >= stored.value) {
    b.lastCollected = Date.now()
  } else {
    // leave the un-taken remainder accrued
    b.lastCollected = Date.now() - ((stored.value - taken) / b.ratePerHour) * 3600000
  }
  now.value = Date.now()
  playerStore.save()
  syncSiloNotifications(playerStore.bases)
}

function buyTrinket(t) {
  playerStore.buyTrinket(t.id, t.price)
}

const resName = computed(
  () => (RESOURCES[base.value?.resourceType ?? props.resourceType]?.name ?? props.resourceType).toUpperCase()
)
const resColor = computed(() => {
  const c = ITEMS[base.value?.resourceType ?? props.resourceType]?.color
  return c != null ? '#' + c.toString(16).padStart(6, '0') : 'var(--bs-warn, #e0a850)'
})
</script>

<template>
  <div class="ops">
    <div class="head">
      <span class="title">OUTPOST <span class="sys">:: SURFACE.OPS</span></span>
      <button class="btn liftoff" @pointerup="emit('liftoff')">LIFT OFF</button>
    </div>

    <div class="tabs">
      <button class="tab" :class="{ on: tab === 'ops' }" @pointerup="tab = 'ops'">OPS</button>
      <button class="tab" :class="{ on: tab === 'supply' }" @pointerup="tab = 'supply'">SUPPLY</button>
      <span class="mass">MASS {{ Math.round(playerStore.cargoMass()) }}</span>
    </div>

    <template v-if="tab === 'ops'">
      <!-- a base always exists here — you're standing in it -->
      <div v-if="base" class="body">
        <div class="silo-row">
          <span class="label"><b :style="{ color: resColor }">{{ resName }}</b> {{ stored }}/{{ base.capacity }}</span>
          <span class="label dim">{{ base.ratePerHour }}/HR · {{ fullIn }}</span>
        </div>
        <div class="silo">
          <div class="silo-fill" :style="{ width: (stored / base.capacity) * 100 + '%' }"></div>
        </div>
        <button class="btn act" :disabled="stored <= 0 || cargoSpace <= 0" @pointerup="collect">
          COLLECT {{ Math.min(stored, cargoSpace) }}
        </button>
        <p v-if="stored > 0 && cargoSpace <= 0" class="desc warn-text">HOLD FULL — MAKE ROOM</p>
      </div>
    </template>

    <template v-else>
      <div class="supply">
        <div class="supply-head">
          <span class="label dim">TAP A SPOT TO PLACE</span>
          <span class="credits">¢ {{ playerStore.credits }}</span>
        </div>
        <div class="catalog">
          <div v-for="t in BASE_TRINKETS" :key="t.id" class="cat-row">
            <TrinketArt :id="t.id" class="cat-art" />
            <div class="cat-info">
              <span class="cat-name">{{ t.name }} <i class="cat-kind">{{ t.kind === 'hanging' ? 'RAIL' : 'SHELF' }}</i></span>
              <span class="cat-blurb">{{ t.blurb }}</span>
            </div>
            <button
              v-if="!playerStore.ownedTrinkets.includes(t.id)"
              class="btn buy"
              :disabled="playerStore.credits < t.price"
              @pointerup="buyTrinket(t)"
            >
              ¢{{ t.price }}
            </button>
            <span v-else class="owned">OWNED</span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.ops {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  padding: 16px 20px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: linear-gradient(180deg, rgba(20, 16, 10, 0.55), rgba(8, 6, 4, 0.25));
  box-shadow: inset 0 0 40px rgba(0, 0, 0, 0.7), inset 0 0 24px rgba(var(--bs-accent-rgb, 205, 191, 168), 0.08);
  color: #dfe4e0;
  font-family: inherit;
}

.head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.title {
  font-size: 22px;
  font-weight: 700;
  letter-spacing: 1px;
  white-space: nowrap;
}

.title .sys {
  color: var(--bs-accent, #cdbfa8);
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

.btn.liftoff {
  color: var(--bs-warn, #e0a850);
  border: 1px solid var(--bs-warn-dim, #8a6d34);
}

.btn.liftoff:hover {
  color: #f4cd86;
  box-shadow: 0 0 10px rgba(224, 168, 80, 0.3);
}

.tabs {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tab {
  font-family: inherit;
  font-size: 15px;
  letter-spacing: 2px;
  padding: 5px 14px;
  background: transparent;
  color: #6f7a74;
  border: 1px solid #2b3733;
  cursor: pointer;
}

.tab.on {
  color: var(--bs-accent, #cdbfa8);
  border-color: var(--bs-accent-dim, #6b6254);
}

.tabs .mass {
  margin-left: auto;
  font-size: 14px;
  letter-spacing: 1px;
  color: #6f7a74;
}

.body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10px;
  justify-content: center;
}

.desc {
  font-size: 16px;
  opacity: 0.9;
  margin: 0;
}

.desc.dim {
  color: #6f7a74;
  text-align: center;
  letter-spacing: 1px;
}

.desc b {
  font-weight: 700;
}

.warn-text {
  color: var(--bs-warn, #e0a850);
  font-size: 14px;
  letter-spacing: 1px;
}

.btn.act {
  align-self: flex-start;
  color: var(--bs-accent, #cdbfa8);
  border: 1px solid var(--bs-accent-dim, #6b6254);
  font-size: 19px;
  padding: 9px 18px;
}

.btn.act:hover:not(:disabled) {
  box-shadow: 0 0 10px rgba(var(--bs-accent-rgb, 205, 191, 168), 0.3);
}

.btn.act:disabled {
  opacity: 0.4;
  cursor: default;
}

.silo-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.label {
  font-size: 17px;
  letter-spacing: 1px;
}

.label.dim {
  color: #6f7a74;
  font-size: 14px;
}

.silo {
  width: 100%;
  height: 10px;
  border: 1px solid var(--bs-accent-dim, #6b6254);
}

.silo-fill {
  height: 100%;
  background: var(--bs-warn, #e0a850);
  box-shadow: 0 0 8px rgba(224, 168, 80, 0.6);
}

.supply {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.supply-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.credits {
  color: var(--bs-accent, #cdbfa8);
  font-weight: 700;
  font-size: 17px;
  white-space: nowrap;
}

.catalog {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-right: 4px;
}

.cat-row {
  display: flex;
  align-items: center;
  gap: 10px;
  border: 1px solid #1d2b26;
  padding: 4px 8px;
}

.cat-art {
  transform: scale(0.7);
  transform-origin: center;
  margin: -8px -4px;
  flex: none;
}

.cat-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.cat-name {
  font-size: 14px;
  letter-spacing: 1px;
  white-space: nowrap;
}

.cat-kind {
  font-style: normal;
  font-size: 10px;
  color: #6f7a74;
  letter-spacing: 2px;
  margin-left: 6px;
}

.cat-blurb {
  font-size: 11px;
  color: #6f7a74;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.btn.buy {
  color: var(--bs-accent, #cdbfa8);
  border: 1px solid var(--bs-accent-dim, #6b6254);
  font-size: 14px;
  padding: 5px 10px;
}

.btn.buy:disabled {
  opacity: 0.4;
  cursor: default;
}

.owned {
  font-size: 11px;
  letter-spacing: 2px;
  color: #6f7a74;
  padding: 5px 4px;
}
</style>
