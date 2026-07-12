// Resolves a sector's properties: structural bias → seed roll → sparse
// authored override merge. Pure data — shared by game, star map, and admin.
import { sectorSeed, channelRng } from './seeds'
import { CH, SECTOR_SIZE } from './constants'
import { dangerAt, richnessAt, densityAt, spiralArmStrength, coreDist } from './structure'
import { nameSector, classifySector } from './naming'
import { starWeightsFor, STAR_TYPES } from '../data/stars'
import { RAW_IDS } from '../data/resources'

export const RESOURCE_TYPES = RAW_IDS
export const PLANET_TYPES = ['rocky', 'gas', 'ice', 'lava', 'ringed']
export const ENEMY_FLAVORS = ['none', 'timid', 'standard', 'volatile', 'pack']

export function sectorOf(px, py) {
  return { sx: Math.floor(px / SECTOR_SIZE), sy: Math.floor(py / SECTOR_SIZE) }
}

export function sectorKey(sx, sy) {
  return `${sx},${sy}`
}

function pickWeighted(rng, entries) {
  const total = entries.reduce((s, [, w]) => s + w, 0)
  let roll = rng() * total
  for (const [key, w] of entries) {
    roll -= w
    if (roll <= 0) return key
  }
  return entries[entries.length - 1][0]
}

export function resolveSector(galaxySeed, sx, sy, authored = null) {
  const rng = channelRng(sectorSeed(galaxySeed, sx, sy), CH.SECTOR)
  const danger = dangerAt(sx, sy)
  const richness = richnessAt(sx, sy)
  const density = densityAt(sx, sy)
  const arm = spiralArmStrength(sx, sy)
  const core = coreDist(sx, sy)

  let systemType
  if (core < 3) {
    systemType = 'coreward'
  } else {
    systemType = pickWeighted(rng, [
      ['field', 0.35 + arm * 0.3],
      ['cluster', 0.1 + arm * 0.35],
      ['nebula', 0.2],
      ['void', 0.35 - arm * 0.3],
    ])
  }

  // resource mix (13 raws): commons everywhere, region flavor by systemType,
  // rares gated behind richness so deep space pays
  const nebula = systemType === 'nebula'
  const voidS = systemType === 'void'
  const cluster = systemType === 'cluster'
  const resourceWeights = {
    ferrite: 0.5 + rng() * 0.3,
    silicate: 0.35 + rng() * 0.3,
    ice: nebula || voidS ? 0.45 + rng() * 0.25 : 0.2 + rng() * 0.2,
    hydrogen: nebula ? 0.45 + rng() * 0.3 : 0.15 + rng() * 0.15,
    oxygen: 0.12 + rng() * 0.15,
    ammonia: nebula ? 0.3 + rng() * 0.2 : 0.08 + rng() * 0.12,
    magnetite: cluster ? 0.3 + rng() * 0.2 : 0.12 + rng() * 0.15,
    spores: systemType === 'field' ? 0.18 + rng() * 0.18 : 0.06 + rng() * 0.1,
    cobalt: richness > 0.3 ? (richness - 0.3) * (0.5 + rng() * 0.3) + (cluster ? 0.1 : 0) : 0.02,
    deuterium: voidS ? 0.2 + rng() * 0.15 : richness > 0.4 ? (richness - 0.4) * (0.3 + rng() * 0.2) : 0.02,
    spadonium: richness > 0.6 ? (richness - 0.6) * (0.5 + rng() * 0.4) + (voidS ? 0.08 : 0) : 0,
    aurum: richness > 0.5 ? (richness - 0.5) * (0.4 + rng() * 0.3) : 0,
    voidite: richness > 0.75 && systemType !== 'coreward' ? (richness - 0.75) * (0.8 + rng() * 0.4) : 0,
  }

  const planetWeights = {
    rocky: 0.4 + rng() * 0.2,
    gas: systemType === 'nebula' ? 0.5 : 0.2 + rng() * 0.15,
    ice: systemType === 'void' ? 0.45 : 0.15 + rng() * 0.15,
    lava: core < 8 ? 0.3 : 0.08 + rng() * 0.1,
    ringed: 0.1 + richness * 0.25,
  }

  let enemyFlavor
  const flavorRoll = rng()
  if (danger < 0.12) enemyFlavor = 'none'
  else if (danger < 0.3) enemyFlavor = flavorRoll < 0.6 ? 'none' : 'timid'
  else if (danger < 0.55) enemyFlavor = flavorRoll < 0.5 ? 'timid' : 'standard'
  else if (danger < 0.8) enemyFlavor = flavorRoll < 0.55 ? 'standard' : 'volatile'
  else enemyFlavor = flavorRoll < 0.5 ? 'volatile' : 'pack'

  const stationDensity = Math.max(0.02, 0.14 - core * 0.002 + arm * 0.05)
  const paletteBias = Math.floor(rng() * 14)

  // every sector anchors 1–2 star systems
  const starCount = 1 + (rng() < 0.35 ? 1 : 0)
  const starWeights = starWeightsFor(systemType)

  let props = {
    sx,
    sy,
    systemType,
    danger,
    richness,
    density,
    resourceWeights,
    planetWeights,
    enemyFlavor,
    stationDensity,
    paletteBias,
    starCount,
    starWeights,
    starType: 'mixed', // authored override may pin a specific class
    authored: false,
  }

  const override = authored?.sectors?.[sectorKey(sx, sy)]
  if (override) {
    props = { ...props, ...override, authored: true }
  }
  // a specific authored star type collapses the weights
  if (props.starType && props.starType !== 'mixed' && STAR_TYPES[props.starType]) {
    props.starWeights = { [props.starType]: 1 }
  }

  // naming derives from FINAL props so authored changes rename appropriately
  props.name = nameSector(galaxySeed, sx, sy, props)
  props.classification = classifySector(props)
  return props
}
