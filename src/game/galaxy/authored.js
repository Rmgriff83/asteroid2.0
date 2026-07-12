// The sparse authored-override layer. The bundled galaxy.json ships with the
// app (App Store 4.7-safe: static data, no runtime code download). In dev the
// admin editor overlays a working copy on top of it.
import bundled from '../data/authored/galaxy.json'

let workingCopy = null // { sectors: {}, panels: {} } — set by the admin editor (dev only)

export function setWorkingCopy(copy) {
  workingCopy = copy
}

export function getWorkingCopy() {
  return workingCopy || { sectors: {}, panels: {} }
}

export function getAuthored() {
  if (!workingCopy) return bundled
  return {
    sectors: { ...bundled.sectors, ...workingCopy.sectors },
    panels: { ...bundled.panels, ...workingCopy.panels },
  }
}

export function isAdminEnabled() {
  return import.meta.env.DEV || import.meta.env.VITE_ADMIN === '1'
}
