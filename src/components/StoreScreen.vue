<script setup>
// The STORE is the (future) in-app-purchase page: credit packs only.
// Ships, parts, augments and paint live in the HANGAR. Packs are
// placeholders — dev builds grant the credits for economy testing;
// production shows COMING SOON until real billing is wired up.
import { ref } from 'vue'
import { playerStore } from '../stores/playerStore'
import { currencyService } from '../services/currencyService'
import { CREDIT_PACKS } from '../game/data/creditPacks'

const isDev = import.meta.env.DEV

function back() {
  playerStore.screen = playerStore.storeReturnsTo === 'game' ? 'game' : 'menu'
  // returning to game keeps paused=true so the pause overlay reappears
}

function openHangar() {
  playerStore.hangarReturnsTo = playerStore.storeReturnsTo
  playerStore.screen = 'hangar'
}

// short per-card notice ("GRANTED" / "COMING SOON")
const flash = ref(null) // { id, text }
let flashTimer = null
function showFlash(id, text) {
  flash.value = { id, text }
  clearTimeout(flashTimer)
  flashTimer = setTimeout(() => (flash.value = null), 1500)
}

function onPackTap(pack) {
  if (isDev) {
    currencyService.credit(pack.credits, `iap-dev:${pack.id}`) // money-membrane seam
    showFlash(pack.id, 'GRANTED')
  } else {
    showFlash(pack.id, 'COMING SOON')
  }
}

function onRestoreTap() {
  showFlash('restore', 'COMING SOON')
}
</script>

<template>
  <div class="screen store">
    <header class="bar">
      <button class="retro-btn small" @pointerup="back">&lt; Back</button>
      <span class="points-chip">¢ {{ playerStore.credits }}</span>
    </header>

    <div class="scroller">
      <button class="card hangar-pointer" @pointerup="openHangar">
        <span class="name">BLASTER MODS have moved to the HANGAR</span>
        <span class="desc">now fitted as AUGMENTS — tap to open</span>
      </button>

      <h2 class="section-h">// CREDIT PACKS</h2>
      <p v-if="isDev" class="dev-note">DEV: taps grant credits</p>
      <div class="pack-list">
        <div v-for="pack in CREDIT_PACKS" :key="pack.id" class="card pack-card">
          <div class="pack-info">
            <span class="name">{{ pack.name }}</span>
            <span class="amount">¢ {{ pack.credits.toLocaleString() }}</span>
            <span v-if="flash && flash.id === pack.id" class="flash">{{ flash.text }}</span>
          </div>
          <button class="retro-btn small" @pointerup="onPackTap(pack)">
            {{ pack.priceLabel }}
          </button>
        </div>
      </div>

      <div class="card restore-row" @pointerup="onRestoreTap">
        <span class="desc">RESTORE PURCHASES</span>
        <span v-if="flash && flash.id === 'restore'" class="flash">{{ flash.text }}</span>
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

.dev-note {
  font-family: 'Space Mono', monospace;
  font-size: 10px;
  letter-spacing: 0.2em;
  color: var(--amber);
  opacity: 0.7;
  margin: -4px 0 8px;
}

.hangar-pointer {
  width: 100%;
  align-items: flex-start;
  cursor: pointer;
  border-color: var(--mint);
  box-shadow: inset 0 0 12px rgba(125, 255, 216, 0.06);
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

.name {
  font-weight: 700;
  font-size: 13px;
  letter-spacing: 0.2em;
}

.pack-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.pack-card {
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  gap: 14px;
  cursor: default;
}

.pack-info {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
}

.amount {
  font-size: 12px;
  color: var(--ice);
  letter-spacing: 0.15em;
}

.flash {
  font-size: 10px;
  color: var(--amber);
  letter-spacing: 0.25em;
}

.desc {
  font-size: 11px;
  opacity: 0.7;
}

.restore-row {
  margin-top: 14px;
  flex-direction: row;
  justify-content: center;
  gap: 12px;
}
</style>
