// Per-ship cockpit skins: everything the cockpit shell positions or tints.
// The seam: this data declares anchors/geometry → the per-ship art component
// (CHROME_ART in CockpitShell) draws the dash housing + yoke around them →
// the shell mounts invariant live-data components (GlanceScreen inside
// `consoles.cargo`, DashInstruments at `instruments`) inside the cover-scaled
// stage. The shell owns the invariants — space view, glow overlays, stow/open
// state machine, glance internals, terminal, scanlines, reduced-motion gating.
// A skin may only re-art and re-anchor.
//
// All coordinates are in the authored 1760×1080 stage space, anchored
// bottom-center (the shell cover-scales the stage and crops off the top).
//
// Palette: the primary accent comes from the SHIP (data/accents.js — player
// configurable per ship); the skin only carries `warn*`, the demoted amber
// reserved for warning lamps and small trim.
import { getShip } from './ships'

export const COCKPIT_SKINS = {
  base: {
    id: 'base',
    art: 'base',
    warn: '#e0a850',
    warnBright: '#f4cd86',
    warnDim: '#8a6d34',
    yoke: { x: 880, y: 930 }, // column center; art draws relative to this
    // the dash carries exactly two console binnacles flanking the yoke:
    // cargo (interactive — glance content + ship status mounts here) and
    // systems (fuel dial + trinket dock)
    consoles: {
      systems: { x: 170, y: 670, w: 360, h: 270 }, // reads smaller than cargo — it only holds the dial
      cargo: { x: 1140, y: 640, w: 480, h: 300 },
    },
    instruments: [{ id: 'fuel', kind: 'dial', x: 350, y: 780, r: 62 }],
    reticle: { x: 880, y: 530, opacity: 0.5 },
    terminalMount: { yPct: 0.5 }, // open-terminal vertical centering hook
    trinkets: [
      // 3 hang points on the rearview: first holds the charm placeholder,
      // the rest are open hooks awaiting collected charms
      { id: 'rearview', kind: 'hanging', x: 880, y: 46, swayS: 5.5, slots: 3 },
      // the bobble-head perch: one fixed spot on this hull's dash
      { id: 'bobble', kind: 'bobble', x: 470, y: 656 },
    ],
  },
}

export function getCockpitSkin(shipId) {
  const ship = getShip(shipId)
  return COCKPIT_SKINS[ship.cockpitSkin] || COCKPIT_SKINS.base
}
