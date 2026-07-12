<script setup>
// Thin monochrome wireframe item icons (geometry from the design handoff).
// Rarity is conveyed by dots/pills elsewhere — icons stay one color.
defineProps({
  icon: { type: String, required: true },
  size: { type: Number, default: 38 },
  color: { type: String, default: 'var(--mint)' },
})
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    :stroke="color"
    stroke-width="1.3"
    stroke-linejoin="round"
    stroke-linecap="round"
  >
    <template v-if="icon === 'hex'">
      <polygon points="12,3 20,7.5 20,16.5 12,21 4,16.5 4,7.5" />
      <polygon points="12,7 16.5,9.5 16.5,14.5 12,17 7.5,14.5 7.5,9.5" opacity="0.35" />
    </template>
    <template v-else-if="icon === 'diamond'">
      <polygon points="12,2 21,12 12,22 3,12" />
      <line x1="3" y1="12" x2="21" y2="12" opacity="0.35" />
      <line x1="12" y1="2" x2="12" y2="22" opacity="0.35" />
    </template>
    <template v-else-if="icon === 'canister'">
      <rect x="6" y="5" width="12" height="15" rx="3" />
      <line x1="6" y1="9" x2="18" y2="9" opacity="0.45" />
      <line x1="10" y1="3" x2="14" y2="3" stroke-width="2" />
    </template>
    <template v-else-if="icon === 'prism'">
      <polygon points="12,3 20,19 4,19" />
      <line x1="12" y1="3" x2="12" y2="19" opacity="0.35" />
      <line x1="12" y1="11" x2="20" y2="19" opacity="0.35" />
    </template>
    <template v-else-if="icon === 'atom'">
      <circle cx="12" cy="12" r="2.2" :fill="color" stroke="none" />
      <ellipse cx="12" cy="12" rx="9" ry="3.5" />
      <ellipse cx="12" cy="12" rx="9" ry="3.5" transform="rotate(60 12 12)" opacity="0.7" />
      <ellipse cx="12" cy="12" rx="9" ry="3.5" transform="rotate(120 12 12)" opacity="0.5" />
    </template>
    <template v-else-if="icon === 'ingot'">
      <polygon points="5,9 19,9 21,17 3,17" />
      <line x1="7" y1="12.6" x2="17" y2="12.6" opacity="0.35" />
    </template>
    <template v-else-if="icon === 'spores'">
      <circle cx="9" cy="10" r="3" />
      <circle cx="15.5" cy="9" r="2.3" />
      <circle cx="12" cy="15.5" r="2.7" />
    </template>
  </svg>
</template>
