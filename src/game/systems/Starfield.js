// Persistent background starfield — a pure function of the panel seed
// (CH.STARFIELD channel), so every revisit shows the identical sky. One
// retained Graphics for the field; a handful of separate twinkle stars so the
// main field never redraws.
import { panelSeed, channelRng } from '../galaxy/seeds'
import { CH, PANEL_W, PANEL_H } from '../galaxy/constants'
import { randRange } from '../utils/geometry'

const TINTS = [
  { color: 0xeaf6ff, weight: 0.62 }, // ice white
  { color: 0x9db8ff, weight: 0.2 }, // pale blue
  { color: 0xffd6a8, weight: 0.1 }, // warm
  { color: 0xffb8e2, weight: 0.08 }, // pink
]

const NEBULA_SMUDGES = [0xb28aff, 0x7dffd8, 0xff7de9]

function pickTint(rand) {
  let roll = rand()
  for (const t of TINTS) {
    roll -= t.weight
    if (roll <= 0) return t.color
  }
  return TINTS[0].color
}

// Pure: the draw list for a panel's sky. Exposed for determinism tests.
export function starfieldSpec(galaxySeed, px, py, sector) {
  const rand = channelRng(panelSeed(galaxySeed, px, py), CH.STARFIELD)
  const count = Math.round(38 + (sector?.density ?? 0.5) * 30 + rand() * 8)
  const stars = []
  for (let i = 0; i < count; i++) {
    stars.push({
      x: rand() * PANEL_W,
      y: rand() * PANEL_H,
      size: randRange(rand, 0.6, 2.4),
      alpha: randRange(rand, 0.15, 0.95),
      color: pickTint(rand),
    })
  }
  // brightest few get sparkle crosses
  const bright = [...stars].sort((a, b) => b.alpha * b.size - a.alpha * a.size).slice(0, 6)
  for (const s of bright) s.sparkle = true

  // twinklers: the sparkle stars + a scattering of medium stars blink
  // (extra rand() draws happen AFTER the star loop, so positions/sizes above
  // are untouched — the sky layout stays stable)
  const twinklers = [...bright.slice(0, 5)]
  for (const s of stars) {
    if (twinklers.length >= 10) break
    if (!s.sparkle && s.alpha > 0.35 && rand() < 0.15) twinklers.push(s)
  }

  const smudges = []
  if (sector?.systemType === 'nebula') {
    const n = 1 + Math.floor(rand() * 2)
    for (let i = 0; i < n; i++) {
      smudges.push({
        x: rand() * PANEL_W,
        y: rand() * PANEL_H,
        r: randRange(rand, 120, 300),
        color: NEBULA_SMUDGES[Math.floor(rand() * NEBULA_SMUDGES.length)],
      })
    }
  }
  return { stars, twinklers, smudges }
}

export function spawnStarfield(scene, galaxySeed, px, py, sector) {
  const spec = starfieldSpec(galaxySeed, px, py, sector)
  const g = scene.add.graphics().setDepth(-20)

  for (const sm of spec.smudges) {
    // layered soft blob
    for (let i = 3; i >= 1; i--) {
      g.fillStyle(sm.color, 0.014 * i)
      g.fillCircle(sm.x, sm.y, (sm.r * (4 - i)) / 2.2)
    }
  }

  const twinkleSet = new Set(spec.twinklers)
  for (const s of spec.stars) {
    if (twinkleSet.has(s)) continue // drawn separately below
    g.fillStyle(s.color, s.alpha)
    g.fillCircle(s.x, s.y, s.size)
    if (s.sparkle) {
      const len = s.size * 4.5
      g.lineStyle(1, s.color, s.alpha * 0.55)
      g.lineBetween(s.x - len, s.y, s.x + len, s.y)
      g.lineBetween(s.x, s.y - len, s.x, s.y + len)
    }
  }

  // twinklers: tiny individual graphics with blink tweens. Timing params are
  // derived from each star's (deterministic) coords so phases stay desynced
  // but identical on every visit.
  const extras = []
  const tweens = []
  for (const s of spec.twinklers) {
    // graphics positioned AT the star (drawing at 0,0) so the scale pulse
    // breathes around the star itself
    const tg = scene.add.graphics().setDepth(-20)
    tg.setPosition(s.x, s.y)
    tg.fillStyle(s.color, 1)
    tg.fillCircle(0, 0, s.size)
    if (s.sparkle) {
      const len = s.size * 4.5
      tg.lineStyle(1, s.color, 0.55)
      tg.lineBetween(-len, 0, len, 0)
      tg.lineBetween(0, -len, 0, len)
    }
    tg.setAlpha(s.alpha)
    extras.push(tg)

    const phase = Math.floor(s.x * 13 + s.y * 7)
    tweens.push(
      scene.tweens.add({
        targets: tg,
        // gentle shimmer: fade to ~60% brightness and back, barely-there breathe
        alpha: { from: s.alpha * 0.6, to: s.alpha },
        scale: { from: 0.92, to: s.sparkle ? 1.08 : 1 },
        duration: 1600 + (phase % 7) * 340, // 1.6s–3.7s, slow and calm
        delay: phase % 2000, // desynced phases
        yoyo: true,
        repeat: -1,
        ease: 'sine.inout',
      })
    )
  }

  return {
    destroy() {
      for (const t of tweens) t.stop()
      for (const e of extras) e.destroy()
      g.destroy()
    },
  }
}
