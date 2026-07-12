<script setup>
// Full-screen star map (handoff §6): a Vue canvas that SAMPLES the seed
// generators live at three LOD tiers — never renders every panel, never
// stores a map. Fog of war = visitedSectors / per-panel diffs.
import { onMounted, onBeforeUnmount, ref, reactive } from 'vue'
import { playerStore } from '../stores/playerStore'
import { EventBus } from '../game/EventBus'
import { generatePanel, panelKey } from '../game/galaxy/panelGen'
import { resolveSector, sectorKey } from '../game/galaxy/sectorProps'
import { getAuthored } from '../game/galaxy/authored'
import { SECTOR_SIZE } from '../game/galaxy/constants'
import { worldState } from '../game/systems/WorldDiffs'
import { STAR_TYPES } from '../game/data/stars'
import { storedFor, isSiloFull } from '../game/systems/baseYield'

const canvasRef = ref(null)
const info = reactive({ text: '', sub: '' })
const travel = reactive({ show: false, px: 0, py: 0, cost: 0, label: '' })

let ctx = null
let raf = 0
const view = {
  cx: playerStore.currentPanel.px + 0.5,
  cy: playerStore.currentPanel.py + 0.5,
  zoom: 26, // px per panel
}

const TYPE_COLORS = {
  field: '#8fa3b8',
  nebula: '#b28aff',
  cluster: '#ffd67a',
  void: '#44566b',
  coreward: '#fff3cd',
}

const specCache = new Map()
const sectorCache = new Map()

function cachedPanel(px, py) {
  const key = panelKey(px, py)
  let spec = specCache.get(key)
  if (!spec) {
    spec = generatePanel(worldState.galaxySeed, px, py, getAuthored())
    if (specCache.size > 600) specCache.delete(specCache.keys().next().value)
    specCache.set(key, spec)
  }
  return spec
}

function cachedSector(sx, sy) {
  const key = sectorKey(sx, sy)
  let s = sectorCache.get(key)
  if (!s) {
    s = resolveSector(worldState.galaxySeed, sx, sy, getAuthored())
    if (sectorCache.size > 4000) sectorCache.delete(sectorCache.keys().next().value)
    sectorCache.set(key, s)
  }
  return s
}

function toScreen(px, py) {
  const c = canvasRef.value
  return {
    x: (px - view.cx) * view.zoom + c.clientWidth / 2,
    y: (py - view.cy) * view.zoom + c.clientHeight / 2,
  }
}

function toPanel(sx, sy) {
  const c = canvasRef.value
  return {
    px: (sx - c.clientWidth / 2) / view.zoom + view.cx,
    py: (sy - c.clientHeight / 2) / view.zoom + view.cy,
  }
}

function hexColor(n) {
  return '#' + n.toString(16).padStart(6, '0')
}

function draw() {
  const c = canvasRef.value
  if (!c || !ctx) return
  const w = c.clientWidth
  const h = c.clientHeight
  ctx.fillStyle = '#04060b'
  ctx.fillRect(0, 0, w, h)

  const Z = view.zoom
  if (Z >= 18) drawPanelTier(w, h, Z)
  else drawSectorTier(w, h, Z)

  // waypoints
  for (const wp of playerStore.waypoints) {
    const p = toScreen(wp.px + 0.5, wp.py + 0.5)
    ctx.strokeStyle = '#ffb35c'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(p.x - 6, p.y)
    ctx.lineTo(p.x + 6, p.y)
    ctx.moveTo(p.x, p.y - 6)
    ctx.lineTo(p.x, p.y + 6)
    ctx.stroke()
  }

  // unlocked fast-travel nodes: stations = mint square, bases = amber dome
  for (const id of playerStore.unlockedNodes) {
    const coords = id.split(':')[1]?.split(',').map(Number)
    if (!coords) continue
    const p = toScreen(coords[0] + 0.5, coords[1] + 0.5)
    if (p.x < -20 || p.x > w + 20 || p.y < -20 || p.y > h + 20) continue
    if (id.startsWith('base:')) {
      const base = playerStore.bases.find((b) => b.panelKey === `${coords[0]},${coords[1]}`)
      ctx.strokeStyle = '#ffb35c'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.arc(p.x, p.y + 2, 5, Math.PI, 0) // dome
      ctx.moveTo(p.x - 6, p.y + 2)
      ctx.lineTo(p.x + 6, p.y + 2) // baseline
      ctx.moveTo(p.x, p.y - 3)
      ctx.lineTo(p.x, p.y - 7) // antenna
      ctx.stroke()
      if (base && isSiloFull(base)) {
        ctx.fillStyle = '#ffb35c'
        ctx.beginPath()
        ctx.arc(p.x + 6, p.y - 6, 2.5, 0, Math.PI * 2)
        ctx.fill()
      }
    } else {
      ctx.strokeStyle = '#7dffd8'
      ctx.lineWidth = 1.5
      ctx.strokeRect(p.x - 5, p.y - 5, 10, 10)
    }
  }

  // player marker
  const pm = toScreen(playerStore.currentPanel.px + 0.5, playerStore.currentPanel.py + 0.5)
  ctx.strokeStyle = '#eaf6ff'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(pm.x, pm.y, 7, 0, Math.PI * 2)
  ctx.stroke()
  ctx.fillStyle = '#7dffd8'
  ctx.beginPath()
  ctx.arc(pm.x, pm.y, 2.5, 0, Math.PI * 2)
  ctx.fill()
}

function drawPanelTier(w, h, Z) {
  const tl = toPanel(0, 0)
  const br = toPanel(w, h)
  for (let px = Math.floor(tl.px); px <= Math.floor(br.px); px++) {
    for (let py = Math.floor(tl.py); py <= Math.floor(br.py); py++) {
      const p = toScreen(px, py)
      const { sx, sy } = { sx: Math.floor(px / SECTOR_SIZE), sy: Math.floor(py / SECTOR_SIZE) }
      const sectorVisited = worldState.visitedSectors.has(sectorKey(sx, sy))
      const visited = !!worldState.diffs.get(panelKey(px, py))?.visited ||
        (px === playerStore.currentPanel.px && py === playerStore.currentPanel.py)

      if (!sectorVisited) {
        ctx.fillStyle = 'rgba(255,255,255,0.015)'
        ctx.fillRect(p.x + 1, p.y + 1, Z - 2, Z - 2)
        continue
      }
      const spec = cachedPanel(px, py)
      if (visited) {
        // full panel detail — only for panels actually flown through
        ctx.fillStyle = hexColor(spec.bgColor)
        ctx.fillRect(p.x + 1, p.y + 1, Z - 2, Z - 2)
        const cx = p.x + Z / 2
        const cy = p.y + Z / 2
        if (spec.planet) {
          ctx.fillStyle = TYPE_COLORS[spec.sector.systemType] || '#8fa3b8'
          ctx.beginPath()
          ctx.arc(cx - Z * 0.18, cy, Math.max(2, Z * 0.1), 0, Math.PI * 2)
          ctx.fill()
        }
        if (spec.station) {
          ctx.strokeStyle = '#7dffd8'
          ctx.lineWidth = 1
          ctx.strokeRect(cx + Z * 0.08, cy - Z * 0.1, Math.max(3, Z * 0.14), Math.max(3, Z * 0.14))
        }
        if (spec.well) {
          ctx.fillStyle =
            spec.well.kind === 'blackhole'
              ? '#b28aff'
              : hexColor(STAR_TYPES[spec.well.starType]?.mid ?? 0xfff3cd)
          ctx.beginPath()
          ctx.arc(
            cx,
            cy + Z * 0.2,
            Math.max(1.5, Z * (spec.well.kind === 'star' ? 0.09 : 0.06)),
            0,
            Math.PI * 2
          )
          ctx.fill()
        }
      } else {
        // sector known, panel unexplored: dim placeholder
        ctx.fillStyle = 'rgba(157,184,255,0.05)'
        ctx.fillRect(p.x + 1, p.y + 1, Z - 2, Z - 2)
      }
    }
  }
}

function drawSectorTier(w, h, Z) {
  const cell = Z * SECTOR_SIZE
  const step = Math.max(1, Math.ceil(2 / cell)) // sample coarser when tiny
  const tl = toPanel(0, 0)
  const br = toPanel(w, h)
  const s0x = Math.floor(tl.px / SECTOR_SIZE)
  const s1x = Math.floor(br.px / SECTOR_SIZE)
  const s0y = Math.floor(tl.py / SECTOR_SIZE)
  const s1y = Math.floor(br.py / SECTOR_SIZE)
  for (let sx = s0x; sx <= s1x; sx += step) {
    for (let sy = s0y; sy <= s1y; sy += step) {
      const p = toScreen(sx * SECTOR_SIZE, sy * SECTOR_SIZE)
      const visited = worldState.visitedSectors.has(sectorKey(sx, sy))
      const sec = cachedSector(sx, sy)
      // grid gaps only when cells are big enough that they don't eat brightness
      const size = Math.max(1.5, cell * step - (cell * step > 9 ? 1 : 0))
      if (visited) {
        ctx.fillStyle = TYPE_COLORS[sec.systemType] || '#8fa3b8'
        ctx.globalAlpha = 0.18 + sec.density * 0.35
        ctx.fillRect(p.x, p.y, size, size)
        ctx.globalAlpha = 1
        if (cell >= 40) {
          ctx.fillStyle = 'rgba(234,246,255,0.75)'
          ctx.font = `${Math.min(12, cell / 8)}px "Space Mono", monospace`
          ctx.fillText(sec.name, p.x + 4, p.y + 12)
          // danger pips
          ctx.fillStyle = '#ff6a6a'
          const pips = Math.ceil(sec.danger * 4)
          for (let i = 0; i < pips; i++) ctx.fillRect(p.x + 4 + i * 6, p.y + size - 8, 4, 3)
        }
      } else {
        // unknown space: dim, but the galaxy's structure (spiral arms via
        // density, hue via systemType) should clearly read at a glance
        ctx.fillStyle = TYPE_COLORS[sec.systemType] || '#8fa3b8'
        ctx.globalAlpha = 0.06 + sec.density * 0.18
        ctx.fillRect(p.x, p.y, size, size)
        ctx.globalAlpha = 1
      }
    }
  }
}

// ---- interaction: drag to pan, wheel/pinch to zoom, tap to inspect ----
let dragging = false
let moved = false
let lastX = 0
let lastY = 0
let pinchDist = 0

function onPointerDown(e) {
  dragging = true
  moved = false
  lastX = e.clientX
  lastY = e.clientY
}

function onPointerMove(e) {
  if (!dragging) return
  const dx = e.clientX - lastX
  const dy = e.clientY - lastY
  if (Math.abs(dx) + Math.abs(dy) > 3) moved = true
  view.cx -= dx / view.zoom
  view.cy -= dy / view.zoom
  lastX = e.clientX
  lastY = e.clientY
  requestDraw()
}

function onPointerUp(e) {
  dragging = false
  if (moved) return
  // tap: inspect
  const rect = canvasRef.value.getBoundingClientRect()
  const { px, py } = toPanel(e.clientX - rect.left, e.clientY - rect.top)
  inspect(Math.floor(px), Math.floor(py))
}

function onWheel(e) {
  e.preventDefault()
  const factor = e.deltaY < 0 ? 1.15 : 0.87
  view.zoom = Math.min(64, Math.max(0.35, view.zoom * factor))
  requestDraw()
}

function onTouchMove(e) {
  if (e.touches.length === 2) {
    const d = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY
    )
    if (pinchDist) {
      view.zoom = Math.min(64, Math.max(0.35, view.zoom * (d / pinchDist)))
      requestDraw()
    }
    pinchDist = d
  }
}

function onTouchEnd() {
  pinchDist = 0
}

function inspect(px, py) {
  const { sx, sy } = { sx: Math.floor(px / SECTOR_SIZE), sy: Math.floor(py / SECTOR_SIZE) }
  const visited = worldState.visitedSectors.has(sectorKey(sx, sy))
  travel.show = false
  if (!visited) {
    info.text = 'UNCHARTED SPACE'
    info.sub = `panel ${px}, ${py}`
    return
  }
  const sec = cachedSector(sx, sy)
  const dominant = Object.entries(sec.resourceWeights).sort((a, b) => b[1] - a[1])[0][0]
  info.text = sec.name
  info.sub = `${sec.classification} · danger ${'!'.repeat(Math.max(1, Math.ceil(sec.danger * 4)))} · ${dominant}`

  // fast travel target?
  const nodeId = `st:${px},${py}`
  const baseId = `base:${px},${py}`
  const unlocked = playerStore.unlockedNodes.includes(nodeId)
    ? nodeId
    : playerStore.unlockedNodes.includes(baseId)
      ? baseId
      : null
  if (unlocked) {
    const dist = Math.hypot(px - playerStore.currentPanel.px, py - playerStore.currentPanel.py)
    const perPanel = 0.5 + 0.15 * Math.sqrt(Math.hypot(px, py))
    travel.cost = Math.ceil(dist * perPanel * 0.5)
    travel.px = px
    travel.py = py
    if (unlocked.startsWith('st:')) {
      travel.label = 'STATION'
    } else {
      const base = playerStore.bases.find((b) => b.panelKey === `${px},${py}`)
      travel.label = base && isSiloFull(base) ? 'BASE — SILO FULL' : 'BASE'
      if (base) info.sub += ` · silo ${storedFor(base)}/${base.capacity}`
    }
    travel.show = dist > 0.5
  }

  // waypoint toggle on double-inspect of the same panel
  const existing = playerStore.waypoints.findIndex((wp) => wp.px === px && wp.py === py)
  if (existing >= 0) {
    playerStore.waypoints.splice(existing, 1)
  } else if (info.lastPx === px && info.lastPy === py) {
    playerStore.waypoints.push({ px, py })
  }
  info.lastPx = px
  info.lastPy = py
  playerStore.save()
  requestDraw()
}

function fastTravel() {
  if (playerStore.fuel < travel.cost) return
  playerStore.fuel -= travel.cost
  EventBus.emit('debug-teleport', { px: travel.px, py: travel.py })
  close()
}

function close() {
  playerStore.screen = 'game'
  playerStore.paused = false
  EventBus.emit('resume-game')
}

function requestDraw() {
  cancelAnimationFrame(raf)
  raf = requestAnimationFrame(draw)
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
  const sec = cachedSector(
    Math.floor(playerStore.currentPanel.px / SECTOR_SIZE),
    Math.floor(playerStore.currentPanel.py / SECTOR_SIZE)
  )
  info.text = sec.name
  info.sub = sec.classification
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', resize)
  cancelAnimationFrame(raf)
})
</script>

<template>
  <div class="screen map-screen">
    <canvas
      ref="canvasRef"
      class="map-canvas"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @wheel="onWheel"
      @touchmove="onTouchMove"
      @touchend="onTouchEnd"
    ></canvas>
    <header class="bar">
      <button class="retro-btn small" @pointerup="close">&lt; Close</button>
      <div class="readout">
        <div class="info-name">{{ info.text }}</div>
        <div class="info-sub">{{ info.sub }}</div>
      </div>
      <span class="points-chip">FUEL {{ playerStore.fuel.toFixed(0) }}</span>
    </header>
    <div v-if="travel.show" class="travel">
      <button
        class="retro-btn"
        :disabled="playerStore.fuel < travel.cost"
        @pointerup="fastTravel"
      >
        Jump to {{ travel.label }} · {{ travel.cost }} fuel
      </button>
    </div>
    <p class="hint">drag to pan · scroll/pinch to zoom · tap to inspect · tap twice for waypoint</p>
  </div>
</template>

<style scoped>
.map-screen {
  background: #04060b;
  justify-content: flex-start;
  align-items: stretch;
  padding: 0;
}

.map-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  touch-action: none;
}

.bar {
  position: absolute;
  top: calc(10px + var(--sat));
  left: calc(12px + var(--sal));
  right: calc(12px + var(--sar));
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  pointer-events: none;
}

.bar button,
.bar .points-chip {
  pointer-events: auto;
}

.readout {
  text-align: center;
}

.info-name {
  font-size: 14px;
  letter-spacing: 0.25em;
  color: var(--ink);
  text-shadow: 0 0 8px rgba(157, 184, 255, 0.6);
}

.info-sub {
  font-size: 10px;
  letter-spacing: 0.15em;
  color: var(--ice);
  opacity: 0.8;
}

.retro-btn.small {
  font-size: 11px;
  padding: 7px 14px;
  letter-spacing: 0.15em;
}

.travel {
  position: absolute;
  bottom: calc(56px + var(--sab));
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
}

.hint {
  position: absolute;
  bottom: calc(14px + var(--sab));
  width: 100%;
  text-align: center;
  font-size: 10px;
  letter-spacing: 0.2em;
  opacity: 0.45;
}
</style>
