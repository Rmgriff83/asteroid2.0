<script setup>
// The invariant cockpit frame: full-bleed space view out the windshield with
// the cargo terminal integrated into the ship's dashboard as one more control
// surface. Two framing states — STOWED (the glance readout lives in the dash's
// cargo console beside the yoke) ⇄ OPEN (the full terminal). Per-ship look
// comes from the cockpit skin (game/data/cockpitSkins.js): this shell only
// positions and tints what the skin declares, and owns everything else.
//
// Stage layering (all in the cover-scaled 1760×1080 stage):
//   dash svg (housing + live instruments) → HTML glance screen (interactive)
//   → fore svg (yoke + reticle, occludes the screen's lower edge) → trinkets.
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import { playerStore } from '../../stores/playerStore'
import { EventBus } from '../../game/EventBus'
import { getCockpitSkin } from '../../game/data/cockpitSkins'
import { getShipAccent } from '../../game/data/accents'
import CockpitWindow from '../CockpitWindow.vue'
import CargoTerminal from '../CargoTerminal.vue'
import GlanceScreen from './GlanceScreen.vue'
import DashInstruments from './DashInstruments.vue'
import BaseHullChrome from './BaseHullChrome.vue'
import HudReticle from './HudReticle.vue'
import TrinketLayer from './TrinketLayer.vue'

// skin `art` key → chrome component (kept out of the data module so it stays
// render-free); a new hull registers its art component here
const CHROME_ART = { base: BaseHullChrome }

const STAGE_W = 1760
const STAGE_H = 1080

const skin = computed(() => getCockpitSkin(playerStore.selectedShip))
// ship accent (player-configurable) — reactive to both ship swap and a
// swatch tap in the paint panel
const accent = computed(() => getShipAccent(playerStore.selectedShip))
const chromeArt = computed(() => CHROME_ART[skin.value.art] || BaseHullChrome)
const view = computed(() => playerStore.cockpitView)

// stowed: horizon sits mid-window above the dash; open: keep the in-flight
// band above the console (CockpitWindow eases between them)
const horizon = computed(() => (view.value === 'stowed' ? 0.34 : 0.17))

const tokenStyle = computed(() => ({
  '--ck-accent': accent.value.css,
  '--ck-accent-bright': accent.value.bright,
  '--ck-accent-dim': accent.value.dim,
  '--ck-accent-rgb': accent.value.rgb,
  // re-tint the cargo terminal (mounted only inside .cockpit) without
  // touching the global mint used by the store/menu screens
  '--mint': accent.value.css,
  '--ck-warn': skin.value.warn,
  '--ck-warn-dim': skin.value.warnDim,
}))

const artTokens = computed(() => ({
  accent: accent.value.css,
  accentBright: accent.value.bright,
  accentDim: accent.value.dim,
  warn: skin.value.warn,
  warnDim: skin.value.warnDim,
}))

// cover-fit the authored stage: art is anchored bottom-center so the
// dash/yoke never crop — excess crops off the top instead
const coverScale = ref(1)
function computeCover() {
  coverScale.value = Math.max(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H)
}

// the glance content mounts exactly inside the art's cargo-console binnacle
function mountStyle(rect) {
  return {
    left: rect.x + 'px',
    top: rect.y + 'px',
    width: rect.w + 'px',
    height: rect.h + 'px',
  }
}

const cargoMountStyle = computed(() => mountStyle(skin.value.consoles.cargo))

function openTerminal() {
  playerStore.cockpitView = 'open'
}

function stowTerminal() {
  playerStore.cockpitView = 'stowed'
}

function exitToGame() {
  playerStore.screen = 'game'
  playerStore.paused = false
  EventBus.emit('resume-game')
}

onMounted(() => {
  playerStore.cockpitView = 'stowed'
  computeCover()
  window.addEventListener('resize', computeCover)
})
onBeforeUnmount(() => window.removeEventListener('resize', computeCover))
</script>

<template>
  <div class="screen cockpit" :style="tokenStyle">
    <CockpitWindow :horizon="horizon" />

    <!-- windshield tints over the space canvas, under the chrome -->
    <div class="glow-warm"></div>
    <div class="glow-haze"></div>

    <!-- authored 1760×1080 stage, cover-scaled, bottom-center anchored -->
    <div class="stage" :style="{ transform: `scale(${coverScale})` }">
      <svg class="dash-svg" :width="STAGE_W" :height="STAGE_H" :viewBox="`0 0 ${STAGE_W} ${STAGE_H}`">
        <component :is="chromeArt" layer="dash" v-bind="artTokens" :consoles="skin.consoles" />
        <DashInstruments :instruments="skin.instruments" />
      </svg>

      <!-- interactive cargo console: the one pointer-enabled island in the stage -->
      <div class="dash-screen-mount" :style="cargoMountStyle">
        <Transition name="stow">
          <GlanceScreen v-if="view === 'stowed'" @open="openTerminal" @exit="exitToGame" />
        </Transition>
      </div>

      <svg class="fore-svg" :width="STAGE_W" :height="STAGE_H" :viewBox="`0 0 ${STAGE_W} ${STAGE_H}`">
        <component :is="chromeArt" layer="fore" v-bind="artTokens" :yoke="skin.yoke" />
        <HudReticle :cfg="skin.reticle" />
      </svg>

      <TrinketLayer :trinkets="skin.trinkets" />
    </div>

    <Transition name="stow">
      <CargoTerminal v-if="view === 'open'" @close="stowTerminal" />
    </Transition>
    <!-- scanlines come from App.vue's global overlay -->
  </div>
</template>

<style scoped>
.cockpit {
  padding: 0;
  overflow: hidden;
  background: #05070b; /* the space canvas covers this; glows overlay the canvas */
  /* static cockpit tokens; skin-driven accent/warn are bound inline.
     legacy --ck-green names alias the accent so shared styles keep working */
  --ck-green: var(--ck-accent);
  --ck-green-soft: #7fbf6a;
  --ck-green-border: var(--ck-accent-dim);
  --ck-green-border-dim: rgba(var(--ck-accent-rgb, 95, 217, 160), 0.26);
  --ck-warn-dark: #5f4b24;
}

.glow-warm,
.glow-haze {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 1;
}

.glow-warm {
  background: radial-gradient(ellipse at 50% 34%, rgba(46, 104, 80, 0.22), transparent 55%);
}

.glow-haze {
  background: radial-gradient(ellipse at 50% -2%, rgba(120, 60, 120, 0.14), transparent 46%);
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

.dash-screen-mount {
  position: absolute;
  pointer-events: auto;
}

/* the open terminal (CargoTerminal's own .screen) layers above the dash */
.cockpit :deep(.cargo-page) {
  z-index: 3;
}

/* stow ⇄ open: quick fade + settle */
.stow-enter-active,
.stow-leave-active {
  transition: opacity 0.2s ease-out, transform 0.2s ease-out;
}

.stow-enter-from,
.stow-leave-to {
  opacity: 0;
  transform: scale(0.94);
}

@media (prefers-reduced-motion: reduce) {
  .stow-enter-active,
  .stow-leave-active {
    transition: none;
  }
}
</style>
