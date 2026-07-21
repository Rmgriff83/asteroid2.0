<script setup>
import { onMounted, onBeforeUnmount } from 'vue'
import { playerStore } from '../stores/playerStore'

const TITLE = 'DEEPFIELD'
let timer = null

function goMenu() {
  playerStore.screen = 'menu'
}

onMounted(() => {
  timer = setTimeout(goMenu, 3200)
})

onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <div class="screen splash" @click="goMenu">
    <div class="ring"></div>
    <h1 class="title">
      <span
        v-for="(ch, i) in TITLE"
        :key="i"
        class="letter"
        :class="{ space: ch === ' ' }"
        :style="{ animationDelay: `${0.25 + i * 0.09}s` }"
        >{{ ch === ' ' ? ' ' : ch }}</span
      >
    </h1>
    <p class="tagline">drift &middot; shatter &middot; wander</p>
    <p class="hint">tap to begin</p>
  </div>
</template>

<style scoped>
.splash {
  background: transparent;
  cursor: pointer;
}

.title {
  display: flex;
  font-size: clamp(28px, 7vw, 64px);
  font-weight: 700;
  letter-spacing: 0.12em;
  color: var(--ink);
  z-index: 1;
}

.letter {
  opacity: 0;
  animation: letter-in 0.5s cubic-bezier(0.2, 0.9, 0.3, 1.2) forwards;
  text-shadow:
    0 0 10px rgba(125, 255, 216, 0.8),
    0 0 30px rgba(125, 255, 216, 0.35);
}

@keyframes letter-in {
  0% {
    opacity: 0;
    transform: translateY(26px) scale(1.6);
    filter: blur(6px);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
    filter: blur(0);
  }
}

.ring {
  position: absolute;
  width: 40vmin;
  height: 40vmin;
  border: 1px solid rgba(125, 255, 216, 0.5);
  border-radius: 50%;
  animation: ring-out 2.6s ease-out 0.4s infinite;
  opacity: 0;
}

@keyframes ring-out {
  0% {
    transform: scale(0.2);
    opacity: 0.7;
  }
  100% {
    transform: scale(1.8);
    opacity: 0;
  }
}

.tagline {
  margin-top: 18px;
  font-size: clamp(11px, 2vw, 15px);
  letter-spacing: 0.5em;
  color: var(--mint);
  opacity: 0;
  animation: fade-in 0.8s ease 1.7s forwards;
}

.hint {
  position: absolute;
  bottom: calc(28px + var(--sab));
  font-size: 12px;
  letter-spacing: 0.3em;
  color: var(--ink);
  opacity: 0;
  animation: fade-blink 1.6s ease 2.4s infinite;
}

@keyframes fade-in {
  to {
    opacity: 0.9;
  }
}

@keyframes fade-blink {
  0%,
  100% {
    opacity: 0.15;
  }
  50% {
    opacity: 0.85;
  }
}
</style>
