// Authored dialogue/lore fragment pools (handoff §13 — the third instance of
// "sparse authored data consumed by a generic runtime"). The seed selects
// from pools keyed by sector systemType; writing more entries = more galaxy.
export const DIALOGUE_POOLS = {
  field: [
    {
      id: 'field-buoy-1',
      speaker: 'AUTOMATED BUOY',
      lines: [
        'Survey marker 7-KILO. Ferrite yields nominal.',
        'The rocks out here remember being a planet, once.',
      ],
      consequence: { credits: 10 },
    },
    {
      id: 'field-hermit-1',
      speaker: 'UNKNOWN VESSEL',
      lines: [
        'You fly like someone who has somewhere to be.',
        'Out here, nowhere is somewhere. Take these and slow down.',
      ],
      consequence: { resource: { type: 'ferrite', qty: 3 } },
    },
  ],
  nebula: [
    {
      id: 'nebula-echo-1',
      speaker: 'SIGNAL ECHO',
      lines: [
        '…repeating. The veil sings at 4.7 hertz. We stopped to listen…',
        '…we are still listening. It is beautiful. Do not stop to listen.',
      ],
      consequence: { credits: 15 },
    },
    {
      id: 'nebula-refinery-1',
      speaker: 'ABANDONED REFINERY',
      lines: [
        'Automated broadcast: deuterium-hydrogen fusion ratios, endlessly.',
        'Someone left the recipe playing for whoever drifted by next.',
      ],
      consequence: { recipe: 'warpfuel' },
    },
  ],
  cluster: [
    {
      id: 'cluster-prospector-1',
      speaker: 'PROSPECTOR RIG',
      lines: [
        'Claim registered. This cluster is picked over, friend.',
        'Rim rocks run richer. If you can run faster than what guards them.',
      ],
      consequence: { credits: 12 },
    },
  ],
  void: [
    {
      id: 'void-drifter-1',
      speaker: 'DRIFTING HULL',
      lines: [
        'No power signature. The logbook is open to its last page:',
        '"the quiet is not empty. the quiet is patient."',
        'A fabrication schematic is still cached in its terminal.',
      ],
      consequence: { recipe: 'antimatterpod' },
    },
  ],
  coreward: [
    {
      id: 'core-anthem-1',
      speaker: 'HEARTH RELAY',
      lines: [
        'Welcome to the bright middle of everything, pilot.',
        'Fuel is cheap, the rocks are poor, and nothing here will chase you.',
      ],
      consequence: { credits: 8 },
    },
  ],
}

export function pickDialogue(systemType, roll) {
  const pool = DIALOGUE_POOLS[systemType] || DIALOGUE_POOLS.field
  return pool[Math.floor(roll * pool.length) % pool.length]
}

export function getDialogue(id) {
  for (const pool of Object.values(DIALOGUE_POOLS)) {
    const hit = pool.find((d) => d.id === id)
    if (hit) return hit
  }
  return null
}
