// generatePanel: the single deterministic placement step. Pure data out —
// no Phaser. Same (galaxySeed, px, py, authored) → identical panelSpec forever.
//
// Per-channel RNG discipline: every subsystem draws from its OWN stream so
// features added in later phases never shift existing panels' content.
import { panelSeed, channelRng } from './seeds'
import { CH, PANEL_W, PANEL_H, ASTEROID_TIERS } from './constants'
import { resolveSector, sectorOf, RESOURCE_TYPES } from './sectorProps'
import { resolveSectorLayout, panelRole, roleParams, ROLE_PARAMS } from './sectorLayout'
import { starWellSpec, STAR_TYPES } from '../data/stars'
import {
  makeAsteroidVerts,
  randRange,
  planetCaptureRadius,
  starCaptureRadius,
  STATION_CAPTURE_RADIUS,
  STATION_FIELD_MU,
  STATION_ORBIT_VMAX,
  STATION_FIELD_INNER,
} from '../utils/geometry'
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
// Delegates to the sector layout (systems sit at ring centers) — kept as a
// named export for existing consumers (__zen.debug, admin).
export function sectorStarAssignments(galaxySeed, sx, sy, authored = null) {
  return resolveSectorLayout(galaxySeed, sx, sy, authored).starAssignments
}

// multiply a weights object by a sparse bias map
function biasWeights(weights, bias) {
  if (!bias) return weights
  const keys = Object.keys(bias)
  if (!keys.length) return weights
  const out = {}
  for (const [k, w] of Object.entries(weights)) out[k] = w * (bias[k] ?? 1)
  return out
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
  const layout = resolveSectorLayout(galaxySeed, sx, sy, authored)
  const pin = authored?.panels?.[panelKey(px, py)] || null

  // panel role from the sector layout; an authored pin can substitute a ring
  let role = panelRole(layout, px, py)
  if (pin?.role && ROLE_PARAMS[pin.role]) {
    role = { ring: pin.role, systemIdx: -1, u: 0.5, ang: 0, special: null }
  }
  const params = roleParams(role)

  const spec = {
    px,
    py,
    seed,
    sector,
    pin,
    role: { ring: role.ring, special: role.special, systemIdx: role.systemIdx, u: role.u },
    bgColor: panelBgColor(px, py, sector.paletteBias),
    well: null,
    planet: null,
    station: null,
    asteroids: [],
    enemies: [],
  }

  // --- planet (CH.PLANET stream) ---
  const planetRng = channelRng(seed, CH.PLANET)
  const isGiantAnchor = role.special === 'giant-anchor'
  const planetChance = planetRng() // always drawn — keeps the stream aligned
  const wantPlanet =
    pin?.planet || isGiantAnchor || (!pin?.clear && params.planet > 0 && planetChance < params.planet)
  if (wantPlanet) {
    const typeWeights = isGiantAnchor
      ? { gas: 0.5, ringed: 0.3, ice: 0.2 }
      : biasWeights(sector.planetWeights, layout.remnant ? { ice: 2, lava: 0.3, ...params.planetBias } : params.planetBias)
    const type = pin?.planet?.type || pickWeighted(planetRng, typeWeights) || 'rocky'
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
      baseSite: planetRng() < params.baseSite,
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
    const assignedType = layout.starAssignments.get(panelKey(px, py))
    if (assignedType) {
      spec.well = { ...starWellSpec(assignedType, x, y, visualSeed) }
    } else if (role.special === 'blackhole') {
      // black holes are a sector-layout decision (fringe placement)
      spec.well = { kind: 'blackhole', x, y, strength: 5.2e6, minDist: 130, killRadius: 55, visualSeed }
    }
  }

  // --- asteroids (CH.ROCKS stream) — count/size/speed shaped by role ---
  const rockRng = channelRng(seed, CH.ROCKS)
  const [rockMin, rockMax] = params.rocks
  const beltBonus = role.ring === 'belt' && !role.special ? Math.floor(sector.density * 2) : 0
  let count = pin?.clear
    ? 0
    : rockMin + Math.floor(rockRng() * (rockMax - rockMin + 1)) + beltBonus
  // full-density fields only exist in open space: a planet or well would drag
  // them in constantly, so gravity-source panels thin to a stable handful
  if (spec.planet || spec.well) count = Math.min(count, 5)
  const [pLarge, pMed] = params.tiers
  const [speedLo, speedHi] = params.debrisSpeed || [20, 70]
  for (let i = 0; i < count; i++) {
    const roll = rockRng()
    let radius =
      roll < pLarge ? ASTEROID_TIERS[0] : roll < pLarge + pMed ? ASTEROID_TIERS[1] : ASTEROID_TIERS[2]
    const x = randRange(rockRng, radius, PANEL_W - radius)
    const y = randRange(rockRng, radius, PANEL_H - radius)
    // rocks born inside a planet's capture boundary are pre-shattered ring
    // material — full-size rocks would tidally break up anyway (draw-neutral:
    // radius only rescales the verts below)
    if (
      spec.planet &&
      radius >= ASTEROID_TIERS[0] &&
      Math.hypot(x - spec.planet.x, y - spec.planet.y) < planetCaptureRadius(spec.planet.radius)
    ) {
      radius = ASTEROID_TIERS[1]
    }
    // same rule inside a star's (mass-scaled) capture ring
    if (
      spec.well?.kind === 'star' &&
      radius >= ASTEROID_TIERS[0] &&
      Math.hypot(x - spec.well.x, y - spec.well.y) < starCaptureRadius(spec.well.strength)
    ) {
      radius = ASTEROID_TIERS[1]
    }
    const ang = rockRng() * TAU
    const speed = randRange(rockRng, speedLo, speedHi)
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

  // --- minerals (CH.MINERAL stream) — rate and composition by role ---
  const mineralRng = channelRng(seed, CH.MINERAL)
  const mineralRate =
    params.flatMineralRate ??
    Math.min(0.9, (0.25 + sector.richness * 0.35) * params.minMult * (layout.remnant ? 0.7 : 1))
  // the belt splits stony (sunward half) / carbonaceous (outer half)
  const beltBias =
    role.ring === 'belt' && !role.special
      ? role.u < 0.58
        ? { silicate: 1.4, ferrite: 1.3 }
        : { ice: 1.5, ammonia: 1.3, spores: 1.2 }
      : null
  const mineralWeights = biasWeights(sector.resourceWeights, beltBias || params.resBias)
  for (const a of spec.asteroids) {
    const forced = pin?.resource && mineralRng() < 0.6
    if (forced || mineralRng() < mineralRate) {
      a.mineral = {
        type:
          role.special === 'family' && !forced
            ? role.familyResource || 'ferrite'
            : forced
              ? pin.resource.type
              : pickWeighted(mineralRng, mineralWeights) || 'ferrite',
        amount: 1 + Math.floor(mineralRng() * 3) + (pin?.resource?.rich ? 2 : 0),
      }
    }
  }

  // --- station (CH.STATION stream) — hubs guaranteed, elsewhere by role ---
  const stationRng = channelRng(seed, CH.STATION)
  const stationChance = Math.min(0.5, sector.stationDensity * params.stMult)
  if (
    pin?.station ||
    role.special === 'hub' ||
    (!pin?.clear && stationRng() < stationChance)
  ) {
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
      // authored pin names win; the fallback derives from the (possibly
      // authored) sector name
      name: pin?.stationName || `${sector.name.split(' ')[0]} Station`,
    }
  }

  // rocks born inside a planet's capture boundary start in its ring —
  // tangential circular orbits, jitter/parity from the ALREADY-drawn speed
  // roll (zero new RNG draws, so rock layouts stay byte-identical)
  if (spec.planet) {
    const captureR = planetCaptureRadius(spec.planet.radius)
    for (const a of spec.asteroids) {
      const dx = a.x - spec.planet.x
      const dy = a.y - spec.planet.y
      const r = Math.hypot(dx, dy)
      if (r < spec.planet.radius + 30 || r > captureR) continue
      const vCirc = Math.min(150, Math.sqrt(spec.planet.mu / r))
      const oldSpeed = Math.hypot(a.vx, a.vy)
      const jitter = 0.9 + ((oldSpeed - 20) / 90) * 0.2
      const sign = Math.atan2(a.vy, a.vx) > 0 ? 1 : -1
      a.vx = (-dy / r) * sign * vCirc * jitter
      a.vy = (dx / r) * sign * vCirc * jitter
      a.ringBit = true // planet capture wins over well seeding below
    }
  }

  // rocks born inside a station's capture field start in held orbit — the
  // artificial-field version of the planet block above, same zero-draw
  // jitter/parity trick; a planet's natural field wins over it (ringBit)
  if (spec.station) {
    for (const a of spec.asteroids) {
      if (a.ringBit) continue
      const dx = a.x - spec.station.x
      const dy = a.y - spec.station.y
      const r = Math.hypot(dx, dy)
      if (r < STATION_FIELD_INNER || r > STATION_CAPTURE_RADIUS) continue
      const vCirc = Math.min(STATION_ORBIT_VMAX, Math.sqrt(STATION_FIELD_MU / r))
      const oldSpeed = Math.hypot(a.vx, a.vy)
      const jitter = 0.9 + ((oldSpeed - 20) / 90) * 0.2
      const sign = Math.atan2(a.vy, a.vx) > 0 ? 1 : -1
      a.vx = (-dy / r) * sign * vCirc * jitter
      a.vy = (dx / r) * sign * vCirc * jitter
      a.ringBit = true // shields these from the well seeding below
    }
  }

  // rocks near a well get seeded onto REAL circular orbits: v = √(μ/r)
  // tangential, ±15% jitter derived from the ALREADY-drawn speed roll —
  // zero new RNG draws, so rock layouts stay byte-identical. A star's band
  // is its mass-scaled capture ring (bigger stars hold wider, hotter rings);
  // black holes keep their original fixed band.
  if (spec.well) {
    const isStar = spec.well.kind === 'star'
    const bandLo = isStar ? spec.well.radius + 60 : 40
    const bandHi = isStar ? starCaptureRadius(spec.well.strength) : 480
    const vClamp = isStar ? 280 : 170
    for (const a of spec.asteroids) {
      if (a.ringBit) continue
      const dx = a.x - spec.well.x
      const dy = a.y - spec.well.y
      const r = Math.hypot(dx, dy)
      if (r < bandLo || r > bandHi) continue
      const vCirc = Math.min(vClamp, Math.sqrt(spec.well.strength / r))
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
  const anomalyRate = 0.018 * params.anMult * (layout.remnant ? 1.5 : 1)
  if (pin?.anomaly || (!pin?.clear && anomalyRoll < anomalyRate)) {
    spec.anomaly = {
      dialogueId:
        typeof pin?.anomaly === 'string'
          ? pin.anomaly
          : pickDialogue(sector.systemType, ambientRng()).id,
      x: randRange(ambientRng, 150, PANEL_W - 150),
      y: randRange(ambientRng, 130, PANEL_H - 130),
    }
  }

  // --- vista (appended to the AMBIENT stream): calm panels still offer
  //     something to look at — a non-interactive backdrop sight ---
  const vistaChance =
    role.ring === 'fringe' || role.ring === 'icy' ? 0.35 : spec.asteroids.length <= 4 ? 0.12 : 0
  const vistaRoll = ambientRng()
  if (!pin?.clear && vistaRoll < vistaChance) {
    const kinds = ['comet', 'derelict', 'far-planet']
    spec.vista = {
      kind: kinds[Math.floor(ambientRng() * kinds.length)],
      x: randRange(ambientRng, 100, PANEL_W - 100),
      y: randRange(ambientRng, 100, PANEL_H - 100),
      drift: randRange(ambientRng, 2, 10),
      visualSeed: hash32(seed, CH.AMBIENT),
    }
  }

  // --- enemies (CH.ENEMY stream) — clustered where value clusters ---
  const enemyRng = channelRng(seed, CH.ENEMY)
  const table = FLAVOR_SPAWNS[sector.enemyFlavor]
  // planets attract raiders — their mineable nodes are worth guarding
  const planetGuard = spec.planet ? 1.8 : 1
  const enemyGate = Math.min(0.85, (0.35 + sector.danger * 0.3) * params.enMult * planetGuard)
  if (table && !pin?.clear && !pin?.noEnemies && enemyRng() < enemyGate) {
    const count =
      table.count[0] +
      Math.floor(enemyRng() * (table.count[1] - table.count[0] + 1)) +
      (params.enCountBonus || 0)
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
