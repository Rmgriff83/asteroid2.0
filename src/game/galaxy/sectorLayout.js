// Sector layout: the astrophysics-inspired authoring pass. Places each
// sector's star systems in the 16×16 panel grid and derives every panel's
// ROLE — which ring of a system it sits in (core → inner → temperate → belt
// → giants → icy → fringe) plus specials (gap lanes through the belt, Trojan
// swarms, collisional families, binary instability deadzones, black holes,
// nebula pockets, station hubs). generatePanel shapes all of its channels
// from the role, giving sectors real internal structure: dense mining belts,
// patrolled temperate rings, quiet icy outskirts, discovery at the fringe.
//
// Pure + seeded: every draw comes from ONE stream (CH.LAYOUT off sectorSeed)
// in fixed order, so all consumers (game, maps, missions, admin) compute the
// identical layout. Memoized — generatePanel calls this per panel.
import { sectorSeed, channelRng } from './seeds'
import { CH, SECTOR_SIZE } from './constants'
import { resolveSector } from './sectorProps'
import { getAuthoredVersion } from './authored'

const TAU = Math.PI * 2

// system extent (ring outer radius, in panels) per star type — a red dwarf
// packs its whole system into a ~7×7 patch, a blue giant sprawls ~13 wide
const EXTENTS = {
  'red-dwarf': 3.5,
  'white-dwarf': 3.0,
  neutron: 3.0,
  'main-sequence': 5.0,
  'blue-giant': 6.5,
}

// ring boundaries as fractions of extent (u = dist / extent)
const RING_EDGES = [
  ['core', 0.14],
  ['inner', 0.3],
  ['temperate', 0.48],
  ['belt', 0.68],
  ['giants', 0.86],
  ['icy', 1.0],
]

// Role → generation parameters. rocks = [min,max]; tiers = P(large/med/small);
// minMult scales the mineral rate (base 0.25 + richness·0.35, cap 0.9);
// resBias multiplies sector resourceWeights before the pick; planet = chance
// (giant-anchor forces one) with per-type weight multipliers; stMult scales
// stationDensity (cap 0.5); enMult scales the enemy gate (cap 0.85);
// anMult scales the 1.8% anomaly rate; baseSite = landable-planet chance.
export const ROLE_PARAMS = {
  core: {
    rocks: [2, 4], tiers: [0.3, 0.4, 0.3], minMult: 1.2,
    resBias: { ferrite: 1.5, magnetite: 1.5 },
    planet: 0, planetBias: {}, baseSite: 0.35,
    stMult: 0, enMult: 0.5, anMult: 0.5,
  },
  inner: {
    rocks: [4, 7], tiers: [0.3, 0.4, 0.3], minMult: 1.5,
    resBias: { ferrite: 1.5, magnetite: 1.8, cobalt: 1.8, aurum: 2.2, ice: 0.15, hydrogen: 0.25, ammonia: 0.25 },
    planet: 0.22, planetBias: { lava: 3, rocky: 1, gas: 0, ice: 0, ringed: 0 }, baseSite: 0.35,
    stMult: 0.4, enMult: 0.7, anMult: 1,
  },
  temperate: {
    rocks: [3, 6], tiers: [0.4, 0.35, 0.25], minMult: 1.0,
    resBias: {},
    planet: 0.35, planetBias: { rocky: 2.5, lava: 0.3, gas: 0.2 }, baseSite: 0.6,
    stMult: 3.0, enMult: 0.3, anMult: 1,
  },
  belt: {
    rocks: [8, 14], tiers: [0.55, 0.3, 0.15], minMult: 1.25,
    resBias: {}, // stony/carbonaceous split applied by u in panelGen
    planet: 0, planetBias: {}, baseSite: 0.35, // belts stay pure rock fields
    stMult: 0.5, enMult: 0.6, anMult: 1,
  },
  'gap-lane': {
    rocks: [1, 3], tiers: [0.3, 0.4, 0.3], minMult: 1.0,
    resBias: {},
    planet: 0, planetBias: {}, baseSite: 0.35,
    stMult: 0, enMult: 1.6, enCountBonus: 1, anMult: 1,
  },
  family: {
    rocks: [10, 14], tiers: [0.6, 0.3, 0.1], minMult: 1, flatMineralRate: 0.8,
    resBias: {},
    planet: 0, planetBias: {}, baseSite: 0.35,
    stMult: 0, enMult: 1.2, anMult: 1,
  },
  giants: {
    rocks: [2, 4], tiers: [0.35, 0.4, 0.25], minMult: 0.8,
    resBias: { ice: 1.3, hydrogen: 1.3 },
    planet: 0.15, planetBias: { gas: 2, ice: 1.5, ringed: 1.5, rocky: 0.2, lava: 0 }, baseSite: 0.35,
    stMult: 0.8, enMult: 0.4, anMult: 1,
  },
  trojan: {
    rocks: [6, 10], tiers: [0.45, 0.35, 0.2], minMult: 1.1,
    resBias: {},
    planet: 0, planetBias: {}, baseSite: 0.35,
    stMult: 0, enMult: 0.9, anMult: 1,
  },
  icy: {
    rocks: [1, 3], tiers: [0.25, 0.4, 0.35], minMult: 0.9,
    resBias: { ice: 2.5, hydrogen: 2, ammonia: 1.8, deuterium: 1.8, ferrite: 0.3, magnetite: 0.3, cobalt: 0.3, aurum: 0.3 },
    planet: 0.1, planetBias: { ice: 3, gas: 0, lava: 0, rocky: 0.2, ringed: 0.3 }, baseSite: 0.35,
    stMult: 0.3, enMult: 0.15, anMult: 2.5,
  },
  fringe: {
    rocks: [1, 3], tiers: [0.3, 0.4, 0.3], minMult: 0.6,
    resBias: {},
    planet: 0.04, planetBias: { ice: 2, rocky: 1, gas: 0, lava: 0, ringed: 0.3 }, baseSite: 0.35,
    stMult: 0.25, enMult: 0.15, anMult: 3,
  },
  deadzone: {
    rocks: [5, 9], tiers: [0.1, 0.35, 0.55], minMult: 1.0, debrisSpeed: [40, 110],
    resBias: { ferrite: 1.4, magnetite: 1.4, cobalt: 1.3 },
    planet: 0, planetBias: {}, baseSite: 0.35,
    stMult: 0, enMult: 1.4, anMult: 2,
  },
  blackhole: {
    rocks: [3, 5], tiers: [0.4, 0.35, 0.25], minMult: 1.5,
    resBias: { voidite: 4, spadonium: 2.5, deuterium: 1.5 },
    planet: 0, planetBias: {}, baseSite: 0.35,
    stMult: 0, enMult: 1.3, anMult: 2,
  },
  'bh-disk': {
    rocks: [6, 10], tiers: [0.4, 0.35, 0.25], minMult: 1.5,
    resBias: { voidite: 4, spadonium: 2.5, deuterium: 1.5 },
    planet: 0, planetBias: {}, baseSite: 0.35,
    stMult: 0, enMult: 1.3, anMult: 2,
  },
  'nebula-pocket': {
    rocks: [4, 8], tiers: [0.4, 0.35, 0.25], minMult: 1.6,
    resBias: { hydrogen: 2, ammonia: 1.6, spores: 1.5 },
    planet: 0.06, planetBias: { gas: 3, rocky: 0, lava: 0, ice: 0.5 }, baseSite: 0.35,
    stMult: 0.3, enMult: 0.8, anMult: 2,
  },
}

export function roleParams(role) {
  return ROLE_PARAMS[role.special] || ROLE_PARAMS[role.ring] || ROLE_PARAMS.fringe
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

function angDiff(a, b) {
  let d = (a - b) % TAU
  if (d > Math.PI) d -= TAU
  if (d < -Math.PI) d += TAU
  return Math.abs(d)
}

// deterministic fallback spots when rejection sampling can't fit a system
const FALLBACK_CENTERS = [
  [4, 4],
  [12, 12],
  [4, 12],
  [12, 4],
]

// ---- memo cache (layout is recomputed per panel otherwise) ----
const cache = new Map()
const CACHE_CAP = 512

export function resolveSectorLayout(galaxySeed, sx, sy, authored = null) {
  const key = `${galaxySeed}|${sx},${sy}|${getAuthoredVersion()}`
  const hit = cache.get(key)
  if (hit) return hit

  const sector = resolveSector(galaxySeed, sx, sy, authored)
  const rng = channelRng(sectorSeed(galaxySeed, sx, sy), CH.LAYOUT)
  const starCount = Math.max(0, Math.min(4, Math.round(sector.starCount ?? 1)))

  // -- systems: types, extents, placement --
  const systems = []
  for (let i = 0; i < starCount; i++) {
    const starType = pickWeighted(rng, sector.starWeights) || 'main-sequence'
    systems.push({ idx: i, starType, extent: EXTENTS[starType] || 5.0 })
  }
  const compression = starCount >= 3 ? 0.7 : 1
  for (const s of systems) s.extent *= compression

  const binary = starCount >= 2 ? rng() < 0.35 : false
  const sepFactor = starCount >= 3 ? 0.6 : 0.8

  for (let i = 0; i < systems.length; i++) {
    const s = systems[i]
    const margin = Math.min(6.5, Math.max(3, 0.68 * s.extent))
    if (i === 1 && binary) {
      // binary companion: close orbit around the primary
      const p = systems[0]
      const dist = (0.35 + rng() * 0.2) * (p.extent + s.extent)
      const ang = rng() * TAU
      s.cx = Math.min(15, Math.max(1, p.cx + Math.cos(ang) * dist))
      s.cy = Math.min(15, Math.max(1, p.cy + Math.sin(ang) * dist))
      continue
    }
    let placed = false
    for (let t = 0; t < 12 && !placed; t++) {
      const cx = margin + rng() * (SECTOR_SIZE - 2 * margin)
      const cy = margin + rng() * (SECTOR_SIZE - 2 * margin)
      placed = systems
        .slice(0, i)
        .every((o) => Math.hypot(cx - o.cx, cy - o.cy) >= sepFactor * (s.extent + o.extent))
      if (placed || t === 11) {
        s.cx = cx
        s.cy = cy
      }
    }
    if (!placed) {
      // deterministic fallback: first unused quadrant center
      const spot = FALLBACK_CENTERS[i % FALLBACK_CENTERS.length]
      s.cx = spot[0]
      s.cy = spot[1]
    }
  }

  // per-system feature angles (fixed draw order: giant, then gap lanes)
  for (const s of systems) {
    s.giantAngle = rng() * TAU
    const lanes = 1 + (rng() < 0.4 ? 1 : 0)
    s.gapAngles = []
    for (let i = 0; i < lanes; i++) s.gapAngles.push(rng() * TAU)
  }

  // -- role pass (no rng): ring per panel by normalized distance --
  const roles = new Array(SECTOR_SIZE * SECTOR_SIZE)
  for (let dy = 0; dy < SECTOR_SIZE; dy++) {
    for (let dx = 0; dx < SECTOR_SIZE; dx++) {
      const cx = dx + 0.5
      const cy = dy + 0.5
      let owner = -1
      let bestU = Infinity
      let overlaps = 0
      for (const s of systems) {
        const u = Math.hypot(cx - s.cx, cy - s.cy) / s.extent
        if (u <= 1.05) overlaps++
        if (u < bestU) {
          bestU = u
          owner = u <= 1.0 ? s.idx : -1
        }
      }
      let ring = 'fringe'
      if (owner >= 0) {
        for (const [name, edge] of RING_EDGES) {
          if (bestU < edge || (name === 'icy' && bestU <= 1.0)) {
            ring = name
            break
          }
        }
      }
      const sys = owner >= 0 ? systems[owner] : null
      roles[dy * SECTOR_SIZE + dx] = {
        ring,
        systemIdx: owner,
        u: bestU,
        ang: sys ? Math.atan2(cy - sys.cy, cx - sys.cx) : 0,
        // instability zone wherever two systems' influence overlaps
        special: overlaps >= 2 ? 'deadzone' : null,
      }
    }
  }

  const roleAt = (dx, dy) => roles[dy * SECTOR_SIZE + dx]
  const inGrid = (dx, dy) => dx >= 0 && dx < SECTOR_SIZE && dy >= 0 && dy < SECTOR_SIZE

  // the panel containing each system center is always the star panel
  const starAssignments = new Map()
  for (const s of systems) {
    const dx = Math.min(SECTOR_SIZE - 1, Math.max(0, Math.floor(s.cx)))
    const dy = Math.min(SECTOR_SIZE - 1, Math.max(0, Math.floor(s.cy)))
    const r = roleAt(dx, dy)
    r.ring = 'core'
    r.systemIdx = s.idx
    r.special = null // a star panel is never a deadzone
    starAssignments.set(`${sx * SECTOR_SIZE + dx},${sy * SECTOR_SIZE + dy}`, s.starType)
    s.corePanel = { dx, dy }
  }

  // -- specials (fixed draw order; skip panels that already have one) --

  // gap lanes: radial corridors cleared through each belt
  for (const s of systems) {
    const beltMid = 0.58 * s.extent
    const halfWidth = Math.atan(0.65 / Math.max(1, beltMid))
    for (let dy = 0; dy < SECTOR_SIZE; dy++) {
      for (let dx = 0; dx < SECTOR_SIZE; dx++) {
        const r = roleAt(dx, dy)
        if (r.ring !== 'belt' || r.systemIdx !== s.idx || r.special) continue
        if (s.gapAngles.some((g) => angDiff(r.ang, g) < halfWidth)) r.special = 'gap-lane'
      }
    }
  }

  // giant anchor + trojan swarms at ±60° along the giant's orbit
  for (const s of systems) {
    const rG = 0.77 * s.extent
    if (rG < 2) continue // compact systems: no room for a distinct giant orbit
    for (const [label, angOff] of [
      ['giant-anchor', 0],
      ['trojan', TAU / 6],
      ['trojan', -TAU / 6],
    ]) {
      const dx = Math.floor(s.cx + Math.cos(s.giantAngle + angOff) * rG)
      const dy = Math.floor(s.cy + Math.sin(s.giantAngle + angOff) * rG)
      if (!inGrid(dx, dy)) continue
      const r = roleAt(dx, dy)
      if (r.special || r.ring === 'core') continue
      r.special = label
      if (label === 'giant-anchor') r.systemIdx = s.idx
    }
  }

  // collisional families: tight same-composition clusters in the belt
  for (const s of systems) {
    const familyCount = Math.floor(rng() * 3) // 0–2
    for (let f = 0; f < familyCount; f++) {
      const ang = rng() * TAU
      const rad = (0.5 + rng() * 0.16) * s.extent
      const resource = pickWeighted(rng, sector.resourceWeights) || 'ferrite'
      const fx = s.cx + Math.cos(ang) * rad
      const fy = s.cy + Math.sin(ang) * rad
      // nearest belt panel of this system + its nearest belt neighbor
      let best = null
      let bestD = Infinity
      for (let dy = 0; dy < SECTOR_SIZE; dy++) {
        for (let dx = 0; dx < SECTOR_SIZE; dx++) {
          const r = roleAt(dx, dy)
          if (r.ring !== 'belt' || r.systemIdx !== s.idx || r.special) continue
          const d = Math.hypot(dx + 0.5 - fx, dy + 0.5 - fy)
          if (d < bestD) {
            bestD = d
            best = { dx, dy }
          }
        }
      }
      if (!best) continue
      const mark = (dx, dy) => {
        const r = roleAt(dx, dy)
        r.special = 'family'
        r.familyResource = resource
      }
      mark(best.dx, best.dy)
      for (const [ndx, ndy] of [
        [best.dx + 1, best.dy], [best.dx - 1, best.dy],
        [best.dx, best.dy + 1], [best.dx, best.dy - 1],
      ]) {
        if (!inGrid(ndx, ndy)) continue
        const r = roleAt(ndx, ndy)
        if (r.ring === 'belt' && r.systemIdx === s.idx && !r.special) {
          mark(ndx, ndy)
          break
        }
      }
    }
  }

  // black hole: a layout decision now (replaces the old per-panel roll)
  let blackHole = null
  if (rng() < 0.05 + sector.danger * 0.15) {
    const fringe = []
    for (let dy = 0; dy < SECTOR_SIZE; dy++) {
      for (let dx = 0; dx < SECTOR_SIZE; dx++) {
        const r = roleAt(dx, dy)
        if (r.ring === 'fringe' && !r.special) fringe.push({ dx, dy })
      }
    }
    if (fringe.length) {
      const spot = fringe[Math.floor(rng() * fringe.length)]
      roleAt(spot.dx, spot.dy).special = 'blackhole'
      blackHole = `${sx * SECTOR_SIZE + spot.dx},${sy * SECTOR_SIZE + spot.dy}`
      for (const p of fringe) {
        if (p === spot) continue
        if (Math.hypot(p.dx - spot.dx, p.dy - spot.dy) <= 1.5) {
          roleAt(p.dx, p.dy).special = 'bh-disk'
        }
      }
    }
  }

  // nebula pocket: a dust-rich disc over the fringe (nebula sectors only)
  let nebulaPocket = null
  if (sector.systemType === 'nebula') {
    nebulaPocket = { cx: rng() * SECTOR_SIZE, cy: rng() * SECTOR_SIZE, r: 2 + rng() * 1.5 }
    for (let dy = 0; dy < SECTOR_SIZE; dy++) {
      for (let dx = 0; dx < SECTOR_SIZE; dx++) {
        const r = roleAt(dx, dy)
        if (r.ring !== 'fringe' || r.special) continue
        if (Math.hypot(dx + 0.5 - nebulaPocket.cx, dy + 0.5 - nebulaPocket.cy) <= nebulaPocket.r) {
          r.special = 'nebula-pocket'
        }
      }
    }
  }

  // hub: one guaranteed station in each system's temperate ring
  for (const s of systems) {
    const temperate = []
    for (let dy = 0; dy < SECTOR_SIZE; dy++) {
      for (let dx = 0; dx < SECTOR_SIZE; dx++) {
        const r = roleAt(dx, dy)
        if (r.ring === 'temperate' && r.systemIdx === s.idx && !r.special) temperate.push({ dx, dy })
      }
    }
    if (temperate.length) {
      const spot = temperate[Math.floor(rng() * temperate.length)]
      roleAt(spot.dx, spot.dy).special = 'hub'
      s.hubPanel = `${sx * SECTOR_SIZE + spot.dx},${sy * SECTOR_SIZE + spot.dy}`
    }
  }

  // archetype: descriptive, plus remnant modifiers read by panelGen
  const remnant =
    systems.length === 1 && (systems[0].starType === 'white-dwarf' || systems[0].starType === 'neutron')
  const archetype = binary
    ? 'binary'
    : remnant
      ? 'remnant'
      : systems.length >= 3
        ? 'cluster'
        : systems.length === 0
          ? 'starless'
          : 'single'

  const layout = {
    sx,
    sy,
    archetype,
    remnant,
    binary,
    systems,
    blackHole,
    nebulaPocket,
    roles,
    starAssignments,
  }

  if (cache.size >= CACHE_CAP) cache.delete(cache.keys().next().value)
  cache.set(key, layout)
  return layout
}

// O(1) role lookup for a global panel coordinate within the layout's sector
export function panelRole(layout, px, py) {
  const dx = px - layout.sx * SECTOR_SIZE
  const dy = py - layout.sy * SECTOR_SIZE
  if (dx < 0 || dx >= SECTOR_SIZE || dy < 0 || dy >= SECTOR_SIZE) {
    return { ring: 'fringe', systemIdx: -1, u: Infinity, ang: 0, special: null }
  }
  return layout.roles[dy * SECTOR_SIZE + dx]
}
