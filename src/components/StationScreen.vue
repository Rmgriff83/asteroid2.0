<script setup>
import { computed, ref } from 'vue'
import { playerStore } from '../stores/playerStore'
import { EventBus } from '../game/EventBus'
import { currencyService } from '../services/currencyService'
import { RESOURCES, FUEL_PRICE } from '../game/data/resources'
import { getModifiers } from '../game/systems/modifiers'
import { generateOffers } from '../game/data/missions'
import { RECIPES, blueprintPrice } from '../game/data/recipes'
import { ITEMS } from '../game/data/resources'
import { hash32, mulberry32 } from '../game/utils/rng'
import { getAuthored } from '../game/galaxy/authored'
import { worldState, addPermanentKey } from '../game/systems/WorldDiffs'

const mods = computed(() => getModifiers(playerStore.perks))
const station = computed(() => playerStore.dockedStation)

// --- missions ---
const offers = ref([])
if (station.value) {
  const all = generateOffers(
    worldState.galaxySeed,
    station.value,
    station.value.px,
    station.value.py,
    getAuthored()
  )
  const taken = new Set(playerStore.missions.map((m) => m.id))
  offers.value = all.filter((o) => !taken.has(o.id))
}

const activeMissions = computed(() => playerStore.missions.filter((m) => m.state === 'active'))

// --- blueprints: rotating daily offers of recipes the player doesn't know ---
const blueprintOffers = computed(() => {
  if (!station.value) return []
  const dayIndex = Math.floor(Date.now() / 86400000)
  const rng = mulberry32(
    hash32(hash32(worldState.galaxySeed, hash32(station.value.px, station.value.py)), dayIndex + 7)
  )
  const unknown = RECIPES.filter((r) => !playerStore.knownRecipes.includes(r.id))
  const offers = []
  const pool = [...unknown]
  while (offers.length < 3 && pool.length) {
    offers.push(pool.splice(Math.floor(rng() * pool.length), 1)[0])
  }
  return offers.map((r) => ({ ...r, name: ITEMS[r.id].name, price: blueprintPrice(r.id) }))
})

function buyBlueprint(offer) {
  if (currencyService.debit(offer.price, `blueprint ${offer.id}`)) {
    playerStore.learnRecipe(offer.id)
  }
}

const deliverable = computed(() =>
  activeMissions.value.filter(
    (m) =>
      m.to.stationId === station.value?.id &&
      (m.kind === 'courier' || (playerStore.cargo[m.resource] || 0) >= m.qty)
  )
)

function canAccept(offer) {
  if (offer.kind !== 'courier') return true
  return playerStore.canAddCargo(offer.resource, offer.qty)
}

function accept(offer) {
  if (!canAccept(offer)) return
  if (offer.kind === 'courier') playerStore.addCargo(offer.resource, offer.qty)
  playerStore.missions.push({ ...offer, state: 'active' })
  addPermanentKey(`${offer.from.px},${offer.from.py}`)
  addPermanentKey(`${offer.to.px},${offer.to.py}`)
  if (!playerStore.waypoints.some((w) => w.px === offer.to.px && w.py === offer.to.py)) {
    playerStore.waypoints.push({ px: offer.to.px, py: offer.to.py })
  }
  offers.value = offers.value.filter((o) => o.id !== offer.id)
  playerStore.save()
}

function deliver(mission) {
  if ((playerStore.cargo[mission.resource] || 0) < mission.qty) return
  playerStore.cargo[mission.resource] -= mission.qty
  currencyService.credit(mission.reward, `mission ${mission.id}`)
  mission.state = 'done'
  playerStore.missions = playerStore.missions.filter((m) => m.state === 'active')
  playerStore.waypoints = playerStore.waypoints.filter(
    (w) => !(w.px === mission.to.px && w.py === mission.to.py)
  )
  playerStore.save()
}

const missingFuel = computed(() => Math.max(0, mods.value.fuelMax - playerStore.fuel))
const refuelCost = computed(() => Math.ceil(missingFuel.value * FUEL_PRICE))

const cargoRows = computed(() =>
  Object.entries(playerStore.cargo)
    .filter(([, qty]) => qty > 0)
    .map(([type, qty]) => ({
      type,
      qty,
      name: RESOURCES[type]?.name ?? type,
      price: RESOURCES[type]?.price ?? 1,
    }))
)

function refuel() {
  if (missingFuel.value <= 0) return
  if (currencyService.debit(refuelCost.value, 'refuel')) {
    playerStore.fuel = mods.value.fuelMax
    playerStore.save()
  }
}

function sell(row) {
  const value = row.qty * row.price
  playerStore.cargo[row.type] = 0
  currencyService.credit(value, `sell ${row.qty} ${row.type}`)
  playerStore.save()
}

function sellAll() {
  for (const row of cargoRows.value) sell(row)
}

function undock() {
  EventBus.emit('undock')
}
</script>

<template>
  <div class="screen station">
    <header class="bar">
      <h2 class="heading">{{ station?.name?.toUpperCase() || 'DOCKED' }}</h2>
      <span class="points-chip">¢ {{ playerStore.credits }}</span>
    </header>

    <div class="panel-box">
      <h3 class="section-h">// SERVICES</h3>
      <div class="row">
        <span>Fuel {{ playerStore.fuel.toFixed(0) }} / {{ mods.fuelMax }}</span>
        <button
          class="retro-btn small"
          :disabled="missingFuel <= 0 || playerStore.credits < refuelCost"
          @pointerup="refuel"
        >
          Refuel · {{ refuelCost }}
        </button>
      </div>
    </div>

    <div class="panel-box">
      <h3 class="section-h">// SELL CARGO</h3>
      <p v-if="!cargoRows.length" class="empty">hold empty — go shake some rocks</p>
      <div v-for="row in cargoRows" :key="row.type" class="row">
        <span>{{ row.name }} × {{ row.qty }}</span>
        <button class="retro-btn small" @pointerup="sell(row)">
          Sell · {{ row.qty * row.price }}
        </button>
      </div>
      <div v-if="cargoRows.length > 1" class="row">
        <span></span>
        <button class="retro-btn small" @pointerup="sellAll">Sell All</button>
      </div>
    </div>

    <div class="panel-box">
      <h3 class="section-h">// BLUEPRINTS</h3>
      <p v-if="!blueprintOffers.length" class="empty">no schematics for sale — you know it all</p>
      <div v-for="bp in blueprintOffers" :key="bp.id" class="row">
        <span>{{ bp.name.toUpperCase() }} SCHEMATIC <span class="tag">{{ ITEMS[bp.id].rarity }}</span></span>
        <button
          class="retro-btn small"
          :disabled="playerStore.credits < bp.price"
          @pointerup="buyBlueprint(bp)"
        >
          Learn · ¢{{ bp.price }}
        </button>
      </div>
    </div>

    <div class="panel-box">
      <h3 class="section-h">// MISSIONS</h3>
      <div v-for="m in deliverable" :key="'d' + m.id" class="row mission-done">
        <span>DELIVER {{ m.qty }} {{ RESOURCES[m.resource]?.name }} — arrived!</span>
        <button class="retro-btn small" @pointerup="deliver(m)">Complete · ¢{{ m.reward }}</button>
      </div>
      <div v-for="m in activeMissions" :key="'a' + m.id" class="row dim">
        <span>
          {{ m.qty }} {{ RESOURCES[m.resource]?.name }} → {{ m.to.name }}
          ({{ m.to.px }},{{ m.to.py }})
        </span>
        <span class="tag">IN TRANSIT</span>
      </div>
      <div v-for="o in offers" :key="o.id" class="row">
        <span>
          <b>{{ o.kind === 'courier' ? 'COURIER' : 'SUPPLY' }}</b>
          {{ o.qty }} {{ RESOURCES[o.resource]?.name }} → {{ o.to.name }}
        </span>
        <button class="retro-btn small" :disabled="!canAccept(o)" @pointerup="accept(o)">
          Accept · ¢{{ o.reward }}
        </button>
      </div>
      <p v-if="!offers.length && !activeMissions.length" class="empty">no contracts today</p>
    </div>

    <button class="retro-btn undock" @pointerup="undock">Undock</button>
  </div>
</template>

<style scoped>
.station {
  background: var(--panel);
  justify-content: flex-start;
  align-items: stretch;
  gap: 14px;
  overflow-y: auto;
}

.bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.heading {
  font-size: 20px;
  letter-spacing: 0.4em;
  text-shadow: 0 0 12px rgba(125, 255, 216, 0.7);
}

.panel-box {
  border: 1px solid var(--line);
  padding: 12px 16px;
}

.section-h {
  font-size: 12px;
  letter-spacing: 0.35em;
  color: var(--ice);
  margin-bottom: 10px;
}

.row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
  font-size: 14px;
}

.retro-btn.small {
  font-size: 11px;
  padding: 7px 14px;
  letter-spacing: 0.15em;
}

.empty {
  font-size: 12px;
  opacity: 0.6;
}

.dim {
  opacity: 0.65;
}

.tag {
  font-size: 10px;
  letter-spacing: 0.2em;
  color: var(--amber);
}

.mission-done span {
  color: var(--mint);
}

.undock {
  align-self: center;
  margin-top: 6px;
}
</style>
