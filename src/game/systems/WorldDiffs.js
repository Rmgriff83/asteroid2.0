// World-state domain: per-panel diffs against the seed regenerator, plus the
// visited/permanent sets. Regenerate-then-subtract (handoff principle 2).
// Eviction IS the common-resource replenishment mechanism: an evicted panel
// regenerates fresh. permanentKeys never evict (bases, missions, named rocks).
import { dbGet, dbPut, dbDelete, dbAllEntries, dbClear } from '../../services/db'
import { DEFAULT_GALAXY_SEED, GEN_VERSION } from '../galaxy/constants'
import { sectorOf, sectorKey } from '../galaxy/sectorProps'

const MAX_DIFFS = 600
const FLUSH_DEBOUNCE_MS = 3000

export const worldState = {
  galaxySeed: DEFAULT_GALAXY_SEED,
  diffs: new Map(), // "px,py" → diff
  visitedSectors: new Set(),
  permanentKeys: new Set(),
  regenerated: false, // set when a GEN_VERSION mismatch re-rolled the world
  loaded: false,
}

let dirtyPanels = new Set()
let metaDirty = false
let flushTimer = null

export async function loadWorld() {
  const meta = (await dbGet('meta', 'main')) || null
  if (meta && (meta.genVersion ?? 1) !== GEN_VERSION) {
    // the generator changed shape — the old world no longer exists. Wipe
    // world state (the player profile is preserved; main.js resets the
    // world-coupled player fields when it sees `regenerated`).
    await dbClear('worldDiffs').catch(() => {})
    worldState.galaxySeed = meta.galaxySeed ?? DEFAULT_GALAXY_SEED
    worldState.visitedSectors = new Set()
    worldState.permanentKeys = new Set()
    worldState.diffs = new Map()
    worldState.regenerated = true
    metaDirty = true
    worldState.loaded = true
    return
  }
  if (meta) {
    worldState.galaxySeed = meta.galaxySeed ?? DEFAULT_GALAXY_SEED
    worldState.visitedSectors = new Set(meta.visitedSectors || [])
    worldState.permanentKeys = new Set(meta.permanentKeys || [])
  } else {
    metaDirty = true
  }
  worldState.diffs = new Map(await dbAllEntries('worldDiffs'))
  worldState.loaded = true
}

export function getDiff(key) {
  return worldState.diffs.get(key) || null
}

export function writeDiff(key, diff) {
  diff.updatedAt = Date.now()
  worldState.diffs.set(key, diff)
  dirtyPanels.add(key)
  scheduleFlush()
}

export function markVisited(px, py) {
  const { sx, sy } = sectorOf(px, py)
  const key = sectorKey(sx, sy)
  if (!worldState.visitedSectors.has(key)) {
    worldState.visitedSectors.add(key)
    metaDirty = true
    scheduleFlush()
  }
}

export function addPermanentKey(key) {
  if (!worldState.permanentKeys.has(key)) {
    worldState.permanentKeys.add(key)
    metaDirty = true
    scheduleFlush()
  }
}

// Evict farthest-from-player, oldest-first, skipping permanents.
export function evictIfNeeded(playerPx, playerPy) {
  const over = worldState.diffs.size - MAX_DIFFS
  if (over <= 0) return []
  const candidates = []
  for (const [key, diff] of worldState.diffs) {
    if (worldState.permanentKeys.has(key)) continue
    const [px, py] = key.split(',').map(Number)
    const dist = Math.hypot(px - playerPx, py - playerPy)
    candidates.push({ key, dist, updatedAt: diff.updatedAt || 0 })
  }
  candidates.sort((a, b) => b.dist - a.dist || a.updatedAt - b.updatedAt)
  const evicted = candidates.slice(0, over).map((c) => c.key)
  for (const key of evicted) {
    worldState.diffs.delete(key)
    dirtyPanels.delete(key)
    dbDelete('worldDiffs', key).catch(() => {})
  }
  return evicted
}

function scheduleFlush() {
  if (flushTimer) return
  flushTimer = setTimeout(() => flushWorld(), FLUSH_DEBOUNCE_MS)
}

export async function flushWorld() {
  clearTimeout(flushTimer)
  flushTimer = null
  const panels = [...dirtyPanels]
  dirtyPanels = new Set()
  for (const key of panels) {
    const diff = worldState.diffs.get(key)
    if (diff) await dbPut('worldDiffs', key, diff).catch(() => {})
  }
  if (metaDirty) {
    metaDirty = false
    await dbPut('meta', 'main', {
      galaxySeed: worldState.galaxySeed,
      visitedSectors: [...worldState.visitedSectors],
      permanentKeys: [...worldState.permanentKeys],
      schemaVersion: 1,
      genVersion: GEN_VERSION,
      updatedAt: Date.now(),
    }).catch(() => {})
  }
}
