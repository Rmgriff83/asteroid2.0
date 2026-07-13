<script setup>
// Resource-scoop toast: slides up from the bottom edge with what you got,
// its rarity, the amount, and your new hold total — then slides back down.
// One toast at a time: rapid scoops of the same resource merge into it
// (amount accumulates, timer resets, a little bump retriggers); a different
// resource replaces the card. Cleared instantly when leaving the game screen.
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { playerStore } from '../stores/playerStore'
import { EventBus } from '../game/EventBus'
import { ITEMS, RARITY_COLORS } from '../game/data/resources'
import ItemIcon from './ItemIcon.vue'

const HOLD_MS = 2600

const toast = ref(null) // { type, name, icon, color, rarity, rarityColor, amount, total }
const bump = ref(0) // remount key so the merge bump re-triggers
let hideTimer = 0

function cssHex(n) {
  return '#' + n.toString(16).padStart(6, '0')
}

function baseCard(type, item) {
  return {
    type,
    name: item.name,
    icon: item.icon,
    color: cssHex(item.color ?? 0x7dffd8),
    rarity: item.rarity ?? 'common',
    rarityColor: RARITY_COLORS[item.rarity] ?? RARITY_COLORS.common,
  }
}

function armHide() {
  clearTimeout(hideTimer)
  hideTimer = setTimeout(() => (toast.value = null), HOLD_MS)
}

function onScooped({ type, amount, total, partial, left }) {
  const item = ITEMS[type]
  if (!item) return
  if (toast.value && toast.value.type === type && !toast.value.blocked) {
    toast.value.amount += amount
  } else {
    toast.value = { ...baseCard(type, item), amount, blocked: false }
  }
  toast.value.total = total
  toast.value.partial = !!partial
  toast.value.left = left || 0
  bump.value++
  armHide()
}

// nothing fit at all: a warn card explaining WHY the chunk is still floating.
// A visible pickup card for the same resource already carries its own HOLD
// FULL strip — keep it (just extend its stay) instead of stomping it.
function onBlocked({ type, reason }) {
  const item = ITEMS[type]
  if (!item) return
  if (toast.value && toast.value.type === type && !toast.value.blocked) {
    armHide()
    return
  }
  toast.value = { ...baseCard(type, item), blocked: true, reason }
  bump.value++
  armHide()
}

// never linger over the station/base/map screens
watch(
  () => playerStore.screen,
  (s) => {
    if (s !== 'game' && toast.value) {
      clearTimeout(hideTimer)
      toast.value = null
    }
  }
)

onMounted(() => {
  EventBus.on('resource-scooped', onScooped)
  EventBus.on('scoop-blocked', onBlocked)
})
onBeforeUnmount(() => {
  clearTimeout(hideTimer)
  EventBus.off('resource-scooped', onScooped)
  EventBus.off('scoop-blocked', onBlocked)
})
</script>

<template>
  <div class="toast-slot">
    <Transition name="toast">
      <!-- no per-type key: a different resource swaps content in place
           (single slot) instead of running enter+leave side by side -->
      <div v-if="toast" class="toast" :class="{ warn: toast.blocked }">
        <div class="bump" :key="bump">
          <ItemIcon
            class="t-icon"
            :icon="toast.icon"
            :size="34"
            :color="toast.blocked ? '#6f7a74' : toast.color"
          />
          <div class="t-body">
            <template v-if="!toast.blocked">
              <div class="t-line">
                <span class="t-name">{{ toast.name.toUpperCase() }}</span>
                <span class="t-rarity" :style="{ color: toast.rarityColor, borderColor: toast.rarityColor }">
                  {{ toast.rarity.toUpperCase() }}
                </span>
              </div>
              <div class="t-line sub">
                <span class="t-amount" :style="{ color: toast.color }">+{{ toast.amount }}</span>
                <span class="t-total">IN HOLD {{ toast.total }}</span>
              </div>
              <!-- the hold filled mid-chunk: the rest is still out there -->
              <div v-if="toast.partial" class="t-warn-strip">
                HOLD FULL — {{ toast.left }} LEFT FLOATING
              </div>
            </template>
            <template v-else>
              <div class="t-line">
                <span class="t-name warn-title">HOLD FULL</span>
              </div>
              <div class="t-line sub">
                <span class="t-warn-strip no-pad">
                  {{ toast.reason === 'mass' ? 'MASS' : 'SLOTS' }} MAXED —
                  {{ toast.name.toUpperCase() }} LEFT FLOATING
                </span>
              </div>
            </template>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.toast-slot {
  position: fixed;
  left: 50%;
  bottom: calc(96px + var(--sab, 0px));
  transform: translateX(-50%);
  z-index: 40; /* above the game HUD, below full screens & scanlines */
  pointer-events: none;
}

.toast {
  background: rgba(10, 16, 23, 0.85);
  border: 1px solid var(--line, #1d2b26);
  box-shadow: 0 0 18px rgba(0, 0, 0, 0.55);
  padding: 10px 16px;
}

.bump {
  display: flex;
  align-items: center;
  gap: 12px;
  animation: toast-bump 0.22s ease-out;
}

.t-icon {
  flex: none;
  filter: drop-shadow(0 0 4px currentColor);
}

.t-body {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 180px;
}

.t-line {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 14px;
}

.t-name {
  font-size: 13px;
  letter-spacing: 0.18em;
  color: #eaf6ff;
  white-space: nowrap;
}

.t-rarity {
  font-size: 9px;
  letter-spacing: 0.25em;
  border: 1px solid;
  padding: 1px 6px;
  white-space: nowrap;
}

.t-line.sub {
  font-size: 12px;
}

.t-amount {
  font-weight: 700;
  letter-spacing: 0.1em;
}

.t-total {
  color: #6f7a74;
  letter-spacing: 0.15em;
  font-size: 10px;
}

.toast.warn {
  border-color: #8a6d34;
  box-shadow: 0 0 18px rgba(224, 168, 80, 0.15);
}

.warn-title {
  color: #ffb35c;
}

.t-warn-strip {
  font-size: 10px;
  letter-spacing: 0.2em;
  color: #ffb35c;
  border-top: 1px solid rgba(224, 168, 80, 0.35);
  padding-top: 4px;
  margin-top: 2px;
  white-space: nowrap;
}

.t-warn-strip.no-pad {
  border-top: none;
  padding-top: 0;
  margin-top: 0;
}

/* slide up in, slide down out */
.toast-enter-active {
  transition: transform 0.26s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.26s ease-out;
}

.toast-leave-active {
  transition: transform 0.3s ease-in, opacity 0.3s ease-in;
}

.toast-enter-from,
.toast-leave-to {
  transform: translateY(calc(120% + 96px + var(--sab, 0px)));
  opacity: 0;
}

@keyframes toast-bump {
  0% { transform: scale(1); }
  35% { transform: scale(1.05); }
  100% { transform: scale(1); }
}

@media (prefers-reduced-motion: reduce) {
  .toast-enter-active,
  .toast-leave-active {
    transition: opacity 0.2s ease;
  }

  .toast-enter-from,
  .toast-leave-to {
    transform: none;
  }

  .bump {
    animation: none;
  }
}
</style>
