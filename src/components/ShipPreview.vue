<script setup>
// Renders a ship's vertex data as a crisp inline SVG with a soft glow.
// Optionally draws equipped AUGMENTATION layers (off by default so existing
// call sites stay pixel-identical).
import { computed } from 'vue'
import { getShipAccent } from '../game/data/accents'
import { playerStore } from '../stores/playerStore'
import { equippedStrokes } from '../game/data/augments'

const props = defineProps({
  ship: { type: Object, required: true },
  size: { type: Number, default: 72 },
  showAugments: { type: Boolean, default: false },
  // explicit augment id list; null = the ship's equipped set from the store
  augments: { type: Array, default: null },
})

const augStrokes = computed(() => {
  if (!props.showAugments) return []
  const ids = props.augments ?? playerStore.shipAugments[props.ship.id] ?? []
  return equippedStrokes(props.ship, ids)
})

const bounds = computed(() => {
  // viewBox unions augment extents (the halo overhangs the hull) — but the
  // augment NORMALIZATION itself stays verts-only, inside equippedStrokes
  const all = [
    ...props.ship.verts,
    ...props.ship.extraLines.flat(),
    ...augStrokes.value.flatMap((s) => s.points),
  ]
  const xs = all.map((v) => v[0])
  const ys = all.map((v) => v[1])
  const pad = 6
  const minX = Math.min(...xs) - pad
  const minY = Math.min(...ys) - pad
  return {
    minX,
    minY,
    w: Math.max(...xs) + pad - minX,
    h: Math.max(...ys) + pad - minY,
  }
})

const pointsStr = computed(() => props.ship.verts.map(([x, y]) => `${x},${y}`).join(' '))

const colorHex = computed(() => getShipAccent(props.ship.id).css)

function strokePoints(s) {
  return s.points.map(([x, y]) => `${x},${y}`).join(' ')
}
</script>

<template>
  <svg
    :width="size"
    :height="size"
    :viewBox="`${bounds.minX} ${bounds.minY} ${bounds.w} ${bounds.h}`"
    preserveAspectRatio="xMidYMid meet"
  >
    <!-- rotate nose-up for display -->
    <g :transform="`rotate(-90 ${bounds.minX + bounds.w / 2} ${bounds.minY + bounds.h / 2})`">
      <polygon
        :points="pointsStr"
        fill="none"
        :stroke="colorHex"
        stroke-width="4"
        stroke-opacity="0.18"
        stroke-linejoin="round"
      />
      <polygon
        :points="pointsStr"
        fill="none"
        :stroke="colorHex"
        stroke-width="1.4"
        stroke-linejoin="round"
      />
      <line
        v-for="(line, i) in ship.extraLines"
        :key="i"
        :x1="line[0][0]"
        :y1="line[0][1]"
        :x2="line[1][0]"
        :y2="line[1][1]"
        :stroke="colorHex"
        stroke-width="1.4"
      />
      <!-- augmentation layers: same double-stroke glow as the hull -->
      <template v-for="(s, i) in augStrokes" :key="'aug' + i">
        <component
          :is="s.closed ? 'polygon' : 'polyline'"
          :points="strokePoints(s)"
          fill="none"
          :stroke="colorHex"
          stroke-width="4"
          stroke-opacity="0.14"
          stroke-linejoin="round"
        />
        <component
          :is="s.closed ? 'polygon' : 'polyline'"
          :points="strokePoints(s)"
          fill="none"
          :stroke="colorHex"
          stroke-width="1.2"
          stroke-opacity="0.85"
          stroke-linejoin="round"
        />
      </template>
    </g>
  </svg>
</template>
