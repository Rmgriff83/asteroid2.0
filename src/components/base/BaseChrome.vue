<script setup>
// Outpost interior chrome (art layer), rendered twice by BaseShell:
// layer="dash" — the hab walls around the window, the sill counter, and the
//   ops-console binnacle (derived from the skin's rects so art and the live
//   mount can't drift). Drawn BEHIND the console content.
// layer="fore" — the window mullions and sill rail, drawn IN FRONT so they
//   read as nearer than the console glass.
// Geometry lives in the 1760×1080 stage space.
import { computed } from 'vue'

const props = defineProps({
  layer: { type: String, default: 'dash' }, // 'dash' | 'fore'
  accent: { type: String, default: '#cdbfa8' },
  accentDim: { type: String, default: '#6b6254' },
  warn: { type: String, default: '#e0a850' },
  warnDim: { type: String, default: '#8a6d34' },
  window: {
    type: Object,
    default: () => ({ x: 120, y: 60, w: 1520, h: 560 }),
  },
  consoles: {
    type: Object,
    default: () => ({ ops: { x: 1150, y: 680, w: 480, h: 320 } }),
  },
})

function housing(rect) {
  const m = 16
  return { x: rect.x - m, y: rect.y - m, w: rect.w + m * 2, h: rect.h + m * 2 }
}

const opsBox = computed(() => housing(props.consoles.ops))
const win = computed(() => props.window)
const sillY = computed(() => win.value.y + win.value.h)
</script>

<template>
  <!-- ============ DASH LAYER: hab walls + sill + console ============ -->
  <g v-if="layer === 'dash'">
    <!-- opaque hab shell everywhere the window isn't: header, flanks, deck -->
    <rect x="0" y="0" width="1760" :height="win.y" fill="#0b1219" />
    <rect x="0" :y="win.y" :width="win.x" :height="win.h" fill="#0b1219" />
    <rect :x="win.x + win.w" :y="win.y" :width="1760 - win.x - win.w" :height="win.h" fill="#0b1219" />
    <rect x="0" :y="sillY" width="1760" :height="1080 - sillY" fill="#0b1219" />

    <!-- header beam seams + rivets -->
    <line x1="0" :y1="win.y - 8" x2="1760" :y2="win.y - 8" :stroke="accentDim" stroke-width="2" />
    <line x1="0" :y1="win.y - 26" x2="1760" :y2="win.y - 26" stroke="#1d2b26" stroke-width="1.2" />
    <g :fill="accentDim" opacity=".6">
      <circle v-for="i in 8" :key="i" :cx="140 + (i - 1) * 212" :cy="win.y - 17" r="2.4" />
    </g>

    <!-- window aperture frame -->
    <rect
      :x="win.x - 6" :y="win.y - 6" :width="win.w + 12" :height="win.h + 12"
      rx="18" fill="none" :stroke="accent" stroke-width="2.6" opacity=".9"
    />
    <rect
      :x="win.x + 6" :y="win.y + 6" :width="win.w - 12" :height="win.h - 12"
      rx="12" fill="none" stroke="#1d2b26" stroke-width="1.4"
    />

    <!-- sill counter: the work surface under the window -->
    <polygon
      :points="`0,${sillY + 46} 220,${sillY} 1540,${sillY} 1760,${sillY + 46} 1760,1080 0,1080`"
      fill="#0a1017"
    />
    <polyline
      :points="`0,${sillY + 46} 220,${sillY} 1540,${sillY} 1760,${sillY + 46}`"
      fill="none" :stroke="accentDim" stroke-width="2" stroke-linejoin="round"
    />
    <line x1="220" :y1="sillY" x2="330" :y2="sillY" :stroke="warnDim" stroke-width="2" opacity=".9" />
    <line x1="1430" :y1="sillY" x2="1540" :y2="sillY" :stroke="warnDim" stroke-width="2" opacity=".9" />

    <!-- ops console binnacle: dark glass — the live console mounts here -->
    <rect :x="opsBox.x" :y="opsBox.y" :width="opsBox.w" :height="opsBox.h" rx="14" fill="#04080a" :stroke="accentDim" stroke-width="2.4" />
    <rect :x="opsBox.x + 8" :y="opsBox.y + 8" :width="opsBox.w - 16" :height="opsBox.h - 16" rx="10" fill="none" stroke="#1d2b26" stroke-width="1.2" />
    <g :fill="accentDim" opacity=".7">
      <circle :cx="opsBox.x + 12" :cy="opsBox.y + 12" r="2.2" />
      <circle :cx="opsBox.x + opsBox.w - 12" :cy="opsBox.y + 12" r="2.2" />
      <circle :cx="opsBox.x + 12" :cy="opsBox.y + opsBox.h - 12" r="2.2" />
      <circle :cx="opsBox.x + opsBox.w - 12" :cy="opsBox.y + opsBox.h - 12" r="2.2" />
    </g>

    <!-- deck-face vents + supply crate silhouettes on the left -->
    <g :stroke="accentDim" stroke-width="1.4" opacity=".55">
      <line x1="24" :y1="sillY + 88" x2="116" :y2="sillY + 80" />
      <line x1="24" :y1="sillY + 106" x2="116" :y2="sillY + 98" />
      <line x1="24" :y1="sillY + 124" x2="116" :y2="sillY + 116" />
    </g>
    <g fill="#0a1017" :stroke="accentDim" stroke-width="1.6" opacity=".85">
      <rect x="620" :y="sillY + 120" width="150" height="104" rx="6" />
      <rect x="660" :y="sillY + 44" width="120" height="76" rx="6" />
      <line x1="620" :y1="sillY + 172" x2="770" :y2="sillY + 172" />
      <line x1="660" :y1="sillY + 82" x2="780" :y2="sillY + 82" />
    </g>
    <!-- a warn lamp over the crates -->
    <circle cx="700" :cy="sillY + 28" r="4" :fill="warn" opacity=".9" />

    <line x1="0" y1="1042" x2="1760" y2="1042" stroke="#141d24" stroke-width="2" />
  </g>

  <!-- ============ FORE LAYER: mullions + sill rail ============ -->
  <g v-else :stroke="accent" stroke-linecap="round">
    <!-- window mullions: three struts, bolted top and bottom -->
    <g stroke-width="2" opacity=".55">
      <line :x1="win.x + win.w * 0.25" :y1="win.y" :x2="win.x + win.w * 0.25" :y2="sillY" />
      <line :x1="win.x + win.w * 0.5" :y1="win.y" :x2="win.x + win.w * 0.5" :y2="sillY" />
      <line :x1="win.x + win.w * 0.75" :y1="win.y" :x2="win.x + win.w * 0.75" :y2="sillY" />
    </g>
    <g :fill="accentDim" stroke="none" opacity=".8">
      <template v-for="f in [0.25, 0.5, 0.75]" :key="f">
        <circle :cx="win.x + win.w * f" :cy="win.y + 10" r="3" />
        <circle :cx="win.x + win.w * f" :cy="sillY - 10" r="3" />
      </template>
    </g>
    <!-- low sill rail with supports -->
    <line :x1="win.x + 30" :y1="sillY - 34" :x2="win.x + win.w - 30" :y2="sillY - 34" stroke-width="2.2" opacity=".8" />
    <g :stroke="accentDim" stroke-width="1.6" opacity=".7">
      <line v-for="i in 6" :key="i" :x1="win.x + 60 + (i - 1) * ((win.w - 120) / 5)" :y1="sillY - 34" :x2="win.x + 60 + (i - 1) * ((win.w - 120) / 5)" :y2="sillY" />
    </g>
  </g>
</template>
