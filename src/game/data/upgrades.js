// Ship upgrades — declarative tier/effect format ({stat, op, value}), same
// aggregation in modifiers.js. Adding an upgrade later = adding one entry.
export const UPGRADES = [
  {
    id: 'engine',
    name: 'ION ENGINE',
    desc: 'Stronger thrust, higher top speed',
    tiers: [
      { cost: 80, effects: [{ stat: 'thrust', op: 'mul', value: 1.2 }, { stat: 'maxSpeed', op: 'add', value: 40 }] },
      { cost: 220, effects: [{ stat: 'thrust', op: 'mul', value: 1.2 }, { stat: 'maxSpeed', op: 'add', value: 50 }] },
      { cost: 520, effects: [{ stat: 'thrust', op: 'mul', value: 1.25 }, { stat: 'maxSpeed', op: 'add', value: 60 }] },
    ],
  },
  {
    id: 'gyros',
    name: 'GYROSCOPES',
    desc: 'Turn faster',
    tiers: [
      { cost: 60, effects: [{ stat: 'turnRate', op: 'mul', value: 1.2 }] },
      { cost: 180, effects: [{ stat: 'turnRate', op: 'mul', value: 1.2 }] },
    ],
  },
  {
    id: 'tank',
    name: 'FUEL TANK',
    desc: 'Carry more fuel — reach deeper space',
    tiers: [
      { cost: 70, effects: [{ stat: 'fuelMax', op: 'add', value: 20 }] },
      { cost: 200, effects: [{ stat: 'fuelMax', op: 'add', value: 30 }] },
      { cost: 500, effects: [{ stat: 'fuelMax', op: 'add', value: 50 }] },
    ],
  },
  {
    id: 'hold',
    name: 'CARGO HOLD',
    desc: 'Higher mass capacity, longer expeditions',
    tiers: [
      { cost: 70, effects: [{ stat: 'massMax', op: 'add', value: 80 }] },
      { cost: 200, effects: [{ stat: 'massMax', op: 'add', value: 120 }] },
      { cost: 500, effects: [{ stat: 'massMax', op: 'add', value: 200 }] },
    ],
  },
  {
    id: 'plating',
    name: 'HULL PLATING',
    desc: 'Survive more hits',
    tiers: [
      { cost: 150, effects: [{ stat: 'hullMax', op: 'add', value: 1 }] },
      { cost: 400, effects: [{ stat: 'hullMax', op: 'add', value: 1 }] },
    ],
  },
]
