<script setup>
import { onMounted, onBeforeUnmount, ref, defineAsyncComponent } from 'vue'
import { isAdminEnabled } from './game/galaxy/authored'
import { Capacitor } from '@capacitor/core'
import { App as CapApp } from '@capacitor/app'
import { ScreenOrientation } from '@capacitor/screen-orientation'
import { createGame } from './game'
import { EventBus } from './game/EventBus'
import { playerStore } from './stores/playerStore'
import { flushWorld } from './game/systems/WorldDiffs'
import { unlockAudio } from './services/sfx'
import { initDeepLinks } from './services/deepLinks'
import { syncWidgetFeed } from './services/widgetFeed'
import SplashScreen from './components/SplashScreen.vue'
import MainMenu from './components/MainMenu.vue'
import StoreScreen from './components/StoreScreen.vue'
import HangarScreen from './components/HangarScreen.vue'
import PauseOverlay from './components/PauseOverlay.vue'
import StationScreen from './components/StationScreen.vue'
import StarMapScreen from './components/StarMapScreen.vue'
import BaseShell from './components/base/BaseShell.vue'
import LandingSequence from './components/LandingSequence.vue'
import CockpitShell from './components/cockpit/CockpitShell.vue'
import DialogueOverlay from './components/DialogueOverlay.vue'
import PickupToast from './components/PickupToast.vue'

// dev-only chunk: tree-shaken/lazy-split out of player builds
const AdminGalaxyView = isAdminEnabled()
  ? defineAsyncComponent(() => import('./components/admin/AdminGalaxyView.vue'))
  : null

const gameHost = ref(null)
let game = null

function flushAll() {
  // best-effort persistence flush — iOS can kill the WebView with no warning
  playerStore.flushNow()
  flushWorld()
  syncWidgetFeed() // refresh home-screen widget frames (native only, async best-effort)
}

function onVisibilityChange() {
  if (document.hidden) {
    if (playerStore.screen === 'game' && !playerStore.paused) {
      playerStore.paused = true
      EventBus.emit('pause-game')
    }
    flushAll()
  }
}

function onPageHide() {
  flushAll()
}

function onBackButton() {
  if (playerStore.screen === 'cargo') {
    // step back through the cockpit: open terminal → stowed → resume flight
    if (playerStore.cockpitView === 'open') {
      playerStore.cockpitView = 'stowed'
    } else {
      playerStore.screen = 'game'
      playerStore.paused = false
      EventBus.emit('resume-game')
    }
  } else if (playerStore.screen === 'store') {
    playerStore.screen = playerStore.storeReturnsTo === 'game' ? 'game' : 'menu'
  } else if (playerStore.screen === 'hangar') {
    playerStore.screen = playerStore.hangarReturnsTo === 'game' ? 'game' : 'menu'
  } else if (playerStore.screen === 'landing') {
    // skip the descent cutscene straight into the base
    playerStore.screen = 'base'
  } else if (playerStore.screen === 'base') {
    // lift off (previously this fell through and exited the app); a base
    // opened from a widget deep link has no flight session to resume
    if (playerStore.baseReturnsTo === 'menu') {
      playerStore.baseReturnsTo = 'game'
      playerStore.screen = 'menu'
    } else {
      playerStore.screen = 'game'
      EventBus.emit('resume-game')
    }
  } else if (playerStore.screen === 'game' && !playerStore.paused) {
    playerStore.paused = true
    EventBus.emit('pause-game')
  } else if (playerStore.screen === 'game' && playerStore.paused) {
    playerStore.paused = false
    playerStore.screen = 'menu'
    EventBus.emit('quit-to-menu')
  } else {
    CapApp.exitApp()
  }
}

onMounted(() => {
  game = createGame(gameHost.value)
  if (window.__zen) window.__zen.game = game
  document.addEventListener('visibilitychange', onVisibilityChange)
  window.addEventListener('pagehide', onPageHide)
  // iOS Web Audio unlock needs a user gesture
  window.addEventListener('pointerdown', unlockAudio, { once: true })

  if (Capacitor.isNativePlatform()) {
    ScreenOrientation.lock({ orientation: 'landscape' }).catch(() => {})
    CapApp.addListener('backButton', onBackButton)
    initDeepLinks() // widget taps: deepfield://base/<panelKey>
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', onVisibilityChange)
  window.removeEventListener('pagehide', onPageHide)
  if (game) game.destroy(true)
})
</script>

<template>
  <div ref="gameHost" class="game-host"></div>
  <SplashScreen v-if="playerStore.screen === 'splash'" />
  <MainMenu v-else-if="playerStore.screen === 'menu'" />
  <StoreScreen v-else-if="playerStore.screen === 'store'" />
  <HangarScreen v-else-if="playerStore.screen === 'hangar'" />
  <StationScreen v-else-if="playerStore.screen === 'station'" />
  <StarMapScreen v-else-if="playerStore.screen === 'map'" />
  <CockpitShell v-else-if="playerStore.screen === 'cargo'" />
  <component
    :is="AdminGalaxyView"
    v-else-if="AdminGalaxyView && playerStore.screen === 'admin'"
  />
  <LandingSequence
    v-else-if="playerStore.screen === 'landing'"
    :panel-key="playerStore.landing.panelKey"
  />
  <BaseShell
    v-else-if="playerStore.screen === 'base'"
    :panel-key="playerStore.landing.panelKey"
    :resource-type="playerStore.landing.resourceType"
  />
  <PauseOverlay v-if="playerStore.screen === 'game' && playerStore.paused" />
  <DialogueOverlay />
  <PickupToast />
  <!-- one retro display: scanlines over EVERYTHING, always topmost -->
  <div class="global-scanlines"></div>
</template>

<style scoped>
.game-host {
  position: absolute;
  inset: 0;
}

/* the whole app is one retro CRT: this layer sits above every screen,
   overlay, and anything added later — never introduce a higher z-index */
.global-scanlines {
  position: fixed;
  inset: 0;
  z-index: 1000;
  pointer-events: none;
  background: repeating-linear-gradient(to bottom, transparent 0 4px, rgba(0, 0, 0, 0.22) 4px 6px);
  opacity: 0.35;
}
</style>
