<script setup>
// Planetary base: build (resource-gated), passive mining via TIMESTAMPS —
// never "run" the mine (handoff §8): stored = min(capacity, elapsed × rate),
// reconstructed on demand. Capacity cap pulls the player back to collect.
import { computed, reactive } from 'vue'
import { playerStore } from '../stores/playerStore'
import { EventBus } from '../game/EventBus'
import { RESOURCES } from '../game/data/resources'
import { getModifiers } from '../game/systems/modifiers'
import { addPermanentKey } from '../game/systems/WorldDiffs'
import { storedFor } from '../game/systems/baseYield'
import { syncSiloNotifications } from '../services/notifications'

const BUILD_COST = { ferrite: 15, silicate: 8 }
const RATE_PER_HOUR = 6
const CAPACITY = 24

const props = defineProps({
  panelKey: { type: String, required: true },
  resourceType: { type: String, default: 'ferrite' },
})

const mods = computed(() => getModifiers(playerStore.perks))
const base = computed(() => playerStore.bases.find((b) => b.panelKey === props.panelKey))

const canBuild = computed(() =>
  Object.entries(BUILD_COST).every(([type, qty]) => (playerStore.cargo[type] || 0) >= qty)
)

const stored = computed(() => (base.value ? storedFor(base.value) : 0))

const cargoSpace = computed(() =>
  base.value ? playerStore.maxAddable(base.value.resourceType) : 0
)

function build() {
  if (!canBuild.value || base.value) return
  for (const [type, qty] of Object.entries(BUILD_COST)) {
    playerStore.cargo[type] -= qty
  }
  const id = `base:${props.panelKey}`
  playerStore.bases.push({
    id,
    panelKey: props.panelKey,
    resourceType: props.resourceType,
    ratePerHour: RATE_PER_HOUR,
    capacity: CAPACITY,
    lastCollected: Date.now(),
  })
  playerStore.unlockedNodes.push(id) // bases are fast-travel nodes
  addPermanentKey(props.panelKey) // base panels never evict
  playerStore.save()
  syncSiloNotifications(playerStore.bases)
}

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
  playerStore.save()
  syncSiloNotifications(playerStore.bases)
}

function leave() {
  playerStore.screen = 'game'
  EventBus.emit('resume-game')
}
</script>

<template>
  <div class="screen base-screen">
    <header class="bar">
      <h2 class="heading">SURFACE</h2>
      <span class="points-chip">MASS {{ Math.round(playerStore.cargoMass()) }}/{{ mods.massMax }}</span>
    </header>

    <div v-if="!base" class="panel-box">
      <h3 class="section-h">// ESTABLISH BASE</h3>
      <p class="desc">
        A base mines {{ RESOURCES[resourceType]?.name ?? resourceType }} passively while you
        roam — and becomes a jump beacon.
      </p>
      <p class="desc cost">
        Requires:
        <span v-for="(qty, type) in BUILD_COST" :key="type">
          {{ qty }} {{ RESOURCES[type]?.name ?? type }} ({{ playerStore.cargo[type] || 0 }})&nbsp;
        </span>
      </p>
      <button class="retro-btn" :disabled="!canBuild" @pointerup="build">Build Base</button>
    </div>

    <div v-else class="panel-box">
      <h3 class="section-h">// BASE — {{ RESOURCES[base.resourceType]?.name }}</h3>
      <p class="desc">
        Silo: {{ stored }} / {{ base.capacity }} · rate {{ base.ratePerHour }}/hr
      </p>
      <div class="silo">
        <div class="silo-fill" :style="{ width: (stored / base.capacity) * 100 + '%' }"></div>
      </div>
      <button class="retro-btn" :disabled="stored <= 0 || cargoSpace <= 0" @pointerup="collect">
        Collect {{ Math.min(stored, cargoSpace) }}
      </button>
    </div>

    <button class="retro-btn leave" @pointerup="leave">Lift Off</button>
  </div>
</template>

<style scoped>
.base-screen {
  background: var(--panel);
  justify-content: flex-start;
  align-items: stretch;
  gap: 14px;
}

.bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.heading {
  font-size: 20px;
  letter-spacing: 0.4em;
  text-shadow: 0 0 12px rgba(255, 179, 92, 0.7);
}

.panel-box {
  border: 1px solid var(--line);
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: flex-start;
}

.section-h {
  font-size: 12px;
  letter-spacing: 0.35em;
  color: var(--amber);
}

.desc {
  font-size: 13px;
  opacity: 0.85;
}

.cost {
  color: var(--ice);
}

.silo {
  width: 100%;
  height: 8px;
  border: 1px solid var(--line);
}

.silo-fill {
  height: 100%;
  background: var(--amber);
  box-shadow: 0 0 8px rgba(255, 179, 92, 0.6);
}

.leave {
  align-self: center;
}
</style>
