// generatePanel: the single deterministic placement step. Pure data out —
// no Phaser. Same (galaxySeed, px, py, authored) → identical panelSpec forever.
//
// Per-channel RNG discipline: every subsystem draws from its OWN stream so
// features added in later phases never shift existing panels' content.
import { panelSeed, sectorSeed, channelRng } from './seeds'
import { CH, PANEL_W, PANEL_H, ASTEROID_TIERS, SECTOR_SIZE } from './constants'
import { resolveSector, sectorOf, RESOURCE_TYPES } from './sectorProps'
import { starWellSpec, STAR_TYPES } from '../data/stars'
import { makeAsteroidVerts, randRange } from '../utils/geometry'
import { PANEL_COLORS } from '../data/palette'
import { hash32 } from '../utils/rng'
import { ENEMY_ROLES, FLAVOR_SPAWNS } from '../data/enemies'
import { pickDialogue } from '../data/lore'

const TAU = Math.PI * 2

export function panelKey(px, py) {
  return `${px},${py}`
}

// paletteBias gives each sector a regional color identity while individual
// panels still vary within it.
export function panelBgColor(px, py, paletteBias = 0) {
  return PANEL_COLORS[(hash32(px, py) % 5 + paletteBias) % PANEL_COLORS.length]
}

// Which panels of a sector host its guaranteed star systems, and their types.
// Pure + seeded (CH.STARS) — identical forever. Pass the resolved sector if
// you already have it to skip re-resolution.
export function sectorStarAssignments(galaxySeed, sx, sy, authored = null, sectorOpt = null) {
  const sector = sectorOpt || resolveSector(galaxySeed, sx, sy, authored)
  const rng = channelRng(sectorSeed(galaxySeed, sx, sy), CH.STARS)
  const assignments = new Map()
  const count = Math.max(0, Math.min(3, Math.round(sector.starCount ?? 1)))
  const used = new Set()
  for (let i = 0; i < count; i++) {
    let dx
    let dy
    let tries = 0
    do {
      dx = Math.floor(rng() * SECTOR_SIZE)
      dy = Math.floor(rng() * SECTOR_SIZE)
      tries++
    } while (used.has(`${dx},${dy}`) && tries < 24)
    used.add(`${dx},${dy}`)
    const type = pickWeighted(rng, sector.starWeights) || 'main-sequence'
    assignments.set(panelKey(sx * SECTOR_SIZE + dx, sy * SECTOR_SIZE + dy), type)
  }
  return assignments
}

function pickWeighted(rng, weightsObj) {
  const entries = Object.entries(weightsObj).filter(([, w]) => w > 0)
  if (!entries.length) return null
  const total = entries.reduce((s, [, w]) => s + w, 0)
  let roll = rng() * total
  for (const [key, w] of entries) {
    roll -= w
    if (roll <= 0) return key
  }
  return entries[entries.length - 1][0]
}

export function generatePanel(galaxySeed, px, py, authored = null) {
  const seed = panelSeed(galaxySeed, px, py)
  const { sx, sy } = sectorOf(px, py)
  const sector = resolveSector(galaxySeed, sx, sy, authored)
  const pin = authored?.panels?.[panelKey(px, py)] || null

  const spec = {
    px,
    py,
    seed,
    sector,
    pin,
    bgColor: panelBgColor(px, py, sector.paletteBias),
    well: null,
    planet: null,
    station: null, // phase 6
    asteroids: [],
    enemies: [], // phase 5
  }

  // --- planet (CH.PLANET stream) ---
  const planetRng = channelRng(seed, CH.PLANET)
  const wantPlanet = pin?.planet || (!pin?.clear && planetRng() < 0.16 + sector.density * 0.1)
  if (wantPlanet) {
    const type = pin?.planet?.type || pickWeighted(planetRng, sector.planetWeights) || 'rocky'
    const radius = pin?.planet?.size || randRange(planetRng, 85, 150)
    const margin = radius + 70
    const x = randRange(planetRng, margin, PANEL_W - margin)
    const y = randRange(planetRng, margin, PANEL_H - margin)
    const nodeCount = 2 + Math.floor(planetRng() * 4)
    const nodes = []
    for (let i = 0; i < nodeCount; i++) {
      nodes.push({
        idx: i,
        ang: planetRng() * TAU,
        type: pickWeighted(planetRng, sector.resourceWeights) || RESOURCE_TYPES[0],
        amount: 2 + Math.floor(planetRng() * 4),
      })
    }
    spec.planet = {
      type,
      x,
      y,
      radius,
      nodes,
      baseSite: planetRng() < 0.35,
      visualSeed: hash32(seed, CH.PLANET),
      // standard gravitational parameter μ = G·M; planets pull noticeably
      // weaker than stars (r=150 → 1.6e6 vs red dwarf 2.2e6)
      mu: radius * radius * 70,
    }
  }

  // --- gravity well (CH.WELL stream for in-panel position; CH.STARS decides
  //     WHICH panels get stars — every sector guarantees 1–2 star systems) ---
  const wellRng = channelRng(seed, CH.WELL)
  let x = randRange(wellRng, 200, PANEL_W - 200)
  let y = randRange(wellRng, 180, PANEL_H - 180)
  if (spec.planet) {
    // keep clear of the planet, deterministically
    const minGap = spec.planet.radius + 300
    if (Math.hypot(x - spec.planet.x, y - spec.planet.y) < minGap) {
      x = PANEL_W - x
      y = PANEL_H - y
    }
  }
  const visualSeed = hash32(seed, CH.WELL)
  const pinWell = pin?.well // 'none' | 'blackhole' | 'star' | {kind:'star', starType}

  if (pinWell === 'none') {
    // authored: keep this panel well-free
  } else if (pinWell) {
    const kind = typeof pinWell === 'string' ? pinWell : pinWell.kind
    if (kind === 'blackhole') {
      spec.well = { kind, x, y, strength: 5.2e6, minDist: 130, killRadius: 55, visualSeed }
    } else {
      const starType =
        (typeof pinWell === 'object' && STAR_TYPES[pinWell.starType] && pinWell.starType) ||
        pickWeighted(wellRng, sector.starWeights) ||
        'main-sequence'
      spec.well = { ...starWellSpec(starType, x, y, visualSeed) }
    }
  } else if (!pin?.clear) {
    const assignedType = sectorStarAssignments(galaxySeed, sx, sy, authored, sector).get(
      panelKey(px, py)
    )
    if (assignedType) {
      spec.well = { ...starWellSpec(assignedType, x, y, visualSeed) }
    } else if (wellRng() < 0.04 + sector.danger * 0.05) {
      // black holes stay a per-panel danger roll
      spec.well = { kind: 'blackhole', x, y, strength: 5.2e6, minDist: 130, killRadius: 55, visualSeed }
    }
  }

  // --- asteroids (CH.ROCKS stream) ---
  const rockRng = channelRng(seed, CH.ROCKS)
  const count = pin?.clear ? 0 : Math.round(3 + sector.density * 5 + rockRng() * 2)
  for (let i = 0; i < count; i++) {
    const roll = rockRng()
    const radius =
      roll < 0.5 ? ASTEROID_TIERS[0] : roll < 0.8 ? ASTEROID_TIERS[1] : ASTEROID_TIERS[2]
    const x = randRange(rockRng, radius, PANEL_W - radius)
    const y = randRange(rockRng, radius, PANEL_H - radius)
    const ang = rockRng() * TAU
    const speed = randRange(rockRng, 20, 70)
    const verts = makeAsteroidVerts(rockRng, radius)
    const spin = randRange(rockRng, -1.5, 1.5)
    spec.asteroids.push({
      idx: i,
      x,
      y,
      radius,
      verts,
      vx: Math.cos(ang) * speed,
      vy: Math.sin(ang) * speed,
      spin,
      mineral: null, // phase 6 (CH.MINERAL stream)
    })
  }

  // --- minerals (CH.MINERAL stream) ---
  const mineralRng = channelRng(seed, CH.MINERAL)
  for (const a of spec.asteroids) {
    const forced = pin?.resource && mineralRng() < 0.6
    if (forced || mineralRng() < 0.25 + sector.richness * 0.35) {
      a.mineral = {
        type: forced ? pin.resource.type : pickWeighted(mineralRng, sector.resourceWeights) || 'ferrite',
        amount: 1 + Math.floor(mineralRng() * 3) + (pin?.resource?.rich ? 2 : 0),
      }
    }
  }

  // --- station (CH.STATION stream) ---
  const stationRng = channelRng(seed, CH.STATION)
  if (pin?.station || (!pin?.clear && stationRng() < sector.stationDensity)) {
    let x = randRange(stationRng, 220, PANEL_W - 220)
    let y = randRange(stationRng, 180, PANEL_H - 180)
    if (spec.planet && Math.hypot(x - spec.planet.x, y - spec.planet.y) < spec.planet.radius + 220) {
      x = PANEL_W - x
      y = PANEL_H - y
    }
    if (spec.well && Math.hypot(x - spec.well.x, y - spec.well.y) < 320) {
      y = PANEL_H - y
      x = Math.min(PANEL_W - 220, Math.max(220, PANEL_W - x + 60))
    }
    spec.station = {
      id: `st:${px},${py}`,
      x,
      y,
      visualSeed: hash32(seed, CH.STATION),
      name: `${sector.name.split(' ')[0]} Station`,
    }
  }

  // rocks near a well get seeded onto REAL circular orbits: v = √(μ/r)
  // tangential, ±15% jitter derived from the ALREADY-drawn speed roll —
  // zero new RNG draws, so rock layouts stay byte-identical
  if (spec.well) {
    for (const a of spec.asteroids) {
      const dx = a.x - spec.well.x
      const dy = a.y - spec.well.y
      const r = Math.hypot(dx, dy)
      if (r < 40 || r > 480) continue
      const vCirc = Math.min(170, Math.sqrt(spec.well.strength / r))
      const oldSpeed = Math.hypot(a.vx, a.vy) // the original 20–70 draw
      const jitter = 0.85 + ((oldSpeed - 20) / 50) * 0.3
      const sign = Math.atan2(a.vy, a.vx) > 0 ? 1 : -1 // parity from existing draw
      a.vx = (-dy / r) * sign * vCirc * jitter
      a.vy = (dx / r) * sign * vCirc * jitter
    }
  }

  // --- anomaly / lore beacon (CH.AMBIENT stream) ---
  const ambientRng = channelRng(seed, CH.AMBIENT)
  const anomalyRoll = ambientRng()
  if (pin?.anomaly || (!pin?.clear && anomalyRoll < 0.018)) {
    spec.anomaly = {
      dialogueId:
        typeof pin?.anomaly === 'string'
          ? pin.anomaly
          : pickDialogue(sector.systemType, ambientRng()).id,
      x: randRange(ambientRng, 150, PANEL_W - 150),
      y: randRange(ambientRng, 130, PANEL_H - 130),
    }
  }

  // --- enemies (CH.ENEMY stream) ---
  const enemyRng = channelRng(seed, CH.ENEMY)
  const table = FLAVOR_SPAWNS[sector.enemyFlavor]
  // enemies appear in a fraction of panels within hostile sectors
  if (table && !pin?.clear && enemyRng() < 0.35 + sector.danger * 0.3) {
    const count = table.count[0] + Math.floor(enemyRng() * (table.count[1] - table.count[0] + 1))
    const dangerScale = 0.8 + sector.danger * 0.5
    for (let i = 0; i < count; i++) {
      const role = pickWeighted(enemyRng, table.roles) || 'kiter'
      const base = ENEMY_ROLES[role]
      // spawn around the panel rim so entries aren't ambushes
      const edge = enemyRng() * TAU
      const x = PANEL_W / 2 + Math.cos(edge) * randRange(enemyRng, PANEL_W * 0.3, PANEL_W * 0.45)
      const y = PANEL_H / 2 + Math.sin(edge) * randRange(enemyRng, PANEL_H * 0.3, PANEL_H * 0.45)
      spec.enemies.push({
        idx: i,
        role,
        x: Math.min(PANEL_W - 30, Math.max(30, x)),
        y: Math.min(PANEL_H - 30, Math.max(30, y)),
        params: {
          hp: base.hp,
          accel: base.accel * dangerScale,
          maxSpeed: base.maxSpeed * dangerScale,
          turnRate: base.turnRate,
          aggroRange: base.aggroRange,
          preferredRange: base.preferredRange,
          fireRange: base.fireRange,
          burstShots: base.burstShots + (sector.danger > 0.7 ? 1 : 0),
          fireInterval: base.fireInterval,
          bulletSpeed: base.bulletSpeed * (0.9 + sector.danger * 0.3),
          courage: base.courage,
          // rim packs have sharper hazard sense
          evasion: Math.min(1, base.evasion + sector.danger * 0.15),
        },
      })
    }
  }

  return spec
}
