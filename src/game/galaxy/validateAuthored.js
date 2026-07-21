// Import-time validation for authored content files (schema v2 — see
// authored.js). Pure module: no stores, no Vue. Returns every problem at
// once so a writer (human or Claude) can fix the whole file in one pass.
// ok ⇔ zero errors; warnings never block; `normalized` only when ok.
import { DIALOGUE_POOLS } from '../data/lore'
import { AUGMENTS } from '../data/augments'
import { RECIPES } from '../data/recipes'
import { RAW_IDS } from '../data/resources'
import { STAR_TYPE_IDS } from '../data/stars'
import { PLANET_TYPES, ENEMY_FLAVORS, SYSTEM_TYPES } from './sectorProps'
import { normalizeAuthored } from './authored'
import bundled from '../data/authored/galaxy.json'

export const BP_IDS = AUGMENTS.filter((a) => a.blueprint).map((a) => a.blueprint)
export const RECIPE_IDS = RECIPES.map((r) => r.id)

// the ring roles the admin pin editor offers (subset of layout specials)
export const PIN_ROLES = ['core', 'inner', 'temperate', 'belt', 'giants', 'icy', 'fringe']

const KEY_RE = /^-?\d+,-?\d+$/
const DIALOGUE_ID_RE = /^[a-z0-9][a-z0-9-]*$/

const SECTOR_FIELDS = new Set([
  'systemType', 'danger', 'richness', 'density', 'enemyFlavor',
  'stationDensity', 'starCount', 'starType', 'name',
])
const PIN_FIELDS = new Set([
  'planet', 'station', 'stationName', 'well', 'anomaly', 'resource',
  'role', 'noEnemies', 'clear',
])
const DIALOGUE_FIELDS = new Set(['id', 'speaker', 'lines', 'consequence', 'pool'])

const HARDCODED_LORE_IDS = new Set(
  Object.values(DIALOGUE_POOLS).flat().map((d) => d.id)
)

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

function numberIn(v, min, max) {
  return typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max
}

export function validateAuthored(data) {
  const errors = []
  const warnings = []
  const err = (msg) => errors.push(msg)
  const warn = (msg) => warnings.push(msg)

  if (!isPlainObject(data)) {
    return { ok: false, errors: ['root: must be a JSON object'], warnings, normalized: null }
  }
  if (data.version != null && data.version !== 1 && data.version !== 2) {
    err(`version: must be 1, 2, or absent (got ${JSON.stringify(data.version)})`)
  }
  if (data.version == null || data.version === 1) {
    if (data.dialogues) err('version: v1 files must not carry a dialogues block — set "version": 2')
    else warn('v1 file (no version field) — imported with an empty dialogues block')
  }
  for (const key of Object.keys(data)) {
    if (!['version', 'sectors', 'panels', 'dialogues'].includes(key)) {
      err(`root: unknown key "${key}"`)
    }
  }

  // ---- dialogues (validated first so pin.anomaly can resolve against them) ----
  const fileDialogueIds = new Set()
  const dialogues = Array.isArray(data.dialogues) ? data.dialogues : []
  if (data.dialogues != null && !Array.isArray(data.dialogues)) {
    err('dialogues: must be an array')
  }
  dialogues.forEach((d, i) => {
    const at = `dialogues[${i}]`
    if (!isPlainObject(d)) return err(`${at}: must be an object`)
    for (const key of Object.keys(d)) {
      if (!DIALOGUE_FIELDS.has(key)) err(`${at}: unknown field "${key}"`)
    }
    if (typeof d.id !== 'string' || !DIALOGUE_ID_RE.test(d.id)) {
      err(`${at}.id: must be lowercase-kebab (got ${JSON.stringify(d.id)})`)
    } else {
      if (fileDialogueIds.has(d.id)) err(`${at}.id: duplicate id "${d.id}" in this file`)
      if (HARDCODED_LORE_IDS.has(d.id)) {
        err(`${at}.id: "${d.id}" collides with a hardcoded lore.js entry (those cannot be replaced — pick a new id)`)
      }
      fileDialogueIds.add(d.id)
    }
    if (typeof d.speaker !== 'string' || !d.speaker.trim()) {
      err(`${at}.speaker: required non-empty string`)
    } else {
      if (d.speaker.length > 28) warn(`${at}.speaker: longer than 28 chars — may crowd the dialogue box`)
      if (d.speaker !== d.speaker.toUpperCase()) warn(`${at}.speaker: house style is ALL CAPS`)
    }
    if (!Array.isArray(d.lines) || d.lines.length < 1 || d.lines.length > 6) {
      err(`${at}.lines: must be an array of 1–6 strings`)
    } else {
      d.lines.forEach((line, li) => {
        if (typeof line !== 'string' || !line.trim()) err(`${at}.lines[${li}]: empty line`)
        else if (line.length > 160) warn(`${at}.lines[${li}]: longer than 160 chars — wraps past two rows`)
      })
    }
    if (d.pool != null && !SYSTEM_TYPES.includes(d.pool)) {
      err(`${at}.pool: must be one of ${SYSTEM_TYPES.join('/')} or absent (got ${JSON.stringify(d.pool)})`)
    }
    if (d.consequence != null) {
      const c = d.consequence
      if (!isPlainObject(c) || Object.keys(c).length !== 1) {
        err(`${at}.consequence: must be an object with exactly one key (credits | resource | augBlueprint | recipe)`)
      } else if (c.credits !== undefined) {
        if (!Number.isInteger(c.credits) || c.credits < 1 || c.credits > 500) {
          err(`${at}.consequence.credits: integer 1–500 (got ${JSON.stringify(c.credits)})`)
        }
      } else if (c.resource !== undefined) {
        if (!isPlainObject(c.resource) || !RAW_IDS.includes(c.resource.type)) {
          err(`${at}.consequence.resource.type: must be one of ${RAW_IDS.join('/')}`)
        }
        if (!isPlainObject(c.resource) || !Number.isInteger(c.resource.qty) || c.resource.qty < 1 || c.resource.qty > 20) {
          err(`${at}.consequence.resource.qty: integer 1–20`)
        }
      } else if (c.augBlueprint !== undefined) {
        if (!BP_IDS.includes(c.augBlueprint)) {
          err(`${at}.consequence.augBlueprint: unknown blueprint "${c.augBlueprint}" (valid: ${BP_IDS.join(', ')})`)
        }
      } else if (c.recipe !== undefined) {
        if (!RECIPE_IDS.includes(c.recipe)) {
          err(`${at}.consequence.recipe: unknown recipe "${c.recipe}" (valid: ${RECIPE_IDS.join(', ')})`)
        }
      } else {
        err(`${at}.consequence: unknown key "${Object.keys(c)[0]}" — the game silently ignores it (valid: credits, resource, augBlueprint, recipe)`)
      }
    }
    if (!d.pool) {
      warn(`${at} ("${d.id}"): pin-only entry — make sure a panel pin references it via "anomaly"`)
    }
  })

  // dialogue ids resolvable by pins: hardcoded ∪ bundled galaxy.json ∪ this file
  const knownDialogueIds = new Set([
    ...HARDCODED_LORE_IDS,
    ...(bundled.dialogues || []).map((d) => d.id),
    ...fileDialogueIds,
  ])

  // ---- sectors ----
  if (data.sectors != null && !isPlainObject(data.sectors)) err('sectors: must be an object')
  for (const [key, ov] of Object.entries(data.sectors || {})) {
    const at = `sectors["${key}"]`
    if (!KEY_RE.test(key)) err(`${at}: key must be "sx,sy" integers`)
    if (!isPlainObject(ov)) {
      err(`${at}: must be an object`)
      continue
    }
    for (const f of Object.keys(ov)) {
      if (!SECTOR_FIELDS.has(f)) err(`${at}: unknown field "${f}"`)
    }
    if (ov.systemType !== undefined && !SYSTEM_TYPES.includes(ov.systemType)) {
      err(`${at}.systemType: must be one of ${SYSTEM_TYPES.join('/')}`)
    }
    if (ov.danger !== undefined && !numberIn(ov.danger, 0, 1)) err(`${at}.danger: number 0–1`)
    if (ov.richness !== undefined && !numberIn(ov.richness, 0, 1)) err(`${at}.richness: number 0–1`)
    if (ov.density !== undefined && !numberIn(ov.density, 0, 1)) err(`${at}.density: number 0–1`)
    if (ov.enemyFlavor !== undefined && !ENEMY_FLAVORS.includes(ov.enemyFlavor)) {
      err(`${at}.enemyFlavor: must be one of ${ENEMY_FLAVORS.join('/')}`)
    }
    if (ov.stationDensity !== undefined && !numberIn(ov.stationDensity, 0, 0.5)) {
      err(`${at}.stationDensity: number 0–0.5`)
    }
    if (ov.starCount !== undefined && !(Number.isInteger(ov.starCount) && ov.starCount >= 0 && ov.starCount <= 3)) {
      err(`${at}.starCount: integer 0–3`)
    }
    if (ov.starType !== undefined && ov.starType !== 'mixed' && !STAR_TYPE_IDS.includes(ov.starType)) {
      err(`${at}.starType: must be "mixed" or one of ${STAR_TYPE_IDS.join('/')}`)
    }
    if (ov.name !== undefined && (typeof ov.name !== 'string' || !ov.name.trim() || ov.name.length > 40)) {
      err(`${at}.name: non-empty string, max 40 chars`)
    }
  }

  // ---- panels ----
  if (data.panels != null && !isPlainObject(data.panels)) err('panels: must be an object')
  for (const [key, pin] of Object.entries(data.panels || {})) {
    const at = `panels["${key}"]`
    if (!KEY_RE.test(key)) err(`${at}: key must be "px,py" integers`)
    if (!isPlainObject(pin)) {
      err(`${at}: must be an object`)
      continue
    }
    for (const f of Object.keys(pin)) {
      if (!PIN_FIELDS.has(f)) err(`${at}: unknown field "${f}"`)
    }
    if (pin.planet !== undefined) {
      if (!isPlainObject(pin.planet) || !PLANET_TYPES.includes(pin.planet.type)) {
        err(`${at}.planet.type: must be one of ${PLANET_TYPES.join('/')}`)
      } else if (pin.planet.size !== undefined) {
        if (!numberIn(pin.planet.size, 1, 1000)) err(`${at}.planet.size: positive number`)
        else if (pin.planet.size < 60 || pin.planet.size > 160) warn(`${at}.planet.size: outside the usual 60–160 range`)
      }
    }
    if (pin.station !== undefined && pin.station !== true) err(`${at}.station: must be true or absent`)
    if (pin.stationName !== undefined) {
      if (typeof pin.stationName !== 'string' || !pin.stationName.trim() || pin.stationName.length > 30) {
        err(`${at}.stationName: non-empty string, max 30 chars`)
      }
      if (!pin.station) warn(`${at}.stationName: set without "station": true — only applies if the panel rolls a station procedurally`)
    }
    if (pin.well !== undefined) {
      const w = pin.well
      const okString = w === 'none' || w === 'blackhole' || w === 'star'
      const okObj = isPlainObject(w) && w.kind === 'star' && STAR_TYPE_IDS.includes(w.starType)
      if (!okString && !okObj) {
        err(`${at}.well: must be "none" | "blackhole" | "star" | {kind:"star", starType: ${STAR_TYPE_IDS.join('/')}}`)
      }
    }
    if (pin.anomaly !== undefined) {
      if (typeof pin.anomaly !== 'string' || !pin.anomaly.trim()) {
        err(`${at}.anomaly: must be a dialogue id string`)
      } else if (!knownDialogueIds.has(pin.anomaly)) {
        err(`${at}.anomaly: unknown dialogue id "${pin.anomaly}" (not in lore.js, bundled galaxy.json, or this file's dialogues)`)
      }
    }
    if (pin.resource !== undefined) {
      if (!isPlainObject(pin.resource) || !RAW_IDS.includes(pin.resource.type)) {
        err(`${at}.resource.type: must be one of ${RAW_IDS.join('/')}`)
      } else if (pin.resource.rich !== undefined && typeof pin.resource.rich !== 'boolean') {
        err(`${at}.resource.rich: boolean`)
      }
    }
    if (pin.role !== undefined && !PIN_ROLES.includes(pin.role)) {
      err(`${at}.role: must be one of ${PIN_ROLES.join('/')}`)
    }
    if (pin.noEnemies !== undefined && pin.noEnemies !== true) err(`${at}.noEnemies: must be true or absent`)
    if (pin.clear !== undefined && pin.clear !== true) err(`${at}.clear: must be true or absent`)
  }

  // pool appends remap unvisited procedural anomalies (lore.js caveat)
  const poolAppends = dialogues.filter((d) => d.pool).length
  if (poolAppends) {
    warn(`${poolAppends} pool ${poolAppends === 1 ? 'entry' : 'entries'} — growing a pool re-rolls which dialogue UNVISITED procedural anomalies show (positions never move; accepted trade-off)`)
  }

  const ok = errors.length === 0
  return { ok, errors, warnings, normalized: ok ? normalizeAuthored(data) : null }
}
