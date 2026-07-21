// Shared reactive state for Vue screens AND Phaser scenes (both import this
// module directly). Persisted fields: points, credits, ships, parts, augments…
import { reactive } from 'vue'
import { loadSave } from '../services/persistence' // legacy blob — migration source only
import { dbGet, dbPut } from '../services/db'
import { ITEMS, STACK_CAP } from '../game/data/resources'
import { STARTER_RECIPES } from '../game/data/recipes'
import { getShip } from '../game/data/ships'
import { LEGACY_PART_IDS } from '../game/data/parts'
import { getAugment, LEGACY_PERK_GRANTS } from '../game/data/augments'
import { getShipStats } from '../game/systems/modifiers'

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
  shipAccents: {}, // { shipId: accentKey } — cosmetic hull tint override (see data/accents.js)
  ownedTrinkets: [], // base-decoration ids owned globally (placement is per base)
  shipParts: {}, // { shipId: { partId: ownedTier } } — per-ship installed parts
  ownedAugments: [], // augmentation ids owned globally (equip is per ship)
  shipAugments: {}, // { shipId: [augmentId, ...] } — equipped visual layers
  foundBlueprints: [], // 'bp-*' augment schematics found in the world
  shipShields: {}, // { shipId: currentShieldPoints } — repair-only, persists
  migratedParts: false,
  migratedBlasters: false,
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
  baseReturnsTo: 'game', // 'game' | 'menu' — 'menu' when a widget deep link opened the base
  shipPose: null, // session-only: {x, y, rot} snapshot for the cockpit camera
  storeReturnsTo: 'menu', // 'menu' | 'game'
  hangarReturnsTo: 'menu', // 'menu' | 'game'
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
      this.shipAccents = data.shipAccents ?? {}
      this.ownedTrinkets = data.ownedTrinkets ?? []
      this.shipParts = data.shipParts ?? {}
      this.ownedAugments = data.ownedAugments ?? []
      this.shipAugments = data.shipAugments ?? {}
      this.foundBlueprints = data.foundBlueprints ?? []
      this.shipShields = data.shipShields ?? {}
      this.migratedParts = data.migratedParts ?? false
      this.migratedBlasters = data.migratedBlasters ?? false
      this.unlockedNodes = data.unlockedNodes ?? []
      this.missions = data.missions ?? []
      // older saves predate per-base decoration placements
      this.bases = (data.bases ?? []).map((b) => ({ trinkets: {}, ...b }))
      this.waypoints = data.waypoints ?? []
      // heal missing mission markers: every active mission owns a protected
      // waypoint (pre-change saves, or markers lost to the old map-tap bug)
      for (const m of this.missions) {
        if (m.state === 'active' && !this.waypoints.some((w) => w.missionId === m.id)) {
          this.waypoints.push({ px: m.to.px, py: m.to.py, missionId: m.id, name: m.to.name })
        }
      }
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
    // legacy global perk map ({ perkId|upgradeId: tierCount }) — no longer a
    // live field; both migrations below read from the raw save data
    const legacyPerks = { ...(data?.perks ?? {}) }
    // one-time: ship upgrades used to be GLOBAL perk entries — move them
    // onto the ship the player currently flies as per-ship parts (keeps the
    // exact feel of their daily driver)
    if (!this.migratedParts) {
      const moved = {}
      for (const id of LEGACY_PART_IDS) {
        if (legacyPerks[id]) {
          moved[id] = legacyPerks[id]
          delete legacyPerks[id]
        }
      }
      if (Object.keys(moved).length) {
        this.shipParts[this.selectedShip] = {
          ...(this.shipParts[this.selectedShip] || {}),
          ...moved,
        }
      }
      this.migratedParts = true
      this.save()
    }
    // one-time: blaster perks became AUGMENTS — grant the matching augment
    // (owned + equipped on the flown ship, since perks applied everywhere);
    // deep tier-3 investment also unlocks the MK II blueprint + augment
    if (!this.migratedBlasters) {
      for (const g of LEGACY_PERK_GRANTS) {
        const level = legacyPerks[g.perkId] || 0
        if (level >= 1) this.grantAugment(g.augId)
        if (g.mk2 && level >= g.mk2.minLevel) {
          this.learnAugBlueprint(g.mk2.blueprint)
          this.grantAugment(g.mk2.augId)
        }
      }
      this.migratedBlasters = true
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
    return getShipStats(getShip(this.selectedShip), {
      parts: this.shipParts[this.selectedShip],
      augmentIds: this.shipAugments[this.selectedShip],
    }).massMax
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

  // IMPORTANT: the snapshot must be fully plain — nested objects read out of
  // this reactive store are Vue Proxies, which IndexedDB CANNOT structured-
  // clone (dbPut throws DataCloneError and flushNow swallows it, silently
  // losing the whole save). The JSON round-trip at the end strips every
  // proxy at any depth; shallow spreads alone are not enough (mission
  // from/to, base trinkets, etc.).
  snapshot() {
    return JSON.parse(JSON.stringify({
      points: this.points,
      credits: this.credits,
      fuel: this.fuel,
      cargo: { ...this.cargo },
      ownedShips: [...this.ownedShips],
      selectedShip: this.selectedShip,
      shipAccents: { ...this.shipAccents },
      ownedTrinkets: [...this.ownedTrinkets],
      shipParts: { ...this.shipParts },
      ownedAugments: [...this.ownedAugments],
      shipAugments: { ...this.shipAugments },
      foundBlueprints: [...this.foundBlueprints],
      shipShields: { ...this.shipShields },
      migratedParts: this.migratedParts,
      migratedBlasters: this.migratedBlasters,
      unlockedNodes: [...this.unlockedNodes],
      missions: this.missions.map((m) => ({ ...m })),
      bases: this.bases.map((b) => ({ ...b, trinkets: { ...b.trinkets } })),
      waypoints: this.waypoints.map((w) => ({ ...w })),
      seenDialogues: [...this.seenDialogues],
      knownRecipes: [...this.knownRecipes],
      bayLevel: this.bayLevel,
      migratedCredits: this.migratedCredits,
      currentPanel: { ...this.currentPanel },
      updatedAt: Date.now(),
    }))
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

  // ---- hangar: per-ship parts + augmentations ----
  buyPartTier(shipId, part) {
    if (!this.ownedShips.includes(shipId)) return false
    const installed = this.shipParts[shipId] || {}
    const level = installed[part.id] || 0
    const tier = part.tiers[level]
    if (!tier || !this.spend(tier.cost)) return false
    this.shipParts[shipId] = { ...installed, [part.id]: level + 1 }
    this.save()
    return true
  },

  buyAugment(aug) {
    if (this.ownedAugments.includes(aug.id)) return false
    // higher tiers need their schematic FOUND first (never sold)
    if (aug.blueprint && !this.foundBlueprints.includes(aug.blueprint)) return false
    if (!this.spend(aug.price)) return false
    this.ownedAugments.push(aug.id)
    this.save()
    return true
  },

  setAugmentEquipped(shipId, augId, on) {
    if (!this.ownedAugments.includes(augId) || !getAugment(augId)) return
    const list = this.shipAugments[shipId] || []
    if (on && !list.includes(augId)) this.shipAugments[shipId] = [...list, augId]
    else if (!on) this.shipAugments[shipId] = list.filter((id) => id !== augId)
    this.save()
  },

  learnAugBlueprint(id) {
    if (!this.foundBlueprints.includes(id)) {
      this.foundBlueprints.push(id)
      this.save()
    }
  },

  // free grant (migrations, rewards): own the augment and equip it on the
  // currently selected ship — no credit charge, no blueprint check
  grantAugment(id) {
    if (!this.ownedAugments.includes(id)) this.ownedAugments.push(id)
    this.setAugmentEquipped(this.selectedShip, id, true)
  },

  setShipShield(shipId, n) {
    this.shipShields[shipId] = Math.max(0, n)
    this.save()
  },

  buyTrinket(id, price) {
    if (this.ownedTrinkets.includes(id) || !this.spend(price)) return false
    this.ownedTrinkets.push(id)
    this.save()
    return true
  },

  // place (or clear, with trinketId null) a decoration in one base's slot;
  // ownership is global, arrangement is per base
  setTrinket(baseId, slotKey, trinketId) {
    const base = this.bases.find((b) => b.id === baseId)
    if (!base) return
    if (!base.trinkets) base.trinkets = {}
    if (trinketId == null) delete base.trinkets[slotKey]
    else if (this.ownedTrinkets.includes(trinketId)) base.trinkets[slotKey] = trinketId
    this.save()
  },

  // Called after a GEN_VERSION world re-roll: everything that referenced
  // positions in the old galaxy is cleared; the player's profile (economy,
  // ships, cargo, parts, augments, tints, recipes, lore) is untouched.
  resetWorldCoupledState() {
    this.bases = []
    this.unlockedNodes = []
    this.waypoints = []
    this.missions = []
    this.dockedStation = null
    this.currentPanel = { px: 0, py: 0 }
  },
})
