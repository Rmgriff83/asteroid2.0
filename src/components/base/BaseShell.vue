<script setup>
// The base interior: the surface view out the hab window with the ops console
// set into the sill — same architecture as the ship cockpit shell (authored
// 1760×1080 stage, cover-scaled, one pointer-enabled console island), but the
// accent comes from the PLANET: each interior carries its world's hue.
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import { playerStore } from '../../stores/playerStore'
import { EventBus } from '../../game/EventBus'
import { motion } from '../../services/motion'
import { worldState } from '../../game/systems/WorldDiffs'
import { generatePanel } from '../../game/galaxy/panelGen'
import { getAuthored } from '../../game/galaxy/authored'
import { starfieldSpec } from '../../game/systems/Starfield'
import { surfaceSpec, SURF_W } from '../../game/galaxy/surfaceGen'
import { planetTheme } from '../../game/data/planetTheme'
import { getBaseSkin } from '../../game/data/baseSkins'
import { ITEMS } from '../../game/data/resources'
import { hash32 } from '../../game/utils/rng'
import { BASE_TRINKETS, getTrinket } from '../../game/data/baseTrinkets'
import BaseWindow from './BaseWindow.vue'
import BaseChrome from './BaseChrome.vue'
import BaseOpsScreen from './BaseOpsScreen.vue'
import BaseTrinketLayer from './BaseTrinketLayer.vue'
import TrinketArt from './TrinketArt.vue'

// skin `art` key → chrome component (kept out of the data module so it stays
// render-free); a new interior registers its art component here
const BASE_ART = { outpost: BaseChrome }

const STAGE_W = 1760
const STAGE_H = 1080

const props = defineProps({
  panelKey: { type: String, required: true },
  resourceType: { type: String, default: 'ferrite' },
})

const skin = getBaseSkin()
const chromeArt = BASE_ART[skin.art] || BaseChrome

// the panel is fixed for the visit — resolve the world once
const [px, py] = props.panelKey.split(',').map(Number)
const spec = generatePanel(worldState.galaxySeed, px, py, getAuthored())
const surface = spec.planet ? surfaceSpec(spec.planet) : null
const sky = starfieldSpec(worldState.galaxySeed, px, py, spec.sector)
const theme = planetTheme(spec.planet?.type)

// the base sits at a fixed, seeded spot on the surface loop; the window
// looks at it slightly off-center
const baseSpotX = surface ? hash32(surface.seed, 7) % SURF_W : 0
const camX = baseSpotX - 190

const base = computed(() => playerStore.bases.find((b) => b.panelKey === props.panelKey))
// the dome appears out the window once the base exists
const baseAt = computed(() => (base.value ? baseSpotX : null))
const baseColor = computed(() => {
  const c = ITEMS[base.value?.resourceType]?.color
  return c != null ? '#' + c.toString(16).padStart(6, '0') : '#ffb35c'
})

function dimHex(hex, u = 0.5) {
  const n = parseInt(hex.slice(1), 16)
  const f = (v) => Math.round(v * (1 - u))
  return `#${((f((n >> 16) & 255) << 16) | (f((n >> 8) & 255) << 8) | f(n & 255)).toString(16).padStart(6, '0')}`
}

const accentRgb = computed(() => {
  const n = parseInt(theme.strokeCss.slice(1), 16)
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`
})

const tokenStyle = computed(() => ({
  '--bs-accent': theme.strokeCss,
  '--bs-accent-dim': dimHex(theme.strokeCss, 0.55),
  '--bs-accent-rgb': accentRgb.value,
  '--bs-warn': skin.warn,
  '--bs-warn-dim': skin.warnDim,
}))

const artTokens = computed(() => ({
  accent: theme.strokeCss,
  accentDim: dimHex(theme.strokeCss, 0.55),
  warn: skin.warn,
  warnDim: skin.warnDim,
}))

const coverScale = ref(1)
function computeCover() {
  coverScale.value = Math.max(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H)
}

// where the window aperture's bottom lands in viewport px (stage is
// bottom-anchored: excess crops off the top) — the surface scene's ground
// is mapped to sit just above this line
const sceneBottom = computed(() => {
  const stageTop = window.innerHeight - STAGE_H * coverScale.value
  return stageTop + (skin.window.y + skin.window.h) * coverScale.value
})

const opsMountStyle = computed(() => {
  const r = skin.consoles.ops
  return { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px' }
})

// --- decoration placement: tap a slot → pick from owned, unplaced-here
// trinkets of that slot's kind (ownership global, arrangement per base)
const pickerSlot = ref(null) // { key, kind, placed } | null

function onSlotTap(e) {
  if (!base.value) return
  pickerSlot.value = e
}

const pickerChoices = computed(() => {
  if (!pickerSlot.value || !base.value) return []
  const placedHere = new Set(Object.values(base.value.trinkets || {}))
  return playerStore.ownedTrinkets
    .map(getTrinket)
    .filter((t) => t && t.kind === pickerSlot.value.kind && !placedHere.has(t.id))
})

const ownAnyOfKind = computed(() =>
  pickerSlot.value
    ? playerStore.ownedTrinkets.some((id) => getTrinket(id)?.kind === pickerSlot.value.kind)
    : false
)

function placeTrinket(id) {
  if (base.value && pickerSlot.value) {
    playerStore.setTrinket(base.value.id, pickerSlot.value.key, id)
  }
  pickerSlot.value = null
}

function clearSlot() {
  if (base.value && pickerSlot.value) {
    playerStore.setTrinket(base.value.id, pickerSlot.value.key, null)
  }
  pickerSlot.value = null
}

// lift off: a quick fade to black, then hand back to the paused game — or
// to the menu when a widget deep link brought us here (no flight to resume)
const leaving = ref(false)
function liftOff() {
  if (leaving.value) return
  const go = () => {
    if (playerStore.baseReturnsTo === 'menu') {
      playerStore.baseReturnsTo = 'game'
      playerStore.screen = 'menu'
    } else {
      playerStore.screen = 'game'
      EventBus.emit('resume-game')
    }
  }
  if (motion.reduced) return go()
  leaving.value = true
  setTimeout(go, 420)
}

onMounted(() => {
  computeCover()
  window.addEventListener('resize', computeCover)
})
onBeforeUnmount(() => window.removeEventListener('resize', computeCover))
</script>

<template>
  <div class="screen base-shell" :style="tokenStyle">
    <BaseWindow
      v-if="surface"
      :surface="surface"
      :sky="sky"
      :cam-x="camX"
      :base-at="baseAt"
      :base-color="baseColor"
      :scene-bottom="sceneBottom"
    />

    <!-- interior air glow tinted by the planet, under the chrome -->
    <div class="glow-hab"></div>

    <!-- authored 1760×1080 stage, cover-scaled, bottom-center anchored -->
    <div class="stage" :style="{ transform: `scale(${coverScale})` }">
      <svg class="dash-svg" :width="STAGE_W" :height="STAGE_H" :viewBox="`0 0 ${STAGE_W} ${STAGE_H}`">
        <component :is="chromeArt" layer="dash" v-bind="artTokens" :window="skin.window" :consoles="skin.consoles" />
      </svg>

      <!-- interactive ops console: the one pointer-enabled island in the stage -->
      <div class="ops-mount" :style="opsMountStyle">
        <BaseOpsScreen :panel-key="panelKey" :resource-type="resourceType" @liftoff="liftOff" />
      </div>

      <svg class="fore-svg" :width="STAGE_W" :height="STAGE_H" :viewBox="`0 0 ${STAGE_W} ${STAGE_H}`">
        <component :is="chromeArt" layer="fore" v-bind="artTokens" :window="skin.window" :consoles="skin.consoles" />
      </svg>

      <!-- decoration slots come alive once the base exists -->
      <BaseTrinketLayer
        v-if="base"
        :trinkets="skin.trinkets"
        :placements="base.trinkets"
        :interactive="true"
        @slot-tap="onSlotTap"
      />
    </div>

    <!-- slot picker: choose an owned decoration for the tapped spot -->
    <div v-if="pickerSlot" class="picker" @pointerup.self="pickerSlot = null">
      <div class="picker-panel">
        <div class="picker-head">
          <span>{{ pickerSlot.kind === 'hanging' ? 'HANG' : 'PLACE' }} DECORATION</span>
          <button class="pk-btn close" @pointerup="pickerSlot = null">✕</button>
        </div>
        <div class="picker-row">
          <button v-for="t in pickerChoices" :key="t.id" class="pk-item" @pointerup="placeTrinket(t.id)">
            <TrinketArt :id="t.id" />
            <span>{{ t.name }}</span>
          </button>
          <p v-if="!pickerChoices.length" class="pk-empty">
            {{ ownAnyOfKind ? 'ALL PLACED — CLEAR A SPOT FIRST' : 'NOTHING OWNED FOR THIS SPOT — SEE SUPPLY' }}
          </p>
        </div>
        <button v-if="pickerSlot.placed" class="pk-btn remove" @pointerup="clearSlot">REMOVE CURRENT</button>
      </div>
    </div>

    <!-- lift-off fade -->
    <div class="lift-fade" :class="{ on: leaving }"></div>
    <!-- scanlines come from App.vue's global overlay -->
  </div>
</template>

<style scoped>
.base-shell {
  padding: 0;
  overflow: hidden;
  background: #05070b;
}

.glow-hab {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 1;
  background: radial-gradient(ellipse at 50% 30%, rgba(var(--bs-accent-rgb, 205, 191, 168), 0.08), transparent 55%);
}

.stage {
  position: absolute;
  left: 50%;
  bottom: 0;
  width: 1760px;
  height: 1080px;
  margin-left: -880px;
  transform-origin: 50% 100%;
  pointer-events: none;
  z-index: 2;
}

.stage > svg {
  position: absolute;
  inset: 0;
}

.ops-mount {
  position: absolute;
  pointer-events: auto;
}

.picker {
  position: absolute;
  inset: 0;
  z-index: 4;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(4, 6, 11, 0.55);
}

.picker-panel {
  min-width: 320px;
  max-width: 560px;
  border: 1px solid var(--bs-accent-dim, #6b6254);
  background: #0a1017;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.picker-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  letter-spacing: 0.3em;
  color: var(--bs-accent, #cdbfa8);
}

.picker-row {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.pk-item {
  font-family: inherit;
  font-size: 10px;
  letter-spacing: 1px;
  color: #dfe4e0;
  background: transparent;
  border: 1px solid #2b3733;
  padding: 8px 10px 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  cursor: pointer;
}

.pk-item:hover {
  border-color: var(--bs-accent, #cdbfa8);
}

.pk-empty {
  font-size: 11px;
  letter-spacing: 1px;
  color: #6f7a74;
  margin: 4px;
}

.pk-btn {
  font-family: inherit;
  font-size: 12px;
  letter-spacing: 1px;
  background: transparent;
  cursor: pointer;
}

.pk-btn.close {
  color: #6f7a74;
  border: 1px solid #2b3733;
  padding: 2px 8px;
}

.pk-btn.remove {
  align-self: flex-start;
  color: #ff6a6a;
  border: 1px solid #5c2b2b;
  padding: 6px 10px;
}

.lift-fade {
  position: absolute;
  inset: 0;
  z-index: 5;
  pointer-events: none;
  background: #04060b;
  opacity: 0;
  transition: opacity 0.4s ease-in;
}

.lift-fade.on {
  opacity: 1;
}

@media (prefers-reduced-motion: reduce) {
  .lift-fade {
    transition: none;
  }
}
</style>
