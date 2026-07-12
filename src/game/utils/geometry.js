// Procedural polygon generation and the shared retro glow-stroke drawing style.

const TAU = Math.PI * 2

// Jittered polygon: 8-12 vertices at varied radii. `rand` is any ()=>0..1 fn.
export function makeAsteroidVerts(rand, radius) {
  const n = 8 + Math.floor(rand() * 5)
  const verts = []
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * TAU + (rand() - 0.5) * (TAU / n) * 0.6
    const r = radius * (0.68 + rand() * 0.45)
    verts.push([Math.cos(ang) * r, Math.sin(ang) * r])
  }
  return verts
}

// Double-stroke "neon" effect: wide faint pass under a thin bright pass.
export function strokeGlowPoly(gfx, verts, color, { closed = true, alpha = 1 } = {}) {
  const pts = verts.map(([x, y]) => ({ x, y }))
  gfx.lineStyle(6, color, 0.18 * alpha)
  gfx.strokePoints(pts, closed, closed)
  gfx.lineStyle(1.5, color, 0.95 * alpha)
  gfx.strokePoints(pts, closed, closed)
}

export function strokeGlowLine(gfx, x1, y1, x2, y2, color, alpha = 1) {
  gfx.lineStyle(5, color, 0.16 * alpha)
  gfx.lineBetween(x1, y1, x2, y2)
  gfx.lineStyle(1.5, color, 0.9 * alpha)
  gfx.lineBetween(x1, y1, x2, y2)
}

export function randRange(rand, min, max) {
  return min + rand() * (max - min)
}

// A planet's outer capture boundary — its "atmosphere" edge. Objects inside
// get captured into orbit; outside it the planet exerts no pull at all.
// Scales with gravity (μ ∝ radius²): 85 → 280 px, 150 → 410 px.
export function planetCaptureRadius(radius) {
  return radius * 2 + 110
}
