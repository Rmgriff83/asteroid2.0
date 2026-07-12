// Manual 2D elastic collision resolution (impulse method) — Arcade's builtin
// circle separation zeroes relative velocity for container bodies, so we do
// the real physics ourselves:
//
//   j = (1+e)·v_rel·n / (1/m₁ + 1/m₂)      (impulse magnitude)
//   v₁ ← v₁ − (j/m₁)·n,  v₂ ← v₂ + (j/m₂)·n (momentum-conserving exchange)
//
// e = restitution (1 = perfectly elastic). Immovable bodies get infinite
// mass (1/m = 0). Returns the approach speed along the normal — callers use
// it as an impact-damage threshold.
export function resolveElastic(o1, o2, e = 0.9) {
  const b1 = o1.body
  const b2 = o2.body
  if (!b1 || !b2) return 0
  const r1 = b1.halfWidth
  const r2 = b2.halfWidth
  const dx = o2.x - o1.x
  const dy = o2.y - o1.y
  const dist = Math.hypot(dx, dy) || 1
  const nx = dx / dist
  const ny = dy / dist

  const im1 = b1.immovable ? 0 : 1 / (b1.mass || 1)
  const im2 = b2.immovable ? 0 : 1 / (b2.mass || 1)
  const imSum = im1 + im2
  if (imSum === 0) return 0

  // positional de-penetration, inverse-mass weighted (light bodies yield)
  const overlap = r1 + r2 - dist
  if (overlap > 0) {
    o1.x -= nx * overlap * (im1 / imSum)
    o1.y -= ny * overlap * (im1 / imSum)
    o2.x += nx * overlap * (im2 / imSum)
    o2.y += ny * overlap * (im2 / imSum)
  }

  // approach speed along the collision normal (positive = closing)
  const vn = (b1.velocity.x - b2.velocity.x) * nx + (b1.velocity.y - b2.velocity.y) * ny
  if (vn <= 0) return 0 // already separating

  const j = ((1 + e) * vn) / imSum
  b1.velocity.x -= j * im1 * nx
  b1.velocity.y -= j * im1 * ny
  b2.velocity.x += j * im2 * nx
  b2.velocity.y += j * im2 * ny
  return vn
}
