// Shared reactive state for Vue screens AND Phaser scenes (both import this
// module directly). Persisted fields: points, ownedShips, selectedShip, perks.
import { reactive } from 'vue'
import { loadSave } from '../services/persistence' // legacy blob — migration source only
import { dbGet, dbPut } from '../services/db'
import { ITEMS, STACK_CAP } from '../game/data/resources'
import { STARTER_RECIPES } from '../game/data/recipes'
import { getShip } from '../game/data/ships'
import { getModifiers } from '../game/systems/modifiers'

const GRID_MAX_SLOTS = 24 // the 6×4 cargo matrix

let saveTimer = null

export const playerStore = reactive({
  // persisted (critical player-state domain)
  points: 0, // SCORE only — never spendable
  credits: 0, // the spendable currency (all mutations via currencyService)
  fuel: 40,
  cargo: {}, // { resourceType: qty }
  ownedShips: ['classic'],
  selectedShip: 'classic',
  perks: {}, // { perkId|upgradeId: ownedTierCount }
  shipAccents: {}, // { shipId: accentKey } — cosmetic hull tint override (see data/accents.js)
  unlockedNodes: [], // station/base ids reachable by fast travel
  missions: [],
  bases: [],
  waypoints: [],
  seenDialogues: [],
  knownRecipes: [...STARTER_RECIPES],
  bayLevel: 0, // cargo bay expansions (+2 slots each)
  migratedCredits: false,
  currentPanel: { px: 0, py: 0 },
  dockedStation: null, // session-only: set on dock

  // session-only UI state
  screen: 'splash', // splash | menu | game | store | station | map | base
  cockpitView: 'stowed', // session-only: 'stowed' | 'open' framing on the cargo screen
  paused: false,
  landing: { panelKey: '0,0', resourceType: 'ferrite' },
  shipPose: null, // session-only: {x, y, rot} snapshot for the cockpit camera
  storeReturnsTo: 'menu', // 'menu' | 'game'
  loaded: false,

  async load() {
    let data = await dbGet('player', 'main').catch(() => null)
    if (!data) {
      // one-time migration from the old Preferences blob (left intact as backup)
      data = await loadSave()
    }
    if (data) {
      this.points = data.points ?? 0
      this.credits = data.credits ?? 0
      this.fuel = data.fuel ?? 40
      this.cargo = data.cargo ?? {}
      this.ownedShips = Array.isArray(data.ownedShips) ? data.ownedShips : ['classic']
      this.selectedShip = data.selectedShip ?? 'classic'
      this.perks = data.perks ?? {}
      this.shipAccents = data.shipAccents ?? {}
      this.unlockedNodes = data.unlockedNodes ?? []
      this.missions = data.missions ?? []
      this.bases = data.bases ?? []
      this.waypoints = data.waypoints ?? []
      this.seenDialogues = data.seenDialogues ?? []
      this.knownRecipes = data.knownRecipes ?? [...STARTER_RECIPES]
      this.bayLevel = data.bayLevel ?? 0
      this.migratedCredits = data.migratedCredits ?? false
      this.currentPanel = data.currentPanel ?? { px: 0, py: 0 }
      if (!this.ownedShips.includes('classic')) this.ownedShips.unshift('classic')
      if (!this.ownedShips.includes(this.selectedShip)) this.selectedShip = 'classic'
    }
    // one-time grant: pre-economy points become starting credits
    if (!this.migratedCredits) {
      this.credits += this.points
      this.migratedCredits = true
      this.save()
    }
    this.loaded = true
  },

  cargoUsed() {
    return Object.values(this.cargo).reduce((s, n) => s + n, 0)
  },

  // total cargo mass in MU
  cargoMass() {
    return Object.entries(this.cargo).reduce(
      (s, [type, qty]) => s + qty * (ITEMS[type]?.massPerUnit ?? 0.5),
      0
    )
  },

  // units per cargo slot — ship-dependent (DART 50 … NOVA 250)
  stackCap() {
    return getShip(this.selectedShip).stackCap ?? STACK_CAP
  },

  // occupied cargo blocks (a partial stack occupies a slot)
  cargoBlocks() {
    const cap = this.stackCap()
    return Object.values(this.cargo).reduce(
      (s, qty) => s + (qty > 0 ? Math.ceil(qty / cap) : 0),
      0
    )
  },

  // unlocked slots: ship hull baseline + purchased bay expansions
  slotCount() {
    const def = getShip(this.selectedShip)
    return Math.min(GRID_MAX_SLOTS, (def.cargoSlots ?? 8) + this.bayLevel * 2)
  },

  massMax() {
    return getModifiers(this.perks).massMax
  },

  // how many units of `type` can actually fit (mass headroom + slot/stack room)
  maxAddable(type) {
    const item = ITEMS[type]
    if (!item) return 0
    const cap = this.stackCap()
    const massRoom = Math.max(0, this.massMax() - this.cargoMass())
    const byMass = Math.floor(massRoom / item.massPerUnit)
    const qty = this.cargo[type] || 0
    const partialSpace = qty > 0 ? Math.ceil(qty / cap) * cap - qty : 0
    const freeSlots = Math.max(0, this.slotCount() - this.cargoBlocks())
    const bySlots = partialSpace + freeSlots * cap
    return Math.max(0, Math.min(byMass, bySlots))
  },

  canAddCargo(type, qty) {
    return this.maxAddable(type) >= qty
  },

  addCargo(type, qty) {
    this.cargo[type] = (this.cargo[type] || 0) + qty
    this.save()
  },

  removeCargo(type, qty) {
    const have = this.cargo[type] || 0
    const take = Math.min(have, qty)
    this.cargo[type] = have - take
    if (this.cargo[type] <= 0) delete this.cargo[type]
    this.save()
    return take
  },

  learnRecipe(id) {
    if (!this.knownRecipes.includes(id)) {
      this.knownRecipes.push(id)
      this.save()
    }
  },

  snapshot() {
    return {
      points: this.points,
      credits: this.credits,
      fuel: this.fuel,
      cargo: { ...this.cargo },
      ownedShips: [...this.ownedShips],
      selectedShip: this.selectedShip,
      perks: { ...this.perks },
      shipAccents: { ...this.shipAccents },
      unlockedNodes: [...this.unlockedNodes],
      missions: this.missions.map((m) => ({ ...m })),
      bases: this.bases.map((b) => ({ ...b })),
      waypoints: this.waypoints.map((w) => ({ ...w })),
      seenDialogues: [...this.seenDialogues],
      knownRecipes: [...this.knownRecipes],
      bayLevel: this.bayLevel,
      migratedCredits: this.migratedCredits,
      currentPanel: { ...this.currentPanel },
      updatedAt: Date.now(),
    }
  },

  save() {
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => this.flushNow(), 400)
  },

  async flushNow() {
    clearTimeout(saveTimer)
    await dbPut('player', 'main', this.snapshot()).catch(() => {})
  },

  addPoints(n) {
    this.points += n // score only
    this.save()
  },

  // spend CREDITS (kept as a store method for UI convenience; routes through
  // the same field currencyService manages)
  spend(n) {
    if (this.credits < n) return false
    this.credits -= n
    this.save()
    return true
  },

  buyShip(id, cost) {
    if (this.ownedShips.includes(id) || !this.spend(cost)) return false
    this.ownedShips.push(id)
    this.save()
    return true
  },

  selectShip(id) {
    if (!this.ownedShips.includes(id)) return
    this.selectedShip = id
    this.save()
  },

  setShipAccent(shipId, key) {
    this.shipAccents[shipId] = key
    this.save()
  },

  // Called after a GEN_VERSION world re-roll: everything that referenced
  // positions in the old galaxy is cleared; the player's profile (economy,
  // ships, cargo, perks, tints, recipes, lore) is untouched.
  resetWorldCoupledState() {
    this.bases = []
    this.unlockedNodes = []
    this.waypoints = []
    this.missions = []
    this.dockedStation = null
    this.currentPanel = { px: 0, py: 0 }
  },

  buyPerkTier(perk) {
    const level = this.perks[perk.id] || 0
    const tier = perk.tiers[level]
    if (!tier || !this.spend(tier.cost)) return false
    this.perks[perk.id] = level + 1
    this.save()
    return true
  },
})
