// The sparse authored-override layer. The bundled galaxy.json ships with the
// app (App Store 4.7-safe: static data, no runtime code download). In dev the
// admin editor overlays a working copy on top of it.
//
// Schema v2: { version: 2, sectors: {"sx,sy": {...}}, panels: {"px,py": {...}},
// dialogues: [{ id, speaker, lines[], consequence?, pool? }] }. Dialogue
// entries with `pool` append to that DIALOGUE_POOL (append-only contract —
// see lore.js header); entries without `pool` are pin-only, referenced via a
// panel pin's `anomaly` field. v1 data ({sectors, panels}) normalizes cleanly.
import bundled from '../data/authored/galaxy.json'

let workingCopy = null // normalized v2 object — set by the admin editor (dev only)
let authoredVersion = 0 // bumped on every admin edit — cache-invalidation key

export function normalizeAuthored(data) {
  return {
    version: 2,
    sectors: data?.sectors || {},
    panels: data?.panels || {},
    dialogues: Array.isArray(data?.dialogues) ? data.dialogues : [],
  }
}

// replace-by-id in place (preserves pool order for already-shipped entries),
// append unknown ids at the end in file order
export function mergeDialogues(base, extra) {
  const out = [...base]
  const idx = new Map(out.map((d, i) => [d.id, i]))
  for (const d of extra || []) {
    if (idx.has(d.id)) out[idx.get(d.id)] = d
    else {
      idx.set(d.id, out.length)
      out.push(d)
    }
  }
  return out
}

export function setWorkingCopy(copy) {
  workingCopy = copy == null ? null : normalizeAuthored(copy)
  authoredVersion++
}

export function getAuthoredVersion() {
  return authoredVersion
}

export function getWorkingCopy() {
  return workingCopy || { version: 2, sectors: {}, panels: {}, dialogues: [] }
}

export function getAuthored() {
  if (!workingCopy) return normalizeAuthored(bundled)
  return {
    version: 2,
    sectors: { ...bundled.sectors, ...workingCopy.sectors },
    panels: { ...bundled.panels, ...workingCopy.panels },
    dialogues: mergeDialogues(bundled.dialogues || [], workingCopy.dialogues),
  }
}

export function isAdminEnabled() {
  return import.meta.env.DEV || import.meta.env.VITE_ADMIN === '1'
}
