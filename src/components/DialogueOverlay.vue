<script setup>
// Generic dialogue runner: renders any authored dialogue entry, applies its
// consequence on close. Phaser idles underneath.
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { playerStore } from '../stores/playerStore'
import { EventBus } from '../game/EventBus'
import { getDialogue } from '../game/data/lore'
import { currencyService } from '../services/currencyService'

const active = ref(null)
const lineIndex = ref(0)

function onTrigger(id) {
  const d = getDialogue(id)
  if (!d) return
  active.value = d
  lineIndex.value = 0
  EventBus.emit('pause-game')
}

function advance() {
  if (!active.value) return
  if (lineIndex.value < active.value.lines.length - 1) {
    lineIndex.value++
    return
  }
  // done — apply consequence, mark seen
  const c = active.value.consequence
  if (c?.credits) currencyService.credit(c.credits, `lore ${active.value.id}`)
  if (c?.resource) playerStore.addCargo(c.resource.type, c.resource.qty)
  if (c?.augBlueprint) playerStore.learnAugBlueprint(c.augBlueprint)
  if (c?.recipe) playerStore.learnRecipe(c.recipe)
  if (!playerStore.seenDialogues) playerStore.seenDialogues = []
  playerStore.seenDialogues.push(active.value.id)
  playerStore.save()
  active.value = null
  EventBus.emit('resume-game')
}

onMounted(() => EventBus.on('dialogue-trigger', onTrigger))
onBeforeUnmount(() => EventBus.off('dialogue-trigger', onTrigger))
</script>

<template>
  <div v-if="active" class="dialogue" @pointerup="advance">
    <div class="box">
      <div class="speaker">{{ active.speaker }}</div>
      <p class="line">{{ active.lines[lineIndex] }}</p>
      <div class="more">
        {{ lineIndex < active.lines.length - 1 ? '▼' : '◆ close' }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.dialogue {
  position: absolute;
  inset: 0;
  z-index: 30;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 0 16px calc(28px + var(--sab));
  cursor: pointer;
}

.box {
  width: min(620px, 100%);
  background: rgba(6, 10, 18, 0.92);
  border: 1px solid var(--line);
  box-shadow: 0 0 20px rgba(157, 184, 255, 0.15);
  padding: 14px 18px;
}

.speaker {
  font-size: 11px;
  letter-spacing: 0.35em;
  color: var(--ice);
  margin-bottom: 8px;
  text-shadow: 0 0 8px rgba(157, 184, 255, 0.6);
}

.line {
  font-size: 14px;
  line-height: 1.6;
  color: var(--ink);
}

.more {
  text-align: right;
  font-size: 10px;
  color: var(--mint);
  animation: blink 1.4s infinite;
}

@keyframes blink {
  0%,
  100% {
    opacity: 0.25;
  }
  50% {
    opacity: 1;
  }
}
</style>
