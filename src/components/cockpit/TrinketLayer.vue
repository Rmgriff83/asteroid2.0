<script setup>
// Trinket placeholders positioned from the skin (stage space).
// kinds: 'hanging' — the rearview bracket with `slots` hang points (the first
// holds the placeholder charm; the rest render as open hooks awaiting
// collected charms), 'bobble' — the bobble-head perch on the dash.
// Intended to become drag-drop targets later; no interactivity yet.
defineProps({
  trinkets: { type: Array, default: () => [] },
})

// hang points spread across the bracket, centered
function hangOffsets(slots) {
  const n = Math.max(1, slots || 1)
  const spacing = 64
  return Array.from({ length: n }, (_, i) => (i - (n - 1) / 2) * spacing)
}
</script>

<template>
  <div class="trinkets">
    <template v-for="t in trinkets" :key="t.id">
      <!-- rearview bracket with hang points -->
      <div v-if="t.kind === 'hanging'" class="hanging" :style="{ left: t.x + 'px', top: t.y + 'px' }">
        <svg width="220" height="70" viewBox="0 0 220 70" class="bracket">
          <rect x="20" y="14" width="180" height="40" rx="12" fill="#0a1017" stroke="var(--ck-accent, #5fd9a0)" stroke-width="1.4" />
          <rect x="34" y="24" width="152" height="20" rx="6" fill="none" stroke="var(--ck-accent-dim, #2f8f70)" stroke-width="1" />
          <line x1="110" y1="0" x2="110" y2="16" stroke="var(--ck-accent-dim, #2f8f70)" stroke-width="1.4" />
        </svg>
        <template v-for="(dx, i) in hangOffsets(t.slots)" :key="i">
          <!-- first hang point: the placeholder charm -->
          <div
            v-if="i === 0"
            class="charm"
            :style="{ marginLeft: dx + 'px', animationDuration: (t.swayS || 5.5) + 's' }"
          >
            <div class="string"></div>
            <svg width="52" height="60" viewBox="0 0 52 60" class="charm-art">
              <polygon points="26,4 40,26 30,26 44,48 8,48 22,26 12,26" fill="none" stroke="#7fbf6a" stroke-width="1.4" />
              <rect x="22" y="48" width="8" height="9" fill="none" stroke="#7fbf6a" stroke-width="1.2" />
            </svg>
          </div>
          <!-- open hook: an available hanging slot -->
          <div v-else class="hook" :style="{ marginLeft: dx + 'px' }">
            <div class="hook-string"></div>
            <div class="hook-ring"></div>
          </div>
        </template>
      </div>

      <!-- bobble-head on its dash perch -->
      <svg
        v-else-if="t.kind === 'bobble'"
        class="bobble"
        width="90" height="120" viewBox="0 0 90 120"
        :style="{ left: t.x + 'px', top: t.y + 'px' }"
      >
        <ellipse cx="45" cy="108" rx="26" ry="7" fill="none" stroke="var(--ck-warn-dark, #5f4b24)" stroke-width="1" />
        <line x1="45" y1="70" x2="45" y2="104" stroke="#b07fd6" stroke-width="1.4" />
        <circle cx="45" cy="44" r="30" fill="#0a1017" stroke="#b07fd6" stroke-width="1.4" />
        <ellipse cx="45" cy="44" rx="18" ry="26" fill="none" stroke="#b07fd6" stroke-width="1" opacity=".6" />
        <circle cx="37" cy="40" r="3" fill="#b07fd6" /><circle cx="55" cy="40" r="3" fill="#b07fd6" />
      </svg>
    </template>
  </div>
</template>

<style scoped>
.trinkets {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.hanging {
  position: absolute;
  transform: translateX(-50%);
  filter: drop-shadow(0 0 3px var(--ck-accent, #5fd9a0));
}

.charm {
  position: absolute;
  left: 50%;
  top: 48px;
  transform-origin: top center;
  animation: trinket-sway 5.5s ease-in-out infinite;
  filter: drop-shadow(0 0 4px #7fbf6a);
}

.string {
  width: 1px;
  height: 52px;
  background: var(--ck-accent-dim, #2f8f70);
  margin: 0 auto;
}

.charm-art {
  margin-left: -26px;
}

@keyframes trinket-sway {
  0%, 100% { transform: rotate(-5deg); }
  50% { transform: rotate(5deg); }
}

/* an open hang point: short string + empty dashed ring */
.hook {
  position: absolute;
  left: 50%;
  top: 48px;
  opacity: 0.55;
}

.hook-string {
  width: 1px;
  height: 18px;
  background: var(--ck-accent-dim, #2f8f70);
  margin: 0 auto;
}

.hook-ring {
  width: 14px;
  height: 14px;
  margin-left: -7px;
  border: 1px dashed var(--ck-accent-dim, #2f8f70);
  border-radius: 50%;
}

.bobble {
  position: absolute;
  transform: translate(-50%, -100%);
  filter: drop-shadow(0 0 3px #b07fd6);
}

@media (prefers-reduced-motion: reduce) {
  .charm { animation: none; }
}
</style>
