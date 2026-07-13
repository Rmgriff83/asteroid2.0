<script setup>
// FIRST-PERSON view from the cockpit: camera sits at the ship's actual panel
// position looking along its heading. The panel's persistent contents (real
// asteroids minus destroyed, typed star, planet, station) surround you in
// pseudo-3D; the starfield keeps the exact in-game dot sizes and twinkle.
import { onMounted, onBeforeUnmount, ref } from 'vue'
import { playerStore } from '../stores/playerStore'
import { motion } from '../services/motion'
import { worldState, getDiff } from '../game/systems/WorldDiffs'
import { generatePanel, panelKey } from '../game/galaxy/panelGen'
import { getAuthored } from '../game/galaxy/authored'
import { starfieldSpec } from '../game/systems/Starfield'
import { STAR_TYPES } from '../game/data/stars'
import { getShip } from '../game/data/ships'
import { getShipAccent } from '../game/data/accents'
import { ITEMS } from '../game/data/resources'
import { hash32 } from '../game/utils/rng'
import { planetTheme } from '../game/data/planetTheme'
import { PANEL_W, PANEL_H } from '../game/galaxy/constants'

const props = defineProps({
  // legacy CSS canopy framing (reflections + corner struts); the cockpit shell
  // passes false and draws its own SVG chrome instead
  chrome: { type: Boolean, default: true },
  // where the flight horizon sits (fraction of view height from the top)
  horizon: { type: Number, default: 0.17 },
})

const canvasRef = ref(null)
let ctx = null
let raf = 0
let t0 = 0

let spec = null
let sky = null
let rocks = []
let cam = { x: PANEL_W / 2, y: PANEL_H / 2, rot: -Math.PI / 2 }
let shipDef = null
let bobAmp = 3 // cheaper hulls have worse stabilizers — set from ship def

const FOV = (95 * Math.PI) / 180
// the console covers mid-screen — put the flight horizon in the visible band
// above it so what's dead ahead (stars especially) shows over the terminal.
// Eased toward the prop each frame so stow/open re-frames glide.
let horizonCur = props.horizon
const FADE_NEAR = 300
const FADE_FAR = 1600

function hexColor(n) {
  return '#' + n.toString(16).padStart(6, '0')
}

// deterministic pseudo-altitude so in-plane objects scatter around the horizon
function altOf(seedA, seedB, span = 240) {
  return ((hash32(seedA | 0, seedB | 0) % 1000) / 1000 - 0.5) * 2 * span
}

function setupScene() {
  const { px, py } = playerStore.currentPanel
  spec = generatePanel(worldState.galaxySeed, px, py, getAuthored())
  sky = starfieldSpec(worldState.galaxySeed, px, py, spec.sector)
  shipDef = getShip(playerStore.selectedShip)
  bobAmp = shipDef.bobAmp ?? 3
  cam = playerStore.shipPose
    ? { ...playerStore.shipPose }
    : { x: PANEL_W / 2, y: PANEL_H / 2, rot: -Math.PI / 2 }

  const diff = getDiff(panelKey(px, py))
  rocks = spec.asteroids
    .filter((a) => !diff?.asteroidsDestroyed?.includes(a.idx))
    .map((a, i) => ({ ...a, rot: 0, alt: altOf(spec.seed, a.idx * 7 + 1) }))
  for (const [i, f] of (diff?.fragments || []).entries()) {
    rocks.push({
      x: f.x, y: f.y, vx: f.vx, vy: f.vy, spin: f.spin, rot: f.rot,
      verts: f.verts, radius: f.radius, mineral: f.mineral,
      alt: altOf(spec.seed, 9001 + i * 13),
    })
  }
}

// nearest wrap-image of a panel position relative to the camera
function relWrapped(x, y) {
  let dx = x - cam.x
  let dy = y - cam.y
  if (dx > PANEL_W / 2) dx -= PANEL_W
  else if (dx < -PANEL_W / 2) dx += PANEL_W
  if (dy > PANEL_H / 2) dy -= PANEL_H
  else if (dy < -PANEL_H / 2) dy += PANEL_H
  return { dx, dy }
}

// project an in-plane point → screen {x, y, d} or null if behind/too close
function project(px2, py2, alt, w, h, focal) {
  const { dx, dy } = relWrapped(px2, py2)
  const cos = Math.cos(cam.rot)
  const sin = Math.sin(cam.rot)
  const d = dx * cos + dy * sin // forward
  const l = -dx * sin + dy * cos // lateral (right positive)
  if (d < 8) return null
  return {
    x: w / 2 + (l / d) * focal,
    y: h * horizonCur - (alt / d) * focal,
    d,
  }
}

function distAlpha(d) {
  if (d <= FADE_NEAR) return 1
  return Math.max(0.25, 1 - ((d - FADE_NEAR) / (FADE_FAR - FADE_NEAR)) * 0.75)
}

function draw(now) {
  const c = canvasRef.value
  if (!c || !ctx) return
  if (!t0) t0 = now
  // reduced motion: hold scene time at zero — stills drift, twinkle, spin, pulse
  const t = motion.reduced ? 0 : (now - t0) / 1000
  horizonCur += (props.horizon - horizonCur) * (motion.reduced ? 1 : 0.12)
  const w = c.clientWidth
  const h = c.clientHeight
  const focal = w / (2 * Math.tan(FOV / 2))

  // backdrop: sector hue, slightly darker overhead for depth
  const bgTop = hexColor(spec.bgColor)
  const grad = ctx.createLinearGradient(0, 0, 0, h)
  grad.addColorStop(0, '#04060b')
  grad.addColorStop(0.35, bgTop)
  grad.addColorStop(1, bgTop)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, w, h)

  // space drifts slightly out of phase with the console's float — the tiny
  // parallax between them is what sells "adrift". Amplitude comes from the
  // ship: the DART sways, the NOVA glides.
  const bob = Math.sin(t * 0.97) * bobAmp
  ctx.save()
  ctx.translate(0, bob)

  // --- starfield: infinite backdrop by direction; sizes identical to in-game
  // (star positions are already panel pixels — use the nearest wrap image)
  const twinkleSet = new Set(sky.twinklers)
  for (const s of sky.stars) {
    const { dx, dy } = relWrapped(s.x, s.y)
    const baseAz = ((Math.atan2(dy, dx) - cam.rot + Math.PI * 3) % (Math.PI * 2)) - Math.PI
    // each sky star also appears mirrored behind you so every facing reads
    // as full as the in-game sky (a 95° window on 66 dots is sparse alone)
    for (const flip of [0, Math.PI]) {
      const az = ((baseAz + flip + Math.PI * 3) % (Math.PI * 2)) - Math.PI
      if (Math.abs(az) > FOV * 0.65) continue
      const x = w / 2 + Math.tan(az) * focal
      // deterministic vertical spread from the star's own coords
      const y =
        ((hash32(Math.floor(s.x * 9973) + (flip ? 17 : 0), Math.floor(s.y * 7919)) % 1000) /
          1000) *
        h
      let alpha = s.alpha
      if (twinkleSet.has(s)) {
        const phase = s.x * 13 + s.y * 7
        alpha *= 0.75 + 0.25 * Math.sin(t * (1.6 + (phase % 3) * 0.7) + phase)
      }
      ctx.globalAlpha = alpha
      ctx.fillStyle = hexColor(s.color)
      ctx.beginPath()
      ctx.arc(x, y, s.size, 0, Math.PI * 2) // UNSCALED — same as in flight
      ctx.fill()
      if (s.sparkle) {
        const len = s.size * 4.5
        ctx.strokeStyle = hexColor(s.color)
        ctx.lineWidth = 0.8
        ctx.beginPath()
        ctx.moveTo(x - len, y)
        ctx.lineTo(x + len, y)
        ctx.moveTo(x, y - len)
        ctx.lineTo(x, y + len)
        ctx.stroke()
      }
    }
  }
  ctx.globalAlpha = 1

  // nebula smudges as distant directional glow
  for (const sm of sky.smudges) {
    const az =
      ((Math.atan2(sm.y - cam.y, sm.x - cam.x) - cam.rot + Math.PI * 3) % (Math.PI * 2)) - Math.PI
    if (Math.abs(az) > FOV) continue
    const x = w / 2 + Math.tan(Math.max(-1.2, Math.min(1.2, az))) * focal
    for (let i = 3; i >= 1; i--) {
      ctx.fillStyle = hexColor(sm.color) + '07'
      ctx.beginPath()
      ctx.arc(x, h * 0.4, (sm.r * (4 - i)) / 2, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // --- planet
  if (spec.planet) {
    const P = spec.planet
    const p = project(P.x, P.y, altOf(spec.seed, 333) * 0.6, w, h, focal)
    if (p) {
      const r = (P.radius * focal) / p.d
      const color = planetTheme(P.type).strokeCss
      ctx.globalAlpha = distAlpha(p.d)
      ctx.fillStyle = color + '20'
      ctx.beginPath()
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = color
      ctx.lineWidth = 1.3
      ctx.stroke()
      if (P.type === 'ringed') {
        ctx.beginPath()
        ctx.ellipse(p.x, p.y, r * 1.7, r * 0.5, -0.3, 0, Math.PI * 2)
        ctx.stroke()
      }

      // owned base: same badge as in-flight — amber ring + resource-colored
      // diamond insignia (mirrors the mineral glyphs on asteroids)
      const base = playerStore.bases.find(
        (b) => b.panelKey === `${playerStore.currentPanel.px},${playerStore.currentPanel.py}`
      )
      if (base) {
        const rb = Math.max(4, r * 0.2)
        ctx.fillStyle = 'rgba(10, 16, 23, 0.75)'
        ctx.beginPath()
        ctx.arc(p.x, p.y, rb, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = '#ffb35c'
        ctx.lineWidth = 1.2
        ctx.stroke()
        const resColor = hexColor(ITEMS[base.resourceType]?.color ?? 0xffb35c)
        const d = rb * 0.55
        ctx.strokeStyle = resColor
        ctx.lineWidth = 1.1
        ctx.beginPath()
        ctx.moveTo(p.x, p.y - d)
        ctx.lineTo(p.x + d * 0.85, p.y)
        ctx.lineTo(p.x, p.y + d)
        ctx.lineTo(p.x - d * 0.85, p.y)
        ctx.closePath()
        ctx.stroke()
      }
      ctx.globalAlpha = 1
    }
  }

  // --- station
  if (spec.station) {
    const p = project(spec.station.x, spec.station.y, altOf(spec.seed, 555) * 0.8, w, h, focal)
    if (p) {
      const r = (60 * focal) / p.d
      ctx.globalAlpha = distAlpha(p.d)
      ctx.strokeStyle = '#7dffd8'
      ctx.lineWidth = 1.1
      ctx.beginPath()
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + t * 0.05
        i === 0
          ? ctx.moveTo(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r)
          : ctx.lineTo(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r)
      }
      ctx.closePath()
      ctx.stroke()
      ctx.globalAlpha = 1
    }
  }

  // --- gravity well (typed star dominates the view when close) — pinned to
  // the horizon so facing it always shows it rising over the console
  if (spec.well) {
    const p = project(spec.well.x, spec.well.y, 0, w, h, focal)
    if (p) {
      if (spec.well.kind === 'star') {
        const st = STAR_TYPES[spec.well.starType] || STAR_TYPES['main-sequence']
        const r = Math.max(4, (spec.well.radius * focal) / p.d)
        const pulse = 0.85 + 0.15 * Math.sin((t * 2000) / st.pulseMs)
        const g2 = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 4)
        g2.addColorStop(0, hexColor(st.core))
        g2.addColorStop(0.25, hexColor(st.mid) + 'cc')
        g2.addColorStop(0.6, hexColor(st.halo) + '55')
        g2.addColorStop(1, 'transparent')
        ctx.globalAlpha = pulse
        ctx.fillStyle = g2
        ctx.fillRect(p.x - r * 4, p.y - r * 4, r * 8, r * 8)
        ctx.globalAlpha = 1
        ctx.fillStyle = hexColor(st.core)
        ctx.beginPath()
        ctx.arc(p.x, p.y, r * 0.7, 0, Math.PI * 2)
        ctx.fill()
      } else {
        const r = Math.max(3, (34 * focal) / p.d)
        ctx.fillStyle = '#05060a'
        ctx.beginPath()
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = '#b28aff'
        ctx.lineWidth = 1
        ctx.stroke()
        ctx.beginPath()
        ctx.ellipse(p.x, p.y, r * 2.4, r * 0.9, -0.25, 0, Math.PI * 2)
        ctx.globalAlpha = 0.6
        ctx.stroke()
        ctx.globalAlpha = 1
      }
    }
  }

  // --- asteroids: real shapes, real drift, perspective-scaled (far → near)
  const drawable = []
  for (const rock of rocks) {
    const m = rock.radius
    const wx = (((rock.x + rock.vx * t + m) % (PANEL_W + m * 2)) + PANEL_W + m * 2) % (PANEL_W + m * 2) - m
    const wy = (((rock.y + rock.vy * t + m) % (PANEL_H + m * 2)) + PANEL_H + m * 2) % (PANEL_H + m * 2) - m
    const p = project(wx, wy, rock.alt, w, h, focal)
    if (!p || p.d > FADE_FAR * 1.4) continue
    drawable.push({ rock, p })
  }
  drawable.sort((a, b) => b.p.d - a.p.d) // painters: far first
  for (const { rock, p } of drawable) {
    const s2 = focal / p.d
    const rot = rock.rot + rock.spin * t
    ctx.save()
    ctx.translate(p.x, p.y)
    ctx.rotate(rot)
    ctx.scale(s2, s2)
    ctx.globalAlpha = distAlpha(p.d)
    ctx.strokeStyle = 'rgba(242,246,244,0.9)'
    ctx.lineWidth = 1.2 / s2
    ctx.beginPath()
    rock.verts.forEach(([vx2, vy2], i) => (i === 0 ? ctx.moveTo(vx2, vy2) : ctx.lineTo(vx2, vy2)))
    ctx.closePath()
    ctx.stroke()
    if (rock.mineral) {
      const color = hexColor(ITEMS[rock.mineral.type]?.color ?? 0x7dffd8)
      const g3 = Math.max(2.5, rock.radius * 0.22)
      ctx.strokeStyle = color
      ctx.lineWidth = 1 / s2
      ctx.beginPath()
      ctx.moveTo(0, -g3)
      ctx.lineTo(g3 * 0.7, 0)
      ctx.lineTo(0, g3)
      ctx.lineTo(-g3 * 0.7, 0)
      ctx.closePath()
      ctx.stroke()
    }
    ctx.restore()
  }
  ctx.globalAlpha = 1

  ctx.restore() // end bob

  // your own hull: the nose, dead ahead below you
  if (shipDef) {
    const cx = w / 2
    const cy = h + h * 0.09
    const ns = Math.max(4.5, w / 220)
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(-Math.PI / 2)
    ctx.scale(ns, ns)
    ctx.strokeStyle = getShipAccent(playerStore.selectedShip).css
    ctx.globalAlpha = 0.9
    ctx.lineWidth = 1.4 / ns
    ctx.beginPath()
    shipDef.verts.forEach(([vx2, vy2], i) => (i === 0 ? ctx.moveTo(vx2, vy2) : ctx.lineTo(vx2, vy2)))
    ctx.closePath()
    ctx.stroke()
    ctx.globalAlpha = 1
    ctx.restore()
  }

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
}

onMounted(() => {
  setupScene()
  resize()
  window.addEventListener('resize', resize)
  raf = requestAnimationFrame(draw)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  window.removeEventListener('resize', resize)
})
</script>

<template>
  <div class="space-page">
    <canvas ref="canvasRef" class="space"></canvas>
    <!-- through-the-glass framing: vignette always; reflections + corner
         struts only when no external cockpit chrome is drawn over us -->
    <div class="glass-fx">
      <template v-if="chrome">
        <div class="reflect r1"></div>
        <div class="reflect r2"></div>
        <div class="strut sl"></div>
        <div class="strut sr"></div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.space-page {
  position: absolute;
  inset: 0;
  z-index: 0;
}

.space {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.glass-fx {
  position: absolute;
  inset: 0;
  pointer-events: none;
  box-shadow: inset 0 0 140px rgba(0, 0, 0, 0.75);
}

.reflect {
  position: absolute;
  top: -30%;
  height: 160%;
  width: 110px;
  background: linear-gradient(90deg, transparent, rgba(234, 246, 255, 0.035), transparent);
  transform: rotate(16deg);
}

.r1 { left: 16%; }
.r2 { left: 72%; width: 54px; opacity: 0.7; }

/* canopy struts running the full height of the view */
.strut {
  position: absolute;
  top: -6%;
  bottom: -6%;
  width: 58px;
  border-left: 1px solid rgba(234, 246, 255, 0.14);
  border-right: 1px solid rgba(234, 246, 255, 0.14);
  background:
    radial-gradient(circle 2px at 50% 14%, rgba(234, 246, 255, 0.3) 0 1.4px, transparent 2px),
    radial-gradient(circle 2px at 50% 46%, rgba(234, 246, 255, 0.3) 0 1.4px, transparent 2px),
    radial-gradient(circle 2px at 50% 78%, rgba(234, 246, 255, 0.3) 0 1.4px, transparent 2px),
    repeating-linear-gradient(180deg, rgba(16, 21, 28, 0.92) 0 30px, rgba(11, 15, 21, 0.92) 30px 60px);
}

.strut.sl { left: 6%; transform: rotate(14deg); }
.strut.sr { right: 6%; transform: rotate(-14deg); }
</style>
