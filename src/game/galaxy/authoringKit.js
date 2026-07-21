// Builds the self-describing "authoring kit" the admin page exports for an
// offline writer (a separate Claude session): a gazetteer of the real world
// hooks in a sector radius + the current lore canon + the import schema and
// its rules, so the writer can produce a valid schema-v2 content file that
// imports cleanly. Pure module — admin-only caller, but nothing here is
// dev-gated (it's just data assembly).
import { generatePanel } from './panelGen'
import { resolveSector, sectorKey, SYSTEM_TYPES } from './sectorProps'
import { SECTOR_SIZE } from './constants'
import { getMergedPools } from '../data/lore'
import { RAW_IDS } from '../data/resources'
import { BP_IDS, RECIPE_IDS, PIN_ROLES } from './validateAuthored'

export function buildAuthoringKit(galaxySeed, radius, authored) {
  const r = Math.max(1, Math.min(6, Math.round(radius) || 1))
  const sectors = []

  for (let sy = -r; sy <= r; sy++) {
    for (let sx = -r; sx <= r; sx++) {
      const key = sectorKey(sx, sy)
      const sec = resolveSector(galaxySeed, sx, sy, authored)
      const stations = []
      const planets = []
      const anomalies = []
      const pins = {}

      for (let py = sy * SECTOR_SIZE; py < (sy + 1) * SECTOR_SIZE; py++) {
        for (let px = sx * SECTOR_SIZE; px < (sx + 1) * SECTOR_SIZE; px++) {
          const spec = generatePanel(galaxySeed, px, py, authored)
          const panelKey = `${px},${py}`
          if (spec.station) stations.push({ panelKey, name: spec.station.name })
          if (spec.planet) {
            planets.push({ panelKey, type: spec.planet.type, baseSite: spec.planet.baseSite })
          }
          if (spec.anomaly) anomalies.push({ panelKey, dialogueId: spec.anomaly.dialogueId })
          if (authored?.panels?.[panelKey]) pins[panelKey] = authored.panels[panelKey]
        }
      }

      sectors.push({
        key,
        name: sec.name,
        classification: sec.classification,
        systemType: sec.systemType,
        danger: Number(sec.danger.toFixed(2)),
        richness: Number(sec.richness.toFixed(2)),
        override: authored?.sectors?.[key] || null,
        stations,
        planets,
        anomalies,
        pins,
      })
    }
  }

  const dialogues = authored?.dialogues || []
  return {
    meta: {
      game: 'DEEPFIELD',
      schemaVersion: 2,
      radius: r,
      galaxySeed,
      sectorSize: SECTOR_SIZE,
      note: 'Panels are keyed "px,py"; sectors "sx,sy" (sx = floor(px/16)). Only reference panel keys listed in this kit.',
    },
    rules: {
      output: 'One JSON object: { version: 2, sectors: {}, panels: {}, dialogues: [] }. Output ONLY new/changed entries — the import merges additively (dialogues replace-by-id; sector/panel entries replace whole).',
      appendOnly: 'Never remove or reorder existing dialogue pool entries. New pool entries append. Editing hardcoded lore.js entries is impossible — new ids only.',
      pinOnly: 'A dialogue without "pool" must be referenced by some panels[key].anomaly, or it is unreachable.',
      sectorReplace: 'A sector override replaces the whole entry — when renaming a sector that already has an override, copy its existing fields and add "name".',
      consequences: 'Optional, exactly one key: {credits: 1..500} | {resource: {type, qty 1..20}} | {augBlueprint: id} | {recipe: id}. Blueprint grants should end with the SCHEMATIC RECOVERED formula.',
      textLimits: 'speaker ≤ 28 chars ALL CAPS; 1–6 lines, each ≤ ~120 chars; dialogue ids lowercase-kebab, globally unique.',
    },
    validIds: {
      systemTypes: SYSTEM_TYPES,
      pinRoles: PIN_ROLES,
      augBlueprints: BP_IDS,
      recipes: RECIPE_IDS,
      resources: RAW_IDS,
      consequenceShapes: [
        '{ "credits": 15 }',
        '{ "resource": { "type": "ferrite", "qty": 3 } }',
        '{ "augBlueprint": "bp-vapor" }',
        '{ "recipe": "warpfuel" }',
      ],
    },
    // current canon: hardcoded pools + authored appends, and pin-only entries
    dialoguePools: getMergedPools(),
    pinOnlyDialogues: dialogues.filter((d) => !d.pool),
    sectors,
    importSkeleton: { version: 2, sectors: {}, panels: {}, dialogues: [] },
  }
}
