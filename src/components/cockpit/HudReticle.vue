<script setup>
// Ship-nose HUD marker (shared across ships): chevron + crosshair with ticks.
// Drawn relative to cfg.x / cfg.y — the chevron base is the anchor point.
defineProps({
  cfg: { type: Object, default: () => ({ x: 880, y: 992, opacity: 0.5 }) },
})
</script>

<template>
  <g
    :transform="`translate(${cfg.x} ${cfg.y})`"
    fill="none"
    stroke="var(--ck-accent, #5fd9a0)"
    stroke-width="1.6"
    :opacity="cfg.opacity"
  >
    <path d="M-34 14 L0 -20 L34 14" />
    <line x1="0" y1="-92" x2="0" y2="-70" />
    <line x1="0" y1="-56" x2="0" y2="-44" />
    <line x1="-60" y1="-80" x2="-38" y2="-80" />
    <line x1="38" y1="-80" x2="60" y2="-80" />
    <circle cx="0" cy="-80" r="4" />
  </g>
</template>
