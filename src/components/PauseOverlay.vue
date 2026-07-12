<script setup>
import { playerStore } from '../stores/playerStore'
import { EventBus } from '../game/EventBus'

function resume() {
  playerStore.paused = false
  EventBus.emit('resume-game')
}

function openStore() {
  playerStore.storeReturnsTo = 'game'
  playerStore.screen = 'store'
}

function openMap() {
  playerStore.screen = 'map'
}

function openCargo() {
  playerStore.screen = 'cargo'
}

function quit() {
  playerStore.paused = false
  playerStore.screen = 'menu'
  EventBus.emit('quit-to-menu')
}
</script>

<template>
  <div class="screen pause">
    <h2 class="heading">PAUSED</h2>
    <div class="buttons">
      <button class="retro-btn" @pointerup="resume">Resume</button>
      <button class="retro-btn" @pointerup="openMap">Map</button>
      <button class="retro-btn" @pointerup="openCargo">Cargo</button>
      <button class="retro-btn" @pointerup="openStore">Store</button>
      <button class="retro-btn" @pointerup="quit">Quit</button>
    </div>
  </div>
</template>

<style scoped>
.pause {
  background: var(--panel);
  backdrop-filter: blur(2px);
  gap: 20px;
}

.heading {
  font-size: clamp(20px, 4vw, 34px);
  letter-spacing: 0.5em;
  text-indent: 0.5em;
  text-shadow: 0 0 12px rgba(125, 255, 216, 0.7);
}

.buttons {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>
