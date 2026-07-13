<script setup>
// The living view out the base window: the SAME surface renderer the landing
// cutscene skims over, held still — camera parked at the landing site with a
// barely-perceptible drift. Weather, smoke, day/night all live here.
// Reduced motion: no RAF at all — one static frame, redrawn on resize and on
// a slow interval so the (real-time) day cycle still creeps.
import { onMounted, onBeforeUnmount, ref } from 'vue'
import { motion } from '../../services/motion'
import { buildSurfaceView, drawSurfaceFrame } from './surfaceRenderer'

const props = defineProps({
  surface: { type: Object, required: true },
  sky: { type: Object, required: true },
  camX: { type: Number, default: 0 },
  baseAt: { type: Number, default: null },
  baseColor: { type: String, default: '#ffb35c' },
  // canvas y (CSS px) where the window aperture ends — the scene's ground
  // is mapped to sit just above it, so the view isn't all sky (0 = full height)
  sceneBottom: { type: Number, default: 0 },
})

const canvasRef = ref(null)
let ctx = null
let raf = 0
let t0 = 0
let slowTimer = 0
let view = null

function sceneH(c) {
  // squeeze the scene so its ground line lives inside the window aperture
  return props.sceneBottom > 0 ? Math.min(c.clientHeight, props.sceneBottom + 8) : c.clientHeight
}

function drawOnce(c, t, reduced) {
  drawSurfaceFrame(ctx, view, {
    w: c.clientWidth,
    h: sceneH(c),
    // a ±6px drift on a 40s breath — alive, not restless
    camX: props.camX + (reduced ? 0 : Math.sin(t * ((Math.PI * 2) / 40)) * 6),
    altitude: 0,
    t,
    nowMs: Date.now(),
    reduced,
    showStars: true,
    baseAt: props.baseAt,
    baseColor: props.baseColor,
  })
}

function frame(now) {
  const c = canvasRef.value
  if (!c || !ctx) return
  if (!t0) t0 = now
  drawOnce(c, (now - t0) / 1000, false)
  raf = requestAnimationFrame(frame)
}

function drawStill() {
  const c = canvasRef.value
  if (!c || !ctx) return
  drawOnce(c, 0, true)
}

function resize() {
  const c = canvasRef.value
  if (!c) return
  const dpr = window.devicePixelRatio || 1
  c.width = c.clientWidth * dpr
  c.height = c.clientHeight * dpr
  ctx = c.getContext('2d')
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  if (motion.reduced) drawStill()
}

onMounted(() => {
  view = buildSurfaceView(props.surface, props.sky)
  resize()
  window.addEventListener('resize', resize)
  if (motion.reduced) {
    drawStill()
    slowTimer = setInterval(drawStill, 60000) // the day still turns
  } else {
    raf = requestAnimationFrame(frame)
  }
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  clearInterval(slowTimer)
  window.removeEventListener('resize', resize)
})
</script>

<template>
  <div class="surface-page">
    <canvas ref="canvasRef" class="surface"></canvas>
    <!-- through-the-glass vignette; struts come from BaseChrome -->
    <div class="glass-fx"></div>
  </div>
</template>

<style scoped>
.surface-page {
  position: absolute;
  inset: 0;
  z-index: 0;
}

.surface {
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
</style>
