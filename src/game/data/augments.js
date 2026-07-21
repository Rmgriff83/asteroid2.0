// Ship AUGMENTATIONS: visual vector layers worn persistently ON the ship —
// every renderer (Phaser hull, SVG previews, cockpit nose, landing skim)
// draws the same strokes — each granting a stat boost. Bought once with
// credits (playerStore.ownedAugments), equipped per ship
// (playerStore.shipAugments); higher tiers are gated behind `blueprint`
// ids that must be FOUND in the world (playerStore.foundBlueprints —
// lore beacons and rare mission rewards; never sold at stations).
//
// GEOMETRY CONVENTION — layer points live in UNIT-SHIP SPACE:
//   u ∈ [-0.5, 0.5] along ship length (nose = +0.5, along +x)
//   v ∈ [-0.5, 0.5] across ship width
// At draw time each point maps linearly through the ship's VERTS-ONLY
// bounding box (never include extraLines or other augments), so one
// definition scales onto any hull. Points may exceed ±0.5 (the halo does).

export const AUGMENTS = [
  // ---- credit-only tier ----
  {
    id: 'fins',
    name: 'STABILIZER FINS',
    desc: 'Swept tail fins — sharper turn authority',
    price: 180,
    blueprint: null,
    boosts: [{ stat: 'turnRate', op: 'mul', value: 1.1 }],
    layer: [
      { points: [[-0.3, -0.42], [-0.56, -0.74], [-0.44, -0.36]], closed: true },
      { points: [[-0.3, 0.42], [-0.56, 0.74], [-0.44, 0.36]], closed: true },
    ],
  },
  {
    id: 'pods',
    name: 'SADDLE PODS',
    desc: 'Strap-on flank containers — more mass capacity',
    price: 220,
    blueprint: null,
    boosts: [{ stat: 'massMax', op: 'add', value: 60 }],
    layer: [
      {
        points: [[-0.3, -0.52], [0.02, -0.52], [0.1, -0.63], [0.02, -0.74], [-0.3, -0.74], [-0.38, -0.63]],
        closed: true,
      },
      {
        points: [[-0.3, 0.52], [0.02, 0.52], [0.1, 0.63], [0.02, 0.74], [-0.3, 0.74], [-0.38, 0.63]],
        closed: true,
      },
    ],
  },
  {
    id: 'cowl',
    name: 'BOOSTER COWL',
    desc: 'Tail shroud channeling a hotter boost burn',
    price: 260,
    blueprint: null,
    boosts: [{ stat: 'boostMaxSpeed', op: 'add', value: 60 }],
    layer: [
      { points: [[-0.34, -0.3], [-0.56, 0], [-0.34, 0.3]], closed: false },
      { points: [[-0.42, -0.18], [-0.6, 0], [-0.42, 0.18]], closed: false },
    ],
  },

  // ---- weapon mods (ex blaster perks) — forward hemisphere hardpoints ----
  {
    id: 'vaporizer',
    name: 'VAPOR LANCE',
    desc: 'Over-nose beam lance — vaporize more of each rock',
    price: 200,
    blueprint: null,
    boosts: [{ stat: 'destroyFraction', op: 'add', value: 0.15 }],
    layer: [
      { points: [[0.38, -0.04], [0.72, -0.02], [0.72, 0.02], [0.38, 0.04]], closed: true },
      { points: [[0.72, 0], [0.84, 0]], closed: false }, // emitter tip
    ],
  },
  {
    id: 'autoloader',
    name: 'AUTOLOADER PODS',
    desc: 'Flank gun pods with mechanical loaders — faster fire',
    price: 240,
    blueprint: null,
    boosts: [{ stat: 'fireRate', op: 'mul', value: 1.5 }],
    layer: [
      { points: [[0.08, -0.38], [0.3, -0.38], [0.3, -0.28], [0.08, -0.28]], closed: true },
      { points: [[0.3, -0.33], [0.44, -0.33]], closed: false },
      { points: [[0.08, 0.38], [0.3, 0.38], [0.3, 0.28], [0.08, 0.28]], closed: true },
      { points: [[0.3, 0.33], [0.44, 0.33]], closed: false },
    ],
  },
  {
    id: 'shatter',
    name: 'SHATTER VANES',
    desc: 'Serrated splitter vanes — rocks break into more pieces',
    price: 240,
    blueprint: null,
    boosts: [{ stat: 'splitCountMax', op: 'add', value: 2 }],
    layer: [
      {
        points: [[0.12, -0.46], [0.2, -0.56], [0.21, -0.46], [0.29, -0.56], [0.3, -0.46], [0.38, -0.56]],
        closed: false,
      },
      {
        points: [[0.12, 0.46], [0.2, 0.56], [0.21, 0.46], [0.29, 0.56], [0.3, 0.46], [0.38, 0.56]],
        closed: false,
      },
    ],
  },
  {
    id: 'cleaver',
    name: 'CLEAVER BLADES',
    desc: 'Heavy chopper blades — fewer, larger chunks',
    price: 160,
    blueprint: null,
    boosts: [
      { stat: 'splitCountMax', op: 'add', value: -1 },
      { stat: 'childSizeBias', op: 'mul', value: 1.3 },
    ],
    layer: [
      { points: [[0.12, -0.44], [0.4, -0.44], [0.44, -0.56], [0.2, -0.56]], closed: true },
      { points: [[0.12, 0.44], [0.4, 0.44], [0.44, 0.56], [0.2, 0.56]], closed: true },
    ],
  },

  // ---- blueprint-gated tier (found in the fringe) ----
  {
    id: 'halo',
    name: 'AEGIS HALO',
    desc: 'Projected shield lattice ringing the hull',
    price: 500,
    blueprint: 'bp-halo',
    boosts: [{ stat: 'shieldsMax', op: 'add', value: 1 }],
    layer: [
      {
        points: [[0.68, 0.32], [0.48, 0.57], [0.19, 0.72], [-0.13, 0.74], [-0.43, 0.61], [-0.68, 0.32]],
        closed: false,
      },
      {
        points: [[0.68, -0.32], [0.48, -0.57], [0.19, -0.72], [-0.13, -0.74], [-0.43, -0.61], [-0.68, -0.32]],
        closed: false,
      },
    ],
  },
  {
    id: 'cabinpod',
    name: 'TRANSIT CABIN',
    desc: 'Pressurized passenger berth riding the spine',
    price: 450,
    blueprint: 'bp-cabin',
    boosts: [{ stat: 'seats', op: 'add', value: 2 }],
    layer: [
      {
        points: [[-0.22, -0.16], [0.12, -0.16], [0.2, 0], [0.12, 0.16], [-0.22, 0.16], [-0.3, 0]],
        closed: true,
      },
      { points: [[-0.12, -0.08], [0.04, -0.08]], closed: false }, // porthole strip
    ],
  },
  {
    id: 'spine',
    name: 'VECTOR SPINE',
    desc: 'Legendary dorsal lattice — thrust, turn, and a shield',
    price: 900,
    blueprint: 'bp-spine',
    boosts: [
      { stat: 'thrust', op: 'mul', value: 1.1 },
      { stat: 'turnRate', op: 'mul', value: 1.05 },
      { stat: 'shieldsMax', op: 'add', value: 1 },
    ],
    layer: [
      { points: [[-0.42, 0], [0.35, 0]], closed: false },
      { points: [[-0.25, 0], [-0.33, -0.14]], closed: false },
      { points: [[-0.25, 0], [-0.33, 0.14]], closed: false },
      { points: [[-0.05, 0], [-0.13, -0.14]], closed: false },
      { points: [[-0.05, 0], [-0.13, 0.14]], closed: false },
      { points: [[0.15, 0], [0.07, -0.14]], closed: false },
      { points: [[0.15, 0], [0.07, 0.14]], closed: false },
    ],
  },
  {
    id: 'vaporizer2',
    name: 'VAPOR LANCE MK II',
    desc: 'Forked emitter prongs — hotter beam, bigger bite',
    price: 380,
    blueprint: 'bp-vapor',
    boosts: [{ stat: 'destroyFraction', op: 'add', value: 0.2 }],
    layer: [
      { points: [[0.3, -0.16], [0.66, -0.11], [0.66, -0.06], [0.3, -0.09]], closed: true },
      { points: [[0.3, 0.16], [0.66, 0.11], [0.66, 0.06], [0.3, 0.09]], closed: true },
      { points: [[0.34, -0.12], [0.34, 0.12]], closed: false }, // crossbar
    ],
  },
  {
    id: 'autoloader2',
    name: 'GATLING ARRAY',
    desc: 'Rotary barrel banks — a continuous stream of fire',
    price: 420,
    blueprint: 'bp-gatling',
    boosts: [{ stat: 'fireRate', op: 'mul', value: 1.6 }],
    layer: [
      { points: [[0.02, -0.26], [0.2, -0.26], [0.2, -0.14], [0.02, -0.14]], closed: true },
      { points: [[0.2, -0.24], [0.4, -0.24]], closed: false },
      { points: [[0.2, -0.2], [0.46, -0.2]], closed: false },
      { points: [[0.2, -0.16], [0.4, -0.16]], closed: false },
      { points: [[0.02, 0.26], [0.2, 0.26], [0.2, 0.14], [0.02, 0.14]], closed: true },
      { points: [[0.2, 0.24], [0.4, 0.24]], closed: false },
      { points: [[0.2, 0.2], [0.46, 0.2]], closed: false },
      { points: [[0.2, 0.16], [0.4, 0.16]], closed: false },
    ],
  },
]

// legacy blaster-perk purchases (playerStore.perks, pre-augment) map onto
// these grants during the one-time migratedBlasters pass in playerStore.load()
export const LEGACY_PERK_GRANTS = [
  { perkId: 'vaporizer', augId: 'vaporizer', mk2: { minLevel: 3, augId: 'vaporizer2', blueprint: 'bp-vapor' } },
  { perkId: 'rapid', augId: 'autoloader', mk2: { minLevel: 3, augId: 'autoloader2', blueprint: 'bp-gatling' } },
  { perkId: 'shatter', augId: 'shatter' },
  { perkId: 'cleaver', augId: 'cleaver' },
]

export function getAugment(id) {
  return AUGMENTS.find((a) => a.id === id) || null
}

// verts-only bbox → linear map from unit-ship space into ship-local space
function shipBox(shipDef) {
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const [x, y] of shipDef.verts) {
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  return { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, w: maxX - minX, h: maxY - minY }
}

// one augment's strokes in ship-local space (same space as def.verts):
// [{ points: [[x, y], ...], closed }]
export function augmentStrokes(shipDef, augment) {
  const box = shipBox(shipDef)
  return augment.layer.map((stroke) => ({
    closed: !!stroke.closed,
    points: stroke.points.map(([u, v]) => [box.cx + u * box.w, box.cy + v * box.h]),
  }))
}

// all strokes for an equipped-augment id list
export function equippedStrokes(shipDef, augmentIds) {
  const out = []
  for (const id of augmentIds || []) {
    const aug = getAugment(id)
    if (aug) out.push(...augmentStrokes(shipDef, aug))
  }
  return out
}
