<script setup>
// Live dashboard instrumentation (invariant across ships — the skin only
// places them via the `instruments` anchor list). The base hull uses a fuel
// dial in the systems console; `leds` remains available for future skins.
// Credits/sector/dock readouts live in the cargo console (GlanceScreen).
import { computed } from 'vue'
import { playerStore } from '../../stores/playerStore'
import { getModifiers } from '../../game/systems/modifiers'

const props = defineProps({
  instruments: { type: Array, default: () => [] },
})

const mods = computed(() => getModifiers(playerStore.perks))
const fuelFrac = computed(() => Math.max(0, Math.min(1, playerStore.fuel / mods.value.fuelMax)))

// gauge sweep: 270° from lower-left (135°) over the top to lower-right (45°)
function polar(cx, cy, r, deg) {
  const a = (deg * Math.PI) / 180
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }
}

function arcPath(cx, cy, r, fromDeg, toDeg) {
  const a = polar(cx, cy, r, fromDeg)
  const b = polar(cx, cy, r, toDeg)
  const large = toDeg - fromDeg > 180 ? 1 : 0
  return `M ${a.x.toFixed(1)} ${a.y.toFixed(1)} A ${r} ${r} 0 ${large} 1 ${b.x.toFixed(1)} ${b.y.toFixed(1)}`
}

function needleEnd(inst) {
  return polar(inst.x, inst.y, inst.r - 14, 135 + fuelFrac.value * 270)
}

function tickPts(inst, frac) {
  const deg = 135 + frac * 270
  return { a: polar(inst.x, inst.y, inst.r, deg), b: polar(inst.x, inst.y, inst.r - 8, deg) }
}

const TICK_FRACS = [0, 0.25, 0.5, 0.75, 1]
</script>

<template>
  <g class="instruments">
    <template v-for="inst in instruments" :key="inst.id">
      <!-- FUEL dial -->
      <g v-if="inst.kind === 'dial'" class="dial">
        <circle :cx="inst.x" :cy="inst.y" :r="inst.r + 12" fill="#060b0f" stroke="#1d2b26" stroke-width="1.4" />
        <path :d="arcPath(inst.x, inst.y, inst.r, 135, 405)" fill="none" stroke="var(--ck-accent-dim)" stroke-width="2" />
        <!-- low-fuel zone -->
        <path :d="arcPath(inst.x, inst.y, inst.r, 135, 189)" fill="none" stroke="var(--ck-warn)" stroke-width="3" opacity=".8" />
        <g stroke="var(--ck-accent-dim)" stroke-width="1.4">
          <line
            v-for="f in TICK_FRACS"
            :key="f"
            :x1="tickPts(inst, f).a.x" :y1="tickPts(inst, f).a.y"
            :x2="tickPts(inst, f).b.x" :y2="tickPts(inst, f).b.y"
          />
        </g>
        <line
          :x1="inst.x" :y1="inst.y"
          :x2="needleEnd(inst).x" :y2="needleEnd(inst).y"
          :stroke="fuelFrac <= 0.2 ? 'var(--ck-warn)' : 'var(--ck-accent)'"
          stroke-width="2.4" stroke-linecap="round"
        />
        <circle :cx="inst.x" :cy="inst.y" r="5" fill="#0a1017" stroke="var(--ck-accent)" stroke-width="1.6" />
        <text :x="inst.x" :y="inst.y + inst.r + 34" text-anchor="middle" class="ilabel">FUEL</text>
        <text :x="inst.x" :y="inst.y + inst.r - 16" text-anchor="middle" class="ivalue">
          {{ Math.round(playerStore.fuel) }}
        </text>
      </g>

      <!-- status LEDs -->
      <g v-else-if="inst.kind === 'leds'">
        <circle
          v-for="i in inst.n || 3"
          :key="i"
          :cx="inst.x + (i - 1) * 24" :cy="inst.y" r="4.5"
          :fill="i === 1 ? 'var(--ck-warn)' : 'var(--ck-accent)'"
          class="led"
          :style="{ animationDelay: i * 0.9 + 's' }"
        />
      </g>
    </template>
  </g>
</template>

<style scoped>
.ilabel {
  font-family: 'Space Mono', monospace;
  font-size: 15px;
  letter-spacing: 2px;
  fill: #6f7a74;
}

.ivalue {
  font-family: 'Space Mono', monospace;
  font-size: 20px;
  font-weight: 700;
  fill: #dfe4e0;
}

.led {
  animation: led-blink 2.8s steps(1) infinite;
}

@keyframes led-blink {
  0%, 78% { opacity: 1; }
  79%, 88% { opacity: 0.25; }
  89%, 100% { opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
  .led {
    animation: none;
  }
}
</style>
