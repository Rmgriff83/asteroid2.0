// Crafting recipes. Players do NOT know these from the start (except
// STARTER_RECIPES) — blueprints are bought at stations or learned from lore.
// Adding a recipe later = adding one entry. Chains (crafted-from-crafted)
// are deliberate: they create multi-step expedition goals.
import { ITEMS } from './resources'

export const RECIPES = [
  { id: 'hullplate', ingredients: [['ferrite', 120], ['magnetite', 40]] },
  { id: 'warpfuel', ingredients: [['deuterium', 20], ['hydrogen', 80]] },
  { id: 'navcircuit', ingredients: [['cobalt', 30], ['silicate', 60]] },
  { id: 'biogel', ingredients: [['ammonia', 40], ['spores', 100]] },
  { id: 'fusioncore', ingredients: [['spadonium', 20], ['cobalt', 40]] },
  { id: 'cryocoolant', ingredients: [['ice', 90], ['ammonia', 30]] },
  { id: 'o2canister', ingredients: [['oxygen', 100], ['ferrite', 40]] },
  { id: 'antimatterpod', ingredients: [['spadonium', 10], ['deuterium', 30]] },
  { id: 'conductor', ingredients: [['aurum', 8], ['cobalt', 25]] },
  { id: 'alloyingot', ingredients: [['ferrite', 150], ['cobalt', 20]] },
  { id: 'glasslens', ingredients: [['silicate', 80], ['ice', 20]] },
  { id: 'myceliumbrick', ingredients: [['spores', 150], ['ferrite', 50]] },
  { id: 'drivecoil', ingredients: [['magnetite', 80], ['conductor', 1]] },
  // chains
  { id: 'repairkit', ingredients: [['hullplate', 2], ['biogel', 1]] },
  { id: 'sensorarray', ingredients: [['glasslens', 2], ['navcircuit', 1]] },
  { id: 'fuelcell', ingredients: [['warpfuel', 2], ['o2canister', 1]] },
  { id: 'voidcapacitor', ingredients: [['voidite', 15], ['conductor', 2]] },
  { id: 'coolantloop', ingredients: [['cryocoolant', 2], ['alloyingot', 1]] },
  { id: 'shieldemitter', ingredients: [['fusioncore', 1], ['glasslens', 2]] },
  { id: 'beaconcore', ingredients: [['navcircuit', 2], ['spadonium', 5]] },
]

// every recipe outputs 1 unit of ITEMS[id]

export const STARTER_RECIPES = ['hullplate', 'o2canister', 'glasslens']

const BLUEPRINT_PRICES = { common: 40, uncommon: 60, rare: 150, epic: 400, legendary: 900 }

export function blueprintPrice(recipeId) {
  const rarity = ITEMS[recipeId]?.rarity ?? 'uncommon'
  return BLUEPRINT_PRICES[rarity]
}

export function getRecipe(id) {
  return RECIPES.find((r) => r.id === id)
}
