// Data-driven blaster perks. Adding a new perk = adding one entry here.
// Each tier's effects are declarative ops applied to DEFAULT_STATS by
// getModifiers() — the game only ever reads the aggregated stats object.
export const PERKS = [
  {
    id: 'vaporizer',
    name: 'VAPORIZER',
    desc: 'Destroy a larger share of each asteroid',
    tiers: [
      { cost: 30, effects: [{ stat: 'destroyFraction', op: 'add', value: 0.1 }] },
      { cost: 80, effects: [{ stat: 'destroyFraction', op: 'add', value: 0.1 }] },
      { cost: 200, effects: [{ stat: 'destroyFraction', op: 'add', value: 0.15 }] },
    ],
  },
  {
    id: 'shatter',
    name: 'SHATTER',
    desc: 'Break asteroids into more pieces',
    tiers: [
      { cost: 60, effects: [{ stat: 'splitCountMax', op: 'add', value: 1 }] },
      { cost: 140, effects: [{ stat: 'splitCountMax', op: 'add', value: 2 }] },
    ],
  },
  {
    id: 'cleaver',
    name: 'CLEAVER',
    desc: 'Fewer, larger chunks',
    tiers: [
      {
        cost: 60,
        effects: [
          { stat: 'splitCountMax', op: 'add', value: -1 },
          { stat: 'childSizeBias', op: 'mul', value: 1.3 },
        ],
      },
    ],
  },
  {
    id: 'rapid',
    name: 'RAPID FIRE',
    desc: 'Shoot faster',
    tiers: [
      { cost: 40, effects: [{ stat: 'fireRate', op: 'mul', value: 1.35 }] },
      { cost: 120, effects: [{ stat: 'fireRate', op: 'mul', value: 1.35 }] },
      { cost: 300, effects: [{ stat: 'fireRate', op: 'mul', value: 1.3 }] },
    ],
  },
]

export function getPerk(id) {
  return PERKS.find((p) => p.id === id)
}
