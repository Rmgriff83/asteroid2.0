// Base-interior skins: everything BaseShell positions or tints, mirroring
// cockpitSkins.js. Coordinates are in the authored 1760×1080 stage space,
// anchored bottom-center (the shell cover-scales and crops off the top).
// The primary accent comes from the PLANET (planetTheme stroke — each base
// interior carries its world's hue); the skin only carries the demoted warn
// amber for lamps and trim.
export const BASE_SKINS = {
  outpost: {
    id: 'outpost',
    art: 'outpost',
    warn: '#e0a850',
    warnBright: '#f4cd86',
    warnDim: '#8a6d34',
    // the glazed band the chrome frames (the surface view shows through here)
    window: { x: 120, y: 60, w: 1520, h: 560 },
    consoles: {
      ops: { x: 1150, y: 680, w: 480, h: 320 },
    },
    trinkets: [
      // a hanging rail over the window and a shelf on the sill
      { id: 'window-rail', kind: 'hanging', x: 620, y: 76, swayS: 6, slots: 3 },
      { id: 'shelf', kind: 'shelf', x: 330, y: 742, slots: 3 },
    ],
  },
}

export function getBaseSkin() {
  return BASE_SKINS.outpost
}
