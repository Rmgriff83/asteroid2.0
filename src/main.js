import { createApp } from 'vue'
import '@fontsource/space-mono/400.css'
import '@fontsource/space-mono/700.css'
import './style.css'
import App from './App.vue'
import { playerStore } from './stores/playerStore'

// debug/testing hook (harmless in production)
import { EventBus } from './game/EventBus'
import { generatePanel, sectorStarAssignments } from './game/galaxy/panelGen'
import { resolveSectorLayout } from './game/galaxy/sectorLayout'
import { starfieldSpec } from './game/systems/Starfield'
import { surfaceSpec } from './game/galaxy/surfaceGen'
import { PLANET_THEME } from './game/data/planetTheme'
import { resolveSector } from './game/galaxy/sectorProps'
import { getAuthored } from './game/galaxy/authored'
import { DEFAULT_GALAXY_SEED } from './game/galaxy/constants'
import {
  loadWorld,
  worldState,
  getDiff,
  flushWorld,
  addPermanentKey,
} from './game/systems/WorldDiffs'
import { isAdminEnabled, setWorkingCopy, getWorkingCopy } from './game/galaxy/authored'
import { dbGet } from './services/db'
import { syncSiloNotifications } from './services/notifications'
import { syncWidgetFeed, writeWidgetFeed } from './services/widgetFeed'
import { webFeedStore } from './services/widgetFeedPlugin'

// dev only: restore the admin editor's working copy of authored overrides
async function loadAdminWorkingCopy() {
  if (!isAdminEnabled()) return
  const copy = await dbGet('authored', 'workingCopy').catch(() => null)
  if (copy) setWorkingCopy(copy)
}

window.__zen = {
  playerStore,
  EventBus,
  debug: {
    generatePanel,
    surfaceSpec,
    PLANET_THEME,
    sectorStarAssignments,
    resolveSectorLayout,
    starfieldSpec,
    resolveSector,
    getAuthored,
    setWorkingCopy,
    getWorkingCopy,
    DEFAULT_GALAXY_SEED,
    worldState,
    getDiff,
    flushWorld,
    addPermanentKey,
    teleport: (px, py) => EventBus.emit('debug-teleport', { px, py }),
    setFuel: (n) => {
      playerStore.fuel = n
    },
    give: (type, qty) => {
      playerStore.addCargo(type, qty)
    },
    setCredits: (n) => {
      playerStore.credits = n
    },
    // renders the widget feed into the in-memory web store (probe hook)
    widgetFeedDryRun: async () => {
      const manifest = await writeWidgetFeed()
      return { manifest, fileCount: webFeedStore.files.size, reloads: webFeedStore.reloads }
    },
    webFeedStore,
  },
}

Promise.all([playerStore.load(), loadWorld(), loadAdminWorkingCopy()]).finally(() => {
  // a generator upgrade re-rolled the world: drop world-coupled player state
  // (bases, unlocked nodes, missions) while keeping the full profile
  if (worldState.regenerated) {
    playerStore.resetWorldCoupledState()
    playerStore.save()
  }
  // resync silo notifications from the loaded base list (an empty list —
  // e.g. after a world re-roll — cancels everything pending)
  syncSiloNotifications(playerStore.bases)
  syncWidgetFeed()
  createApp(App).mount('#app')
})
