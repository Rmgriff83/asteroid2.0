// Fixed logical panel size — REQUIRED for determinism. Generation happens in
// this coordinate space on every device; Phaser Scale.FIT letterboxes it.
export const PANEL_W = 1280
export const PANEL_H = 800

export const SECTOR_SIZE = 16 // panels per sector side
export const GALAXY_CENTER = { sx: 0, sy: 0 }

// Rolled per campaign later (stored in meta); fixed default for dev.
export const DEFAULT_GALAXY_SEED = 0x5eed5eed

// Bumped when generation output changes shape/meaning — a mismatch against the
// saved meta re-rolls the world (diffs wiped, player profile kept).
export const GEN_VERSION = 2

// Per-subsystem RNG channels. Each subsystem draws from its own derived
// stream so adding a feature later never shifts existing panels' content.
export const CH = {
  SECTOR: 1,
  ROCKS: 2,
  PLANET: 3,
  WELL: 4,
  ENEMY: 5,
  MINERAL: 6,
  AMBIENT: 7,
  STATION: 8,
  NAMING: 9,
  STARS: 10, // superseded by LAYOUT (kept reserved — never reuse)
  STARFIELD: 11, // per-panel background star layer
  LAYOUT: 12, // sector-level system placement + panel roles
}

// Asteroid size tiers (logical units)
export const ASTEROID_TIERS = [54, 30, 16]
