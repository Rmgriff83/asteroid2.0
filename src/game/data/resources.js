// The item registry: raw (mineable) resources + crafted goods.
// Everything cargo-holdable lives here. `RESOURCES` is kept as an alias so
// older call sites (pickups, asteroid seams, stations) keep working.
//
//   massPerUnit — cargo mass units; total mass slows the ship when heavy
//   price       — credits per unit when sold at a station
//   icon        — wireframe shape id rendered by ItemIcon.vue
//   raw         — appears in sector resourceWeights / mining tables
//   use         — consumable effect, actionable from the cargo terminal

export const STACK_CAP = 250 // units per cargo block/slot

export const RARITY_COLORS = {
  common: '#9a9488',
  uncommon: '#7dffd8',
  rare: '#9db8ff',
  epic: '#ff7de9',
  legendary: '#ffd67a',
}

export const ITEMS = {
  // ---- raw, mineable (13) ----
  ferrite: { name: 'Ferrite Dust', category: 'mineral', rarity: 'common', massPerUnit: 0.4, price: 1, icon: 'hex', color: 0xc9c2b4, raw: true },
  silicate: { name: 'Silicate Glass', category: 'mineral', rarity: 'common', massPerUnit: 0.3, price: 1.2, icon: 'diamond', color: 0x9db8ff, raw: true },
  ice: { name: 'Ice', category: 'frozen', rarity: 'uncommon', massPerUnit: 0.3, price: 1.5, icon: 'diamond', color: 0xaee6ff, raw: true },
  hydrogen: { name: 'Hydrogen', category: 'gas', rarity: 'common', massPerUnit: 0.15, price: 1, icon: 'canister', color: 0xd8fffb, raw: true },
  oxygen: { name: 'Oxygen', category: 'gas', rarity: 'common', massPerUnit: 0.15, price: 1.2, icon: 'canister', color: 0xeaf6ff, raw: true },
  magnetite: { name: 'Magnetite', category: 'mineral', rarity: 'uncommon', massPerUnit: 0.5, price: 2, icon: 'hex', color: 0x8fa3b8, raw: true },
  cobalt: { name: 'Cobalt', category: 'mineral', rarity: 'rare', massPerUnit: 0.6, price: 4, icon: 'prism', color: 0x6db8ff, raw: true },
  deuterium: { name: 'Deuterium Ice', category: 'frozen', rarity: 'rare', massPerUnit: 0.35, price: 4, icon: 'diamond', color: 0x7dffd8, raw: true },
  spores: { name: 'Fungal Spores', category: 'organic', rarity: 'uncommon', massPerUnit: 0.2, price: 2, icon: 'spores', color: 0x9fdc7a, raw: true },
  ammonia: { name: 'Ammonia', category: 'gas', rarity: 'uncommon', massPerUnit: 0.25, price: 2, icon: 'canister', color: 0xc8ff9e, raw: true },
  spadonium: { name: 'Spadonium', category: 'isotope', rarity: 'epic', massPerUnit: 1.2, price: 12, icon: 'atom', color: 0xff7de9, raw: true },
  aurum: { name: 'Aurium', category: 'precious', rarity: 'legendary', massPerUnit: 1.8, price: 20, icon: 'ingot', color: 0xffd67a, raw: true },
  voidite: { name: 'Voidite', category: 'isotope', rarity: 'epic', massPerUnit: 1.0, price: 15, icon: 'atom', color: 0xb28aff, raw: true },

  // ---- crafted ----
  hullplate: { name: 'Hull Plate', category: 'component', rarity: 'uncommon', massPerUnit: 20, price: 300, icon: 'ingot', color: 0xc9c2b4, raw: false },
  warpfuel: { name: 'Warp Fuel', category: 'fuel', rarity: 'rare', massPerUnit: 5, price: 220, icon: 'canister', color: 0x7dffd8, raw: false, use: { fuel: 25 } },
  navcircuit: { name: 'Nav Circuit', category: 'component', rarity: 'rare', massPerUnit: 4, price: 320, icon: 'hex', color: 0x9db8ff, raw: false },
  biogel: { name: 'Bio-Gel', category: 'consumable', rarity: 'uncommon', massPerUnit: 3, price: 420, icon: 'spores', color: 0x9fdc7a, raw: false },
  fusioncore: { name: 'Fusion Core', category: 'component', rarity: 'epic', massPerUnit: 12, price: 640, icon: 'atom', color: 0xff7de9, raw: false },
  cryocoolant: { name: 'Cryo-Coolant', category: 'fuel', rarity: 'uncommon', massPerUnit: 6, price: 310, icon: 'diamond', color: 0xaee6ff, raw: false, use: { boostReset: true } },
  o2canister: { name: 'O2 Canister', category: 'consumable', rarity: 'common', massPerUnit: 4, price: 250, icon: 'canister', color: 0xeaf6ff, raw: false },
  antimatterpod: { name: 'Antimatter Pod', category: 'volatile', rarity: 'legendary', massPerUnit: 8, price: 480, icon: 'atom', color: 0xb28aff, raw: false },
  conductor: { name: 'Conductor', category: 'component', rarity: 'epic', massPerUnit: 6, price: 420, icon: 'prism', color: 0xffd67a, raw: false },
  repairkit: { name: 'Repair Kit', category: 'consumable', rarity: 'rare', massPerUnit: 10, price: 1500, icon: 'ingot', color: 0x7dffd8, raw: false, use: { hull: 1 } },
  alloyingot: { name: 'Alloy Ingot', category: 'component', rarity: 'uncommon', massPerUnit: 15, price: 350, icon: 'ingot', color: 0x8fa3b8, raw: false },
  glasslens: { name: 'Glass Lens', category: 'component', rarity: 'common', massPerUnit: 2, price: 190, icon: 'diamond', color: 0xeaf6ff, raw: false },
  sensorarray: { name: 'Sensor Array', category: 'component', rarity: 'rare', massPerUnit: 9, price: 1100, icon: 'hex', color: 0x9db8ff, raw: false },
  fuelcell: { name: 'Fuel Cell', category: 'fuel', rarity: 'rare', massPerUnit: 12, price: 1050, icon: 'canister', color: 0x7dffd8, raw: false, use: { fuel: 60 } },
  voidcapacitor: { name: 'Void Capacitor', category: 'component', rarity: 'legendary', massPerUnit: 10, price: 1600, icon: 'atom', color: 0xb28aff, raw: false },
  myceliumbrick: { name: 'Mycelium Brick', category: 'component', rarity: 'uncommon', massPerUnit: 14, price: 520, icon: 'spores', color: 0x9fdc7a, raw: false },
  coolantloop: { name: 'Coolant Loop', category: 'component', rarity: 'rare', massPerUnit: 22, price: 1450, icon: 'diamond', color: 0xaee6ff, raw: false },
  drivecoil: { name: 'Drive Coil', category: 'component', rarity: 'rare', massPerUnit: 16, price: 900, icon: 'hex', color: 0x8fa3b8, raw: false },
  shieldemitter: { name: 'Shield Emitter', category: 'component', rarity: 'epic', massPerUnit: 14, price: 1800, icon: 'atom', color: 0xff7de9, raw: false },
  beaconcore: { name: 'Beacon Core', category: 'component', rarity: 'epic', massPerUnit: 11, price: 1250, icon: 'prism', color: 0xffd67a, raw: false },
}

export const RAW_IDS = Object.keys(ITEMS).filter((id) => ITEMS[id].raw)

// legacy alias — older call sites read RESOURCES[type].name/color/price
export const RESOURCES = ITEMS

export const FUEL_PRICE = 1.5 // credits per fuel unit at stations
export const REPAIR_PRICE = 6 // credits per hull point
