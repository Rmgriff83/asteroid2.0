<script setup>
// Panel-pin editor: the 16×16 grid of one sector, each cell summarized from
// generatePanel. Click a panel to PIN specific contents — pins feed the
// procedural placement's inputs; they never store geometry.
import { ref, reactive, computed } from 'vue'
import { playerStore } from '../../stores/playerStore'
import { EventBus } from '../../game/EventBus'
import { generatePanel, panelKey } from '../../game/galaxy/panelGen'
import { getAuthored, getWorkingCopy, setWorkingCopy } from '../../game/galaxy/authored'
import { SECTOR_SIZE } from '../../game/galaxy/constants'
import { RESOURCE_TYPES, PLANET_TYPES } from '../../game/galaxy/sectorProps'
import { STAR_TYPES, STAR_TYPE_IDS } from '../../game/data/stars'
import { worldState } from '../../game/systems/WorldDiffs'
import { dbPut } from '../../services/db'

const props = defineProps({ sx: Number, sy: Number })
const emit = defineEmits(['close'])

const selected = ref(null) // {px, py}
const version = ref(0)

// well select values: '' procedural · 'suppress' → pin well:'none' ·
// 'blackhole' · 'star' (sector-weighted) · 'star:<type>' (explicit class)
const form = reactive({
  planet: 'none',
  station: false,
  well: '',
  anomaly: '',
  resourceType: 'none',
  resourceRich: false,
  clear: false,
})

const cells = computed(() => {
  version.value // dependency for refresh
  const out = []
  const authored = getAuthored()
  for (let dy = 0; dy < SECTOR_SIZE; dy++) {
    for (let dx = 0; dx < SECTOR_SIZE; dx++) {
      const px = props.sx * SECTOR_SIZE + dx
      const py = props.sy * SECTOR_SIZE + dy
      const spec = generatePanel(worldState.galaxySeed, px, py, authored)
      out.push({
        px,
        py,
        color: '#' + spec.bgColor.toString(16).padStart(6, '0'),
        planet: !!spec.planet,
        station: !!spec.station,
        well: spec.well?.kind,
        starColor: spec.well?.starType
          ? '#' + (STAR_TYPES[spec.well.starType]?.mid ?? 0xfff3cd).toString(16).padStart(6, '0')
          : null,
        anomaly: !!spec.anomaly,
        enemies: spec.enemies.length,
        pinned: !!authored.panels[panelKey(px, py)],
      })
    }
  }
  return out
})

function select(cell) {
  selected.value = { px: cell.px, py: cell.py }
  const pin = getWorkingCopy().panels[panelKey(cell.px, cell.py)] || {}
  form.planet = pin.planet?.type || 'none'
  form.station = !!pin.station
  if (pin.well === undefined) form.well = ''
  else if (pin.well === 'none') form.well = 'suppress'
  else if (typeof pin.well === 'object') form.well = `star:${pin.well.starType}`
  else form.well = pin.well // 'blackhole' | 'star'
  form.anomaly = typeof pin.anomaly === 'string' ? pin.anomaly : ''
  form.resourceType = pin.resource?.type || 'none'
  form.resourceRich = !!pin.resource?.rich
  form.clear = !!pin.clear
}

function savePin() {
  if (!selected.value) return
  const pin = {}
  if (form.planet !== 'none') pin.planet = { type: form.planet }
  if (form.station) pin.station = true
  if (form.well === 'suppress') pin.well = 'none'
  else if (form.well.startsWith('star:')) pin.well = { kind: 'star', starType: form.well.slice(5) }
  else if (form.well) pin.well = form.well // 'blackhole' | 'star'
  if (form.anomaly.trim()) pin.anomaly = form.anomaly.trim()
  if (form.resourceType !== 'none') {
    pin.resource = { type: form.resourceType, rich: form.resourceRich }
  }
  if (form.clear) pin.clear = true

  const copy = getWorkingCopy()
  const next = { sectors: { ...copy.sectors }, panels: { ...copy.panels } }
  const key = panelKey(selected.value.px, selected.value.py)
  if (Object.keys(pin).length) next.panels[key] = pin
  else delete next.panels[key]
  setWorkingCopy(next)
  dbPut('authored', 'workingCopy', JSON.parse(JSON.stringify(next))).catch(() => {})
  version.value++
}

function removePin() {
  form.planet = 'none'
  form.station = false
  form.well = ''
  form.anomaly = ''
  form.resourceType = 'none'
  form.resourceRich = false
  form.clear = false
  savePin()
}

function flyHere() {
  if (!selected.value) return
  playerStore.paused = false
  playerStore.screen = 'game'
  playerStore.currentPanel = { px: selected.value.px, py: selected.value.py }
  EventBus.emit('start-game')
}
</script>

<template>
  <div class="sector-view">
    <header class="bar">
      <button class="retro-btn small" @pointerup="emit('close')">&lt; Galaxy</button>
      <span class="title-chip">SECTOR {{ sx }},{{ sy }} — PANELS</span>
      <span></span>
    </header>

    <div class="body">
      <div class="grid">
        <button
          v-for="cell in cells"
          :key="cell.px + ',' + cell.py"
          class="cell"
          :class="{
            selected: selected?.px === cell.px && selected?.py === cell.py,
            pinned: cell.pinned,
          }"
          :style="{ background: cell.color }"
          :title="`${cell.px},${cell.py}`"
          @pointerup="select(cell)"
        >
          <span v-if="cell.station" class="ic st">◻</span>
          <span v-else-if="cell.planet" class="ic pl">●</span>
          <span
            v-if="cell.well === 'star'"
            class="ic star"
            :style="{ color: cell.starColor }"
            >☀</span
          >
          <span v-else-if="cell.well === 'blackhole'" class="ic bh">◉</span>
          <span v-if="cell.anomaly" class="ic an">✦</span>
          <span v-if="cell.enemies" class="ic en">{{ cell.enemies }}</span>
        </button>
      </div>

      <aside v-if="selected" class="inspector">
        <h3 class="section-h">PANEL {{ selected.px }},{{ selected.py }}</h3>
        <div class="field">
          <label>planet</label>
          <select v-model="form.planet">
            <option value="none">— procedural —</option>
            <option v-for="t in PLANET_TYPES" :key="t" :value="t">{{ t }}</option>
          </select>
        </div>
        <div class="field check">
          <label><input v-model="form.station" type="checkbox" /> station here</label>
        </div>
        <div class="field">
          <label>gravity well</label>
          <select v-model="form.well">
            <option value="">— procedural —</option>
            <option value="suppress">none (suppress)</option>
            <option value="blackhole">black hole</option>
            <option value="star">star (sector mix)</option>
            <option v-for="t in STAR_TYPE_IDS" :key="t" :value="'star:' + t">
              star: {{ t }}
            </option>
          </select>
        </div>
        <div class="field">
          <label>anomaly (dialogue id)</label>
          <input v-model="form.anomaly" type="text" placeholder="e.g. void-drifter-1" />
        </div>
        <div class="field">
          <label>rich resource</label>
          <select v-model="form.resourceType">
            <option value="none">— procedural —</option>
            <option v-for="t in RESOURCE_TYPES" :key="t" :value="t">{{ t }}</option>
          </select>
          <label v-if="form.resourceType !== 'none'" class="check">
            <input v-model="form.resourceRich" type="checkbox" /> rich vein
          </label>
        </div>
        <div class="field check">
          <label><input v-model="form.clear" type="checkbox" /> clear panel (empty space)</label>
        </div>
        <div class="actions">
          <button class="retro-btn small" @pointerup="savePin">Save Pin</button>
          <button class="retro-btn small" @pointerup="removePin">Remove</button>
          <button class="retro-btn small" @pointerup="flyHere">Fly Here ▸</button>
        </div>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.sector-view {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: inherit;
}

.bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.title-chip {
  font-size: 13px;
  letter-spacing: 0.4em;
  color: var(--amber);
}

.retro-btn.small {
  font-size: 11px;
  padding: 7px 12px;
  letter-spacing: 0.12em;
}

.body {
  flex: 1;
  display: flex;
  gap: 10px;
  min-height: 0;
}

.grid {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(16, 1fr);
  grid-template-rows: repeat(16, 1fr);
  gap: 2px;
  min-width: 0;
}

.cell {
  position: relative;
  border: 1px solid rgba(234, 246, 255, 0.12);
  cursor: pointer;
  font-size: 9px;
  color: var(--ink);
  padding: 0;
  overflow: hidden;
}

.cell.pinned {
  border-color: var(--amber);
  border-width: 2px;
}

.cell.selected {
  border-color: var(--mint);
  border-width: 2px;
  box-shadow: 0 0 8px rgba(125, 255, 216, 0.5);
}

.ic {
  position: absolute;
  font-size: 8px;
  line-height: 1;
}

.st { color: #7dffd8; top: 1px; left: 2px; }
.pl { color: #ffd67a; top: 1px; left: 2px; }
.star { color: #fff3cd; bottom: 1px; left: 2px; }
.bh { color: #b28aff; bottom: 1px; left: 2px; }
.an { color: #9db8ff; top: 1px; right: 2px; }
.en { color: #ff6a6a; bottom: 1px; right: 2px; }

.inspector {
  width: 240px;
  border: 1px solid var(--line);
  padding: 12px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.section-h {
  font-size: 12px;
  letter-spacing: 0.3em;
  color: var(--mint);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 11px;
}

.field select,
.field input[type='text'] {
  background: #0a0f1a;
  color: var(--ink);
  border: 1px solid var(--line);
  font-family: inherit;
  font-size: 11px;
  padding: 4px;
}

.check {
  flex-direction: row;
  align-items: center;
  gap: 6px;
}

.actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
</style>
