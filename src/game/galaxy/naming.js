// Naming grammar + classification — pure functions of sector props + seed.
// Zero storage; the "space-nerd texture" layer.
import { sectorSeed, channelRng } from './seeds'
import { CH } from './constants'

const ROOTS = {
  field: ['Keld', 'Aris', 'Vor', 'Tal', 'Ferro', 'Dun', 'Sag', 'Mira'],
  cluster: ['Hale', 'Cyg', 'Lyra', 'Peri', 'Ostra', 'Ryn', 'Kappa', 'Bel'],
  nebula: ['Vela', 'Iris', 'Zeph', 'Nyx', 'Umbra', 'Cirra', 'Maro', 'Sel'],
  void: ['Hollow', 'Kaal', 'Erra', 'Nul', 'Vast', 'Grey', 'Sunder', 'Mor'],
  coreward: ['Prime', 'Sol', 'Hearth', 'Aurel', 'Lumen', 'Radi', 'Cor', 'Helio'],
}

const SUFFIXES = {
  field: ['Reach', 'Drift', 'Belt', 'Expanse', 'Field'],
  cluster: ['Cluster', 'Knot', 'Crown', 'Gathering'],
  nebula: ['Veil', 'Shroud', 'Bloom', 'Haze'],
  void: ['Gap', 'Deep', 'Silence', 'Rift'],
  coreward: ['Core', 'Heart', 'Sanctum', 'Cradle'],
}

const GREEK = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Theta', 'Sigma', 'Tau', 'Omega']

export function nameSector(galaxySeed, sx, sy, props) {
  const rng = channelRng(sectorSeed(galaxySeed, sx, sy), CH.NAMING)
  const type = ROOTS[props.systemType] ? props.systemType : 'field'
  const root = ROOTS[type][Math.floor(rng() * ROOTS[type].length)]
  const suffix = SUFFIXES[type][Math.floor(rng() * SUFFIXES[type].length)]
  const tag = rng() < 0.35 ? ` ${GREEK[Math.floor(rng() * GREEK.length)]}` : ''
  return `${root} ${suffix}${tag}`
}

export function classifySector(props) {
  const dominant = Object.entries(props.resourceWeights).sort((a, b) => b[1] - a[1])[0][0]
  const dangerBand =
    props.danger < 0.2 ? 'I' : props.danger < 0.45 ? 'II' : props.danger < 0.7 ? 'III' : 'IV'
  const typeCode = props.systemType.charAt(0).toUpperCase()
  return `${typeCode}-${dangerBand} ${dominant.charAt(0).toUpperCase() + dominant.slice(1)} ${
    props.systemType === 'void' ? 'Zone' : 'System'
  }`
}
