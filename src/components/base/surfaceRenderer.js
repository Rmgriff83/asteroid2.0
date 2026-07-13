// Shared canvas renderer for planet surfaces — consumed by BOTH the landing
// cutscene (camX/altitude animate) and the base window (camX still, weather
// and day/night live). Plain module, no Vue. All motion is a stateless
// function of (seed, t): there is no particle state, so a frame at any t is
// reproducible and reduced-motion is just t=0 with weather skipped.
import { hash32 } from '../../game/utils/rng'
import { planetTheme } from '../../game/data/planetTheme'
import { PANEL_W, PANEL_H } from '../../game/galaxy/constants'
import { SURF_W, SURF_N, dayState, weatherIntensity } from '../../game/galaxy/surfaceGen'

const SAMPLE_STEP = SURF_W / SURF_N // surface units between height samples

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

// mix returns hex so its output can feed back into another mix
function mix(hexA, hexB, u) {
  const a = hexToRgb(hexA)
  const b = hexToRgb(hexB)
  const v = Math.max(0, Math.min(1, u))
  const n =
    (Math.round(a[0] + (b[0] - a[0]) * v) << 16) |
    (Math.round(a[1] + (b[1] - a[1]) * v) << 8) |
    Math.round(a[2] + (b[2] - a[2]) * v)
  return '#' + n.toString(16).padStart(6, '0')
}

function cssHex(n) {
  return '#' + n.toString(16).padStart(6, '0')
}

// One-time prep: normalize the sky's stars and resolve the theme. Cheap —
// per-frame geometry is built directly from the height samples.
export function buildSurfaceView(surface, sky) {
  const theme = planetTheme(surface.type)
  const stars = (sky?.stars || []).map((s) => ({
    x: s.x / PANEL_W, // panel space → normalized
    y: s.y / PANEL_H,
    size: s.size,
    alpha: s.alpha,
    color: cssHex(s.color),
    sparkle: !!s.sparkle,
    phase: s.x * 13 + s.y * 7,
    twinkles: sky?.twinklers?.includes(s) || false,
  }))
  return { surface, theme, stars }
}

// vertical anchor of a terrain layer's baseline (fraction of view height)
function layerBase(i) {
  return 0.6 + i * 0.08
}

function heightAt(points, worldX) {
  const fx = (((worldX % SURF_W) + SURF_W) % SURF_W) / SAMPLE_STEP
  const i0 = Math.floor(fx) % SURF_N
  const frac = fx - Math.floor(fx)
  return points[i0] + (points[i0 + 1] - points[i0]) * frac
}

// screen y of the near-layer ground under a surface x (cutscene touchdown,
// base placement). Falls back to the cloud deck for aerostat worlds.
export function groundYAt(view, opt, worldX) {
  const { surface } = view
  const altShift = (opt.altitude || 0) * opt.h
  if (surface.kind !== 'terrain') return opt.h * 0.78 + altShift * 0.5
  const i = surface.layers.length - 1
  const l = surface.layers[i]
  return layerBase(i) * opt.h + altShift - heightAt(l.points, worldX) * l.amp * opt.h * 0.5
}

// nearest wrapped screen x of a surface x for the near (parallax 1) layer
export function surfaceScreenX(opt, worldX) {
  let dx = (((worldX - opt.camX) % SURF_W) + SURF_W) % SURF_W
  if (dx > SURF_W / 2) dx -= SURF_W
  return opt.w * 0.5 + dx
}

function skyColors(theme, day) {
  const base = mix(theme.sky.night, theme.sky.day, day.light)
  const horizon = mix(base, theme.sky.dusk, day.dusk * 0.75)
  // zenith darkens far more at night than by day, so noon reads as daylight
  const top = mix(base, '#04060b', 0.2 + 0.4 * (1 - day.light))
  return { top, horizon }
}

// opt: { w, h, camX, altitude, t, nowMs, reduced, showStars, baseAt, baseColor }
export function drawSurfaceFrame(ctx, view, opt) {
  const { surface, theme, stars } = view
  const { w, h, camX } = opt
  const t = opt.reduced ? 0 : opt.t
  const nowMs = opt.nowMs ?? Date.now()
  const day = dayState(surface, nowMs)
  const altShift = (opt.altitude || 0) * h
  const sky = skyColors(theme, day)

  // --- sky
  const grad = ctx.createLinearGradient(0, 0, 0, h)
  grad.addColorStop(0, sky.top)
  grad.addColorStop(0.78, sky.horizon)
  grad.addColorStop(1, sky.top)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, w, h)

  // --- stars, attenuated by atmosphere thickness × daylight; the opaque
  // terrain fills will occlude the low ones, so they can spill past the
  // horizon band freely
  if (opt.showStars !== false) {
    const vis = Math.max(0, 1 - surface.atmosphereDensity * (0.3 + 0.7 * day.light) - day.light * 0.45)
    if (vis > 0.02) {
      for (const s of stars) {
        let alpha = s.alpha * vis
        if (s.twinkles && !opt.reduced) {
          alpha *= 0.75 + 0.25 * Math.sin(t * 1.7 + s.phase)
        }
        const x = s.x * w
        const y = s.y * h * 0.8
        ctx.globalAlpha = alpha
        ctx.fillStyle = s.color
        ctx.beginPath()
        ctx.arc(x, y, s.size, 0, Math.PI * 2)
        ctx.fill()
        if (s.sparkle && alpha > 0.3) {
          const len = s.size * 4
          ctx.strokeStyle = s.color
          ctx.lineWidth = 0.8
          ctx.beginPath()
          ctx.moveTo(x - len, y)
          ctx.lineTo(x + len, y)
          ctx.moveTo(x, y - len)
          ctx.lineTo(x, y + len)
          ctx.stroke()
        }
      }
      ctx.globalAlpha = 1
    }
  }

  // --- the planet's own rings, faint overhead (ringed aerostats)
  if (surface.ringArcInSky) {
    ctx.strokeStyle = theme.strokeCss
    for (const [lw, a] of [[5, 0.05], [1.2, 0.16]]) {
      ctx.lineWidth = lw
      ctx.globalAlpha = a * (0.5 + 0.5 * (1 - day.light))
      ctx.beginPath()
      ctx.ellipse(w * 0.5, h * 1.05, w * 0.72, h * 0.62, 0, Math.PI * 1.05, Math.PI * 1.95)
      ctx.stroke()
    }
    ctx.globalAlpha = 1
  }

  // --- sun by day / moon by night, riding an arc over the horizon
  drawSunMoon(ctx, theme, day, w, h)

  if (surface.kind === 'terrain') {
    drawTerrain(ctx, view, opt, day, sky, t, altShift)
  } else {
    drawCloudDeck(ctx, view, opt, day, sky, t, altShift)
  }

  // --- weather (skipped under reduced motion — the zen is stillness there)
  if (!opt.reduced) {
    drawWeather(ctx, view, opt, t, nowMs, altShift)
  }
}

function drawSunMoon(ctx, theme, day, w, h) {
  const horizonY = h * 0.56
  const isDay = day.phase >= 0.25 && day.phase <= 0.75
  const prog = isDay
    ? (day.phase - 0.25) / 0.5
    : day.phase > 0.75
      ? (day.phase - 0.75) / 0.5
      : (day.phase + 0.25) / 0.5
  const x = w * (0.12 + 0.76 * prog)
  const y = horizonY - Math.sin(prog * Math.PI) * h * 0.34
  if (y > horizonY + 20) return
  if (isDay) {
    const r = h * 0.05
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 4)
    g.addColorStop(0, mix('#fff3cd', theme.sky.dusk, day.dusk * 0.5))
    g.addColorStop(0.25, mix('#ffd67a', theme.sky.dusk, day.dusk * 0.4) )
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.globalAlpha = 0.5 + 0.4 * day.light
    ctx.fillStyle = g
    ctx.fillRect(x - r * 4, y - r * 4, r * 8, r * 8)
    ctx.globalAlpha = 1
  } else {
    const r = h * 0.028
    ctx.strokeStyle = '#eaf6ff'
    ctx.globalAlpha = 0.7 * (1 - day.light)
    ctx.lineWidth = 1.2
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.stroke()
    ctx.fillStyle = '#eaf6ff'
    ctx.globalAlpha = 0.14 * (1 - day.light)
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
  }
}

function drawTerrain(ctx, view, opt, day, sky, t, altShift) {
  const { surface, theme } = view
  const { w, h } = opt
  const n = surface.layers.length

  surface.layers.forEach((l, i) => {
    const ox = opt.camX * l.parallax
    const base = layerBase(i) * h + altShift
    const scaleY = l.amp * h * 0.5
    const k0 = Math.floor((ox - 40) / SAMPLE_STEP)
    const k1 = Math.ceil((ox + w + 40) / SAMPLE_STEP)

    ctx.beginPath()
    ctx.moveTo(k0 * SAMPLE_STEP - ox, h + 4)
    for (let k = k0; k <= k1; k++) {
      const y = base - surface.layers[i].points[((k % SURF_N) + SURF_N) % SURF_N] * scaleY
      ctx.lineTo(k * SAMPLE_STEP - ox, y)
    }
    ctx.lineTo(k1 * SAMPLE_STEP - ox, h + 4)
    ctx.closePath()

    // atmospheric perspective: far layers dissolve toward the sky color;
    // fills are OPAQUE so ridges occlude stars and each other correctly
    ctx.fillStyle = mix(sky.horizon, theme.fillCss, 0.35 + (0.65 * (i + 1)) / n)
    ctx.fill()
    // the house double-stroke: wide faint pass under a thin bright pass
    ctx.strokeStyle = theme.strokeCss
    ctx.lineWidth = 4
    ctx.globalAlpha = 0.12 * l.alpha
    ctx.stroke()
    ctx.lineWidth = 1.2
    ctx.globalAlpha = (0.5 + 0.5 * day.light) * l.alpha
    ctx.stroke()
    ctx.globalAlpha = 1

    if (i === n - 1) {
      drawFeatures(ctx, view, opt, day, sky, t, altShift)
      if (opt.baseAt != null) drawBaseSilhouette(ctx, view, opt, t)
    }
  })
}

function drawFeatures(ctx, view, opt, day, sky, t, altShift) {
  const { surface, theme } = view
  const { w, h } = opt
  const nearFill = mix(sky.horizon, theme.fillCss, 1)
  const ember = theme.emberCss || theme.strokeCss

  for (const f of surface.features) {
    const sx = surfaceScreenX(opt, f.x)
    if (sx < -240 || sx > w + 240) continue
    const gy = groundYAt(view, opt, f.x)
    const fh = f.h * h
    ctx.strokeStyle = theme.strokeCss
    ctx.fillStyle = nearFill

    if (f.kind === 'volcano') {
      const half = f.w / 2
      const lip = f.w * 0.1
      ctx.beginPath()
      ctx.moveTo(sx - half, gy + 6)
      ctx.lineTo(sx - lip, gy - fh)
      ctx.lineTo(sx, gy - fh + 5)
      ctx.lineTo(sx + lip, gy - fh)
      ctx.lineTo(sx + half, gy + 6)
      ctx.closePath()
      ctx.fill()
      ctx.lineWidth = 1.3
      ctx.globalAlpha = 0.8
      ctx.stroke()
      // crater glow
      ctx.strokeStyle = ember
      ctx.lineWidth = 1.6
      ctx.globalAlpha = 0.5 + 0.35 * Math.sin(t * 1.3 + f.r * 9)
      ctx.beginPath()
      ctx.moveTo(sx - lip, gy - fh)
      ctx.lineTo(sx + lip, gy - fh)
      ctx.stroke()
      ctx.globalAlpha = 1
      // the smoke column: overlapping translucent puffs drifting up — the
      // "smoking volcano". Stateless: puff position is a function of t.
      if (!opt.reduced) {
        for (let j = 0; j < 3; j++) {
          const prog = (t * 0.045 + f.r + j * 0.33) % 1
          const px = sx + Math.sin(prog * 5 + f.r * 7) * f.w * 0.12 + prog * 14
          const py = gy - fh - prog * h * 0.2
          ctx.fillStyle = '#9aa39c'
          ctx.globalAlpha = 0.07 * (1 - prog)
          ctx.beginPath()
          ctx.arc(px, py, 5 + prog * 20, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.globalAlpha = 1
      }
    } else if (f.kind === 'crater') {
      // side-on crater: a shallow dip between two raised lips, hugging the
      // ground line (a full ellipse reads as a floating oval from here)
      const rx = f.w * 0.28
      const dip = rx * 0.35
      ctx.lineWidth = 1.3
      ctx.globalAlpha = 0.7
      ctx.beginPath()
      ctx.moveTo(sx - rx * 1.3, gy + 3)
      ctx.quadraticCurveTo(sx - rx * 1.05, gy - dip * 0.5, sx - rx * 0.8, gy - dip * 0.35)
      ctx.quadraticCurveTo(sx, gy + dip, sx + rx * 0.8, gy - dip * 0.35)
      ctx.quadraticCurveTo(sx + rx * 1.05, gy - dip * 0.5, sx + rx * 1.3, gy + 3)
      ctx.stroke()
      ctx.globalAlpha = 1
    } else if (f.kind === 'shard' || f.kind === 'spire') {
      const half = f.kind === 'shard' ? f.w * 0.14 : f.w * 0.08
      const lean = (f.r - 0.5) * half * 1.6
      ctx.beginPath()
      ctx.moveTo(sx - half, gy + 4)
      ctx.lineTo(sx + lean, gy - fh * 1.15)
      ctx.lineTo(sx + half, gy + 4)
      ctx.closePath()
      ctx.fill()
      ctx.lineWidth = 1.2
      ctx.globalAlpha = f.kind === 'shard' ? 0.9 : 0.7
      ctx.stroke()
      if (f.kind === 'shard') {
        // glint line down the face
        ctx.strokeStyle = '#eaf6ff'
        ctx.globalAlpha = 0.4
        ctx.beginPath()
        ctx.moveTo(sx + lean * 0.6, gy - fh * 0.9)
        ctx.lineTo(sx - half * 0.2, gy)
        ctx.stroke()
        ctx.strokeStyle = theme.strokeCss
      }
      ctx.globalAlpha = 1
    } else if (f.kind === 'crack') {
      // jagged glowing fissure along the ground (the lava-crack idiom)
      ctx.strokeStyle = ember
      ctx.lineWidth = 1.4
      ctx.globalAlpha = 0.55 + 0.3 * Math.sin(t * 0.9 + f.r * 11)
      ctx.beginPath()
      let cx2 = sx - f.w / 2
      let cy2 = gy + 4
      ctx.moveTo(cx2, cy2)
      for (let j = 1; j <= 4; j++) {
        cx2 = sx - f.w / 2 + (f.w * j) / 4
        cy2 = gy + 4 + Math.sin(f.r * 20 + j * 4.7) * 5
        ctx.lineTo(cx2, cy2)
      }
      ctx.stroke()
      ctx.globalAlpha = 1
    }
  }
}

function drawCloudDeck(ctx, view, opt, day, sky, t, altShift) {
  const { surface, theme } = view
  const { w, h } = opt
  const deckY = h * 0.78 + altShift * 0.5

  // strata: wavy translucent ribbons drifting at their own speeds
  for (const b of surface.bands) {
    const by = b.y * h + altShift * 0.3
    const th = b.thickness * h
    ctx.beginPath()
    ctx.moveTo(-8, by + th + 30)
    for (let x = -8; x <= w + 8; x += 16) {
      const y = by + Math.sin(((x + opt.camX * 0.4 + t * b.speed) / b.waveLen) * Math.PI * 2 + b.wavePhase) * b.waveAmp
      ctx.lineTo(x, y)
    }
    ctx.lineTo(w + 8, by + th + 30)
    ctx.closePath()
    ctx.fillStyle = theme.strokeCss
    ctx.globalAlpha = b.alpha * (0.35 + 0.4 * day.light)
    ctx.fill()
    ctx.globalAlpha = Math.min(0.5, b.alpha * 2)
    ctx.strokeStyle = theme.strokeCss
    ctx.lineWidth = 1
    ctx.stroke()
    ctx.globalAlpha = 1
  }

  // the aerostat deck: the hard line the base rides on
  ctx.fillStyle = mix(sky.horizon, theme.fillCss, 0.85)
  ctx.fillRect(0, deckY, w, h - deckY)
  ctx.strokeStyle = theme.strokeCss
  ctx.lineWidth = 4
  ctx.globalAlpha = 0.14
  ctx.beginPath()
  ctx.moveTo(0, deckY)
  ctx.lineTo(w, deckY)
  ctx.stroke()
  ctx.lineWidth = 1.4
  ctx.globalAlpha = 0.8
  ctx.stroke()
  ctx.globalAlpha = 1

  if (opt.baseAt != null) drawBaseSilhouette(ctx, view, opt, t)
}

// dome + mast + silo, echoing the in-flight base dome glyph; beacon tinted
// by the base's mined resource
function drawBaseSilhouette(ctx, view, opt, t) {
  const sx = surfaceScreenX(opt, opt.baseAt)
  if (sx < -80 || sx > opt.w + 80) return
  const gy = view.surface.kind === 'terrain'
    ? groundYAt(view, opt, opt.baseAt)
    : opt.h * 0.78 + (opt.altitude || 0) * opt.h * 0.5
  const s = opt.h / 800 // scale relative to a 800px reference view

  ctx.strokeStyle = '#ffb35c'
  ctx.fillStyle = 'rgba(10, 16, 23, 0.8)'
  // dome
  const dr = 26 * s
  ctx.lineWidth = 1.6
  ctx.beginPath()
  ctx.arc(sx, gy, dr, Math.PI, 0)
  ctx.closePath()
  ctx.fill()
  ctx.globalAlpha = 0.95
  ctx.beginPath()
  ctx.arc(sx, gy, dr, Math.PI, 0)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(sx - dr, gy)
  ctx.lineTo(sx + dr, gy)
  ctx.stroke()
  // silo
  const sw = 14 * s
  const sh = 34 * s
  ctx.beginPath()
  ctx.rect(sx + dr + 10 * s, gy - sh, sw, sh)
  ctx.fill()
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(sx + dr + 10 * s + sw / 2, gy - sh, sw / 2, Math.PI, 0)
  ctx.stroke()
  // mast + beacon (blinks unless reduced)
  ctx.beginPath()
  ctx.moveTo(sx, gy - dr)
  ctx.lineTo(sx, gy - dr - 18 * s)
  ctx.stroke()
  const blink = opt.reduced ? 1 : 0.55 + 0.45 * Math.sin(t * 2.2)
  ctx.fillStyle = opt.baseColor || '#ffb35c'
  ctx.globalAlpha = blink
  ctx.beginPath()
  ctx.arc(sx, gy - dr - 20 * s, 2.4 * s + 1, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1
}

function drawWeather(ctx, view, opt, t, nowMs, altShift) {
  const { surface, theme } = view
  const { w, h } = opt
  const wx = surface.weather
  if (wx.kind === 'cloud-drift') return // the bands themselves are the weather
  const intensity = weatherIntensity(surface, nowMs)
  if (intensity <= 0.01) return
  const count = Math.round(wx.count * intensity)
  const seed = surface.seed

  if (wx.kind === 'snow') {
    ctx.fillStyle = '#eaf6ff'
    for (let i = 0; i < count; i++) {
      const rx = (hash32(seed, i * 2 + 1) % 1000) / 1000
      const ry = (hash32(seed, i * 2 + 2) % 1000) / 1000
      const x = ((rx * w + Math.sin(t * 0.6 + i) * 22 + w) % w + w) % w
      const y = ((ry * h + t * wx.speed) % (h * 0.92) + h * 0.92) % (h * 0.92)
      ctx.globalAlpha = (0.35 + ry * 0.5) * intensity
      ctx.beginPath()
      ctx.arc(x, y, 0.8 + rx * 0.9, 0, Math.PI * 2)
      ctx.fill()
    }
  } else if (wx.kind === 'embers') {
    const ember = theme.emberCss || theme.strokeCss
    ctx.fillStyle = ember
    for (let i = 0; i < count; i++) {
      const rx = (hash32(seed, i * 2 + 101) % 1000) / 1000
      const ro = (hash32(seed, i * 2 + 102) % 1000) / 1000
      const rise = h * 0.4
      const prog = ((t * wx.speed + ro * rise) % rise) / rise
      const x = rx * w + Math.sin(t * 0.8 + i * 2.3) * 14
      const y = h * 0.82 + altShift * 0.3 - prog * rise
      ctx.globalAlpha = (1 - prog) * 0.7 * intensity
      ctx.beginPath()
      ctx.arc(x, y, 1.1 + ro * 0.8, 0, Math.PI * 2)
      ctx.fill()
    }
  } else if (wx.kind === 'dust') {
    ctx.strokeStyle = theme.strokeCss
    ctx.lineWidth = 1
    for (let i = 0; i < count; i++) {
      const rx = (hash32(seed, i * 2 + 201) % 1000) / 1000
      const ry = (hash32(seed, i * 2 + 202) % 1000) / 1000
      const x = ((rx * w + t * wx.speed * (0.7 + ry * 0.6)) % (w + 40)) - 20
      const y = h * (0.62 + ry * 0.34) + altShift * 0.4
      const len = 6 + ry * 12
      ctx.globalAlpha = 0.16 * intensity
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x + len, y + 1)
      ctx.stroke()
    }
  }
  ctx.globalAlpha = 1
}
