// Home-screen widget feed: pre-renders each base's window view for the next
// six hours (12 frames, half-hour steps) with the SAME pure renderer the
// base interior uses — the widget's day/night and weather stay accurate
// between app opens because every frame is exact for its own timestamp.
// Synced wherever base state changes (mirrors syncSiloNotifications) and on
// app backgrounding; native platforms only.
import { Capacitor } from '@capacitor/core'
import { playerStore } from '../stores/playerStore'
import { worldState } from '../game/systems/WorldDiffs'
import { generatePanel } from '../game/galaxy/panelGen'
import { getAuthored } from '../game/galaxy/authored'
import { starfieldSpec } from '../game/systems/Starfield'
import { surfaceSpec, SURF_W } from '../game/galaxy/surfaceGen'
import { resolveSector, sectorOf } from '../game/galaxy/sectorProps'
import { siloFullAt } from '../game/systems/baseYield'
import { ITEMS, RESOURCES } from '../game/data/resources'
import { hash32 } from '../game/utils/rng'
import { buildSurfaceView, drawSurfaceFrame } from '../components/base/surfaceRenderer'
import { WidgetFeed } from './widgetFeedPlugin'

// 2× the largest systemMedium point size; Android 4×2 center-crops it
const FRAME_W = 728
const FRAME_H = 340
const FRAME_COUNT = 12
const STEP_MS = 30 * 60000

let debounceTimer = null
let lastSignature = ''

function cssHex(n) {
  return '#' + n.toString(16).padStart(6, '0')
}

function baseDirName(panelKey) {
  return 'b_' + panelKey.replace(',', '_')
}

// frame timestamps: now, then future half-hour wall-clock marks (so OS
// timeline swaps land on :00/:30)
function frameTimes(now) {
  const times = [now]
  let next = Math.ceil(now / STEP_MS) * STEP_MS
  if (next - now < 60000) next += STEP_MS // avoid a near-duplicate first step
  for (let i = 0; times.length < FRAME_COUNT; i++) times.push(next + i * STEP_MS)
  return times
}

async function encodeFrame(canvas) {
  const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.85))
  const dataUrl = await new Promise((res) => {
    const r = new FileReader()
    r.onload = () => res(r.result)
    r.readAsDataURL(blob)
  })
  return dataUrl.slice(dataUrl.indexOf(',') + 1)
}

async function renderBaseFrames(base, now) {
  const [px, py] = base.panelKey.split(',').map(Number)
  const spec = generatePanel(worldState.galaxySeed, px, py, getAuthored())
  if (!spec.planet) return null
  const surface = surfaceSpec(spec.planet)
  const sky = starfieldSpec(worldState.galaxySeed, px, py, spec.sector)
  const view = buildSurfaceView(surface, sky)
  const baseSpotX = hash32(surface.seed, 7) % SURF_W
  const camX = baseSpotX - 190
  const baseColor = cssHex(ITEMS[base.resourceType]?.color ?? 0xffb35c)

  const canvas = document.createElement('canvas')
  canvas.width = FRAME_W
  canvas.height = FRAME_H
  const ctx = canvas.getContext('2d')

  const dir = baseDirName(base.panelKey)
  const files = []
  const frames = []
  for (const [i, atMs] of frameTimes(now).entries()) {
    drawSurfaceFrame(ctx, view, {
      w: FRAME_W,
      h: FRAME_H,
      camX,
      altitude: 0,
      t: atMs / 1000,
      nowMs: atMs,
      reduced: false,
      showStars: true,
      baseAt: baseSpotX,
      baseColor,
    })
    const file = `${dir}/f${String(i).padStart(2, '0')}.jpg`
    files.push({ path: file, dataB64: await encodeFrame(canvas) })
    frames.push({ atMs, file })
  }

  const { sx, sy } = sectorOf(px, py)
  const sector = resolveSector(worldState.galaxySeed, sx, sy, getAuthored())
  const entry = {
    panelKey: base.panelKey,
    baseId: base.id,
    name: `${sector.name} ${base.panelKey}`,
    resourceType: base.resourceType,
    resourceName: RESOURCES[base.resourceType]?.name ?? base.resourceType,
    colorHex: baseColor,
    ratePerHour: base.ratePerHour,
    capacity: base.capacity,
    lastCollected: base.lastCollected,
    siloFullAt: siloFullAt(base),
    frames,
  }
  return { entry, files }
}

// core exporter — awaitable so probes (and pagehide best-effort) can drive it
export async function writeWidgetFeed(now = Date.now()) {
  const bases = playerStore.bases
  const entries = []
  for (const base of bases) {
    const rendered = await renderBaseFrames(base, now)
    if (!rendered) continue
    // one write per base keeps bridge messages small (~800 KB each)
    await WidgetFeed.write({ files: rendered.files })
    entries.push(rendered.entry)
  }
  const manifest = { version: 1, generatedAtMs: now, bases: entries }
  await WidgetFeed.write({ files: [], manifestJson: JSON.stringify(manifest) })
  await WidgetFeed.reloadWidgets()
  return manifest
}

// public sync: debounced, deduped on (bases state + half-hour bucket)
export function syncWidgetFeed() {
  if (!Capacitor.isNativePlatform()) return
  const signature =
    JSON.stringify(playerStore.bases.map((b) => [b.panelKey, b.lastCollected, b.resourceType])) +
    '|' +
    Math.floor(Date.now() / STEP_MS)
  if (signature === lastSignature) return
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    lastSignature = signature
    writeWidgetFeed().catch(() => {})
  }, 1500)
}
