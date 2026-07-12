// Structural bias fields — pure math sampled per sector. The galaxy's shape
// (spiral arms, core→rim danger/richness gradient) is formulas, never data.
import { GALAXY_CENTER } from './constants'

const TAU = Math.PI * 2
const ARMS = 2
const TWIST = 0.35 // logarithmic arm winding
const DANGER_RADIUS = 40 // sectors from core where danger saturates

export function coreDist(sx, sy) {
  return Math.hypot(sx - GALAXY_CENTER.sx, sy - GALAXY_CENTER.sy)
}

// 1 on an arm ridge, falling to 0 between arms.
export function spiralArmStrength(sx, sy) {
  const dx = sx - GALAXY_CENTER.sx
  const dy = sy - GALAXY_CENTER.sy
  const r = Math.hypot(dx, dy)
  if (r < 1.5) return 1 // the core is dense everywhere
  const theta = Math.atan2(dy, dx)
  const phase = ((theta - Math.log(r) / TWIST) * ARMS) / TAU
  const frac = Math.abs(phase - Math.round(phase)) // 0 on arm .. 0.5 between
  return Math.max(0, 1 - frac * 3.2)
}

// Safe-but-poor core → dangerous-but-rich rim.
export function dangerAt(sx, sy) {
  const d = coreDist(sx, sy) / DANGER_RADIUS
  return Math.min(1, Math.max(0.04, d))
}

export function richnessAt(sx, sy) {
  const arm = spiralArmStrength(sx, sy)
  return Math.min(1, dangerAt(sx, sy) * 0.75 + arm * 0.25)
}

export function densityAt(sx, sy) {
  const arm = spiralArmStrength(sx, sy)
  return 0.3 + arm * 0.55
}
