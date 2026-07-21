<script setup>
// ADMIN (dev-gated): author the galaxy. Paint SECTOR-level property
// overrides; click into a sector to pin individual panels. Only sparse
// property DELTAS are stored — placement stays 100% procedural
// (property-then-placement, handoff §4).
import { ref, reactive, computed, onMounted, onBeforeUnmount } from 'vue'
import { playerStore } from '../../stores/playerStore'
import { resolveSector, sectorKey, ENEMY_FLAVORS, SYSTEM_TYPES } from '../../game/galaxy/sectorProps'
import { STAR_TYPE_IDS } from '../../game/data/stars'
import { getAuthored, getWorkingCopy, setWorkingCopy } from '../../game/galaxy/authored'
import { validateAuthored } from '../../game/galaxy/validateAuthored'
import { buildAuthoringKit } from '../../game/galaxy/authoringKit'
import { SECTOR_SIZE } from '../../game/galaxy/constants'
import { worldState } from '../../game/systems/WorldDiffs'
import { dbPut } from '../../services/db'
import AdminSectorView from './AdminSectorView.vue'

const canvasRef = ref(null)
const selected = ref(null) // {sx, sy}
const sectorView = ref(null) // {sx, sy} → panel grid open
const paintMode = ref(false)
const kitRadius = ref(4)
const buildingKit = ref(false)
const importReport = ref(null) // { ok?, errors?, warnings?, counts? }

const form = reactive({
  useName: false,
  name: '',
  useSystemType: false,
  systemType: 'field',
  useDanger: false,
  danger: 0.5,
  useRichness: false,
  richness: 0.5,
  useDensity: false,
  density: 0.5,
  useEnemyFlavor: false,
  enemyFlavor: 'standard',
  useStationDensity: false,
  stationDensity: 0.1,
  useStarCount: false,
  starCount: 1,
  useStarType: false,
  starType: 'mixed',
})

const TYPE_COLORS = {
  field: '#8fa3b8',
  nebula: '#b28aff',
  cluster: '#ffd67a',
  void: '#44566b',
  coreward: '#fff3cd',
}

let ctx = null
const view = { cx: 0, cy: 0, zoom: 34 } // sector coords, px per sector
let raf = 0

const resolved = computed(() =>
  selected.value
    ? resolveSector(worldState.galaxySeed, selected.value.sx, selected.value.sy, getAuthored())
    : null
)

const override = computed(() =>
  selected.value ? getWorkingCopy().sectors[sectorKey(selected.value.sx, selected.value.sy)] : null
)

function draw() {
  const c = canvasRef.value
  if (!c || !ctx) return
  const w = c.clientWidth
  const h = c.clientHeight
  ctx.fillStyle = '#04060b'
  ctx.fillRect(0, 0, w, h)
  const Z = view.zoom
  const authored = getAuthored()
  const s0x = Math.floor(view.cx - w / 2 / Z)
  const s1x = Math.ceil(view.cx + w / 2 / Z)
  const s0y = Math.floor(view.cy - h / 2 / Z)
  const s1y = Math.ceil(view.cy + h / 2 / Z)
  for (let sx = s0x; sx <= s1x; sx++) {
    for (let sy = s0y; sy <= s1y; sy++) {
      const x = (sx - view.cx) * Z + w / 2
      const y = (sy - view.cy) * Z + h / 2
      const sec = resolveSector(worldState.galaxySeed, sx, sy, authored)
      ctx.fillStyle = TYPE_COLORS[sec.systemType] || '#8fa3b8'
      ctx.globalAlpha = 0.12 + sec.density * 0.4
      ctx.fillRect(x, y, Z - 1, Z - 1)
      ctx.globalAlpha = 1
      // danger tint strip
      ctx.fillStyle = `rgba(255,106,106,${sec.danger * 0.5})`
      ctx.fillRect(x, y + Z - 4, Z - 1, 3)
      // authored badge
      if (authored.sectors[sectorKey(sx, sy)]) {
        ctx.strokeStyle = '#ffb35c'
        ctx.lineWidth = 1.5
        ctx.strokeRect(x + 1, y + 1, Z - 3, Z - 3)
      }
      if (selected.value?.sx === sx && selected.value?.sy === sy) {
        ctx.strokeStyle = '#7dffd8'
        ctx.lineWidth = 2
        ctx.strokeRect(x, y, Z - 1, Z - 1)
      }
    }
  }
  // origin marker
  const ox = (0 - view.cx) * Z + w / 2
  const oy = (0 - view.cy) * Z + h / 2
  ctx.strokeStyle = '#eaf6ff'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.arc(ox + Z / 2, oy + Z / 2, 5, 0, Math.PI * 2)
  ctx.stroke()
}

function requestDraw() {
  cancelAnimationFrame(raf)
  raf = requestAnimationFrame(draw)
}

let dragging = false
let moved = false
let lastX = 0
let lastY = 0

function sectorAt(e) {
  const rect = canvasRef.value.getBoundingClientRect()
  const c = canvasRef.value
  const sx = Math.floor((e.clientX - rect.left - c.clientWidth / 2) / view.zoom + view.cx)
  const sy = Math.floor((e.clientY - rect.top - c.clientHeight / 2) / view.zoom + view.cy)
  return { sx, sy }
}

function onDown(e) {
  dragging = true
  moved = false
  lastX = e.clientX
  lastY = e.clientY
}

function onMove(e) {
  if (!dragging) return
  const dx = e.clientX - lastX
  const dy = e.clientY - lastY
  if (Math.abs(dx) + Math.abs(dy) > 3) moved = true
  if (paintMode.value && moved) {
    paintAt(sectorAt(e))
  } else if (moved) {
    view.cx -= dx / view.zoom
    view.cy -= dy / view.zoom
  }
  lastX = e.clientX
  lastY = e.clientY
  requestDraw()
}

function onUp(e) {
  dragging = false
  if (moved && !paintMode.value) return
  const s = sectorAt(e)
  // empty brush falls through to selection, so paint mode never feels dead
  if (!paintMode.value || !paintAt(s)) {
    selectSector(s)
  }
  requestDraw()
}

function onWheel(e) {
  e.preventDefault()
  view.zoom = Math.min(80, Math.max(6, view.zoom * (e.deltaY < 0 ? 1.15 : 0.87)))
  requestDraw()
}

function selectSector(s) {
  selected.value = s
  // preload form from existing override
  const ov = getWorkingCopy().sectors[sectorKey(s.sx, s.sy)] || {}
  const base = resolveSector(worldState.galaxySeed, s.sx, s.sy, { sectors: {}, panels: {} })
  form.useName = 'name' in ov
  form.name = ov.name ?? base.name
  form.useSystemType = 'systemType' in ov
  form.systemType = ov.systemType ?? base.systemType
  form.useDanger = 'danger' in ov
  form.danger = ov.danger ?? base.danger
  form.useRichness = 'richness' in ov
  form.richness = ov.richness ?? base.richness
  form.useDensity = 'density' in ov
  form.density = ov.density ?? base.density
  form.useEnemyFlavor = 'enemyFlavor' in ov
  form.enemyFlavor = ov.enemyFlavor ?? base.enemyFlavor
  form.useStationDensity = 'stationDensity' in ov
  form.stationDensity = ov.stationDensity ?? base.stationDensity
  form.useStarCount = 'starCount' in ov
  form.starCount = ov.starCount ?? base.starCount
  form.useStarType = 'starType' in ov
  form.starType = ov.starType ?? 'mixed'
}

function buildOverride() {
  const ov = {}
  if (form.useName && form.name.trim()) ov.name = form.name.trim()
  if (form.useSystemType) ov.systemType = form.systemType
  if (form.useDanger) ov.danger = Number(form.danger)
  if (form.useRichness) ov.richness = Number(form.richness)
  if (form.useDensity) ov.density = Number(form.density)
  if (form.useEnemyFlavor) ov.enemyFlavor = form.enemyFlavor
  if (form.useStationDensity) ov.stationDensity = Number(form.stationDensity)
  if (form.useStarCount) ov.starCount = Number(form.starCount)
  if (form.useStarType) ov.starType = form.starType
  return ov
}

// the brush is "armed" once at least one PAINTABLE field is checked —
// `name` is a per-sector identity, only ever applied via Apply, never
// painted (sweeping a name across sectors would duplicate it everywhere)
const brushArmed = computed(() =>
  form.useSystemType || form.useDanger || form.useRichness ||
  form.useDensity || form.useEnemyFlavor || form.useStationDensity ||
  form.useStarCount || form.useStarType
)

function applyTo(s) {
  const copy = getWorkingCopy()
  const ov = buildOverride()
  const key = sectorKey(s.sx, s.sy)
  // spread the full copy so version/dialogues survive every edit
  const next = { ...copy, sectors: { ...copy.sectors }, panels: { ...copy.panels } }
  if (Object.keys(ov).length) next.sectors[key] = ov
  else delete next.sectors[key]
  persist(next)
}

// paint = stamp the armed override (minus name); a swept sector keeps any
// name it already had. Returns false when the brush is empty.
function paintAt(s) {
  const { name: _skip, ...ov } = buildOverride()
  if (!Object.keys(ov).length) return false
  const copy = getWorkingCopy()
  const key = sectorKey(s.sx, s.sy)
  const prevName = copy.sectors[key]?.name
  const next = { ...copy, sectors: { ...copy.sectors }, panels: { ...copy.panels } }
  next.sectors[key] = prevName ? { name: prevName, ...ov } : ov
  persist(next)
  return true
}

function apply() {
  if (selected.value) applyTo(selected.value)
  requestDraw()
}

function clearOverride() {
  if (!selected.value) return
  const copy = getWorkingCopy()
  const next = { ...copy, sectors: { ...copy.sectors }, panels: { ...copy.panels } }
  delete next.sectors[sectorKey(selected.value.sx, selected.value.sy)]
  persist(next)
  selectSector(selected.value)
  requestDraw()
}

function persist(next) {
  setWorkingCopy(next)
  dbPut('authored', 'workingCopy', JSON.parse(JSON.stringify(next))).catch(() => {})
}

function download(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

// the merged effective layer (bundled + working copy) — this file IS the
// shippable bundle: copy it over src/game/data/authored/galaxy.json
function exportJson() {
  download(getAuthored(), 'galaxy.json')
}

// world gazetteer + canon + schema rules for the offline lore writer —
// see LORE_AUTHORING.md for the full round-trip
function exportKit() {
  if (buildingKit.value) return
  buildingKit.value = true
  // let the button repaint before the synchronous sector walk
  requestAnimationFrame(() => {
    try {
      const kit = buildAuthoringKit(worldState.galaxySeed, Number(kitRadius.value), getAuthored())
      download(kit, 'authoring-kit.json')
    } finally {
      buildingKit.value = false
    }
  })
}

function importJson(e) {
  const file = e.target.files[0]
  e.target.value = '' // allow re-picking the same file after a fix
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    let data
    try {
      data = JSON.parse(reader.result)
    } catch (parseErr) {
      importReport.value = { errors: ['not valid JSON: ' + parseErr.message], warnings: [] }
      return
    }
    const res = validateAuthored(data)
    if (!res.ok) {
      importReport.value = { errors: res.errors, warnings: res.warnings }
      return // nothing persisted — no partial imports
    }
    persist(res.normalized)
    importReport.value = {
      ok: true,
      warnings: res.warnings,
      counts: {
        sectors: Object.keys(res.normalized.sectors).length,
        panels: Object.keys(res.normalized.panels).length,
        dialogues: res.normalized.dialogues.length,
      },
    }
    if (selected.value) selectSector(selected.value)
    requestDraw()
  }
  reader.readAsText(file)
}

function back() {
  playerStore.screen = 'menu'
}

function resize() {
  const c = canvasRef.value
  if (!c) return
  const dpr = window.devicePixelRatio || 1
  c.width = c.clientWidth * dpr
  c.height = c.clientHeight * dpr
  ctx = c.getContext('2d')
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  requestDraw()
}

onMounted(() => {
  resize()
  window.addEventListener('resize', resize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', resize)
  cancelAnimationFrame(raf)
})
</script>

<template>
  <div class="screen admin">
    <AdminSectorView
      v-if="sectorView"
      :sx="sectorView.sx"
      :sy="sectorView.sy"
      @close="sectorView = null"
    />
    <template v-else>
      <header class="bar">
        <button class="retro-btn small" @pointerup="back">&lt; Menu</button>
        <span class="title-chip">GALAXY AUTHORING</span>
        <div class="tools">
          <label class="paint-toggle">
            <input v-model="paintMode" type="checkbox" /> paint
          </label>
          <span v-if="paintMode && !brushArmed" class="paint-hint">
            brush empty — check fields in the inspector, then drag
          </span>
          <button class="retro-btn small" @pointerup="exportJson">Export</button>
          <span class="kit-tools" title="authoring kit: gazetteer of sectors within this radius of the origin — bigger = slower to build">
            <label class="kit-label" for="kit-radius">kit radius</label>
            <input id="kit-radius" v-model="kitRadius" class="kit-radius" type="number" min="1" max="6" />
            <button class="retro-btn small" :disabled="buildingKit" @pointerup="exportKit">
              {{ buildingKit ? 'Building…' : 'Export Kit' }}
            </button>
          </span>
          <label class="retro-btn small file-btn">
            Import<input type="file" accept=".json" @change="importJson" />
          </label>
        </div>
      </header>

      <div v-if="importReport" class="import-report" :class="{ ok: importReport.ok }">
        <div class="report-head">
          <span v-if="importReport.ok">
            IMPORT OK — {{ importReport.counts.sectors }} sectors ·
            {{ importReport.counts.panels }} panels · {{ importReport.counts.dialogues }} dialogues
          </span>
          <span v-else>IMPORT FAILED — {{ importReport.errors.length }} ERRORS (nothing was changed)</span>
          <button class="retro-btn small" @pointerup="importReport = null">Close</button>
        </div>
        <ul v-if="!importReport.ok" class="report-list">
          <li v-for="(msg, i) in importReport.errors.slice(0, 50)" :key="'e' + i">{{ msg }}</li>
          <li v-if="importReport.errors.length > 50" class="more">
            … {{ importReport.errors.length - 50 }} more
          </li>
        </ul>
        <ul v-if="importReport.warnings && importReport.warnings.length" class="report-list warn">
          <li v-for="(msg, i) in importReport.warnings.slice(0, 20)" :key="'w' + i">⚠ {{ msg }}</li>
        </ul>
      </div>

      <div class="body">
        <canvas
          ref="canvasRef"
          class="grid-canvas"
          @pointerdown="onDown"
          @pointermove="onMove"
          @pointerup="onUp"
          @wheel="onWheel"
        ></canvas>

        <aside v-if="selected" class="inspector">
          <h3 class="section-h">SECTOR {{ selected.sx }},{{ selected.sy }}</h3>
          <p v-if="resolved" class="resolved">
            {{ resolved.name }}<br />
            {{ resolved.classification }}<br />
            <span :class="{ authored: override }">{{ override ? 'AUTHORED' : 'procedural' }}</span>
          </p>

          <div class="field">
            <label><input v-model="form.useName" type="checkbox" /> name</label>
            <input
              v-model="form.name"
              type="text"
              maxlength="40"
              :disabled="!form.useName"
              placeholder="exact sector name"
            />
          </div>
          <div class="field">
            <label><input v-model="form.useSystemType" type="checkbox" /> type</label>
            <select v-model="form.systemType" :disabled="!form.useSystemType">
              <option v-for="t in SYSTEM_TYPES" :key="t">{{ t }}</option>
            </select>
          </div>
          <div class="field">
            <label><input v-model="form.useDanger" type="checkbox" /> danger {{ Number(form.danger).toFixed(2) }}</label>
            <input v-model="form.danger" type="range" min="0" max="1" step="0.05" :disabled="!form.useDanger" />
          </div>
          <div class="field">
            <label><input v-model="form.useRichness" type="checkbox" /> richness {{ Number(form.richness).toFixed(2) }}</label>
            <input v-model="form.richness" type="range" min="0" max="1" step="0.05" :disabled="!form.useRichness" />
          </div>
          <div class="field">
            <label><input v-model="form.useDensity" type="checkbox" /> density {{ Number(form.density).toFixed(2) }}</label>
            <input v-model="form.density" type="range" min="0" max="1" step="0.05" :disabled="!form.useDensity" />
          </div>
          <div class="field">
            <label><input v-model="form.useEnemyFlavor" type="checkbox" /> enemies</label>
            <select v-model="form.enemyFlavor" :disabled="!form.useEnemyFlavor">
              <option v-for="f in ENEMY_FLAVORS" :key="f">{{ f }}</option>
            </select>
          </div>
          <div class="field">
            <label><input v-model="form.useStationDensity" type="checkbox" /> stations {{ Number(form.stationDensity).toFixed(2) }}</label>
            <input v-model="form.stationDensity" type="range" min="0" max="0.5" step="0.01" :disabled="!form.useStationDensity" />
          </div>
          <div class="field">
            <label><input v-model="form.useStarCount" type="checkbox" /> stars in sector: {{ form.starCount }}</label>
            <input v-model="form.starCount" type="range" min="0" max="3" step="1" :disabled="!form.useStarCount" />
          </div>
          <div class="field">
            <label><input v-model="form.useStarType" type="checkbox" /> star class</label>
            <select v-model="form.starType" :disabled="!form.useStarType">
              <option value="mixed">mixed</option>
              <option v-for="t in STAR_TYPE_IDS" :key="t" :value="t">{{ t }}</option>
            </select>
          </div>

          <div class="actions">
            <button class="retro-btn small" @pointerup="apply">Apply</button>
            <button class="retro-btn small" @pointerup="clearOverride">Clear</button>
            <button class="retro-btn small" @pointerup="sectorView = { ...selected }">
              Panels →
            </button>
          </div>
        </aside>
      </div>
    </template>
  </div>
</template>

<style scoped>
.admin {
  background: #04060b;
  justify-content: flex-start;
  align-items: stretch;
  gap: 10px;
}

.bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}

.title-chip {
  font-size: 13px;
  letter-spacing: 0.4em;
  color: var(--amber);
  text-shadow: 0 0 10px rgba(255, 179, 92, 0.6);
}

.tools {
  display: flex;
  gap: 8px;
  align-items: center;
}

.paint-toggle {
  font-size: 11px;
  letter-spacing: 0.15em;
  color: var(--ink);
  display: flex;
  gap: 4px;
  align-items: center;
}

.retro-btn.small {
  font-size: 11px;
  padding: 7px 12px;
  letter-spacing: 0.12em;
}

.file-btn {
  position: relative;
  overflow: hidden;
  display: inline-block;
}

.file-btn input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.body {
  flex: 1;
  display: flex;
  gap: 10px;
  min-height: 0;
}

.grid-canvas {
  flex: 1;
  min-width: 0;
  touch-action: none;
  border: 1px solid var(--line);
}

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

.resolved {
  font-size: 11px;
  line-height: 1.6;
  opacity: 0.85;
}

.authored {
  color: var(--amber);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 11px;
}

.field select,
.field input[type='range'],
.field input[type='text'] {
  width: 100%;
  background: #0a0f1a;
  color: var(--ink);
  border: 1px solid var(--line);
  font-family: inherit;
  font-size: 11px;
  padding: 3px;
}

.kit-tools {
  display: flex;
  gap: 4px;
  align-items: center;
}

.kit-label {
  font-size: 10px;
  letter-spacing: 0.12em;
  opacity: 0.7;
}

.paint-hint {
  font-size: 10px;
  letter-spacing: 0.1em;
  color: var(--amber);
  opacity: 0.9;
}

.kit-radius {
  width: 40px;
  background: #0a0f1a;
  color: var(--ink);
  border: 1px solid var(--line);
  font-family: inherit;
  font-size: 11px;
  padding: 6px 4px;
  text-align: center;
}

.import-report {
  border: 1px solid var(--amber);
  background: rgba(255, 179, 92, 0.06);
  padding: 10px 12px;
  font-size: 11px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.import-report.ok {
  border-color: var(--mint);
  background: rgba(125, 255, 216, 0.05);
}

.report-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  letter-spacing: 0.15em;
  color: var(--amber);
}

.import-report.ok .report-head {
  color: var(--mint);
}

.report-list {
  margin: 0;
  padding-left: 16px;
  max-height: 140px;
  overflow-y: auto;
  line-height: 1.6;
  opacity: 0.9;
}

.report-list.warn {
  color: var(--amber);
  max-height: 80px;
}

.report-list .more {
  opacity: 0.6;
}

.actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
</style>
