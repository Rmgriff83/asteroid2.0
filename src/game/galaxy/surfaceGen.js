// Pure, seeded planet-surface generation for the landing/base views.
// Derives EVERYTHING from spec.planet.visualSeed via per-block sub-channels
// (same channel discipline as panelGen, but outside its streams — adding or
// changing surfaces can never shift panel content, so no GEN_VERSION bump).
// Tuning lives in data/planetTheme.js; this module only rolls the dice.
import { hash32, mulberry32 } from '../utils/rng'
import { planetTheme } from '../data/planetTheme'

// the surface is a seamless loop this many units (≈px) around
export const SURF_W = 4096
// samples per heightline (power of two + 1 for midpoint displacement)
export const SURF_N = 256

// per-block sub-channels off visualSeed — append-only, never reorder
const SC = { HEIGHT: 1, FEATURES: 2, WEATHER: 3, DAY: 4, BANDS: 5 }

// wrapping midpoint-displacement heightline: SURF_N+1 samples in 0..1 with
// pts[SURF_N] === pts[0], so the loop closes seamlessly (a random walk can't
// guarantee that). `rough` shrinks displacement each octave: low = rolling
// hills, high = jagged shards.
function heightline(rand, rough) {
  const pts = new Array(SURF_N + 1)
  const anchors = 16
  const stride = SURF_N / anchors
  for (let i = 0; i < anchors; i++) pts[i * stride] = rand()
  pts[SURF_N] = pts[0]
  let step = stride
  let disp = 0.5
  while (step > 1) {
    const half = step / 2
    for (let i = half; i < SURF_N; i += step) {
      pts[i] = (pts[i - half] + pts[i + half]) / 2 + (rand() - 0.5) * disp
    }
    disp *= rough
    step = half
  }
  let min = Infinity
  let max = -Infinity
  for (const v of pts) {
    if (v < min) min = v
    if (v > max) max = v
  }
  const range = max - min || 1
  return pts.map((v) => (v - min) / range)
}

function countIn(rand, [lo, hi]) {
  return lo + Math.floor(rand() * (hi - lo + 1))
}

// planet: a spec.planet from generatePanel ({type, visualSeed, ...})
export function surfaceSpec(planet) {
  const theme = planetTheme(planet.type)
  const seed = planet.visualSeed
  const weather = {
    ...theme.weather,
    phaseMs: theme.weather.cadenceMs ? hash32(seed, SC.WEATHER) % theme.weather.cadenceMs : 0,
  }
  const spec = {
    type: planet.type,
    seed,
    kind: theme.surface.kind,
    atmosphereDensity: theme.atmosphereDensity,
    dayLengthMs: theme.day.lengthMs,
    dayPhaseMs: hash32(seed, SC.DAY) % theme.day.lengthMs,
    weather,
    layers: [],
    features: [],
    bands: [],
    ringArcInSky: !!theme.surface.ringArcInSky,
  }

  if (theme.surface.kind === 'terrain') {
    const hRand = mulberry32(hash32(seed, SC.HEIGHT))
    spec.layers = theme.surface.layers.map((l) => ({
      amp: l.amp,
      parallax: l.parallax,
      alpha: l.alpha,
      points: heightline(hRand, l.rough),
    }))
    const fRand = mulberry32(hash32(seed, SC.FEATURES))
    for (const [plural, range] of Object.entries(theme.surface.features)) {
      if (plural === 'caps') continue // boolean flags aren't placed features
      const kind = plural.replace(/s$/, '')
      const n = countIn(fRand, range)
      for (let i = 0; i < n; i++) {
        spec.features.push({
          kind,
          x: fRand() * SURF_W,
          w: 90 + fRand() * 150, // footprint in surface units
          h: 0.06 + fRand() * 0.1, // height as a fraction of view height
          r: fRand(), // free per-feature variation knob
        })
      }
    }
  } else {
    // clouddeck (gas/ringed aerostats): wavy strata instead of ground
    const bRand = mulberry32(hash32(seed, SC.BANDS))
    const n = countIn(bRand, theme.surface.bands)
    for (let i = 0; i < n; i++) {
      spec.bands.push({
        y: 0.3 + ((i + 0.5) / n) * 0.5 + (bRand() - 0.5) * 0.05, // fraction of height
        thickness: 0.025 + bRand() * 0.05,
        alpha: 0.1 + bRand() * 0.18,
        waveAmp: 6 + bRand() * 16,
        waveLen: 380 + bRand() * 400,
        wavePhase: bRand() * Math.PI * 2,
        speed: (0.5 + bRand()) * (theme.weather.speed || 6),
      })
    }
  }
  return spec
}

// Wall-clock day cycle (persists across sessions; each planet offset by seed).
// phase 0 = midnight. light: 0 midnight → 1 noon. dusk peaks at dawn/sunset.
export function dayState(surface, nowMs = Date.now()) {
  const L = surface.dayLengthMs
  const phase = (((nowMs + surface.dayPhaseMs) % L) + L) % L / L
  const light = 0.5 - 0.5 * Math.cos(phase * Math.PI * 2)
  const dusk = Math.sin(phase * Math.PI * 2) ** 2 * (1 - Math.abs(light - 0.5) * 1.2)
  return { phase, light, dusk: Math.max(0, dusk) }
}

// 0..1 "is it snowing right now" — a duty-cycle window over the weather
// cadence with soft ramps, so storms drift in and out instead of popping.
// cadenceMs 0 = always on (embers, cloud drift).
export function weatherIntensity(surface, nowMs = Date.now()) {
  const wx = surface.weather
  if (!wx.cadenceMs) return 1
  const cyc = (((nowMs + wx.phaseMs) % wx.cadenceMs) + wx.cadenceMs) % wx.cadenceMs / wx.cadenceMs
  if (cyc > wx.duty) return 0
  const u = cyc / wx.duty
  const ramp = 0.15
  if (u < ramp) return u / ramp
  if (u > 1 - ramp) return (1 - u) / ramp
  return 1
}
