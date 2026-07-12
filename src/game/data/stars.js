// Star classes. Every sector is guaranteed 1–2 star panels; the type drives
// gravity strength, size, kill radius, and the close-up rendering.
// CONTACT WITH ANY STAR SURFACE IS DEATH — the gravity min-dist clamp sits
// just above the surface so orbits/slingshots are flyable but sloppy ones burn.
export const STAR_TYPES = {
  'red-dwarf': {
    name: 'Red Dwarf',
    radius: 48,
    strength: 2.2e6,
    core: 0xff5a4a,
    mid: 0xff8a5c,
    halo: 0x66201a,
    pulseMs: 2600,
    spikes: 0,
  },
  'main-sequence': {
    name: 'Main Sequence',
    radius: 78,
    strength: 3.4e6,
    core: 0xfff3cd,
    mid: 0xffd67a,
    halo: 0x5c4a1e,
    pulseMs: 1800,
    spikes: 4,
  },
  'blue-giant': {
    name: 'Blue Giant',
    radius: 118,
    strength: 4.8e6,
    core: 0xeaf6ff,
    mid: 0x9db8ff,
    halo: 0x24345c,
    pulseMs: 1200,
    spikes: 4,
  },
  'white-dwarf': {
    name: 'White Dwarf',
    radius: 26,
    strength: 3.8e6,
    core: 0xffffff,
    mid: 0xeaf6ff,
    halo: 0x3c4a5c,
    pulseMs: 700,
    spikes: 6,
  },
  neutron: {
    name: 'Neutron Star',
    radius: 20,
    strength: 5.4e6,
    core: 0xd8fffb,
    mid: 0x7dffd8,
    halo: 0x1a4a44,
    pulseMs: 380,
    spikes: 0,
    beams: true,
  },
}

export const STAR_TYPE_IDS = Object.keys(STAR_TYPES)

// base mix, shaped per systemType in starWeightsFor
const DEFAULT_STAR_WEIGHTS = {
  'red-dwarf': 0.3,
  'main-sequence': 0.35,
  'blue-giant': 0.15,
  'white-dwarf': 0.12,
  neutron: 0.08,
}

export function starWeightsFor(systemType) {
  const w = { ...DEFAULT_STAR_WEIGHTS }
  switch (systemType) {
    case 'coreward':
      w['main-sequence'] += 0.4
      w.neutron = 0.01
      break
    case 'nebula':
      w['blue-giant'] += 0.3
      w['red-dwarf'] += 0.1
      break
    case 'void':
      w['white-dwarf'] += 0.3
      w.neutron += 0.15
      w['main-sequence'] *= 0.4
      break
    case 'cluster':
      w['blue-giant'] += 0.12
      w['main-sequence'] += 0.1
      break
  }
  return w
}

// spec fragment for a star well of the given type
export function starWellSpec(starType, x, y, visualSeed) {
  const t = STAR_TYPES[starType] || STAR_TYPES['main-sequence']
  return {
    kind: 'star',
    starType,
    x,
    y,
    radius: t.radius,
    strength: t.strength,
    minDist: t.radius + 55, // gravity clamp just above the surface
    killRadius: t.radius * 0.92, // touching the surface is death
    visualSeed,
  }
}
