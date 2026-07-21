<script setup>
import { playerStore } from '../stores/playerStore'
import { EventBus } from '../game/EventBus'
import { isAdminEnabled } from '../game/galaxy/authored'

const adminEnabled = isAdminEnabled()

function openAdmin() {
  playerStore.screen = 'admin'
}

function play() {
  playerStore.paused = false
  playerStore.screen = 'game'
  EventBus.emit('start-game')
}

function openStore() {
  playerStore.storeReturnsTo = 'menu'
  playerStore.screen = 'store'
}

function openHangar() {
  playerStore.hangarReturnsTo = 'menu'
  playerStore.screen = 'hangar'
}
</script>

<template>
  <div class="screen menu">
    <h1 class="title">DEEPFIELD</h1>
    <p class="points-chip">{{ String(playerStore.points).padStart(6, '0') }} PTS</p>
    <div class="buttons">
      <button class="retro-btn" @pointerup="play">Play</button>
      <button class="retro-btn" @pointerup="openHangar">Hangar</button>
      <button class="retro-btn" @pointerup="openStore">Store</button>
      <button v-if="adminEnabled" class="retro-btn admin-btn" @pointerup="openAdmin">
        Admin
      </button>
    </div>
  </div>
</template>

<style scoped>
.menu {
  background: transparent;
  gap: 18px;
}

.title {
  font-size: clamp(26px, 6vw, 54px);
  font-weight: 700;
  letter-spacing: 0.14em;
  text-shadow:
    0 0 10px rgba(125, 255, 216, 0.8),
    0 0 30px rgba(125, 255, 216, 0.3);
  animation: hover-drift 5s ease-in-out infinite;
}

@keyframes hover-drift {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-7px);
  }
}

.buttons {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-top: 16px;
}

.admin-btn {
  border-color: rgba(255, 179, 92, 0.5);
  color: var(--amber);
  font-size: 13px;
  padding: 8px 24px;
}
</style>
