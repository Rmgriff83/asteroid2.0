<script setup>
// Base-hull cockpit chrome (per-ship art layer), rendered twice by the shell:
// layer="dash" — the full-width dashboard deck and the two console binnacles
//   (derived from the skin's `consoles` rects so art and the live mounts
//   can't drift). Drawn BEHIND the console content.
// layer="fore" — the flight yoke, drawn IN FRONT of the deck.
// Geometry lives in the 1760×1080 stage space; the yoke re-anchors from
// `yoke` so a skin can shift the column without redrawing it. Canopy struts
// come from CockpitWindow's glass-fx layer, not from here.
import { computed } from 'vue'

const props = defineProps({
  layer: { type: String, default: 'fore' }, // 'dash' | 'fore'
  accent: { type: String, default: '#5fd9a0' },
  accentBright: { type: String, default: '#8ce8bc' },
  accentDim: { type: String, default: '#2f8f70' },
  warn: { type: String, default: '#e0a850' },
  warnDim: { type: String, default: '#8a6d34' },
  yoke: { type: Object, default: () => ({ x: 880, y: 930 }) },
  consoles: {
    type: Object,
    default: () => ({
      systems: { x: 140, y: 640, w: 440, h: 300 },
      cargo: { x: 1140, y: 640, w: 480, h: 300 },
    }),
  },
})

// binnacle housings drawn around the console rects with a fixed margin
function housing(rect) {
  const m = 16
  return { x: rect.x - m, y: rect.y - m, w: rect.w + m * 2, h: rect.h + m * 2 }
}

const sysBox = computed(() => housing(props.consoles.systems))
const cargoBox = computed(() => housing(props.consoles.cargo))
</script>

<template>
  <!-- ============ DASH LAYER ============ -->
  <g v-if="layer === 'dash'">
    <!-- deck: lowered so the windshield breathes; consoles rise above it -->
    <polygon
      points="0,780 300,700 1460,700 1760,780 1760,1080 0,1080"
      fill="#0b1219"
    />
    <!-- top edge seams -->
    <g fill="none">
      <polyline points="0,780 300,700 1460,700 1760,780" :stroke="accentDim" stroke-width="2" stroke-linejoin="round" />
      <polyline points="0,802 310,724 1450,724 1760,802" stroke="#1d2b26" stroke-width="1.4" stroke-linejoin="round" />
      <!-- warn trim: two short amber accents at the deck corners -->
      <line x1="300" y1="700" x2="390" y2="700" :stroke="warnDim" stroke-width="2" opacity=".9" />
      <line x1="1370" y1="700" x2="1460" y2="700" :stroke="warnDim" stroke-width="2" opacity=".9" />
    </g>

    <!-- systems console binnacle (fuel + trinket dock) -->
    <rect :x="sysBox.x" :y="sysBox.y" :width="sysBox.w" :height="sysBox.h" rx="14" fill="#0a1017" :stroke="accentDim" stroke-width="2" />
    <rect :x="sysBox.x + 8" :y="sysBox.y + 8" :width="sysBox.w - 16" :height="sysBox.h - 16" rx="10" fill="none" stroke="#1d2b26" stroke-width="1.2" />

    <!-- cargo console binnacle: dark glass — the glance content mounts here -->
    <rect :x="cargoBox.x" :y="cargoBox.y" :width="cargoBox.w" :height="cargoBox.h" rx="14" fill="#04080a" :stroke="accentDim" stroke-width="2.4" />
    <rect :x="cargoBox.x + 8" :y="cargoBox.y + 8" :width="cargoBox.w - 16" :height="cargoBox.h - 16" rx="10" fill="none" stroke="#1d2b26" stroke-width="1.2" />

    <!-- corner screws on both binnacles -->
    <g :fill="accentDim" opacity=".7">
      <template v-for="b in [sysBox, cargoBox]" :key="b.x">
        <circle :cx="b.x + 12" :cy="b.y + 12" r="2.2" />
        <circle :cx="b.x + b.w - 12" :cy="b.y + 12" r="2.2" />
        <circle :cx="b.x + 12" :cy="b.y + b.h - 12" r="2.2" />
        <circle :cx="b.x + b.w - 12" :cy="b.y + b.h - 12" r="2.2" />
      </template>
    </g>

    <!-- deck-face vents at the outer edges -->
    <g :stroke="accentDim" stroke-width="1.4" opacity=".55">
      <line x1="24" y1="828" x2="116" y2="820" />
      <line x1="24" y1="846" x2="116" y2="838" />
      <line x1="24" y1="864" x2="116" y2="856" />
    </g>
    <g :stroke="accentDim" stroke-width="1.4" opacity=".55">
      <line x1="1644" y1="820" x2="1736" y2="828" />
      <line x1="1644" y1="838" x2="1736" y2="846" />
      <line x1="1644" y1="856" x2="1736" y2="864" />
    </g>

    <!-- lower dash face seam -->
    <line x1="0" y1="1010" x2="1760" y2="1010" stroke="#141d24" stroke-width="2" />
  </g>

  <!-- ============ FORE LAYER: steering yoke ============ -->
  <g
    v-else
    class="yoke"
    :transform="`translate(${yoke.x - 880} ${yoke.y - 900})`"
    :stroke="accent"
    stroke-linejoin="round"
    stroke-linecap="round"
  >
    <!-- rim glow underlay + double rim -->
    <rect x="636" y="754" width="488" height="236" rx="96" ry="86" fill="none" stroke-width="9" opacity=".2" />
    <rect x="636" y="754" width="488" height="236" rx="96" ry="86" fill="none" stroke-width="2.6" />
    <rect x="656" y="774" width="448" height="196" rx="78" ry="68" fill="none" :stroke="accentDim" stroke-width="1.4" opacity=".8" />
    <!-- rim segment ticks (top) -->
    <g :stroke="accentDim" stroke-width="1.2" opacity=".65">
      <line x1="800" y1="756" x2="800" y2="772" /><line x1="840" y1="753" x2="840" y2="769" />
      <line x1="880" y1="752" x2="880" y2="768" /><line x1="920" y1="753" x2="920" y2="769" /><line x1="960" y1="756" x2="960" y2="772" />
    </g>
    <!-- left grip -->
    <rect x="616" y="822" width="60" height="132" rx="28" fill="#0a1017" stroke-width="2.2" />
    <g :stroke="accentDim" stroke-width="1.4"><line x1="628" y1="852" x2="664" y2="852" /><line x1="628" y1="874" x2="664" y2="874" /><line x1="628" y1="896" x2="664" y2="896" /></g>
    <circle cx="646" cy="812" r="7" fill="#0a1017" stroke-width="1.6" />
    <!-- right grip -->
    <rect x="1084" y="822" width="60" height="132" rx="28" fill="#0a1017" stroke-width="2.2" />
    <g :stroke="accentDim" stroke-width="1.4"><line x1="1096" y1="852" x2="1132" y2="852" /><line x1="1096" y1="874" x2="1132" y2="874" /><line x1="1096" y1="896" x2="1132" y2="896" /></g>
    <circle cx="1114" cy="812" r="7" fill="#0a1017" stroke-width="1.6" />
    <!-- spokes -->
    <g stroke-width="2">
      <line x1="676" y1="852" x2="792" y2="852" /><line x1="676" y1="876" x2="792" y2="876" />
      <line x1="1084" y1="852" x2="968" y2="852" /><line x1="1084" y1="876" x2="968" y2="876" />
      <line x1="852" y1="912" x2="852" y2="968" /><line x1="908" y1="912" x2="908" y2="968" />
    </g>
    <!-- hub housing + readout strip -->
    <rect x="788" y="806" width="184" height="116" rx="16" fill="#0a1017" stroke-width="2.2" />
    <rect x="804" y="816" width="152" height="22" rx="3" fill="none" :stroke="accentDim" stroke-width="1.2" />
    <g stroke="#7fbf6a" stroke-width="1.4"><line x1="812" y1="833" x2="812" y2="821" /><line x1="822" y1="833" x2="822" y2="826" /><line x1="832" y1="833" x2="832" y2="823" /><line x1="842" y1="833" x2="842" y2="828" /></g>
    <!-- button cluster -->
    <circle cx="820" cy="864" r="7" fill="none" stroke-width="1.6" /><circle cx="844" cy="864" r="7" fill="none" stroke-width="1.6" /><circle cx="868" cy="864" r="7" fill="none" stroke-width="1.6" />
    <circle cx="820" cy="888" r="7" fill="none" stroke-width="1.6" /><circle cx="844" cy="888" r="7" fill="none" stroke-width="1.6" /><circle cx="868" cy="888" r="7" fill="none" stroke-width="1.6" />
    <!-- d-pad + emblem (emblem stays warn amber — the one jewel on the wheel) -->
    <path d="M916 858 h16 v-10 h14 v10 h16 v14 h-16 v10 h-14 v-10 h-16 z" fill="none" stroke-width="1.6" />
    <circle cx="946" cy="900" r="5" :fill="warn" stroke="none" />
    <!-- column toward the floor -->
    <g stroke-width="2"><path d="M816 922 L788 1080" opacity=".85" fill="none" /><path d="M944 922 L972 1080" opacity=".85" fill="none" /></g>
    <g :stroke="accentDim" stroke-width="1.4" opacity=".6"><line x1="800" y1="1000" x2="960" y2="1000" /><line x1="792" y1="1044" x2="968" y2="1044" /></g>
    <line x1="880" y1="924" x2="880" y2="1080" :stroke="accentDim" stroke-width="1.2" opacity=".5" stroke-dasharray="4 6" />
    <!-- status LEDs: ok green + warn amber -->
    <circle cx="836" cy="905" r="3.4" fill="#7fbf6a" stroke="none" /><circle cx="852" cy="905" r="3.4" :fill="warn" stroke="none" />
  </g>
</template>

<style scoped>
/* CSS (not the SVG presentation attribute) so the accent var resolves */
.yoke {
  filter: drop-shadow(0 0 3px rgba(var(--ck-accent-rgb, 95, 217, 160), 0.4));
}
</style>
