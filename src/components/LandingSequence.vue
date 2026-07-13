<script setup>
// The descent: a hard cut from the dive onto a fast surface skim that bleeds
// off speed and altitude until touchdown beside the base spot, then fades
// into the interior. Fully stateless — every frame is a function of elapsed
// time — so tap-to-skip just jumps the clock. Reduced motion never mounts
// this screen (GameScene routes straight to 'base'), but we guard anyway.
import { onMounted, onBeforeUnmount, ref } from 'vue'
import { playerStore } from '../stores/playerStore'
import { motion } from '../services/motion'
import { worldState } from '../game/systems/WorldDiffs'
import { generatePanel } from '../game/galaxy/panelGen'
import { getAuthored } from '../game/galaxy/authored'
import { starfieldSpec } from '../game/systems/Starfield'
import { surfaceSpec, SURF_W } from '../game/galaxy/surfaceGen'
import { getShip } from '../game/data/ships'
import { getShipAccent } from '../game/data/accents'
import { ITEMS } from '../game/data/resources'
import { hash32 } from '../game/utils/rng'
import {
  buildSurfaceView,
  drawSurfaceFrame,
  groundYAt,
  surfaceScreenX,
} from './base/surfaceRenderer'

const props = defineProps({
  panelKey: { type: String, required: true },
})

const DUR = 6.8 // seconds of skim before the fade
const FADE = 0.45
const GLIDE_DIST = 2400 // surface units covered by the deceleration

const canvasRef = ref(null)
const showSkipHint = ref(false)
const fading = ref(false)
let ctx = null
let raf = 0
let start = 0
let skipAt = null
let done = false

const [px, py] = props.panelKey.split(',').map(Number)
const spec = generatePanel(worldState.galaxySeed, px, py, getAuthored())
const surface = spec.planet ? surfaceSpec(spec.planet) : null
const sky = starfieldSpec(worldState.galaxySeed, px, py, spec.sector)
const view = surface ? buildSurfaceView(surface, sky) : null

// same seeded base spot as BaseShell — the skim decelerates INTO home
const baseSpotX = surface ? hash32(surface.seed, 7) % SURF_W : 0
const camXEnd = baseSpotX - 190
const base = playerStore.bases.find((b) => b.panelKey === props.panelKey)
const baseColor = (() => {
  const c = ITEMS[base?.resourceType]?.color
  return c != null ? '#' + c.toString(16).padStart(6, '0') : '#ffb35c'
})()

const shipDef = getShip(playerStore.selectedShip)
const accent = getShipAccent(playerStore.selectedShip).css

function easeOutCubic(u) {
  return 1 - (1 - u) ** 3
}

function easeInOutCubic(u) {
  return u < 0.5 ? 4 * u ** 3 : 1 - (-2 * u + 2) ** 3 / 2
}

function clamp01(u) {
  return Math.max(0, Math.min(1, u))
}

function finish() {
  if (done) return
  done = true
  playerStore.screen = 'base'
}

function skip() {
  if (skipAt === null && !fading.value) skipAt = performance.now()
}

function frame(now) {
  const c = canvasRef.value
  if (!c || !ctx) return
  if (!start) start = now
  let elapsed = (now - start) / 1000
  if (skipAt !== null) elapsed = Math.max(elapsed, DUR) // jump to touchdown
  const u = Math.min(1, elapsed / DUR)
  const w = c.clientWidth
  const h = c.clientHeight

  if (elapsed > 1 && !showSkipHint.value && u < 1) showSkipHint.value = true

  // deceleration: remaining glide shrinks cubically → v hits 0 at touchdown
  const camX = camXEnd - GLIDE_DIST * (1 - easeOutCubic(u))
  const speed = (GLIDE_DIST * 3 * (1 - u) ** 2) / DUR // d(camX)/dt
  const altitude = 0.3 * (1 - easeOutCubic(u))

  drawSurfaceFrame(ctx, view, {
    w,
    h,
    camX,
    altitude,
    t: elapsed,
    nowMs: Date.now(),
    reduced: false,
    showStars: true,
    baseAt: base ? baseSpotX : null,
    baseColor,
  })

  // --- the ship, skimming. It does NOT ride the bumpy heightline under it
  // (at speed that re-samples dozens of jagged points a second = jitter);
  // it cruises level, then eases down onto the touchdown spot's ground
  // height — sampled at a FIXED world x, so it can't wobble.
  const shipX = w * 0.38
  const shipWorldXEnd = camXEnd + (shipX - w * 0.5)
  const gyTouch = groundYAt(view, { w, h, camX, altitude }, shipWorldXEnd)
  const cruiseY = h * 0.3
  const settle = easeInOutCubic(clamp01((u - 0.5) / 0.5))
  const pitch = 0.1 * (1 - u) // nose settles level
  const scale = 2.4
  const bob = u < 0.9 ? Math.sin(elapsed * 5) * 2 * (1 - u) : 0
  const y = cruiseY + (gyTouch - 13 - cruiseY) * settle

  // speed lines while it's still quick
  if (speed > 120) {
    ctx.strokeStyle = accent
    ctx.lineWidth = 1
    for (let i = 0; i < 5; i++) {
      const ly = y + bob + ((hash32(surface.seed, 40 + i) % 100) / 100 - 0.5) * 46
      const len = 20 + (speed / 900) * 60
      ctx.globalAlpha = Math.min(0.4, speed / 2400) * (1 - i * 0.15)
      ctx.beginPath()
      ctx.moveTo(shipX - 30 - i * 14, ly)
      ctx.lineTo(shipX - 30 - i * 14 - len, ly)
      ctx.stroke()
    }
    ctx.globalAlpha = 1
  }

  ctx.save()
  ctx.translate(shipX, y + bob)
  ctx.rotate(pitch)
  ctx.scale(scale, scale)
  ctx.strokeStyle = accent
  ctx.lineWidth = 4 / scale
  ctx.globalAlpha = 0.16
  ctx.beginPath()
  shipDef.verts.forEach(([vx, vy], i) => (i === 0 ? ctx.moveTo(vx, vy) : ctx.lineTo(vx, vy)))
  ctx.closePath()
  ctx.stroke()
  ctx.lineWidth = 1.4 / scale
  ctx.globalAlpha = 0.95
  ctx.stroke()
  // thrust flicker while decelerating
  if (speed > 60) {
    ctx.strokeStyle = '#ffb35c'
    ctx.globalAlpha = 0.5 + 0.4 * Math.sin(elapsed * 31)
    ctx.lineWidth = 1.2 / scale
    ctx.beginPath()
    ctx.moveTo(-11, 0)
    ctx.lineTo(-16 - (speed / 900) * 8, 0)
    ctx.stroke()
  }
  ctx.restore()
  ctx.globalAlpha = 1

  // touchdown dust
  if (u >= 1) {
    const dustT = Math.min(1, (elapsed - DUR) / 0.5)
    ctx.fillStyle = view.theme.strokeCss
    for (let i = 0; i < 6; i++) {
      const side = i % 2 ? 1 : -1
      ctx.globalAlpha = 0.3 * (1 - dustT)
      ctx.beginPath()
      ctx.arc(shipX + side * (14 + dustT * (18 + i * 6)), gyTouch - 3 - dustT * 6, 1.6, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
    if (!fading.value) {
      showSkipHint.value = false
      fading.value = true
      setTimeout(finish, FADE * 1000)
    }
  }

  if (!done) raf = requestAnimationFrame(frame)
}

function resize() {
  const c = canvasRef.value
  if (!c) return
  const dpr = window.devicePixelRatio || 1
  c.width = c.clientWidth * dpr
  c.height = c.clientHeight * dpr
  ctx = c.getContext('2d')
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
}

onMounted(() => {
  // no surface to skim (shouldn't happen) or reduced motion: straight inside
  if (!view || motion.reduced) return finish()
  resize()
  window.addEventListener('resize', resize)
  raf = requestAnimationFrame(frame)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  window.removeEventListener('resize', resize)
})
</script>

<template>
  <div class="landing" @pointerup="skip">
    <canvas ref="canvasRef" class="skim"></canvas>
    <div class="skip-hint" :class="{ on: showSkipHint }">TAP TO SKIP</div>
    <div class="fade" :class="{ on: fading }"></div>
    <!-- scanlines come from App.vue's global overlay -->
  </div>
</template>

<style scoped>
.landing {
  position: absolute;
  inset: 0;
  z-index: 10;
  background: #04060b;
}

.skim {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.skip-hint {
  position: absolute;
  right: 22px;
  bottom: 18px;
  font-size: 12px;
  letter-spacing: 0.35em;
  color: #eaf6ff;
  opacity: 0;
  transition: opacity 0.6s ease;
  pointer-events: none;
}

.skip-hint.on {
  opacity: 0.4;
}

.fade {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: #04060b;
  opacity: 0;
  transition: opacity 0.45s ease-in;
}

.fade.on {
  opacity: 1;
}
</style>
