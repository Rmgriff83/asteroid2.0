<script setup>
// Line-art for each base trinket (same visual language as the cockpit charm:
// thin strokes, one hue each, no fills beyond faint washes). Drawn in a
// 52×60 box; hanging pieces assume the string attaches at top-center.
defineProps({
  id: { type: String, required: true },
})
</script>

<template>
  <svg width="52" height="60" viewBox="0 0 52 60" class="trinket-art">
    <!-- lucky rock: a jagged little asteroid on a cord -->
    <g v-if="id === 'lucky-rock'" stroke="#cdbfa8" stroke-width="1.4" fill="none">
      <polygon points="26,14 38,20 42,32 34,44 20,46 12,36 14,22" />
      <circle cx="24" cy="30" r="4" opacity=".6" />
      <line x1="26" y1="2" x2="26" y2="14" stroke-width="1" opacity=".7" />
    </g>

    <!-- nav dice: two hanging cubes -->
    <g v-else-if="id === 'nav-dice'" stroke="#9db8ff" stroke-width="1.3" fill="none">
      <line x1="26" y1="2" x2="20" y2="18" stroke-width="1" opacity=".7" />
      <line x1="26" y1="2" x2="34" y2="24" stroke-width="1" opacity=".7" />
      <rect x="10" y="18" width="18" height="18" rx="3" />
      <rect x="27" y="24" width="16" height="16" rx="3" />
      <circle cx="19" cy="27" r="1.6" fill="#9db8ff" stroke="none" />
      <circle cx="31" cy="29" r="1.4" fill="#9db8ff" stroke="none" />
      <circle cx="39" cy="35" r="1.4" fill="#9db8ff" stroke="none" />
    </g>

    <!-- core shard: a glowing crystal sliver -->
    <g v-else-if="id === 'core-shard'" stroke="#ff8a5c" stroke-width="1.4" fill="none">
      <line x1="26" y1="2" x2="26" y2="12" stroke-width="1" opacity=".7" />
      <polygon points="26,12 34,26 28,50 22,42 18,24" />
      <line x1="25" y1="18" x2="26" y2="42" opacity=".6" />
      <polygon points="26,12 34,26 28,50 22,42 18,24" fill="#ff8a5c" opacity=".08" stroke="none" />
    </g>

    <!-- dwarf cactus: pot + arms -->
    <g v-else-if="id === 'dwarf-cactus'" stroke="#9fdc7a" stroke-width="1.4" fill="none">
      <path d="M26 12 v22" />
      <path d="M26 22 q-9 0 -9 -8" />
      <path d="M26 26 q8 0 8 -10" />
      <g stroke="#cdbfa8">
        <path d="M16 34 h20 l-2.5 16 h-15 z" />
        <line x1="16" y1="39" x2="36" y2="39" opacity=".6" />
      </g>
    </g>

    <!-- snow globe: dome + drift -->
    <g v-else-if="id === 'snow-globe'" stroke="#aee6ff" stroke-width="1.4" fill="none">
      <circle cx="26" cy="28" r="15" />
      <path d="M18 33 l6 -8 l5 4 l5 -7" opacity=".8" />
      <circle cx="21" cy="24" r=".9" fill="#aee6ff" stroke="none" />
      <circle cx="31" cy="21" r=".9" fill="#aee6ff" stroke="none" />
      <circle cx="28" cy="30" r=".9" fill="#aee6ff" stroke="none" />
      <g stroke="#cdbfa8">
        <path d="M15 42 h22 l-2 8 h-18 z" />
      </g>
    </g>

    <!-- mini hauler: a die-cast DART on a stand -->
    <g v-else-if="id === 'mini-hauler'" stroke="#e0a850" stroke-width="1.4" fill="none">
      <polygon points="40,26 16,17 20,26 16,35" />
      <line x1="28" y1="34" x2="28" y2="44" opacity=".6" />
      <line x1="18" y1="50" x2="38" y2="50" />
      <line x1="22" y1="44" x2="34" y2="44" opacity=".6" />
      <line x1="28" y1="44" x2="28" y2="50" opacity=".6" />
    </g>

    <!-- void bonsai: dark trunk, star leaves -->
    <g v-else-if="id === 'void-bonsai'" stroke="#b28aff" stroke-width="1.4" fill="none">
      <path d="M26 46 q-2 -10 4 -16 q6 -5 2 -12" />
      <path d="M28 34 q-8 -2 -12 -8" />
      <g fill="#b28aff" stroke="none" opacity=".9">
        <circle cx="31" cy="16" r="1.4" />
        <circle cx="14" cy="24" r="1.2" />
        <circle cx="36" cy="26" r="1.1" />
      </g>
      <g stroke="#cdbfa8">
        <path d="M16 46 h20 l-3 8 h-14 z" />
      </g>
    </g>

    <!-- fallback: a plain tag -->
    <g v-else stroke="#6f7a74" stroke-width="1.3" fill="none">
      <rect x="16" y="18" width="20" height="26" rx="3" />
      <line x1="26" y1="2" x2="26" y2="18" opacity=".7" />
    </g>
  </svg>
</template>

<style scoped>
.trinket-art {
  display: block;
}
</style>
