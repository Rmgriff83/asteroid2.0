<script setup>
// Decoration slots positioned from the base skin (stage space) — the base
// cousin of the cockpit TrinketLayer, but LIVE: slots are tap targets. An
// empty slot renders as a dashed hook/outline; a filled one renders its
// trinket art (hanging pieces sway, gated by prefers-reduced-motion).
import { onMounted, onBeforeUnmount, ref } from 'vue'
import { EventBus } from '../../game/EventBus'
import TrinketArt from './TrinketArt.vue'

defineProps({
  trinkets: { type: Array, default: () => [] }, // skin slot areas
  placements: { type: Object, default: null }, // base.trinkets {slotKey: id}
  interactive: { type: Boolean, default: false },
})

const emit = defineEmits(['slot-tap'])

// a purchase pulses the open slots so newcomers learn where placements live
const pulsing = ref(false)
let pulseTimer = 0
const onBought = () => {
  pulsing.value = false
  requestAnimationFrame(() => (pulsing.value = true))
  clearTimeout(pulseTimer)
  pulseTimer = setTimeout(() => (pulsing.value = false), 2800)
}
onMounted(() => EventBus.on('trinket-bought', onBought))
onBeforeUnmount(() => {
  clearTimeout(pulseTimer)
  EventBus.off('trinket-bought', onBought)
})

// hang points spread across the rail, centered (cockpit spacing)
function hangOffsets(slots) {
  const n = Math.max(1, slots || 1)
  const spacing = 84
  return Array.from({ length: n }, (_, i) => (i - (n - 1) / 2) * spacing)
}

function tap(area, i, placed) {
  emit('slot-tap', { key: `${area.id}:${i}`, kind: area.kind, placed })
}
</script>

<template>
  <div class="trinkets" :class="{ pulsing }">
    <template v-for="a in trinkets" :key="a.id">
      <!-- hanging rail over the window -->
      <div v-if="a.kind === 'hanging'" class="hanging" :style="{ left: a.x + 'px', top: a.y + 'px' }">
        <svg :width="hangOffsets(a.slots).length * 84 + 60" height="26" class="rail"
          :viewBox="`0 0 ${hangOffsets(a.slots).length * 84 + 60} 26`"
          :style="{ marginLeft: -(hangOffsets(a.slots).length * 84 + 60) / 2 + 'px' }">
          <line x1="10" y1="12" :x2="hangOffsets(a.slots).length * 84 + 50" y2="12" stroke="var(--bs-accent-dim, #6b6254)" stroke-width="1.6" />
          <circle cx="10" cy="12" r="2.4" fill="var(--bs-accent-dim, #6b6254)" />
          <circle :cx="hangOffsets(a.slots).length * 84 + 50" cy="12" r="2.4" fill="var(--bs-accent-dim, #6b6254)" />
        </svg>
        <template v-for="(dx, i) in hangOffsets(a.slots)" :key="i">
          <div
            v-if="placements?.[`${a.id}:${i}`]"
            class="charm"
            :class="{ tappable: interactive }"
            :style="{ marginLeft: dx + 'px', animationDuration: (a.swayS || 6) + (i % 2) * 0.8 + 's' }"
            @pointerup.stop="tap(a, i, true)"
          >
            <div class="string"></div>
            <TrinketArt class="charm-art" :id="placements[`${a.id}:${i}`]" />
          </div>
          <div
            v-else
            class="hook"
            :class="{ tappable: interactive }"
            :style="{ marginLeft: dx + 'px' }"
            @pointerup.stop="tap(a, i, false)"
          >
            <div class="hook-string"></div>
            <div class="hook-ring"></div>
          </div>
        </template>
      </div>

      <!-- sill shelf -->
      <div v-else-if="a.kind === 'shelf'" class="shelf" :style="{ left: a.x + 'px', top: a.y + 'px' }">
        <svg :width="hangOffsets(a.slots).length * 84 + 60" height="14" class="board"
          :viewBox="`0 0 ${hangOffsets(a.slots).length * 84 + 60} 14`"
          :style="{ marginLeft: -(hangOffsets(a.slots).length * 84 + 60) / 2 + 'px' }">
          <line x1="4" y1="4" :x2="hangOffsets(a.slots).length * 84 + 56" y2="4" stroke="var(--bs-accent-dim, #6b6254)" stroke-width="2" />
          <line x1="16" y1="4" x2="10" y2="14" stroke="var(--bs-accent-dim, #6b6254)" stroke-width="1.2" />
          <line :x1="hangOffsets(a.slots).length * 84 + 44" y1="4" :x2="hangOffsets(a.slots).length * 84 + 50" y2="14" stroke="var(--bs-accent-dim, #6b6254)" stroke-width="1.2" />
        </svg>
        <template v-for="(dx, i) in hangOffsets(a.slots)" :key="i">
          <div
            v-if="placements?.[`${a.id}:${i}`]"
            class="piece"
            :class="{ tappable: interactive }"
            :style="{ marginLeft: dx + 'px' }"
            @pointerup.stop="tap(a, i, true)"
          >
            <TrinketArt :id="placements[`${a.id}:${i}`]" />
          </div>
          <div
            v-else
            class="spot"
            :class="{ tappable: interactive }"
            :style="{ marginLeft: dx + 'px' }"
            @pointerup.stop="tap(a, i, false)"
          ></div>
        </template>
      </div>
    </template>
  </div>
</template>

<style scoped>
.trinkets {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.hanging,
.shelf {
  position: absolute;
  filter: drop-shadow(0 0 3px rgba(var(--bs-accent-rgb, 205, 191, 168), 0.35));
}

.tappable {
  pointer-events: auto;
  cursor: pointer;
  position: absolute;
}

/* invisible fat hit pad — the dashed marks are tiny, thumbs are not */
.tappable::after {
  content: '';
  position: absolute;
  inset: -16px;
}

/* hooks are 1px-wide strings — pad extra sideways */
.hook.tappable::after {
  inset: -16px -26px;
}

.charm {
  position: absolute;
  left: 0;
  top: 12px;
  transform-origin: top center;
  animation: base-trinket-sway 6s ease-in-out infinite;
}

.string {
  width: 1px;
  height: 26px;
  background: var(--bs-accent-dim, #6b6254);
  margin: 0 auto;
}

.charm-art {
  margin-left: -26px;
}

@keyframes base-trinket-sway {
  0%, 100% { transform: rotate(-4deg); }
  50% { transform: rotate(4deg); }
}

.hook {
  position: absolute;
  left: 0;
  top: 12px;
  opacity: 0.55;
}

.hook-string {
  width: 1px;
  height: 14px;
  background: var(--bs-accent-dim, #6b6254);
  margin: 0 auto;
}

.hook-ring {
  width: 14px;
  height: 14px;
  margin-left: -7px;
  border: 1px dashed var(--bs-accent-dim, #6b6254);
  border-radius: 50%;
}

.hook.tappable:hover .hook-ring {
  border-color: var(--bs-accent, #cdbfa8);
}

.piece {
  position: absolute;
  left: 0;
  top: 0;
  transform: translate(-26px, -60px); /* art sits ON the board line */
}

.spot {
  position: absolute;
  left: 0;
  top: 0;
  width: 30px;
  height: 30px;
  transform: translate(-15px, -34px);
  border: 1px dashed var(--bs-accent-dim, #6b6254);
  border-radius: 4px;
  opacity: 0.45;
}

.spot.tappable:hover {
  border-color: var(--bs-accent, #cdbfa8);
  opacity: 0.8;
}

/* post-purchase attention pulse on the open slots */
.pulsing .hook-ring,
.pulsing .spot {
  border-color: var(--bs-warn, #e0a850);
  animation: slot-pulse 0.9s ease-in-out 3;
}

.pulsing .hook,
.pulsing .spot {
  opacity: 1;
}

@keyframes slot-pulse {
  0%, 100% { box-shadow: none; }
  50% { box-shadow: 0 0 12px rgba(224, 168, 80, 0.85); }
}

@media (prefers-reduced-motion: reduce) {
  .charm { animation: none; }

  .pulsing .hook-ring,
  .pulsing .spot {
    animation: none; /* static amber highlight only */
  }
}
</style>
